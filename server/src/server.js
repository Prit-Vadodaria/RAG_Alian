const app = require("./app");
const {
  PORT,
  DEFAULT_CLIENT_ID,
} = require("./config/env");
const configService = require("./services/config.service");
const { runStartupMigrations } = require("./services/migration.service");
const tokenService = require("./services/token.service");

try {
  configService.ensureDefaultConfig();
  const migrationResults = runStartupMigrations();
  console.log(
    `[migration] users seeded=${migrationResults.usersSeeded} chatbots=${migrationResults.chatbotsNormalized} contexts=${migrationResults.contextsNormalized}`,
  );
} catch (error) {
  console.error("[migration] startup migration failed:", error.message);
}

app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});

try {
  const client = tokenService.getOrCreateClient(DEFAULT_CLIENT_ID);
  const quota = tokenService.checkQuotaStatus(DEFAULT_CLIENT_ID);
  console.log(
    `[quota] Seeded client '${client.client_id}' with daily limit ${client.daily_limit} and status '${quota.status}'`,
  );
} catch (error) {
  console.error("[quota] Failed to seed client:", error.message);
}

setInterval(() => {
  try {
    tokenService.clearExpiredCooldowns();
  } catch (error) {
    console.error("[quota] cooldown sweep error:", error.message);
  }
}, 5 * 60 * 1000).unref?.();

setInterval(() => {
  try {
    tokenService.pruneOldEvents(90);
  } catch (error) {
    console.error("[quota] prune error:", error.message);
  }
}, 7 * 24 * 60 * 60 * 1000).unref?.();
