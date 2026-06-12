import { create } from "zustand";
import {
  getClientPromptSettings,
  resetClientPromptSettings,
  saveClientPromptSettings,
} from "../services/prompt-settings";
import { validatePromptSettings } from "../utils/validatePromptSettings";

export const usePromptSettingsStore = create((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await getClientPromptSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  saveSettings: async (settings) => {
    const current = get().settings || {};
    const payload = {
      ...current,
      ...settings,
      constraints: Array.isArray(settings?.constraints)
        ? settings.constraints
        : current.constraints || [],
    };
    const validationError = validatePromptSettings(payload);
    if (validationError) {
      throw new Error(validationError);
    }
    const saved = await saveClientPromptSettings(payload);
    set({ settings: saved });
    return saved;
  },
  resetSettings: async () => {
    const saved = await resetClientPromptSettings();
    set({ settings: saved });
    return saved;
  },
}));
