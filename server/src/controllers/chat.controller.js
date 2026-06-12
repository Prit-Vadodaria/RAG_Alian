const { successResponse, errorResponse } = require("../utils/apiResponse");
const { askRag } = require("../services/rag.service");
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

const chatController = async (req, res, next) => {
  try {
    const { query, context_id, chatbot_id, namespace, visitor_id, origin } = req.body;

    if (typeof query !== "string" || !query.trim()) {
      return res
        .status(400)
        .json(
          errorResponse("Query is required and must be a non-empty string."),
        );
    }

    const ctx = typeof context_id === "string" ? context_id.trim() : "";
    if (!ctx) {
      return res
        .status(400)
        .json(errorResponse("context_id is required. Select a website context first."));
    }
    const response = await askRag(query.trim(), ctx, {
      chatbot_id,
      namespace,
      visitor_id,
      origin,
      clientId: _getRequestClientId(req),
    });

    return res.json(successResponse(response));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  chatController,
};
