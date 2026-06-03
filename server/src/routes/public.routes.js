const express = require("express");

const { getPublicChatbot, publicChat } = require("../controllers/public.controller");

const router = express.Router();

router.get("/chatbot/:chatbotId", getPublicChatbot);
router.post("/chat", publicChat);

module.exports = router;
