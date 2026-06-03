const axios = require("axios");

const { FASTAPI_BASE_URL, FASTAPI_TIMEOUT_MS } = require("../config/env");

const apiClient = axios.create({
  baseURL: FASTAPI_BASE_URL,
  timeout: FASTAPI_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

module.exports = apiClient;
