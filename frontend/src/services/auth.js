import { createApiClient } from "./http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

const unwrap = (response) => response.data?.data ?? response.data;

export const login = async (email, password) => unwrap(await client.post("/auth/login", { email, password }));

export const signup = async (name, email, password) =>
  unwrap(await client.post("/auth/signup", { name, email, password }));

export const me = async () => unwrap(await client.get("/auth/me"));

export const logout = async () => unwrap(await client.post("/auth/logout"));

export default {
  login,
  signup,
  me,
  logout,
};
