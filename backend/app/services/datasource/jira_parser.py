"""
Jira Issues parser — reads the real Jira CSV export.
File: Datasource/Jira_issues/Jira.csv
Real JIRA export with columns: Summary, Issue key, Issue Type, Status, Priority,
Assignee, Reporter, Created, Updated, Description, Custom field (Module), etc.
"""

import csv
import logging
from pathlib import Path
from typing import Any, Dict, List

from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)


class JiraParser(BaseParser):
    """Parses the real Jira.csv export file."""

    def get_source_name(self) -> str:
        return "Jira Issues"

    def parse(self) -> List[Dict[str, Any]]:
        # Try both casing variants of the folder name
        csv_path = None
        for folder in ["Jira_issues", "Jira_Issues"]:
            p = self.root / folder / "Jira.csv"
            if p.exists():
                csv_path = p
                break
            # Try any CSV in the folder
            folder_path = self.root / folder
            if folder_path.exists():
                csvs = list(folder_path.glob("*.csv"))
                if csvs:
                    csv_path = csvs[0]
                    break

        if not csv_path or not csv_path.exists():
            logger.warning("JiraParser: Jira CSV not found")
            return []

        issues = []
        try:
            with open(csv_path, encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    # Limit to 500 for performance (86k rows in real file)
                    if idx >= 500:
                        break
                    issue = self._map_row(row, idx)
                    if issue:
                        issues.append(issue)

            logger.info(f"JiraParser: parsed {len(issues)} issues from {csv_path.name}")
        except Exception as e:
            logger.error(f"JiraParser error: {e}", exc_info=True)

        return issues

    def _map_row(self, row: Dict[str, str], idx: int) -> Dict[str, Any]:
        """Map a raw CSV row to a normalized issue dict."""
        issue_key = (row.get("Issue key") or "").strip()
        summary = (row.get("Summary") or "").strip()

        if not issue_key or not summary:
            return {}

        module = (
            row.get("Custom field (Module)") or
            row.get("Components") or
            ""
        ).strip()
        description = (row.get("Description") or "").strip()[:500]
        search_text = f"{issue_key} {summary} {description} {module}".lower()

        return {
            "id": str(idx),
            "jira_id": issue_key,
            "title": summary,
            "status": self._normalize_status(row.get("Status", "")),
            "priority": self._normalize_priority(row.get("Priority", "")),
            "type": (row.get("Issue Type") or "Bug").strip(),
            "assignee": (row.get("Assignee") or "").strip() or None,
            "reporter": (row.get("Reporter") or "").strip() or None,
            "module": module or "General",
            "affected_version": (row.get("Affects versions") or "").strip() or None,
            "fix_version": (row.get("Fix versions") or "").strip() or None,
            "created_date": (row.get("Created") or "").strip(),
            "updated_date": (row.get("Updated") or "").strip(),
            "description": description,
            "environment": (row.get("Environment") or "").strip() or None,
            "jira_url": f"https://jira.greeksoft.co.in/browse/{issue_key}",
            "search_text": search_text,
        }

    def _normalize_status(self, raw: str) -> str:
        s = raw.strip().lower()
        return {
            "open": "Open", "in progress": "In Progress",
            "in review": "In Progress", "testing": "In Progress",
            "done": "Resolved", "resolved": "Resolved",
            "closed": "Closed", "wont fix": "Closed",
        }.get(s, raw.strip() or "Open")

    def _normalize_priority(self, raw: str) -> str:
        s = raw.strip().lower()
        return {
            "highest": "Critical", "critical": "Critical",
            "high": "High", "medium": "Medium",
            "low": "Low", "lowest": "Low", "trivial": "Low",
        }.get(s, raw.strip() or "Medium")
