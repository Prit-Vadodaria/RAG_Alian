import axios from "axios";

export const AUTH_TOKEN_KEY = "rag-auth-token";

export const getAuthToken = () => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const setAuthToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures in non-browser contexts.
  }
};

export const createApiClient = (baseURL, timeout = 60000) => {
  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      try {
        const responseData = error?.response?.data;
        const status = error?.response?.status;
        const backendMessage =
          responseData?.error ||
          responseData?.detail ||
          responseData?.message ||
          responseData?.msg;

        if (backendMessage) {
          error.message = backendMessage;
        } else if (status) {
          error.message = "Request failed.";
        }

        const token = getAuthToken();
        const pathname = typeof window !== "undefined" ? window.location.pathname : "";
        const isAuthPage = pathname === "/login" || pathname === "/signup";
        const isAuthRequest = String(error?.config?.url || "").includes("/auth/");
        if (status === 401 && token && !isAuthPage && !isAuthRequest && typeof window !== "undefined") {
          setAuthToken("");
          window.location.assign("/login");
        }
      } catch {
        // Leave the original Axios error message intact if normalization fails.
      }
      return Promise.reject(error);
    },
  );

  return client;
};
