// Durable per-IP rate limit for the chat endpoint, backed by Netlify Blobs.
// - Runs before request validation and before any OpenAI call.
// - IPv6 addresses are grouped by /64 (see ipKey).
// - The IP is never stored: keys use an HMAC-SHA256 hash of the IP
//   (secret from RATE_LIMIT_SALT if set, otherwise a fixed fallback).
// - Fixed windows: 20 requests per 10 minutes and 100 per UTC day per IP.
// - Fails open: if Blobs errors, the request is allowed.
import { getStore } from "@netlify/blobs";
import { createHmac } from "node:crypto";

export const LIMITS = { shortMax: 20, shortWindowMs: 10 * 60 * 1000, dayMax: 100 };
export const LIMIT_MESSAGE =
  "You've sent a lot of messages in a short time. Please wait a few minutes and try again. " +
  "(Limit: 20 messages per 10 minutes and 100 per day.)";

// IPv6 clients often rotate addresses inside their /64, so IPv6 is keyed by /64.
export function ipKey(ip) {
  ip = String(ip).trim();
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return full.slice(0, 4).map((x) => (parseInt(x, 16) || 0).toString(16)).join(":") + "::/64";
}

function hashIp(ip) {
  const salt = process.env.RATE_LIMIT_SALT || "chat-rl-v1-static-salt";
  return createHmac("sha256", salt).update(ipKey(ip)).digest("hex").slice(0, 32);
}

async function bump(store, key) {
  const cur = await store.get(key, { type: "json" });
  const n = (cur && Number(cur.n)) || 0;
  await store.setJSON(key, { n: n + 1 });
  return n + 1;
}

// Returns { limited: boolean, retryAfter?: seconds }.
export async function checkRateLimit(ip) {
  if (!ip) return { limited: false };
  try {
    // Strong consistency: the default (eventual) can serve stale counts for up to ~60s.
    const store = getStore({ name: "chat-rate-limit", consistency: "strong" });
    const h = hashIp(ip);
    const now = Date.now();
    const win = Math.floor(now / LIMITS.shortWindowMs);
    const day = new Date(now).toISOString().slice(0, 10);
    const [s, d] = await Promise.all([bump(store, `w/${win}/${h}`), bump(store, `d/${day}/${h}`)]);
    if (d > LIMITS.dayMax) {
      const next = Date.parse(day + "T00:00:00Z") + 86400000;
      return { limited: true, retryAfter: Math.ceil((next - now) / 1000) };
    }
    if (s > LIMITS.shortMax) {
      return { limited: true, retryAfter: Math.ceil(((win + 1) * LIMITS.shortWindowMs - now) / 1000) };
    }
    return { limited: false };
  } catch (err) {
    console.error("rate-limit: blobs error, failing open:", err && err.message);
    return { limited: false };
  }
}
