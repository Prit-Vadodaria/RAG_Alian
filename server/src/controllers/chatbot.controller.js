const { successResponse, errorResponse } = require("../utils/apiResponse");
const chatbotService = require("../services/chatbot.service");

const listChatbots = async (req, res, next) => {
  try {
    return res.json(successResponse(chatbotService.listChatbots()));
  } catch (error) {
    return next(error);
  }
};

const createChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.createChatbot(req.body || {});
    return res.status(201).json(successResponse(chatbot));
  } catch (error) {
    if (error?.message === "A website context is required to create a chatbot.") {
      return res.status(400).json(errorResponse(error.message));
    }
    return next(error);
  }
};

const getChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.getChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    return res.json(successResponse(chatbot));
  } catch (error) {
    return next(error);
  }
};

const updateChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.updateChatbot(req.params.chatbotId, req.body || {});
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    return res.json(successResponse(chatbot));
  } catch (error) {
    return next(error);
  }
};

const disableChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.disableChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    return res.json(successResponse(chatbot));
  } catch (error) {
    return next(error);
  }
};

const enableChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.enableChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    return res.json(successResponse(chatbot));
  } catch (error) {
    return next(error);
  }
};

const deleteChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.deleteChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    return res.json(successResponse(chatbot));
  } catch (error) {
    return next(error);
  }
};

const exportSnippet = async (req, res, next) => {
  try {
    const chatbot = chatbotService.getChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }

    const widgetBaseUrl =
      typeof req.query.widget_base === "string" && req.query.widget_base.trim()
        ? req.query.widget_base.trim()
        : `${req.protocol}://${req.get("host")}`;
    const apiBaseUrl =
      typeof req.query.api_base === "string" && req.query.api_base.trim()
        ? req.query.api_base.trim()
        : `${req.protocol}://${req.get("host")}`;

    return res.json(
      successResponse({
        chatbot_id: chatbot.id,
        snippet: chatbotService.buildEmbedSnippet(chatbot.id, widgetBaseUrl, apiBaseUrl),
      }),
    );
  } catch (error) {
    return next(error);
  }
};

const reindexChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.getChatbot(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json(errorResponse("Chatbot not found."));
    }
    const result = await chatbotService.reindexChatbot(chatbot.id);
    return res.status(result ? 200 : 404).json(
      successResponse({
        chatbot_id: chatbot.id,
        reindex_status: result?.status || "failed",
        chroma_dir: result?.chroma_dir || chatbot.chroma_dir,
        collection_name: result?.collection_name || chatbot.collection_name,
      }),
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listChatbots,
  createChatbot,
  getChatbot,
  updateChatbot,
  disableChatbot,
  enableChatbot,
  deleteChatbot,
  exportSnippet,
  reindexChatbot,
};
