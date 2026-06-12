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

function getStats() {
  const users = authService.listUsers();
  const clients = users.filter((user) => user.role === "client");
  const contexts = contextService.listContexts(null);
  const chatbots = chatbotService.listChatbots(null);
  const dailyUsage = _readJson(tokenService.DAILY_USAGE_PATH, { version: 1, days: {} });
  const quotaState = _readJson(tokenService.QUOTA_STATE_PATH, { version: 1, clients: {} });

  return {
    totalClients: clients.length,
    activeClients: clients.filter((user) => user.status === "active").length,
    disabledClients: clients.filter((user) => user.status === "disabled").length,
    totalContexts: contexts.length,
    totalChatbots: chatbots.length,
    totalTokensAllTime: _sumDailyTokens(dailyUsage),
    totalTokensToday: clients.reduce((total, client) => total + Number(tokenService.checkQuotaStatus(client.client_id).tokensUsed || 0), 0),
    clientsWithQuota: Object.keys(quotaState.clients || {}).length,
  };
}

function listClients() {
  const users = authService.listUsers().filter((user) => user.role === "client");
  return users.map((user) => {
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
      quotaStatus: quota.status,
      dailyLimit: genConfig?.dailyTokenLimit || quota.dailyLimit,
      hasGenerationConfig: Boolean(genConfig?.hasApiKey),
      generationModel: genConfig?.model || null,
    };
  });
}

function getClientDetails(clientId) {
  const user = authService.findUserById(clientId);
  if (!user) return null;
  const genConfig = clientConfigService.getPublicClientConfig(user.client_id);
  const quota = tokenService.checkQuotaStatus(user.client_id);
  return {
    user,
    contexts: contextService.listContexts(user.client_id),
    chatbots: chatbotService.listChatbots(user.client_id),
    quota,
    todayUsage: tokenService.getDailyUsage(user.client_id),
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
  return listClients().filter((client) => !client.hasGenerationConfig);
}

module.exports = {
  getStats,
  listClients,
  getClientDetails,
  updateClientStatus,
  deleteClient,
  resetClientUsage,
  listUnconfiguredClients,
};
