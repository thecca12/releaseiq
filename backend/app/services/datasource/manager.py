"""
Central DataSourceManager — singleton that loads and caches all parsed datasource data.
"""

import logging
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Path: backend/app/services/datasource/manager.py → go up 4 levels → backend/Datasource
DATASOURCE_ROOT = Path("/home/force/Desktop/releaseiq/Datasource")


class DataSourceManager:
    """
    Central manager for all datasource parsers.
    Maintains in-memory cache of parsed data.
    Thread-safe singleton pattern.
    """

    _instance: Optional["DataSourceManager"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls) -> "DataSourceManager":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self.root = DATASOURCE_ROOT
        self._cache: Dict[str, Any] = {}
        self._last_refresh: Optional[datetime] = None
        self._load_all()

    def _load_all(self) -> None:
        """Load all datasource data into the in-memory cache."""
        logger.info(f"DataSourceManager: loading from {self.root}")
        if not self.root.exists():
            logger.error(f"DataSourceManager: Datasource root not found: {self.root}")
            return

        try:
            from app.services.datasource.release_parser import ReleaseParser
            from app.services.datasource.jira_parser import JiraParser
            from app.services.datasource.log_parser import LogParser
            from app.services.datasource.patch_notes_parser import PatchNotesParser
            from app.services.datasource.error_codes_parser import ErrorCodesParser
            from app.services.datasource.flags_parser import FlagsParser
            from app.services.datasource.greek_codes_parser import GreekCodesParser
            from app.services.datasource.client_release_parser import ClientReleaseParser
            from app.services.datasource.circulars_parser import CircularsParser
            from app.services.datasource.test_cases_parser import TestCasesParser
            from app.services.datasource.utilities_parser import UtilitiesParser
            from app.services.datasource.product_knowledge_parser import ProductKnowledgeParser

            self._cache["releases"] = ReleaseParser(self.root).parse()
            self._cache["jira_issues"] = JiraParser(self.root).parse()
            self._cache["logs"] = LogParser(self.root).parse()
            self._cache["patch_notes"] = PatchNotesParser(self.root).parse()
            self._cache["error_codes"] = ErrorCodesParser(self.root).parse()
            self._cache["flags"] = FlagsParser(self.root).parse()
            self._cache["greek_codes"] = GreekCodesParser(self.root).parse()
            self._cache["client_releases"] = ClientReleaseParser(self.root).parse()
            self._cache["circulars"] = CircularsParser(self.root).parse()
            self._cache["test_cases"] = TestCasesParser(self.root).parse()
            self._cache["utilities"] = UtilitiesParser(self.root).parse()
            self._cache["product_knowledge"] = ProductKnowledgeParser(self.root).parse()
            self._last_refresh = datetime.utcnow()

            stats = self.get_stats()
            logger.info(f"DataSourceManager: loaded successfully. Stats: {stats}")
        except Exception as e:
            logger.error(f"DataSourceManager: load error: {e}", exc_info=True)

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    def refresh(self) -> None:
        """Reload all data from disk."""
        logger.info("DataSourceManager: refreshing cache")
        self._load_all()

    def get_stats(self) -> Dict[str, int]:
        """Return item counts per data source."""
        return {k: len(v) if isinstance(v, list) else 0 for k, v in self._cache.items()}

    @property
    def last_refresh(self) -> Optional[str]:
        return self._last_refresh.isoformat() if self._last_refresh else None

    # ------------------------------------------------------------------
    # Accessor methods
    # ------------------------------------------------------------------

    def get_releases(self, env: str = None, status: str = None, version: str = None, health: str = None) -> List[Dict]:
        items = list(self._cache.get("releases", []))
        if env:
            items = [r for r in items if r.get("environment", "").upper() == env.upper()]
        if status:
            items = [r for r in items if r.get("status", "").lower() == status.lower()]
        if version:
            items = [r for r in items if version.lower() in r.get("version", "").lower()]
        if health:
            items = [r for r in items if r.get("health", "").lower() == health.lower()]
        return items

    def get_jira_issues(
        self,
        status: str = None,
        priority: str = None,
        module: str = None,
        assignee: str = None,
        search: str = None,
    ) -> List[Dict]:
        items = list(self._cache.get("jira_issues", []))
        if status:
            items = [i for i in items if i.get("status", "").lower() == status.lower()]
        if priority:
            items = [i for i in items if i.get("priority", "").lower() == priority.lower()]
        if module:
            items = [i for i in items if module.lower() in i.get("module", "").lower()]
        if assignee:
            items = [i for i in items if assignee.lower() in i.get("assignee", "").lower()]
        if search:
            s = search.lower()
            items = [i for i in items if s in i.get("search_text", "").lower()]
        return items

    def get_jira_issue_by_id(self, issue_id: str) -> Optional[Dict]:
        for issue in self._cache.get("jira_issues", []):
            if issue.get("jira_id", "").upper() == issue_id.upper():
                return issue
        return None

    def get_logs(self, module: str = None) -> List[Dict]:
        items = list(self._cache.get("logs", []))
        if module:
            items = [l for l in items if module.lower() in l.get("module", "").lower()]
        return items

    def get_patch_notes(self, version: str = None, env: str = None) -> List[Dict]:
        items = list(self._cache.get("patch_notes", []))
        if version:
            items = [p for p in items if version.lower() in p.get("version", "").lower()]
        if env:
            items = [p for p in items if env.lower() in [e.lower() for e in p.get("environments", [])]]
        return items

    def get_patch_note_by_version(self, version: str) -> Optional[Dict]:
        for pn in self._cache.get("patch_notes", []):
            if pn.get("version", "").lower() == version.lower():
                return pn
        return None

    def get_error_codes(self, module: str = None, severity: str = None) -> List[Dict]:
        items = list(self._cache.get("error_codes", []))
        if module:
            items = [e for e in items if module.lower() in e.get("module", "").lower()]
        if severity:
            items = [e for e in items if e.get("severity", "").lower() == severity.lower()]
        return items

    def get_flags(self, flag_type: str = None, section: str = None) -> List[Dict]:
        items = list(self._cache.get("flags", []))
        if flag_type:
            items = [f for f in items if flag_type.lower() in f.get("type", "").lower()]
        if section:
            items = [f for f in items if section.lower() in f.get("section", "").lower()]
        return items

    def get_greek_codes(self, exchange: str = None, product_type: str = None) -> List[Dict]:
        items = list(self._cache.get("greek_codes", []))
        if exchange:
            items = [g for g in items if exchange.upper() in g.get("exchange", "").upper()]
        if product_type:
            items = [g for g in items if product_type.lower() in g.get("product_type", "").lower()]
        return items

    def get_client_releases(self, health: str = None, env: str = None, version: str = None) -> List[Dict]:
        items = list(self._cache.get("client_releases", []))
        if health:
            items = [c for c in items if c.get("health_status", "").lower() == health.lower()]
        if env:
            items = [c for c in items if env.lower() in c.get("environment", "").lower()]
        if version:
            items = [c for c in items if version.lower() in c.get("current_version", "").lower()]
        return items

    def get_client_by_id(self, client_id: str) -> Optional[Dict]:
        for client in self._cache.get("client_releases", []):
            if client.get("client_id", "").upper() == client_id.upper():
                return client
        return None

    def get_circulars(self, exchange: str = None, search: str = None) -> List[Dict]:
        items = list(self._cache.get("circulars", []))
        if exchange:
            items = [c for c in items if exchange.upper() in c.get("exchange", "").upper()]
        if search:
            s = search.lower()
            items = [
                c for c in items
                if s in c.get("subject", "").lower()
                or s in c.get("body", "").lower()
                or s in c.get("circular_no", "").lower()
            ]
        return items

    def get_test_cases(self, module: str = None, status: str = None, test_type: str = None, priority: str = None) -> List[Dict]:
        items = list(self._cache.get("test_cases", []))
        if module:
            items = [t for t in items if module.lower() in t.get("module", "").lower()]
        if status:
            items = [t for t in items if t.get("status", "").lower() == status.lower()]
        if test_type:
            items = [t for t in items if test_type.lower() in t.get("type", "").lower()]
        if priority:
            items = [t for t in items if t.get("priority", "").lower() == priority.lower()]
        return items

    def get_utilities(self) -> List[Dict]:
        return list(self._cache.get("utilities", []))

    def get_utility_by_filename(self, filename: str) -> Optional[Dict]:
        for util in self._cache.get("utilities", []):
            if util.get("filename", "").lower() == filename.lower():
                return util
        return None

    def get_product_knowledge(self, category: str = None, search: str = None) -> List[Dict]:
        items = list(self._cache.get("product_knowledge", []))
        if category:
            items = [d for d in items if category.lower() in d.get("category", "").lower()]
        if search:
            s = search.lower()
            items = [
                d for d in items
                if s in d.get("title", "").lower()
                or s in d.get("body", "").lower()
                or s in d.get("filename", "").lower()
            ]
        return items

    def get_product_doc_by_filename(self, filename: str) -> Optional[Dict]:
        for doc in self._cache.get("product_knowledge", []):
            if doc.get("filename", "").lower() == filename.lower():
                return doc
        return None


    # ------------------------------------------------------------------
    # Cross-datasource search
    # ------------------------------------------------------------------

    def _matches(self, text: str, query_lower: str) -> bool:
        """Return True if ANY word from query appears in text (word-level OR search)."""
        text_lower = text.lower()
        # Exact phrase match gets priority (handled by caller ranking)
        if query_lower in text_lower:
            return True
        # Word-level match: at least one meaningful word (>2 chars) must match
        words = [w for w in query_lower.split() if len(w) > 2]
        return bool(words) and any(w in text_lower for w in words)

    def search_all(self, query: str) -> List[Dict]:
        """Search across all datasources. Returns up to 50 results sorted by relevance."""
        if not query:
            return []
        query_lower = query.lower()
        results: List[Dict] = []

        # Jira issues
        for item in self._cache.get("jira_issues", []):
            text = item.get("search_text", "")
            if self._matches(text, query_lower):
                results.append({
                    "type": "jira",
                    "relevance": 0.9,
                    "id": item.get("jira_id"),
                    "title": item.get("title"),
                    "snippet": item.get("description", "")[:200],
                    "source": f"Jira Issues / {item.get('jira_id')}",
                    **item,
                })

        # Releases
        for item in self._cache.get("releases", []):
            text = f"{item.get('version','')} {item.get('notes','')} {','.join(item.get('modules',[]))}".lower()
            if self._matches(text, query_lower):
                results.append({
                    "type": "release",
                    "relevance": 0.8,
                    "id": item.get("version"),
                    "title": f"Release {item.get('version')} - {item.get('status')}",
                    "snippet": item.get("notes", "")[:200],
                    "source": "Release Details",
                    **item,
                })

        # Patch notes
        for item in self._cache.get("patch_notes", []):
            text = f"{item.get('version','')} {item.get('qa_notes','')} {item.get('live_notes','')}".lower()
            if self._matches(text, query_lower):
                results.append({
                    "type": "patch_note",
                    "relevance": 0.85,
                    "id": item.get("version"),
                    "title": f"Patch Notes {item.get('version')}",
                    "snippet": (item.get("live_notes") or item.get("qa_notes") or "")[:200],
                    "source": f"Patch Notes / {item.get('filename')}",
                    **item,
                })

        # Error codes
        for item in self._cache.get("error_codes", []):
            text = f"{item.get('code','')} {item.get('description','')} {item.get('module','')} {item.get('root_cause','')}".lower()
            if self._matches(text, query_lower):
                results.append({
                    "type": "error_code",
                    "relevance": 0.75,
                    "id": item.get("code"),
                    "title": f"{item.get('code')}: {item.get('description')}",
                    "snippet": item.get("resolution", "")[:200],
                    "source": "Error Codes",
                    **item,
                })

        # Exchange circulars
        for item in self._cache.get("circulars", []):
            text = f"{item.get('subject','')} {item.get('body','')} {item.get('circular_no','')}".lower()
            if self._matches(text, query_lower):
                results.append({
                    "type": "circular",
                    "relevance": 0.70,
                    "id": item.get("id"),
                    "title": item.get("subject", item.get("filename")),
                    "snippet": item.get("body", "")[:200],
                    "source": f"Circulars / {item.get('exchange')}",
                    **item,
                })

        # Flags
        for item in self._cache.get("flags", []):
            text = f"{item.get('name','')} {item.get('description','')} {item.get('value','')}".lower()
            if self._matches(text, query_lower):
                results.append({
                    "type": "flag",
                    "relevance": 0.65,
                    "id": item.get("name"),
                    "title": f"Flag: {item.get('name')} = {item.get('value')}",
                    "snippet": item.get("description", "")[:200],
                    "source": f"Flags / {item.get('source_file')}",
                    **item,
                })

        # Logs (scan first 20 entries per file to keep search fast)
        for logfile in self._cache.get("logs", []):
            for entry in logfile.get("entries", [])[:20]:
                msg = str(entry.get("message", ""))
                if self._matches(msg, query_lower):
                    results.append({
                        "type": "log",
                        "relevance": 0.6,
                        "id": f"{logfile.get('filename')}-{entry.get('timestamp','')}",
                        "title": f"[{entry.get('level')}] {msg[:80]}",
                        "snippet": msg[:200],
                        "source": f"Logs / {logfile.get('filename')}",
                        "filename": logfile.get("filename"),
                        **entry,
                    })
                    break  # Only one match per log file in global search

        # Product knowledge documents
        for item in self._cache.get("product_knowledge", []):
            text = f"{item.get('title','')} {item.get('category','')} {item.get('body','')[:500]}".lower()
            if self._matches(text, query_lower):
                results.append({
                    "type": "product_knowledge",
                    "relevance": 0.72,
                    "id": item.get("id"),
                    "title": item.get("title", item.get("filename")),
                    "snippet": item.get("summary", "")[:200],
                    "source": f"Product Knowledge / {item.get('category')}",
                    **item,
                })

        # Sort by relevance descending
        results.sort(key=lambda x: x.get("relevance", 0), reverse=True)
        return results[:50]

    # ------------------------------------------------------------------
    # AI context builder
    # ------------------------------------------------------------------

    def build_ai_context(self, query: str) -> str:
        """
        Build a context string for the AI from relevant datasource data.
        Used by the chat endpoint to augment prompts with real data.
        """
        query_lower = query.lower()
        context_parts: List[str] = []

        # Check for JIRA ID mentions (format: GETSCTCL-XXXXX)
        jira_ids = re.findall(r"GETSCTCL-\d+", query.upper())
        for jid in jira_ids:
            issue = self.get_jira_issue_by_id(jid)
            if issue:
                context_parts.append(
                    f"JIRA Issue {jid}:\n"
                    f"  Title: {issue.get('title')}\n"
                    f"  Status: {issue.get('status')}\n"
                    f"  Priority: {issue.get('priority')}\n"
                    f"  Module: {issue.get('module')}\n"
                    f"  Assignee: {issue.get('assignee')}\n"
                    f"  Fix Version: {issue.get('fix_version')}\n"
                    f"  Description: {str(issue.get('description', ''))[:300]}\n"
                )

        # Check for version/release name mentions (Optimus, 1209, 3009, v9.47 etc.)
        version_refs = re.findall(r"v\d+\.\d+(?:[.-]\w+)?|\b(?:optimus|1209|3009)\b", query_lower)
        for vref in version_refs:
            # Check releases
            for rel in self.get_releases(version=vref):
                context_parts.append(
                    f"Release {rel.get('version')}:\n"
                    f"  Status: {rel.get('status')}, Env: {rel.get('environment')}\n"
                    f"  Health: {rel.get('health')}, Open Issues: {rel.get('open_issues')}\n"
                    f"  Modules: {', '.join(rel.get('modules', []))}\n"
                    f"  Notes: {rel.get('notes', '')[:300]}\n"
                )
            # Check patch notes
            pn = self.get_patch_note_by_version(vref)
            if pn:
                context_parts.append(
                    f"Patch Notes {pn.get('version')}:\n"
                    f"  JIRA Refs: {', '.join(pn.get('jira_refs', []))}\n"
                    f"  Live Notes (excerpt): {pn.get('live_notes', '')[:300]}\n"
                )

        # General release context when "release" / "version" / "deploy" keywords present
        if not version_refs and any(kw in query_lower for kw in ["release", "version", "deploy", "latest"]):
            relevant = self.get_releases()[:3]
            if relevant:
                context_parts.append(
                    "Recent Releases:\n"
                    + "\n".join(
                        f"  {r.get('version')} - {r.get('status')} ({r.get('environment')}) "
                        f"Health: {r.get('health')} OpenIssues: {r.get('open_issues')}"
                        for r in relevant
                    )
                )

        # Patch notes context
        if any(kw in query_lower for kw in ["patch", "patch note", "patchnote", "patch notes"]):
            if not version_refs:
                recent_patches = self.get_patch_notes()[:5]
            else:
                recent_patches = []
                for vref in version_refs:
                    pn = self.get_patch_note_by_version(vref)
                    if pn:
                        recent_patches.append(pn)
            if recent_patches:
                context_parts.append(
                    "Recent Patch Notes:\n"
                    + "\n".join(
                        f"  {p.get('version')} ({p.get('environment')}) {p.get('release_date','')}: "
                        f"{p.get('jira_count',0)} JIRAs — {p.get('summary','')[:200]}"
                        for p in recent_patches
                    )
                )

        # Error codes context — numeric codes (3-6 digits), define names ERR_*, and keyword matches
        if any(kw in query_lower for kw in ["error", "rejection", "fail", "crash", "exception", "reject", "err_", "error_"]):
            all_ec = self.get_error_codes()
            found_ec: List[Dict] = []

            # Match short alphanumeric codes (RMS001, FIX-001)
            for ecref in re.findall(r"[A-Z]{2,6}[- ]?\d{3,4}", query.upper()):
                normalized = ecref.replace(" ", "").replace("-", "")
                found_ec += [e for e in all_ec if e.get("code", "").replace("-", "").upper() == normalized]

            # Match 4-6 digit numeric codes (16000, 16283, etc.)
            for num in re.findall(r"\b(\d{4,6})\b", query):
                found_ec += [e for e in all_ec if str(e.get("code", "")).strip() == num]

            # Match define names ERR_* / ERROR_*
            for dname in re.findall(r"\b(ERR_\w+|ERROR_\w+)\b", query.upper()):
                found_ec += [e for e in all_ec if e.get("code", "").upper() == dname]

            # Deduplicate
            seen_codes: set = set()
            unique_ec = []
            for e in found_ec:
                k = str(e.get("code", ""))
                if k not in seen_codes:
                    seen_codes.add(k)
                    unique_ec.append(e)

            if unique_ec:
                context_parts.append(
                    "Error Code Information:\n"
                    + "\n".join(
                        f"  {e.get('code')} [{e.get('severity')}]: {e.get('description')} — {e.get('resolution', '')}"
                        for e in unique_ec[:5]
                    )
                )
            else:
                # Fuzzy keyword match
                query_words = [w for w in query_lower.split() if len(w) > 3]
                fuzzy_ec = [
                    e for e in all_ec
                    if any(w in e.get("description", "").lower() or w in e.get("code", "").lower()
                           for w in query_words)
                ][:3]
                if fuzzy_ec:
                    context_parts.append(
                        "Related Error Codes:\n"
                        + "\n".join(
                            f"  {e.get('code')}: {e.get('description')} — {e.get('resolution', '')}"
                            for e in fuzzy_ec
                        )
                    )

        # Log context for crash/error/log queries
        if any(kw in query_lower for kw in ["log", "crash", "error", "exception", "order rejected", "fix tag"]):
            for logfile in self.get_logs():
                for entry in logfile.get("entries", []):
                    if entry.get("level") in ("ERROR", "FATAL", "CRITICAL"):
                        msg = str(entry.get("message", ""))
                        if any(kw in msg.lower() for kw in query_lower.split() if len(kw) > 3):
                            context_parts.append(
                                f"Log entry from {logfile.get('filename')}:\n"
                                f"  [{entry.get('level')}] {msg[:200]}\n"
                            )
                            break

        # Client context
        if any(kw in query_lower for kw in ["client", "broker", "deployment", "upgrade"]):
            clients = self.get_client_releases()[:5]
            if clients:
                context_parts.append(
                    "Client Deployment Status:\n"
                    + "\n".join(
                        f"  {c.get('client_name')} ({c.get('client_id')}): "
                        f"v{c.get('current_version')} - {c.get('health_status')}"
                        for c in clients
                    )
                )

        # Exchange circulars context
        if any(kw in query_lower for kw in ["circular", "nse", "bse", "mcx", "sebi", "exchange notification", "nnf", "eti", "fix api"]):
            query_words_c = [w for w in query_lower.split() if len(w) > 2]
            matched_circulars = [
                c for c in self.get_circulars()
                if any(w in c.get("subject", "").lower() or w in c.get("body", "").lower()
                       or w in c.get("exchange", "").lower()
                       for w in query_words_c)
            ][:3]
            if matched_circulars:
                context_parts.append(
                    "Exchange Circulars:\n"
                    + "\n".join(
                        f"  [{c.get('exchange')}] {c.get('subject', c.get('filename',''))[:80]}"
                        f" | Date: {c.get('date','N/A')} | {c.get('body','')[:300]}"
                        for c in matched_circulars
                    )
                )

        # Flag context — specific flag lookup by name keywords
        if any(kw in query_lower for kw in ["flag", "kill switch", "algo", "maintenance", "trading mode",
                                              "amo", "ioc", "gtd", "mis", "basket", "tradingstyle", "ini"]):
            query_words_f = [w for w in query_lower.replace("_", " ").split() if len(w) > 3]
            # Look for specific flag names matching query words
            matched_flags = [
                flag for flag in self.get_flags()
                if any(kw in flag.get("name", "").lower() or kw in flag.get("description", "").lower()
                       for kw in query_words_f)
            ][:5]
            if matched_flags:
                context_parts.append(
                    "Matching Flags:\n"
                    + "\n".join(
                        f"  {flag.get('name')} = {flag.get('value')} | {flag.get('description','')[:150]}"
                        for flag in matched_flags
                    )
                )

        # Product knowledge context — manuals, protocols, FAQs
        doc_keywords = [
            "manual", "guide", "how to", "install", "setup", "configure",
            "admin", "faq", "eti", "nnf", "fix api", "protocol",
            "ctcl", "gmx", "gats", "gets", "greeksoft", "colocation",
            "market watch", "order entry", "net position", "surveillance",
        ]
        if any(kw in query_lower for kw in doc_keywords):
            # Use individual words for matching (word-level OR search)
            query_words = [w for w in query_lower.split() if len(w) > 3]
            all_docs = self.get_product_knowledge()
            matched_docs = [
                d for d in all_docs
                if any(
                    w in d.get("title", "").lower()
                    or w in d.get("filename", "").lower()
                    or w in d.get("body", "").lower()
                    for w in query_words
                )
            ][:3]
            if matched_docs:
                context_parts.append(
                    "Relevant Documentation:\n"
                    + "\n".join(
                        f"  [{d.get('category')}] {d.get('title')[:80]}: {d.get('summary','')[:200]}"
                        for d in matched_docs
                    )
                )

        return "\n\n".join(context_parts) if context_parts else ""

    # ------------------------------------------------------------------
    # Dashboard stats helper
    # ------------------------------------------------------------------

    def count_datasource_files(self) -> Dict[str, int]:
        """Count files per Datasource subfolder for analytics."""
        counts: Dict[str, int] = {}
        if not self.root.exists():
            return counts
        for subfolder in self.root.iterdir():
            if subfolder.is_dir():
                file_count = sum(1 for f in subfolder.rglob("*") if f.is_file())
                counts[subfolder.name] = file_count
            elif subfolder.is_file():
                counts["root"] = counts.get("root", 0) + 1
        return counts


# ---------------------------------------------------------------------------
# Module-level singleton accessor
# ---------------------------------------------------------------------------

_manager_instance: Optional[DataSourceManager] = None


def get_datasource_manager() -> DataSourceManager:
    """Get or create the singleton DataSourceManager."""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = DataSourceManager()
    return _manager_instance
