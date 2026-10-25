const { SYSTEM_PROMPT, AFFILIATE_DOMAINS, BLOCKED_DOMAINS, SITE_URL, SITE_PATHS } = require("./chat-config");
const { isCrisis, CRISIS_REPLY } = require("./crisis");

const MODEL = "gpt-4.1-mini";
const MAX_MESSAGES = 20;          // user+assistant turns kept
const MAX_CHARS = 2000;           // per message
const ALLOWED_ORIGINS = [
  "https://telehealthnavigatorai.com",
  "https://www.telehealthnavigatorai.com"
];

// Rate limiting happens in the ai-chat-v2.mjs wrapper (Netlify Blobs) before this handler runs.

function json(status, obj) {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

const SITE_HOST = hostOf(SITE_URL);
const SITE_PATH_SET = new Set(SITE_PATHS);

// On-site links must be real pages: "/guide-x", "/guide-x/" and "/guide-x.html"
// all count as "/guide-x". Anything else goes to the guide directory.
function knownSitePath(url) {
  try {
    let p = new URL(url).pathname.replace(/\.html$/, "");
    if (p.length > 1) p = p.replace(/\/+$/, "");
    return SITE_PATH_SET.has(p || "/");
  } catch { return false; }
}

// Today's date for the model, so it never guesses the year from training data.
function todayLine() {
  const d = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(new Date());
  return `\n\nToday's date: ${d} (US Eastern).`;
}

// Remove any URL on a blocked domain, replace made-up on-site URLs, and report
// whether an affiliate URL remains.
function postProcess(text) {
  const urlRe = /https?:\/\/[^\s)<>"\]]+/g;
  let hasAffiliate = false;
  const cleaned = text.replace(urlRe, (url) => {
    const bare = url.replace(/[.,;:!?]+$/, "");
    const h = hostOf(bare);
    if (BLOCKED_DOMAINS.some(d => h === d || h.endsWith("." + d))) return "[link removed]" + url.slice(bare.length);
    if (h === SITE_HOST && !knownSitePath(bare)) return SITE_URL + "/sitemap-page" + url.slice(bare.length);
    if (AFFILIATE_DOMAINS.some(d => h === d || h.endsWith("." + d))) hasAffiliate = true;
    return url;
  });
  return hasAffiliate ? { reply: cleaned, hasAffiliate, sponsoredHosts: AFFILIATE_DOMAINS } : { reply: cleaned, hasAffiliate };
}

exports.postProcess = postProcess; // exported for scripts/check-chat-prompt.cjs

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const origin = event.headers.origin || event.headers.Origin || "";
  // Browsers always send Origin on a cross-site or same-site POST; requests with
  // no Origin are accepted only when the Referer is one of our pages.
  const referer = event.headers.referer || event.headers.Referer || "";
  const okOrigin = origin ? ALLOWED_ORIGINS.includes(origin) : ALLOWED_ORIGINS.some(o => referer.startsWith(o + "/"));
  if (!okOrigin) return json(403, { error: "Forbidden" });


  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(500, { error: "Chat is temporarily unavailable." });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON body." }); }

  // Client-supplied system messages are ignored; only user/assistant turns pass.
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!turns.length || turns[turns.length - 1].role !== "user") return json(400, { error: "No message provided." });

  // Crisis screen before any model call: fixed resources, no products, no links.
  if (turns.some(m => m.role === "user" && isCrisis(m.content))) {
    return json(200, { reply: CRISIS_REPLY, hasAffiliate: false, crisis: true });
  }

  // Optional questionnaire context, whitelisted values only.
  const ctx = typeof body.context === "string" ? body.context.slice(0, 300).replace(/[^a-zA-Z ,'-]/g, "") : "";
  const system = SYSTEM_PROMPT + (ctx ? `\n\nOptional questionnaire answers from the visitor: ${ctx}. Use only if relevant.` : "") + todayLine();

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, ...turns], temperature: 0.5, max_tokens: 1400 }),
      signal: AbortSignal.timeout(25000)
    });
  } catch (e) {
    console.error("ai-chat upstream failed:", e && e.name);
    return json(502, { error: "The AI service is unavailable. Please try again in a moment." });
  }
  if (!res.ok) {
    console.error("ai-chat upstream status:", res.status);
    return json(res.status === 429 ? 429 : 502, { error: "The AI service returned an error. Please try again in a moment." });
  }
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) return json(200, { reply: "I'm not sure how to answer that. Could you rephrase it?", hasAffiliate: false });

  return json(200, postProcess(content));
};
