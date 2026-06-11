import { createApiClient } from "./http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

export const getContexts = async () => {
  const res = await client.get("/contexts");
  return res.data?.data || [];
};

export const getContextDefaults = async () => {
  const res = await client.get("/contexts/defaults");
  return res.data?.data || { chunking: {} };
};

export const createContext = async (url, options = {}) => {
  const payload = { url, ...options };
  const res = await client.post("/contexts", payload);
  return res.data?.data;
};

export const deleteContext = async (contextId) => {
  const res = await client.delete(`/contexts/${encodeURIComponent(contextId)}`);
  return res.data?.data;
};

export const pauseContext = async (contextId) => {
  const res = await client.post(`/contexts/${encodeURIComponent(contextId)}/pause`);
  return res.data?.data;
};

export const resumeContext = async (contextId) => {
  const res = await client.post(`/contexts/${encodeURIComponent(contextId)}/resume`);
  return res.data?.data;
};

export const getContextStatus = async (contextId) => {
  const res = await client.get(
    `/contexts/${encodeURIComponent(contextId)}/status`,
  );
  return res.data?.data;
};

export default {
  getContexts,
  getContextDefaults,
  createContext,
  deleteContext,
  pauseContext,
  resumeContext,
  getContextStatus,
};
