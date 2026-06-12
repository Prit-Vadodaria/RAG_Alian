const express = require("express");

const {
  getClientPromptSettings,
  updateClientPromptSettings,
  resetClientPromptSettings,
} = require("../controllers/prompt-settings.controller");

const router = express.Router();

router.get("/", getClientPromptSettings);
router.put("/", updateClientPromptSettings);
router.post("/reset", resetClientPromptSettings);

module.exports = router;
