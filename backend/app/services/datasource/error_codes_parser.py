"""
Error Codes parser — reads Exchange_ErrorCodes/error_codes_exch.xlsx
The xlsx has no header row. Columns: error_code, description (2 columns only).
Also reads any .txt files in the Exchange_ErrorCodes/ folder.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class ErrorCodesParser(BaseParser):
    def get_source_name(self) -> str:
        return "Error Codes"

    def parse(self) -> List[Dict[str, Any]]:
        codes = []
        folder = self.root / "Exchange_ErrorCodes"
        if not folder.exists():
            folder = self.root / "Exchange_Errorcodes"
        if not folder.exists():
            logger.warning("ErrorCodesParser: Exchange_ErrorCodes/ not found")
            return []

        # Parse xlsx files
        for xlsx_file in folder.glob("*.xlsx"):
            codes.extend(self._parse_xlsx(xlsx_file))

        # Parse .csv files
        for csv_file in folder.glob("*.csv"):
            codes.extend(self._parse_csv(csv_file))

        # Parse .md files (MessageBox_Reference.md etc.)
        for md_file in folder.glob("*.md"):
            codes.extend(self._parse_md(md_file))

        # Parse PDFs (ETI API manual, NNF protocol)
        for pdf_file in folder.glob("*.pdf"):
            codes.extend(self._parse_pdf_errors(pdf_file))

        # Also parse MessageBox_Reference.md from Product_knowledge if present
        pk_md = self.root / "Product_knowledge" / "MessageBox_Reference.md"
        if pk_md.exists():
            codes.extend(self._parse_messagebox_md(pk_md))

        # Also parse MessageBox_Reference.md in Exchange_ErrorCodes (rich format)
        ec_md = folder / "MessageBox_Reference.md"
        if ec_md.exists():
            codes.extend(self._parse_messagebox_md(ec_md))

        # Deduplicate by code
        seen: set = set()
        unique = []
        for c in codes:
            key = c.get("code", "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                unique.append(c)

        logger.info(f"ErrorCodesParser: parsed {len(unique)} error codes")
        return unique

    def _parse_xlsx(self, path: Path) -> List[Dict[str, Any]]:
        codes = []
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                for row in ws.iter_rows(values_only=True):
                    if not row or row[0] is None:
                        continue
                    code_val = str(row[0]).strip()
                    desc_val = str(row[1]).strip() if len(row) > 1 and row[1] else ""
                    if not code_val or not desc_val:
                        continue
                    # Skip header rows
                    if code_val.lower() in ("code", "error_code", "error code", "id"):
                        continue
                    resolution = str(row[2]).strip() if len(row) > 2 and row[2] else ""
                    module = self._guess_module(code_val, desc_val)
                    codes.append({
                        "code": code_val,
                        "description": desc_val[:200],
                        "severity": self._guess_severity(code_val, desc_val),
                        "module": module,
                        "root_cause": desc_val[:150],
                        "resolution": resolution[:200] or f"Contact support for error {code_val}",
                        "example": "",
                    })
            wb.close()
        except Exception as e:
            logger.warning(f"Error reading {path.name}: {e}")
        return codes

    def _parse_csv(self, path: Path) -> List[Dict[str, Any]]:
        import csv
        codes = []
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    code = (row.get("ERROR_CODE") or row.get("code") or "").strip()
                    desc = (row.get("DESCRIPTION") or row.get("description") or "").strip()
                    if code and desc:
                        codes.append({
                            "code": code, "description": desc[:200],
                            "severity": self._guess_severity(code, desc),
                            "module": self._guess_module(code, desc),
                            "root_cause": desc[:150],
                            "resolution": row.get("RESOLUTION","")[:200],
                            "example": "",
                        })
        except Exception as e:
            logger.warning(f"Error reading {path.name}: {e}")
        return codes

    def _parse_md(self, path: Path) -> List[Dict[str, Any]]:
        """Parse markdown reference files for error codes."""
        codes = []
        import re
        content = self._safe_read(path)
        # Look for patterns like: | code | description | or ## CodeName
        for match in re.finditer(r'\|\s*(\d{4,})\s*\|\s*([^|]{5,100})\s*\|', content):
            code, desc = match.group(1), match.group(2).strip()
            codes.append({
                "code": code, "description": desc[:200],
                "severity": self._guess_severity(code, desc),
                "module": self._guess_module(code, desc),
                "root_cause": desc[:150], "resolution": "", "example": "",
            })
        return codes

    def _parse_pdf_errors(self, path: Path) -> List[Dict[str, Any]]:
        """Extract error codes from ETI/NNF protocol PDFs."""
        codes = []
        try:
            import PyPDF2
            import re as _re
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = "\n".join(page.extract_text() or "" for page in reader.pages[:30])
            # Pattern: numeric error codes with descriptions (e.g. "16283 Price not multiple of tick size")
            for m in _re.finditer(r'\b(\d{4,6})\s+([A-Z][^\n]{10,120})', text):
                code_val = m.group(1)
                desc_val = m.group(2).strip()[:200]
                codes.append({
                    "code": code_val,
                    "description": desc_val,
                    "severity": self._guess_severity(code_val, desc_val),
                    "module": self._guess_module(code_val, desc_val),
                    "root_cause": desc_val[:150],
                    "resolution": f"Refer to {path.name} for details.",
                    "example": "",
                    "source_file": path.name,
                })
        except Exception as e:
            logger.debug(f"PDF error parse failed for {path.name}: {e}")
        return codes

    def _parse_messagebox_md(self, path: Path) -> List[Dict[str, Any]]:
        """
        Parse the rich MessageBox_Reference.md format which contains:
        - Message box dialog text with purpose/cause
        - ERR_*/ERROR_* defines with numeric values and descriptions
        """
        import re as _re
        codes = []
        try:
            content = self._safe_read(path)

            # Pattern 1: Error code defines table rows
            # | `ERR_NAME` | VALUE | File | Line | Purpose |
            for m in _re.finditer(
                r'\|\s*`(ERR_\w+|ERROR_\w+)`\s*\|\s*(\d+)\s*\|[^|]*\|[^|]*\|\s*([^|]{5,200})\s*\|',
                content,
            ):
                name = m.group(1)
                value = m.group(2)
                purpose = m.group(3).strip()[:200]
                codes.append({
                    "code": name,
                    "description": purpose,
                    "severity": self._guess_severity(name, purpose),
                    "module": self._guess_module(name, purpose),
                    "root_cause": purpose[:150],
                    "resolution": f"Check exchange/RMS configuration. Code value: {value}.",
                    "example": f"Numeric value: {value}",
                    "source_file": path.name,
                })

            # Pattern 2: MessageBox dialog rows
            # | `"message text"` | File | Line | Debug? | Purpose | ...
            for m in _re.finditer(
                r'\|\s*`"([^"]{10,150})"`\s*\|[^|]*\|[^|]*\|\s*(No|Yes)\s*\|\s*([^|]{5,200})\s*\|',
                content,
            ):
                msg_text = m.group(1).strip()
                is_debug = m.group(2).strip()
                purpose = m.group(3).strip()[:200]
                if is_debug == "Yes":
                    continue  # Skip debug-only messages
                codes.append({
                    "code": msg_text[:80],
                    "description": purpose,
                    "severity": self._guess_severity(msg_text, purpose),
                    "module": self._guess_module(msg_text, purpose),
                    "root_cause": purpose[:150],
                    "resolution": "Check application logs for context. Contact support if persistent.",
                    "example": f'User sees: "{msg_text}"',
                    "source_file": path.name,
                })
        except Exception as e:
            logger.warning(f"MessageBox_Reference parse failed for {path.name}: {e}")
        return codes

    def _guess_severity(self, code: str, desc: str) -> str:
        text = f"{code} {desc}".lower()
        if any(w in text for w in ["fatal", "critical", "crash", "denied", "invalid login"]):
            return "Critical"
        if any(w in text for w in ["error", "fail", "reject", "exceed", "not found"]):
            return "High"
        if any(w in text for w in ["warn", "timeout", "retry", "limit"]):
            return "Medium"
        return "Low"

    def _guess_module(self, code: str, desc: str) -> str:
        text = f"{code} {desc}".lower()
        if any(w in text for w in ["rms", "risk", "margin", "exposure"]):
            return "RMS"
        if any(w in text for w in ["fix", "session", "heartbeat", "sequence"]):
            return "FIX"
        if any(w in text for w in ["oms", "order", "cancel", "replace"]):
            return "OMS"
        if any(w in text for w in ["auth", "login", "token", "jwt"]):
            return "AUTH"
        return "SYSTEM"
