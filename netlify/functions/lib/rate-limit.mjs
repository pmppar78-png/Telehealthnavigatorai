// Durable per-IP rate limit for the chat endpoint, backed by Netlify Blobs.
// - Runs before request validation and before any OpenAI call.
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

function hashIp(ip) {
  const salt = process.env.RATE_LIMIT_SALT || "chat-rl-v1-static-salt";
  return createHmac("sha256", salt).update(String(ip)).digest("hex").slice(0, 32);
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
    const store = getStore("chat-rate-limit");
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
