// Sanity check for the chat guide's system prompt. Run: node scripts/check-chat-prompt.cjs
// Fails (exit 1) if the prompt links a site page that is not in sitemap.xml,
// if a site page in sitemap.xml is missing from the chat's guide list, if the
// crisis guidance is gone, or if a date is used as a "current" claim.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const { SYSTEM_PROMPT, SITE_PATHS, SITE_URL } = require(path.join(root, "netlify/functions/lib/chat-config.js"));
const { postProcess } = require(path.join(root, "netlify/functions/lib/ai-chat.js"));
const { CRISIS_REPLY } = require(path.join(root, "netlify/functions/lib/crisis.js"));

const sitemap = new Set([...fs.readFileSync(path.join(root, "sitemap.xml"), "utf8").matchAll(/<loc>https:\/\/telehealthnavigatorai\.com(\/[^<]*)<\/loc>/g)].map(m => m[1]));
let fail = 0;
const bad = (msg) => { console.log("FAIL", msg); fail++; };

// 1. Every on-site URL in the prompt is in the sitemap (or is /chat).
const urls = [...SYSTEM_PROMPT.matchAll(/https:\/\/telehealthnavigatorai\.com(\/[^\s)|,"]*)?/g)].map(m => (m[1] || "/").replace(/[.;:]+$/, ""));
const uniq = [...new Set(urls)];
for (const u of uniq) if (!sitemap.has(u) && u !== "/chat") bad(`prompt links ${u}, not in sitemap.xml`);
console.log(`site URLs named in prompt: ${uniq.length} unique, all checked against ${sitemap.size} sitemap URLs`);

// 2. Every sitemap page is allowed by the link filter.
for (const p of sitemap) if (!SITE_PATHS.includes(p)) bad(`sitemap page ${p} missing from SITE_PATHS`);

// 3. The link filter keeps real pages and replaces made-up ones.
const t = postProcess(`See ${SITE_URL}/guide-medicare-telehealth and ${SITE_URL}/guide-made-up-page.`);
if (!t.reply.includes("/guide-medicare-telehealth ") || t.reply.includes("made-up")) bad("postProcess did not filter on-site URLs: " + t.reply);

// 4. Crisis guidance.
for (const s of ["988", "911"]) {
  if (!SYSTEM_PROMPT.includes(s)) bad(`prompt lost ${s}`);
  if (!CRISIS_REPLY.includes(s)) bad(`crisis reply lost ${s}`);
}

// 5. Dates: list every year mention; none may be phrased as a present-tense claim.
const years = [...SYSTEM_PROMPT.matchAll(/[^.\n]{0,60}\b20\d\d\b[^.\n]{0,40}/g)].map(m => m[0].trim());
const stale = years.filter(s => /\b(as of|currently|this year|right now|today is|now in)\b/i.test(s));
for (const s of stale) bad("present-tense date claim: " + s);
if (!/Today's date/.test(SYSTEM_PROMPT)) bad("date rule missing");
console.log(`year mentions in prompt: ${years.length} (all dated facts, check dates or deadlines; none phrased as current)`);

console.log(fail ? `${fail} problem(s)` : "chat prompt check: OK");
process.exit(fail ? 1 : 0);
