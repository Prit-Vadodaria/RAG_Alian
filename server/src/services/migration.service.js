const authService = require("./auth.service");
const clientConfigService = require("./client-config.service");
const chatbotService = require("./chatbot.service");
const contextService = require("./context.service");
const tokenService = require("./token.service");
const { DEFAULT_CLIENT_ID } = require("../config/env");

function runStartupMigrations() {
  const results = {
    usersSeeded: false,
    clientScopesNormalized: 0,
    chatbotsNormalized: 0,
    contextsNormalized: 0,
    quotaSeeded: false,
  };

  authService.ensureDefaultUsers();
  results.usersSeeded = true;
  results.clientScopesNormalized = authService.normalizeLegacyClientScopes();

  const chatbots = chatbotService.listChatbots(null);
  results.chatbotsNormalized = chatbots.length;

  const contexts = contextService.listContexts(null);
  results.contextsNormalized = contexts.length;

  tokenService.getOrCreateClient(DEFAULT_CLIENT_ID);
  results.quotaSeeded = true;

  const clients = authService.listUsers().filter((user) => user.role === "client");
  const unconfigured = clients.filter(
    (user) => !clientConfigService.clientConfigExists(user.client_id),
  );
  if (unconfigured.length > 0) {
    console.warn(
      `[migration] ${unconfigured.length} client(s) have no generation config and cannot submit queries until configured.`,
    );
  }

  return results;
}

module.exports = {
  runStartupMigrations,
};
