"""Abstract base parser class for all datasource parsers."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List
import logging

logger = logging.getLogger(__name__)


class BaseParser(ABC):
    """Base class for all datasource parsers."""

    def __init__(self, datasource_root: Path):
        self.root = datasource_root

    @abstractmethod
    def parse(self) -> List[Dict[str, Any]]:
        """Parse files and return list of structured records."""
        ...

    @abstractmethod
    def get_source_name(self) -> str:
        """Return name of this data source."""
        ...

    def _safe_read(self, path: Path) -> str:
        """Safely read file content, returning empty string on error."""
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Failed to read {path}: {e}")
            return ""

    def _find_files(self, folder: str, extensions: List[str]) -> List[Path]:
        """Recursively find files with given extensions in a subfolder."""
        target = self.root / folder
        if not target.exists():
            return []
        files = []
        for ext in extensions:
            files.extend(target.rglob(f"*{ext}"))
        return sorted(files)
