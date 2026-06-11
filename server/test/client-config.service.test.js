const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

process.env.CONFIG_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const service = require("../src/services/client-config.service");

const DATA_DIR = path.resolve(__dirname, "../data");
const CLIENT_CONFIGS_PATH = path.join(DATA_DIR, "client_configs.json");
const QUOTA_STATE_PATH = path.join(DATA_DIR, "quota_state.json");

const ORIGINAL_CLIENT_CONFIGS = fs.readFileSync(CLIENT_CONFIGS_PATH, "utf8");
const ORIGINAL_QUOTA_STATE = fs.readFileSync(QUOTA_STATE_PATH, "utf8");

function resetFixtures() {
  fs.writeFileSync(CLIENT_CONFIGS_PATH, JSON.stringify({ version: 1, clients: {} }, null, 2), "utf8");
  fs.writeFileSync(QUOTA_STATE_PATH, ORIGINAL_QUOTA_STATE, "utf8");
}

test.after(() => {
  fs.writeFileSync(CLIENT_CONFIGS_PATH, ORIGINAL_CLIENT_CONFIGS, "utf8");
  fs.writeFileSync(QUOTA_STATE_PATH, ORIGINAL_QUOTA_STATE, "utf8");
});

test.beforeEach(() => {
  resetFixtures();
});

test("setClientConfig encrypts stored keys and masks public responses", () => {
  const saved = service.setClientConfig(
    "client_test",
    {
      googleApiKey: "abcd123456",
      model: "gemini-2.5-pro",
      timeoutSeconds: 120,
      temperature: 0.4,
      maxOutputTokens: 1024,
      maxRetries: 3,
      retryBackoff: 1.5,
      dailyTokenLimit: 2000,
    },
    { changedBy: "tester" },
  );

  assert.equal(saved.clientId, "client_test");
  assert.equal(saved.googleApiKey, "abcd123456");
  assert.equal(saved.model, "gemini-2.5-pro");
  assert.equal(saved.dailyTokenLimit, 2000);

  const publicConfig = service.getPublicClientConfig("client_test");
  assert.equal(publicConfig.googleApiKey, "***configured***");
  assert.equal(publicConfig.hasApiKey, true);

  const rawState = JSON.parse(fs.readFileSync(CLIENT_CONFIGS_PATH, "utf8"));
  assert.match(rawState.clients.client_test.googleApiKey, /^enc:/);

  const quotaState = JSON.parse(fs.readFileSync(QUOTA_STATE_PATH, "utf8"));
  assert.equal(quotaState.clients.client_test.daily_limit, 2000);
});

test("deleteClientConfig removes stored client generation config", () => {
  service.setClientConfig("client_delete", {
    googleApiKey: "abcd123456",
    model: "gemini-2.5-flash",
  });

  assert.equal(service.clientConfigExists("client_delete"), true);
  assert.equal(service.deleteClientConfig("client_delete"), true);
  assert.equal(service.clientConfigExists("client_delete"), false);
  assert.equal(service.getPublicClientConfig("client_delete"), null);
});
