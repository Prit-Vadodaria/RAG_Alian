import { createApiClient } from "./http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

const unwrap = (response) => response.data?.data ?? response.data;

export const getStats = async () => unwrap(await client.get("/admin/stats"));

export const listClients = async () => unwrap(await client.get("/admin/clients"));

export const getClient = async (clientId) =>
  unwrap(await client.get(`/admin/clients/${encodeURIComponent(clientId)}`));

export const updateClient = async (clientId, payload) =>
  unwrap(await client.patch(`/admin/clients/${encodeURIComponent(clientId)}`, payload));

export const deleteClient = async (clientId) =>
  unwrap(await client.delete(`/admin/clients/${encodeURIComponent(clientId)}`));

export const resetClientUsage = async (clientId) =>
  unwrap(await client.post(`/admin/clients/${encodeURIComponent(clientId)}/reset-usage`));

export default {
  getStats,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  resetClientUsage,
};
