const { successResponse, errorResponse } = require("../utils/apiResponse");
const adminService = require("../services/admin.service");
const promptSettingsService = require("../services/prompt-settings.service");

const getStats = async (req, res, next) => {
  try {
    return res.json(successResponse(adminService.getStats()));
  } catch (error) {
    return next(error);
  }
};

const listClients = async (req, res, next) => {
  try {
    const filter = String(req.query?.filter || "").trim().toLowerCase();
    const result =
      filter === "unconfigured"
        ? {
            items: adminService.listUnconfiguredClients(),
            page: 1,
            limit: 25,
            totalItems: 0,
            totalPages: 1,
          }
        : adminService.listClients({
            search: req.query?.search,
            status: req.query?.status,
            page: req.query?.page,
            limit: req.query?.limit,
          });
    return res.json(successResponse(result));
  } catch (error) {
    return next(error);
  }
};

const getClient = async (req, res, next) => {
  try {
    const client = adminService.getClientDetails(req.params.clientId);
    if (!client) {
      return res.status(404).json(errorResponse("Client not found."));
    }
    return res.json(successResponse(client));
  } catch (error) {
    return next(error);
  }
};

const updateClient = async (req, res, next) => {
  try {
    const client = adminService.updateClientStatus(req.params.clientId, req.body?.status);
    if (!client) {
      return res.status(404).json(errorResponse("Client not found."));
    }
    return res.json(successResponse(client));
  } catch (error) {
    return next(error);
  }
};

const deleteClient = async (req, res, next) => {
  try {
    const client = adminService.deleteClient(req.params.clientId);
    if (!client) {
      return res.status(404).json(errorResponse("Client not found."));
    }
    return res.json(successResponse(client));
  } catch (error) {
    return next(error);
  }
};

const resetClientUsage = async (req, res, next) => {
  try {
    const quota = adminService.resetClientUsage(req.params.clientId);
    if (!quota) {
      return res.status(404).json(errorResponse("Client not found."));
    }
    return res.json(successResponse(quota));
  } catch (error) {
    return next(error);
  }
};

const getPromptSettings = async (req, res, next) => {
  try {
    const settings = promptSettingsService.getSeedPromptSettings();
    return res.json(successResponse(settings));
  } catch (error) {
    return next(error);
  }
};

const listAllContexts = async (req, res, next) => {
  try {
    const { search, status, sortBy, sortDir, page, limit } = req.query;
    const result = adminService.listAllContextsAdmin({
      search: String(search || ""),
      status: String(status || ""),
      sortBy: String(sortBy || "created_at"),
      sortDir: String(sortDir || "desc"),
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 25)),
    });
    return res.json(successResponse(result));
  } catch (error) {
    return next(error);
  }
};

const listAllChatbots = async (req, res, next) => {
  try {
    const { search, status, sortBy, sortDir, page, limit } = req.query;
    const result = adminService.listAllChatbotsAdmin({
      search: String(search || ""),
      status: String(status || ""),
      sortBy: String(sortBy || "created_at"),
      sortDir: String(sortDir || "desc"),
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 25)),
    });
    return res.json(successResponse(result));
  } catch (error) {
    return next(error);
  }
};

const updatePromptSettings = async (req, res, next) => {
  try {
    const changedBy = req.user?.id || req.user?.email || "admin";
    const settings = promptSettingsService.setSeedPromptSettings(req.body || {}, {
      changedBy,
    });
    return res.json(successResponse(settings));
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json(errorResponse(error.message || "Unable to save prompt settings."));
  }
};

module.exports = {
  getStats,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  resetClientUsage,
  getPromptSettings,
  updatePromptSettings,
  listAllContexts,
  listAllChatbots,
};
