const base = "/api/car-movements";

async function handle(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export function listLatestMovements(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return fetch(`${base}/${qs}`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function listMovementsByCar(carId) {
  return fetch(`${base}/car/${carId}`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function getMovementHistory(movementId) {
  return fetch(`${base}/${movementId}/history`, { credentials: "include", cache: "no-store" }).then(handle);
}

export function createMovement(body) {
  return fetch(base, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}

export function updateMovement(id, body) {
  return fetch(`${base}/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(handle);
}
