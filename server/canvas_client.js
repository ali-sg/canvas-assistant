// GET-only, rate-limited, paginated Canvas HTTP client. Never logs the token.
import { AsyncLocalStorage } from "node:async_hooks";

export const DEFAULT_BASE = "https://llu.instructure.com";
// Claude Desktop passes an unexpanded "${user_config.x}" literal when an optional field was never set.
const UNEXPANDED = /^\$\{user_config\.[^}]*\}$/;
/** Empty, whitespace-only or unexpanded values fall back to the default; trailing slashes are stripped. */
export function resolveBase(raw) {
  let v = typeof raw === "string" ? raw.trim() : "";
  if (UNEXPANDED.test(v)) v = "";
  return v.replace(/\/+$/, "") || DEFAULT_BASE;
}
/** Plain-language problem with a base URL, or null. Only https is allowed (the token must never travel in
 * cleartext); http://127.0.0.1 is accepted only when the test-only CANVAS_MCP_TEST_ALLOW_LOCAL_HTTP=1 is set. */
export function baseProblem(b) {
  let u;
  try { u = new URL(b); } catch { return "The Canvas URL in the extension settings isn't a web address. Use your school's Canvas address, like https://yourschool.instructure.com"; }
  if (u.username || u.password) return "The Canvas URL in the extension settings must not contain a user name or password. Use just the address, like https://yourschool.instructure.com";
  if (b.includes("?") || b.includes("#") || (u.pathname !== "/" && u.pathname !== "")) return "The Canvas URL in the extension settings must be just the address, with nothing after it, like https://yourschool.instructure.com";
  if (u.protocol === "https:") return null;
  if (u.protocol === "http:" && u.hostname === "127.0.0.1" && process.env.CANVAS_MCP_TEST_ALLOW_LOCAL_HTTP === "1") return null;
  return "The Canvas URL in the extension settings must start with https:// (a secure address), like https://yourschool.instructure.com";
}
export let BASE, BASE_PROBLEM;
/** BASE is the origin only (scheme + host + port) of an accepted address. */
function setBase(raw) { const b = resolveBase(raw); BASE_PROBLEM = baseProblem(b); BASE = BASE_PROBLEM ? b : new URL(b).origin; }
setBase(process.env.CANVAS_BASE_URL);
export function _setBaseForTests(b) { setBase(b); }
function checkBase() { if (BASE_PROBLEM) throw new RuntimeError(BASE_PROBLEM); }

export class CanvasError extends Error {
  /** msg is appended to "Canvas HTTP <status>" unless full is true (then it is the whole message). */
  constructor(status, msg = "", full = false) {
    super(full ? msg : `Canvas HTTP ${status} ${msg}`.trim());
    this.name = "CanvasError";
    this.status = status;
  }
}
export class RuntimeError extends Error {
  constructor(msg) { super(msg); this.name = "RuntimeError"; }
}

const MIN_INTERVAL = 120; // ms, ~8 requests/sec max
let last = -Infinity;
let gate = Promise.resolve();
let token = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getToken() {
  if (token === null) {
    let t = process.env.CANVAS_API_TOKEN || "";
    if (UNEXPANDED.test(t.trim())) t = "";
    if (!t) throw new RuntimeError("CANVAS_API_TOKEN is not set");
    token = t;
  }
  return token;
}

function throttle() {
  const p = gate.then(async () => {
    const wait = MIN_INTERVAL - (performance.now() - last);
    if (wait > 0) await sleep(wait);
    last = performance.now();
  });
  gate = p.catch(() => {});
  return p;
}

function buildUrl(url, params) {
  // Like httpx base_url: relative paths are appended to BASE; absolute URLs are used as-is.
  const full = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : BASE + (url.startsWith("/") ? url : "/" + url);
  if (!params) return full;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
  }
  const qs = q.toString();
  return qs ? full + (full.includes("?") ? "&" : "?") + qs : full;
}

export let _fetch = (...a) => fetch(...a);
export function _setFetchForTests(f) { _fetch = f; }

/** The JSON request primitive (download() below is the only other one). Both are GET-only. */
// At most MAX_INFLIGHT requests are in flight at once; each start is spaced by throttle() after taking a slot.
export const MAX_INFLIGHT = 3;
let inflight = 0;
const waiters = [];
export const _inflightStats = { max: 0 };
async function acquire() {
  if (inflight < MAX_INFLIGHT) inflight++;
  else await new Promise((r) => waiters.push(r)); // the releasing request hands its slot over
  _inflightStats.max = Math.max(_inflightStats.max, inflight);
}
function release() { const w = waiters.shift(); if (w) w(); else inflight--; }

