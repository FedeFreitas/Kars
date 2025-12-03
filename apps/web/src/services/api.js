const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

export async function getHealth() {
  const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  return r.json();
}

export async function getFeedBacks() {
  const r = await fetch(`${API_BASE}/feedbacks`, { cache: "no-store" });
  const data = await r.json().catch(() => []);
  return Array.isArray(data) ? data : (data?.feedbacks ?? []);
}

export async function addFeedBack(text) {
  const r = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return r.json();
}
