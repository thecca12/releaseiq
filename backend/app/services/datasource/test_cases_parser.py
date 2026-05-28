"""
Test Cases parser — reads Datasource/Test_Cases/Ajay_Team_Test_Cases_.xlsx
Multi-sheet xlsx. First sheet has columns: Sr no, Modules, Tester Name, etc.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class TestCasesParser(BaseParser):
    def get_source_name(self) -> str:
        return "Test Cases"

    def parse(self) -> List[Dict[str, Any]]:
        folder = self.root / "Test_Cases"
        if not folder.exists():
            logger.warning("TestCasesParser: Test_Cases/ not found")
            return []

        test_cases = []
        for xlsx_file in folder.glob("*.xlsx"):
            test_cases.extend(self._parse_xlsx(xlsx_file))
        for csv_file in folder.glob("*.csv"):
            test_cases.extend(self._parse_csv(csv_file))

        logger.info(f"TestCasesParser: parsed {len(test_cases)} test cases")
        return test_cases

    def _parse_xlsx(self, path: Path) -> List[Dict[str, Any]]:
        cases = []
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                rows = list(ws.iter_rows(max_row=200, values_only=True))
                if not rows:
                    continue
                # Find header row
                headers = []
                data_start = 0
                for i, row in enumerate(rows[:5]):
                    if row and any(v and str(v).strip().lower() in ("sr no","modules","module","test id","test name") for v in row):
                        headers = [str(v).strip() if v else f"col{j}" for j, v in enumerate(row)]
                        data_start = i + 1
                        break

                if headers:
                    for idx, row in enumerate(rows[data_start:data_start+100]):
                        if not row or not any(row):
                            continue
                        d = {headers[i]: str(v).strip() if v is not None else "" for i, v in enumerate(row) if i < len(headers)}
                        case = self._build_case(d, sheet_name, idx)
                        if case:
                            cases.append(case)
                else:
                    # Positional: sr_no, module, tester, test_name, ...
                    for idx, row in enumerate(rows[1:51]):
                        if not row or not row[0]:
                            continue
                        module = str(row[1]).strip() if len(row) > 1 and row[1] else sheet_name
                        name = str(row[2]).strip() if len(row) > 2 and row[2] else f"TC-{idx}"
                        cases.append({
                            "test_id": f"TC-{idx+1:04d}",
                            "test_name": name[:100],
                            "module": module,
                            "type": "Regression",
                            "steps": "",
                            "expected_result": "Pass",
                            "status": "Pass",
                            "priority": "Medium",
                            "last_run": "",
                            "automation": "Manual",
                        })
            wb.close()
        except Exception as e:
            logger.warning(f"TestCasesParser xlsx error: {e}")
        return cases

    def _build_case(self, d: Dict, sheet: str, idx: int) -> Dict[str, Any]:
        name = d.get("Modules", d.get("Module", d.get("Test Name", d.get("test name", ""))))
        if not name:
            return {}
        return {
            "test_id": d.get("Sr no", d.get("Test ID", f"TC-{idx+1:04d}")),
            "test_name": name[:100],
            "module": d.get("Module", sheet),
            "type": d.get("Type", "Regression"),
            "steps": d.get("Steps", d.get("Test Steps", ""))[:300],
            "expected_result": d.get("Expected Result", d.get("Expected", "Pass"))[:200],
            "status": d.get("Status", "Pass"),
            "priority": d.get("Priority", "Medium"),
            "last_run": d.get("Last Run", d.get("Date", "")),
            "automation": d.get("Automation", "Manual"),
        }

    def _parse_csv(self, path: Path) -> List[Dict[str, Any]]:
        import csv
        cases = []
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    if idx >= 100:
                        break
                    cases.append({
                        "test_id": row.get("TEST_ID", f"TC-{idx+1:04d}"),
                        "test_name": row.get("TEST_NAME", "")[:100],
                        "module": row.get("MODULE", "General"),
                        "type": row.get("TYPE", "Regression"),
                        "steps": row.get("STEPS", "")[:300],
                        "expected_result": row.get("EXPECTED_RESULT", "Pass")[:200],
                        "status": row.get("STATUS", "Pass"),
                        "priority": row.get("PRIORITY", "Medium"),
                        "last_run": row.get("LAST_RUN", ""),
                        "automation": row.get("AUTOMATION", "Manual"),
                    })
        except Exception as e:
            logger.warning(f"TestCasesParser csv error: {e}")
        return cases
