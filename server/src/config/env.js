const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = process.env.PORT || 5000;
const FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000/api";

module.exports = {
  PORT,
  FASTAPI_BASE_URL,
};
