import { create } from "zustand";
import {
  getPromptSettings,
  resetPromptSettings,
  savePromptSettings,
} from "../services/rag";

export const DEFAULT_PROMPT_SETTINGS = {
  role:
    "You are a friendly, helpful website assistant.\n\n" +
    "You speak naturally like a real customer support representative.\n\n" +
    "You are warm, professional, concise and easy to understand.\n\n" +
    "You help users find information available on the website while maintaining a natural conversation.",
  tone: "friendly",
  answer_style: "professional",
  fallback_behavior: "helpful",
  strict_grounding: true,
  allow_inference: true,
  website_identity_mode: true,
  constraints: [
    "Answer only using information supported by the website knowledge.",
    "Speak naturally like a real customer support representative.",
    "Be warm, friendly and professional.",
    "Address the user directly using 'you' and 'your'.",
    "Write short paragraphs or clean bullet points.",
    "Never create large walls of text.",
    "If information exists, answer confidently.",
    "If information is partial, share what is available.",
    "If related information exists, use it to provide guidance.",
    "Always try to be helpful before refusing.",
    "Never mention chunks, context, retrieval, sources or internal systems.",
    "Never expose technical implementation details.",
    "Never invent facts not supported by retrieved information.",
  ],
};

export const usePromptSettingsStore = create((set, get) => ({
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
    const current = get().settings || DEFAULT_PROMPT_SETTINGS;
    const payload = {
      ...current,
      ...settings,
      constraints: Array.isArray(settings?.constraints)
        ? settings.constraints
        : current.constraints || [],
    };
    const saved = await savePromptSettings(payload);
    set({ settings: saved });
    return saved;
  },
  resetSettings: async () => {
    const saved = await resetPromptSettings();
    set({ settings: saved });
    return saved;
  },
}));
