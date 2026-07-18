import path from "node:path";

function normalizedBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("VITE_BACKEND_API_URL must use HTTPS outside local development");
  return url.href.replace(/\/+$/, "");
}

export function cloudRunApiBasePlugin({ baseUrl, required = false } = {}) {
  const base = normalizedBaseUrl(baseUrl);
  return {
    name: "cloud-run-api-base",
    enforce: "pre",
    buildStart() {
      if (required && !base)
        throw new Error(
          "VITE_BACKEND_API_URL is required for Vercel builds now that APIs run on Cloud Run",
        );
    },
    transform(code, id) {
      if (!base) return null;
      const cleanId = id.split("?", 1)[0];
      if (
        !cleanId.includes(`${path.sep}src${path.sep}`) ||
        !/\.(?:js|jsx|ts|tsx)$/.test(cleanId)
      )
        return null;
      let changed = false;
      const transformed = code.replace(
        /(\bfetch\s*\(\s*)(["'])(\/api\/[^"']*)\2/g,
        (_match, prefix, _quote, apiPath) => {
          changed = true;
          return `${prefix}${JSON.stringify(`${base}${apiPath}`)}`;
        },
      );
      return changed ? { code: transformed, map: null } : null;
    },
  };
}
