const API_BASE = "http://localhost:8000";

export function logAction(eventType, details = {}) {
  const payload = JSON.stringify({
    event_type: eventType,
    source: "frontend",
    details,
  });

  return fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export async function downloadActivityLog() {
  const resp = await fetch(`${API_BASE}/logs/activity`);

  if (!resp.ok) {
    throw new Error(`Could not download activity log (${resp.status})`);
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `mujoco-copilot-activity-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jsonl`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
