"""
Product Knowledge parser — reads PDFs, DOCX, and MD files from:
  Datasource/Product_knowledge/           (manuals, user guides, FAQs)
  Datasource/Exchange_ErrorCodes/*.pdf    (ETI API manual, NNF protocol)

Each file is returned as a searchable document record with title, category,
content summary, and a full_text field used for RAG / keyword search.
"""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

# Map filename keywords → human-readable category
_CATEGORY_HINTS: list[tuple[str, str]] = [
    ("user manual", "User Manual"),
    ("installation", "Installation Guide"),
    ("admin", "Admin Manual"),
    ("faq", "FAQ"),
    ("company profile", "Company Profile"),
    ("colocation", "Infrastructure"),
    ("hardware", "Infrastructure"),
    ("network", "Infrastructure"),
    ("domain", "Domain Knowledge"),
    ("beginner", "Domain Knowledge"),
    ("market", "Domain Knowledge"),
    ("test case", "Test Cases"),
    ("checklist", "Test Cases"),
    ("arbitrage", "Arbitrage"),
    ("gats", "GATS"),
    ("ctcl", "CTCL"),
    ("gmx", "GMX"),
    ("gets", "GETS"),
    ("eti", "ETI Protocol"),
    ("nnf", "NNF Protocol"),
    ("fix api", "FIX Protocol"),
    ("mcx", "MCX"),
    ("nse", "NSE"),
    ("bse", "BSE"),
    ("sebi", "SEBI"),
    ("mysql", "Database"),
    ("linux", "Linux/OS"),
    ("c++", "Development"),
    ("coding", "Development"),
    ("pointer", "Development"),
    ("visual c", "Development"),
]

# Folders to scan (relative to product_knowledge root)
_SCAN_SUBFOLDERS = [
    ".",
    "New folder",
    "Arbitrage",
    "Reviewed Module wise test cases",
    "For Developer",
    "domain",
    "desktop",
]

# Supported file extensions
_SUPPORTED_EXTS = {".pdf", ".docx", ".doc", ".md", ".txt"}

# Max chars of body to store in the structured record
_BODY_LIMIT = 4000


class ProductKnowledgeParser(BaseParser):
    """Parses Product_knowledge PDFs/docs and Exchange_ErrorCodes PDFs into
    searchable knowledge records."""

    def get_source_name(self) -> str:
        return "Product Knowledge"

    def parse(self) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []

        # 1. Product_knowledge tree
        pk_root = self.root / "Product_knowledge"
        if pk_root.exists():
            for subfolder in _SCAN_SUBFOLDERS:
                folder = pk_root / subfolder if subfolder != "." else pk_root
                if not folder.exists():
                    continue
                for fpath in sorted(folder.iterdir()):
                    if not fpath.is_file():
                        continue
                    if fpath.suffix.lower() not in _SUPPORTED_EXTS:
                        continue
                    # Skip very large files (> 50 MB)
                    try:
                        if fpath.stat().st_size > 50 * 1024 * 1024:
                            continue
                    except OSError:
                        continue
                    rec = self._parse_file(fpath)
                    if rec:
                        records.append(rec)

        # 2. Exchange_ErrorCodes PDFs (ETI API, NNF protocol)
        ec_root = self.root / "Exchange_ErrorCodes"
        if ec_root.exists():
            for fpath in sorted(ec_root.iterdir()):
                if fpath.is_file() and fpath.suffix.lower() in (".pdf", ".md"):
                    rec = self._parse_file(fpath)
                    if rec:
                        records.append(rec)

        logger.info(f"ProductKnowledgeParser: parsed {len(records)} documents")
        return records

    # ── File dispatcher ───────────────────────────────────────────────────────

    def _parse_file(self, path: Path) -> Optional[Dict[str, Any]]:
        """
        Register a document record from its filename/metadata only.
        PDF/DOCX content is NOT read here — it is indexed by indexing_service
        into ChromaDB for RAG. This keeps startup fast.
        Only .md and .txt files are read inline (they're small).
        """
        ext = path.suffix.lower()
        body = ""

        if ext in (".md", ".txt"):
            try:
                body = self._safe_read(path)[:_BODY_LIMIT]
            except Exception:
                pass

        # Use filename-derived title and category (no PDF reading needed)
        title = self._extract_title(body, path.stem) if body else self._stem_to_title(path.stem)
        category = self._guess_category(path.name, path.stem, body)

        return {
            "id": path.stem[:80].replace(" ", "_"),
            "filename": path.name,
            "filepath": str(path),
            "title": title,
            "category": category,
            "body": body[:_BODY_LIMIT],
            "full_text": body[:_BODY_LIMIT],
            "summary": body[:300].replace("\n", " ").strip() if body else f"{category}: {title}",
            "source": str(path.relative_to(self.root)) if self.root in path.parents else path.name,
            "file_type": ext.lstrip(".").upper(),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _stem_to_title(self, stem: str) -> str:
        """Convert a filename stem to a readable title."""
        # Strip leading numbers like "1_", "10", "01_"
        import re as _re
        clean = _re.sub(r"^\d+[_\-\s]*", "", stem)
        return clean.replace("_", " ").replace("-", " ").strip() or stem

    def _extract_title(self, body: str, fallback: str) -> str:
        """Use the first clean, readable line as title."""
        for line in body.splitlines():
            line = line.strip().lstrip("#").strip()
            if len(line) < 10 or len(line) > 150:
                continue
            if line.startswith("|") or line.startswith(">"):
                continue
            # Reject lines with too many non-printable / non-ASCII characters
            printable = sum(1 for c in line if c.isprintable() and (c.isascii() or c.isalpha()))
            if printable < len(line) * 0.7:
                continue
            return line
        # Use filename as fallback (clean it up)
        return fallback.replace("_", " ").replace("-", " ").strip()

    def _guess_category(self, filename: str, stem: str, body: str) -> str:
        text = (filename + " " + stem + " " + body[:200]).lower()
        for keyword, category in _CATEGORY_HINTS:
            if keyword in text:
                return category
        return "General"
