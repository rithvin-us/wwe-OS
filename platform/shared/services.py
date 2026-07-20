"""Service-layer base. Business rules of a capability live in services."""

from __future__ import annotations

import logging


class BaseService:
    """Common surface for capability services (logging, event publishing)."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(f"platform.{self.__class__.__module__}")
