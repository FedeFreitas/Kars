const base = "/api/users";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export function listUsers() {
  return fetch(base, { credentials: "include", cache: "no-store" }).then(handle);
}

export function updateUserRole(id, role) {
  return fetch(`${base}/${id}/role`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  }).then(handle);
}

export function logoutUser(id) {
  return fetch(`${base}/${id}/logout`, {
    method: "POST",
    credentials: "include"
  }).then(handle);
}

export function updateUserPermissions(id, payload) {
  return fetch(`${base}/${id}/permissions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(handle);
}

export function updateUserEmail(id, email) {
  return fetch(`${base}/${id}/email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  }).then(handle);
}

export function updateUserProfile(id, payload) {
  return fetch(`${base}/${id}/profile`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  }).then(handle);
}
