import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Hide the development-only route indicator (the "N" button). Compile and
  // runtime error overlays are still shown.
  devIndicators: false,
  // Public, non-secret build metadata shown in the sidebar footer.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
