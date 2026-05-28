"""
Patch Notes parser — reads xlsx files from Datasource/Release_PatchNotes/
Structure: For Live/<Release_Name>/*.xlsx and For QA/<Release_Name>/*.xlsx
Each xlsx row 0 = header, row 1 = patch date/release, row 5+ = JIRA issues
"""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class PatchNotesParser(BaseParser):
    def get_source_name(self) -> str:
        return "Patch Notes"

    def parse(self) -> List[Dict[str, Any]]:
        patch_root = self.root / "Release_PatchNotes"
        if not patch_root.exists():
            logger.warning("PatchNotesParser: Release_PatchNotes/ not found")
            return []

        notes = []
        # Group by release version
        release_map: Dict[str, Dict] = {}

        for env_folder in ["For Live", "For QA"]:
            env_path = patch_root / env_folder
            if not env_path.exists():
                continue
            env_label = "live" if "Live" in env_folder else "qa"

            for release_folder in env_path.iterdir():
                if not release_folder.is_dir():
                    continue
                version = release_folder.name.replace("Release_","").replace("Relase_","").strip()

                xlsx_files = list(release_folder.rglob("*.xlsx"))
                for xf in xlsx_files:
                    note_data = self._parse_xlsx(xf, version, env_label)
                    if not note_data:
                        continue
                    key = f"{version}-{xf.stem}"
                    if key not in release_map:
                        release_map[key] = note_data
                    else:
                        # Merge JIRA refs
                        existing = release_map[key]
                        existing["jira_refs"] = list(set(
                            existing.get("jira_refs", []) + note_data.get("jira_refs", [])
                        ))

        notes = list(release_map.values())
        logger.info(f"PatchNotesParser: parsed {len(notes)} patch note files")
        return notes

    def _parse_xlsx(self, path: Path, version: str, env: str) -> Dict[str, Any]:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(max_row=100, values_only=True))
            wb.close()
        except Exception as e:
            logger.debug(f"Cannot read {path.name}: {e}")
            return {}

        patch_date = ""
        release_for = version
        jira_ids = []
        issue_lines = []

        # Row 0 = header, Row 1 = data (patch date, release version, etc.)
        if len(rows) > 1 and rows[1]:
            r1 = [str(v).strip() for v in rows[1] if v is not None]
            if r1:
                patch_date = r1[0] if r1 else ""
                for val in r1:
                    if val and len(val) > 3 and "2026" not in val and "2025" not in val:
                        release_for = val
                        break

        # Scan for JIRA IDs and issue summaries starting around row 5-6
        for row in rows[4:]:
            if not row or not row[0]:
                continue
            cell = str(row[0]).strip()
            if re.match(r'GETSCTCL-\d+', cell, re.I):
                jira_ids.append(cell.upper())
                summary = str(row[1]).strip()[:100] if len(row) > 1 and row[1] else ""
                issue_lines.append(f"{cell}: {summary}")

        if not jira_ids and not patch_date:
            return {}

        full_notes = "\n".join(issue_lines[:30])
        return {
            "version": version,
            "filename": path.name,
            "release_date": patch_date,
            "environments": [env],
            "jira_refs": jira_ids[:50],
            "qa_notes": full_notes if env == "qa" else "",
            "live_notes": full_notes if env == "live" else "",
            "summary": f"{version} patch ({env.upper()}): {len(jira_ids)} issues. Date: {patch_date}",
        }
