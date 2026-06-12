const fs = require("fs");
const authService = require("./auth.service");
const clientConfigService = require("./client-config.service");
const chatbotService = require("./chatbot.service");
const contextService = require("./context.service");
const promptSettingsService = require("./prompt-settings.service");
const tokenService = require("./token.service");

function _readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function _writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function _sumDailyTokens(state) {
  return Object.values(state?.days || {}).reduce((total, entry) => {
    if (!entry || typeof entry !== "object") {
      return total;
    }
    if (Object.prototype.hasOwnProperty.call(entry, "client_id")) {
      return total + Number(entry?.total_tokens || 0);
    }
    return (
      total +
      Object.values(entry).reduce(
        (nestedTotal, nestedEntry) => nestedTotal + Number(nestedEntry?.total_tokens || 0),
        0,
      )
    );
  }, 0);
}

function _sumDailyRequests(state) {
  return Object.values(state?.days || {}).reduce((total, entry) => {
    if (!entry || typeof entry !== "object") {
      return total;
    }
    if (Object.prototype.hasOwnProperty.call(entry, "client_id")) {
      return total + Number(entry?.total_requests || 0);
    }
    return (
      total +
      Object.values(entry).reduce(
        (nestedTotal, nestedEntry) => nestedTotal + Number(nestedEntry?.total_requests || 0),
        0,
      )
    );
  }, 0);
}

function _sumClientDailyRequests(state, clientId) {
  const target = String(clientId || "").trim();
  if (!target) return 0;
  return Object.values(state?.days || {}).reduce((total, entry) => {
    if (!entry || typeof entry !== "object") {
      return total;
    }
    if (Object.prototype.hasOwnProperty.call(entry, "client_id")) {
      return String(entry?.client_id || "").trim() === target
        ? total + Number(entry?.total_requests || 0)
        : total;
    }
    const record = entry[target];
    return record ? total + Number(record?.total_requests || 0) : total;
  }, 0);
}

function getStats() {
  const users = authService.listUsers();
  const clients = users.filter((user) => user.role === "client");
  const contexts = contextService.listContexts(null);
  const chatbots = chatbotService.listChatbots(null);
  const dailyUsage = _readJson(tokenService.DAILY_USAGE_PATH, { version: 1, days: {} });
  const quotaState = _readJson(tokenService.QUOTA_STATE_PATH, { version: 1, clients: {} });
  const todayBucket = new Date().toISOString().slice(0, 10);
  const todayUsage = dailyUsage?.days?.[todayBucket] || {};
  const totalQueriesToday = Object.values(todayUsage || {}).reduce(
    (total, record) => total + Number(record?.total_requests || 0),
    0,
  );

  return {
    totalClients: clients.length,
    activeClients: clients.filter((user) => user.status === "active").length,
    disabledClients: clients.filter((user) => user.status === "disabled").length,
    totalContexts: contexts.length,
    totalChatbots: chatbots.length,
    totalTokensAllTime: _sumDailyTokens(dailyUsage),
    totalTokensToday: clients.reduce((total, client) => total + Number(tokenService.checkQuotaStatus(client.client_id).tokensUsed || 0), 0),
    totalQueriesToday,
    totalQueriesAllTime: _sumDailyRequests(dailyUsage),
    clientsWithQuota: Object.keys(quotaState.clients || {}).length,
  };
}

function _normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function listClients({ search = "", status = "", page = 1, limit = 25 } = {}) {
  const normalizedSearch = _normalizeSearchValue(search);
  const normalizedStatus = _normalizeSearchValue(status);
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));

  const users = authService
    .listUsers()
    .filter((user) => user.role === "client")
    .filter((user) => {
      if (!normalizedStatus || normalizedStatus === "all") return true;
      return String(user.status || "").trim().toLowerCase() === normalizedStatus;
    })
    .filter((user) => {
      if (!normalizedSearch) return true;
      const haystack = [user.name, user.email, user.client_id].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });

  const totalItems = users.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const start = (pageIndex - 1) * pageSize;
  const items = users.slice(start, start + pageSize);
  const dailyUsage = _readJson(tokenService.DAILY_USAGE_PATH, { version: 1, days: {} });

  return {
    items: items.map((user) => {
    const clientId = user.client_id;
    const genConfig = clientConfigService.getPublicClientConfig(clientId);
    const contexts = contextService.listContexts(clientId);
    const chatbots = chatbotService.listChatbots(clientId);
    const quota = tokenService.checkQuotaStatus(clientId);
    return {
      ...user,
      contextCount: contexts.length,
      chatbotCount: chatbots.length,
      tokensUsedToday: quota.tokensUsed,
      queriesUsedToday: tokenService.getDailyUsage(clientId).totalRequests,
      queriesUsedAllTime: _sumClientDailyRequests(dailyUsage, clientId),
      quotaStatus: quota.status,
      dailyLimit: genConfig?.dailyTokenLimit || quota.dailyLimit,
      hasGenerationConfig: Boolean(genConfig?.hasApiKey),
      generationModel: genConfig?.model || null,
    };
    }),
    page: pageIndex,
    limit: pageSize,
    totalItems,
    totalPages,
  };
}

