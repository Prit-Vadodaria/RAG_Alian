import { createApiClient } from "./http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

const hasDataKey = (response) =>
  Boolean(response && response.data && Object.prototype.hasOwnProperty.call(response.data, "data"));

const unwrap = (response) => (hasDataKey(response) ? response.data.data : response.data);

export const getClientPromptSettings = async () => {
  try {
    return unwrap(await client.get("/prompt-settings"));
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const saveClientPromptSettings = async (settings) =>
  unwrap(await client.put("/prompt-settings", settings));

export const resetClientPromptSettings = async () =>
  unwrap(await client.post("/prompt-settings/reset"));

export const getContextPromptSettings = async (contextId) => {
  try {
    return unwrap(
      await client.get(`/contexts/${encodeURIComponent(contextId)}/prompt-settings`),
    );
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const saveContextPromptSettings = async (contextId, settings) =>
  unwrap(
    await client.put(
      `/contexts/${encodeURIComponent(contextId)}/prompt-settings`,
      settings,
    ),
  );

export const deleteContextPromptSettings = async (contextId) =>
  unwrap(
    await client.delete(`/contexts/${encodeURIComponent(contextId)}/prompt-settings`),
  );

export default {
  getClientPromptSettings,
  saveClientPromptSettings,
  resetClientPromptSettings,
  getContextPromptSettings,
  saveContextPromptSettings,
  deleteContextPromptSettings,
};
