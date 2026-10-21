// Data layer: merapikan baris dari tab "Media API" dan "Commerce" untuk semua halaman.

import { parseNum } from "@/lib/formatters";

// Nama tab di Google Sheets.
// Digital Media membaca "Media API", Commerce Tracker membaca "Commerce", General Overview membaca keduanya.
export const MEDIA_SHEET = "Media API";
export const COMMERCE_SHEET = "Commerce";

// Daftar tab yang boleh dibaca. Dipakai juga oleh app/api/sheets/route.ts sebagai daftar tab yang diizinkan.
export const HOME_MONTH_SHEETS: Record<string, string> = {
  media: MEDIA_SHEET,
  commerce: COMMERCE_SHEET,
};

export type HomeRow = {
  ym: string; // "2026-10"
  day: number; // 1..31
  platform: string; // sudah dinormalisasi: Shopee, Lazada, Meta, TikTok
  brand: string; // dari kolom "product"
  format: string; // kolom Format (Media API) / New Format (Commerce)
  funnel: string; // kolom "funnel" (atau diekstrak dari campaign)
  category: string; // kolom "category" (atau diekstrak dari campaign)
  spend: number;
  impressions: number;
  clicks: number;
  gmv: number;
};

const norm = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Cari nama kolom sesuai urutan prioritas kandidat (kandidat pertama yang ketemu dipakai)
const pickKey = (keys: string[], candidates: string[]): string | undefined => {
  for (const c of candidates) {
    const found = keys.find((k) => norm(k) === norm(c));
    if (found !== undefined) return found;
  }
  return undefined;
};

// meta_cpas_lazada -> Lazada, meta_cpas_shopee -> Shopee, meta -> Meta, tiktok -> TikTok
export const normalizePlatform = (raw: any): string => {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "Unspecified";
  if (/^meta[_\s-]*cpas$/.test(s)) return "Meta";
  const cpas = s.match(/cpas[_\s-]+(.+)$/);
  const base = (cpas ? cpas[1] : s).replace(/[_\s-]+/g, " ").trim();
  const known: Record<string, string> = {
    tiktok: "TikTok",
    "tik tok": "TikTok",
    shopee: "Shopee",
    lazada: "Lazada",
    meta: "Meta",
    facebook: "Meta",
    instagram: "Instagram",
    google: "Google",
    youtube: "YouTube",
  };
  if (known[base]) return known[base];
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
};

type DateFmt = "MDY" | "DMY";
type Ymd = { y: number; m: number; d: number };

const parseYmd = (value: any, fmt: DateFmt): Ymd | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (isNaN(dt.getTime())) return null;
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
    };
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    return fmt === "MDY" ? { y: +m[3], m: a, d: b } : { y: +m[3], m: b, d: a };
  }
  return null;
};

const validYmd = (p: Ymd | null): p is Ymd =>
  !!p && p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= 31;

const ymOf = (p: Ymd) => `${p.y}-${String(p.m).padStart(2, "0")}`;

