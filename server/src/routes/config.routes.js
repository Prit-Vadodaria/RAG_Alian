const express = require("express");
const {
  getConfig,
  updateConfig,
  getPublicConfig,
} = require("../controllers/config.controller");

const router = express.Router();

router.get("/", getConfig);
router.put("/", updateConfig);
router.get("/public", getPublicConfig);

module.exports = router;
