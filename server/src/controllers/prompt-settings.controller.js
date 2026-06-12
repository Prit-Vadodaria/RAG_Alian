const { successResponse, errorResponse } = require("../utils/apiResponse");
const promptSettingsService = require("../services/prompt-settings.service");

function _getRequestClientId(req) {
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "clientId")) {
    return req.user.clientId;
  }
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "client_id")) {
    return req.user.client_id;
  }
  return req.clientId || null;
}

const getClientPromptSettings = async (req, res, next) => {
  try {
    const clientId = _getRequestClientId(req);
    const settings = promptSettingsService.getClientPromptSettings(clientId);
    return res.json(successResponse(settings));
  } catch (error) {
    return next(error);
  }
};

const updateClientPromptSettings = async (req, res, next) => {
  try {
    const clientId = _getRequestClientId(req);
    const settings = promptSettingsService.setClientPromptSettings(clientId, req.body || {});
    return res.json(successResponse(settings));
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json(errorResponse(error.message || "Unable to save prompt settings."));
  }
};

const resetClientPromptSettings = async (req, res, next) => {
  try {
    const clientId = _getRequestClientId(req);
    const settings = promptSettingsService.initClientPromptSettings(clientId);
    return res.json(successResponse(settings));
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json(errorResponse(error.message || "Unable to reset prompt settings."));
  }
};

module.exports = {
  getClientPromptSettings,
  updateClientPromptSettings,
  resetClientPromptSettings,
};
