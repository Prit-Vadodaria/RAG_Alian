import { createApiClient } from "./http";
import apiClient from "./api";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5000/api";

const serverClient = createApiClient(SERVER_BASE);

export const askRag = async (
  query,
  context_id = "",
  prompt_settings = null,
) => {
  const payload = { query, context_id };
  if (prompt_settings) payload.prompt_settings = prompt_settings;

  const response = await serverClient.post("/chat", payload);
  if (!response?.data) {
    throw new Error("No response returned from the RAG service.");
  }
  if (response.data.success === false) {
    throw new Error(response.data.error || "RAG service rejected the inquiry.");
  }
  return response.data.data ?? response.data;
};

export const pingHealth = async () => {
  const response = await apiClient.get("/health");
  return response.data;
};

export const getPromptSettings = async () => {
  const response = await apiClient.get("/prompt-settings");
  return response.data;
};

export const savePromptSettings = async (settings) => {
  const response = await apiClient.put("/prompt-settings", settings);
  return response.data;
};

export const resetPromptSettings = async () => {
  const response = await apiClient.post("/prompt-settings/reset");
  return response.data;
};
