const { successResponse, errorResponse } = require("../utils/apiResponse");
const { askRag } = require("../services/rag.service");

const chatController = async (req, res, next) => {
  try {
    const { query } = req.body;

    if (typeof query !== "string" || !query.trim()) {
      return res
        .status(400)
        .json(
          errorResponse("Query is required and must be a non-empty string."),
        );
    }

    const response = await askRag(query.trim());

    return res.json(successResponse(response));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  chatController,
};
