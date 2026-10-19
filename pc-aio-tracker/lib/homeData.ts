// Data layer untuk halaman General Overview (Home).
// Sumber data: sheet per bulan ("Wardah Sep", "Wardah Oct", ...).
// Kolom yang dipakai: platform, product, date, spend, impressions, clicks, catalog_segment_value_omni_purchase (tampil sebagai GMV).

import { parseNum } from "@/lib/formatters";

// Bulan yang tersedia di filter -> nama sheet-nya. Tambah baris baru di sini kalau ada bulan baru.
export const HOME_MONTH_SHEETS: Record<string, string> = {
  "2026-10": "Wardah Oct",
  "2026-09": "Wardah Sep",
};

// Urutan di filter: terbaru di atas
export const HOME_MONTHS: string[] = Object.keys(HOME_MONTH_SHEETS).sort(
  (a, b) => b.localeCompare(a),
);

export type HomeRow = {
  ym: string; // "2026-10"
  day: number; // 1..31
  platform: string; // sudah dinormalisasi: Shopee, Lazada, Meta, TikTok
  brand: string; // dari kolom "product"
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

// Ubah baris mentah dari satu sheet jadi baris standar.
// Format tanggal (bulan/hari vs hari/bulan) dideteksi otomatis dari bulan yang diharapkan untuk sheet itu.
export const normalizeSheetRows = (
  rawRows: any[],
  expectedYm: string,
): { rows: HomeRow[]; missing: string[] } => {
  if (!rawRows || rawRows.length === 0) return { rows: [], missing: [] };

  const keys = Object.keys(rawRows[0]);
  const kDate = pickKey(keys, ["date", "day", "tanggal"]);
  const kPlatform = pickKey(keys, ["platform"]);
  const kBrand = pickKey(keys, ["product", "brand"]);
  const kSpend = pickKey(keys, ["spend", "cost", "ad spend"]);
  const kImp = pickKey(keys, ["impressions", "impression"]);
  const kClicks = pickKey(keys, ["clicks", "click"]);
  // GMV di dashboard diambil dari kolom catalog_segment_value_omni_purchase
  const kFunnel = pickKey(keys, ["funnel"]);
  const kCategory = pickKey(keys, ["category"]);
  const kCampaign = pickKey(keys, ["campaign", "campaign_name"]);
  const kGmv = pickKey(keys, ["catalog_segment_value_omni_purchase"]);

  const missing: string[] = [];
  if (!kDate) missing.push("date");
  if (!kSpend) missing.push("spend");
  if (!kImp) missing.push("impressions");
  if (!kClicks) missing.push("clicks");
  if (!kGmv) missing.push("catalog_segment_value_omni_purchase");
  if (!kPlatform) missing.push("platform");
  if (!kFunnel && !kCampaign) missing.push("funnel");
  if (!kCategory && !kCampaign) missing.push("category");
  if (!kDate) return { rows: [], missing };

  // Deteksi format tanggal
  let mdy = 0;
  let dmy = 0;
  for (const r of rawRows) {
    const a = parseYmd(r[kDate], "MDY");
    const b = parseYmd(r[kDate], "DMY");
    if (validYmd(a) && ymOf(a) === expectedYm) mdy++;
    if (validYmd(b) && ymOf(b) === expectedYm) dmy++;
  }
  const fmt: DateFmt = dmy > mdy ? "DMY" : "MDY";

  const rows: HomeRow[] = [];
  for (const r of rawRows) {
    const p = parseYmd(r[kDate], fmt);
    if (!validYmd(p)) continue;
    rows.push({
      ym: ymOf(p),
      day: p.d,
      platform: normalizePlatform(kPlatform ? r[kPlatform] : ""),
      brand: String(kBrand ? (r[kBrand] ?? "") : "").trim(),
      funnel:
        String(kFunnel ? (r[kFunnel] ?? "") : "").trim() ||
        funnelFromCampaign(kCampaign ? r[kCampaign] : "") ||
        "Unspecified",
      category:
        String(kCategory ? (r[kCategory] ?? "") : "").trim() ||
        categoryFromCampaign(kCampaign ? r[kCampaign] : "") ||
        "Unspecified",
      spend: kSpend ? parseNum(r[kSpend]) : 0,
      impressions: kImp ? parseNum(r[kImp]) : 0,
      clicks: kClicks ? parseNum(r[kClicks]) : 0,
      gmv: kGmv ? parseNum(r[kGmv]) : 0,
    });
  }
  return { rows, missing };
};

// Untuk halaman PID & SKU: ubah baris sheet jadi bentuk yang dibaca halaman itu
// (PID = ad_id, SKU Name = ad_name, Ad Type = funnel).
const skuPairs = (
  rawRows: any[],
  expectedYm: string,
): { raw: any; row: Record<string, any> }[] => {
  if (!rawRows || rawRows.length === 0) return [];
  const keys = Object.keys(rawRows[0]);
  const kDate = pickKey(keys, ["date", "day", "tanggal"]);
  if (!kDate) return [];
  const kPlatform = pickKey(keys, ["platform"]);
  const kBrand = pickKey(keys, ["product", "brand"]);
  const kSpend = pickKey(keys, ["spend", "cost", "ad spend"]);
  const kGmv = pickKey(keys, ["catalog_segment_value_omni_purchase"]);
  const kImp = pickKey(keys, ["impressions", "impression"]);
  const kClicks = pickKey(keys, ["clicks", "click"]);
  const kOrders = pickKey(keys, ["results", "result", "orders", "purchases"]);
  const kPid = pickKey(keys, ["ad_id", "pid", "product_id"]);
  const kName = pickKey(keys, ["ad_name", "sku_name", "product_name"]);
  const kFunnel = pickKey(keys, ["funnel"]);
  const kCampaign = pickKey(keys, ["campaign", "campaign_name"]);

  let mdy = 0;
  let dmy = 0;
  for (const r of rawRows) {
    const a = parseYmd(r[kDate], "MDY");
    const b = parseYmd(r[kDate], "DMY");
    if (validYmd(a) && ymOf(a) === expectedYm) mdy++;
    if (validYmd(b) && ymOf(b) === expectedYm) dmy++;
  }
  const fmt: DateFmt = dmy > mdy ? "DMY" : "MDY";

  const out: { raw: any; row: Record<string, any> }[] = [];
  for (const r of rawRows) {
    const p = parseYmd(r[kDate], fmt);
    if (!validYmd(p)) continue;
    const funnel =
      String(kFunnel ? (r[kFunnel] ?? "") : "").trim() ||
      funnelFromCampaign(kCampaign ? r[kCampaign] : "");
    out.push({
      raw: r,
      row: {
        Date: `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`,
        "Brand fx": String(kBrand ? (r[kBrand] ?? "") : "").trim(),
        Platform: normalizePlatform(kPlatform ? r[kPlatform] : ""),
        "Live Type": funnel,
        "Ad Type": funnel,
        PID: String(kPid ? (r[kPid] ?? "") : "").trim(),
        "SKU Name": String(kName ? (r[kName] ?? "") : "").trim(),
        Expense: kSpend ? parseNum(r[kSpend]) : 0,
        GMV: kGmv ? parseNum(r[kGmv]) : 0,
        Impressions: kImp ? parseNum(r[kImp]) : 0,
        Clicks: kClicks ? parseNum(r[kClicks]) : 0,
        "Items Sold": kOrders ? parseNum(r[kOrders]) : 0,
      },
    });
  }
  return out;
};

export const toSkuRows = (
  rawRows: any[],
  expectedYm: string,
): Record<string, any>[] => skuPairs(rawRows, expectedYm).map((x) => x.row);

// Untuk halaman Commerce Tracker: hanya baris "commerce"
// = CPAS Shopee & Lazada (iklan Meta ke marketplace) + TikTok dengan funnel Conversion.
// Meta biasa dan TikTok Awareness/Consideration masuk Digital Media.
export const isCommerceRow = (row: Record<string, any>): boolean => {
  const plat = String(row.Platform || "").toLowerCase();
  if (plat === "shopee" || plat === "lazada") return true;
  if (plat === "tiktok")
    return String(row["Ad Type"] || "")
      .toLowerCase()
      .includes("conversion");
  return false;
};

export const toCommerceRows = (
  rawRows: any[],
  expectedYm: string,
): Record<string, any>[] =>
  toSkuRows(rawRows, expectedYm).filter(isCommerceRow);

// Untuk halaman Digital Media: kebalikan Commerce
// = Meta biasa + TikTok dengan funnel Awareness/Consideration (bukan Conversion).
// Nama kolom mengikuti yang dibaca DigitalMediaView.
export const isDigitalRow = (row: Record<string, any>): boolean => {
  const plat = String(row.Platform || "").toLowerCase();
  if (plat === "meta") return true;
  if (plat === "tiktok")
    return !String(row.KPI || "")
      .toLowerCase()
      .includes("conversion");
  return false;
};

export const toMediaRows = (
  rawRows: any[],
  expectedYm: string,
): Record<string, any>[] => {
  if (!rawRows || rawRows.length === 0) return [];
  const keys = Object.keys(rawRows[0]);
  const kViews15 = pickKey(keys, [
    "video_play_15s",
    "video_views_15s",
    "views_15s",
    "thruplay",
    "video_p15",
    "video_view_15s",
  ]);
  const kViews6 = pickKey(keys, [
    "video_play_6s",
    "video_views_6s",
    "views_6s",
    "video_view_6s",
    "6s_video_views",
    "video_views_p6s",
  ]);
  const kObj = pickKey(keys, ["objective"]);
  const out: Record<string, any>[] = [];
  for (const { raw: r, row: b } of skuPairs(rawRows, expectedYm)) {
    const row = {
      Date: b.Date,
      Brand: b["Brand fx"],
      Platform: b.Platform,
      Funnel: b["Ad Type"],
      KPI: b["Ad Type"],
      Format: (kObj ? String(r[kObj] ?? "").trim() : "") || "-",
      "Ad Spend": b.Expense,
      Impressions: b.Impressions,
      "Combined Clicks": b.Clicks,
      Views: kViews15 ? parseNum(r[kViews15]) : 0,
      "Views 6s": kViews6 ? parseNum(r[kViews6]) : 0,
      Result: 0,
      GMV: b.GMV,
      "Purchases With Shared Items": b["Items Sold"],
    };
    if (isDigitalRow(row)) out.push(row);
  }
  return out;
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

  const rows =
    brand === "All" ? allRows : allRows.filter((r) => r.brand === brand);

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
