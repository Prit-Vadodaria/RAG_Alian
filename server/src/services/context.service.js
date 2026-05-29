const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

// point to the top-level rag_engine directory in the workspace
const RAG_WEBSITES_DIR = path.resolve(
  __dirname,
  "../../../rag_engine/websites",
);

function _sanitizeFolderName(name) {
  if (!name) return "site";
  // replace invalid filesystem chars and collapse dots to dashes
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/\.+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function ensureWebsitesDir() {
  if (!fs.existsSync(RAG_WEBSITES_DIR))
    fs.mkdirSync(RAG_WEBSITES_DIR, { recursive: true });
}

function listContexts() {
  ensureWebsitesDir();
  const results = [];
  // Add default Alian context
  results.push({
    id: "alian_default",
    name: "Alian Software",
    isDefault: true,
    isDeletable: false,
    status: "ready",
  });
  const entries = fs.readdirSync(RAG_WEBSITES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const ctx = {
      id: entry.name,
      name: entry.name,
      isDefault: false,
      isDeletable: true,
      status: "ready",
    };
    const metaFile = path.join(RAG_WEBSITES_DIR, entry.name, "metadata.json");
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
        ctx.name = meta.name || ctx.name;
        ctx.status = meta.status || ctx.status;
        ctx.isDeletable =
          meta.is_deletable !== undefined ? meta.is_deletable : ctx.isDeletable;
      } catch (e) {}
    }
    results.push(ctx);
  }
  return results;
}

function _isLocalOrPrivateHostname(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname))
    return true;
  return false;
}

function createContext(url) {
  ensureWebsitesDir();
  // basic validation
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    const e = new Error("Invalid URL");
    e.status = 400;
    throw e;
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    const e = new Error("Only http/https URLs allowed");
    e.status = 400;
    throw e;
  }
  if (_isLocalOrPrivateHostname(parsed.hostname)) {
    const e = new Error("Local or private hostnames are not allowed");
    e.status = 400;
    throw e;
  }

  // generate readable folder id using hostname + short random suffix
  const suffix = crypto.randomBytes(4).toString("hex");
  const safe = _sanitizeFolderName(parsed.hostname || "site");
  const id = `${safe}_${suffix}`;
  const ctxDir = path.join(RAG_WEBSITES_DIR, id);
  fs.mkdirSync(ctxDir, { recursive: true });
  for (const sub of ["chroma", "raw_html", "cleaned_markdown", "chunks"]) {
    fs.mkdirSync(path.join(ctxDir, sub), { recursive: true });
  }
  const metadata = {
    id,
    name: parsed.hostname,
    url,
    status: "processing",
    is_deletable: true,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(ctxDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );

  // spawn ingestion in background: call into rag_engine website_ingestor.ingest_website
  try {
    // create logs dir for this context and redirect python output to a file
    const logsDir = path.join(ctxDir, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const outPath = path.join(logsDir, "ingest.log");
    const outStream = fs.createWriteStream(outPath, { flags: "a" });
    // prefer rag_engine virtualenv python if available
    const venvWin = path.resolve(
      __dirname,
      "../../../rag_engine/.venv/Scripts/python.exe",
    );
    const venvPosix = path.resolve(
      __dirname,
      "../../../rag_engine/.venv/bin/python",
    );
    const pythonExec = fs.existsSync(venvWin)
      ? venvWin
      : fs.existsSync(venvPosix)
        ? venvPosix
        : "python";
    const py = spawn(
      pythonExec,
      ["src/website_contexts/ingest_cli.py", id, parsed.hostname, url],
      {
        detached: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: path.resolve(__dirname, "../../../rag_engine"),
      },
    );
    if (py.stdout) py.stdout.pipe(outStream);
    if (py.stderr) py.stderr.pipe(outStream);
  } catch (err) {
    // Non-fatal: ingestion may be implemented later; keep metadata as 'processing'
  }

  return { contextId: id, status: "processing" };
}

function getContextStatus(contextId) {
  ensureWebsitesDir();
  if (contextId === "alian_default") return "ready";
  const metaFile = path.join(RAG_WEBSITES_DIR, contextId, "metadata.json");
  if (!fs.existsSync(metaFile)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    const status = meta.status || "ready";
    // look for recent log files under the sandbox logs/ directory
    const logsDir = path.join(RAG_WEBSITES_DIR, contextId, "logs");
    let logPreview = null;
    try {
      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir).map((f) => ({
          name: f,
          mtime: fs.statSync(path.join(logsDir, f)).mtimeMs,
        }));
        files.sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          const latest = path.join(logsDir, files[0].name);
          const content = fs.readFileSync(latest, "utf8");
          logPreview = content.slice(-4000); // last 4k chars
        }
      }
    } catch (e) {
      logPreview = null;
    }
    return { status, logPreview };
  } catch (err) {
    return "unknown";
  }
}

