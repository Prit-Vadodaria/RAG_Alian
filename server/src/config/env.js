const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = process.env.PORT || 5000;
const FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000/api";
const FASTAPI_TIMEOUT_MS = Number(process.env.FASTAPI_TIMEOUT_MS || 120000);
const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || "client_owner";
const DEFAULT_DAILY_TOKEN_LIMIT = Number(
  process.env.DEFAULT_DAILY_TOKEN_LIMIT || 100000,
);
const DEFAULT_COOLDOWN_MINUTES = Number(
  process.env.DEFAULT_COOLDOWN_MINUTES || 1440,
);
const OWNER_API_KEY = process.env.OWNER_API_KEY || "";

module.exports = {
  PORT,
  FASTAPI_BASE_URL,
  FASTAPI_TIMEOUT_MS,
  DEFAULT_CLIENT_ID,
  DEFAULT_DAILY_TOKEN_LIMIT,
  DEFAULT_COOLDOWN_MINUTES,
  OWNER_API_KEY,
};
