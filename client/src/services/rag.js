import apiClient from "./api";

export const askRag = async (
  query,
  context_id = "alian_default",
  prompt_settings = null,
) => {
  const payload = { query, context_id };
  if (prompt_settings) payload.prompt_settings = prompt_settings;

  const response = await apiClient.post("/ask", payload);
  if (!response?.data) {
    throw new Error("No response returned from the RAG service.");
  }
  if (response.data.success === false) {
    throw new Error(response.data.error || "RAG service rejected the inquiry.");
  }
  return response.data;
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
