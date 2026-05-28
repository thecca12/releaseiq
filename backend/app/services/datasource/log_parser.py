"""
Log parser — reads real log files from Datasource/Logfiles/
Subfolders: Client_Logs/, Fix_Logs/, Server_logs/
"""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

LOG_LEVEL_RE = re.compile(r'\b(ERROR|WARN(?:ING)?|INFO|DEBUG|FATAL|CRITICAL)\b', re.I)
TIMESTAMP_RE = re.compile(r'(\d{2}[:/]\d{2}[:/]\d{2}|\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2})')

class LogParser(BaseParser):
    def get_source_name(self) -> str:
        return "Log Files"

    def parse(self) -> List[Dict[str, Any]]:
        logfiles_root = self.root / "Logfiles"
        if not logfiles_root.exists():
            logger.warning("LogParser: Logfiles/ folder not found")
            return []

        result = []
        # Map subfolder → module name
        folder_module_map = {
            "Client_Logs": "CLIENT",
            "Fix_Logs": "FIX",
            "Server_logs": "SERVER",
        }

        for subfolder, module_name in folder_module_map.items():
            folder = logfiles_root / subfolder
            if not folder.exists():
                continue
            # Only parse key log files to avoid memory issues
            log_files = sorted(folder.glob("*.log"))[:20]
            log_files += sorted(folder.glob("*.txt"))[:5]

            for lf in log_files[:15]:
                parsed = self._parse_log_file(lf, module_name)
                if parsed:
                    result.append(parsed)

        logger.info(f"LogParser: parsed {len(result)} log files")
        return result

    def _parse_log_file(self, path: Path, module: str) -> Dict[str, Any]:
        content = self._safe_read(path)
        if not content:
            return {}
        lines = content.splitlines()
        entries = []
        error_count = 0
        for line in lines[:500]:  # cap entries per file
            if not line.strip():
                continue
            level = self._detect_level(line)
            ts = self._detect_timestamp(line)
            if level == "ERROR" or level == "FATAL":
                error_count += 1
            entries.append({"timestamp": ts, "level": level, "message": line.strip()[:300]})
        return {
            "filename": path.name,
            "module": module,
            "size_bytes": path.stat().st_size,
            "indexed_at": None,
            "entries": entries,
            "entry_count": len(entries),
            "error_count": error_count,
            "log_type": module.lower(),
        }

    def _detect_level(self, line: str) -> str:
        m = LOG_LEVEL_RE.search(line)
        if m:
            return m.group(1).upper().replace("WARNING", "WARN")
        return "INFO"

    def _detect_timestamp(self, line: str) -> str:
        m = TIMESTAMP_RE.search(line)
        return m.group(1) if m else ""
