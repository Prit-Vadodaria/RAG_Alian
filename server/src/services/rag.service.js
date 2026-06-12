const apiClient = require("./api.service");
const clientConfigService = require("./client-config.service");
const contextService = require("./context.service");
const promptSettingsService = require("./prompt-settings.service");
const tokenService = require("./token.service");
const { BYOK_ENABLED } = require("../config/env");

const askRag = async (query, contextId = "", options = {}) => {
  try {
    const clientId = String(options.clientId || "").trim();
    let generationConfig = null;

    if (BYOK_ENABLED) {
      const genConfig = clientId ? clientConfigService.getClientConfig(clientId) : null;
      if (!genConfig || !genConfig.googleApiKey) {
        const error = new Error("Generation configuration is required. Please configure your Google API key in settings.");
        error.status = 403;
        throw error;
      }

      generationConfig = {
        google_api_key: genConfig.googleApiKey,
        model: genConfig.model,
        timeout_seconds: genConfig.timeoutSeconds,
        temperature: genConfig.temperature,
        max_output_tokens: genConfig.maxOutputTokens,
        max_retries: genConfig.maxRetries,
        retry_backoff: genConfig.retryBackoff,
      };
    }

    const contextSettings = contextService.getContextPromptSettings(contextId);
    const clientSettings = clientId ? promptSettingsService.getClientPromptSettings(clientId) : null;
    const resolvedPromptSettings = contextSettings || clientSettings || undefined;

    const response = await apiClient.post("/ask", {
      query,
      context_id: contextId,
      ...options,
      prompt_settings: resolvedPromptSettings,
      ...(generationConfig ? { generation_config: generationConfig } : {}),
    });

    if (!response || !response.data) {
      const error = new Error("Invalid response from FastAPI RAG service.");
      error.status = 502;
      throw error;
    }

    const metrics = response.data?.metrics || {};
    if (!clientId) {
      const error = new Error("Client scope is required to record token usage.");
      error.status = 400;
      throw error;
    }

    setImmediate(() => {
      try {
        tokenService.recordTokenEvent(clientId, {
          chatbot_id: options?.chatbot_id || null,
          context_id: contextId || null,
          input_tokens: metrics.input_tokens || 0,
          output_tokens: metrics.output_tokens || 0,
          total_tokens: metrics.total_tokens || 0,
          latency_ms: metrics.total_latency_ms || metrics.latency_ms || 0,
          model: process.env.GOOGLE_MODEL || "gemini-3.1-flash-lite",
          reranker_status: response.data?.reranker_status || null,
        });
      } catch (err) {
        console.error("[token] recordTokenEvent failed:", err.message);
      }
    });

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
