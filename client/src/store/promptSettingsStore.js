import { create } from "zustand";
import {
  getPromptSettings,
  resetPromptSettings,
  savePromptSettings,
} from "../services/rag";

export const DEFAULT_PROMPT_SETTINGS = {
  role: "You are a retrieval-augmented QA assistant.",
  constraints: [
    "Do not invent facts.",
    "Cite supporting sources using [S1], [S2], etc.",
    'If the answer is not present, respond exactly:\n"I don\'t know based on the provided context."',
  ],
};

export const usePromptSettingsStore = create((set) => ({
  settings: DEFAULT_PROMPT_SETTINGS,
  isLoading: false,
  error: null,
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await getPromptSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  saveSettings: async (settings) => {
    const saved = await savePromptSettings(settings);
    set({ settings: saved });
    return saved;
  },
  resetSettings: async () => {
    const saved = await resetPromptSettings();
    set({ settings: saved });
    return saved;
  },
}));
