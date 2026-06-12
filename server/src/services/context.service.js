const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { deleteChatbotsByContext } = require("./chatbot.service");
const { DEFAULT_CLIENT_ID } = require("../config/env");
const configService = require("./config.service");
const promptSettingsService = require("./prompt-settings.service");

const RAG_ENGINE_DIR = path.resolve(__dirname, "../../../rag_engine");
const RAG_WEBSITES_DIR = path.join(RAG_ENGINE_DIR, "websites");
const REGISTRY_PATH = path.join(RAG_ENGINE_DIR, "context_registry.json");
const DEFAULT_CHUNKING = Object.freeze({
  maxChunkTokens: 120,
  minChunkTokens: 30,
  chunkOverlapTokens: 25,
});

const DISCOVERING = "discovering";
const PROCESSING_BATCH = "processing_batch";
const PARTIALLY_READY = "partially_ready";
const READY = "ready";
const PAUSED = "paused";
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

function _pythonExecBackground() {
  if (process.platform === "win32") {
    const pythonw = path.join(RAG_ENGINE_DIR, ".venv/Scripts/pythonw.exe");
    if (fs.existsSync(pythonw)) return pythonw;
  }
  return _pythonExec();
}

const CREATE_NO_WINDOW = process.platform === "win32" ? 0x08000000 : 0;

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
    return { version: 1, contexts: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    const contexts = Array.isArray(parsed.contexts)
      ? parsed.contexts.map((entry) => ({
          ...entry,
          client_id: Object.prototype.hasOwnProperty.call(entry, "client_id")
            ? entry.client_id === null || entry.client_id === undefined || String(entry.client_id).trim() === ""
              ? null
              : String(entry.client_id).trim()
            : String(DEFAULT_CLIENT_ID || "").trim() || null,
        }))
      : [];
    const normalized = {
      version: Number(parsed.version || 1),
      contexts,
    };
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      _writeRegistry(normalized);
    }
    return normalized;
  } catch {
    return { version: 1, contexts: [] };
  }
}

function _writeRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

function _readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function _normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "processing") return PROCESSING_BATCH;
  if (value === "ingesting") return DISCOVERING;
  if (value === "partial") return PARTIALLY_READY;
  if (value === "pause") return PAUSED;
  if ([DISCOVERING, PROCESSING_BATCH, PARTIALLY_READY, READY, PAUSED, FAILED, DELETING].includes(value)) {
    return value;
  }
  return value || DISCOVERING;
}

function _mapEntry(entry) {
  const hasClientId = Object.prototype.hasOwnProperty.call(entry, "client_id");
  const normalizedClientId = hasClientId
    ? entry.client_id === null || entry.client_id === undefined || String(entry.client_id).trim() === ""
      ? null
      : String(entry.client_id).trim()
    : String(DEFAULT_CLIENT_ID || "").trim() || null;
  return {
    id: entry.id,
    name: entry.name || entry.id,
    seed_url: entry.seed_url || "",
    client_id: normalizedClientId,
    status: _normalizeStatus(entry.status),
    path: entry.path || "",
    isDefault: Boolean(entry.is_default),
    isDeletable: entry.is_deletable !== false,
    chunking: _normalizeChunkingConfig(entry.chunking, DEFAULT_CHUNKING),
    total_urls: Number(entry.total_urls || 0),
    pending_urls: Number(entry.pending_urls || 0),
    processed_urls: Number(entry.processed_urls || 0),
    indexed_urls: Number(entry.indexed_urls || 0),
    failed_urls: Number(entry.failed_urls || 0),
    current_batch: Number(entry.current_batch || 0),
    total_batches: Number(entry.total_batches || 0),
    last_completed_batch: Number(entry.last_completed_batch || 0),
    stop_reason: String(entry.stop_reason || ""),
    ingestion_pid: Number.isFinite(Number(entry.ingestion_pid)) ? Number(entry.ingestion_pid) : null,
  };
}

function ensureWebsitesDir() {
  if (!fs.existsSync(RAG_WEBSITES_DIR)) {
    fs.mkdirSync(RAG_WEBSITES_DIR, { recursive: true });
  }
}

