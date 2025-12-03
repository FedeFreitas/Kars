const base = "/api/clients";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export function listClients(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", params.limit);
  if (params.offset) qs.set("offset", params.offset);
  const url = qs.toString() ? `${base}?${qs}` : base;
  return fetch(url, { credentials: "include", cache: "no-store" }).then(handle);
}

export function getClient(userId) {
  return fetch(`${base}/${userId}`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function updateClient(userId, body) {
  return fetch(`${base}/${userId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function getClientStats() {
  return fetch(`${base}/stats/summary`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function getClientMonthlyStats(limit = 12) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", limit);
  const url = `${base}/stats/monthly${qs.toString() ? `?${qs}` : ""}`;
  return fetch(url, { credentials: "include", cache: "no-store" }).then(handle);
}

export function updateClientHistoryIgnore(historyId) {
  return fetch(`${base}/history/${historyId}/ignore`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  }).then(handle);
}

export function listTariffOptions() {
  return fetch(`${base}/tariffs`, {
    credentials: "include",
    cache: "no-store"
  }).then(handle);
}

export function createTariffOption(payload) {
  return fetch(`${base}/tariffs`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(handle);
}
