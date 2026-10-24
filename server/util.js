// Small shared helpers: HTML -> plain text, SHA-256 of normalized text, date parsing, value comparison.
import { createHash } from "node:crypto";

/** Value of o[k], or null when missing (like dict.get). */
export const g = (o, k) => (o && typeof o === "object" && Object.hasOwn(o, k) && o[k] !== undefined ? o[k] : null);
/** False for null, false, 0, "" and empty arrays/objects (so an empty {} counts as "nothing"). */
export function truthy(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}
/** First n characters (by code point, so emoji are never split). */
export const clip = (s, n) => (s.length <= n ? s : [...s].slice(0, n).join(""));

const ENTITIES = Object.assign(Object.create(null), {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", ndash: "\u2013", mdash: "\u2014",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d", hellip: "\u2026", bull: "\u2022",
  middot: "\u00b7", copy: "\u00a9", reg: "\u00ae", trade: "\u2122", deg: "\u00b0", times: "\u00d7",
  rarr: "\u2192", laquo: "\u00ab", raquo: "\u00bb",
});
function unescapeHtml(s) {
  return s.replace(/&(#[0-9]{1,8}|#[xX][0-9a-fA-F]{1,7}|[A-Za-z]+);/g, (m, e) => {
    if (e[0] !== "#") return ENTITIES[e] ?? m;
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff) ? "\ufffd" : String.fromCodePoint(n);
  });
}
/** Max HTML/XML characters cleaned per call; longer input is cut first (cleanTextInfo reports input_truncated). */
export const MAX_HTML_CHARS = 2 * 1024 * 1024;
const BREAK_TAG = /^(br|\/p|\/div|\/li|\/h\d)\s*\/?$/i; // anchored; only tried on short tags
/** Lower-cases ASCII letters only, so every index still lines up with the original string
 * (String#toLowerCase can change the length, e.g. U+0130 "İ" becomes two code units). */
export const lowerAscii = (s) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

/** Calls f(kind, a, b) for each piece of h in one linear pass: ("text", start, end) or ("tag", start, end) where
 * h[start] === "<" and h[end - 1] === ">". script/style elements (open tag through their close tag) are dropped;
 * one with no complete close tag drops the rest of the input, like a browser. Every search moves forward and
 * failed searches are cached, so the cost stays linear even for hostile input (e.g. 200k lone "<" or 80k
 * unclosed "<style>"). */
export function scanTags(h, f) {
  const lower = lowerAscii(h), n = h.length;
  let i = 0, textStart = 0, gt = -2; // gt: cached next ">" for the main scan (-1 = none left); only ever moves forward
  const nextGt = (from) => { if (gt !== -1 && gt < from) gt = h.indexOf(">", from); return gt; };
  const close = { script: -2, style: -2 }; // cached next "</script" / "</style" (-1 = none left)
  const nextClose = (name, from) => {
    if (close[name] !== -1 && close[name] < from) close[name] = lower.indexOf("</" + name, from);
    return close[name];
  };
  while (i < n) {
    const lt = h.indexOf("<", i);
    if (lt === -1) break;
    if (!/[A-Za-z\/!?]/.test(h[lt + 1] || "")) { i = lt + 1; continue; } // "5 < 10", "a <= b", "<>": plain text
    const e = nextGt(lt + 1);
    if (e === -1) break; // no ">" anywhere after: the rest is text
    if (lt > textStart) f("text", textStart, lt);
    const m = /^<(script|style)(?![a-z0-9])/.exec(lower.slice(lt, lt + 8));
    if (m) {
      const c = nextClose(m[1], e + 1);
      // the close tag's ">" is found with its own search, so the main ">" cache never jumps ahead
      const ce = c === -1 ? -1 : h.indexOf(">", c + 2 + m[1].length);
      if (ce === -1) { textStart = n; break; } // unclosed element: drop the rest
      i = textStart = ce + 1; continue; // drop the whole element
    }
    f("tag", lt, e + 1); // any length: a long tag (e.g. an inline data: image) is skipped, never shown as text
    i = textStart = e + 1;
  }
  if (textStart < n) f("text", textStart, n);
}

/** HTML -> plain text: drop script/style, line breaks for block ends, strip tags, decode entities.
 * Linear time. Input over MAX_HTML_CHARS is cut first. Returns { text, input_truncated }. */
export function cleanTextInfo(h, limit = null) {
  if (!h || typeof h !== "string") return { text: "", input_truncated: false };
  const input_truncated = h.length > MAX_HTML_CHARS;
  if (input_truncated) h = h.slice(0, MAX_HTML_CHARS);
  const parts = [];
  scanTags(h, (kind, a, b) => {
    if (kind === "text") parts.push(h.slice(a, b));
    else if (b - a <= 16 && BREAK_TAG.test(h.slice(a + 1, b - 1))) parts.push("\n");
  });
  // Collapse runs of blank (whitespace-only) lines into one empty line, line by line (no backtracking regex).
  const lines = unescapeHtml(parts.join("")).split("\n"), out = [];
  let blank = false;
  for (const ln of lines) {
    if (ln.trim() === "") { blank = true; continue; }
    if (blank && out.length) out.push("");
    blank = false; out.push(ln);
  }
  const t = out.join("\n").trim();
  return { text: limit ? clip(t, limit) : t, input_truncated };
}
export const cleanText = (h, limit = null) => cleanTextInfo(h, limit).text;
/** SHA-256 of whitespace-normalized text; the snapshot never stores the text itself. */
export const sha = (t) => (t ? createHash("sha256").update(t.replace(/\s+/g, " ").trim(), "utf8").digest("hex") : null);

/** Canvas ISO timestamp -> epoch ms, or null. */
export function parseDt(s) {
  if (typeof s !== "string" || !s) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}
export const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/** JSON with sorted object keys, for order-insensitive equality of snapshot values. */
export const stableJson = (v) => JSON.stringify(v ?? null, (_, x) =>
  x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);
export const same = (a, b) => stableJson(a) === stableJson(b);

/** Like Promise.all, but if one fails it first waits for all the others to settle, then rethrows the first error
 * in input order (the earliest rejected promise in the array, not the first to reject in time).
 * Nothing is left running in the background after a failed tool call. */
export async function allSettledThrow(promises) {
  const rs = await Promise.allSettled(promises);
  const bad = rs.find((r) => r.status === "rejected");
  if (bad) throw bad.reason;
  return rs.map((r) => r.value);
}
/** Map with at most n tasks running at once; results keep input order. After a failure no new tasks start,
 * the running ones finish, then the first error is thrown. */
export async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0, failed = false;
  await allSettledThrow(Array.from({ length: Math.min(Math.max(1, Number.isFinite(n) ? n : 1), items.length) }, async () => {
    while (!failed && i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { failed = true; throw e; }
    }
  }));
  return out;
}
