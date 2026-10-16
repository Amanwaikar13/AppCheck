// Public (browser-visible) configuration. Only NEXT_PUBLIC_* values belong here;
// they are inlined into the client bundle at build time.
export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || null;

// Frontend release (from package.json via next.config.mjs), shown in the sidebar footer.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
