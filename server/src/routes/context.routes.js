const express = require("express");

const {
  getContexts,
  createContext,
  deleteContext,
  getContextStatus,
  getContextDefaults,
} = require("../controllers/context.controller");

const router = express.Router();

router.get("/", getContexts);
router.get("/defaults", getContextDefaults);
router.post("/", createContext);
router.delete("/:contextId", deleteContext);
router.get("/:contextId/status", getContextStatus);

module.exports = router;
