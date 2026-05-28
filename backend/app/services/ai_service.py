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
    "jira_search": [
        "jira", "getsctcl", "issue", "ticket", "bug", "story", "epic", "task", "sprint",
        "defect", "feature request", "assignee", "reporter",
    ],
    "log_search": [
        "log", "fix protocol", "order", "trade", "session", "message", "protocol",
        "crash", "exception", "error log", "oms log", "rms log",
    ],
    "release_query": [
        "release", "version", "deploy", "build", "changelog", "notes",
        "patch", "patch note", "patchnote", "optimus", "1209", "3009", "ctcl",
        "live", "qa", "for live", "for qa",
    ],
    "general": [],
}

_TEMPLATE_RESPONSES: dict[str, str] = {
    "release": (
        "I can look up release data for the Greeksoft CTCL products: **Optimus**, **1209**, and **3009**.\n\n"
        "Try asking:\n"
        "- \"Show patch notes for Optimus\"\n"
        "- \"What JIRAs are in the 1209 live patch?\"\n"
        "- \"List recent 3009 releases\""
    ),
    "patch": (
        "Patch notes are available for **Optimus**, **1209**, and **3009** across Live and QA environments.\n\n"
        "Try: \"Show patch notes for Optimus\" or \"What was fixed in the latest 1209 patch?\""
    ),
    "jira": (
        "JIRA issues use the project key **GETSCTCL** (e.g. GETSCTCL-14597).\n\n"
        "Try asking:\n"
        "- \"Tell me about GETSCTCL-14597\"\n"
        "- \"Show open bugs in the CTCLClient module\"\n"
        "- \"Who is assigned to critical issues?\""
    ),
    "getsctcl": (
        "JIRA issues in this project use the key format **GETSCTCL-XXXXX**.\n\n"
        "Ask me about a specific issue, e.g.: \"What is GETSCTCL-14597?\""
    ),
    "log": (
        "FIX protocol log analysis is available.\n\n"
        "- Session logs track: Logon, NewOrderSingle, ExecutionReport, Cancel, Heartbeat\n"
        "- Common anomalies: sequence gaps, RMS rejections, session resets\n\n"
        "Run a dedicated log analysis for a full report."
    ),
    "rca": (
        "**Root Cause Analysis**\n\n"
        "Provide a GETSCTCL issue ID or paste log content for an AI-generated RCA.\n\n"
        "Example: \"Generate RCA for GETSCTCL-14597\""
    ),
    "help": (
        "I'm the ReleaseIQ AI assistant for Greeksoft CTCL. I can help with:\n\n"
        "- **Releases** – Optimus, 1209, 3009 patch notes and status\n"
        "- **JIRA issues** – search GETSCTCL tickets by ID, status, or module\n"
        "- **FIX log analysis** – order lifecycle, anomalies, RCA\n"
        "- **Flags** – TradingStyle.txt and CTCLManager.ini settings\n"
        "- **Error codes** – exchange rejections and OMS/RMS errors\n\n"
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

    Uses LiteLLM/OpenAI-compatible proxy (primary) → Ollama (fallback) →
    keyword-template (final fallback).
    """

    def __init__(self) -> None:
        self._litellm_available: Optional[bool] = None   # lazy probe
        self._ollama_available: Optional[bool] = None    # lazy probe

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _probe_litellm(self) -> bool:
        """Check whether the LiteLLM proxy is reachable."""
        if self._litellm_available is not None:
            return self._litellm_available
        try:
            import httpx
            async with httpx.AsyncClient(timeout=4.0) as client:
                # Hit the /models endpoint — standard OpenAI-compatible probe
                resp = await client.get(
                    f"{settings.AI_BASE_URL}/models",
                    headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
                )
                self._litellm_available = resp.status_code in (200, 401, 403)
        except Exception:
            self._litellm_available = False
        logger.info("litellm_probe", available=self._litellm_available,
                    base_url=settings.AI_BASE_URL)
        return self._litellm_available

    async def _chat_litellm(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[str]:
        """
        Send a chat completion request to the LiteLLM/OpenAI-compatible proxy.
        Returns the assistant message content, or None on failure.
        """
        try:
            import httpx, json as _json

            payload = {
                "model": model or settings.AI_MODEL,
                "messages": messages,
                "temperature": temperature if temperature is not None else settings.AI_TEMPERATURE,
                "max_tokens": max_tokens or settings.AI_MAX_TOKENS,
                "stream": False,
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.AI_API_KEY}",
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.AI_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                logger.info("litellm_response_ok",
                            model=data.get("model", settings.AI_MODEL),
                            tokens=data.get("usage", {}).get("total_tokens", 0))
                return content
        except Exception as exc:
            logger.warning("litellm_chat_failed", error=str(exc))
            self._litellm_available = False
            return None

    async def _chat_litellm_stream(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
    ):
        """Async generator that yields token strings from the LiteLLM stream."""
        import httpx, json as _json
        payload = {
            "model": model or settings.AI_MODEL,
            "messages": messages,
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS,
            "stream": True,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.AI_API_KEY}",
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.AI_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    async for line in response.aiter_lines():
                        if not line or line == "data: [DONE]":
                            continue
                        if line.startswith("data: "):
                            try:
                                chunk = _json.loads(line[6:])
                                token = chunk["choices"][0].get("delta", {}).get("content", "")
                                if token:
                                    yield token
                            except Exception:
                                continue
        except Exception as exc:
            logger.warning("litellm_stream_failed", error=str(exc))

    async def _probe_ollama(self) -> bool:
        """Check whether Ollama is reachable (fallback)."""
        if self._ollama_available is not None:
            return self._ollama_available
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                self._ollama_available = resp.status_code == 200
        except Exception:
            self._ollama_available = False
        return self._ollama_available

    async def _chat_ollama(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.7,
    ) -> Optional[str]:
        """Send a chat completion request to Ollama (fallback). Returns None on failure."""
        try:
            import httpx
            payload = {
                "model": model or "llama3",
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                )
                resp.raise_for_status()
                return resp.json().get("message", {}).get("content")
        except Exception as exc:
            logger.warning("ollama_chat_failed", error=str(exc))
            self._ollama_available = False
            return None

    async def _call_ai(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[str]:
        """
        Unified AI call:  LiteLLM proxy  →  Ollama  →  None (template fallback).
        """
        # 1. LiteLLM proxy (primary)
        result = await self._chat_litellm(messages, temperature=temperature, max_tokens=max_tokens)
        if result:
            return result

        # 2. Ollama (fallback)
        if await self._probe_ollama():
            result = await self._chat_ollama(messages)
            if result:
                return result

        return None  # caller will use template fallback

    async def _generate_ollama(
        self,
        prompt: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.3,
    ) -> Optional[str]:
        """Single-turn generation — uses unified _call_ai."""
        return await self._call_ai(
            [{"role": "user", "content": prompt}],
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
            "You are ReleaseIQ, an expert AI assistant for Greeksoft's CTCL (Client Trading) "
            "release management, FIX protocol analysis, and Jira issue tracking.\n"
            "Key facts about this system:\n"
            "- JIRA project key is GETSCTCL (e.g. GETSCTCL-14597). Always use this prefix.\n"
            "- Products / releases are named: Optimus, 1209, 3009.\n"
            "- Exchanges supported: NSE, BSE, MCX, SEBI.\n"
            "- Components: CTCLClient (trading terminal), CTCLServer (OMS/RMS backend).\n"
            "- Config files: TradingStyle.txt (client flags), CTCLManager.ini (server flags).\n"
            "Be concise, structured, and use markdown formatting when helpful. "
            "Always answer based on the provided context data — never invent issue IDs or version numbers."
            + context_text
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        result = await self._call_ai(messages)
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
            "You are ReleaseIQ AI for Greeksoft CTCL. "
            "JIRA keys use the prefix GETSCTCL (e.g. GETSCTCL-14597). "
            "Releases: Optimus, 1209, 3009. Exchanges: NSE, BSE, MCX. "
            "Answer concisely using markdown. Never invent issue IDs or versions."
            + context_text
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        # 1. Try LiteLLM streaming
        streamed = False
        async for token in self._chat_litellm_stream(messages):
            streamed = True
            yield token
        if streamed:
            return

        # 2. Try Ollama streaming (fallback)
        if await self._probe_ollama():
            try:
                import httpx, json as _json
                payload = {"model": "llama3", "messages": messages, "stream": True}
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream(
                        "POST", f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                    ) as response:
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

        # 3. Final fallback: chunk template word by word
        fallback = _template_response(query)
        for word in fallback.split(" "):
            yield word + " "


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

ai_service = AIService()
