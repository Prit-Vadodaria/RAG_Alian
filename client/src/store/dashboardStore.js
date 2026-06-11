import { create } from "zustand";

import dashboardApi from "../services/dashboard";

export const useDashboardStore = create((set) => ({
  summary: null,
  loading: false,
  error: null,

  fetchSummary: async () => {
    set({ loading: true, error: null });
    try {
      const summary = await dashboardApi.getDashboardSummary();
      set({ summary, loading: false, error: null });
      return summary;
    } catch (error) {
      set({ loading: false, error: error.message || String(error) });
      return null;
    }
  },

  clearAll: () =>
    set({
      summary: null,
      error: null,
      loading: false,
    }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("rag-config-updated", () => {
    useDashboardStore.getState().fetchSummary();
  });
}

export const dashboardSelectors = {
  summary: (state) => state.summary,
  loading: (state) => state.loading,
  error: (state) => state.error,
  fetchSummary: (state) => state.fetchSummary,
};
