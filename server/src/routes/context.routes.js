const express = require("express");

const {
  getContexts,
  createContext,
  deleteContext,
  getContextStatus,
  getContextDefaults,
  getContextPromptSettings,
  updateContextPromptSettings,
  deleteContextPromptSettings,
  pauseContext,
  resumeContext,
} = require("../controllers/context.controller");

const router = express.Router();

router.get("/", getContexts);
router.get("/defaults", getContextDefaults);
router.post("/", createContext);
router.delete("/:contextId", deleteContext);
router.get("/:contextId/prompt-settings", getContextPromptSettings);
router.put("/:contextId/prompt-settings", updateContextPromptSettings);
router.delete("/:contextId/prompt-settings", deleteContextPromptSettings);
router.get("/:contextId/status", getContextStatus);
router.post("/:contextId/pause", pauseContext);
router.post("/:contextId/resume", resumeContext);

module.exports = router;
