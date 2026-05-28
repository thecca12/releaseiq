"""
Exchange Circulars parser — reads PDF/xlsx files from:
  Datasource/Exchange_Circulars/NSE/  *.pdf, *.xlsx
  Datasource/Exchange_Circulars/BSE/  *.pdf
  Datasource/Exchange_Circulars/MCX/  *.pdf
  Datasource/Exchange_Circulars/SEBI/ *.pdf

Extracts for each circular:
  - exchange        (from folder name)
  - circular_no     (from PDF content or filename)
  - title/subject   (first meaningful text line from PDF)
  - date            (from PDF content or filename)
  - body            (first 2 pages of clean text)
  - file_size_kb    (for display)
"""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

DATE_PATTERNS = [
    re.compile(r'Date\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})', re.I),
    re.compile(r'Date\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', re.I),
    re.compile(r'(\d{1,2}\s+\w+\s+\d{4})'),
    re.compile(r'(\w+\s+\d{1,2},\s*\d{4})'),
]

CIRCULAR_NO_PATTERNS = [
    re.compile(r'(?:circular|ref\.?\s*no\.?|download ref no)\s*[:\-]?\s*([A-Z0-9/\-\.]+)', re.I),
    re.compile(r'([A-Z]{2,8}/[A-Z]{2,8}/[\d]+)'),
    re.compile(r'([A-Z]{3,8}\d{4,8})'),
]


