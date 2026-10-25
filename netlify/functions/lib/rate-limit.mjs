// Durable per-IP rate limit for the chat endpoint, backed by Netlify Blobs.
// - Runs before request validation and before any OpenAI call.
// - IPv6 addresses are grouped by /64 (see ipKey).
// - The IP is never stored: keys use an HMAC-SHA256 hash of the IP
//   (secret from RATE_LIMIT_SALT if set, otherwise a fixed fallback).
// - Fixed windows: 30 requests per 10 minutes and 100 per UTC day per IP.
// - Counters hold only a count and a timestamp (no message text) and expire
//   about 2 days after their window starts (RETENTION_MS). Netlify Blobs has no
//   server-side TTL, so expiry is enforced here: each counter carries an `exp`
//   metadata timestamp and is treated as absent (and deleted) once it passes;
//   the previous window's counter is deleted when a visitor starts a new
//   window; and sweepExpired() deletes whole windows/days past retention. It
//   runs hourly from the scheduled function ../sweep-rate-limit.mjs (with or
//   without chat traffic) and, opportunistically, at most hourly on chat requests.
// - Fails open: if Blobs errors, the request is allowed.
import { getStore } from "@netlify/blobs";
import { createHmac } from "node:crypto";

export const LIMITS = { shortMax: 30, shortWindowMs: 10 * 60 * 1000, dayMax: 100 };
export const LIMIT_MESSAGE =
  "You've sent a lot of messages in a short time. Please wait a few minutes and try again. " +
  "(Limit: 30 messages per 10 minutes and 100 per day.)";

export const RETENTION_MS = 2 * 24 * 60 * 60 * 1000; // about 2 days
const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000; // at most one sweep per hour
const SWEEP_MAX_DELETES = 2000; // bound the work done by any one sweep
const SWEEP_BATCH = 20; // deletes issued in parallel per batch
const SWEEP_MARKER = "meta/last-sweep";

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

const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

// Start time (ms) of the window a key or key directory belongs to, or NaN.
// "w/<win>[/<hash>]" -> win * 10 min; "d/<YYYY-MM-DD>[/<hash>]" -> 00:00 UTC.
export function windowStart(keyOrDir) {
  const [kind, id] = String(keyOrDir).split("/");
  if (kind === "w" && /^\d+$/.test(id || "")) return Number(id) * LIMITS.shortWindowMs;
  if (kind === "d" && /^\d{4}-\d{2}-\d{2}$/.test(id || "")) return Date.parse(id + "T00:00:00Z");
  return NaN;
}

// Increment a counter. A counter whose `exp` has passed counts as absent and is
// replaced. Returns { n, fresh } where fresh means this is the window's first hit.
async function bump(store, key, windowStartMs, now) {
  const cur = await store.getWithMetadata(key, { type: "json" });
  let n = 0;
  if (cur) {
    const exp = Number(cur.metadata && cur.metadata.exp);
    // Entries written before expiry metadata existed have no exp: use the
    // window start from the key instead.
    const expiresAt = Number.isFinite(exp) && exp > 0 ? exp : windowStartMs + RETENTION_MS;
    if (expiresAt > now) n = (cur.data && Number(cur.data.n)) || 0;
    // else: stale, ignored here and overwritten below
  }
  await store.setJSON(key, { n: n + 1, t: now }, { metadata: { exp: windowStartMs + RETENTION_MS } });
  return { n: n + 1, fresh: n === 0 };
}

// Logs the error name only, so no key (hashed IP) can reach the logs.
async function safeDelete(store, key) {
  try { await store.delete(key); } catch (err) { console.error("rate-limit: cleanup delete failed:", err && err.name); }
}

