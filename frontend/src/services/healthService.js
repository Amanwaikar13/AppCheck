import { apiClient } from "./apiClient";

/**
 * Fetches GET /health. A 503 still carries a valid health report (backend up,
 * database down), so both 200 and 503 are treated as successful responses.
 */
export async function fetchHealth() {
  const response = await apiClient.get("/health", {
    validateStatus: (status) => status === 200 || status === 503,
  });
  return response.data;
}
