const express = require("express");
const {
  getStats,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  resetClientUsage,
} = require("../controllers/admin.controller");

const router = express.Router();

router.get("/stats", getStats);
router.get("/clients", listClients);
router.get("/clients/:clientId", getClient);
router.patch("/clients/:clientId", updateClient);
router.delete("/clients/:clientId", deleteClient);
router.post("/clients/:clientId/reset-usage", resetClientUsage);

module.exports = router;