function getClientDetails(clientId) {
  const user = authService.findUserById(clientId);
  if (!user) return null;
  const genConfig = clientConfigService.getPublicClientConfig(user.client_id);
  const quota = tokenService.checkQuotaStatus(user.client_id);
  const dailyUsage = _readJson(tokenService.DAILY_USAGE_PATH, { version: 1, days: {} });
  return {
    user,
    contexts: contextService.listContexts(user.client_id),
    chatbots: chatbotService.listChatbots(user.client_id),
    quota,
    todayUsage: tokenService.getDailyUsage(user.client_id),
    queriesUsedToday: tokenService.getDailyUsage(user.client_id).totalRequests,
    queriesUsedAllTime: _sumClientDailyRequests(dailyUsage, user.client_id),
    genConfig,
  };
}

function updateClientStatus(clientId, status) {
  const updated = authService.updateUserStatus(clientId, status);
  if (!updated) return null;
  if (updated.status === "disabled") {
    const clientScope = updated.client_id;
    for (const chatbot of chatbotService.listChatbots(clientScope)) {
      chatbotService.disableChatbot(chatbot.id, clientScope);
    }
  }
  return updated;
}

function deleteClient(clientId) {
  const user = authService.findUserById(clientId);
  if (!user) return null;

  const clientScope = user.client_id;
  for (const context of contextService.listContexts(clientScope)) {
    try {
      contextService.deleteContext(context.id, clientScope);
    } catch {
      // best-effort cleanup
    }
  }

  for (const chatbot of chatbotService.listChatbots(clientScope)) {
    try {
      chatbotService.deleteChatbot(chatbot.id, clientScope);
    } catch {
      // best-effort cleanup
    }
  }

  const dailyUsage = _readJson(tokenService.DAILY_USAGE_PATH, { version: 1, days: {} });
  _writeJson(tokenService.DAILY_USAGE_PATH, tokenService.pruneClientFromDailyUsage(dailyUsage, clientScope));

  const tokenEvents = _readJson(tokenService.TOKEN_EVENTS_PATH, { version: 1, events: [] });
  tokenEvents.events = (tokenEvents.events || []).filter((event) => event.client_id !== clientScope);
  _writeJson(tokenService.TOKEN_EVENTS_PATH, tokenEvents);

  const quotaState = _readJson(tokenService.QUOTA_STATE_PATH, { version: 1, clients: {} });
  delete quotaState.clients?.[clientScope];
  _writeJson(tokenService.QUOTA_STATE_PATH, quotaState);
  clientConfigService.deleteClientConfig(clientScope);
  promptSettingsService.deleteClientPromptSettings(clientScope);

  return authService.deleteUser(user.id);
}

function resetClientUsage(clientId) {
  const user = authService.findUserById(clientId);
  if (!user) return null;

  const clientScope = user.client_id;
  const dailyUsage = _readJson(tokenService.DAILY_USAGE_PATH, { version: 1, days: {} });
  _writeJson(tokenService.DAILY_USAGE_PATH, tokenService.pruneClientFromDailyUsage(dailyUsage, clientScope));

  const tokenEvents = _readJson(tokenService.TOKEN_EVENTS_PATH, { version: 1, events: [] });
  tokenEvents.events = (tokenEvents.events || []).filter((event) => event.client_id !== clientScope);
  _writeJson(tokenService.TOKEN_EVENTS_PATH, tokenEvents);

  const quotaState = _readJson(tokenService.QUOTA_STATE_PATH, { version: 1, clients: {} });
  delete quotaState.clients?.[clientScope];
  _writeJson(tokenService.QUOTA_STATE_PATH, quotaState);

  tokenService.clearQuotaCache(clientScope);
  return tokenService.checkQuotaStatus(clientScope);
}

function listUnconfiguredClients() {
  return listClients().items.filter((client) => !client.hasGenerationConfig);
}

function listAllContextsAdmin(opts) {
  return contextService.listAllContextsAdmin(opts);
}

function listAllChatbotsAdmin(opts) {
  return chatbotService.listAllChatbotsAdmin(opts);
}

module.exports = {
  getStats,
  listClients,
  getClientDetails,
  updateClientStatus,
  deleteClient,
  resetClientUsage,
  listUnconfiguredClients,
  listAllContextsAdmin,
  listAllChatbotsAdmin,
};
