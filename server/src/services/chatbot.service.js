const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

  return {
    id: String(chatbot.id || "").trim(),
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

function listChatbots() {
  const state = _readState();
  return (state.chatbots || [])
    .filter((chatbot) => !chatbot.deleted_at)
    .map(_normalizeChatbotRecord);
}

function getChatbot(chatbotId) {
  if (!chatbotId) return null;
  return listChatbots().find((chatbot) => chatbot.id === chatbotId) || null;
}

function listChatbotsByContext(contextId) {
  const target = String(contextId || "").trim();
  if (!target) {
    return [];
  }
  return listChatbots().filter((chatbot) => {
    if (chatbot.primary_context_id === target) {
      return true;
    }
    return (chatbot.context_ids || []).some((entry) => String(entry).trim() === target);
  });
}

function createChatbot(input) {
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

  const chatbot = _normalizeChatbotRecord({
    id: _createId(),
    name,
    public_token: _createId("pub"),
    namespace: "",
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

function updateChatbot(chatbotId, changes) {
  const state = _readState();
  let updated = null;
  state.chatbots = (state.chatbots || []).map((chatbot) => {
    if (chatbot.id !== chatbotId) return chatbot;
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

function disableChatbot(chatbotId) {
  return updateChatbot(chatbotId, { is_active: false });
}

function enableChatbot(chatbotId) {
  return updateChatbot(chatbotId, { is_active: true, deleted_at: null });
}

function _deleteChatbotLogDir(chatbotId) {
  const chatbotDir = path.join(CHATBOT_LOG_DIR, chatbotId);
  fs.rmSync(chatbotDir, { recursive: true, force: true });
}

function deleteChatbot(chatbotId) {
  const state = _readState();
  const chatbot = (state.chatbots || []).map(_normalizeChatbotRecord).find((entry) => entry.id === chatbotId);
  if (!chatbot) {
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

function deleteChatbotsByContext(contextId) {
  const chatbots = listChatbotsByContext(contextId);
  for (const chatbot of chatbots) {
    deleteChatbot(chatbot.id);
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
  disableChatbot,
  enableChatbot,
  deleteChatbot,
  isOriginAllowed,
  buildEmbedSnippet,
  getPublicChatbotConfig,
};
