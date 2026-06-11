const { successResponse, errorResponse } = require("../utils/apiResponse");
const adminService = require("../services/admin.service");

const getStats = async (req, res, next) => {
  try {
    return res.json(successResponse(adminService.getStats()));
  } catch (error) {
    return next(error);
  }
};

const listClients = async (req, res, next) => {
  try {
    return res.json(successResponse(adminService.listClients()));
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

module.exports = {
  getStats,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  resetClientUsage,
};
