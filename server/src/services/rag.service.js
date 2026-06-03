const apiClient = require("./api.service");

const askRag = async (query, contextId = "", options = {}) => {
  try {
    const response = await apiClient.post("/ask", {
      query,
      context_id: contextId,
      ...options,
    });

    if (!response || !response.data) {
      const error = new Error("Invalid response from FastAPI RAG service.");
      error.status = 502;
      throw error;
    }

    return response.data;
  } catch (err) {
    if (err.response) {
      const message =
        err.response.data?.error ||
        err.response.statusText ||
        "FastAPI RAG service returned an error.";
      const error = new Error(message);
      error.status = err.response.status || 502;
      throw error;
    }

    if (err.code === "ECONNABORTED") {
      const timeoutError = new Error("FastAPI RAG service request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }

    const networkError = new Error("Unable to reach FastAPI RAG service.");
    networkError.status = 502;
    throw networkError;
  }
};

module.exports = {
  askRag,
};
