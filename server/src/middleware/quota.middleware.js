const tokenService = require("../services/token.service");
const { DEFAULT_CLIENT_ID, OWNER_API_KEY } = require("../config/env");
const { errorResponse } = require("../utils/apiResponse");

function resolveClientId(req) {
  const apiKey = String(req.header("x-api-key") || "").trim();
  if (!apiKey) {
    return DEFAULT_CLIENT_ID;
  }

  if (OWNER_API_KEY && apiKey === OWNER_API_KEY) {
    return DEFAULT_CLIENT_ID;
  }

  return apiKey;
}

function quotaMiddleware(req, res, next) {
  try {
    const clientId = resolveClientId(req);
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
