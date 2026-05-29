const { successResponse, errorResponse } = require("../utils/apiResponse");
const { askRag } = require("../services/rag.service");

const chatController = async (req, res, next) => {
  try {
    const { query, context_id } = req.body;

    if (typeof query !== "string" || !query.trim()) {
      return res
        .status(400)
        .json(
          errorResponse("Query is required and must be a non-empty string."),
        );
    }

    const ctx =
      typeof context_id === "string" && context_id.trim()
        ? context_id.trim()
        : "alian_default";
    const response = await askRag(query.trim(), ctx);

    return res.json(successResponse(response));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  chatController,
};
