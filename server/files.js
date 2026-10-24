// Course-file helpers: find file links in Canvas HTML and turn a downloaded file into text. Nothing touches disk.
import { inflateRawSync } from "node:zlib";
import { Worker } from "node:worker_threads";
import { cleanText, cleanTextInfo, scanTags, lowerAscii, MAX_HTML_CHARS } from "./util.js";

const FILE_PATH = /\/(?:api\/v1\/)?(?:courses\/(\d+)\/)?files\/(\d+)(?:[/?#]|$)/;
const WORD = /[A-Za-z0-9_-]/;
/** Value of attribute name in a tag's attribute text (quoted values only). Linear: forward indexOf scans only. */
const attr = (attrs, name) => {
  const low = lowerAscii(attrs); // same length as attrs, so indexes line up
  for (let k = low.indexOf(name); k !== -1; k = low.indexOf(name, k + 1)) {
    if (k > 0 && WORD.test(low[k - 1])) continue;
    let j = k + name.length;
    while (j < low.length && /\s/.test(low[j])) j++;
    if (low[j] !== "=") continue;
    j++;
    while (j < low.length && /\s/.test(low[j])) j++;
    const q = attrs[j];
    if (q !== '"' && q !== "'") continue;
    const end = attrs.indexOf(q, j + 1);
    if (end === -1) return "";
    return attrs.slice(j + 1, end).replace(/&amp;/g, "&");
  }
  return "";
};

/** Canvas file links and off-Canvas links in a piece of HTML. sameOriginFn says whether a URL is on this Canvas. */
export function findLinks(html, sameOriginFn) {
  const files = [], external = [];
  if (!html || typeof html !== "string") return { files, external };
  if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);
  // One linear tag scan; an <a> collects text until its </a> (an <a> with no </a> is ignored, as before).
  const found = []; let open = null;
  const lowTag = (a, b) => lowerAscii(html.slice(a, Math.min(b, a + 6)));
  scanTags(html, (kind, a, b) => {
    if (kind === "text") return;
    const lt = lowTag(a, b);
    if (/^<a(?![a-z0-9])/.test(lt)) { open = { attrs: html.slice(a + 2, b - 1), from: b }; return; }
    if (/^<\/a(?![a-z0-9])/.test(lt)) { if (open) found.push({ tag: "a", attrs: open.attrs, inner: html.slice(open.from, a) }); open = null; return; }
    if (/^<img(?![a-z0-9])/.test(lt)) found.push({ tag: "img", attrs: html.slice(a + 4, b - 1), inner: "" });
  });
  for (const { tag, attrs, inner } of found) {
    const href = tag === "a" ? attr(attrs, "href") : attr(attrs, "src");
    const endpoint = attr(attrs, "data-api-endpoint");
    const text = cleanText(tag === "a" ? inner : attr(attrs, "alt")).replace(/\s+/g, " ").trim() || attr(attrs, "title");
    const canvasish = (u) => u && (u.startsWith("/") || sameOriginFn(u));
    const fm = (canvasish(endpoint) && FILE_PATH.exec(endpoint)) || (canvasish(href) && FILE_PATH.exec(href));
    if (fm) { files.push({ file_id: Number(fm[2]), name: text || attr(attrs, "title") || `file ${fm[2]}` }); continue; }
    if (tag === "a" && /^https?:\/\//i.test(href) && !sameOriginFn(href)) external.push({ url: href, text: text || href });
  }
  return { files, external };
}

// ---- tiny zip reader (docx / pptx only; deflate via node:zlib) ----
const MAX_UNZIP = 50 * 1024 * 1024; // running total of decompressed bytes (zip-bomb guard)
const MAX_ENTRIES = 2000;
export function unzip(buf, want) {
  const out = new Map();
  let total = 0;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const n = buf.readUInt16LE(eocd + 10);
  if (n > MAX_ENTRIES) throw new Error("too many files inside it");
  let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42), name = buf.toString("utf8", p + 46, p + 46 + nl);
    p += 46 + nl + el + cl;
    if (!want(name)) continue;
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(start, start + csize);
    let raw;
    if (method === 0) raw = data;
    else if (method === 8) {
      try { raw = inflateRawSync(data, { maxOutputLength: MAX_UNZIP - total }); } catch { throw new Error("too large when unzipped"); }
    } else continue;
    total += raw.length;
    if (total >= MAX_UNZIP) throw new Error("too large when unzipped");
    out.set(name, raw.toString("utf8"));
  }
  return out;
}

