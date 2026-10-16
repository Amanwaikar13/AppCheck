// Replaces the Axios transport with an in-memory fake so tests can count
// requests and control responses. Interceptors (CSRF header) still run.
import { AxiosError, AxiosHeaders } from "axios";

process.env.NEXT_PUBLIC_API_URL = "http://api.test/api/v1";

export async function installFakeApi() {
  const { apiClient } = await import("@/services/apiClient");
  const calls = [];
  let respond = () => ({ status: 200, data: {} });
  apiClient.defaults.adapter = async (config) => {
    calls.push(config);
    // Let other dispatches run while this request is "in flight".
    await new Promise((resolve) => setTimeout(resolve, 20));
    const { status, data = {}, headers = {} } = await respond(config);
    const response = { status, data, headers: new AxiosHeaders(headers), config, statusText: "" };
    if (status >= 400) throw new AxiosError(`Request failed with status ${status}`, "ERR_BAD_REQUEST", config, {}, response);
    return response;
  };
  return {
    calls,
    respondWith(fn) {
      respond = fn;
    },
  };
}

export const rateLimited = (seconds) => ({
  status: 429,
  data: { error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" } },
  headers: seconds === undefined ? {} : { "retry-after": String(seconds) },
});
