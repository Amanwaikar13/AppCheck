import axios from "axios";
import { API_URL } from "@/lib/config";
import { parseRetryAfter, rateLimitMessage } from "@/lib/rateLimit";

const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

export const apiClient = axios.create({
  baseURL: API_URL ?? undefined,
  timeout: 10000,
  headers: { Accept: "application/json" },
  // Sends the HttpOnly session cookie to the API (requires credentialed CORS there).
  withCredentials: true,
});

// CSRF defense: the API rejects cookie-authenticated, state-changing requests
// without this header. Browsers cannot add it to cross-site forged requests.
apiClient.interceptors.request.use((config) => {
  if (UNSAFE_METHODS.has(config.method?.toLowerCase())) {
    config.headers.set("X-Requested-With", "XMLHttpRequest");
  }
  return config;
});

function apiOrigin() {
  try {
    return new URL(API_URL).origin;
  } catch {
    return API_URL;
  }
}

/**
 * User-facing message for an Axios error. Any HTTP response (including 503)
 * uses the server's own message; only requests that got no response at all are
 * described as connectivity problems.
 */
function retryAfterOf(response) {
  const { headers } = response;
  const value = typeof headers?.get === "function" ? headers.get("retry-after") : headers?.["retry-after"];
  return parseRetryAfter(value);
}

export function describeApiError(error) {
  if (error.response?.status === 429) {
    // The API answered: this is a rate limit, never a connectivity problem.
    return rateLimitMessage(retryAfterOf(error.response));
  }
  if (error.response) {
    const message = error.response.data?.error?.message;
    return message || `Request failed with status ${error.response.status}`;
  }
  if (error.code === "ECONNABORTED") return "The AppCheck API did not respond in time.";
  if (error.request) {
    // The browser deliberately hides whether a request failed because nothing
    // is listening or because CORS rejected this origin, so name both.
    const pageOrigin = typeof window === "undefined" ? "this page's origin" : window.location.origin;
    return (
      `No response from the AppCheck API at ${apiOrigin()}. Either the backend is not running ` +
      `(it exits at startup if it cannot reach MongoDB Atlas; check its terminal), or it does ` +
      `not allow ${pageOrigin} (FRONTEND_URL in backend/.env).`
    );
  }
  return error.message;
}

/**
 * Serializable error summary for Redux: HTTP status, error code, message,
 * per-field validation messages ({ email: "..." }), and retryAfterSeconds for 429s. Codes are the API's own
 * (e.g. DATABASE_UNAVAILABLE, EMAIL_TAKEN, RATE_LIMITED), or TIMEOUT /
 * NO_RESPONSE when the request never got an HTTP response.
 */
export function toApiError(error) {
  if (error.response) {
    const body = error.response.data?.error;
    const fieldErrors = {};
    for (const { path, message } of body?.details ?? []) {
      if (path && !fieldErrors[path]) fieldErrors[path] = message;
    }
    const status = error.response.status;
    return {
      status,
      code: body?.code ?? (status === 429 ? "RATE_LIMITED" : "HTTP_ERROR"),
      message: describeApiError(error),
      fieldErrors,
      // Seconds until a rate-limited request may be retried (Retry-After), else null.
      retryAfterSeconds: status === 429 ? retryAfterOf(error.response) : null,
    };
  }
  return {
    status: null,
    code: error.code === "ECONNABORTED" ? "TIMEOUT" : error.request ? "NO_RESPONSE" : "CLIENT_ERROR",
    message: describeApiError(error),
    fieldErrors: {},
    retryAfterSeconds: null,
  };
}
