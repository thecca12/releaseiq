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

        logger.info(f"ErrorCodesParser: parsed {len(codes)} error codes")
        return codes

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
