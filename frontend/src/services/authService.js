import { apiClient } from "./apiClient";

// The session token lives in an HttpOnly cookie set by the API; it is never
// visible to this code. Responses contain only the user's safe profile.

export async function register({ name, email, password }) {
  const { data } = await apiClient.post("/auth/register", { name, email, password });
  return data.user;
}

export async function login({ email, password }) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data.user;
}

export async function logout() {
  await apiClient.post("/auth/logout");
}

export async function getCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data.user;
}
