"""
Release parser — reads Release_Details.txt (release names) and
builds full records from Release_PatchNotes folder structure.
Real path: Datasource/Release_PatchNotes/For Live/ and For QA/
"""
import logging
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class ReleaseParser(BaseParser):
    def get_source_name(self) -> str:
        return "Releases"

    def parse(self) -> List[Dict[str, Any]]:
        releases = []
        patch_root = self.root / "Release_PatchNotes"
        if patch_root.exists():
            releases = self._build_from_patch_notes(patch_root)
        if not releases:
            # Fallback from Release_Details.txt
            releases = self._from_release_details_txt()
        logger.info(f"ReleaseParser: parsed {len(releases)} releases")
        return releases

    def _build_from_patch_notes(self, patch_root: Path) -> List[Dict[str, Any]]:
        # Collect per-environment data keyed by normalised version name
        by_version: Dict[str, Dict[str, Any]] = {}

        for env_folder in ["For Live", "For QA"]:
            env_path = patch_root / env_folder
            if not env_path.exists():
                continue
            environment = "LIVE" if "Live" in env_folder else "QA"
            for release_folder in sorted(env_path.iterdir(), reverse=True):
                if not release_folder.is_dir():
                    continue
                version = release_folder.name.replace("Release_", "").replace("Relase_", "").strip()
                xlsx_files = list(release_folder.rglob("*.xlsx"))
                patch_date, jira_count = self._read_patch_xlsx(xlsx_files)

                if version not in by_version:
                    by_version[version] = {
                        "version": version,
                        "release_date": patch_date,
                        "environment": environment,
                        "status": "Deployed" if environment == "LIVE" else "Testing",
                        "owner": "GreekSoft DeployTeam",
                        "modules": ["RMS", "FIX", "OMS", "CLIENT", "SERVER"],
                        "health": "Healthy",
                        "open_issues": jira_count,
                        "critical_issues": 0,
                        "notes": f"{version} patch for {environment}. {jira_count} issues addressed.",
                        "health_color": "bg-emerald-500",
                        "patch_file_count": len(xlsx_files),
                        "environments": [],
                    }
                else:
                    # Merge: prefer LIVE values for primary fields
                    rec = by_version[version]
                    if environment == "LIVE":
                        rec["environment"] = "LIVE"
                        rec["status"] = "Deployed"
                        rec["health"] = "Healthy"
                        rec["health_color"] = "bg-emerald-500"
                        if patch_date:
                            rec["release_date"] = patch_date
                        rec["open_issues"] = max(rec["open_issues"], jira_count)
                        rec["notes"] = f"{version} patch for LIVE. {rec['open_issues']} issues addressed."

                by_version[version]["environments"].append({
                    "env": environment,
                    "date": patch_date,
                    "jira_count": jira_count,
                    "patch_files": len(xlsx_files),
                })

        return list(by_version.values())

    def _read_patch_xlsx(self, xlsx_files: List[Path]):
        """Extract patch date and JIRA count from xlsx files."""
        patch_date = ""
        jira_count = 0
        for xf in xlsx_files[:3]:
            try:
                import openpyxl
                wb = openpyxl.load_workbook(xf, read_only=True, data_only=True)
                ws = wb.active
                rows = list(ws.iter_rows(max_row=20, values_only=True))
                for row in rows[:4]:
                    if row and row[0]:
                        val = str(row[0])
                        if "/" in val and len(val) <= 12 and not val.lower().startswith("patch"):
                            patch_date = val
                for row in rows[5:]:
                    if row and row[0] and str(row[0]).startswith("GETSCTCL"):
                        jira_count += 1
                wb.close()
            except Exception:
                pass
        return patch_date, jira_count

    def _from_release_details_txt(self) -> List[Dict[str, Any]]:
        path = self.root / "Release_Details.txt"
        if not path.exists():
            return []
        releases = []
        for line in self._safe_read(path).splitlines():
            line = line.strip()
            if line and not line.lower().startswith("release"):
                releases.append({
                    "version": line, "release_date": "", "environment": "LIVE",
                    "status": "Deployed", "owner": "GreekSoft",
                    "modules": ["RMS", "FIX", "OMS", "CLIENT", "SERVER"],
                    "health": "Healthy", "open_issues": 0, "critical_issues": 0,
                    "notes": f"Release {line}", "health_color": "bg-emerald-500",
                })
        return releases
