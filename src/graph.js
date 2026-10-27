// Tiny wrapper around the Instagram Graph API. No dependencies (uses Node 18+ fetch).

export const API_VERSION = process.env.INSTAGRAM_API_VERSION || "v25.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function api(path, { method = "GET", params = {} } = {}) {
  const token = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const url = new URL(`${BASE}${path}`);
  const body = new URLSearchParams();

  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", token);
  } else {
    for (const [k, v] of Object.entries(params)) body.set(k, v);
    body.set("access_token", token);
  }

  const res = await fetch(url, {
    method,
    headers:
      method === "GET" ? undefined : { "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new Error(
      `Graph API error (${res.status}) on ${method} ${path}: ${e.message || "unknown error"}` +
        (e.code ? ` [code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}]` : "")
    );
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Containers (especially video) are processed asynchronously. Wait until FINISHED.
export async function waitUntilReady(containerId, { timeoutMs = 5 * 60_000, intervalMs = 5_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status_code, status } = await api(`/${containerId}`, {
      params: { fields: "status_code,status" },
    });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Container ${containerId} failed with status ${status_code}: ${status || ""}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for container ${containerId} to finish processing`);
}
