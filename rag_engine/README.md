# Website RAG

Production-oriented Retrieval-Augmented Generation pipeline for website content ingestion, semantic search, reranking, grounded answer generation, and confidence scoring.

This repository currently ships the backend RAG system and CLI tooling that power the pipeline. The code is structured so it can be wrapped by a FastAPI service or paired with a frontend, but those layers are not committed in this snapshot.

## Overview

Website RAG is a modular AI engineering project that turns raw website pages into retrieval-ready knowledge and uses that knowledge to answer questions with grounded, citation-aware responses.

The pipeline is designed around practical production concerns:

- deterministic ingestion and chunking
- local vector indexing with ChromaDB
- CPU-safe reranking with a cross-encoder fallback path
- Gemini-backed answer generation
- confidence scoring for answer quality and traceability
- lightweight deployment and reproducible local execution

## Key Features

- Semantic website ingestion pipeline
- Boilerplate removal and HTML-to-markdown conversion
- Structure-aware semantic chunking with overlap
- SentenceTransformer-based embeddings
- Persistent ChromaDB vector search
- Optional cross-encoder reranking
- Grounded prompt construction with source tags
- Google Gemini generation backend
- Deterministic confidence scoring
- Retrieval diagnostics and logging
- Benchmark helpers for embedding model evaluation
- Test suite for retrieval, chunking, ingestion, reranking, and confidence logic

## Architecture

### 1. Ingestion Flow

1. Parse sitemap URLs.
2. Crawl rendered pages with Playwright.
3. Persist raw HTML snapshots.
4. Extract main content from HTML.
5. Convert cleaned HTML to markdown.
6. Extract document metadata.
7. Split markdown into semantic chunks.
8. Export cleaned markdown, structured documents, and chunk JSON files.

### 2. Indexing Flow

1. Load exported chunk files from `data/chunks/`.
2. Build dense embeddings with SentenceTransformers.
3. Store documents, metadata, and embeddings in persistent ChromaDB.

### 3. Retrieval Flow

1. Embed the user query.
2. Run vector search against ChromaDB.
3. Filter weak matches by distance threshold.
4. Optionally rerank retrieved chunks with a cross-encoder.
5. Keep the final top-k chunks for context assembly.

### 4. Generation Flow

1. Build a compact context window from reranked chunks.
2. Insert citation markers such as `[S1]`, `[S2]`.
3. Create a grounded prompt that restricts the model to the retrieved context.
4. Generate the answer with Google Gemini.
5. Fall back to a safe "I don't know..." response when needed.

### 5. Confidence Scoring Flow

The final response is scored with four deterministic components:

- retrieval confidence
- rerank confidence
- grounding confidence
- answer quality confidence

These are combined into a normalized final confidence score and mapped to a label:

- `high`
- `medium`
- `low`

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Language | Python |
| Retrieval API | ChromaDB |
| Embeddings | SentenceTransformers |
| Reranking | Cross-encoder via `sentence-transformers` |
| Generation | Google Gemini |
| Ingestion | Playwright, BeautifulSoup, trafilatura, selectolax |
| Markdown conversion | markdownify |
| Testing | `unittest` test suite, pytest-compatible |
| Runtime utilities | `python-dotenv`, `requests`, `numpy`, `tiktoken` |

## Project Structure

```text
.
├── main.py
├── requirements.txt
├── scripts/
│   ├── ingest.py
│   ├── benchmark.py
│   └── rebuild_embeddings.py
├── src/
│   ├── config/
│   ├── ingestion/
│   ├── chunking/
│   ├── embedding/
│   ├── retrieval/
│   ├── vectordb/
│   ├── rag/
│   ├── llm/
│   ├── evaluation/
│   └── utils/
├── tests/
├── data/
│   ├── raw/
│   ├── cleaned_markdown/
│   ├── structured_docs/
│   ├── chunks/
│   ├── indexes/
│   └── logs/
└── .gitignore
```

### Important Directories

- `src/` contains the core pipeline implementation.
- `tests/` contains unit and integration-style tests for the pipeline.
- `scripts/` contains convenience entrypoints for ingestion, benchmarking, and index rebuilds.
- `data/` contains generated runtime artifacts such as crawled HTML, chunk exports, indexes, and logs.

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Project
```

### 2. Create and activate a virtual environment

```bash
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium
```

### 4. Configure environment variables

Create a `.env` file at the repository root.

### 5. Run the pipeline

```bash
python main.py
```

## Environment Variables

The code reads configuration from environment variables via `python-dotenv`.

| Variable | Purpose | Example |
| --- | --- | --- |
| `GOOGLE_API_KEY` | Gemini API key used by the generation backend | set in `.env` |
| `GOOGLE_MODEL` | Gemini model name | `gemini-3.1-flash-lite` |
| `GOOGLE_MAX_RETRIES` | Maximum retry attempts for Gemini 429 responses | `5` |
| `GOOGLE_RETRY_BACKOFF` | Base backoff multiplier in seconds for Gemini retries | `2` |
| `VECTOR_DB_PATH` | Common deployment alias for the vector DB location; map this to `CHROMA_DIR` in your wrapper or deployment config | `.workspace/indexes/chroma` |
| `RERANK_MODEL` | Common deployment alias for the reranker model; map this to `RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| `LOG_LEVEL` | Logging level used by your launcher or wrapper around `configure_logging()` | `INFO` |

