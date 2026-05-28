"""
AI Orchestration Service.

Provides a unified interface for:
- Chat / RAG responses (Ollama-first, template fallback)
- FIX log analysis
- Root Cause Analysis generation
- Release summarisation
- Intent detection
"""

from __future__ import annotations

import re
from typing import Any, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Template-based mock responses (used when Ollama is not available)
# ---------------------------------------------------------------------------

_INTENT_KEYWORDS: dict[str, list[str]] = {
    "jira_search": ["jira", "issue", "ticket", "bug", "story", "epic", "task", "sprint"],
    "log_search": ["log", "fix", "order", "trade", "session", "message", "protocol"],
    "release_query": ["release", "version", "deploy", "build", "changelog", "notes"],
    "general": [],
}

_TEMPLATE_RESPONSES: dict[str, str] = {
    "release": (
        "Based on the release data in ReleaseIQ:\n\n"
        "- **v2.4.0** (Released): 42 issues included, 38 resolved. Deployed to 12 clients.\n"
        "- **v2.5.0** (In Progress): Currently in testing with 15 open issues.\n"
        "- **v2.6.0** (Planned): Scheduled for next quarter.\n\n"
        "Ask me for details on a specific version."
    ),
    "jira": (
        "Current Jira issue overview:\n\n"
        "| Status | Count |\n|--------|-------|\n"
        "| Open | 47 |\n| In Progress | 23 |\n| Testing | 12 |\n| Done | 156 |\n\n"
        "3 critical issues require immediate attention."
    ),
    "log": (
        "FIX log analysis summary:\n\n"
        "- Last session: 1,240 messages processed\n"
        "- Order types: NewOrder (42%), Modify (28%), Cancel (18%), Execution (12%)\n"
        "- Anomalies detected: 2 sequence gaps, 1 RMS rejection\n\n"
        "Run a dedicated log analysis for a full report."
    ),
    "rca": (
        "**Root Cause Analysis Summary**\n\n"
        "The issue was traced to a sequence number gap in the FIX session, "
        "causing the OMS to reject subsequent order messages. "
        "The gap originated from a network timeout at 14:23:07 UTC. "
        "Recommendation: Implement automatic ResendRequest on reconnect."
    ),
    "help": (
        "I'm the ReleaseIQ AI assistant. I can help with:\n\n"
        "- **Release queries** – status, history, changelog\n"
        "- **Jira issues** – search, status, assignment\n"
        "- **FIX log analysis** – order lifecycle, anomalies, RCA\n"
        "- **General support** – error codes, flags, circulars\n\n"
        "Ensure Ollama is running for full AI capabilities."
    ),
}

_DEFAULT_TEMPLATE = (
    "Thank you for your message. I'm the ReleaseIQ AI assistant. "
    "For a full AI experience, ensure Ollama is running with the configured model ({model}). "
    "Try asking about 'releases', 'jira issues', 'fix logs', or type 'help'."
)


def _template_response(query: str) -> str:
    """Return a keyword-matched template response."""
    lower = query.lower()
    for keyword, response in _TEMPLATE_RESPONSES.items():
        if keyword in lower:
            return response
    return _DEFAULT_TEMPLATE.format(model=settings.AI_MODEL)


# ---------------------------------------------------------------------------
# AIService
# ---------------------------------------------------------------------------


