import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
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
    } catch {
      // Leave the original Axios error message intact if normalization fails.
    }
    return Promise.reject(error);
  },
);

export default apiClient;