/** Office XML -> text (literal replacements only, then the linear cleaner). Returns { text, input_truncated }. */
const xmlText = (xml, para) => cleanTextInfo(xml.replace(/<w:tab\/>|<a:tab\/>/g, "\t").replace(/<w:br\/>|<a:br\/>/g, "\n").replace(para, "\n"));

function officeText(buf, kind) {
  if (kind === "docx") {
    const m = unzip(buf, (n) => n === "word/document.xml");
    if (!m.has("word/document.xml")) throw new Error("no document body");
    const r = xmlText(m.get("word/document.xml"), /<\/w:p>/g);
    return { text: r.text, pages: null, input_truncated: r.input_truncated };
  }
  const m = unzip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const names = [...m.keys()].sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  let cut = false;
  const text = names.map((n, i) => { const r = xmlText(m.get(n), /<\/a:p>/g); cut ||= r.input_truncated; return `[Slide ${i + 1}]\n` + r.text; }).join("\n\n");
  return { text, pages: names.length, input_truncated: cut };
}

export const PDF_TIMEOUT_MS = 30000;
/** Resolve with p, or reject with "took too long to read" after ms. */
export function withTimeout(p, ms) {
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("took too long to read")), ms); });
  p.catch(() => {});
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
async function pdfText(buf, timeoutMs = PDF_TIMEOUT_MS) {
  const { getDocumentProxy, extractText } = await import("unpdf");
  let pdf = null;
  const work = (async () => {
    pdf = await getDocumentProxy(new Uint8Array(buf), { verbosity: 0, isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
    const r = await extractText(pdf, { mergePages: false });
    return { text: r.text.map((t, i) => `[Page ${i + 1}]\n${t}`).join("\n\n"), pages: r.totalPages };
  })();
  try { return await withTimeout(work, timeoutMs); }
  finally { if (pdf) try { await pdf.destroy(); } catch { /* ignore */ } }
}

/** Which extractor a file needs, from its name and content type; null = unsupported. */
export function kindOf(name, contentType) {
  const ext = (String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
  const ct = String(contentType || "").toLowerCase();
  if (ext === "pdf" || ct.includes("application/pdf")) return "pdf";
  if (ext === "docx" || ct.includes("wordprocessingml")) return "docx";
  if (ext === "pptx" || ct.includes("presentationml")) return "pptx";
  if (["html", "htm"].includes(ext) || ct.startsWith("text/html")) return "html";
  if (["txt", "md", "csv", "tsv", "json", "rtf"].includes(ext) || ct.startsWith("text/")) return "text";
  return null;
}

export async function extract(buf, kind, opts = {}) {
  if (kind === "pdf") return pdfText(buf, opts.timeoutMs);
  if (kind === "docx" || kind === "pptx") return officeText(buf, kind);
  const s = buf.toString("utf8");
  if (kind === "html") { const r = cleanTextInfo(s); return { text: r.text, pages: null, input_truncated: r.input_truncated }; }
  return { text: s.replace(/\r\n?/g, "\n"), pages: null };
}

/** env: {} so the worker sees no environment at all (no CANVAS_API_TOKEN); stdout/stderr are kept off the MCP pipe. */
export const WORKER_OPTIONS = Object.freeze({ env: {}, resourceLimits: { maxOldGenerationSizeMb: 512 }, stdout: true, stderr: true });
export const EXTRACT_HARD_TIMEOUT_MS = 45000; // the worker is killed after this, even if it is stuck in a sync loop
/** extract() in a worker thread with a hard timeout and a memory cap, so a hostile file can't hang or bloat the
 * server. Falls back to in-thread extract() only if worker threads aren't available at all. */
export function extractIsolated(buf, kind, opts = {}) {
  const hardMs = opts.hardTimeoutMs ?? EXTRACT_HARD_TIMEOUT_MS;
  let w;
  try {
    w = new Worker(new URL("./extract_worker.js", import.meta.url), { ...WORKER_OPTIONS, workerData: { buf, kind, timeoutMs: opts.timeoutMs } });
  } catch { return extract(buf, kind, opts); }
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); w.terminate().catch(() => {}); fn(v); };
    const timer = setTimeout(() => finish(reject, new Error("took too long to read")), hardMs);
    w.once("message", (m) => (m && m.ok ? finish(resolve, m.r) : finish(reject, new Error((m && m.msg) || "error"))));
    w.once("error", (e) => finish(reject, new Error(/memory/i.test(String(e && e.message)) ? "too large to read" : (e && e.message) || "error")));
    w.once("exit", (code) => finish(reject, new Error(`reader stopped (${code})`)));
  });
}
