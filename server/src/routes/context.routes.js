const express = require("express");

const {
  getContexts,
  createContext,
  deleteContext,
  getContextStatus,
} = require("../controllers/context.controller");

const router = express.Router();

router.get("/", getContexts);
router.post("/", createContext);
router.delete("/:contextId", deleteContext);
router.get("/:contextId/status", getContextStatus);

module.exports = router;
