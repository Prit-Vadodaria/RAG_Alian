const { successResponse, errorResponse } = require("../utils/apiResponse");
const authService = require("../services/auth.service");
const { REGISTRATION_ENABLED } = require("../config/env");
const configService = require("../services/config.service");
const clientConfigService = require("../services/client-config.service");
const promptSettingsService = require("../services/prompt-settings.service");
const tokenService = require("../services/token.service");

const GOOGLE_API_KEY_PATTERN = /^[A-Za-z0-9._-]{10,}$/;

function _validateGenerationFields({
  googleApiKey,
  model,
}) {
  const errors = [];
  if (!googleApiKey) {
    errors.push("'googleApiKey' is required.");
  } else if (!GOOGLE_API_KEY_PATTERN.test(googleApiKey) || googleApiKey === "***configured***") {
    errors.push("'googleApiKey' appears invalid.");
  }

  if (!String(model || "").trim()) {
    errors.push("'model' is required.");
  }

  return errors;
}

const login = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json(errorResponse("'email' and 'password' are required."));
    }

    const user = authService.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json(errorResponse("Invalid email or password."));
    }

    return res.json(
      successResponse({
        user,
        token: authService.issueToken(user),
      }),
    );
  } catch (error) {
    return next(error);
  }
};

const signup = async (req, res, next) => {
  try {
    if (!REGISTRATION_ENABLED) {
      return res.status(403).json(errorResponse("Registration is currently disabled."));
    }

    const email = String(req.body?.email || "").trim();
    const name = String(req.body?.name || "").trim();
    const password = String(req.body?.password || "");
    const googleApiKey = String(req.body?.googleApiKey || "").trim();
    const model = String(req.body?.model || "").trim();
    const platformConfig = configService.getConfig();
    const dailyTokenLimit = Number(
      req.body?.dailyTokenLimit ||
        platformConfig?.registration?.signup_default_token_limit ||
        50000,
    );
    const timeoutSeconds = Number(req.body?.timeoutSeconds || 60);
    const temperature = req.body?.temperature !== undefined ? Number(req.body.temperature) : undefined;
    const maxOutputTokens = req.body?.maxOutputTokens !== undefined ? Number(req.body.maxOutputTokens) : undefined;
    const maxRetries = req.body?.maxRetries !== undefined ? Number(req.body.maxRetries) : undefined;
    const retryBackoff = req.body?.retryBackoff !== undefined ? Number(req.body.retryBackoff) : undefined;

    if (!email || !name || !password) {
      return res.status(400).json(errorResponse("'email', 'name', and 'password' are required."));
    }

    const generationErrors = _validateGenerationFields({
      googleApiKey,
      model,
    });
    if (generationErrors.length > 0) {
      return res.status(400).json(errorResponse(generationErrors.join(" ")));
    }

    const normalizedDailyTokenLimit = Number.isInteger(dailyTokenLimit) && dailyTokenLimit >= 1000
      ? dailyTokenLimit
      : Number(platformConfig?.registration?.signup_default_token_limit || 50000);
    const normalizedTimeoutSeconds = Number.isInteger(timeoutSeconds) && timeoutSeconds >= 10 && timeoutSeconds <= 300
      ? timeoutSeconds
      : 60;

    let user = null;
    try {
      user = authService.createUser({ email, name, password, role: "client" });
      promptSettingsService.initClientPromptSettings(user.client_id);
      clientConfigService.setClientConfig(
        user.client_id,
        {
          googleApiKey,
          model,
          timeoutSeconds: normalizedTimeoutSeconds,
          temperature,
          maxOutputTokens,
          maxRetries,
          retryBackoff,
          dailyTokenLimit: normalizedDailyTokenLimit,
        },
        { changedBy: user.id },
      );
      tokenService.applyClientDailyLimit(user.client_id, normalizedDailyTokenLimit);
    } catch (error) {
      if (user) {
        try {
          promptSettingsService.deleteClientPromptSettings(user.client_id);
        } catch {
          // best-effort rollback
        }
        try {
          authService.deleteUser(user.id);
        } catch {
          // best-effort rollback
        }
      }
      throw error;
    }

    return res.status(201).json(
      successResponse({
        user,
        token: authService.issueToken(user),
      }),
    );
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json(errorResponse(error.message || "Unable to create user."));
  }
};

const me = async (req, res, next) => {
  try {
    return res.json(successResponse(req.user || authService.getDefaultAuthContext()));
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    return res.json(successResponse({ message: "Logged out." }));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  signup,
  me,
  logout,
};
