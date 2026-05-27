"""Logging setup helpers for src modules."""

from __future__ import annotations

import logging
import os
import warnings

from transformers.utils import logging as transformers_logging


def configure_logging(level: int = logging.INFO) -> None:
    """Configure process-wide logging with a consistent format."""

    # Disable HF progress bars
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

    # Suppress Python warnings
    warnings.filterwarnings("ignore")

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

    # Suppress noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.ERROR)
    logging.getLogger("httpcore").setLevel(logging.ERROR)
    logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
    logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
    logging.getLogger("transformers").setLevel(logging.ERROR)

    # Suppress transformers internal verbosity
    transformers_logging.set_verbosity_error()