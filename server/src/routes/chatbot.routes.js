const express = require("express");

const {
  listChatbots,
  createChatbot,
  getChatbot,
  updateChatbot,
  disableChatbot,
  enableChatbot,
  deleteChatbot,
  exportSnippet,
} = require("../controllers/chatbot.controller");

const router = express.Router();

router.get("/", listChatbots);
router.post("/", createChatbot);
router.get("/:chatbotId", getChatbot);
router.patch("/:chatbotId", updateChatbot);
router.post("/:chatbotId/enable", enableChatbot);
router.post("/:chatbotId/disable", disableChatbot);
router.delete("/:chatbotId", deleteChatbot);
router.get("/:chatbotId/export", exportSnippet);

module.exports = router;