function _contextDir(contextId) {
  return path.join(RAG_WEBSITES_DIR, contextId);
}

function _resolveContextPath(contextId, fileName) {
  const ctxDir = path.resolve(_contextDir(contextId));
  const websitesRoot = path.resolve(RAG_WEBSITES_DIR);
  if (ctxDir !== websitesRoot && !ctxDir.startsWith(`${websitesRoot}${path.sep}`)) {
    const error = new Error("Unsafe context path");
    error.status = 400;
    throw error;
  }
  return path.join(ctxDir, fileName);
}

function _metadataPath(contextId) {
  return path.join(_contextDir(contextId), "metadata.json");
}

function _pauseFlagPath(contextId) {
  return path.join(_contextDir(contextId), "pause.flag");
}

function _isProcessRunning(pid) {
  const numericPid = Number(pid);
  if (!Number.isFinite(numericPid) || numericPid <= 0) return false;
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

function _updateMetadata(contextId, changes) {
  const metaPath = _metadataPath(contextId);
  let data = {};
  if (fs.existsSync(metaPath)) {
    try {
      data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch {
      data = {};
    }
  }
  data = { ...data, ...changes };
  fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), "utf8");
}

function _writeRegistryEntryStatus(contextId, status, extra = {}) {
  const registry = _readRegistry();
  registry.contexts = (registry.contexts || []).map((entry) =>
    entry.id === contextId ? { ...entry, status, ...extra } : entry,
  );
  _writeRegistry(registry);
}

function _matchesClientScope(entry, clientId) {
  if (clientId === null) return true;
  const normalized = String(clientId || "").trim();
  if (!normalized) return true;
  return String(entry.client_id || "").trim() === normalized;
}

function listContexts(clientId = null) {
  ensureWebsitesDir();
  const registry = _readRegistry();
  return (registry.contexts || [])
    .map(_mapEntry)
    .filter((entry) => _matchesClientScope(entry, clientId));
}

function getContext(contextId, clientId = null) {
  return listContexts(clientId).find((context) => context.id === contextId) || null;
}

function _findDuplicateSeedUrl(seedUrl, clientId = null) {
  const normalized = _normalizeUrl(seedUrl);
  return listContexts(clientId).find((ctx) => ctx.seed_url && _normalizeUrl(ctx.seed_url) === normalized);
}

function _isLocalOrPrivateHostname(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
    return true;
  }
  return false;
}