// Format tanggal di sheet bisa hari/bulan (01/04/2026 = 1 April) atau bulan/hari.
// Dideteksi otomatis: kalau ada angka > 12 di posisi pertama berarti hari/bulan, di posisi kedua berarti bulan/hari.
// Kalau tidak bisa dipastikan, dianggap hari/bulan.
const detectDateFmt = (rawRows: any[], kDate: string): DateFmt => {
  let mdy = 0;
  let dmy = 0;
  for (const r of rawRows) {
    const m = String(r[kDate] ?? "")
      .trim()
      .match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  return mdy > dmy ? "MDY" : "DMY";
};

const isoOf = (p: Ymd) =>
  `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;

// Tab "Media API" -> baris untuk halaman Digital Media.
// Kolom sheet: Date, Brand, Category, Format, Funnel, Platform, Ad Type, Ad Spend, Impressions,
// Purchases With Shared Items, Link Clicks, Anchor Clicks, ...
// Tanggal diubah jadi YYYY-MM-DD; "Combined Clicks" = Link Clicks + Anchor Clicks (kalau kolom Combined Clicks tidak ada).
export const toMediaApiRows = (rawRows: any[]): Record<string, any>[] => {
  if (!rawRows || rawRows.length === 0) return [];
  const keys = Object.keys(rawRows[0]);
  const kDate = pickKey(keys, ["date", "tanggal"]);
  if (!kDate) return [];
  const kSpend = pickKey(keys, ["ad spend", "spend", "expense", "cost"]);
  const kImp = pickKey(keys, ["impressions", "impression"]);
  const kCombined = pickKey(keys, ["combined clicks"]);
  const kLink = pickKey(keys, ["link clicks", "link click"]);
  const kAnchor = pickKey(keys, ["anchor clicks", "anchor click"]);
  const kKpi = pickKey(keys, ["kpi"]);
  const kAdType = pickKey(keys, ["ad type"]);
  const kFunnel = pickKey(keys, ["funnel"]);
  const kBrand = pickKey(keys, ["brand"]);
  const fmt = detectDateFmt(rawRows, kDate);

  const out: Record<string, any>[] = [];
  for (const r of rawRows) {
    const p = parseYmd(r[kDate], fmt);
    if (!validYmd(p)) continue;
    out.push({
      ...r,
      Date: isoOf(p),
      Brand: String(kBrand ? (r[kBrand] ?? "") : "").trim(),
      "Ad Spend": kSpend ? parseNum(r[kSpend]) : 0,
      Impressions: kImp ? parseNum(r[kImp]) : 0,
      "Combined Clicks": kCombined
        ? parseNum(r[kCombined])
        : (kLink ? parseNum(r[kLink]) : 0) +
          (kAnchor ? parseNum(r[kAnchor]) : 0),
      KPI: kKpi ? r[kKpi] : kAdType ? r[kAdType] : kFunnel ? r[kFunnel] : "",
    });
  }
  return out;
};

// Tab "Commerce" -> baris untuk halaman Commerce Tracker dan PID & SKU.
// Kolom sheet: Platform, Placement, Ad Type, Date, PID / CID, Ad Name, Product Name, Bidding Method,
// Impression, Clicks, Orders, Direct Order, Items Sold, Direct Items, GMV, Direct GMV, Expense, Live Views, Brand, ..., Brand fx.
export const toCommerceApiRows = (rawRows: any[]): Record<string, any>[] => {
  if (!rawRows || rawRows.length === 0) return [];
  const keys = Object.keys(rawRows[0]);
  const kDate = pickKey(keys, ["date", "tanggal"]);
  if (!kDate) return [];
  const kImp = pickKey(keys, ["impressions", "impression"]);
  const kPid = pickKey(keys, ["pid / cid", "pid", "cid"]);
  const kName = pickKey(keys, ["product name", "sku name", "ad name"]);
  const kAdType = pickKey(keys, ["ad type"]);
  const kBrandFx = pickKey(keys, ["brand fx"]);
  const kBrand = pickKey(keys, ["brand"]);
  const kFormat = pickKey(keys, ["new format", "format"]);
  const kFunnel = pickKey(keys, ["funnel"]);
  const fmt = detectDateFmt(rawRows, kDate);

  const out: Record<string, any>[] = [];
  for (const r of rawRows) {
    const p = parseYmd(r[kDate], fmt);
    if (!validYmd(p)) continue;
    const brand = String(
      (kBrandFx ? r[kBrandFx] : "") || (kBrand ? r[kBrand] : "") || "",
    ).trim();
    out.push({
      ...r,
      Date: isoOf(p),
      "Brand fx": brand,
      Format: String(kFormat ? (r[kFormat] ?? "") : "").trim(),
      Impressions: kImp ? parseNum(r[kImp]) : 0,
      PID: String(kPid ? (r[kPid] ?? "") : "").trim(),
      "SKU Name": String(kName ? (r[kName] ?? "") : "").trim(),
      Funnel: String(kFunnel ? (r[kFunnel] ?? "") : "").trim(),
      "Live Type":
        String(kFunnel ? (r[kFunnel] ?? "") : "").trim() ||
        (kAdType ? r[kAdType] : ""),
    });
  }
  return out;
};

// General Overview = gabungan Media API + Commerce jadi satu format.
// Media API: spend = Ad Spend. Commerce: spend = Expense, GMV = GMV, funnel = "Conversion".
export const buildHomeRows = (
  mediaRaw: any[],
  commerceRaw: any[],
): { rows: HomeRow[]; missing: string[] } => {
  const rows: HomeRow[] = [];
  const missing: string[] = [];
  const ymd = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return { ym: `${y}-${String(m).padStart(2, "0")}`, day: d };
  };

  const media = toMediaApiRows(mediaRaw);
  if (mediaRaw && mediaRaw.length > 0) {
    const keys = Object.keys(mediaRaw[0]);
    if (!pickKey(keys, ["date"])) missing.push("Media API: Date");
    if (!pickKey(keys, ["ad spend", "spend"]))
      missing.push("Media API: Ad Spend");
    if (!pickKey(keys, ["impressions", "impression"]))
      missing.push("Media API: Impressions");
  }
  for (const r of media) {
    rows.push({
      ...ymd(r.Date),
      platform: normalizePlatform(r.Platform),
      brand: String(r.Brand || "").trim(),
      format: String(r.Format || "").trim(),
      funnel: String(r.Funnel || "").trim() || "Unspecified",
      category: String(r.Category || "").trim() || "Unspecified",
      spend: r["Ad Spend"],
      impressions: r.Impressions,
      clicks: r["Combined Clicks"],
      gmv: 0, // GMV hanya dari tab Commerce (hindari hitungan ganda)
    });
  }

  const commerce = toCommerceApiRows(commerceRaw);
  if (commerceRaw && commerceRaw.length > 0) {
    const keys = Object.keys(commerceRaw[0]);
    if (!pickKey(keys, ["date"])) missing.push("Commerce: Date");
    if (!pickKey(keys, ["expense"])) missing.push("Commerce: Expense");
    if (!pickKey(keys, ["gmv"])) missing.push("Commerce: GMV");
  }
  for (const r of commerce) {
    rows.push({
      ...ymd(r.Date),
      platform: normalizePlatform(r.Platform),
      brand: String(r["Brand fx"] || "").trim(),
      format: String(r.Format || "").trim(),
      funnel: String(r.Funnel || "").trim() || "Conversion",
      category:
        String(r["New Category"] || r.Category || "").trim() || "Unspecified",
      spend: parseNum(r.Expense),
      impressions: r.Impressions,
      clicks: parseNum(r.Clicks),
      gmv: parseNum(r.GMV),
    });
  }
  return { rows, missing };
};

type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  gmv: number;
  ctr: number;
  roas: number;
  cpc: number;
  cpm: number;
};

const totals = (rows: HomeRow[]): Totals => {
  let spend = 0,
    impressions = 0,
    clicks = 0,
    gmv = 0;
  for (const r of rows) {
    spend += r.spend;
    impressions += r.impressions;
    clicks += r.clicks;
    gmv += r.gmv;
  }
  return {
    spend,
    impressions,
    clicks,
    gmv,
    ctr: impressions ? clicks / impressions : 0,
    roas: spend ? gmv / spend : 0,
    cpc: clicks ? spend / clicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
  };
};

const prevYm = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

// Cadangan kalau kolom funnel/category belum ada di sheet: ekstrak dari nama campaign (dipisah "_").
// Funnel = bagian ke-11. Category = bagian ke-8, tapi kalau isinya "All Product" pakai bagian ke-7.
const campaignParts = (campaign: any) =>
  String(campaign ?? "")
    .split("_")
    .map((x) => x.trim());
export const funnelFromCampaign = (campaign: any) =>
  campaignParts(campaign)[10] || "";
export const categoryFromCampaign = (campaign: any) => {
  const p = campaignParts(campaign);
  const c = p[7] || "";
  return c.toLowerCase() === "all product" ? p[6] || "" : c;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthShort = (ym: string) => MONTH_SHORT[Number(ym.split("-")[1]) - 1];
const monthLong = (ym: string) =>
  `${MONTH_LONG[Number(ym.split("-")[1]) - 1]} ${ym.split("-")[0]}`;

// Week 1 = tgl 1-7, Week 2 = 8-14, Week 3 = 15-21, Week 4 = 22-28, Week 5 = 29-akhir bulan
export const weekOfDay = (day: number) => Math.ceil(day / 7);

export const buildHomeSummary = (
  allRows: HomeRow[],
  periods: string[],
  brand: string,
  missing: string[] = [],
  format: string = "All",
) => {
  const sortedPeriods = [...periods].sort();

  // Info per bulan dihitung dari SEMUA baris (tidak terpengaruh filter brand), supaya stabil.
  const maxDay: Record<string, number> = {};
  allRows.forEach((r) => {
    if (!maxDay[r.ym] || r.day > maxDay[r.ym]) maxDay[r.ym] = r.day;
  });
  const monthsWithData = Object.keys(maxDay).sort();
  const latestDataYm = monthsWithData[monthsWithData.length - 1];
  // Bulan yang masih berjalan = bulan data terbaru yang belum sampai akhir bulan
  const inProgress = (ym: string) =>
    ym === latestDataYm && maxDay[ym] < daysInMonth(ym);

  const rows = allRows.filter(
    (r) =>
      (brand === "All" || r.brand === brand) &&
      (format === "All" || r.format === format),
  );

  const currentRows = rows.filter((r) => sortedPeriods.includes(r.ym));
  // Pembanding = bulan sebelumnya. Kalau bulan terpilih masih berjalan, dipotong di tanggal yang sama (like-for-like).
  const previousRows = rows.filter((r) =>
    sortedPeriods.some(
      (p) => r.ym === prevYm(p) && r.day <= (inProgress(p) ? maxDay[p] : 31),
    ),
  );
  const hasPrevious = sortedPeriods.every((p) =>
    monthsWithData.includes(prevYm(p)),
  );

  const current = totals(currentRows);
  const previous = totals(previousRows);

  // Mingguan (MTD)
  const trend: {
    key: string;
    label: string;
    ym: string;
    week: number;
    spend: number;
    impressions: number;
    clicks: number;
    gmv: number;
  }[] = [];
  sortedPeriods.forEach((ym) => {
    const weeks = Math.ceil((maxDay[ym] || 0) / 7);
    for (let w = 1; w <= weeks; w++) {
      const t = totals(
        currentRows.filter((r) => r.ym === ym && weekOfDay(r.day) === w),
      );
      trend.push({
        key: `${ym}-W${w}`,
        label:
          sortedPeriods.length === 1 ? `Week ${w}` : `${monthShort(ym)} W${w}`,
        ym,
        week: w,
        spend: t.spend,
        impressions: t.impressions,
        clicks: t.clicks,
        gmv: t.gmv,
      });
    }
  });

  // Harian (MTD): satu titik per tanggal, dari tanggal 1 sampai tanggal data terakhir di bulan itu
  const dayAcc = new Map<
    string,
    { spend: number; impressions: number; clicks: number; gmv: number }
  >();
  currentRows.forEach((r) => {
    const k = `${r.ym}-${r.day}`;
    const t = dayAcc.get(k) || { spend: 0, impressions: 0, clicks: 0, gmv: 0 };
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.clicks += r.clicks;
    t.gmv += r.gmv;
    dayAcc.set(k, t);
  });
  const dailyTrend: {
    key: string;
    label: string;
    spend: number;
    impressions: number;
    clicks: number;
    gmv: number;
  }[] = [];
  sortedPeriods.forEach((ym) => {
    for (let d = 1; d <= (maxDay[ym] || 0); d++) {
      const t = dayAcc.get(`${ym}-${d}`) || {
        spend: 0,
        impressions: 0,
        clicks: 0,
        gmv: 0,
      };
      dailyTrend.push({
        key: `${ym}-${d}`,
        label:
          sortedPeriods.length === 1 ? String(d) : `${monthShort(ym)} ${d}`,
        ...t,
      });
    }
  });

  // Platform mix (berdasarkan spend)
  const groupSpend = (rs: HomeRow[]) => {
    const m = new Map<string, number>();
    rs.forEach((r) => m.set(r.platform, (m.get(r.platform) || 0) + r.spend));
    return Array.from(m, ([label, total]) => ({ label, total })).sort(
      (a, b) => b.total - a.total,
    );
  };
  const platformMix = groupSpend(currentRows);
  const order = platformMix.map((p) => p.label);
  const platformTrend = trend.map((item) => {
    const rs = currentRows.filter(
      (r) => r.ym === item.ym && weekOfDay(r.day) === item.week,
    );
    const g = new Map(groupSpend(rs).map((x) => [x.label, x.total] as const));
    return {
      ...item,
      mix: order.map((label) => ({ label, total: g.get(label) || 0 })),
    };
  });

  // Funnel & Category mix (berdasarkan GMV)
  const groupBy = (rs: HomeRow[], field: "funnel" | "category") => {
    const m = new Map<string, number>();
    rs.forEach((r) => m.set(r[field], (m.get(r[field]) || 0) + r.gmv));
    // Baris yang funnel/category-nya tidak terbaca ('Unspecified') tidak ditampilkan
    m.delete("Unspecified");
    return Array.from(m, ([label, total]) => ({ label, total })).sort(
      (a, b) => b.total - a.total,
    );
  };
  const funnelMixAll = groupBy(currentRows, "funnel");
  const funnelOrder = funnelMixAll.map((f) => f.label);
  const funnelTrend = trend.map((item) => {
    const rs = currentRows.filter(
      (r) => r.ym === item.ym && weekOfDay(r.day) === item.week,
    );
    const g = new Map(
      groupBy(rs, "funnel").map((x) => [x.label, x.total] as const),
    );
    return {
      ...item,
      mix: funnelOrder.map((label) => ({ label, total: g.get(label) || 0 })),
    };
  });

  const periodLabel =
    sortedPeriods.length === 1
      ? monthLong(sortedPeriods[0])
      : `${sortedPeriods.length} Months Selected (${sortedPeriods.join(", ")})`;

  return {
    current,
    previous,
    hasPrevious,
    trend,
    dailyTrend,
    platformMix: platformMix.slice(0, 5),
    platformTrend,
    funnelMix: funnelMixAll.slice(0, 5),
    funnelTrend,
    categoryMix: groupBy(currentRows, "category").slice(0, 6),
    maxOf: (items: { total: number }[]) =>
      Math.max(...items.map((i) => i.total), 1),
    periodLabel,
    missing,
  };
};

export type HomeSummary = ReturnType<typeof buildHomeSummary>;
