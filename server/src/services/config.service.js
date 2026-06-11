const fs = require("fs");
const path = require("path");
const {
  DEFAULT_DAILY_TOKEN_LIMIT,
  DEFAULT_COOLDOWN_MINUTES,
  REGISTRATION_ENABLED,
} = require("../config/env");
const tokenService = require("./token.service");

const DATA_DIR = path.resolve(__dirname, "../../data");
const PLATFORM_CONFIG_PATH = path.join(DATA_DIR, "platform_config.json");

const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  updated_at: null,
  updated_by: null,
  registration: {
    enabled: REGISTRATION_ENABLED,
    require_approval: false,
  },
  quotas: {
    default_daily_token_limit: DEFAULT_DAILY_TOKEN_LIMIT,
    default_cooldown_minutes: DEFAULT_COOLDOWN_MINUTES,
  },
});

function _ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function _readConfig() {
  if (!fs.existsSync(PLATFORM_CONFIG_PATH)) {
    return _clone(DEFAULT_CONFIG);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PLATFORM_CONFIG_PATH, "utf8"));
    return {
      ..._clone(DEFAULT_CONFIG),
      ...parsed,
      registration: {
        ...DEFAULT_CONFIG.registration,
        ...(parsed.registration || {}),
      },
      quotas: {
        ...DEFAULT_CONFIG.quotas,
        ...(parsed.quotas || {}),
      },
    };
  } catch {
    return _clone(DEFAULT_CONFIG);
  }
}

function _writeConfig(config) {
  _ensureDataDir();
  fs.writeFileSync(PLATFORM_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

function _updatePersistedClientQuotas(changes) {
  if (Object.prototype.hasOwnProperty.call(changes, "quotas")) {
    tokenService.normalizeQuotaStorage();
    tokenService.clearQuotaCache();
  }
}

function ensureDefaultConfig() {
  const config = _readConfig();
  if (!fs.existsSync(PLATFORM_CONFIG_PATH)) {
    _writeConfig({
      ...config,
      updated_at: new Date().toISOString(),
      updated_by: "system",
    });
  }
  return config;
}

function getConfig() {
  return _readConfig();
}

function updateConfig(changes = {}, updatedBy = "system") {
  const current = _readConfig();
  const next = {
    ...current,
    ...changes,
    registration: {
      ...current.registration,
      ...(changes.registration || {}),
    },
    quotas: {
      ...current.quotas,
      ...(changes.quotas || {}),
    },
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  _writeConfig(next);
  _updatePersistedClientQuotas(changes);

  return next;
}

function getPublicConfig() {
  const config = _readConfig();
  return {
    registration: config.registration,
  };
}

module.exports = {
  PLATFORM_CONFIG_PATH,
  ensureDefaultConfig,
  getConfig,
  updateConfig,
  getPublicConfig,
};
