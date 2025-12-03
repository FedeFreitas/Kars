const base = "/api/uploads";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export function listImages() {
  return fetch(`${base}/images`, {
    credentials: "include",
    cache: "no-store"
  }).then(handle);
}

export function deleteImage(path) {
  return fetch(`${base}/images`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  }).then(handle);
}

export function uploadImage(data) {
  return fetch(`${base}/images`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data })
  }).then(handle);
}
