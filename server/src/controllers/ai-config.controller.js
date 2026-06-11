const { successResponse, errorResponse } = require("../utils/apiResponse");
const clientConfigService = require("../services/client-config.service");
const { DEFAULT_CLIENT_ID } = require("../config/env");

function _getClientId(req) {
  return req.user?.clientId || req.user?.client_id || req.clientId || DEFAULT_CLIENT_ID;
}

const getAiConfig = async (req, res, next) => {
  try {
    const clientId = _getClientId(req);
    const config = clientConfigService.getPublicClientConfig(clientId);
    if (!config) {
      return res.json(
        successResponse({
          ...clientConfigService.DEFAULT_GEN_CONFIG,
          hasApiKey: false,
          clientId,
        }),
      );
    }
    return res.json(successResponse({ ...config, clientId }));
  } catch (error) {
    return next(error);
  }
};

const updateAiConfig = async (req, res, next) => {
  try {
    const clientId = _getClientId(req);
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "googleApiKey")) {
      const googleApiKey = String(req.body.googleApiKey || "").trim();
      if (googleApiKey && googleApiKey !== "***configured***") {
        if (!/^[A-Za-z0-9_-]{10,}$/.test(googleApiKey)) {
          return res.status(400).json(errorResponse("'googleApiKey' is invalid."));
        }
        updates.googleApiKey = googleApiKey;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "model")) {
      const model = String(req.body.model || "").trim();
      if (!model) {
        return res.status(400).json(errorResponse("'model' is required."));
      }
      updates.model = model;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "timeoutSeconds")) {
      const timeoutSeconds = Number(req.body.timeoutSeconds);
      if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 300) {
        return res.status(400).json(errorResponse("'timeoutSeconds' must be between 10 and 300."));
      }
      updates.timeoutSeconds = timeoutSeconds;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "temperature")) {
      const temperature = Number(req.body.temperature);
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        return res.status(400).json(errorResponse("'temperature' must be between 0 and 2."));
      }
      updates.temperature = temperature;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "maxOutputTokens")) {
      const maxOutputTokens = Number(req.body.maxOutputTokens);
      if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 64) {
        return res.status(400).json(errorResponse("'maxOutputTokens' must be at least 64."));
      }
      updates.maxOutputTokens = maxOutputTokens;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "maxRetries")) {
      const maxRetries = Number(req.body.maxRetries);
      if (!Number.isInteger(maxRetries) || maxRetries < 1) {
        return res.status(400).json(errorResponse("'maxRetries' must be at least 1."));
      }
      updates.maxRetries = maxRetries;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "retryBackoff")) {
      const retryBackoff = Number(req.body.retryBackoff);
      if (!Number.isFinite(retryBackoff) || retryBackoff < 0.5) {
        return res.status(400).json(errorResponse("'retryBackoff' must be at least 0.5."));
      }
      updates.retryBackoff = retryBackoff;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "dailyTokenLimit")) {
      const dailyTokenLimit = Number(req.body.dailyTokenLimit);
      if (!Number.isInteger(dailyTokenLimit) || dailyTokenLimit < 1000) {
        return res.status(400).json(errorResponse("'dailyTokenLimit' must be at least 1000."));
      }
      updates.dailyTokenLimit = dailyTokenLimit;
    }

    const saved = clientConfigService.setClientConfig(clientId, updates, {
      changedBy: req.user?.id || "api",
    });
    return res.json(successResponse(saved));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAiConfig,
  updateAiConfig,
};
