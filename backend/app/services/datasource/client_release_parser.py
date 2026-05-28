"""
Client Release parser — reads real xlsx file:
Datasource/Client_Release_Tracking/Client Patch details.xlsx
Columns: Sr.No, Client name, Main_Version, Version Number with patch,
         Date, Old version, Patch Details, Support Name
"""
import logging
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class ClientReleaseParser(BaseParser):
    def get_source_name(self) -> str:
        return "Client Releases"

    def parse(self) -> List[Dict[str, Any]]:
        folder = self.root / "Client_Release_Tracking"
        if not folder.exists():
            logger.warning("ClientReleaseParser: Client_Release_Tracking/ not found")
            return []

        clients = []
        # Try xlsx first
        for xlsx_file in folder.glob("*.xlsx"):
            clients.extend(self._parse_xlsx(xlsx_file))
        # Fallback to csv
        if not clients:
            for csv_file in folder.glob("*.csv"):
                clients.extend(self._parse_csv(csv_file))

        logger.info(f"ClientReleaseParser: parsed {len(clients)} client records")
        return clients

    def _parse_xlsx(self, path: Path) -> List[Dict[str, Any]]:
        clients = []
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            # Detect header row
            header_idx = 0
            headers = []
            for i, row in enumerate(rows[:5]):
                if row and any(v and "client" in str(v).lower() for v in row):
                    headers = [str(v).strip() if v else "" for v in row]
                    header_idx = i
                    break

            if not headers:
                # No header found — use positional mapping based on known structure
                # Sr.No | Client name | Main_Version | Version Number with patch | Date | Old version | Patch Details | Support Name
                for row in rows:
                    if not row or not row[0]:
                        continue
                    sr = str(row[0]).strip()
                    if not sr or sr.lower() in ("sr.no", "sr", "no"):
                        continue
                    client = self._build_client(
                        client_id=str(row[0]).strip(),
                        client_name=str(row[1]).strip() if len(row) > 1 and row[1] else "",
                        main_version=str(row[2]).strip() if len(row) > 2 and row[2] else "",
                        patch_version=str(row[3]).strip() if len(row) > 3 and row[3] else "",
                        date=str(row[4]).strip() if len(row) > 4 and row[4] else "",
                        old_version=str(row[5]).strip() if len(row) > 5 and row[5] else "",
                        patch_details=str(row[6]).strip() if len(row) > 6 and row[6] else "",
                        support=str(row[7]).strip() if len(row) > 7 and row[7] else "",
                    )
                    if client:
                        clients.append(client)
            else:
                for row in rows[header_idx+1:]:
                    if not row or not any(row):
                        continue
                    d = {headers[i]: str(v).strip() if v else "" for i, v in enumerate(row) if i < len(headers)}
                    client = self._build_client(
                        client_id=d.get("Sr.No",""),
                        client_name=d.get("Client name",""),
                        main_version=d.get("Main_Version",""),
                        patch_version=d.get("Version Number with patch",""),
                        date=d.get("Date",""),
                        old_version=d.get("Old version",""),
                        patch_details=d.get("Patch Details",""),
                        support=d.get("Support Name",""),
                    )
                    if client:
                        clients.append(client)
        except Exception as e:
            logger.warning(f"ClientReleaseParser xlsx error: {e}")
        return clients

    def _build_client(self, client_id, client_name, main_version, patch_version, date, old_version, patch_details, support) -> Dict[str, Any]:
        if not client_name or client_name.lower() in ("client name", ""):
            return {}
        version = patch_version or main_version or "Unknown"
        health = self._calc_health(patch_details)
        return {
            "client_id": f"CLT{client_id.zfill(3)}" if client_id.isdigit() else client_id or f"C{client_name[:3].upper()}",
            "client_name": client_name,
            "current_version": version,
            "previous_version": old_version or "",
            "deployment_date": str(date).split(" ")[0] if date else "",
            "environment": "LIVE",
            "exchanges": ["NSE", "BSE"],
            "modules": ["RMS", "FIX", "OMS", "CLIENT"],
            "owner": support or "DeployTeam",
            "health_status": health,
            "health_color": {"Healthy": "bg-emerald-500", "Warning": "bg-amber-500", "Critical": "bg-red-500"}[health],
            "notes": patch_details[:200] if patch_details else "",
        }

    def _calc_health(self, patch_details: str) -> str:
        if not patch_details:
            return "Healthy"
        low = patch_details.lower()
        if any(w in low for w in ["critical","crash","error","fail","issue"]):
            return "Warning"
        return "Healthy"

    def _parse_csv(self, path: Path) -> List[Dict[str, Any]]:
        import csv
        clients = []
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    client = self._build_client(
                        client_id=str(idx),
                        client_name=row.get("CLIENT_NAME",""),
                        main_version=row.get("CURRENT_VERSION",""),
                        patch_version=row.get("CURRENT_VERSION",""),
                        date=row.get("DEPLOYMENT_DATE",""),
                        old_version=row.get("PREVIOUS_VERSION",""),
                        patch_details=row.get("NOTES",""),
                        support=row.get("OWNER",""),
                    )
                    if client:
                        clients.append(client)
        except Exception as e:
            logger.warning(f"ClientReleaseParser csv error: {e}")
        return clients
