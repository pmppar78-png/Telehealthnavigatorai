// Chat endpoint (Netlify Functions v2). The logic lives in ./lib/ai-chat.js
// (CommonJS, event-style handler); this wrapper adapts the request and adds
// Netlify's code-based rate limit, which is available on the free plan and is
// enforced by the platform across all function instances (unlike the
// in-memory limiter inside the handler, which is kept as a second layer).
import core from "./lib/ai-chat.js";

export default async (req, context) => {
  const headers = {};
  req.headers.forEach((v, k) => { headers[k] = v; });
  if (!headers["x-nf-client-connection-ip"] && context && context.ip) headers["x-nf-client-connection-ip"] = context.ip;
  const body = req.method === "POST" ? await req.text() : "";
  const r = await core.handler({ httpMethod: req.method, headers, body });
  return new Response(r.body, { status: r.statusCode, headers: r.headers });
};

export const config = {
  path: "/api/ai-chat",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
