const base = "/api/finance";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export function listFinanceEntries(filters = {}) {
  const qs = new URLSearchParams();
  if (filters.clientId) qs.set("clientId", filters.clientId);
  if (filters.startDue) qs.set("startDue", filters.startDue);
  if (filters.endDue) qs.set("endDue", filters.endDue);
  if (filters.status) qs.set("status", filters.status);
  if (filters.typeId) qs.set("typeId", filters.typeId);
  if (filters.kind) qs.set("kind", filters.kind);
  const url = qs.toString() ? `${base}/entries?${qs.toString()}` : `${base}/entries`;
  return fetch(url, { credentials: "include", cache: "no-store" }).then(handle);
}

export function createFinanceEntry(body) {
  return fetch(`${base}/entries`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function updateFinanceEntry(id, body) {
  return fetch(`${base}/entries/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function listFinanceTypes() {
  return fetch(`${base}/types`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function createFinanceType(body) {
  return fetch(`${base}/types`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function updateFinanceType(id, body) {
  return fetch(`${base}/types/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function getFinanceEntry(id) {
  return fetch(`${base}/entries/${id}`, {
    credentials: "include",
    cache: "no-store"
  }).then(handle);
}

export function addFinanceNote(id, message) {
  return fetch(`${base}/entries/${id}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).then(handle);
}

export function listFinanceClosings() {
  return fetch(`${base}/closings`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function createFinanceClosing(body) {
  return fetch(`${base}/closings`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function payFinanceClosing(id) {
  return fetch(`${base}/closings/${id}/pay`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  }).then(handle);
}

export function sendFinanceClosing(id, client_ids) {
  return fetch(`${base}/closings/${id}/send`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(client_ids ? { client_ids } : {})
  }).then(handle);
}

export function cancelFinanceClosing(id) {
  return fetch(`${base}/closings/${id}/cancel`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  }).then(handle);
}

export function listFinanceSendQueue() {
  return fetch(`${base}/closings/send-queue`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function getFinanceClosing(id) {
  return fetch(`${base}/closings/${id}`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function addClosingEntry(id, entry_id) {
  return fetch(`${base}/closings/${id}/entries`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry_id })
  }).then(handle);
}

export function removeClosingEntry(id, entryId) {
  return fetch(`${base}/closings/${id}/entries/${entryId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  }).then(handle);
}

export function payClosingClient(id, clientId) {
  return fetch(`${base}/closings/${id}/clients/${clientId}/pay`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  }).then(handle);
}
