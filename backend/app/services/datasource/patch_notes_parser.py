"""
Patch Notes parser — reads xlsx files from:
  Datasource/Release_PatchNotes/For Live/<Release>/[Client|Server]/*.xlsx
  Datasource/Release_PatchNotes/For QA/<Release>/[Client|Server]/*.xlsx

Handles all formats by scanning ALL rows for dates and JIRA IDs.
Two xlsx layouts found in real data:

OPTIMUS (TAG-*.xlsx):
  Row 0: [Patch Date, Release For, ...]
  Row 1: [date_value, release_name, ...]
  Row 5: [Jira ID, Summary, Issue Type, Priority, Severity, Status, Reporter, Customer, ...]
  Row 6+: JIRA data rows (columns match row 5 headers)

FUSION/1209/3009 (Release_*, PatchNote_*.xlsx):
  Row 0: title OR [Patch Date, Release for, ...]
  Row 1: headers (if row 0 was title) OR empty
  Row 2 or 3: [date_value, release_name, ...]
  Rows: developer in col E (idx 4), GETSCTCL-XXXX: summary in col H (idx 7)
"""
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)
JIRA_RE = re.compile(r'GETSCTCL-\d+', re.I)
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}')


class PatchNotesParser(BaseParser):
    def get_source_name(self) -> str:
        return "Patch Notes"

    def parse(self) -> List[Dict[str, Any]]:
        patch_root = self.root / "Release_PatchNotes"
        if not patch_root.exists():
            logger.warning("PatchNotesParser: Release_PatchNotes/ not found")
            return []

        notes: List[Dict[str, Any]] = []

        for env_folder in sorted(patch_root.iterdir()):
            if not env_folder.is_dir():
                continue
            environment = "LIVE" if "live" in env_folder.name.lower() else "QA"

            for release_folder in sorted(env_folder.iterdir()):
                if not release_folder.is_dir():
                    continue
                release_name = (release_folder.name
                                .replace("Release_", "").replace("Relase_", "").strip())

                xlsx_files: List[Path] = []
                for item in sorted(release_folder.iterdir()):
                    if item.is_file() and item.suffix.lower() == ".xlsx":
                        xlsx_files.append(item)
                    elif item.is_dir() and item.name in ("Client", "Server"):
                        for xf in sorted(item.glob("*.xlsx")):
                            xlsx_files.append(xf)

                for xf in xlsx_files:
                    note = self._parse_xlsx(xf, release_name, environment)
                    if note:
                        notes.append(note)

        logger.info(f"PatchNotesParser: parsed {len(notes)} patch note files")
        return notes

    def _parse_xlsx(self, path: Path, release_name: str, environment: str) -> Optional[Dict[str, Any]]:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            wb.close()
        except Exception as e:
            logger.debug(f"Cannot read {path.name}: {e}")
            return None

        if not rows:
            return None

        # ── Step 1: detect format ─────────────────────────────────────────────
        # Optimus format has a row with "Jira ID" as first cell
        has_jira_header_row = False
        jira_header_row_idx = -1
        jira_headers: List[str] = []
        for i, row in enumerate(rows[:12]):
            if row and row[0] and str(row[0]).strip().lower() == "jira id":
                has_jira_header_row = True
                jira_header_row_idx = i
                jira_headers = [str(v).strip() if v else "" for v in row]
                break

        # ── Step 2: find patch date and release label ─────────────────────────
        patch_date = ""
        release_for = release_name
        data_start = 0

        for i, row in enumerate(rows[:10]):
            if not row:
                continue
            for col_idx, cell in enumerate(row):
                if cell is None:
                    continue
                s = str(cell).strip()
                # Date cell: 2026-05-14 or 2026-05-14 00:00:00 or 5/12/2026
                if isinstance(cell, datetime):
                    patch_date = cell.strftime("%Y-%m-%d")
                    # Release name is typically the next non-empty cell
                    for next_col in range(col_idx + 1, len(row)):
                        if row[next_col]:
                            release_for = str(row[next_col]).strip()[:100]
                            break
                    data_start = i + 1
                    break
                elif DATE_RE.match(s) and len(s) >= 10:
                    patch_date = s[:10]
                    for next_col in range(col_idx + 1, len(row)):
                        if row[next_col]:
                            release_for = str(row[next_col]).strip()[:100]
                            break
                    data_start = i + 1
                    break
                elif re.match(r'\d{1,2}/\d{1,2}/\d{4}', s):
                    patch_date = self._parse_mdy(s)
                    for next_col in range(col_idx + 1, len(row)):
                        if row[next_col]:
                            release_for = str(row[next_col]).strip()[:100]
                            break
                    data_start = i + 1
                    break
            if patch_date:
                break

        # ── Step 3: extract JIRA items ────────────────────────────────────────
        jira_items: List[Dict] = []

        if has_jira_header_row:
            # OPTIMUS format: structured table after jira_header_row_idx
            for row in rows[jira_header_row_idx + 1:]:
                if not row or not row[0]:
                    continue
                jira_id = str(row[0]).strip()
                if not JIRA_RE.match(jira_id):
                    continue
                if any(j["jira_id"] == jira_id.upper() for j in jira_items):
                    continue
                def get(idx, r=row): return str(r[idx]).strip() if len(r) > idx and r[idx] is not None else ""
                jira_items.append({
                    "jira_id":    jira_id.upper(),
                    "summary":    get(1),
                    "issue_type": get(2),
                    "priority":   get(3),
                    "severity":   get(4),
                    "status":     get(5),
                    "reporter":   get(6),
                    "customer":   get(7),
                    "customer_version": get(8),
                    "patch_details": get(9),
                })
        else:
            # FUSION format: scan ALL cells for GETSCTCL-XXXX pattern
            for row in rows[data_start:]:
                if not row:
                    continue
                for col_idx, cell in enumerate(row):
                    if cell is None:
                        continue
                    cell_str = str(cell).strip()
                    m = re.match(r'(GETSCTCL-\d+)\s*[:\-]\s*(.*)', cell_str, re.I | re.S)
                    if m:
                        jira_id = m.group(1).upper()
                        summary = re.sub(r'\s+', ' ', m.group(2)).strip()[:200]
                        # Developer: look in cells before this one in same row
                        developer = ""
                        for dev_col in range(max(0, col_idx - 4), col_idx):
                            dv = str(row[dev_col]).strip() if dev_col < len(row) and row[dev_col] else ""
                            if dv and not JIRA_RE.search(dv) and 3 < len(dv) < 60:
                                developer = dv
                        if not any(j["jira_id"] == jira_id for j in jira_items):
                            jira_items.append({
                                "jira_id":    jira_id,
                                "summary":    summary,
                                "issue_type": "",
                                "priority":   "",
                                "severity":   "",
                                "status":     "",
                                "reporter":   developer,
                                "customer":   "",
                                "customer_version": "",
                                "patch_details": "",
                            })
                        break

        if not jira_items and not patch_date:
            return None

        # Component type from folder structure
        parent_name = path.parent.name.lower()
        stem_lower = path.stem.lower()
        if "server" in parent_name or "console" in stem_lower:
            component = "Server"
        elif "client" in parent_name or "retail" in stem_lower or "mfc" in stem_lower:
            component = "Client"
        else:
            component = "Both"

        return {
            "version":        release_name,
            "filename":       path.name,
            "filepath":       str(path),
            "release_date":   patch_date,
            "environment":    environment,
            "environments":   [environment.lower()],
            "release_for":    release_for,
            "component_type": component,
            "jira_refs":      [j["jira_id"] for j in jira_items],
            "jira_items":     jira_items,
            "jira_count":     len(jira_items),
            "qa_notes":       self._notes_text(jira_items) if environment == "QA" else "",
            "live_notes":     self._notes_text(jira_items) if environment == "LIVE" else "",
            "summary":        (f"{release_name} | {release_for} | "
                               f"{environment} | {len(jira_items)} JIRAs | {patch_date}"),
            "format":         "optimus" if has_jira_header_row else "fusion",
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _parse_mdy(self, s: str) -> str:
        """Parse D/M/YYYY or M/D/YYYY dates — try both, return whichever is valid."""
        m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
        if not m:
            return s[:10]
        a, b, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        # Try D/M/YYYY first (Indian format)
        if b <= 12:
            try:
                return datetime(year, b, a).strftime("%Y-%m-%d")
            except ValueError:
                pass
        # Try M/D/YYYY (American format)
        if a <= 12:
            try:
                return datetime(year, a, b).strftime("%Y-%m-%d")
            except ValueError:
                pass
        return s[:10]

    def _notes_text(self, jira_items: List[Dict]) -> str:
        lines = []
        for item in jira_items[:50]:
            parts = [item["jira_id"]]
            if item.get("issue_type"):
                parts.append(f"[{item['issue_type']}]")
            if item.get("priority"):
                parts.append(f"({item['priority']})")
            parts.append(f": {item['summary']}")
            lines.append(" ".join(parts))
        return "\n".join(lines)
