const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  DEFAULT_CLIENT_ID,
  DEFAULT_DAILY_TOKEN_LIMIT,
  DEFAULT_COOLDOWN_MINUTES,
} = require("../config/env");

const DATA_DIR = path.resolve(__dirname, "../../../data");
const TOKEN_EVENTS_PATH = path.join(DATA_DIR, "token_events.json");
const DAILY_USAGE_PATH = path.join(DATA_DIR, "daily_usage.json");
const QUOTA_STATE_PATH = path.join(DATA_DIR, "quota_state.json");

const DEFAULT_TOKEN_EVENTS_STATE = Object.freeze({
  version: 1,
  events: [],
});

const DEFAULT_DAILY_USAGE_STATE = Object.freeze({
  version: 1,
  days: {},
});

const DEFAULT_QUOTA_STATE = Object.freeze({
  version: 1,
  clients: {},
});

const CACHE_TTL_MS = 10_000;
const _quotaCache = new Map();

function _ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _readJson(filePath, fallbackState) {
  if (!fs.existsSync(filePath)) {
    return _clone(fallbackState);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? parsed
      : _clone(fallbackState);
  } catch {
    return _clone(fallbackState);
  }
}

function _writeJson(filePath, data) {
  _ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function _clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function _bucketDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function _bucketHour(date = new Date()) {
  return date.getUTCHours();
}

function _toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function _toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function _normalizeClientId(clientId) {
  const value = String(clientId || "").trim();
  return value || DEFAULT_CLIENT_ID || "client_owner";
}

function _normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["active", "limited", "cooldown", "suspended"].includes(value)) {
    return value;
  }
  return "active";
}

function _normalizeQuotaClient(clientId, raw = {}) {
  const now = new Date().toISOString();
  return {
    client_id: _normalizeClientId(raw.client_id || clientId),
    plan_name: String(raw.plan_name || "default").trim() || "default",
    daily_limit: _toPositiveNumber(raw.daily_limit, DEFAULT_DAILY_TOKEN_LIMIT),
    cooldown_duration_minutes: _toPositiveNumber(
      raw.cooldown_duration_minutes,
      DEFAULT_COOLDOWN_MINUTES,
    ),
    status: _normalizeStatus(raw.status),
    cooldown_until: raw.cooldown_until || null,
    last_limit_exceeded_at: raw.last_limit_exceeded_at || null,
    updated_at: raw.updated_at || now,
  };
}

function _normalizeHourBreakdown(hours = {}) {
  const breakdown = {};
  for (let hour = 0; hour < 24; hour += 1) {
    const entry = hours[String(hour)] || hours[hour] || {};
    breakdown[String(hour)] = {
      tokens: Math.max(0, _toNumber(entry.tokens, 0)),
      requests: Math.max(0, _toNumber(entry.requests, 0)),
    };
  }
  return breakdown;
}

function _normalizeDayRecord(date, raw = {}, clientId = DEFAULT_CLIENT_ID) {
  const normalizedDate = String(raw.date || date || _bucketDate()).trim() || _bucketDate();
  return {
    client_id: _normalizeClientId(raw.client_id || clientId),
    date: normalizedDate,
    total_tokens: Math.max(0, _toNumber(raw.total_tokens, 0)),
    total_requests: Math.max(0, _toNumber(raw.total_requests, 0)),
    hours: _normalizeHourBreakdown(raw.hours || {}),
    last_updated: raw.last_updated || new Date().toISOString(),
  };
}

function _readTokenEventsState() {
  const state = _readJson(TOKEN_EVENTS_PATH, DEFAULT_TOKEN_EVENTS_STATE);
  return {
    version: _toNumber(state.version, 1),
    events: Array.isArray(state.events) ? state.events : [],
  };
}

function _writeTokenEventsState(state) {
  _writeJson(TOKEN_EVENTS_PATH, state);
}

function _readDailyUsageState() {
  const state = _readJson(DAILY_USAGE_PATH, DEFAULT_DAILY_USAGE_STATE);
  const days = state.days && typeof state.days === "object" ? state.days : {};
  const normalizedDays = {};
  for (const [date, entry] of Object.entries(days)) {
    normalizedDays[date] = _normalizeDayRecord(date, entry);
  }
  return {
    version: _toNumber(state.version, 1),
    days: normalizedDays,
  };
}

function _writeDailyUsageState(state) {
  _writeJson(DAILY_USAGE_PATH, state);
}

