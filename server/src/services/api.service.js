const axios = require("axios");

const { FASTAPI_BASE_URL } = require("../config/env");

const apiClient = axios.create({
  baseURL: FASTAPI_BASE_URL,
  timeout: 10000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

module.exports = apiClient;
