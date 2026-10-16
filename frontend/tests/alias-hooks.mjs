// Node resolve hook for tests: maps "@/x" to src/x and adds the ".js"
// extension that the Next.js bundler normally infers.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

function withExtension(url) {
  if (/\.(m?js|json)$/.test(url.pathname)) return url;
  const candidate = new URL(`${url.href}.js`);
  return existsSync(fileURLToPath(candidate)) ? candidate : url;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(withExtension(new URL(specifier.slice(2), SRC)).href, context);
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(fileURLToPath(SRC)).href)) {
    return nextResolve(withExtension(new URL(specifier, context.parentURL)).href, context);
  }
  return nextResolve(specifier, context);
}
