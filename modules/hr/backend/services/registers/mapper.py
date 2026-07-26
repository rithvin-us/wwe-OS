import json
import logging
from typing import Any

from hr.backend.services.registers.config import get_settings

logger = logging.getLogger(__name__)


class ExcelMapper:
    """Loads and provides access to Excel JSON mapping files."""

    def __init__(self):
        self.settings = get_settings()
        self.mappings: dict[str, dict[str, Any]] = {}
        self._load_all_mappings()

    def _load_all_mappings(self):
        """Load all JSON files from the mappings directory."""
        mappings_dir = self.settings.mappings_full_path
        if not mappings_dir.exists():
            logger.warning(f"Mappings directory {mappings_dir} does not exist.")
            return

        for file_path in mappings_dir.glob("*.json"):
            try:
                with open(file_path, encoding="utf-8") as f:
                    mapping_data = json.load(f)
                    sheet_name = mapping_data.get("sheet_name")
                    if sheet_name:
                        self.mappings[sheet_name] = mapping_data
            except Exception as e:
                logger.error(f"Failed to load mapping file {file_path}: {e}")

    def get_mapping(self, sheet_name: str) -> dict[str, Any]:
        """Get the mapping dictionary for a specific sheet."""
        if sheet_name not in self.mappings:
            raise ValueError(f"No mapping found for sheet: {sheet_name}")
        return self.mappings[sheet_name]
