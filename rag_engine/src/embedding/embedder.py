"""Local embedding generation for retrieval indexing."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np

from src.config.settings import EMBEDDING_BATCH_SIZE, HUGGINGFACE_CACHE_DIR


@dataclass(frozen=True)
class EmbeddingModelSpec:
    document_prefix: str = ""
    query_prefix: str = ""
    trust_remote_code: bool = False


MODEL_SPECS: dict[str, EmbeddingModelSpec] = {
    "BAAI/bge-small-en-v1.5": EmbeddingModelSpec(query_prefix="Represent this sentence for searching relevant passages: "),
    "BAAI/bge-base-en-v1.5": EmbeddingModelSpec(query_prefix="Represent this sentence for searching relevant passages: "),
    "intfloat/e5-base-v2": EmbeddingModelSpec(document_prefix="passage: ", query_prefix="query: "),
    "nomic-ai/nomic-embed-text-v1": EmbeddingModelSpec(
        document_prefix="search_document: ",
        query_prefix="search_query: ",
        trust_remote_code=True,
    ),
}

EMBEDDING_MODEL_CANDIDATES = tuple(MODEL_SPECS)
_MODEL_CACHE = {}


class Embedder(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of documents."""

    def embed_query(self, text: str) -> list[float]:
        """Embed one query string."""


class SentenceTransformerEmbedder:
    def __init__(
        self,
        model_name: str,
        *,
        batch_size: int = EMBEDDING_BATCH_SIZE,
        cache_dir: Path = HUGGINGFACE_CACHE_DIR,
    ) -> None:
        self.model_name = model_name
        self.batch_size = batch_size
        self.cache_dir = cache_dir
        self.spec = MODEL_SPECS.get(model_name, EmbeddingModelSpec())


    
    @property
    def model(self):
        global _MODEL_CACHE

        # Return already loaded model
        if self.model_name in _MODEL_CACHE:
            return _MODEL_CACHE[self.model_name]

        self.cache_dir.mkdir(parents=True, exist_ok=True)

        os.environ.setdefault("HF_HOME", str(self.cache_dir))
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
        os.environ.setdefault("TQDM_DISABLE", "1")

        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(
            self.model_name,
            trust_remote_code=self.spec.trust_remote_code,
        )

        _MODEL_CACHE[self.model_name] = model

        return model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        encoded_texts = [self.spec.document_prefix + text for text in texts]
        embeddings = self.model.encode(
            encoded_texts,
            batch_size=self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return _to_float_vectors(embeddings)

    def embed_query(self, text: str) -> list[float]:
        encoded_text = self.spec.query_prefix + text
        embeddings = self.model.encode(
            [encoded_text],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return _to_float_vectors(embeddings)[0]


def _to_float_vectors(embeddings: np.ndarray) -> list[list[float]]:
    return embeddings.astype(float).tolist()
