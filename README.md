# RAG_Alian — Website RAG Platform

> Full-stack Retrieval-Augmented Generation (RAG) project combining a Python website ingestion & RAG engine, an Express API gateway, and a React frontend.

## Key Features

- Website ingestion, HTML-to-markdown cleaning, and deterministic chunking (see `rag_engine`).
- Embeddings via SentenceTransformers and persistent vector store with ChromaDB (`rag_engine`).
- CPU-safe reranking, grounded prompt construction, and confidence scoring for answers (`rag_engine`).
- Express API gateway exposing auth, chat, contexts, chatbots, admin and public chat endpoints (`server`).
- React + Vite frontend for admin/chat UI and configuration (`frontend`).

## Tech Stack / Dependencies

- Frontend: React 19, Vite, Tailwind CSS, Zustand, Axios. See [frontend/package.json](frontend/package.json).
- Server: Node.js, Express 5, CORS, dotenv, Morgan. See [server/package.json](server/package.json).
- RAG engine: Python with `sentence-transformers`, `chromadb`, `playwright`, `fastapi`, and other ingestion libraries. See [rag_engine/requirements.txt](rag_engine/requirements.txt) and [rag_engine/README.md](rag_engine/README.md).

## Repository Layout

```
.
├── frontend/            # React + Vite frontend application
├── server/              # Express API gateway (routes in server/src/routes)
├── rag_engine/          # Python Website RAG pipeline and CLI tooling
├── implemenationplan.md # Frontend audit notes
└── data/                # JSON fixtures used by the server (clients, chatbots, etc.)
```

Key places to inspect:
- Frontend config and scripts: [frontend/package.json](frontend/package.json)
- Server entry: [server/src/server.js](server/src/server.js) and Express app at [server/src/app.js](server/src/app.js)
- RAG engine documentation and usage: [rag_engine/README.md](rag_engine/README.md)

## Installation & Setup

Prerequisites:
- Node.js (for `frontend` and `server`)
- Python 3.9+ (for `rag_engine`)
- Git

1. Clone the repository

```bash
git clone <your-repo-url>
cd RAG_Alian
```

2. Setup and run the RAG engine (Python)

```bash
cd rag_engine
python -m venv .venv
.venv\Scripts\activate    # Windows
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium
```

3. Setup the server (Express gateway)

```bash
cd ../server
npm install
```

4. Setup the frontend

```bash
cd ../frontend
npm install
```

## Configuration / Environment

The server reads configuration from a `.env` file at the repository root. Important environment variables (declared in [server/src/config/env.js](server/src/config/env.js)):

- `PORT` — Express server port (default `5000`).
- `FASTAPI_BASE_URL` — URL of the RAG engine API (default `http://127.0.0.1:8000/api`).
- `FASTAPI_TIMEOUT_MS` — timeout for FastAPI requests in ms.
- `AUTH_ENABLED` — enable/disable auth (`true`/`false`).
- `REGISTRATION_ENABLED` — allow registration (`true`/`false`).
- `DEFAULT_CLIENT_ID` — default seeded client id.
- `DEFAULT_DAILY_TOKEN_LIMIT` — default daily token limit for clients.
- `OWNER_API_KEY` — optional owner API key.
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` — seeded admin credentials.
- `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS` — JWT signing settings.

The RAG engine also expects typical variables for model/generation backends (see `rag_engine/README.md` for examples such as `GOOGLE_API_KEY`, `GOOGLE_MODEL`, `CHROMA_DIR`, `RERANKER_MODEL`).

## How to Run

1. Start the RAG engine API (FastAPI) — if you want the full pipeline available:

```bash
cd rag_engine
# ensure .venv activated
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

2. Start the Express server (API gateway):

```bash
cd server
npm run dev    # uses nodemon
```

3. Start the frontend (developer server):

```bash
cd frontend
npm run dev
```

Notes:
- The Express gateway proxies requests to the RAG engine using `FASTAPI_BASE_URL` (set in `.env`).
- The frontend expects the API gateway at `http://localhost:5000` by default (CORS configured for Vite dev origin).

## API Endpoints (Express Gateway)

The server organizes routes under `/api/*` and also exposes a `/public` route. Major route groups (see `server/src/routes/`):

- `GET /api/health` — health check (`server/src/routes/health.routes.js`).
- `POST /api/chat` — authenticated chat endpoint (wraps RAG engine) (`server/src/routes/chat.routes.js`).
- `POST /public/chat` — rate-limited public chat endpoint (`server/src/routes/public.routes.js`).
- `POST /api/auth/login` and `POST /api/auth/signup` — authentication endpoints (`server/src/routes/auth.routes.js`).
- `GET /api/chatbots` and `/api/chatbots/:chatbotId` — manage chatbots (`server/src/routes/chatbot.routes.js`).
- `GET /api/contexts` and context management endpoints (`server/src/routes/context.routes.js`).
- `GET /api/ai-config` / `PUT /api/ai-config` — AI configuration (`server/src/routes/ai-config.routes.js`).
- `GET /api/dashboard/summary` and usage endpoints (`server/src/routes/dashboard.routes.js`).
- Admin endpoints under `/api/admin/*` require admin privileges (`server/src/routes/admin.routes.js`).

For full route details see the files in [server/src/routes](server/src/routes).

## Usage Examples

Health check:

```bash
curl http://localhost:5000/api/health
```

Authenticated chat (example payload):

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"query":"What pricing plans are available?","top_k":5}'
```

Public chatbot chat (rate-limited):

```bash
curl -X POST http://localhost:5000/public/chat \
  -H "Content-Type: application/json" \
  -d '{"chatbotId":"my_bot","query":"Help me"}'
```

For RAG engine CLI and pipeline commands see [rag_engine/README.md](rag_engine/README.md).

## Testing

- Python RAG engine tests:

```bash
cd rag_engine
python -m unittest discover -s tests
```

- Server unit test example (uses Node's built-in test runner in test files):

```bash
node --test server/test/client-config.service.test.js
```

## Contributing

- Fork the repository and open PRs against the `main` branch.
- Run linters and tests locally before submitting changes:
  - Frontend lint: `cd frontend && npm run lint`
  - Server dev: `cd server && npm run dev`
  - RAG engine tests: `cd rag_engine && python -m unittest discover -s tests`
- Document API changes and update `implemenationplan.md` or add `docs/` entries.

## License

Not specified in the repository.

---

For component-level architecture and pipeline details see `rag_engine/README.md` and the Express routes under `server/src/routes`.
