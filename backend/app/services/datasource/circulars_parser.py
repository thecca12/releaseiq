"""
Exchange Circulars parser — reads PDFs and xlsx from:
Datasource/Exchange_Circulars/NSE/, BSE/, MCX/, SEBI/ subfolders
"""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class CircularsParser(BaseParser):
    def get_source_name(self) -> str:
        return "Exchange Circulars"

    def parse(self) -> List[Dict[str, Any]]:
        circulars_root = self.root / "Exchange_Circulars"
        if not circulars_root.exists():
            logger.warning("CircularsParser: Exchange_Circulars/ not found")
            return []

        circulars = []
        # Each subfolder is an exchange name
        for item in circulars_root.iterdir():
            if item.is_dir():
                exchange = item.name.upper()
                for f in item.iterdir():
                    if f.suffix.lower() in (".pdf", ".xlsx", ".txt", ".docx"):
                        c = self._parse_file(f, exchange)
                        if c:
                            circulars.append(c)
            elif item.suffix.lower() in (".pdf", ".txt"):
                exchange = self._guess_exchange_from_filename(item.name)
                c = self._parse_file(item, exchange)
                if c:
                    circulars.append(c)

        logger.info(f"CircularsParser: parsed {len(circulars)} circulars")
        return circulars

    def _parse_file(self, path: Path, exchange: str) -> Dict[str, Any]:
        circular_no = self._extract_circular_no(path.stem)
        date = self._extract_date(path.stem)
        body = ""

        if path.suffix.lower() == ".pdf":
            body = self._read_pdf(path)
        elif path.suffix.lower() == ".txt":
            body = self._safe_read(path)[:2000]
        elif path.suffix.lower() == ".xlsx":
            body = self._read_xlsx_text(path)

        subject = self._extract_subject(body, path.stem)

        return {
            "id": path.stem[:50],
            "filename": path.name,
            "exchange": exchange,
            "circular_no": circular_no,
            "date": date,
            "subject": subject,
            "body": body[:3000],
            "full_content": body[:5000],
        }

    def _read_pdf(self, path: Path) -> str:
        try:
            import PyPDF2
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages[:3]:
                    text += page.extract_text() or ""
            return text[:3000]
        except Exception:
            try:
                # Fallback: try to read as text
                return self._safe_read(path)[:1000]
            except Exception:
                return f"[PDF: {path.name}]"

    def _read_xlsx_text(self, path: Path) -> str:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            texts = []
            for row in ws.iter_rows(max_row=20, values_only=True):
                texts.extend(str(v) for v in row if v)
            wb.close()
            return " | ".join(texts[:50])
        except Exception:
            return ""

    def _extract_circular_no(self, stem: str) -> str:
        # Try to extract a circular number pattern like NSE/COMP/42823 or CMPT69533
        m = re.search(r'[A-Z]{2,}/[A-Z]{2,}/[\d]+', stem.upper())
        if m:
            return m.group(0)
        m = re.search(r'[A-Z]{3,}\d{4,}', stem.upper())
        if m:
            return m.group(0)
        return stem[:30]

    def _extract_date(self, stem: str) -> str:
        m = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})', stem)
        if m:
            return m.group(1)
        m = re.search(r'(\d{8})', stem)
        if m:
            d = m.group(1)
            return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
        return ""

    def _extract_subject(self, body: str, fallback: str) -> str:
        if body:
            first_line = body.strip().split("\n")[0].strip()
            if 10 < len(first_line) < 200:
                return first_line
        return fallback.replace("_", " ").replace("-", " ")[:100]

    def _guess_exchange_from_filename(self, name: str) -> str:
        n = name.upper()
        if "NSE" in n: return "NSE"
        if "BSE" in n: return "BSE"
        if "MCX" in n: return "MCX"
        if "SEBI" in n: return "SEBI"
        return "EXCHANGE"