### Example `.env`

```env
GOOGLE_API_KEY=
GOOGLE_MODEL=gemini-3.1-flash-lite
GOOGLE_MAX_RETRIES=5
GOOGLE_RETRY_BACKOFF=2
CHROMA_DIR=.workspace/indexes/chroma
RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANKER_BACKEND=auto
LOG_LEVEL=INFO
```

Note: the codebase currently uses `CHROMA_DIR` and `RERANKER_MODEL` directly. `VECTOR_DB_PATH` and `RERANK_MODEL` are common deployment aliases if you wire an adapter or platform-specific config layer.

## Usage

### Ingest URLs from a sitemap

```bash
python main.py --sitemap-url "https://example.com/sitemap.xml"
```

### Crawl saved URLs

```bash
python main.py --crawl-urls
```

### Process crawled HTML into chunks

```bash
python main.py --process-html
```

### Build or refresh the vector index

```bash
python main.py --index-chunks
```

### Search the index

```bash
python main.py --query "What pricing plans are available?" --top-k 5
```

### Ask a grounded question

```bash
python main.py --ask "What pricing plans are available?" --top-k 5
```

### Run the embedding benchmark

```bash
python main.py --benchmark-embeddings
```

## API Reference

This repository snapshot does not include a committed FastAPI application, but the pipeline is organized so a thin HTTP layer can expose the following contract.

### `POST /query`

Request:

```json
{
  "query": "What pricing plans are available?",
  "top_k": 5
}
```

Response:

```json
{
  "query": "What pricing plans are available?",
  "answer": "The available plans are ... [S1]",
  "confidence": 0.82,
  "confidence_label": "high",
  "confidence_breakdown": {
    "retrieval": 0.79,
    "rerank": 0.84,
    "grounding": 0.80,
    "answer_quality": 0.86
  },
  "sources": [
    {
      "source_id": "S1",
      "title": "Pricing",
      "url": "https://example.com/pricing",
      "section": "Pricing",
      "chunk_id": "abc123-0001",
      "rerank_score": 8.42
    }
  ]
}
```

### `GET /health`

Suggested response:

```json
{
  "status": "ok",
  "retrieval": "ready",
  "reranker": "ready",
  "generation": "ready"
}
```

### `GET /metrics`

Suggested response:

```json
{
  "queries_total": 128,
  "retrieval_fallbacks": 4,
  "reranker_status": "success",
  "average_confidence": 0.81
}
```

## Confidence Scoring

Confidence scoring is used to estimate whether the answer is well supported by the retrieved evidence.

### Components

- Retrieval confidence: derived from vector similarity and score spread.
- Rerank confidence: derived from the margin between the top reranked results.
- Grounding confidence: measures token-level overlap between the answer and the retrieved context.
- Answer quality confidence: penalizes empty, generic, or weakly grounded responses.

### Final Score

The project combines the components with a weighted sum:

```text
final_confidence =
  0.35 * retrieval +
  0.30 * rerank +
  0.20 * grounding +
  0.15 * answer_quality
```

Why it matters:

- helps surface low-trust answers
- improves observability in production
- supports fallback behavior and human review
- gives the user a clearer sense of answer reliability

## Deployment

### Local

- Run the CLI directly from the project root.
- Keep the Chroma directory and generated data on local disk.
- Use the default CPU-safe reranking configuration for development.

### Containerized

- The pipeline is container-friendly because it separates ingestion, indexing, retrieval, and generation concerns.
- Persist the vector DB directory and generated artifacts as mounted volumes.
- Inject the Gemini API key at runtime through environment variables.

### Production Notes

- Reranking is configured to be CPU-safe by default.
- Gemini handles final answer generation.
- The pipeline falls back safely when reranking is unavailable.
- The design favors lightweight, reproducible deployment over heavyweight orchestration.

## Screenshots

Add these when the UI layer is available:

- Frontend UI
- Retrieval debug panel
- Confidence scoring display

```text
![Frontend UI](docs/images/frontend-ui.png)
![Retrieval Debug Panel](docs/images/retrieval-debug-panel.png)
![Confidence Display](docs/images/confidence-display.png)
```

## Future Improvements

- Hybrid search with sparse + dense retrieval
- Streaming answer generation
- Citation highlighting in a UI
- Multi-modal RAG for images and PDFs
- Distributed or remote vector DB support
- Query rewriting and multi-hop retrieval
- More granular evaluation and tracing

## Testing

Run the test suite with:

```bash
python -m unittest discover -s tests
```

If you prefer `pytest`, install it locally and run:

```bash
pytest
```

## Contribution

Contributions are welcome.

Suggested workflow:

1. Fork the repository.
2. Create a feature branch.
3. Make focused, test-backed changes.
4. Run the test suite.
5. Open a pull request with a clear summary of the change.

## License

This repository snapshot does not currently include a `LICENSE` file.
If you plan to publish it publicly, add an explicit license such as MIT or Apache 2.0 before accepting external contributions.