async function request(url, params) {
  checkBase(); // never send the token to a non-https base
  await acquire();
  try { await throttle(); return await requestInner(url, params); } finally { release(); }
}
async function requestInner(url, params) {
  // Read-only by construction: always a GET.
  const method = "GET";
  const headers = { Authorization: `Bearer ${getToken()}`, Accept: "application/json" };
  let r;
  try {
    r = await _fetch(buildUrl(url, params), {
      method, headers,
      redirect: "manual", // never follow redirects with the bearer token (httpx default)
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw e;
    const err = new Error(`could not connect to ${BASE}` + (e && e.cause && e.cause.code ? ` (${e.cause.code})` : ""));
    err.name = "ConnectError"; // like httpx.ConnectError; message never includes the token
    throw err;
  }
  return { status: r.status, headers: r.headers, text: await r.text() };
}

export const MAX_RETRY_AFTER_MS = 20000; // keep a whole tool call well inside the client's request timeout
/** Wait before retry: Retry-After (seconds or an HTTP date) when present, capped; else 2 s, 4 s, 6 s... */
export function retryDelay(headers, attempt, now = Date.now()) {
  const v = headers && headers.get ? (headers.get("retry-after") || "").trim() : "";
  let ms = null;
  if (/^\d+(\.\d+)?$/.test(v)) ms = Number(v) * 1000;
  else if (v && !Number.isNaN(Date.parse(v))) ms = Math.max(0, Date.parse(v) - now);
  return Math.min(ms === null ? 2000 * (attempt + 1) : ms, MAX_RETRY_AFTER_MS);
}

// Total time one tool call may spend waiting to retry (shared by its concurrent requests).
export const RETRY_BUDGET_MS = 20000;
let retryLeft = RETRY_BUDGET_MS;
/** Called at the start of every tool call. */
export function resetRetryBudget(ms = RETRY_BUDGET_MS) { retryLeft = ms; }

async function _get(url, params = null) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await request(url, params);
    if (r.status === 429 || r.status === 503 || (r.status === 403 && r.text.toLowerCase().includes("rate limit"))) {
      if (attempt < 3) {
        const wait = retryDelay(r.headers, attempt);
        if (wait > retryLeft) throw new CanvasError(r.status, "Canvas is busy right now (too many requests). Stopped waiting after about 20 seconds in total; please try again in a minute.", true);
        retryLeft -= wait; // reserved before sleeping, so concurrent requests share one budget
        await sleep(wait);
      }
      continue;
    }
    if (r.status >= 400) throw new CanvasError(r.status, "on " + url.split("?")[0]);
    // Redirects are never followed (the token must not travel); usually a login page means a wrong URL or token.
    if (r.status >= 300) throw new CanvasError(r.status, `Canvas redirected (HTTP ${r.status}) \u2014 check the Canvas URL and token`, true);
    return r;
  }
  throw new CanvasError(429, "rate limited or busy (tried 4 times)");
}

/** Single GET; returns defaultValue on 403/404 (when one is given). */
export async function getOne(path, params = null, defaultValue = null) {
  try {
    return JSON.parse((await _get(path, params)).text);
  } catch (e) {
    if (e instanceof CanvasError && (e.status === 403 || e.status === 404) && defaultValue !== null && defaultValue !== undefined) {
      record("tolerated", { endpoint: endpointOf(path), status: e.status });
      return defaultValue;
    }
    throw e;
  }
}

/** Pagination links must stay on CANVAS_BASE_URL's scheme+host+port so the bearer token never leaves it. */
export function sameOrigin(url) {
  try {
    const u = new URL(url), b = new URL(BASE);
    return u.protocol === b.protocol && u.hostname === b.hostname && u.port === b.port;
  } catch {
    return false;
  }
}

export const TRUNCATIONS = []; // {endpoint, returned, cap} for any capped result during the current tool call
export const TOLERATED = [];   // {endpoint, status}: 403/404 (or an error body) swallowed as "empty" during the current call
/** Per-category scope (e.g. one changed_items category) that also receives these records, even when
 * several categories are fetched concurrently. Use: failureScope.run([], fn). */
