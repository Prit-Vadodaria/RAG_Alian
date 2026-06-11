const { errorResponse } = require("../utils/apiResponse");
const authService = require("../services/auth.service");
const { AUTH_ENABLED, DEFAULT_CLIENT_ID } = require("../config/env");

function _extractBearerToken(req) {
  const header = String(req.header("authorization") || req.header("Authorization") || "").trim();
  if (!header) return "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function attachAuthContext(req, res, next) {
  try {
    if (!AUTH_ENABLED) {
      req.user = authService.getDefaultAuthContext();
      req.clientId = req.user.clientId || DEFAULT_CLIENT_ID;
      return next();
    }

    const token = _extractBearerToken(req);
    if (!token) {
      return res.status(401).json(errorResponse("Authentication required."));
    }

    const payload = authService.verifyToken(token);
    const user = authService.findUserById(payload.sub);
    if (!user) {
      return res.status(401).json(errorResponse("User not found."));
    }
    if (user.status !== "active") {
      return res.status(403).json(errorResponse("User account is disabled."));
    }

    req.user = {
      ...user,
      clientId: Object.prototype.hasOwnProperty.call(payload, "client_id")
        ? payload.client_id
        : user.client_id,
    };
    req.clientId = req.user.clientId || DEFAULT_CLIENT_ID;
    return next();
  } catch (error) {
    const status = Number(error?.status || 401);
    return res.status(status).json(errorResponse(error.message || "Authentication failed."));
  }
}

function requireAdmin(req, res, next) {
  if (!AUTH_ENABLED) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json(errorResponse("Authentication required."));
  }

  if (req.user.role !== "admin") {
    return res.status(403).json(errorResponse("Admin access required."));
  }

  return next();
}

module.exports = {
  attachAuthContext,
  requireAdmin,
};
