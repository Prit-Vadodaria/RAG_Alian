const { successResponse, errorResponse } = require("../utils/apiResponse");
const chatbotService = require("../services/chatbot.service");
const { askRag } = require("../services/rag.service");

function _getRequestOrigin(req) {
  return req.get("origin") || req.get("referer") || "";
}

function _normalizeVisitorId(visitorId) {
  if (typeof visitorId !== "string") return "";
  return visitorId.trim().slice(0, 128);
}

const getPublicChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.getChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    return res.json(successResponse(chatbotService.getPublicChatbotConfig(chatbot)));
  } catch (error) {
    return next(error);
  }
};

const publicChat = async (req, res, next) => {
  try {
    const chatbotId = String(req.body?.chatbot_id || "").trim();
    const message = String(req.body?.message || "").trim();
    const visitorId = _normalizeVisitorId(req.body?.visitor_id || "");

    if (!chatbotId) {
      return res.status(400).json(errorResponse("'chatbot_id' is required."));
    }
    if (!message) {
      return res.status(400).json(errorResponse("'message' is required."));
    }

    const chatbot = chatbotService.getChatbot(chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    if (!chatbot.is_active) {
      return res.status(403).json(errorResponse("This chatbot is disabled."));
    }

    const origin = _getRequestOrigin(req);
    if (!chatbotService.isOriginAllowed(chatbot, origin)) {
      return res.status(403).json(errorResponse("Origin is not allowed for this chatbot."));
    }

    const contextId = chatbot.primary_context_id || chatbot.context_ids?.[0] || "";
    if (!contextId) {
      return res.status(400).json(errorResponse("Chatbot is not bound to a website context."));
    }
    const ragOptions = {
      chatbot_id: chatbot.id,
      namespace: chatbot.namespace,
      visitor_id: visitorId,
      origin,
      prompt_settings: chatbot.prompt_config,
    };

    let response;
    try {
      response = await askRag(message, contextId, ragOptions);
    } catch (error) {
      const status = Number(error?.status || 0);
      // If the chatbot-scoped retrieval path fails, fall back to the bound
      // website context so the widget still behaves like the dashboard chat.
      throw error;
    }

    return res.json(
      successResponse({
        ...response,
        chatbot_id: chatbot.id,
        namespace: chatbot.namespace,
      }),
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPublicChatbot,
  publicChat,
};
