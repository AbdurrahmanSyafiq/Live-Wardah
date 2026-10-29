// Data layer for the Creative Report page (sheet tab "Creative Report").
// Columns are matched loosely: Date, Platform, Pilar, Spend, Impressions, Clicks.
import { parseNum } from "@/lib/formatters";

export type CreativeRow = {
  platform: string;
  pilar: string;
  format: string;
  adGroup: string;
  funnel: string;
  account: string;
  adName: string;
  views6s: number;
  views15s: number;
  engagement: number; // Actions_Post_Engagement, or likes + comments + shares
  t: number; // day number (UTC midnight / 86400000), used for range filtering
  spend: number;
  impressions: number;
  clicks: number;
};

const norm = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pickKey = (keys: string[], candidates: string[]) => {
  for (const c of candidates) {
    const f = keys.find((k) => norm(k) === norm(c));
    if (f !== undefined) return f;
  }
  return undefined;
};

const PILLAR_NAMES: Record<string, string> = {
  "1": "Digital Transformation",
  "2": "KOLs",
  "3": "Brandcomm, Streamverse, Affiliates",
  "4": "Market Development/Community",
  "5": "Media",
  "6": "EGC",
  "7": "CMM",
};

// "PILAR 1" -> "Pillar 1: Digital Transformation". Anything else (e.g. "Lainnya") stays as is.
export const normalizePilar = (raw: string): string => {
  const s = String(raw ?? "").trim();
  const mt = s.match(/^(?:pilar|pillar)\s*(\d+)/i);
  if (mt && PILLAR_NAMES[mt[1]])
    return `Pillar ${mt[1]}: ${PILLAR_NAMES[mt[1]]}`;
  return s;
};

// Sort key so pillars come in number order, everything else after
export const pilarSortKey = (label: string): string => {
  const mt = label.match(/^Pillar (\d+)/);
  return mt ? `0${mt[1].padStart(3, "0")}` : `1${label.toLowerCase()}`;
};

// Account names: every Wardah account ("Wardah", "Wardah_IDJ2DMCK x Lazada CPAS", ...) becomes "Wardah"
export const normalizeAccount = (raw: string): string => {
  const s = String(raw ?? "").trim();
  return /^wardah([_\s-]|$)/i.test(s) ? "Wardah" : s;
};

// "CPAS - Conversion (Lazada)" -> "Lazada"
export const normalizePlatformLabel = (raw: string): string => {
  const s = String(raw ?? "").trim();
  const mt = s.match(/^cpas\b.*\(([^)]+)\)\s*$/i);
  return mt ? mt[1].trim() : s;
};

const DAY = 86400000;
export const toDayNumber = (y: number, m: number, d: number) =>
  Math.floor(Date.UTC(y, m - 1, d) / DAY);
export const dayNumberToIso = (t: number) =>
  new Date(t * DAY).toISOString().slice(0, 10);
export const isoToDayNumber = (iso: string) => {
  const mt = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return mt ? toDayNumber(+mt[1], +mt[2], +mt[3]) : null;
};

// Decide once for the whole sheet whether "a/b/yyyy" is day/month or month/day
const detectDayFirst = (values: any[]): boolean => {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const v of values) {
    const mt = String(v ?? "")
      .trim()
      .match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if (!mt) continue;
    if (+mt[1] > 12) firstOver12 = true;
    if (+mt[2] > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return true;
  return false; // default month/day (the format other tabs in this sheet use)
};

const parseDay = (value: any, dayFirst: boolean): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const t = Math.floor(Math.round((value - 25569) * 86400 * 1000) / DAY);
    return isNaN(t) ? null : t;
  }
  const s = String(value).trim();
  let mt = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  let y = 0,
    m = 0,
    d = 0;
  if (mt) {
    y = +mt[1];
    m = +mt[2];
    d = +mt[3];
  } else {
    mt = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if (!mt) return null;
    y = +mt[3];
    if (dayFirst) {
      d = +mt[1];
      m = +mt[2];
    } else {
      m = +mt[1];
      d = +mt[2];
    }
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return toDayNumber(y, m, d);
};

