import { create } from "zustand";

import authApi from "../services/auth";
import { getAuthToken, setAuthToken } from "../services/http";

const loadStoredToken = () => {
  try {
    return getAuthToken();
  } catch {
    return "";
  }
};

const initialToken = loadStoredToken();

export const useAuthStore = create((set, get) => ({
  user: null,
  token: initialToken,
  isAuthenticated: Boolean(initialToken),
  isAdmin: false,
  isHydrating: true,
  isLoading: false,
  error: null,

  hydrate: async () => {
    const token = loadStoredToken();
    if (!token) {
      set({
        user: null,
        token: "",
        isAuthenticated: false,
        isAdmin: false,
        isHydrating: false,
        error: null,
      });
      return null;
    }

    set({ isHydrating: true, error: null });
    try {
      const user = await authApi.me();
      set({
        user,
        token,
        isAuthenticated: true,
        isAdmin: user?.role === "admin",
        isHydrating: false,
        error: null,
      });
      return user;
    } catch (error) {
      setAuthToken("");
      set({
        user: null,
        token: "",
        isAuthenticated: false,
        isAdmin: false,
        isHydrating: false,
        error: error.message || String(error),
      });
      return null;
    }
  },

  setSession: (user, token) => {
    setAuthToken(token);
    set({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isAdmin: user?.role === "admin",
      isHydrating: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.login(email, password);
      get().setSession(result.user, result.token);
      return result;
    } catch (error) {
      set({ error: error.message || String(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.signup(name, email, password);
      get().setSession(result.user, result.token);
      return result;
    } catch (error) {
      set({ error: error.message || String(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // logout is best-effort
    } finally {
      setAuthToken("");
      set({
        user: null,
        token: "",
        isAuthenticated: false,
        isAdmin: false,
        error: null,
      });
    }
  },
}));
