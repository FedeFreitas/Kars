const base = "/api";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export function createLead(body) {
  return fetch(`${base}/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function listLeads(params = {}) {
  const qs = new URLSearchParams();
  if (params.stage) qs.set("stage", params.stage);
  if (params.q) qs.set("q", params.q);
  const url = `${base}/leads${qs.toString() ? `?${qs}` : ""}`;
  return fetch(url, { credentials: "include", cache: "no-store" }).then(handle);
}

export function getLead(id) {
  return fetch(`${base}/leads/${id}`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function updateLead(id, body) {
  return fetch(`${base}/leads/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function moveLead(id, toStage) {
  return fetch(`${base}/leads/${id}/move`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toStage })
  }).then(handle);
}

export function addNote(id, message) {
  return fetch(`${base}/leads/${id}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).then(handle);
}