class CircularsParser(BaseParser):
    def get_source_name(self) -> str:
        return "Exchange Circulars"

    def parse(self) -> List[Dict[str, Any]]:
        root = self.root / "Exchange_Circulars"
        if not root.exists():
            logger.warning("CircularsParser: Exchange_Circulars/ not found")
            return []

        circulars: List[Dict[str, Any]] = []
        for subfolder in sorted(root.iterdir()):
            if not subfolder.is_dir():
                continue
            exchange = subfolder.name.upper()
            for file in sorted(subfolder.iterdir()):
                if file.suffix.lower() == ".pdf":
                    c = self._parse_pdf(file, exchange)
                elif file.suffix.lower() == ".xlsx":
                    c = self._parse_xlsx(file, exchange)
                else:
                    continue
                if c:
                    circulars.append(c)

        logger.info(f"CircularsParser: parsed {len(circulars)} circulars")
        return circulars

    # ── PDF parser ────────────────────────────────────────────────────────────

    def _parse_pdf(self, path: Path, exchange: str) -> Optional[Dict[str, Any]]:
        try:
            import PyPDF2
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                num_pages = len(reader.pages)
                # Extract clean text from first 2 pages only
                raw_pages = []
                for i in range(min(2, num_pages)):
                    try:
                        page_text = reader.pages[i].extract_text() or ""
                        raw_pages.append(page_text)
                    except Exception:
                        pass
                full_text = "\n".join(raw_pages)
        except Exception as e:
            logger.debug(f"CircularsParser: cannot read {path.name}: {e}")
            # Fallback — create entry from filename only
            return self._from_filename(path, exchange)

        # Clean text — remove garbage characters, keep printable + whitespace
        clean_lines = []
        for line in full_text.split("\n"):
            clean = "".join(c for c in line if c.isprintable() or c == "\t").strip()
            # Skip very short or garbage lines
            if len(clean) > 3 and not clean.startswith("%PDF") and not clean.startswith("<<"):
                clean_lines.append(clean)

        clean_text = "\n".join(clean_lines)

        # Extract metadata
        circular_no = self._extract_circular_no(clean_text, path.stem)
        date_str    = self._extract_date(clean_text, path.stem)
        subject     = self._extract_subject(clean_lines, path.stem)
        body        = clean_text[:3000]

        return {
            "id":           path.stem[:50],
            "filename":     path.name,
            "filepath":     str(path),
            "exchange":     exchange,
            "circular_no":  circular_no,
            "date":         date_str,
            "subject":      subject,
            "body":         body,
            "num_pages":    num_pages,
            "file_size_kb": path.stat().st_size // 1024,
            "file_type":    "pdf",
        }

    # ── XLSX parser ───────────────────────────────────────────────────────────

    def _parse_xlsx(self, path: Path, exchange: str) -> Optional[Dict[str, Any]]:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(max_row=3, values_only=True))
            wb.close()
            headers = [str(v)[:60] for v in (rows[0] if rows else []) if v]
            subject = f"Annexure — {', '.join(headers[:4])}" if headers else path.stem
        except Exception:
            subject = path.stem

        return {
            "id":           path.stem[:50],
            "filename":     path.name,
            "filepath":     str(path),
            "exchange":     exchange,
            "circular_no":  path.stem,
            "date":         "",
            "subject":      subject,
            "body":         f"Excel document: {path.name}",
            "num_pages":    1,
            "file_size_kb": path.stat().st_size // 1024,
            "file_type":    "xlsx",
        }

    # ── Filename fallback ─────────────────────────────────────────────────────

    def _from_filename(self, path: Path, exchange: str) -> Dict[str, Any]:
        return {
            "id":           path.stem[:50],
            "filename":     path.name,
            "filepath":     str(path),
            "exchange":     exchange,
            "circular_no":  self._extract_circular_no("", path.stem),
            "date":         self._extract_date("", path.stem),
            "subject":      path.stem.replace("_", " ").replace("-", " ")[:100],
            "body":         f"PDF document — {path.name}",
            "num_pages":    0,
            "file_size_kb": path.stat().st_size // 1024,
            "file_type":    "pdf",
        }

    # ── Extraction helpers ────────────────────────────────────────────────────

    def _extract_subject(self, lines: List[str], fallback: str) -> str:
        """Find the most meaningful subject line from clean PDF lines."""
        for i, line in enumerate(lines[:30]):
            l = line.strip()
            # Look for "Sub:" or "Subject:" pattern
            if re.match(r'sub\s*[:\-]', l, re.I):
                sub = re.sub(r'^sub\s*[:\-]\s*', '', l, flags=re.I).strip()
                if len(sub) > 8:
                    # May continue on next line
                    if i + 1 < len(lines) and not re.match(r'(we|dear|ref|date|circular)', lines[i+1], re.I):
                        sub = (sub + " " + lines[i+1].strip())[:200]
                    return sub[:200]
            # Fallback: first long meaningful line
        for line in lines[:20]:
            if len(line) > 20 and not any(skip in line.lower() for skip in
                ['download', 'department', 'all members', 'dear sir', 'circular ref', 'we draw', 'date :', 'ref. no']):
                return line[:200]
        return fallback.replace("_", " ")[:100]

    def _extract_circular_no(self, text: str, stem: str) -> str:
        for pat in CIRCULAR_NO_PATTERNS:
            m = pat.search(text[:1000])
            if m:
                val = m.group(1).strip().rstrip(".")
                if 3 < len(val) < 40:
                    return val
        # Fallback: use filename stem
        clean_stem = re.sub(r'[_\-]+', '/', stem).upper()[:30]
        return clean_stem

    def _extract_date(self, text: str, stem: str) -> str:
        for pat in DATE_PATTERNS:
            m = pat.search(text[:2000])
            if m:
                raw = m.group(1).strip()
                if len(raw) > 5:
                    return raw[:30]
        # Try to extract date from filename
        m = re.search(r'(\d{8})', stem)
        if m:
            d = m.group(1)
            try:
                from datetime import datetime
                dt = datetime.strptime(d, "%Y%m%d")
                return dt.strftime("%d %b %Y")
            except Exception:
                pass
        m2 = re.search(r'(\d{4})(\d{2})(\d{2})', stem)
        if m2:
            return f"{m2.group(3)} / {m2.group(2)} / {m2.group(1)}"
        return ""
