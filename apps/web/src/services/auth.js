const base = "/api";

async function handle(r) {
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const msg = data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data ?? {};
}

export const register = (body) =>
  fetch(`${base}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const login = (body) =>
  fetch(`${base}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const verify2fa = (body) =>
  fetch(`${base}/auth/2fa/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const send2fa = (body) =>
  fetch(`${base}/auth/2fa/send`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const resetRequest = (body) =>
  fetch(`${base}/auth/reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const resetConfirm = (body) =>
  fetch(`${base}/auth/reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const resetDecode = (body) =>
  fetch(`${base}/auth/reset/decode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);

export const refresh = () =>
  fetch(`${base}/auth/refresh`, { method: "POST", credentials: "include" }).then(r => r);

export const logout = () =>
  fetch(`${base}/auth/logout`, { method: "POST", credentials: "include" }).then(() => {});

export const me = () =>
  fetch(`${base}/me`, { credentials: "include", cache: "no-store" })
    .then(async (r) => (r.ok ? r.json() : null));

export async function ensureSession() {
  async function fetchMe() {
    return fetch(`${base}/me`, { credentials: "include", cache: "no-store" });
  }
  let r = await fetchMe();
  if (r.status === 401) {
    await refresh();
    r = await fetchMe();
  }
  let data = r.ok ? await r.json() : null;
  // se token antigo ainda tem role desatualizada, força refresh e refaz /me uma vez
  if (data?.user?.role === "pending") {
    await refresh();
    const r2 = await fetchMe();
    if (r2.ok) data = await r2.json();
  }
  return data;
}