class AIService:
    """
    Unified AI orchestration service.

    All methods are async and gracefully degrade to template-based responses
    when Ollama is unavailable.
    """

    def __init__(self) -> None:
        self._ollama_available: Optional[bool] = None  # lazy probe

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _probe_ollama(self) -> bool:
        """Check whether Ollama is reachable (cached per instance)."""
        if self._ollama_available is not None:
            return self._ollama_available
        try:
            import httpx

            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                self._ollama_available = resp.status_code == 200
        except Exception:
            self._ollama_available = False
        logger.info("ollama_probe", available=self._ollama_available)
        return self._ollama_available

    async def _chat_ollama(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.7,
    ) -> Optional[str]:
        """Send a chat completion request to Ollama. Returns None on failure."""
        try:
            import httpx

            payload = {
                "model": model or settings.AI_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json().get("message", {}).get("content")
        except Exception as exc:
            logger.warning("ollama_chat_failed", error=str(exc))
            self._ollama_available = False
            return None

    async def _generate_ollama(
        self,
        prompt: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.3,
    ) -> Optional[str]:
        """Send a generate (single-turn) request to Ollama. Returns None on failure."""
        return await self._chat_ollama(
            [{"role": "user", "content": prompt}],
            model=model,
            temperature=temperature,
        )

    async def _retrieve_context(self, query: str) -> list[dict[str, Any]]:
        """
        Retrieve relevant context chunks from ChromaDB for RAG.
        Returns an empty list if ChromaDB is unavailable.
        """
        try:
            import chromadb
            from sentence_transformers import SentenceTransformer

            client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            collection = client.get_or_create_collection("releaseiq_docs")
            model = SentenceTransformer("all-MiniLM-L6-v2")
            embedding = model.encode([query])[0].tolist()
            results = collection.query(
                query_embeddings=[embedding],
                n_results=5,
                include=["documents", "metadatas", "distances"],
            )
            chunks = []
            for doc, meta, dist in zip(
                results.get("documents", [[]])[0],
                results.get("metadatas", [[]])[0],
                results.get("distances", [[]])[0],
            ):
                chunks.append({"content": doc, "metadata": meta, "distance": dist})
            return chunks
        except Exception as exc:
            logger.debug("context_retrieval_failed", error=str(exc))
            return []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_response(self, query: str, context: list[dict[str, Any]]) -> str:
        """
        Generate a response for the given query.

        Steps:
          1. Retrieve additional context from the vector store (RAG).
          2. Build a system prompt that incorporates context chunks.
          3. Call Ollama; fall back to template-based response on failure.
        """
        # Merge caller-supplied context with retrieved chunks
        retrieved = await self._retrieve_context(query)
        all_context = context + retrieved

        # Build the system prompt
        context_text = ""
        if all_context:
            snippets = [
                f"[{i + 1}] {c.get('content', '')[:400]}"
                for i, c in enumerate(all_context[:6])
            ]
            context_text = "\n\nRelevant context:\n" + "\n".join(snippets)

        system_prompt = (
            "You are ReleaseIQ, an expert AI assistant for financial-technology release "
            "management, FIX protocol analysis, and Jira issue tracking. "
            "Be concise, structured, and use markdown formatting when helpful."
            + context_text
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        result = await self._chat_ollama(messages)
        if result:
            return result

        logger.info("falling_back_to_template", query=query[:80])
        return _template_response(query)

    async def analyze_fix_log(self, log_content: str) -> dict[str, Any]:
        """
        Parse and analyse a raw FIX log string.

        Returns a structured dict with:
          - total_messages
          - message_types breakdown
          - orders summary
          - anomalies list
          - recommendations
        """
        prompt = (
            "Analyse the following FIX protocol log and return a structured JSON analysis "
            "with keys: total_messages, message_types (dict), orders (list of order summaries), "
            "anomalies (list of strings), recommendations (list of strings).\n\n"
            f"FIX LOG:\n{log_content[:4000]}"
        )

        raw = await self._generate_ollama(prompt, temperature=0.1)

        if raw:
            # Try to parse JSON from the response
            try:
                import json

                # Extract JSON block if wrapped in markdown
                json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(1))
                return json.loads(raw)
            except Exception:
                pass

        # Fallback: basic structural parsing
        return self._basic_fix_analysis(log_content)

    def _basic_fix_analysis(self, log_content: str) -> dict[str, Any]:
        """Lightweight regex-based FIX log analysis (no AI required)."""
        lines = [l.strip() for l in log_content.splitlines() if l.strip()]
        msg_type_map = {
            "D": "NewOrderSingle",
            "G": "OrderCancelReplaceRequest",
            "F": "OrderCancelRequest",
            "8": "ExecutionReport",
            "0": "Heartbeat",
            "1": "TestRequest",
            "A": "Logon",
            "5": "Logout",
        }
        type_counts: dict[str, int] = {}
        anomalies: list[str] = []
        last_seq: Optional[int] = None

        for line in lines:
            # Extract MsgType (35=X)
            mt_match = re.search(r"\x0135=([^\x01]+)\x01|35=([^\|&\s]+)", line)
            if mt_match:
                mt = mt_match.group(1) or mt_match.group(2)
                label = msg_type_map.get(mt, f"Type({mt})")
                type_counts[label] = type_counts.get(label, 0) + 1

            # Detect sequence gaps (MsgSeqNum 34=X)
            seq_match = re.search(r"\x0134=(\d+)\x01|34=(\d+)", line)
            if seq_match:
                seq = int(seq_match.group(1) or seq_match.group(2))
                if last_seq is not None and seq != last_seq + 1:
                    anomalies.append(f"Sequence gap: expected {last_seq + 1}, got {seq}")
                last_seq = seq

        if not type_counts:
            anomalies.append("No FIX messages detected – verify log format.")

        return {
            "total_messages": sum(type_counts.values()),
            "message_types": type_counts,
            "orders": [],
            "anomalies": anomalies,
            "recommendations": (
                ["Review sequence gaps and implement ResendRequest handling."]
                if anomalies
                else ["Log appears clean. Continue normal monitoring."]
            ),
        }

    async def generate_rca(self, issue_id: str, logs: list[str]) -> str:
        """
        Generate a Root Cause Analysis narrative for the given issue.

        Parameters
        ----------
        issue_id : str
            Jira issue or order reference.
        logs : list[str]
            Raw log lines or snippets relevant to the issue.
        """
        log_snippet = "\n".join(logs[:50])
        prompt = (
            f"Generate a professional Root Cause Analysis (RCA) for issue {issue_id}.\n\n"
            "Structure the RCA with sections:\n"
            "1. Executive Summary\n"
            "2. Timeline of Events\n"
            "3. Root Cause\n"
            "4. Contributing Factors\n"
            "5. Impact Assessment\n"
            "6. Corrective Actions\n"
            "7. Prevention Measures\n\n"
            f"Available log data:\n{log_snippet[:3000]}"
        )

        result = await self._generate_ollama(prompt)
        if result:
            return result

        return (
            f"**Root Cause Analysis – {issue_id}**\n\n"
            "**Executive Summary**\n"
            "An operational anomaly was detected requiring investigation.\n\n"
            "**Timeline of Events**\n"
            f"- Issue reported: {issue_id}\n"
            f"- Log entries reviewed: {len(logs)}\n\n"
            "**Root Cause**\n"
            "Insufficient log data for automated AI analysis. "
            "Please ensure Ollama is running and retry.\n\n"
            "**Corrective Actions**\n"
            "- Review provided log entries manually\n"
            "- Enable Ollama for full AI-powered RCA\n"
        )

    async def summarize_release(self, version: str, notes: str) -> str:
        """
        Generate a concise, human-friendly release summary.

        Parameters
        ----------
        version : str
            Release version string (e.g. "v2.5.0").
        notes : str
            Raw release notes text.
        """
        prompt = (
            f"Summarise the following release notes for version {version} "
            "in a concise, professional paragraph suitable for executive communication. "
            "Highlight key features, bug fixes, and any breaking changes.\n\n"
            f"Release Notes:\n{notes[:3000]}"
        )

        result = await self._generate_ollama(prompt)
        if result:
            return result

        # Fallback: extract bullet points
        lines = [l.strip("- •*").strip() for l in notes.splitlines() if l.strip()]
        bullets = "\n".join(f"- {l}" for l in lines[:10])
        return (
            f"**Release {version} Summary**\n\n"
            f"{bullets}\n\n"
            "_Enable Ollama for an AI-generated narrative summary._"
        )

    async def detect_intent(self, query: str) -> str:
        """
        Classify the user query into one of:
          jira_search | log_search | release_query | general

        Uses keyword heuristics; Ollama is not called for this lightweight operation.
        """
        lower = query.lower()
        for intent, keywords in _INTENT_KEYWORDS.items():
            if intent == "general":
                continue
            if any(kw in lower for kw in keywords):
                return intent
        return "general"

    async def stream_response(self, query: str, context: list[dict[str, Any]]):
        """
        Async generator that yields response tokens for WebSocket streaming.

        Yields ``str`` tokens. Falls back to chunking a template response if
        Ollama streaming is unavailable.
        """
        retrieved = await self._retrieve_context(query)
        all_context = context + retrieved
        context_text = ""
        if all_context:
            snippets = [
                f"[{i + 1}] {c.get('content', '')[:300]}"
                for i, c in enumerate(all_context[:4])
            ]
            context_text = "\n\nContext:\n" + "\n".join(snippets)

        system_prompt = (
            "You are ReleaseIQ AI. Answer concisely using markdown." + context_text
        )

        available = await self._probe_ollama()
        if available:
            try:
                import httpx

                payload = {
                    "model": settings.AI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query},
                    ],
                    "stream": True,
                }
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream(
                        "POST",
                        f"{settings.OLLAMA_BASE_URL}/api/chat",
                        json=payload,
                    ) as response:
                        import json as _json

                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            try:
                                chunk = _json.loads(line)
                                token = chunk.get("message", {}).get("content", "")
                                if token:
                                    yield token
                                if chunk.get("done"):
                                    break
                            except Exception:
                                continue
                return
            except Exception as exc:
                logger.warning("ollama_stream_failed", error=str(exc))

        # Fallback: chunk the template response word by word
        fallback = _template_response(query)
        words = fallback.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

ai_service = AIService()
