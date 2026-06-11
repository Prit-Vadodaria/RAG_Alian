const { successResponse, errorResponse } = require("../utils/apiResponse");
const authService = require("../services/auth.service");
const { REGISTRATION_ENABLED } = require("../config/env");

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

    if (!email || !name || !password) {
      return res.status(400).json(errorResponse("'email', 'name', and 'password' are required."));
    }

    const user = authService.createUser({ email, name, password, role: "client" });
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
