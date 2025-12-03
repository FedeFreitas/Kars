const base = "/api/cars";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export function listCars(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  const url = qs.toString() ? `${base}?${qs}` : base;
  return fetch(url, { credentials: "include", cache: "no-store" }).then(handle);
}

export function getCar(id) {
  return fetch(`${base}/${id}`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function createCar(body) {
  return fetch(base, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function updateCar(id, body) {
  return fetch(`${base}/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function listCarOptions(kind, includeInactive = false) {
  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  if (includeInactive) qs.set("all", "1");
  const url = qs.toString() ? `${base}/options?${qs}` : `${base}/options`;
  return fetch(url, { credentials: "include", cache: "no-store" }).then(handle);
}

export function createCarOption(kind, body) {
  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  const url = qs.toString() ? `${base}/options?${qs}` : `${base}/options`;
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function updateCarOption(id, body) {
  return fetch(`${base}/options/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}
