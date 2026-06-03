"""Logging utilities for ingestion phases."""

from __future__ import annotations

import logging
from pathlib import Path

from src.config.settings import LOGS_DIR


def get_logger(name: str, log_file: Path | None = None) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    file_path = (log_file or LOGS_DIR / "ingestion.log").resolve()
    existing_handler = None
    for handler in logger.handlers:
        handler_path = getattr(handler, "baseFilename", None)
        if handler_path and Path(handler_path).resolve() == file_path:
            existing_handler = handler
            break

    if existing_handler is not None:
        return logger

    for handler in list(logger.handlers):
        handler.flush()
        handler.close()
        logger.removeHandler(handler)

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s - %(message)s")
    file_handler = logging.FileHandler(file_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger


def close_logger(logger: logging.Logger) -> None:
    for handler in list(logger.handlers):
        handler.flush()
        handler.close()
        logger.removeHandler(handler)
