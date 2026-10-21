#!/usr/bin/env node
/*
 * apply-affiliate-links.cjs: keeps every outbound brand link in sync with
 * data/affiliate-links.json.
 *
 * Usage (from the repo root):
 *   node scripts/apply-affiliate-links.cjs          # dry run: report what would change
 *   node scripts/apply-affiliate-links.cjs --write  # apply the changes
 *   node scripts/apply-affiliate-links.cjs --brand "Talkspace"   # limit to one brand
 *
 * Rules per brand status:
 *   active                       trackingUrl must be set. Homepage links to the brand
 *                                (href = https://[www.]host or host/) become trackingUrl
 *                                and get rel="sponsored noopener noreferrer". Deep links
 *                                (e.g. a pricing page cited as a source) are left alone.
 *   program-available-not-joined same as no-program until activated.
 *   no-program                   "sponsored" is removed from rel (noopener noreferrer kept).
 *   blocked                      reported as an error; links must be removed by hand.
 *
 * Files scanned: *.html (root and one level down), generate-pages.js (funeral
 * generator templates), and netlify/functions/chat-config.(js|mjs) (chat link map:
 * url and the affiliate flag are synced).
 *
 * Disclosure: whenever a page ends up with at least one rel="sponsored" link, the
 * script inserts a one-line <p class="affiliate-note"> just before the block that
 * holds the first such link (FTC: disclose near the link), and removes that note
 * from pages that no longer have any. Funeral generator templates are not given
 * notes; the generated pages on disk are, the next time the script runs.
 *
 * Never put a guessed or placeholder tracking URL in the JSON. Paste the exact
 * link from the network dashboard. After --write, review `git diff` and commit.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");
const bi = process.argv.indexOf("--brand");
const ONLY = bi > -1 ? process.argv[bi + 1] : null;

const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data/affiliate-links.json"), "utf8")).brands;

function listFiles() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) {
    const p = path.join(ROOT, f);
    if (f.endsWith(".html")) out.push(p);
    else if (fs.statSync(p).isDirectory() && !f.startsWith(".") && !["node_modules", "netlify", "data", "scripts"].includes(f)) {
      for (const g of fs.readdirSync(p)) if (g.endsWith(".html")) out.push(path.join(p, g));
    }
  }
  for (const extra of ["generate-pages.js", "netlify/functions/chat-config.js", "netlify/functions/chat-config.mjs"]) {
    if (fs.existsSync(path.join(ROOT, extra))) out.push(path.join(ROOT, extra));
  }
  return out;
}


const NOTE_RE = /\n?[ \t]*<p class="affiliate-note">[\s\S]*?<\/p>/g;
const DISCLOSURE_HREF = fs.existsSync(path.join(ROOT, "generate-pages.js")) ? "affiliate-disclosure.html" : "/affiliate-disclosure";
function syncDisclosure(html, rel) {
  if (/affiliate-disclosure\.html$/.test(rel)) return html;
  const first = html.search(/<a\b[^>]*rel="[^"]*\bsponsored\b[^"]*"/);
  if (first === -1) return html.replace(NOTE_RE, "");
  if (/<p class="affiliate-note">/.test(html)) return html;
  const head = html.slice(0, first);
  const starts = ["<p", "<ul", "<ol", "<table", "<div"].map((t) => head.lastIndexOf(t)).filter((i) => i > -1);
  const at = starts.length ? Math.max(...starts) : first;
  const indent = (head.slice(0, at).match(/[ \t]*$/) || [""])[0];
  const note = `<p class="affiliate-note"><small>We may earn a commission from some links in this section, at no cost to you. <a href="${DISCLOSURE_HREF}">How this works</a>.</small></p>\n${indent}`;
  return html.slice(0, at) + note + html.slice(at);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const errors = [];
const summary = {};
let filesChanged = 0;

function fixRel(tag, wantSponsored) {
  const m = tag.match(/\srel="([^"]*)"/);
  let parts = m ? m[1].split(/\s+/).filter(Boolean) : [];
  parts = parts.filter((p) => p !== "sponsored");
  if (wantSponsored) parts = ["sponsored", ...parts.filter((p) => p !== "nofollow")];
  for (const p of ["noopener", "noreferrer"]) if (!parts.includes(p)) parts.push(p);
  const rel = ` rel="${parts.join(" ")}"`;
  return m ? tag.replace(/\srel="[^"]*"/, rel) : tag.replace(/<a\b/, "<a" + rel);
}

for (const file of listFiles()) {
  const rel = path.relative(ROOT, file);
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  for (const [brand, b] of Object.entries(map)) {
    if (ONLY && brand !== ONLY) continue;
    for (const host of b.hosts || []) {
      const h = esc(host);
      // <a ...> tags whose href points at this host (any path)
      const tagRe = new RegExp(`<a\\b[^>]*href="(https?://(?:www\\.)?${h}(/[^"]*)?)"[^>]*>`, "g");
      text = text.replace(tagRe, (tag, href, p) => {
        const isHome = !p || p === "/";
        if (b.status === "blocked") { errors.push(`${rel}: blocked brand ${brand} linked (${href})`); return tag; }
        if (b.status === "no-program" || b.status === "program-available-not-joined") {
          if (/\bsponsored\b/.test(tag)) { summary[brand] = (summary[brand] || 0) + 1; return fixRel(tag, false); }
          return tag;
        }
        if (b.status === "active") {
          if (!b.trackingUrl) { errors.push(`${brand}: status active but trackingUrl empty`); return tag; }
          let t = tag;
          if (isHome) t = t.replace(`href="${href}"`, `href="${b.trackingUrl}"`);
          if (isHome) t = fixRel(t, true);
          if (t !== tag) summary[brand] = (summary[brand] || 0) + 1;
          return t;
        }
        return tag;
      });
      // chat-config link map entries: { ... url: "https://www.host", ... affiliate: true|false ... }
      if (/chat-config\.m?js$/.test(rel)) {
        const entryRe = new RegExp(`(\\{[^{}]*url:\\s*")(https?://(?:www\\.)?${h}/?)("[^{}]*\\})`, "g");
        text = text.replace(entryRe, (all, a, url, c) => {
          let out = all;
          if (b.status === "no-program" || b.status === "program-available-not-joined") out = out.replace(/affiliate:\s*true/, "affiliate: false");
          if (b.status === "active" && b.trackingUrl) out = a + b.trackingUrl + c.replace(/affiliate:\s*false/, "affiliate: true");
          if (out !== all) summary[brand + " (chat map)"] = (summary[brand + " (chat map)"] || 0) + 1;
          return out;
        });
      }
    }
  }
  // FTC: a page with a sponsored link carries a short disclosure just before the
  // first block that contains one. Pages with none lose the note. Idempotent.
  if (rel.endsWith(".html")) text = syncDisclosure(text, rel);
  if (text !== orig) {
    filesChanged++;
    if (WRITE) fs.writeFileSync(file, text);
  }
}

console.log(`${WRITE ? "Applied" : "Dry run"}: ${filesChanged} file(s) ${WRITE ? "changed" : "would change"}`);
for (const [k, v] of Object.entries(summary).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v} link(s)`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s):`);
  for (const e of [...new Set(errors)].slice(0, 50)) console.log("  " + e);
  process.exitCode = 1;
}
