const { successResponse } = require("../utils/apiResponse");
const chatbotService = require("../services/chatbot.service");
const contextService = require("../services/context.service");
const tokenService = require("../services/token.service");
const {
  DEFAULT_CLIENT_ID,
  DEFAULT_COOLDOWN_MINUTES,
} = require("../config/env");

function _warningLevel(percent) {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= 70) return "warning";
  return "none";
}

function _resolveClientId(req) {
  return req.clientId || DEFAULT_CLIENT_ID;
}

const getDashboardSummary = async (req, res, next) => {
  try {
    const clientId = _resolveClientId(req);
    const quota = tokenService.checkQuotaStatus(clientId);
    const contexts = contextService.listContexts();
    const chatbots = chatbotService.listChatbots();

    const usagePercent =
      quota.dailyLimit > 0 ? (quota.tokensUsed / quota.dailyLimit) * 100 : 0;

    return res.json(
      successResponse({
        clientId,
        contextsGenerated: contexts.length,
        chatbotsCreated: chatbots.length,
        todayTokensUsed: quota.tokensUsed,
        todayRequests: tokenService.getDailyUsage(clientId).totalRequests,
        dailyTokenLimit: quota.dailyLimit,
        tokensRemaining: quota.tokensRemaining,
        cooldownDurationMinutes: DEFAULT_COOLDOWN_MINUTES,
        usagePercent: Number(usagePercent.toFixed(2)),
        accountStatus: quota.status,
        cooldownUntil: quota.cooldownUntil,
        planName: quota.planName,
        warningLevel: _warningLevel(usagePercent),
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

module.exports = {
  getDashboardSummary,
  getTodayUsage,
  getWeekUsage,
  getMonthUsage,
  getQuotaStatus,
};
