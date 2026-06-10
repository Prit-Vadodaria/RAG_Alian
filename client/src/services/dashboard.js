import axios from "axios";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = axios.create({
  baseURL: SERVER_BASE,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const unwrap = (response) => response.data?.data ?? response.data;

export const getDashboardSummary = async () =>
  unwrap(await client.get("/dashboard/summary"));

export default {
  getDashboardSummary,
};