function _readQuotaState() {
  const state = _readJson(QUOTA_STATE_PATH, DEFAULT_QUOTA_STATE);
  const clients = state.clients && typeof state.clients === "object" ? state.clients : {};
  const normalizedClients = {};
  for (const [clientId, entry] of Object.entries(clients)) {
    normalizedClients[clientId] = _normalizeQuotaClient(clientId, entry);
  }
  return {
    version: _toNumber(state.version, 1),
    clients: normalizedClients,
  };
}

function _writeQuotaState(state) {
  _writeJson(QUOTA_STATE_PATH, state);
}

function _invalidateQuotaCache(clientId) {
  if (!clientId) return;
  _quotaCache.delete(clientId);
}

function _getCachedQuota(clientId) {
  const cached = _quotaCache.get(clientId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    _quotaCache.delete(clientId);
    return null;
  }
  return cached.result;
}

function _setCachedQuota(clientId, result) {
  _quotaCache.set(clientId, {
    result: _clone(result),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function _summarizeDailyRecord(record, date) {
  const source = record || _normalizeDayRecord(date, {}, DEFAULT_CLIENT_ID);
  const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => {
    const entry = source.hours?.[String(hour)] || { tokens: 0, requests: 0 };
    return {
      hour,
      tokens: Math.max(0, _toNumber(entry.tokens, 0)),
      requests: Math.max(0, _toNumber(entry.requests, 0)),
    };
  });

  return {
    clientId: source.client_id || DEFAULT_CLIENT_ID,
    date: source.date || date,
    totalTokens: Math.max(0, _toNumber(source.total_tokens, 0)),
    totalRequests: Math.max(0, _toNumber(source.total_requests, 0)),
    hourlyBreakdown,
    lastUpdated: source.last_updated || null,
  };
}

function getOrCreateClient(clientId) {
  const normalizedClientId = _normalizeClientId(clientId);
  const state = _readQuotaState();
  const existing = state.clients[normalizedClientId];
  const normalized = _normalizeQuotaClient(normalizedClientId, existing || {});

  if (normalizedClientId === DEFAULT_CLIENT_ID) {
    normalized.daily_limit = DEFAULT_DAILY_TOKEN_LIMIT;
    normalized.cooldown_duration_minutes = DEFAULT_COOLDOWN_MINUTES;
  }

  if (!existing || JSON.stringify(existing) !== JSON.stringify(normalized)) {
    state.clients[normalizedClientId] = normalized;
    _writeQuotaState(state);
  }

  return _clone(normalized);
}

function _persistClientRecord(clientId, changes) {
  const normalizedClientId = _normalizeClientId(clientId);
  const state = _readQuotaState();
  const current = _normalizeQuotaClient(normalizedClientId, state.clients[normalizedClientId] || {});
  const next = _normalizeQuotaClient(normalizedClientId, {
    ...current,
    ...changes,
    updated_at: new Date().toISOString(),
  });
  if (normalizedClientId === DEFAULT_CLIENT_ID) {
    next.daily_limit = DEFAULT_DAILY_TOKEN_LIMIT;
    next.cooldown_duration_minutes = DEFAULT_COOLDOWN_MINUTES;
  }
  state.clients[normalizedClientId] = next;
  _writeQuotaState(state);
  _invalidateQuotaCache(normalizedClientId);
  return next;
}

function enterCooldown(clientId) {
  const normalizedClientId = _normalizeClientId(clientId);
  const client = getOrCreateClient(normalizedClientId);
  const cooldownMinutes = _toPositiveNumber(
    client.cooldown_duration_minutes,
    DEFAULT_COOLDOWN_MINUTES,
  );
  const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
  return _persistClientRecord(normalizedClientId, {
    status: "cooldown",
    cooldown_until: cooldownUntil,
    last_limit_exceeded_at: new Date().toISOString(),
  });
}

function _applyUsageState(clientId, tokensUsed, quotaClient) {
  const client = quotaClient || getOrCreateClient(clientId);
  if (client.status === "suspended") {
    return client;
  }

  if (client.status === "cooldown") {
    return client;
  }

  const limit = _toPositiveNumber(client.daily_limit, DEFAULT_DAILY_TOKEN_LIMIT);
  const usagePercent = limit > 0 ? (tokensUsed / limit) * 100 : 0;
  const nextStatus = usagePercent >= 90 ? "limited" : "active";

  if (nextStatus !== client.status) {
    return _persistClientRecord(clientId, {
      status: nextStatus,
      cooldown_until: null,
    });
  }

  return client;
}

function recordTokenEvent(clientId, eventData = {}) {
  const normalizedClientId = _normalizeClientId(clientId);
  const now = new Date();
  const recordedAt = eventData.recorded_at ? new Date(eventData.recorded_at) : now;
  const safeRecordedAt = Number.isNaN(recordedAt.getTime()) ? now : recordedAt;
  const dayBucket = eventData.day_bucket || _bucketDate(safeRecordedAt);
  const hourBucket =
    Number.isInteger(eventData.hour_bucket) && eventData.hour_bucket >= 0 && eventData.hour_bucket <= 23
      ? eventData.hour_bucket
      : _bucketHour(safeRecordedAt);

  const event = {
    id: `evt_${crypto.randomBytes(4).toString("hex")}`,
    client_id: normalizedClientId,
    chatbot_id: eventData.chatbot_id ?? null,
    context_id: eventData.context_id ?? null,
    input_tokens: Math.max(0, _toNumber(eventData.input_tokens, 0)),
    output_tokens: Math.max(0, _toNumber(eventData.output_tokens, 0)),
    total_tokens: Math.max(0, _toNumber(eventData.total_tokens, 0)),
    latency_ms: Math.max(0, _toNumber(eventData.latency_ms, 0)),
    model: String(eventData.model || "").trim() || null,
    reranker_status: eventData.reranker_status ?? null,
    recorded_at: safeRecordedAt.toISOString(),
    day_bucket: dayBucket,
    hour_bucket: hourBucket,
  };

  const tokenState = _readTokenEventsState();
  tokenState.events.push(event);
  _writeTokenEventsState(tokenState);

  const dailyState = _readDailyUsageState();
  const existingDay = dailyState.days[dayBucket];
  const dayRecord = _normalizeDayRecord(dayBucket, existingDay || {}, normalizedClientId);
  dayRecord.client_id = normalizedClientId;
  dayRecord.date = dayBucket;
  dayRecord.total_tokens += event.total_tokens;
  dayRecord.total_requests += 1;
  const hourKey = String(hourBucket);
  dayRecord.hours[hourKey] = {
    tokens: Math.max(0, _toNumber(dayRecord.hours[hourKey]?.tokens, 0)) + event.total_tokens,
    requests: Math.max(0, _toNumber(dayRecord.hours[hourKey]?.requests, 0)) + 1,
  };
  dayRecord.last_updated = safeRecordedAt.toISOString();
  dailyState.days[dayBucket] = dayRecord;
  _writeDailyUsageState(dailyState);

  const quotaClient = getOrCreateClient(normalizedClientId);
  const limit = _toPositiveNumber(quotaClient.daily_limit, DEFAULT_DAILY_TOKEN_LIMIT);
  const usagePercent = limit > 0 ? (dayRecord.total_tokens / limit) * 100 : 0;

  let nextClient = quotaClient;
  if (limit > 0 && dayRecord.total_tokens > limit) {
    nextClient = enterCooldown(normalizedClientId);
  } else {
    nextClient = _applyUsageState(normalizedClientId, dayRecord.total_tokens, quotaClient);
  }

  _invalidateQuotaCache(normalizedClientId);
  return {
    success: true,
    event,
    dailyUsage: _summarizeDailyRecord(dayRecord, dayBucket),
    quota: {
      clientId: nextClient.client_id,
      status: nextClient.status,
      dailyLimit: nextClient.daily_limit,
      tokensUsed: dayRecord.total_tokens,
      tokensRemaining: Math.max(0, nextClient.daily_limit - dayRecord.total_tokens),
      cooldownUntil: nextClient.cooldown_until || null,
      cooldownDurationMinutes: nextClient.cooldown_duration_minutes,
      usagePercent,
    },
  };
}

function _readDailyUsageForDate(clientId, date) {
  const normalizedClientId = _normalizeClientId(clientId);
  const bucket = String(date || _bucketDate()).trim() || _bucketDate();
  const state = _readDailyUsageState();
  const record = state.days[bucket];
  if (!record || (record.client_id && record.client_id !== normalizedClientId)) {
    return _normalizeDayRecord(bucket, {}, normalizedClientId);
  }
  return _normalizeDayRecord(bucket, record, normalizedClientId);
}

function getDailyUsage(clientId, date = _bucketDate()) {
  return _summarizeDailyRecord(_readDailyUsageForDate(clientId, date), date);
}

function _buildUsageWindow(clientId, days) {
  const normalizedClientId = _normalizeClientId(clientId);
  const count = Math.max(1, Number.isFinite(Number(days)) ? Number(days) : 7);
  const today = new Date();
  const points = [];
  let totalTokens = 0;

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    const bucket = _bucketDate(date);
    const usage = _readDailyUsageForDate(normalizedClientId, bucket);
    totalTokens += usage.total_tokens;
    points.push({
      date: bucket,
      tokens: usage.total_tokens,
      requests: usage.total_requests,
    });
  }

  return {
    days: points,
    totalTokens,
  };
}

function getWeeklyUsage(clientId, days = 7) {
  return _buildUsageWindow(clientId, days);
}

function getMonthlyUsage(clientId, days = 30) {
  return _buildUsageWindow(clientId, days);
}

function checkQuotaStatus(clientId) {
  const normalizedClientId = _normalizeClientId(clientId);
  const cached = _getCachedQuota(normalizedClientId);
  if (cached) {
    return cached;
  }

  const client = getOrCreateClient(normalizedClientId);
  const today = _bucketDate();
  const usage = _readDailyUsageForDate(normalizedClientId, today);
  const now = Date.now();

  let nextClient = client;
  if (client.status === "cooldown" && client.cooldown_until) {
    const cooldownUntil = Date.parse(client.cooldown_until);
    if (Number.isFinite(cooldownUntil) && cooldownUntil <= now) {
      nextClient = _persistClientRecord(normalizedClientId, {
        status: "active",
        cooldown_until: null,
      });
    }
  }

  const limit = _toPositiveNumber(nextClient.daily_limit, DEFAULT_DAILY_TOKEN_LIMIT);
  const tokensUsed = usage.total_tokens;
  const tokensRemaining = Math.max(0, limit - tokensUsed);

  if (nextClient.status !== "cooldown" && nextClient.status !== "suspended") {
    nextClient = _applyUsageState(normalizedClientId, tokensUsed, nextClient);
  }

  const cooldownUntil = nextClient.status === "cooldown" ? nextClient.cooldown_until || null : null;
  const allowed =
    nextClient.status !== "suspended" &&
    !(nextClient.status === "cooldown" && cooldownUntil && Date.parse(cooldownUntil) > now);

  const result = {
    clientId: normalizedClientId,
    planName: nextClient.plan_name,
    status: nextClient.status,
    dailyLimit: limit,
    tokensUsed,
    tokensRemaining,
    cooldownUntil,
    cooldownDurationMinutes: nextClient.cooldown_duration_minutes,
    allowed,
  };

  _setCachedQuota(normalizedClientId, result);
  return result;
}

function clearExpiredCooldowns() {
  const state = _readQuotaState();
  const now = Date.now();
  let changed = false;

  for (const [clientId, record] of Object.entries(state.clients || {})) {
    if (record.status !== "cooldown" || !record.cooldown_until) continue;
    const cooldownUntil = Date.parse(record.cooldown_until);
    if (Number.isFinite(cooldownUntil) && cooldownUntil <= now) {
      state.clients[clientId] = _normalizeQuotaClient(clientId, {
        ...record,
        status: "active",
        cooldown_until: null,
        updated_at: new Date().toISOString(),
      });
      _invalidateQuotaCache(clientId);
      changed = true;
    }
  }

  if (changed) {
    _writeQuotaState(state);
  }
  return changed;
}

function pruneOldEvents(daysToKeep = 90) {
  const keepDays = Math.max(1, _toNumber(daysToKeep, 90));
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - keepDays);
  const cutoffTime = cutoff.getTime();

  const state = _readTokenEventsState();
  const before = state.events.length;
  state.events = state.events.filter((event) => {
    if (!event || !event.recorded_at) return true;
    const timestamp = Date.parse(event.recorded_at);
    if (!Number.isFinite(timestamp)) return true;
    return timestamp >= cutoffTime;
  });

  if (state.events.length !== before) {
    _writeTokenEventsState(state);
    return true;
  }

  return false;
}

module.exports = {
  DATA_DIR,
  TOKEN_EVENTS_PATH,
  DAILY_USAGE_PATH,
  QUOTA_STATE_PATH,
  getOrCreateClient,
  recordTokenEvent,
  getDailyUsage,
  getWeeklyUsage,
  getMonthlyUsage,
  checkQuotaStatus,
  enterCooldown,
  clearExpiredCooldowns,
  pruneOldEvents,
};
