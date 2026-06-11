const express = require("express");

const { getAiConfig, updateAiConfig } = require("../controllers/ai-config.controller");

const router = express.Router();

router.get("/", getAiConfig);
router.put("/", updateAiConfig);

module.exports = router;
