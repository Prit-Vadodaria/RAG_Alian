const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data");
const CLIENT_PROMPTS_DIR = path.join(DATA_DIR, "client_prompts");
const SEED_SETTINGS_PATH = path.resolve(__dirname, "../../../rag_engine/prompt_settings.json");

function _clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function _ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

function _writeJson(filePath, data) {
  _ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function _normalizeConstraints(constraints) {
  if (!Array.isArray(constraints)) {
    return [];
  }
  return constraints
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function _normalizeRole(role) {
  return typeof role === "string" ? role.trim() : "";
}

function validatePromptSettings(settings) {
  const role = _normalizeRole(settings?.role);
  if (!role) {
    return { valid: false, error: "Role cannot be empty." };
  }

  if (!Array.isArray(settings?.constraints) || settings.constraints.length === 0) {
    return { valid: false, error: "Constraints cannot be empty." };
  }

  const hasBlankEntries = settings.constraints.some(
    (constraint) => typeof constraint !== "string" || !constraint.trim(),
  );
  if (hasBlankEntries) {
    return { valid: false, error: "Constraints cannot contain blank entries." };
  }

  return { valid: true, error: null };
}

function _normalizeSettingsPayload(settings = {}, base = {}) {
  const payload = {
    ...base,
    ...settings,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "role")) {
    payload.role = _normalizeRole(payload.role);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "constraints")) {
    payload.constraints = _normalizeConstraints(payload.constraints);
  }

  return payload;
}

function _resolveClientPromptSettingsPath(clientId) {
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedClientId) {
    const error = new Error("clientId is required.");
    error.status = 400;
    throw error;
  }

  const resolved = path.resolve(CLIENT_PROMPTS_DIR, `${normalizedClientId}.json`);
  const baseResolved = path.resolve(CLIENT_PROMPTS_DIR);
  if (resolved !== baseResolved && !resolved.startsWith(`${baseResolved}${path.sep}`)) {
    const error = new Error("Unsafe client prompt settings path.");
    error.status = 400;
    throw error;
  }

  return resolved;
}

function _resolveSeedSettingsPath() {
  return SEED_SETTINGS_PATH;
}

function ensureClientPromptSettingsDir() {
  fs.mkdirSync(CLIENT_PROMPTS_DIR, { recursive: true });
}

function getSeedPromptSettings() {
  const filePath = _resolveSeedSettingsPath();
  const settings = _readJson(filePath, null);
  return settings && typeof settings === "object" ? settings : null;
}

function setSeedPromptSettings(settings = {}, { changedBy = "api" } = {}) {
  const current = getSeedPromptSettings() || {};
  const merged = {
    ...current,
    ...settings,
  };
  const validation = validatePromptSettings(merged);
  if (!validation.valid) {
    const error = new Error(validation.error || "Invalid prompt settings.");
    error.status = 400;
    throw error;
  }

  const next = _normalizeSettingsPayload(settings, current);

  const payload = {
    ...next,
    last_modified: new Date().toISOString(),
    last_modified_by: changedBy,
  };

  _writeJson(_resolveSeedSettingsPath(), payload);
  return payload;
}

function getClientPromptSettings(clientId) {
  ensureClientPromptSettingsDir();
  const filePath = _resolveClientPromptSettingsPath(clientId);
  const settings = _readJson(filePath, null);
  return settings && typeof settings === "object" ? settings : null;
}

function clientPromptSettingsExist(clientId) {
  try {
    return fs.existsSync(_resolveClientPromptSettingsPath(clientId));
  } catch {
    return false;
  }
}

function initClientPromptSettings(clientId) {
  ensureClientPromptSettingsDir();
  const seedSettings = getSeedPromptSettings();
  if (!seedSettings) {
    return null;
  }

  const filePath = _resolveClientPromptSettingsPath(clientId);
  const payload = _clone(seedSettings);
  _writeJson(filePath, payload);
  return payload;
}

function setClientPromptSettings(clientId, settings = {}) {
  ensureClientPromptSettingsDir();
  const filePath = _resolveClientPromptSettingsPath(clientId);
  const base = _readJson(filePath, getSeedPromptSettings() || {});
  const merged = {
    ...(base || {}),
    ...settings,
  };
  const validation = validatePromptSettings(merged);
  if (!validation.valid) {
    const error = new Error(validation.error || "Invalid prompt settings.");
    error.status = 400;
    throw error;
  }

  const next = _normalizeSettingsPayload(settings, base || {});

  _writeJson(filePath, next);
  return next;
}

function deleteClientPromptSettings(clientId) {
  try {
    const filePath = _resolveClientPromptSettingsPath(clientId);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

ensureClientPromptSettingsDir();

module.exports = {
  ensureClientPromptSettingsDir,
  validatePromptSettings,
  getSeedPromptSettings,
  setSeedPromptSettings,
  getClientPromptSettings,
  setClientPromptSettings,
  initClientPromptSettings,
  deleteClientPromptSettings,
  clientPromptSettingsExist,
};
