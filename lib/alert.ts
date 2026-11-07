// Ops alerting: posts to a chat webhook (Slack/Teams/Discord-compatible `{ text }`) when the API fails.
// Disabled unless ALERT_WEBHOOK_URL is set. Throttled so an outage sends one message, not one per request.

const THROTTLE_MS = 5 * 60_000;
let lastSent = Number.NEGATIVE_INFINITY;

export async function notifyOps(text: string, now = Date.now()): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || now - lastSent < THROTTLE_MS) return false;
  lastSent = now;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false; // alerting must never break the request that triggered it
  }
}

/** Test hook */
export function resetAlertThrottle() {
  lastSent = Number.NEGATIVE_INFINITY;
}
