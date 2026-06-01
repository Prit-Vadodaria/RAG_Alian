import { create } from "zustand";
import contextApi from "../services/context";

export const useContextStore = create((set, get) => ({
  selectedContext: "alian_default",
  contexts: [],
  loading: false,
  error: null,
  toastMessage: null,
  toastType: "info",
  setSelectedContext: (id) => set({ selectedContext: id }),
  fetchContexts: async () => {
    set({ loading: true, error: null });
    try {
      const contexts = await contextApi.getContexts();
      const ready = contexts.filter(
        (c) => (c.status || "").toLowerCase() === "ready",
      );
      set((state) => {
        let selectedContext = state.selectedContext;
        if (
          selectedContext === "all_ready" ||
          !ready.some((c) => c.id === selectedContext)
        ) {
          selectedContext =
            ready.find((c) => c.id === "alian_default")?.id ||
            ready[0]?.id ||
            "alian_default";
        }
        return { contexts, loading: false, selectedContext };
      });
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
      const newContext = {
        id: data.contextId || data.id,
        name: url,
        isDefault: false,
        isDeletable: true,
        status: data.status || "ingesting",
        seed_url: url,
      };
      set((state) => ({
        contexts: [...(state.contexts || []), newContext],
        loading: false,
      }));
      get().pollContextReady(newContext.id, url);
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
  showToast: (message, type = "info") => {
    set({ toastMessage: message, toastType: type });
  },
  clearToast: () => {
    set({ toastMessage: null, toastType: "info" });
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
  pollContextReady: async (contextId, contextName) => {
    const retryDelay = 4000;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const info = await get().getStatus(contextId);
      if (!info) return;

      const status = (info.status || info).toLowerCase();
      get().setContextStatus(contextId, status, info.logPreview || null);

      if (status === "ready") {
        get().showToast(`Context '${contextName}' is ready.`, "success");
        return;
      }

      if (status === "failed" || status === "deleting") {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  },
}));