function _coerceInt(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function _normalizeChunkingConfig(chunking, fallback = DEFAULT_CHUNKING) {
  const base = fallback || DEFAULT_CHUNKING;
  const maxChunkTokens = Math.max(100, _coerceInt(chunking?.maxChunkTokens, base.maxChunkTokens));
  let minChunkTokens = Math.max(20, _coerceInt(chunking?.minChunkTokens, base.minChunkTokens));
  let chunkOverlapTokens = Math.max(0, _coerceInt(chunking?.chunkOverlapTokens, base.chunkOverlapTokens));

  if (minChunkTokens >= maxChunkTokens) {
    minChunkTokens = Math.max(20, maxChunkTokens - 1);
  }
  if (chunkOverlapTokens >= maxChunkTokens) {
    chunkOverlapTokens = Math.max(0, maxChunkTokens - 1);
  }

  return {
    maxChunkTokens,
    minChunkTokens,
    chunkOverlapTokens,
  };
}

function _spawnDetached(args, logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const child = spawn(_pythonExecBackground(), args, _spawnBackgroundOptions(logPath));
  child.unref();
  return child.pid;
}

function _refreshRegistryContext(contextId, changes) {
  const registry = _readRegistry();
  registry.contexts = (registry.contexts || []).map((entry) =>
    entry.id === contextId ? { ...entry, ...changes } : entry,
  );
  _writeRegistry(registry);
}

function createContext(url, options = {}, clientId = null) {
  ensureWebsitesDir();
  const normalizedClientId = clientId === null ? null : String(clientId || "").trim() || null;
  if (normalizedClientId) {
    const config = configService.getConfig();
    const maxContexts = Math.max(0, Number(config?.registration?.max_contexts_per_client ?? 0) || 0);
    if (maxContexts > 0) {
      const currentCount = listContexts(normalizedClientId).length;
      if (currentCount >= maxContexts) {
        const error = new Error(`Maximum website contexts per user reached (${maxContexts}).`);
        error.status = 403;
        throw error;
      }
    }
  }

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

  const duplicate = _findDuplicateSeedUrl(url, normalizedClientId);
  if (duplicate) {
    const error = new Error(`URL already registered as context '${duplicate.id}' in your workspace`);
    error.status = 409;
    throw error;
  }

  const suffix = crypto.randomBytes(4).toString("hex");
  const safe = _sanitizeFolderName(parsed.hostname || "site");
  const id = `${safe}_${suffix}`;
  const relPath = path.posix.join("websites", id);
  const ctxDir = path.join(RAG_WEBSITES_DIR, id);
  const chunking = _normalizeChunkingConfig(options.chunking, DEFAULT_CHUNKING);

  fs.mkdirSync(ctxDir, { recursive: true });
  for (const sub of ["raw", "chunks", "embeddings", "logs", "cleaned_markdown", "structured_docs"]) {
    fs.mkdirSync(path.join(ctxDir, sub), { recursive: true });
  }

  const metadata = {
    id,
    name: parsed.hostname,
    url,
    seed_url: url,
    client_id: normalizedClientId,
    status: DISCOVERING,
    is_deletable: true,
    chunking,
    created_at: new Date().toISOString(),
    total_urls: 0,
    pending_urls: 0,
    processed_urls: 0,
    indexed_urls: 0,
    failed_urls: 0,
    current_batch: 0,
    total_batches: 0,
    last_completed_batch: 0,
    stop_reason: "",
    ingestion_pid: null,
  };
  fs.writeFileSync(path.join(ctxDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");

  const registry = _readRegistry();
  registry.contexts = registry.contexts || [];
  registry.contexts.push({
    id,
    name: parsed.hostname,
    seed_url: url,
    client_id: normalizedClientId,
    status: DISCOVERING,
    path: relPath.replace(/\\/g, "/"),
    is_default: false,
    is_deletable: true,
    chunking,
    total_urls: 0,
    pending_urls: 0,
    processed_urls: 0,
    indexed_urls: 0,
    failed_urls: 0,
    current_batch: 0,
    total_batches: 0,
    last_completed_batch: 0,
    stop_reason: "",
    ingestion_pid: null,
  });
  _writeRegistry(registry);

  try {
    const logPath = path.join(ctxDir, "logs", "ingest.log");
    const pid = _spawnDetached(["-m", "src.website_contexts.ingest_cli", id, url], logPath);
    _refreshRegistryContext(id, { ingestion_pid: pid, status: DISCOVERING });
    _updateMetadata(id, { ingestion_pid: pid, status: DISCOVERING });
  } catch {
    // ingestion may be retried manually; registry remains discovering
  }

  return { contextId: id, status: DISCOVERING };
}

function getContextDefaults() {
  return {
    chunking: { ...DEFAULT_CHUNKING },
  };
}

function getContextStatus(contextId, clientId = null) {
  const entry = getContext(contextId, clientId);
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

  return {
    status: entry.status,
    logPreview,
    progress: {
      total_urls: Number(entry.total_urls || 0),
      pending_urls: Number(entry.pending_urls || 0),
      processed_urls: Number(entry.processed_urls || 0),
      indexed_urls: Number(entry.indexed_urls || 0),
      failed_urls: Number(entry.failed_urls || 0),
      current_batch: Number(entry.current_batch || 0),
      total_batches: Number(entry.total_batches || 0),
      last_completed_batch: Number(entry.last_completed_batch || 0),
      stop_reason: String(entry.stop_reason || ""),
    },
  };
}

function _updateRegistryStatus(contextId, status) {
  const registry = _readRegistry();
  registry.contexts = (registry.contexts || []).map((entry) =>
    entry.id === contextId ? { ...entry, status } : entry,
  );
  _writeRegistry(registry);
}

function _assertContextOwnership(entry, clientId) {
  if (!entry) return false;
  if (clientId === null) return true;
  const normalized = String(clientId || "").trim();
  if (!normalized) return true;
  return String(entry.client_id || "").trim() === normalized;
}

function pauseContext(contextId, clientId = null) {
  ensureWebsitesDir();
  const ctxDir = _contextDir(contextId);
  if (!fs.existsSync(ctxDir)) {
    const error = new Error("Context not found");
    error.status = 404;
    throw error;
  }

  const entry = getContext(contextId, clientId);
  if (!entry || !_assertContextOwnership(entry, clientId)) {
    const error = new Error("Context not found");
    error.status = 404;
    throw error;
  }

  fs.mkdirSync(path.dirname(_pauseFlagPath(contextId)), { recursive: true });
  fs.writeFileSync(_pauseFlagPath(contextId), new Date().toISOString(), "utf8");
  _updateRegistryStatus(contextId, PAUSED);
  _updateMetadata(contextId, { status: PAUSED });
  return getContextStatus(contextId, clientId);
}

function resumeContext(contextId, clientId = null) {
  ensureWebsitesDir();
  const entry = getContext(contextId, clientId);
  if (!entry) {
    const error = new Error("Context not found");
    error.status = 404;
    throw error;
  }
  if (!_assertContextOwnership(entry, clientId)) {
    const error = new Error("Context not found");
    error.status = 404;
    throw error;
  }

  const ctxDir = _contextDir(contextId);
  if (!fs.existsSync(ctxDir)) {
    const error = new Error("Context directory missing");
    error.status = 404;
    throw error;
  }

  if (fs.existsSync(_pauseFlagPath(contextId))) {
    fs.unlinkSync(_pauseFlagPath(contextId));
  }

  if (!_isProcessRunning(entry.ingestion_pid)) {
    const logPath = path.join(ctxDir, "logs", "ingest.log");
    const pid = _spawnDetached(["-m", "src.website_contexts.ingest_cli", contextId, entry.seed_url || entry.url || ""], logPath);
    _refreshRegistryContext(contextId, { ingestion_pid: pid, status: PROCESSING_BATCH });
    _updateMetadata(contextId, { ingestion_pid: pid, status: PROCESSING_BATCH });
  } else {
    _refreshRegistryContext(contextId, { status: PROCESSING_BATCH });
    _updateMetadata(contextId, { status: PROCESSING_BATCH });
  }

  return getContextStatus(contextId, clientId);
}

function deleteContext(contextId, clientId = null) {
  ensureWebsitesDir();
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

  const entry = getContext(contextId, clientId);
  if (!entry || !_assertContextOwnership(entry, clientId)) {
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
    deleteChatbotsByContext(contextId, clientId);
  } catch {
    // Best-effort: context cleanup should continue even if chatbot cleanup fails.
  }

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

function getContextPromptSettings(contextId) {
  const filePath = _resolveContextPath(contextId, "prompt_settings.json");
  const settings = _readJson(filePath, null);
  return settings && typeof settings === "object" ? settings : null;
}

function setContextPromptSettings(contextId, settings = {}) {
  const entry = getContext(contextId, null);
  if (!entry) {
    const error = new Error("Context not found");
    error.status = 404;
    throw error;
  }

  const validation = promptSettingsService.validatePromptSettings(settings);
  if (!validation.valid) {
    const error = new Error(validation.error || "Invalid prompt settings.");
    error.status = 400;
    throw error;
  }

  const filePath = _resolveContextPath(contextId, "prompt_settings.json");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
  return settings;
}

function deleteContextPromptSettings(contextId) {
  try {
    const filePath = _resolveContextPath(contextId, "prompt_settings.json");
    if (!fs.existsSync(filePath)) {
      return false;
    }
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  listContexts,
  getContext,
  createContext,
  deleteContext,
  getContextStatus,
  getContextDefaults,
  pauseContext,
  resumeContext,
  getContextPromptSettings,
  setContextPromptSettings,
  deleteContextPromptSettings,
};
