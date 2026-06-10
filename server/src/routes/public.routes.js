const express = require("express");

const { getPublicChatbot, publicChat } = require("../controllers/public.controller");
const { quotaMiddleware } = require("../middleware/quota.middleware");

const router = express.Router();

router.get("/chatbot/:chatbotId", getPublicChatbot);
router.post("/chat", quotaMiddleware, publicChat);

module.exports = router;
