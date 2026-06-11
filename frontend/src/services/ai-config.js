import { createApiClient } from "./http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);
const unwrap = (res) => res.data?.data ?? res.data;

export const getAiConfig = async () => unwrap(await client.get("/ai-config"));
export const updateAiConfig = async (payload) =>
  unwrap(await client.put("/ai-config", payload));
