const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = process.env.PORT || 5000;
const FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000/api";
const FASTAPI_TIMEOUT_MS = Number(process.env.FASTAPI_TIMEOUT_MS || 120000);
const AUTH_ENABLED = String(process.env.AUTH_ENABLED || "true").toLowerCase() === "true";
const REGISTRATION_ENABLED =
  String(process.env.REGISTRATION_ENABLED || "true").toLowerCase() !== "false";
const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || "client_owner";
const DEFAULT_DAILY_TOKEN_LIMIT = Number(
  process.env.DEFAULT_DAILY_TOKEN_LIMIT || 100000,
);
const DEFAULT_COOLDOWN_MINUTES = Number(
  process.env.DEFAULT_COOLDOWN_MINUTES || 1440,
);
const OWNER_API_KEY = process.env.OWNER_API_KEY || "";
const BYOK_ENABLED = String(process.env.BYOK_ENABLED || "true").toLowerCase() !== "false";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@platform.local";
const ADMIN_NAME = process.env.ADMIN_NAME || "Platform Admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme123";
const JWT_SECRET = process.env.JWT_SECRET || "dev-auth-secret";
const JWT_EXPIRES_IN_SECONDS = Number(
  process.env.JWT_EXPIRES_IN_SECONDS || 24 * 60 * 60,
);

module.exports = {
  PORT,
  FASTAPI_BASE_URL,
  FASTAPI_TIMEOUT_MS,
  AUTH_ENABLED,
  REGISTRATION_ENABLED,
  DEFAULT_CLIENT_ID,
  DEFAULT_DAILY_TOKEN_LIMIT,
  DEFAULT_COOLDOWN_MINUTES,
  OWNER_API_KEY,
  BYOK_ENABLED,
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_PASSWORD,
  JWT_SECRET,
  JWT_EXPIRES_IN_SECONDS,
};