export const normalizeCreativeRows = (
  rawRows: any[],
): { rows: CreativeRow[]; missing: string[] } => {
  if (!rawRows || rawRows.length === 0) return { rows: [], missing: [] };
  const keys = Object.keys(rawRows[0]);
  const kDate = pickKey(keys, ["date", "tanggal", "day", "week start"]);
  const kPlatform = pickKey(keys, ["platform"]);
  const kPilar = pickKey(keys, ["pilar", "pillar", "content pillar"]);
  const kFormat = pickKey(keys, ["format", "new format"]);
  const kAdGroup = pickKey(keys, [
    "ad group",
    "ad_group",
    "adgroup",
    "ad set",
    "adset",
  ]);
  const kFunnel = pickKey(keys, ["funnel"]);
  const kAccount = pickKey(keys, ["account_name", "account name", "account"]);
  const kAdName = pickKey(keys, ["ad name", "ad_name"]);
  const k15 = pickKey(keys, [
    "focused_view_15s",
    "focused view 15s",
    "views 15s",
    "15s views",
  ]);
  const k6 =
    pickKey(keys, [
      "views_6s",
      "views 6s",
      "video views 6s",
      "6s views",
      "views6s",
    ]) || keys.find((k) => /^views6/.test(norm(k)));
  const kEng = pickKey(keys, [
    "actions_post_engagement",
    "post engagement",
    "engagement",
    "engagements",
  ]);
  const kLikes = pickKey(keys, ["likes", "like"]);
  const kComments = pickKey(keys, ["comments", "comment"]);
  const kShares = pickKey(keys, ["shares", "share"]);
  const kSpend = pickKey(keys, [
    "spend",
    "ad spend",
    "amount spent",
    "cost",
    "expense",
  ]);
  const kImp = pickKey(keys, ["impressions", "impression", "impr"]);
  // Prefer the plain "Clicks" column; otherwise any column starting with "click"
  // (but not link/anchor clicks, which are only parts of it), then link clicks.
  const kClicks =
    pickKey(keys, ["clicks", "click", "combined clicks"]) ||
    keys.find((k) => norm(k).startsWith("click")) ||
    pickKey(keys, ["link clicks", "link_clicks"]);

  const missing: string[] = [];
  if (!kDate) missing.push("Date");
  if (!kPlatform) missing.push("Platform");
  if (!kPilar) missing.push("Pilar");
  if (!kFormat) missing.push("Format");
  if (!kAdGroup) missing.push("Ad Group");
  if (!kFunnel) missing.push("Funnel");
  if (!kAccount) missing.push("Account_Name");
  if (!kAdName) missing.push("Ad Name");
  if (!k6) missing.push("Views 6s");
  if (!k15) missing.push("Focused_View_15S");
  if (!kEng && !(kLikes || kComments || kShares)) missing.push("Engagement");
  if (!kSpend) missing.push("Spend");
  if (!kImp) missing.push("Impressions");
  if (!kClicks) missing.push("Clicks");
  if (!kDate) return { rows: [], missing };

  const dayFirst = detectDayFirst(rawRows.map((r) => r[kDate]));
  const rows: CreativeRow[] = [];
  for (const r of rawRows) {
    const t = parseDay(r[kDate], dayFirst);
    if (t === null) continue;
    rows.push({
      platform: normalizePlatformLabel(
        String(kPlatform ? (r[kPlatform] ?? "") : ""),
      ),
      pilar: normalizePilar(String(kPilar ? (r[kPilar] ?? "") : "")),
      format: String(kFormat ? (r[kFormat] ?? "") : "").trim(),
      adGroup: String(kAdGroup ? (r[kAdGroup] ?? "") : "").trim(),
      funnel: String(kFunnel ? (r[kFunnel] ?? "") : "").trim(),
      account: normalizeAccount(String(kAccount ? (r[kAccount] ?? "") : "")),
      adName: String(kAdName ? (r[kAdName] ?? "") : "").trim(),
      views6s: k6 ? parseNum(r[k6]) : 0,
      views15s: k15 ? parseNum(r[k15]) : 0,
      engagement: kEng
        ? parseNum(r[kEng])
        : (kLikes ? parseNum(r[kLikes]) : 0) +
          (kComments ? parseNum(r[kComments]) : 0) +
          (kShares ? parseNum(r[kShares]) : 0),
      t,
      spend: kSpend ? parseNum(r[kSpend]) : 0,
      impressions: kImp ? parseNum(r[kImp]) : 0,
      clicks: kClicks ? parseNum(r[kClicks]) : 0,
    });
  }
  return { rows, missing };
};

// Same date range, one month earlier (end day is clamped to the month length)
export const shiftRangeOneMonthBack = (from: number, to: number) => {
  const shift = (t: number) => {
    const dt = new Date(t * DAY);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth(); // 0-based
    const d = dt.getUTCDate();
    const lastPrev = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Math.floor(Date.UTC(y, m - 1, Math.min(d, lastPrev)) / DAY);
  };
  return { from: shift(from), to: shift(to) };
};
