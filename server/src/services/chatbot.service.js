const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DEFAULT_CLIENT_ID } = require("../config/env");
const configService = require("./config.service");
const authService = require("./auth.service");

const DATA_DIR = path.resolve(__dirname, "../../data");
const CHATBOTS_PATH = path.join(DATA_DIR, "chatbots.json");
const CHATBOT_LOG_DIR = path.join(DATA_DIR, "chatbots");
const WEBSITE_CHROMA_COLLECTION = "website_rag_bge_base_v1";
const DEFAULT_PROMPT_CONFIG = Object.freeze({
  role:
    "You are a friendly, helpful website assistant.\n\n" +
    "You speak naturally like a real customer support representative.\n\n" +
    "You are warm, professional, concise and easy to understand.\n\n" +
    "You help users find information available on the website while maintaining a natural conversation.",
  tone: "friendly",
  answer_style: "professional",
  fallback_behavior: "helpful",
  strict_grounding: true,
  allow_inference: true,
  website_identity_mode: true,
  constraints: [],
});

function _normalizeClientId(clientId) {
  const value = String(clientId || "").trim();
  return value || null;
}

const DEFAULT_STATE = {
  version: 1,
  chatbots: [],
};

function _readState() {
  if (!fs.existsSync(CHATBOTS_PATH)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const raw = fs.readFileSync(CHATBOTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const normalizedChatbots = Array.isArray(parsed.chatbots)
      ? parsed.chatbots.map(_normalizeChatbotRecord)
      : [];
    const normalizedState = {
      ...DEFAULT_STATE,
      ...parsed,
      chatbots: normalizedChatbots,
    };
    if (JSON.stringify(normalizedChatbots) !== JSON.stringify(parsed.chatbots || [])) {
      _writeState(normalizedState);
    }
    return normalizedState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function _writeState(state) {
  fs.mkdirSync(path.dirname(CHATBOTS_PATH), { recursive: true });
  fs.writeFileSync(CHATBOTS_PATH, JSON.stringify(state, null, 2), "utf8");
}

function _slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "chatbot";
}

function _createId(prefix = "cbt") {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

function _normalizeHostname(input) {
  if (!input) return "";
  const raw = String(input).trim().toLowerCase();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0];
  }
}

function _normalizeAllowedDomains(domains) {
  if (!Array.isArray(domains)) return [];
  const normalized = domains
    .map((domain) => _normalizeHostname(domain))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function _normalizePromptConfig(promptConfig) {
  if (!promptConfig || typeof promptConfig !== "object") {
    return { ...DEFAULT_PROMPT_CONFIG };
  }
  return {
    role: typeof promptConfig.role === "string" ? promptConfig.role.trim() : DEFAULT_PROMPT_CONFIG.role,
    tone: typeof promptConfig.tone === "string" ? promptConfig.tone.trim() : DEFAULT_PROMPT_CONFIG.tone,
    answer_style:
      typeof promptConfig.answer_style === "string"
        ? promptConfig.answer_style.trim()
        : DEFAULT_PROMPT_CONFIG.answer_style,
    fallback_behavior:
      typeof promptConfig.fallback_behavior === "string"
        ? promptConfig.fallback_behavior.trim()
        : DEFAULT_PROMPT_CONFIG.fallback_behavior,
    strict_grounding:
      typeof promptConfig.strict_grounding === "boolean"
        ? promptConfig.strict_grounding
        : DEFAULT_PROMPT_CONFIG.strict_grounding,
    allow_inference:
      typeof promptConfig.allow_inference === "boolean"
        ? promptConfig.allow_inference
        : DEFAULT_PROMPT_CONFIG.allow_inference,
    website_identity_mode:
      typeof promptConfig.website_identity_mode === "boolean"
        ? promptConfig.website_identity_mode
        : DEFAULT_PROMPT_CONFIG.website_identity_mode,
    constraints: Array.isArray(promptConfig.constraints)
      ? promptConfig.constraints
          .map((line) => String(line).trim())
          .filter(Boolean)
      : [],
  };
}

function _normalizePublicApiBase(apiBaseUrl) {
  const normalized = String(apiBaseUrl || "").trim().replace(/\/$/, "");
  if (!normalized) return "";
  return normalized.replace(/\/api$/, "") || normalized;
}

function _normalizeChatbotRecord(chatbot) {
  const allowedDomains = _normalizeAllowedDomains(chatbot.allowed_domains);
  const contextIds = Array.isArray(chatbot.context_ids)
    ? chatbot.context_ids.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const primaryContextId = String(chatbot.primary_context_id || contextIds[0] || "").trim();
  const chromaDir =
    String(chatbot.chroma_dir || "").trim() ||
    path.posix.join("websites", primaryContextId || "unknown", "embeddings");
  const hasClientId = Object.prototype.hasOwnProperty.call(chatbot, "client_id");
  const normalizedClientId = hasClientId
    ? _normalizeClientId(chatbot.client_id)
    : _normalizeClientId(DEFAULT_CLIENT_ID);

  return {
    id: String(chatbot.id || "").trim(),
    client_id: normalizedClientId,
    name: String(chatbot.name || "").trim() || "Untitled chatbot",
    public_token: String(chatbot.public_token || "").trim(),
    namespace: String(chatbot.namespace || "").trim() || `chatbot_${chatbot.id}`,
    is_active: Boolean(chatbot.is_active ?? true),
    welcome_message: String(chatbot.welcome_message || "").trim(),
    theme_config:
      chatbot.theme_config && typeof chatbot.theme_config === "object"
        ? chatbot.theme_config
        : {},
    prompt_config: _normalizePromptConfig(chatbot.prompt_config),
    last_accessed_at: chatbot.last_accessed_at || null,
    allowed_domains: allowedDomains,
    context_ids: contextIds,
    primary_context_id: primaryContextId,
    chroma_dir: chromaDir,
    collection_name: String(chatbot.collection_name || "").trim() || WEBSITE_CHROMA_COLLECTION,
    created_at: chatbot.created_at || new Date().toISOString(),
    updated_at: chatbot.updated_at || chatbot.created_at || new Date().toISOString(),
    deleted_at: chatbot.deleted_at || null,
  };
}

function _matchesClientScope(chatbot, clientId) {
  if (clientId === null) return true;
  const normalized = _normalizeClientId(clientId);
  if (!normalized) return true;
  return _normalizeClientId(chatbot.client_id) === normalized;
}

function listChatbots(clientId = null) {
  const state = _readState();
  return (state.chatbots || [])
    .filter((chatbot) => !chatbot.deleted_at)
    .map(_normalizeChatbotRecord)
    .filter((chatbot) => _matchesClientScope(chatbot, clientId));
}

function getChatbot(chatbotId, clientId = null) {
  if (!chatbotId) return null;
  return listChatbots(clientId).find((chatbot) => chatbot.id === chatbotId) || null;
}

function _buildClientNameLookup() {
  const lookup = new Map();
  for (const user of authService.listUsers()) {
    if (user && user.client_id) {
      lookup.set(String(user.client_id).trim(), user.name || user.email || String(user.client_id).trim());
    }
  }
  return lookup;
}

function listChatbotsByContext(contextId, clientId = null) {
  const target = String(contextId || "").trim();
  if (!target) {
    return [];
  }
  return listChatbots(clientId).filter((chatbot) => {
    if (chatbot.primary_context_id === target) {
      return true;
    }
    return (chatbot.context_ids || []).some((entry) => String(entry).trim() === target);
  });
}

function createChatbot(input, clientId = null) {
  const state = _readState();
  const now = new Date().toISOString();
  const name = String(input?.name || "").trim() || "New chatbot";
  const contextIds = Array.isArray(input?.context_ids)
    ? input.context_ids.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const primaryContextId = String(input?.primary_context_id || contextIds[0] || "").trim();
  if (!primaryContextId) {
    throw new Error("A website context is required to create a chatbot.");
  }
  const normalizedClientId = _normalizeClientId(clientId);
  if (normalizedClientId) {
    const config = configService.getConfig();
    const maxChatbots = Math.max(0, Number(config?.registration?.max_chatbots_per_client ?? 0) || 0);
    if (maxChatbots > 0) {
      const currentCount = listChatbots(normalizedClientId).length;
      if (currentCount >= maxChatbots) {
        const error = new Error(`Maximum chatbots per user reached (${maxChatbots}).`);
        error.status = 403;
        throw error;
      }
    }
  }

  const chatbot = _normalizeChatbotRecord({
    id: _createId(),
    name,
    public_token: _createId("pub"),
    namespace: "",
    client_id: normalizedClientId,
    is_active: input?.is_active ?? true,
    welcome_message: input?.welcome_message || "",
    theme_config: input?.theme_config || {},
    prompt_config: input?.prompt_config || {},
    allowed_domains: input?.allowed_domains || [],
    context_ids: contextIds,
    primary_context_id: primaryContextId,
    chroma_dir: path.posix.join("websites", primaryContextId, "embeddings"),
    collection_name: WEBSITE_CHROMA_COLLECTION,
    created_at: now,
    updated_at: now,
  });

  state.chatbots = [...(state.chatbots || []), chatbot];
  _writeState(state);
  return chatbot;
}

function updateLastAccessed(chatbotId, clientId = null) {
  const state = _readState();
  const now = new Date().toISOString();
  let updated = null;
  state.chatbots = (state.chatbots || []).map((chatbot) => {
    if (chatbot.id !== chatbotId) return chatbot;
    const normalized = _normalizeChatbotRecord(chatbot);
    if (!_assertChatbotOwnership(normalized, clientId)) return chatbot;
    updated = _normalizeChatbotRecord({ ...chatbot, last_accessed_at: now });
    return updated;
  });
  if (!updated) return null;
  _writeState(state);
  return now;
}

function listAllChatbotsAdmin({
  search = "",
  status = "",
  sortBy = "created_at",
  sortDir = "desc",
  page = 1,
  limit = 25,
} = {}) {
  const state = _readState();
  const clientLookup = _buildClientNameLookup();
  const normalizedSearch = String(search || "").trim().toLowerCase().slice(0, 200);
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedSortBy = String(sortBy || "created_at").trim();
  const normalizedSortDir = String(sortDir || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));

  let items = (state.chatbots || []).map((entry) => {
    const mapped = _normalizeChatbotRecord(entry);
    return {
      ...mapped,
      client_name: clientLookup.get(String(mapped.client_id || "").trim()) || null,
    };
  });

  if (normalizedSearch) {
    items = items.filter((item) => {
      const haystack = [item.id, item.name, item.client_id, item.client_name].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }

  if (normalizedStatus === "active") {
    items = items.filter((item) => Boolean(item.is_active));
  } else if (normalizedStatus === "disabled") {
    items = items.filter((item) => !Boolean(item.is_active));
  }

  items.sort((left, right) => {
    const a = left[normalizedSortBy];
    const b = right[normalizedSortBy];
    if (a === b) return 0;
    if (a === null || a === undefined) return normalizedSortDir === "asc" ? -1 : 1;
    if (b === null || b === undefined) return normalizedSortDir === "asc" ? 1 : -1;
    const aValue = String(a).toLowerCase();
    const bValue = String(b).toLowerCase();
    if (aValue < bValue) return normalizedSortDir === "asc" ? -1 : 1;
    if (aValue > bValue) return normalizedSortDir === "asc" ? 1 : -1;
    return 0;
  });

  const total = items.length;
  const start = (safePage - 1) * safeLimit;
  items = items.slice(start, start + safeLimit);

  return { items, total, page: safePage, limit: safeLimit };
}

function _assertChatbotOwnership(chatbot, clientId) {
  if (!chatbot) return false;
  if (clientId === null) return true;
  const normalized = _normalizeClientId(clientId);
  if (!normalized) return true;
  return _normalizeClientId(chatbot.client_id) === normalized;
}

function updateChatbot(chatbotId, changes, clientId = null) {
  const state = _readState();
  let updated = null;
  state.chatbots = (state.chatbots || []).map((chatbot) => {
    if (chatbot.id !== chatbotId) return chatbot;
    if (!_assertChatbotOwnership(_normalizeChatbotRecord(chatbot), clientId)) {
      return chatbot;
    }
    const merged = _normalizeChatbotRecord({
      ...chatbot,
      ...changes,
      id: chatbot.id,
      public_token: chatbot.public_token,
      namespace: chatbot.namespace,
      created_at: chatbot.created_at,
      deleted_at: chatbot.deleted_at || null,
      updated_at: new Date().toISOString(),
    });
    updated = merged;
    return merged;
  });

  if (!updated) {
    return null;
  }

  _writeState(state);
  return updated;
}

function disableChatbot(chatbotId, clientId = null) {
  return updateChatbot(chatbotId, { is_active: false }, clientId);
}

function enableChatbot(chatbotId, clientId = null) {
  return updateChatbot(chatbotId, { is_active: true, deleted_at: null }, clientId);
}

function _deleteChatbotLogDir(chatbotId) {
  const chatbotDir = path.join(CHATBOT_LOG_DIR, chatbotId);
  fs.rmSync(chatbotDir, { recursive: true, force: true });
}

function deleteChatbot(chatbotId, clientId = null) {
  const state = _readState();
  const chatbot = (state.chatbots || []).map(_normalizeChatbotRecord).find((entry) => entry.id === chatbotId);
  if (!chatbot) {
    return null;
  }
  if (!_assertChatbotOwnership(chatbot, clientId)) {
    return null;
  }

  try {
    _deleteChatbotLogDir(chatbot.id);
  } catch {
    // Ignore filesystem cleanup failures for the same reason.
  }

  state.chatbots = (state.chatbots || []).filter((entry) => entry.id !== chatbotId);
  _writeState(state);

  return chatbot;
}

function deleteChatbotsByContext(contextId, clientId = null) {
  const chatbots = listChatbotsByContext(contextId, clientId);
  for (const chatbot of chatbots) {
    deleteChatbot(chatbot.id, clientId);
  }
  return chatbots;
}

function _hostnameFromOrigin(origin) {
  if (!origin) return "";
  try {
    return _normalizeHostname(new URL(origin).hostname);
  } catch {
    return _normalizeHostname(origin);
  }
}

function isOriginAllowed(chatbot, origin) {
  const hostname = _hostnameFromOrigin(origin);
  if (!hostname) return false;

  const allowed = chatbot.allowed_domains || [];
  if (allowed.length === 0) {
    return true;
  }

  return allowed.some((domain) => {
    const normalized = _normalizeHostname(domain);
    if (!normalized) return false;
    if (normalized.startsWith("*.")) {
      const suffix = normalized.slice(2);
      return hostname === suffix || hostname.endsWith(`.${suffix}`);
    }
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

function buildEmbedSnippet(chatbotId, widgetBaseUrl, apiBaseUrl) {
  const widgetBase = String(widgetBaseUrl || "").replace(/\/$/, "");
  const apiBase = _normalizePublicApiBase(apiBaseUrl);
  const scriptSrc = `${widgetBase}/widget.js`;
  return `<script src="${scriptSrc}" data-chatbot-id="${chatbotId}" data-api-base="${apiBase}"></script>`;
}

function getPublicChatbotConfig(chatbot) {
  return {
    id: chatbot.id,
    name: chatbot.name,
    theme: chatbot.theme_config || {},
    welcome_message: chatbot.welcome_message || "",
    is_active: Boolean(chatbot.is_active),
  };
}

module.exports = {
  CHATBOTS_PATH,
  listChatbots,
  getChatbot,
  listChatbotsByContext,
  deleteChatbotsByContext,
  createChatbot,
  updateChatbot,
  updateLastAccessed,
  listAllChatbotsAdmin,
  disableChatbot,
  enableChatbot,
  deleteChatbot,
  isOriginAllowed,
  buildEmbedSnippet,
  getPublicChatbotConfig,
};