function deleteContext(contextId) {
  ensureWebsitesDir();
  if (contextId === "alian_default") {
    const e = new Error("Cannot delete default context");
    e.status = 400;
    throw e;
  }
  const ctxDir = path.join(RAG_WEBSITES_DIR, contextId);
  if (!fs.existsSync(ctxDir)) {
    const e = new Error("Context not found");
    e.status = 404;
    throw e;
  }

  // First, attempt to run the cleanup CLI synchronously to allow the Python
  // side to close DB handles gracefully before we attempt filesystem removal.
  try {
    const logsDir = path.join(ctxDir, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const outPath = path.join(logsDir, "cleanup.log");

    const venvWin = path.resolve(
      __dirname,
      "../../../rag_engine/.venv/Scripts/python.exe",
    );
    const venvPosix = path.resolve(
      __dirname,
      "../../../rag_engine/.venv/bin/python",
    );
    const pythonExec = fs.existsSync(venvWin)
      ? venvWin
      : fs.existsSync(venvPosix)
        ? venvPosix
        : "python";

    // Run cleanup CLI synchronously and capture output to the cleanup.log
    try {
      const sync = spawnSync(
        pythonExec,
        ["src/website_contexts/cleanup_cli.py", contextId],
        {
          cwd: path.resolve(__dirname, "../../../rag_engine"),
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 30 * 1000,
        },
      );

      try {
        const out = Buffer.isBuffer(sync.stdout)
          ? sync.stdout.toString("utf8")
          : "";
        const err = Buffer.isBuffer(sync.stderr)
          ? sync.stderr.toString("utf8")
          : "";
        fs.appendFileSync(
          outPath,
          `=== sync cleanup stdout ===\n${out}\n${err}\n`,
          "utf8",
        );
      } catch (e) {
        // ignore logging errors
      }
    } catch (e) {
      // synchronous cleanup failed or timed out; fall through to best-effort async cleanup
    }
  } catch (e) {
    // ignore log setup errors
  }

  // Try to delete immediately from the server process (fastest path)
  try {
    fs.rmSync(ctxDir, { recursive: true, force: true });
    return true;
  } catch (err) {
    // If immediate deletion still fails (locked files, permissions), spawn cleanup CLI in background
    try {
      const logsDir = path.join(ctxDir, "logs");
      fs.mkdirSync(logsDir, { recursive: true });
      const outPath = path.join(logsDir, "cleanup.log");
      const outStream = fs.createWriteStream(outPath, { flags: "a" });
      const venvWin = path.resolve(
        __dirname,
        "../../../rag_engine/.venv/Scripts/python.exe",
      );
      const venvPosix = path.resolve(
        __dirname,
        "../../../rag_engine/.venv/bin/python",
      );
      const pythonExec = fs.existsSync(venvWin)
        ? venvWin
        : fs.existsSync(venvPosix)
          ? venvPosix
          : "python";
      const py = spawn(
        pythonExec,
        ["src/website_contexts/cleanup_cli.py", contextId],
        {
          detached: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          cwd: path.resolve(__dirname, "../../../rag_engine"),
        },
      );
      if (py.stdout) py.stdout.pipe(outStream);
      if (py.stderr) py.stderr.pipe(outStream);
    } catch (e) {
      // give up silently; controller will handle error reporting
    }
  }

  return true;
}

module.exports = {
  listContexts,
  createContext,
  deleteContext,
  getContextStatus,
};
