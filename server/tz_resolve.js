// Time zone resolution. Reads ONLY time_zone from GET /api/v1/users/self/profile; nothing else is kept,
// returned or logged. Cached per server process (never written to disk). Conversion uses Intl (DST-correct).
import { getOne } from "./canvas_client.js";

export const FALLBACK_RETRY_SECONDS = 300;
export const LAST = {}; // timezone/timezone_source of the current tool call
const CACHE = {}; // {zone, source, note, at} for the process lifetime
export function clearLast() { for (const k of Object.keys(LAST)) delete LAST[k]; }
export function _resetCacheForTests() { for (const k of Object.keys(CACHE)) delete CACHE[k]; }

const FMT = new Map();
function fmt(zone) {
  let f = FMT.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
    FMT.set(zone, f);
  }
  return f;
}
/** True for a zone name Intl knows (Region/City style or UTC). Offsets like "+05:00" are not accepted. */
export function isZone(name) {
  if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(name)) return false;
  try { fmt(name); return true; } catch { return false; }
}
function parts(ms, zone) {
  const p = {};
  for (const x of fmt(zone).formatToParts(new Date(ms))) p[x.type] = x.value;
  if (p.hour === "24") p.hour = "00";
  return p;
}
/** "YYYY-MM-DD HH:MM <abbr>" in zone, abbreviation from Intl (e.g. PDT, EST, GMT+5:30). */
export function formatLocal(ms, zone) {
  const p = parts(ms, zone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.timeZoneName}`;
}
/** Local calendar date of ms in zone, plus n days. */
export function localDatePlus(ms, zone, n = 0) {
  const p = parts(ms, zone);
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day + n)).toISOString().slice(0, 10);
}

// Rails/ActiveSupport display names Canvas may return -> IANA
export const RAILS = new Map(Object.entries({
  "Hawaii": "Pacific/Honolulu", "Alaska": "America/Juneau",
  "Pacific Time (US & Canada)": "America/Los_Angeles", "Arizona": "America/Phoenix",
  "Mountain Time (US & Canada)": "America/Denver", "Central Time (US & Canada)": "America/Chicago",
  "Eastern Time (US & Canada)": "America/New_York", "Indiana (East)": "America/Indiana/Indianapolis",
  "Atlantic Time (Canada)": "America/Halifax", "Newfoundland": "America/St_Johns",
  "Saskatchewan": "America/Regina", "Tijuana": "America/Tijuana", "Mexico City": "America/Mexico_City",
  "Puerto Rico": "America/Puerto_Rico", "American Samoa": "Pacific/Pago_Pago", "Guam": "Pacific/Guam",
  "UTC": "Etc/UTC", "London": "Europe/London", "Dublin": "Europe/Dublin", "Lisbon": "Europe/Lisbon",
  "Paris": "Europe/Paris", "Berlin": "Europe/Berlin", "Madrid": "Europe/Madrid", "Rome": "Europe/Rome",
  "Amsterdam": "Europe/Amsterdam", "Athens": "Europe/Athens", "Istanbul": "Europe/Istanbul",
  "Moscow": "Europe/Moscow", "Cairo": "Africa/Cairo", "Nairobi": "Africa/Nairobi",
  "Lagos": "Africa/Lagos", "Johannesburg": "Africa/Johannesburg", "Dubai": "Asia/Dubai",
  "Abu Dhabi": "Asia/Dubai", "Riyadh": "Asia/Riyadh", "Karachi": "Asia/Karachi",
  "Mumbai": "Asia/Kolkata", "New Delhi": "Asia/Kolkata", "Kolkata": "Asia/Kolkata", "Chennai": "Asia/Kolkata",
  "Kathmandu": "Asia/Kathmandu", "Dhaka": "Asia/Dhaka", "Bangkok": "Asia/Bangkok", "Jakarta": "Asia/Jakarta",
  "Singapore": "Asia/Singapore", "Kuala Lumpur": "Asia/Kuala_Lumpur", "Hong Kong": "Asia/Hong_Kong",
  "Beijing": "Asia/Shanghai", "Taipei": "Asia/Taipei", "Manila": "Asia/Manila", "Seoul": "Asia/Seoul",
  "Tokyo": "Asia/Tokyo", "Sydney": "Australia/Sydney", "Melbourne": "Australia/Melbourne",
  "Brisbane": "Australia/Brisbane", "Perth": "Australia/Perth", "Adelaide": "Australia/Adelaide",
  "Auckland": "Pacific/Auckland", "Bogota": "America/Bogota", "Lima": "America/Lima",
  "Santiago": "America/Santiago", "Buenos Aires": "America/Argentina/Buenos_Aires", "Brasilia": "America/Sao_Paulo",
  "Caracas": "America/Caracas", "Central America": "America/Guatemala",
}));

/** IANA zone name for an IANA or Rails name, else null. */
export function normalize(name) {
  if (!name || typeof name !== "string") return null;
  name = name.trim();
  const iana = isZone(name) ? name : RAILS.get(name);
  return iana && isZone(iana) ? iana : null;
}

async function fetchProfileZone() {
  let tz;
  try {
    const prof = await getOne("/api/v1/users/self/profile");
    tz = prof && typeof prof === "object" ? prof.time_zone : undefined; // only this field is read
  } catch (e) {
    return [null, `profile request failed (${(e && e.name) || "Error"}); dates shown in UTC`];
  }
  const z = normalize(tz);
  return z ? [z, null] : [null, "Canvas profile has no usable time_zone; dates shown in UTC"];
}

export async function profileZone() {
  // Cache a real profile zone for the process; retry a UTC fallback after a few minutes.
  const now = performance.now() / 1000;
  const stale = CACHE.source === "fallback_utc" && now - (CACHE.at || 0) > FALLBACK_RETRY_SECONDS;
  if (!Object.keys(CACHE).length || stale) {
    const [z, note] = await fetchProfileZone();
    _resetCacheForTests();
    Object.assign(CACHE, { zone: z || "UTC", source: z ? "canvas_profile" : "fallback_utc", note, at: performance.now() / 1000 });
  }
  return CACHE;
}

export async function resolve(override = null) {
  let z, src, note;
  if (override) {
    if (!isZone(override)) throw new Error("timezone must be a valid IANA name (e.g. Region/City). It is not saved.");
    [z, src, note] = [override, "override", null];
  } else {
    const c = await profileZone();
    [z, src, note] = [c.zone, c.source, c.note];
  }
  clearLast();
  Object.assign(LAST, { timezone: z, timezone_source: src });
  if (note) LAST.timezone_note = note;
  return z;
}
