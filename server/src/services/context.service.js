const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

const RAG_ENGINE_DIR = path.resolve(__dirname, "../../../rag_engine");
const RAG_WEBSITES_DIR = path.join(RAG_ENGINE_DIR, "websites");
const REGISTRY_PATH = path.join(RAG_ENGINE_DIR, "context_registry.json");

const READY = "ready";
const INGESTING = "ingesting";
const DELETING = "deleting";
const FAILED = "failed";

function _sanitizeFolderName(name) {
  if (!name) return "site";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/\.+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function _normalizeUrl(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    let pathname = parsed.pathname || "/";
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${host}${pathname}${parsed.search}`;
  } catch {
    return url.trim();
  }
}

function _pythonExec() {
  const venvWin = path.join(RAG_ENGINE_DIR, ".venv/Scripts/python.exe");
  const venvPosix = path.join(RAG_ENGINE_DIR, ".venv/bin/python");
  if (fs.existsSync(venvWin)) return venvWin;
  if (fs.existsSync(venvPosix)) return venvPosix;
  return "python";
}

/** Background jobs: pythonw on Windows avoids a visible console window. */
function _pythonExecBackground() {
  if (process.platform === "win32") {
    const pythonw = path.join(RAG_ENGINE_DIR, ".venv/Scripts/pythonw.exe");
    if (fs.existsSync(pythonw)) return pythonw;
  }
  return _pythonExec();
}

const CREATE_NO_WINDOW =
  process.platform === "win32" ? 0x08000000 : 0;

function _spawnBackgroundOptions(logPath) {
  const logFd = fs.openSync(logPath, "a");
  const options = {
    cwd: RAG_ENGINE_DIR,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  };
  if (CREATE_NO_WINDOW) {
    options.creationFlags = CREATE_NO_WINDOW;
  }
  return options;
}

function _spawnSyncOptions() {
  const options = {
    cwd: RAG_ENGINE_DIR,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30 * 1000,
  };
  if (CREATE_NO_WINDOW) {
    options.creationFlags = CREATE_NO_WINDOW;
  }
  return options;
}

function _readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return {
      version: 1,
      contexts: [
        {
          id: "alian_default",
          name: "Alian Software",
          seed_url: "",
          status: READY,
          path: "data/indexes/chroma",
          is_default: true,
          is_deletable: false,
        },
      ],
    };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch {
    return { version: 1, contexts: [] };
  }
}

function _writeRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

function _mapEntry(entry) {
  const status = entry.status === "processing" ? INGESTING : entry.status;
  return {
    id: entry.id,
    name: entry.name || entry.id,
    seed_url: entry.seed_url || "",
    status,
    path: entry.path || "",
    isDefault: Boolean(entry.is_default),
    isDeletable: entry.is_deletable !== false && entry.id !== "alian_default",
  };
}

function ensureWebsitesDir() {
  if (!fs.existsSync(RAG_WEBSITES_DIR)) {
    fs.mkdirSync(RAG_WEBSITES_DIR, { recursive: true });
  }
}

function listContexts() {
  ensureWebsitesDir();
  const registry = _readRegistry();
  return (registry.contexts || []).map(_mapEntry);
}

function _findDuplicateSeedUrl(seedUrl) {
  const normalized = _normalizeUrl(seedUrl);
  return (listContexts() || []).find(
    (ctx) => ctx.seed_url && _normalizeUrl(ctx.seed_url) === normalized,
  );
}

function _isLocalOrPrivateHostname(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
    return true;
  }
  return false;
}

function _spawnDetached(args, logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const child = spawn(
    _pythonExecBackground(),
    args,
    _spawnBackgroundOptions(logPath),
  );
  child.unref();
}

function createContext(url) {
  ensureWebsitesDir();

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const error = new Error("Invalid URL");
    error.status = 400;
    throw error;
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    const error = new Error("Only http/https URLs allowed");
    error.status = 400;
    throw error;
  }
  if (_isLocalOrPrivateHostname(parsed.hostname)) {
    const error = new Error("Local or private hostnames are not allowed");
    error.status = 400;
    throw error;
  }

  const duplicate = _findDuplicateSeedUrl(url);
  if (duplicate) {
    const error = new Error(`URL already registered as context '${duplicate.id}'`);
    error.status = 409;
    throw error;
  }

  const suffix = crypto.randomBytes(4).toString("hex");
  const safe = _sanitizeFolderName(parsed.hostname || "site");
  const id = `${safe}_${suffix}`;
  const relPath = path.posix.join("websites", id);
  const ctxDir = path.join(RAG_WEBSITES_DIR, id);

  fs.mkdirSync(ctxDir, { recursive: true });
  for (const sub of ["raw", "chunks", "embeddings", "logs"]) {
    fs.mkdirSync(path.join(ctxDir, sub), { recursive: true });
  }

  const metadata = {
    id,
    name: parsed.hostname,
    url,
    seed_url: url,
    status: INGESTING,
    is_deletable: true,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(ctxDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );

  const registry = _readRegistry();
  registry.contexts = registry.contexts || [];
  registry.contexts.push({
    id,
    name: parsed.hostname,
    seed_url: url,
    status: INGESTING,
    path: relPath.replace(/\\/g, "/"),
    is_default: false,
    is_deletable: true,
  });
  _writeRegistry(registry);

  try {
    const logPath = path.join(ctxDir, "logs", "ingest.log");
    _spawnDetached(["-m", "src.website_contexts.ingest_cli", id, url], logPath);
  } catch {
    // ingestion may be retried manually; registry remains ingesting
  }

  return { contextId: id, status: INGESTING };
}

function getContextStatus(contextId) {
  if (contextId === "alian_default") return { status: READY, logPreview: null };

  const entry = listContexts().find((ctx) => ctx.id === contextId);
  if (!entry) return null;

  const logsDir = path.join(RAG_WEBSITES_DIR, contextId, "logs");
  let logPreview = null;
  try {
    if (fs.existsSync(logsDir)) {
      const files = fs
        .readdirSync(logsDir)
        .map((name) => ({
          name,
          mtime: fs.statSync(path.join(logsDir, name)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length > 0) {
        const latest = path.join(logsDir, files[0].name);
        logPreview = fs.readFileSync(latest, "utf8").slice(-4000);
      }
    }
  } catch {
    logPreview = null;
  }

  return { status: entry.status, logPreview };
}

function _updateRegistryStatus(contextId, status) {
  const registry = _readRegistry();
  registry.contexts = (registry.contexts || []).map((entry) =>
    entry.id === contextId ? { ...entry, status } : entry,
  );
  _writeRegistry(registry);
}

function deleteContext(contextId) {
  ensureWebsitesDir();
  if (contextId === "alian_default") {
    const error = new Error("Cannot delete default context");
    error.status = 400;
    throw error;
  }

  const ctxDir = path.join(RAG_WEBSITES_DIR, contextId);
  const resolved = path.resolve(ctxDir);
  const websitesRoot = path.resolve(RAG_WEBSITES_DIR);
  if (!resolved.startsWith(websitesRoot)) {
    const error = new Error("Unsafe delete path");
    error.status = 400;
    throw error;
  }
  if (!fs.existsSync(ctxDir)) {
    const error = new Error("Context not found");
    error.status = 404;
    throw error;
  }

  _updateRegistryStatus(contextId, DELETING);
  const metaFile = path.join(ctxDir, "metadata.json");
  if (fs.existsSync(metaFile)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
      meta.status = DELETING;
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), "utf8");
    } catch {
      // ignore metadata write errors
    }
  }

  const logsDir = path.join(ctxDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, "cleanup.log");

  try {
    const sync = spawnSync(
      _pythonExecBackground(),
      ["-m", "src.website_contexts.cleanup_cli", contextId],
      _spawnSyncOptions(),
    );
    const out = Buffer.isBuffer(sync.stdout) ? sync.stdout.toString("utf8") : "";
    const err = Buffer.isBuffer(sync.stderr) ? sync.stderr.toString("utf8") : "";
    fs.appendFileSync(logPath, `=== cleanup ===\n${out}\n${err}\n`, "utf8");
  } catch {
    // fall through to async cleanup
  }

  if (!fs.existsSync(ctxDir)) {
    return true;
  }

  try {
    fs.rmSync(ctxDir, { recursive: true, force: true });
    const registry = _readRegistry();
    registry.contexts = (registry.contexts || []).filter((entry) => entry.id !== contextId);
    _writeRegistry(registry);
    return true;
  } catch {
    _spawnDetached(["-m", "src.website_contexts.cleanup_cli", contextId], logPath);
    return true;
  }
}

module.exports = {
  listContexts,
  createContext,
  deleteContext,
  getContextStatus,
};
