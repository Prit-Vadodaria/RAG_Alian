const express = require("express");
const {
  getStats,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  resetClientUsage,
  getPromptSettings,
  updatePromptSettings,
  listAllContexts,
  listAllChatbots,
} = require("../controllers/admin.controller");

const router = express.Router();

router.get("/stats", getStats);
router.get("/clients", listClients);
router.get("/clients/:clientId", getClient);
router.patch("/clients/:clientId", updateClient);
router.delete("/clients/:clientId", deleteClient);
router.post("/clients/:clientId/reset-usage", resetClientUsage);
router.get("/prompt-settings", getPromptSettings);
router.put("/prompt-settings", updatePromptSettings);
router.get("/contexts", listAllContexts);
router.get("/chatbots", listAllChatbots);

module.exports = router;
