const { successResponse, errorResponse } = require("../utils/apiResponse");
const chatbotService = require("../services/chatbot.service");
const { DEFAULT_CLIENT_ID } = require("../config/env");

function _getRequestClientId(req) {
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "clientId")) {
    return req.user.clientId;
  }
  if (req.user && Object.prototype.hasOwnProperty.call(req.user, "client_id")) {
    return req.user.client_id;
  }
  return req.clientId || DEFAULT_CLIENT_ID;
}

const listChatbots = async (req, res, next) => {
  try {
    return res.json(successResponse(chatbotService.listChatbots(_getRequestClientId(req))));
  } catch (error) {
    return next(error);
  }
};

const createChatbot = async (req, res, next) => {
  try {
    const chatbot = chatbotService.createChatbot(req.body || {}, _getRequestClientId(req));
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
    const chatbot = chatbotService.getChatbot(req.params.chatbotId, _getRequestClientId(req));
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
    const chatbot = chatbotService.updateChatbot(
      req.params.chatbotId,
      req.body || {},
      _getRequestClientId(req),
    );
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
    const chatbot = chatbotService.disableChatbot(req.params.chatbotId, _getRequestClientId(req));
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
    const chatbot = chatbotService.enableChatbot(req.params.chatbotId, _getRequestClientId(req));
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
    const chatbot = chatbotService.deleteChatbot(req.params.chatbotId, _getRequestClientId(req));
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
    const chatbot = chatbotService.getChatbot(req.params.chatbotId, _getRequestClientId(req));
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

module.exports = {
  listChatbots,
  createChatbot,
  getChatbot,
  updateChatbot,
  disableChatbot,
  enableChatbot,
  deleteChatbot,
  exportSnippet,
};
