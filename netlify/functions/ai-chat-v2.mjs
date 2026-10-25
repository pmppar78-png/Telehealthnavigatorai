// Chat endpoint (Netlify Functions v2), served at /api/ai-chat. The logic lives
// in ./lib/ai-chat.js (CommonJS, event-style handler). This wrapper applies the
// durable per-IP rate limit (Netlify Blobs, ./lib/rate-limit.mjs) before
// validation and before any OpenAI call, then adapts the request.
import core from "./lib/ai-chat.js";
import { checkRateLimit, LIMIT_MESSAGE } from "./lib/rate-limit.mjs";

const ALLOWED_ORIGINS = ["https://telehealthnavigatorai.com", "https://www.telehealthnavigatorai.com"];

export default async (req, context) => {
  const headers = {};
  req.headers.forEach((v, k) => { headers[k] = v; });
  const ip = (context && context.ip) || headers["x-nf-client-connection-ip"] || "";
  if (!headers["x-nf-client-connection-ip"] && ip) headers["x-nf-client-connection-ip"] = ip;

  // Only same-site POSTs are counted; anything else falls through to the core (405/403).
  const origin = headers.origin || "";
  const referer = headers.referer || "";
  const okOrigin = origin ? ALLOWED_ORIGINS.includes(origin) : ALLOWED_ORIGINS.some((o) => referer.startsWith(o + "/"));
  if (req.method === "POST" && okOrigin) {
    // waitUntil lets counter cleanup finish after the response (awaited if absent).
    const waitUntil = context && typeof context.waitUntil === "function" ? context.waitUntil.bind(context) : undefined;
    const rl = await checkRateLimit(ip, { waitUntil });
    if (rl.limited) {
      return new Response(JSON.stringify({ reply: LIMIT_MESSAGE, rateLimited: true }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfter || 600) }
      });
    }
  }

  const body = req.method === "POST" ? await req.text() : "";
  const r = await core.handler({ httpMethod: req.method, headers, body });
  return new Response(r.body, { status: r.statusCode, headers: r.headers });
};

export const config = {
  path: "/api/ai-chat",
};
