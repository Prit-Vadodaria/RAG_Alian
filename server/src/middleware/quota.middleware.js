const tokenService = require("../services/token.service");
const chatbotService = require("../services/chatbot.service");
const { OWNER_API_KEY } = require("../config/env");
const { errorResponse } = require("../utils/apiResponse");

function resolveClientId(req) {
  const authenticatedClientId =
    req.user && Object.prototype.hasOwnProperty.call(req.user, "clientId")
      ? req.user.clientId
      : req.user && Object.prototype.hasOwnProperty.call(req.user, "client_id")
        ? req.user.client_id
        : null;
  if (authenticatedClientId) {
    return authenticatedClientId;
  }

  const publicChatbotId = String(req.body?.chatbot_id || "").trim();
  if (req.baseUrl === "/public" && publicChatbotId) {
    const chatbot = chatbotService.getChatbot(publicChatbotId, null);
    if (chatbot) {
      return chatbot.client_id || null;
    }
  }

  const apiKey = String(req.header("x-api-key") || "").trim();
  if (!apiKey) {
    return null;
  }

  if (OWNER_API_KEY && apiKey === OWNER_API_KEY) {
    return null;
  }

  return apiKey || null;
}

function quotaMiddleware(req, res, next) {
  try {
    const clientId = resolveClientId(req);
    if (!clientId) {
      return res.status(401).json(errorResponse("Client scope is required."));
    }
    req.clientId = clientId;

    const quota = tokenService.checkQuotaStatus(clientId);

    if (quota.status === "suspended") {
      return res.status(403).json(
        errorResponse("This client is suspended."),
      );
    }

    if (
      quota.status === "cooldown" &&
      quota.cooldownUntil &&
      Date.parse(quota.cooldownUntil) > Date.now()
    ) {
      return res.status(429).json({
        ...errorResponse("Daily token limit exceeded."),
        quota,
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  quotaMiddleware,
  resolveClientId,
};
