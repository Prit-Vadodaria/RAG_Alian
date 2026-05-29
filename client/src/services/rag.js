import apiClient from "./api";

export const askRag = async (query, context_id = "alian_default") => {
  const response = await apiClient.post("/ask", { query, context_id });
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
