import { createApiClient } from "./http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE, 30000);

const unwrap = (response) => response.data?.data ?? response.data;

export const getDashboardSummary = async () =>
  unwrap(await client.get("/dashboard/summary"));

export const resetUsage = async () =>
  unwrap(await client.post("/dashboard/usage/reset"));

export default {
  getDashboardSummary,
  resetUsage,
};
