import axios from "axios";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5000/api";

console.debug("Context API base:", SERVER_BASE);

const client = axios.create({
  baseURL: SERVER_BASE,
  timeout: 60000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

// Log requests and surface richer errors for debugging
client.interceptors.request.use((cfg) => {
  console.debug("CTX REQ", cfg.method, cfg.url);
  return cfg;
});
client.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize axios error for better messages in UI
    try {
      if (err.response) {
        const { status, data } = err.response;
        console.error("CTX RESP ERR", status, data);
        err.message = `HTTP ${status}: ${JSON.stringify(data)}`;
      } else if (err.request) {
        console.error("CTX NO RESP", err.message);
        err.message = `No response from server: ${err.message}`;
      } else {
        console.error("CTX REQ ERR", err.message);
      }
    } catch (e) {
      console.error(e);
    }
    return Promise.reject(err);
  },
);

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
  getContextStatus,
};