export const failureScope = new AsyncLocalStorage();
export function record(kind, x) {
  (kind === "truncated" ? TRUNCATIONS : TOLERATED).push(x);
  const sc = failureScope.getStore();
  if (sc) sc.push({ kind, ...x });
}
const endpointOf = (path) => path.split("?")[0].split("/api/v1").pop().replace(/\d+/g, ":id");
const NEXT_RE = /<([^>]+)>;\s*rel="next"/;

/** Paginated GET (per_page=100, follows Link rel=next). 403/404 -> []. Records truncation past maxItems. */
export async function getAll(path, params = null, maxItems = 1000, tolerate = true) {
  params = { per_page: 100, ...(params || {}) };
  const out = [];
  let url = path;
  try {
    while (url && out.length < maxItems) {
      const r = await _get(url, params);
      const data = JSON.parse(r.text);
      if (data && typeof data === "object" && !Array.isArray(data) && "errors" in data) { record("tolerated", { endpoint: endpointOf(path), status: r.status }); break; }
      if (Array.isArray(data)) out.push(...data); else out.push(data);
      params = null;
      const m = NEXT_RE.exec(r.headers.get("link") || "");
      url = m ? m[1] : null;
      if (url && !sameOrigin(url)) throw new CanvasError(0, "refused off-host pagination link");
    }
  } catch (e) {
    if (tolerate && e instanceof CanvasError && (e.status === 403 || e.status === 404)) { record("tolerated", { endpoint: endpointOf(path), status: e.status }); return []; }
    throw e;
  }
  const res = out.slice(0, maxItems);
  const truncated = out.length > maxItems || Boolean(url);
  if (truncated) {
    record("truncated", { endpoint: endpointOf(path), returned: res.length, cap: maxItems });
  }
  return res;
}

/** Download a file's bytes (never written to disk). The bearer token is sent ONLY to CANVAS_BASE_URL's origin;
 * redirects (e.g. to inst-fs / S3) are followed by hand, https only, and WITHOUT the token. Stops at maxBytes. */
export async function download(startUrl, maxBytes) {
  checkBase();
  let url = /^[a-z][a-z0-9+.-]*:/i.test(startUrl) ? startUrl : BASE + (startUrl.startsWith("/") ? startUrl : "/" + startUrl);
  for (let hop = 0; hop < 6; hop++) {
    let u;
    try { u = new URL(url); } catch { throw new CanvasError(0, "bad file URL", false); }
    if (u.protocol !== "https:") throw new CanvasError(0, "Refused a non-https file link", true);
    const canvas = sameOrigin(url);
    if (canvas) await throttle();
    // Read-only: always a GET. Authorization only on the Canvas origin.
    const headers = canvas ? { Authorization: `Bearer ${getToken()}` } : {};
    let r;
    try {
      r = await _fetch(url, { method: "GET", headers, redirect: "manual", signal: AbortSignal.timeout(60000) });
    } catch (e) {
      if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw e;
      const err = new Error(`could not download the file from ${u.host}`); err.name = "ConnectError"; throw err;
    }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (r.body && r.body.cancel) await r.body.cancel().catch(() => {});
      if (!loc) throw new CanvasError(r.status, "file redirect without a location", false);
      url = new URL(loc, url).href;
      if (sameOrigin(url) && /\/login(\/|$|\?)/.test(new URL(url).pathname)) throw new CanvasError(r.status, "Canvas asked to sign in for this file \u2014 check the token", true);
      continue;
    }
    if (r.status >= 400) {
      if (r.body && r.body.cancel) await r.body.cancel().catch(() => {});
      throw new CanvasError(r.status, canvas ? "on file download" : `from file host ${u.host}`);
    }
    const declared = Number(r.headers.get("content-length") || 0);
    if (declared > maxBytes) { if (r.body && r.body.cancel) await r.body.cancel().catch(() => {}); return { tooLarge: true, size: declared }; }
    const chunks = []; let total = 0;
    if (r.body && r.body.getReader) {
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) { await reader.cancel().catch(() => {}); return { tooLarge: true, size: total }; }
        chunks.push(value);
      }
    } else {
      const b = new Uint8Array(await r.arrayBuffer()); total = b.byteLength;
      if (total > maxBytes) return { tooLarge: true, size: total };
      chunks.push(b);
    }
    return { bytes: Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))), contentType: r.headers.get("content-type") || "" };
  }
  throw new CanvasError(0, "too many redirects for this file", false);
}
