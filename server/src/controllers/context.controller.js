const { successResponse, errorResponse } = require("../utils/apiResponse");
const contextService = require("../services/context.service");
const promptSettingsService = require("../services/prompt-settings.service");
const { DEFAULT_CLIENT_ID } = require("../config/env");

function _getRequestClientId(req) {
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "clientId")) {
    return req.user.clientId;
  }
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "client_id")) {
    return req.user.client_id;
  }
  return req.clientId || DEFAULT_CLIENT_ID;
}

const getContexts = async (req, res, next) => {
  try {
    const contexts = await contextService.listContexts(_getRequestClientId(req));
    return res.json(successResponse(contexts));
  } catch (err) {
    return next(err);
  }
};

const createContext = async (req, res, next) => {
  try {
    const { url, chunking } = req.body || {};
    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json(errorResponse("'url' is required."));
    }
    const result = await contextService.createContext(url.trim(), { chunking }, _getRequestClientId(req));
    return res.status(202).json(successResponse(result));
  } catch (err) {
    return next(err);
  }
};

const getContextDefaults = async (req, res, next) => {
  try {
    const defaults = await contextService.getContextDefaults();
    return res.json(successResponse(defaults));
  } catch (err) {
    return next(err);
  }
};

const getContextPromptSettings = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId) {
      return res.status(400).json(errorResponse("contextId required"));
    }
    const context = contextService.getContext(contextId, _getRequestClientId(req));
    if (!context) {
      return res.status(404).json(errorResponse("Context not found"));
    }
    const settings = contextService.getContextPromptSettings(contextId);
    return res.json(successResponse(settings));
  } catch (err) {
    return next(err);
  }
};

const updateContextPromptSettings = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId) {
      return res.status(400).json(errorResponse("contextId required"));
    }
    const context = contextService.getContext(contextId, _getRequestClientId(req));
    if (!context) {
      return res.status(404).json(errorResponse("Context not found"));
    }

    const validation = promptSettingsService.validatePromptSettings(req.body || {});
    if (!validation.valid) {
      return res.status(400).json(errorResponse(validation.error));
    }

    const settings = contextService.setContextPromptSettings(contextId, {
      ...(req.body || {}),
      role: String(req.body?.role || "").trim(),
      constraints: Array.isArray(req.body?.constraints)
        ? req.body.constraints.map((constraint) =>
            typeof constraint === "string" ? constraint.trim() : constraint,
          )
        : [],
    });
    return res.json(successResponse(settings));
  } catch (err) {
    const status = Number(err?.status || 500);
    return res.status(status).json(errorResponse(err.message || "Unable to save prompt settings."));
  }
};

const deleteContextPromptSettings = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId) {
      return res.status(400).json(errorResponse("contextId required"));
    }
    const context = contextService.getContext(contextId, _getRequestClientId(req));
    if (!context) {
      return res.status(404).json(errorResponse("Context not found"));
    }
    contextService.deleteContextPromptSettings(contextId);
    return res.json(successResponse({ message: "Prompt settings removed." }));
  } catch (err) {
    return next(err);
  }
};

const deleteContext = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId)
      return res.status(400).json(errorResponse("contextId required"));
    await contextService.deleteContext(contextId, _getRequestClientId(req));
    return res.json(successResponse({ message: "Context deleted" }));
  } catch (err) {
    return next(err);
  }
};

const getContextStatus = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId)
      return res.status(400).json(errorResponse("contextId required"));
    const info = await contextService.getContextStatus(contextId, _getRequestClientId(req));
    if (!info) return res.status(404).json(errorResponse("Context not found"));
    if (typeof info === "string")
      return res.json(successResponse({ status: info }));
    return res.json(
      successResponse({ status: info.status, logPreview: info.logPreview, progress: info.progress || {} }),
    );
  } catch (err) {
    return next(err);
  }
};

const pauseContext = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId) {
      return res.status(400).json(errorResponse("contextId required"));
    }
    const info = await contextService.pauseContext(contextId, _getRequestClientId(req));
    return res.json(successResponse(info));
  } catch (err) {
    return next(err);
  }
};

const resumeContext = async (req, res, next) => {
  try {
    const { contextId } = req.params;
    if (!contextId) {
      return res.status(400).json(errorResponse("contextId required"));
    }
    const info = await contextService.resumeContext(contextId, _getRequestClientId(req));
    return res.json(successResponse(info));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getContexts,
  createContext,
  deleteContext,
  getContextStatus,
  getContextDefaults,
  getContextPromptSettings,
  updateContextPromptSettings,
  deleteContextPromptSettings,
  pauseContext,
  resumeContext,
};
