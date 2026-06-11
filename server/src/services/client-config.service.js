const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const tokenService = require("./token.service");

const DATA_DIR = path.resolve(__dirname, "../../data");
const CLIENT_CONFIGS_PATH = path.join(DATA_DIR, "client_configs.json");

const ENCRYPTION_KEY = String(process.env.CONFIG_ENCRYPTION_KEY || "").trim();
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;

const DEFAULT_GEN_CONFIG = Object.freeze({
  googleApiKey: "",
  model: "gemini-2.5-flash",
  timeoutSeconds: 60,
  temperature: 0.2,
  maxOutputTokens: 512,
  maxRetries: 5,
  retryBackoff: 2.0,
  dailyTokenLimit: 0,
  configuredAt: null,
  configuredBy: null,
});

const DEFAULT_STATE = Object.freeze({ version: 1, clients: {} });
let _warnedAboutPlaintext = false;

function _ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function _logPlaintextWarning() {
  if (_warnedAboutPlaintext || ENCRYPTION_KEY) return;
  _warnedAboutPlaintext = true;
  console.warn(
    "[client-config] CONFIG_ENCRYPTION_KEY is not set; client API keys will be stored without encryption in local development.",
  );
}

function _deriveKey() {
  if (!ENCRYPTION_KEY) return null;
  return crypto.scryptSync(ENCRYPTION_KEY, "client-config-salt", KEY_LENGTH);
}

