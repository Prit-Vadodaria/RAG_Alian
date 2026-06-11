const { successResponse, errorResponse } = require("../utils/apiResponse");
const configService = require("../services/config.service");

const getConfig = async (req, res, next) => {
  try {
    return res.json(successResponse(configService.getConfig()));
  } catch (error) {
    return next(error);
  }
};

const updateConfig = async (req, res, next) => {
  try {
    const config = configService.updateConfig(req.body || {}, req.user?.id || "system");
    return res.json(successResponse(config));
  } catch (error) {
    return next(error);
  }
};

const getPublicConfig = async (req, res, next) => {
  try {
    return res.json(successResponse(configService.getPublicConfig()));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getConfig,
  updateConfig,
  getPublicConfig,
};
