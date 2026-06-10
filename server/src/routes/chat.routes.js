const express = require("express");

const { chatController } = require("../controllers/chat.controller");
const { quotaMiddleware } = require("../middleware/quota.middleware");

const router = express.Router();

router.post("/", quotaMiddleware, chatController);

module.exports = router;
