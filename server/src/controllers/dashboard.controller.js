const { successResponse, errorResponse } = require("../utils/apiResponse");
const chatbotService = require("../services/chatbot.service");
const contextService = require("../services/context.service");
const configService = require("../services/config.service");
const clientConfigService = require("../services/client-config.service");
const adminService = require("../services/admin.service");
const tokenService = require("../services/token.service");
const { DEFAULT_CLIENT_ID } = require("../config/env");

function _resolveClientId(req) {
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "clientId")) {
    return req.user.clientId;
  }
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "client_id")) {
    return req.user.client_id;
  }
  return req.clientId || DEFAULT_CLIENT_ID;
}

const getDashboardSummary = async (req, res, next) => {
  try {
    const clientId = _resolveClientId(req);
    const config = configService.getConfig();
    const quota = tokenService.checkQuotaStatus(clientId);
    const effectiveQuota = tokenService.getEffectiveQuota(clientId);
    const genConfig = clientConfigService.getPublicClientConfig(clientId);
    const contexts = contextService.listContexts(clientId);
    const chatbots = chatbotService.listChatbots(clientId);

    return res.json(
      successResponse({
        clientId,
        contextsGenerated: contexts.length,
        chatbotsCreated: chatbots.length,
        todayTokensUsed: quota.tokensUsed,
        todayRequests: tokenService.getDailyUsage(clientId).totalRequests,
        dailyTokenLimit: genConfig?.dailyTokenLimit || quota.dailyLimit,
        tokensRemaining: quota.tokensRemaining,
        cooldownDurationMinutes: Number(config?.quotas?.default_cooldown_minutes || quota.cooldownDurationMinutes || 0),
        usagePercent: Number(
          (quota.dailyLimit > 0 ? (quota.tokensUsed / quota.dailyLimit) * 100 : 0).toFixed(2),
        ),
        accountStatus: quota.status,
        cooldownUntil: quota.cooldownUntil,
        planName: quota.planName,
        warningLevel: quota.status,
        quotaDefaults: {
          cooldownDurationMinutes: Number(config?.quotas?.default_cooldown_minutes || 0),
        },
        quotaEffective: effectiveQuota,
        hasGenerationConfig: Boolean(genConfig?.hasApiKey),
      }),
    );
  } catch (error) {
    return next(error);
  }
};

const getTodayUsage = async (req, res, next) => {
  try {
    const clientId = _resolveClientId(req);
    return res.json(successResponse(tokenService.getDailyUsage(clientId)));
  } catch (error) {
    return next(error);
  }
};

const getWeekUsage = async (req, res, next) => {
  try {
    const clientId = _resolveClientId(req);
    return res.json(successResponse(tokenService.getWeeklyUsage(clientId, 7)));
  } catch (error) {
    return next(error);
  }
};

const getMonthUsage = async (req, res, next) => {
  try {
    const clientId = _resolveClientId(req);
    return res.json(successResponse(tokenService.getMonthlyUsage(clientId, 30)));
  } catch (error) {
    return next(error);
  }
};

const getQuotaStatus = async (req, res, next) => {
  try {
    const clientId = _resolveClientId(req);
    return res.json(successResponse(tokenService.checkQuotaStatus(clientId)));
  } catch (error) {
    return next(error);
  }
};

const resetUsage = async (req, res, next) => {
  try {
    const client = adminService.resetClientUsage(req.user?.id || req.clientId || DEFAULT_CLIENT_ID);
    if (!client) {
      return res.status(404).json(errorResponse("Client not found."));
    }
    return res.json(
      successResponse({
        message: "Usage reset.",
        quota: tokenService.checkQuotaStatus(req.clientId || DEFAULT_CLIENT_ID),
      }),
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getTodayUsage,
  getWeekUsage,
  getMonthUsage,
  getQuotaStatus,
  resetUsage,
};