function _encrypt(plaintext) {
  const value = String(plaintext || "");
  if (!value) {
    return "";
  }

  const key = _deriveKey();
  if (!key) {
    _logPlaintextWarning();
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function _decrypt(value) {
  const raw = String(value || "");
  if (!raw) {
    return "";
  }

  if (!raw.startsWith("enc:")) {
    _logPlaintextWarning();
    return raw;
  }

  const key = _deriveKey();
  if (!key) {
    return "";
  }

  const parts = raw.split(":");
  if (parts.length !== 4) {
    return "";
  }

  try {
    const iv = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    const encrypted = Buffer.from(parts[3], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function _readState() {
  if (!fs.existsSync(CLIENT_CONFIGS_PATH)) {
    return _clone(DEFAULT_STATE);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(CLIENT_CONFIGS_PATH, "utf8"));
    const clients = parsed?.clients && typeof parsed.clients === "object" ? parsed.clients : {};
    return {
      version: Number(parsed?.version || 1),
      clients,
    };
  } catch {
    return _clone(DEFAULT_STATE);
  }
}

function _writeState(state) {
  _ensureDataDir();
  fs.writeFileSync(CLIENT_CONFIGS_PATH, JSON.stringify(state, null, 2), "utf8");
}

function _normalizeRecord(clientId, raw = {}) {
  const configuredAt = raw.configuredAt || raw.configured_at || null;
  const configuredBy = raw.configuredBy || raw.configured_by || null;
  return {
    clientId: String(clientId || "").trim(),
    googleApiKey: String(raw.googleApiKey || raw.google_api_key || ""),
    model: String(raw.model || DEFAULT_GEN_CONFIG.model).trim() || DEFAULT_GEN_CONFIG.model,
    timeoutSeconds: Math.max(10, Number(raw.timeoutSeconds || raw.timeout_seconds || DEFAULT_GEN_CONFIG.timeoutSeconds) || DEFAULT_GEN_CONFIG.timeoutSeconds),
    temperature: Math.min(
      2.0,
      Math.max(0.0, Number(raw.temperature ?? DEFAULT_GEN_CONFIG.temperature)),
    ),
    maxOutputTokens: Math.max(
      64,
      Number(raw.maxOutputTokens || raw.max_output_tokens || DEFAULT_GEN_CONFIG.maxOutputTokens) || DEFAULT_GEN_CONFIG.maxOutputTokens,
    ),
    maxRetries: Math.max(
      1,
      Number(raw.maxRetries || raw.max_retries || DEFAULT_GEN_CONFIG.maxRetries) || DEFAULT_GEN_CONFIG.maxRetries,
    ),
    retryBackoff: Math.max(
      0.5,
      Number(raw.retryBackoff || raw.retry_backoff || DEFAULT_GEN_CONFIG.retryBackoff) || DEFAULT_GEN_CONFIG.retryBackoff,
    ),
    dailyTokenLimit: Math.max(
      0,
      Number(raw.dailyTokenLimit || raw.daily_token_limit || 0) || 0,
    ),
    configuredAt,
    configuredBy,
  };
}

function _serializeRecord(record) {
  return {
    clientId: record.clientId,
    googleApiKey: record.googleApiKey,
    model: record.model,
    timeoutSeconds: record.timeoutSeconds,
    temperature: record.temperature,
    maxOutputTokens: record.maxOutputTokens,
    maxRetries: record.maxRetries,
    retryBackoff: record.retryBackoff,
    dailyTokenLimit: record.dailyTokenLimit,
    configuredAt: record.configuredAt,
    configuredBy: record.configuredBy,
  };
}

function getClientConfig(clientId) {
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedClientId) {
    return null;
  }

  const state = _readState();
  const raw = state.clients[normalizedClientId];
  if (!raw) {
    return null;
  }

  const record = _normalizeRecord(normalizedClientId, raw);
  record.googleApiKey = _decrypt(record.googleApiKey);
  return _serializeRecord(record);
}

function setClientConfig(clientId, updates = {}, { changedBy = "api" } = {}) {
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedClientId) {
    throw new Error("clientId is required.");
  }

  const state = _readState();
  const existing = state.clients[normalizedClientId] || {};
  const normalizedExisting = _normalizeRecord(normalizedClientId, existing);
  const next = {
    ...normalizedExisting,
    ...Object.fromEntries(
      Object.entries(updates || {}).filter(([key, value]) => value !== undefined && key !== "googleApiKey"),
    ),
    configuredAt: new Date().toISOString(),
    configuredBy: changedBy,
  };

  if (Object.prototype.hasOwnProperty.call(updates, "googleApiKey")) {
    const incoming = String(updates.googleApiKey || "").trim();
    if (incoming) {
      next.googleApiKey = _encrypt(incoming);
    } else if (normalizedExisting.googleApiKey) {
      next.googleApiKey = normalizedExisting.googleApiKey;
    } else {
      next.googleApiKey = "";
    }
  } else {
    next.googleApiKey = normalizedExisting.googleApiKey;
  }

  next.model = String((updates.model ?? normalizedExisting.model) || DEFAULT_GEN_CONFIG.model).trim() || DEFAULT_GEN_CONFIG.model;
  next.timeoutSeconds = Math.max(
    10,
    Number(updates.timeoutSeconds ?? normalizedExisting.timeoutSeconds ?? DEFAULT_GEN_CONFIG.timeoutSeconds) || DEFAULT_GEN_CONFIG.timeoutSeconds,
  );
  next.temperature = Math.min(
    2.0,
    Math.max(0.0, Number(updates.temperature ?? normalizedExisting.temperature ?? DEFAULT_GEN_CONFIG.temperature)),
  );
  next.maxOutputTokens = Math.max(
    64,
    Number(updates.maxOutputTokens ?? normalizedExisting.maxOutputTokens ?? DEFAULT_GEN_CONFIG.maxOutputTokens) || DEFAULT_GEN_CONFIG.maxOutputTokens,
  );
  next.maxRetries = Math.max(
    1,
    Number(updates.maxRetries ?? normalizedExisting.maxRetries ?? DEFAULT_GEN_CONFIG.maxRetries) || DEFAULT_GEN_CONFIG.maxRetries,
  );
  next.retryBackoff = Math.max(
    0.5,
    Number(updates.retryBackoff ?? normalizedExisting.retryBackoff ?? DEFAULT_GEN_CONFIG.retryBackoff) || DEFAULT_GEN_CONFIG.retryBackoff,
  );
  next.dailyTokenLimit = Math.max(
    0,
    Number(updates.dailyTokenLimit ?? normalizedExisting.dailyTokenLimit ?? 0) || 0,
  );

  state.clients[normalizedClientId] = _serializeRecord(next);
  _writeState(state);

  if (Object.prototype.hasOwnProperty.call(updates, "dailyTokenLimit")) {
    tokenService.applyClientDailyLimit(normalizedClientId, next.dailyTokenLimit);
  }

  return getClientConfig(normalizedClientId);
}

function clientConfigExists(clientId) {
  const config = getClientConfig(clientId);
  return Boolean(config && config.googleApiKey);
}

function deleteClientConfig(clientId) {
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedClientId) return false;

  const state = _readState();
  if (!Object.prototype.hasOwnProperty.call(state.clients, normalizedClientId)) {
    return false;
  }

  delete state.clients[normalizedClientId];
  _writeState(state);
  return true;
}

function getPublicClientConfig(clientId) {
  const config = getClientConfig(clientId);
  if (!config) {
    return null;
  }

  return {
    ...config,
    googleApiKey: config.googleApiKey ? "***configured***" : "",
    hasApiKey: Boolean(config.googleApiKey),
  };
}

function listClientConfigs() {
  const state = _readState();
  return Object.keys(state.clients || {})
    .sort()
    .map((clientId) => getPublicClientConfig(clientId))
    .filter(Boolean);
}

module.exports = {
  CLIENT_CONFIGS_PATH,
  DEFAULT_GEN_CONFIG,
  getClientConfig,
  setClientConfig,
  clientConfigExists,
  deleteClientConfig,
  getPublicClientConfig,
  listClientConfigs,
};
