export const DEFAULT_AFTER_LOGIN = "/dashboard";
const AUTH_PAGES = ["/login", "/register"];

/**
 * Returns `value` only if it is a same-origin path (e.g. "/findings?x=1"),
 * otherwise the fallback. Blocks open redirects such as "//evil.example",
 * "/\\evil.example", or "javascript:..." from the ?next= parameter.
 */
export function safeNextPath(value, fallback = DEFAULT_AFTER_LOGIN) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  try {
    const base = "http://appcheck.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    if (AUTH_PAGES.some((page) => url.pathname === page)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