// Delete every counter whose window started more than RETENTION_MS ago,
// including counters written before expiry existed. Uses directory listing so
// fresh windows are skipped without listing their keys. Stops at maxDeletes
// (default 2,000) or when clock() reaches deadline (ms), whichever comes first;
// anything left is picked up by the next run.
// Returns { deleted, capped, timedOut } (counts only, no keys).
export async function sweepExpired(store, now = Date.now(), opts = {}) {
  const maxDeletes = opts.maxDeletes ?? SWEEP_MAX_DELETES;
  const deadline = opts.deadline ?? Infinity;
  const clock = opts.clock || Date.now;
  const out = { deleted: 0, capped: false, timedOut: false };
  for (const prefix of ["w/", "d/"]) {
    const { directories } = await store.list({ prefix, directories: true });
    for (const raw of directories) {
      const dir = String(raw).replace(/\/+$/, ""); // "w/123/" and "w/123" are the same folder
      const start = windowStart(dir);
      if (!Number.isFinite(start) || start + RETENTION_MS > now) continue;
      if (clock() >= deadline) { out.timedOut = true; return out; }
      const { blobs } = await store.list({ prefix: dir + "/" });
      for (let i = 0; i < blobs.length; i += SWEEP_BATCH) {
        if (out.deleted >= maxDeletes) { out.capped = true; return out; }
        if (clock() >= deadline) { out.timedOut = true; return out; }
        const batch = blobs.slice(i, i + Math.min(SWEEP_BATCH, maxDeletes - out.deleted));
        await Promise.all(batch.map((b) => safeDelete(store, b.key)));
        out.deleted += batch.length;
      }
    }
  }
  return out;
}

let lastSweepCheck = 0; // per warm instance, so the marker is read at most hourly

async function maybeSweep(store, now) {
  if (now - lastSweepCheck < SWEEP_EVERY_MS) return;
  lastSweepCheck = now;
  try {
    const marker = await store.get(SWEEP_MARKER, { type: "json" });
    if (marker && Number(marker.t) > now - SWEEP_EVERY_MS) return;
    await store.setJSON(SWEEP_MARKER, { t: now });
    await sweepExpired(store, now);
  } catch (err) {
    console.error("rate-limit: sweep failed:", err && err.name);
  }
}

// Returns { limited: boolean, retryAfter?: seconds }.
// opts.waitUntil (Netlify Functions v2 context.waitUntil), when given, lets the
// cleanup finish after the response is sent; otherwise it is awaited.
export async function checkRateLimit(ip, opts = {}) {
  if (!ip) return { limited: false };
  let store, h, now, win, day;
  let result;
  try {
    // Strong consistency: the default (eventual) can serve stale counts for up to ~60s.
    store = (opts.store) || getStore({ name: "chat-rate-limit", consistency: "strong" });
    h = hashIp(ip);
    now = opts.now || Date.now();
    win = Math.floor(now / LIMITS.shortWindowMs);
    day = dayStr(now);
    const dayStart = Date.parse(day + "T00:00:00Z");
    const [s, d] = await Promise.all([
      bump(store, `w/${win}/${h}`, win * LIMITS.shortWindowMs, now),
      bump(store, `d/${day}/${h}`, dayStart, now)
    ]);
    if (d.n > LIMITS.dayMax) {
      result = { limited: true, retryAfter: Math.ceil((dayStart + DAY_MS - now) / 1000) };
    } else if (s.n > LIMITS.shortMax) {
      result = { limited: true, retryAfter: Math.ceil(((win + 1) * LIMITS.shortWindowMs - now) / 1000) };
    } else {
      result = { limited: false };
    }
    // Cheap cleanup: when this visitor starts a new window, drop their previous one.
    const cleanup = [];
    if (s.fresh) cleanup.push(safeDelete(store, `w/${win - 1}/${h}`));
    if (d.fresh) cleanup.push(safeDelete(store, `d/${dayStr(now - DAY_MS)}/${h}`));
    cleanup.push(maybeSweep(store, now));
    const done = Promise.all(cleanup);
    if (typeof opts.waitUntil === "function") opts.waitUntil(done);
    else await done;
    return result;
  } catch (err) {
    console.error("rate-limit: blobs error, failing open:", err && err.message);
    return result || { limited: false };
  }
}
