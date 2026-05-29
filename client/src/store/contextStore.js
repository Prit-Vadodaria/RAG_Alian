import { create } from "zustand";
import contextApi from "../services/context";

export const useContextStore = create((set, get) => ({
  selectedContext: "alian_default",
  contexts: [],
  loading: false,
  error: null,
  setSelectedContext: (id) => set({ selectedContext: id }),
  fetchContexts: async () => {
    set({ loading: true, error: null });
    try {
      const contexts = await contextApi.getContexts();
      set({ contexts, loading: false });
      return contexts;
    } catch (err) {
      set({ error: err.message || String(err), loading: false });
      return [];
    }
  },
  addContext: async (url, options) => {
    set({ loading: true });
    try {
      const data = await contextApi.createContext(url, options);
      // optimistic append
      set((state) => ({
        contexts: [
          ...(state.contexts || []),
          {
            id: data.contextId || data.id,
            name: url,
            isDefault: false,
            isDeletable: true,
            status: data.status || "processing",
          },
        ],
        loading: false,
      }));
      return data;
    } catch (err) {
      set({ loading: false, error: err.message || String(err) });
      throw err;
    }
  },
  setContextStatus: (contextId, status, logPreview = null) => {
    set((state) => ({
      contexts: (state.contexts || []).map((c) =>
        c.id === contextId ? { ...c, status, logPreview } : c,
      ),
    }));
  },
  refreshContext: async (contextId) => {
    try {
      const info = await contextApi.getContextStatus(contextId);
      if (!info) return null;
      const status = info.status || info;
      const logPreview = info.logPreview || null;
      set((state) => ({
        contexts: (state.contexts || []).map((c) =>
          c.id === contextId ? { ...c, status, logPreview } : c,
        ),
      }));
      return { status, logPreview };
    } catch (err) {
      return null;
    }
  },
  removeContext: async (id) => {
    set({ loading: true });
    try {
      await contextApi.deleteContext(id);
      set((state) => ({
        contexts: (state.contexts || []).filter((c) => c.id !== id),
        selectedContext:
          state.selectedContext === id
            ? "alian_default"
            : state.selectedContext,
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: err.message || String(err) });
      throw err;
    }
  },
  getStatus: async (id) => {
    try {
      const info = await contextApi.getContextStatus(id);
      return info;
    } catch (err) {
      return null;
    }
  },
}));
