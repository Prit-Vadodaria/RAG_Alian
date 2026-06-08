import { create } from "zustand";
import contextApi from "../services/context";

export const useContextStore = create((set, get) => ({
  selectedContext: "",
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
        (c) => ["ready", "partially_ready"].includes((c.status || "").toLowerCase()),
      );
      set((state) => {
        let selectedContext = state.selectedContext;
        if (!ready.some((c) => c.id === selectedContext)) {
          selectedContext = ready[0]?.id || "";
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
        status: data.status || "discovering",
        seed_url: url,
        chunking: data.chunking || options?.chunking || null,
        total_urls: 0,
        pending_urls: 0,
        processed_urls: 0,
        indexed_urls: 0,
        failed_urls: 0,
        current_batch: 0,
        total_batches: 0,
        last_completed_batch: 0,
        stop_reason: "",
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
      const progress = info.progress || {};
      set((state) => ({
        contexts: (state.contexts || []).map((c) =>
          c.id === contextId ? { ...c, status, logPreview, ...progress } : c,
        ),
      }));
      return { status, logPreview, progress };
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
        selectedContext: state.selectedContext === id ? "" : state.selectedContext,
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
  pauseContext: async (id) => {
    const info = await contextApi.pauseContext(id);
    set((state) => ({
      contexts: (state.contexts || []).map((c) =>
        c.id === id
          ? { ...c, ...(info || {}), ...(info?.progress || {}), status: info?.status || "paused" }
          : c,
      ),
    }));
    return info;
  },
  resumeContext: async (id) => {
    const info = await contextApi.resumeContext(id);
    set((state) => ({
      contexts: (state.contexts || []).map((c) =>
        c.id === id
          ? { ...c, ...(info || {}), ...(info?.progress || {}), status: info?.status || "processing_batch" }
          : c,
      ),
    }));
    return info;
  },
  pollContextReady: async (contextId, contextName) => {
    const retryDelay = 4000;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const info = await get().getStatus(contextId);
      if (!info) return;

      const status = (info.status || info).toLowerCase();
      get().setContextStatus(contextId, status, info.logPreview || null);

      if (status === "ready" || status === "partially_ready") {
        get().showToast(`Context '${contextName}' is ready.`, "success");
        return;
      }

      if (status === "failed" || status === "deleting" || status === "paused") {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  },
}));
