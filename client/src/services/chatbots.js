import axios from "axios";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5000/api";

const client = axios.create({
  baseURL: SERVER_BASE,
  timeout: 60000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

const unwrap = (response) => response.data?.data ?? response.data;

const stripApiSuffix = (value) => {
  const normalized = String(value || "").trim().replace(/\/$/, "");
  if (!normalized) return "";
  return normalized.replace(/\/api$/, "") || normalized;
};

export const listChatbots = async () => {
  const response = await client.get("/chatbots");
  return unwrap(response);
};

export const createChatbot = async (payload) => {
  const response = await client.post("/chatbots", payload);
  return unwrap(response);
};

export const updateChatbot = async (chatbotId, payload) => {
  const response = await client.patch(`/chatbots/${encodeURIComponent(chatbotId)}`, payload);
  return unwrap(response);
};

export const enableChatbot = async (chatbotId) => {
  const response = await client.post(`/chatbots/${encodeURIComponent(chatbotId)}/enable`);
  return unwrap(response);
};

export const disableChatbot = async (chatbotId) => {
  const response = await client.post(`/chatbots/${encodeURIComponent(chatbotId)}/disable`);
  return unwrap(response);
};

export const deleteChatbot = async (chatbotId) => {
  const response = await client.delete(`/chatbots/${encodeURIComponent(chatbotId)}`);
  return unwrap(response);
};

export const getChatbotEmbed = async (chatbotId, apiBase = SERVER_BASE) => {
  const widgetBase =
    typeof window !== "undefined" ? window.location.origin : apiBase.replace(/\/api$/, "");
  const response = await client.get(`/chatbots/${encodeURIComponent(chatbotId)}/export`, {
    params: { api_base: stripApiSuffix(apiBase), widget_base: widgetBase },
  });
  return unwrap(response);
};

export default {
  listChatbots,
  createChatbot,
  updateChatbot,
  enableChatbot,
  disableChatbot,
  deleteChatbot,
  getChatbotEmbed,
};
