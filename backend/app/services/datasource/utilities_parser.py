"""
Utilities parser — scans Datasource/Utilities/ for files.
Includes .exe, .lnk, scripts, directories.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

class UtilitiesParser(BaseParser):
    def get_source_name(self) -> str:
        return "Utilities"

    def parse(self) -> List[Dict[str, Any]]:
        folder = self.root / "Utilities"
        if not folder.exists():
            logger.warning("UtilitiesParser: Utilities/ not found")
            return []

        utilities = []
        for item in sorted(folder.iterdir()):
            try:
                stat = item.stat()
                desc = self._get_description(item)
                utilities.append({
                    "name": item.stem,
                    "filename": item.name,
                    "filepath": str(item),
                    "size_bytes": stat.st_size if item.is_file() else 0,
                    "extension": item.suffix.lower() if item.is_file() else "folder",
                    "description": desc,
                    "upload_date": None,
                    "is_directory": item.is_dir(),
                    "type": self._get_type(item),
                })
            except Exception:
                pass

        logger.info(f"UtilitiesParser: found {len(utilities)} utilities")
        return utilities

    def _get_description(self, path: Path) -> str:
        if path.is_dir():
            return f"Utility folder: {path.name}"
        ext = path.suffix.lower()
        if ext in (".py",):
            first_lines = ""
            try:
                with open(path, errors="replace") as f:
                    for line in f:
                        stripped = line.strip()
                        if stripped and not stripped.startswith("#"):
                            first_lines = stripped[:100]
                            break
            except Exception:
                pass
            return first_lines or f"Python utility: {path.name}"
        if ext in (".sh",):
            return f"Shell script: {path.name}"
        if ext in (".exe",):
            return f"Windows executable: {path.name}"
        if ext in (".lnk",):
            return f"Windows shortcut: {path.name}"
        return f"Utility file: {path.name}"

    def _get_type(self, path: Path) -> str:
        if path.is_dir():
            return "directory"
        return {
            ".py": "python", ".sh": "shell", ".exe": "executable",
            ".lnk": "shortcut", ".bat": "batch", ".ps1": "powershell",
            ".txt": "text",
        }.get(path.suffix.lower(), "file")
