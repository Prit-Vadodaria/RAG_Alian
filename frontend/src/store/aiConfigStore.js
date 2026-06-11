import { create } from "zustand";
import { getAiConfig, updateAiConfig } from "../services/ai-config";

export const useAiConfigStore = create((set) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await getAiConfig();
      set({ config, loading: false, error: null });
      return config;
    } catch (error) {
      set({ loading: false, error: error.message || String(error) });
      return null;
    }
  },

  saveConfig: async (updates) => {
    set({ loading: true, error: null });
    try {
      const config = await updateAiConfig(updates);
      set({ config, loading: false, error: null });
      return config;
    } catch (error) {
      set({ loading: false, error: error.message || String(error) });
      throw error;
    }
  },
}));
