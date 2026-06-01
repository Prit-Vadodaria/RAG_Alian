"""Centralized settings and filesystem paths for the RAG project."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()

import os

# Stability knobs for native ML stacks on Windows CPU boxes.
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parents[2] / ".hf_cache"))
os.environ.setdefault("HF_HUB_CACHE", str(Path(__file__).resolve().parents[2] / ".hf_cache" / "hub"))
os.environ.setdefault("TRANSFORMERS_CACHE", str(Path(__file__).resolve().parents[2] / ".hf_cache" / "transformers"))


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_str(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str) -> tuple[str, ...]:
    value = os.getenv(name, "")
    return tuple(item.strip().lower() for item in value.split(",") if item.strip())


def _env_optional_float(name: str) -> float | None:
    value = os.getenv(name)
    if value is None or not value.strip():
        return None
    try:
        return float(value)
    except ValueError:
        return None


@dataclass(frozen=True)
class Settings:
    BASE_DIR: Path = Path(__file__).resolve().parents[2]
    DATA_DIR: Path = BASE_DIR / "data"
    RAW_DATA_DIR: Path = DATA_DIR / "raw"
    RAW_HTML_DIR: Path = RAW_DATA_DIR / "html"
    LEGACY_RAW_HTML_DIR: Path = DATA_DIR / "raw_html"
    CLEANED_MARKDOWN_DIR: Path = DATA_DIR / "cleaned_markdown"
    STRUCTURED_DOCS_DIR: Path = DATA_DIR / "structured_docs"
    CHUNKS_DIR: Path = DATA_DIR / "chunks"
    LOGS_DIR: Path = DATA_DIR / "logs"
    SITEMAP_URLS_FILE: Path = RAW_DATA_DIR / "sitemap_urls.txt"
    CRAWL_AUDIT_FILE: Path = LOGS_DIR / "crawl_audit.jsonl"
    CRAWL_MANIFEST_FILE: Path = RAW_DATA_DIR / "crawl_manifest.json"
    MAX_RETRIES: int = _env_int("MAX_RETRIES", 3)
    REQUEST_TIMEOUT: int = _env_int("REQUEST_TIMEOUT", 30)
    CRAWL_DELAY_SECONDS: float = _env_float("CRAWL_DELAY_SECONDS", 0.0)
    RESPECT_ROBOTS_TXT: bool = _env_bool("RESPECT_ROBOTS_TXT", True)
    ALLOWED_CRAWL_DOMAINS: tuple[str, ...] = _env_csv("ALLOWED_CRAWL_DOMAINS")
    MAX_CHUNK_TOKENS: int = _env_int("MAX_CHUNK_TOKENS", 125)
    MIN_CHUNK_TOKENS: int = _env_int("MIN_CHUNK_TOKENS", 25)
    CHUNK_OVERLAP_TOKENS: int = _env_int("CHUNK_OVERLAP_TOKENS", _env_int("CHUNK_OVERLAP", 25))
    EMBEDDING_MODEL: str = _env_str("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
    EMBEDDING_BATCH_SIZE: int = _env_int("EMBEDDING_BATCH_SIZE", 32)
    HUGGINGFACE_CACHE_DIR: Path = BASE_DIR / _env_str("HUGGINGFACE_CACHE_DIR", ".hf_cache")
    CHROMA_DIR: Path = BASE_DIR / _env_str("CHROMA_DIR", "data/indexes/chroma")
    CHROMA_COLLECTION: str = _env_str("CHROMA_COLLECTION", "website_rag_bge_base_v1")
    MAX_SEARCH_DISTANCE: float = _env_float("MAX_SEARCH_DISTANCE", 1.15)
    RAG_CONTEXT_TOKENS: int = _env_int("RAG_CONTEXT_TOKENS", 2200)
    VECTOR_TOP_K: int = _env_int("VECTOR_TOP_K", 10)
    FINAL_TOP_K: int = _env_int("FINAL_TOP_K", 5)
    MAX_CONTEXT_TOKENS: int = _env_int("MAX_CONTEXT_TOKENS", 1200)
    GOOGLE_API_KEY: str = _env_str("GOOGLE_API_KEY", "")
    GOOGLE_MODEL: str = _env_str("GOOGLE_MODEL", "gemini-3.1-flash-lite")
    GOOGLE_API_VERSION: str = _env_str("GOOGLE_API_VERSION", "v1beta")
    GOOGLE_TIMEOUT_SECONDS: int = _env_int("GOOGLE_TIMEOUT_SECONDS", 60)
    GOOGLE_TEMPERATURE: float = _env_float("GOOGLE_TEMPERATURE", 0.1)
    GOOGLE_MAX_OUTPUT_TOKENS: int = _env_int("GOOGLE_MAX_OUTPUT_TOKENS", 512)
    GOOGLE_MAX_RETRIES: int = _env_int("GOOGLE_MAX_RETRIES", 5)
    GOOGLE_RETRY_BACKOFF: float = _env_float("GOOGLE_RETRY_BACKOFF", 2.0)
    ENABLE_RERANKER: bool = _env_bool("ENABLE_RERANKER", True)
    RERANKER_BACKEND: str = _env_str("RERANKER_BACKEND", "auto")
    RERANKER_MODEL: str = _env_str("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    RERANKER_USE_FP16: bool = _env_bool("RERANKER_USE_FP16", False)
    RERANKER_INIT_TIMEOUT_SECONDS: int = _env_int("RERANKER_INIT_TIMEOUT_SECONDS", 30)
    DISCOVERY_MAX_PAGES: int = _env_int("DISCOVERY_MAX_PAGES", 100)
    DISCOVERY_MAX_DEPTH: int = _env_int("DISCOVERY_MAX_DEPTH", 2)


settings = Settings()

BASE_DIR = settings.BASE_DIR
DATA_DIR = settings.DATA_DIR
RAW_DATA_DIR = settings.RAW_DATA_DIR
RAW_HTML_DIR = settings.RAW_HTML_DIR
LEGACY_RAW_HTML_DIR = settings.LEGACY_RAW_HTML_DIR
CLEANED_MARKDOWN_DIR = settings.CLEANED_MARKDOWN_DIR
STRUCTURED_DOCS_DIR = settings.STRUCTURED_DOCS_DIR
CHUNKS_DIR = settings.CHUNKS_DIR
LOGS_DIR = settings.LOGS_DIR
SITEMAP_URLS_FILE = settings.SITEMAP_URLS_FILE
CRAWL_AUDIT_FILE = settings.CRAWL_AUDIT_FILE
CRAWL_MANIFEST_FILE = settings.CRAWL_MANIFEST_FILE
MAX_RETRIES = settings.MAX_RETRIES
REQUEST_TIMEOUT = settings.REQUEST_TIMEOUT
CRAWL_DELAY_SECONDS = settings.CRAWL_DELAY_SECONDS
RESPECT_ROBOTS_TXT = settings.RESPECT_ROBOTS_TXT
ALLOWED_CRAWL_DOMAINS = settings.ALLOWED_CRAWL_DOMAINS
MAX_CHUNK_TOKENS = settings.MAX_CHUNK_TOKENS
MIN_CHUNK_TOKENS = settings.MIN_CHUNK_TOKENS
CHUNK_OVERLAP_TOKENS = settings.CHUNK_OVERLAP_TOKENS
EMBEDDING_MODEL = settings.EMBEDDING_MODEL
EMBEDDING_BATCH_SIZE = settings.EMBEDDING_BATCH_SIZE
HUGGINGFACE_CACHE_DIR = settings.HUGGINGFACE_CACHE_DIR
CHROMA_DIR = settings.CHROMA_DIR
CHROMA_COLLECTION = settings.CHROMA_COLLECTION
MAX_SEARCH_DISTANCE = settings.MAX_SEARCH_DISTANCE
RAG_CONTEXT_TOKENS = settings.RAG_CONTEXT_TOKENS
VECTOR_TOP_K = settings.VECTOR_TOP_K
FINAL_TOP_K = settings.FINAL_TOP_K
MAX_CONTEXT_TOKENS = settings.MAX_CONTEXT_TOKENS
GOOGLE_API_KEY = settings.GOOGLE_API_KEY
GOOGLE_MODEL = settings.GOOGLE_MODEL
GOOGLE_API_VERSION = settings.GOOGLE_API_VERSION
GOOGLE_TIMEOUT_SECONDS = settings.GOOGLE_TIMEOUT_SECONDS
GOOGLE_TEMPERATURE = settings.GOOGLE_TEMPERATURE
GOOGLE_MAX_OUTPUT_TOKENS = settings.GOOGLE_MAX_OUTPUT_TOKENS
GOOGLE_MAX_RETRIES = settings.GOOGLE_MAX_RETRIES
GOOGLE_RETRY_BACKOFF = settings.GOOGLE_RETRY_BACKOFF
ENABLE_RERANKER = settings.ENABLE_RERANKER
RERANKER_BACKEND = settings.RERANKER_BACKEND
RERANKER_MODEL = settings.RERANKER_MODEL
RERANKER_USE_FP16 = settings.RERANKER_USE_FP16
RERANKER_INIT_TIMEOUT_SECONDS = settings.RERANKER_INIT_TIMEOUT_SECONDS
DISCOVERY_MAX_PAGES = settings.DISCOVERY_MAX_PAGES
DISCOVERY_MAX_DEPTH = settings.DISCOVERY_MAX_DEPTH


def ensure_directories() -> None:
    for directory in (
        RAW_DATA_DIR,
        RAW_HTML_DIR,
        LEGACY_RAW_HTML_DIR,
        CLEANED_MARKDOWN_DIR,
        STRUCTURED_DOCS_DIR,
        CHUNKS_DIR,
        HUGGINGFACE_CACHE_DIR,
        CHROMA_DIR,
        LOGS_DIR,
    ):
        directory.mkdir(parents=True, exist_ok=True)
