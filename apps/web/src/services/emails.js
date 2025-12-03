const base = "/api/emails";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export function listEmailTemplates() {
  return fetch(`${base}/templates`, {
    credentials: "include",
    cache: "no-store"
  }).then(handle);
}

export function updateEmailTemplate(key, payload) {
  return fetch(`${base}/templates/${encodeURIComponent(key)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  }).then(handle);
}

export function listEmailLogs({ limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return fetch(`${base}/logs?${params.toString()}`, {
    credentials: "include",
    cache: "no-store"
  }).then(handle);
}
