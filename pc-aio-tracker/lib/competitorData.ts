// Data layer halaman Competitor. Ada dua sumber:
// - Brand kita : tab "Media API (Filtered)", kolom brand_2 (+ Date, Views, dst), dijumlah per periode
// - Competitor : tab "Competitor_sosmed_sinkron", kolom Brand (+ published_at, views, likes, dst)
// Kalau tab competitor punya kolom "Competitor" (brand kita yang dibandingkan), dipakai untuk memasangkan.
import { parseNum } from "@/lib/formatters";

export const COMPETITOR_METRICS: { key: string; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "engagement", label: "Engagement (Likes + Comments + Shares)" },
];

export type CompetitorPost = {
  platform: string;
  brand: string;
  competitor: string;
  ym: string; // "2026-10"
  day: number; // 1..31
  metrics: Record<string, number>;
  campaign: string; // brand kita: Campaign Name (Media API)
  postId: string; // competitor: id postingan (dari kolom id, atau dari url)
  url: string;
  caption: string;
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

// Tanggal posting: "2026-09-30T12:00:00Z", "9/30/2026", atau angka serial Google Sheets
const parseDate = (value: any): { ym: string; day: number } | null => {
  if (value === null || value === undefined || value === "") return null;
  let y = 0,
    m = 0,
    d = 0;
  if (typeof value === "number") {
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (isNaN(dt.getTime())) return null;
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  } else {
    const s = String(value).trim();
    let mt = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (mt) {
      y = +mt[1];
      m = +mt[2];
      d = +mt[3];
    } else {
      mt = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
      if (!mt) return null;
      const a = +mt[1];
      const b = +mt[2];
      y = +mt[3];
      // a > 12 pasti hari; selain itu dianggap bulan/hari (format sheet ini)
      if (a > 12) {
        d = a;
        m = b;
      } else {
        m = a;
        d = b;
      }
    }
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { ym: `${y}-${String(m).padStart(2, "0")}`, day: d };
};

type Source = {
  brand: string[];
  platform: string[];
  comp: string[];
  date: string[];
  campaign: string[];
  id: string[];
  url: string[];
  caption: string[];
  metrics: Record<string, string[]>;
};

const COMPETITOR_SRC: Source = {
  brand: ["brand"],
  platform: ["platform"],
  comp: ["competitor", "compared brand", "own brand", "brand kita"],
  date: ["published_at", "published at", "published date", "published", "date"],
  campaign: [],
  id: ["id", "post id", "video id"],
  url: ["url", "link"],
  caption: ["caption", "description"],
  metrics: {
    views: ["views", "view"],
    likes: ["likes", "like"],
    comments: ["comments", "comment"],
    shares: ["shares", "share"],
  },
};

const OWN_SRC: Source = {
  brand: ["brand_2", "brand"],
  platform: ["platform_2", "platform"],
  comp: [],
  date: ["date", "tanggal"],
  campaign: ["campaign name", "campaign", "campaign_name"],
  id: [],
  url: [],
  caption: [],
  metrics: {
    views: ["focused_view_15s"],
    likes: ["likes", "post reactions", "reactions", "post_reactions"],
    comments: ["comments", "post comments"],
    shares: ["shares", "post shares"],
  },
};

type Normalized = {
  posts: CompetitorPost[];
  missing: string[];
  hasCompetitorCol: boolean;
};

// Large ids can arrive in scientific notation ("7.69E+18"); then take the id from the post url
const resolvePostId = (id: string, url: string): string => {
  if (id && !/e\+/i.test(id)) return id;
  const m = url.match(/(\d{10,})/);
  return m ? m[1] : id;
};

const normalizeWith = (rawRows: any[], src: Source, label: string): Normalized => {
  if (!rawRows || rawRows.length === 0)
    return { posts: [], missing: [], hasCompetitorCol: false };
  const keys = Object.keys(rawRows[0]);
  const kPlatform = pickKey(keys, src.platform);
  const kBrand = pickKey(keys, src.brand);
  const kComp = src.comp.length ? pickKey(keys, src.comp) : undefined;
  const kCampaign = src.campaign.length ? pickKey(keys, src.campaign) : undefined;
  const kId = src.id.length ? pickKey(keys, src.id) : undefined;
  const kUrl = src.url.length ? pickKey(keys, src.url) : undefined;
  const kCaption = src.caption.length ? pickKey(keys, src.caption) : undefined;
  const kDate =
    pickKey(keys, src.date) || keys.find((k) => norm(k).startsWith("published"));
  const mKeys: Record<string, string | undefined> = {};
  Object.keys(src.metrics).forEach((m) => (mKeys[m] = pickKey(keys, src.metrics[m])));

  const missing: string[] = [];
  if (!kBrand) missing.push(`${label}: ${src.brand[0]}`);
  if (!kDate) missing.push(`${label}: ${src.date[0]}`);
  Object.keys(mKeys).forEach((m) => {
    if (!mKeys[m]) missing.push(`${label}: ${m} (counted as 0)`);
  });
  if (!kBrand || !kDate) return { posts: [], missing, hasCompetitorCol: false };

  const posts: CompetitorPost[] = [];
  for (const r of rawRows) {
    const dt = parseDate(r[kDate]);
    if (!dt) continue;
    const brand = String(r[kBrand] ?? "").trim();
    if (!brand) continue;
    const metrics: Record<string, number> = {};
    Object.keys(mKeys).forEach((m) => {
      const col = mKeys[m];
      metrics[m] = col ? parseNum(r[col]) : 0;
    });
    metrics.engagement =
      metrics.likes + metrics.comments + metrics.shares;
    posts.push({
      platform: String(kPlatform ? (r[kPlatform] ?? "") : "").trim(),
      brand,
      competitor: String(kComp ? (r[kComp] ?? "") : "").trim(),
      ym: dt.ym,
      day: dt.day,
      metrics,
      campaign: String(kCampaign ? (r[kCampaign] ?? "") : "").trim(),
      postId: resolvePostId(
        String(kId ? (r[kId] ?? "") : "").trim(),
        String(kUrl ? (r[kUrl] ?? "") : "").trim(),
      ),
      url: String(kUrl ? (r[kUrl] ?? "") : "").trim(),
      caption: String(kCaption ? (r[kCaption] ?? "") : "").trim(),
    });
  }
  return { posts, missing, hasCompetitorCol: !!kComp };
};

export const normalizeCompetitorSources = (
  ownRaw: any[],
  competitorRaw: any[],
): {
  own: CompetitorPost[];
  competitors: CompetitorPost[];
  hasCompetitorCol: boolean;
  missing: string[];
} => {
  const own = normalizeWith(ownRaw, OWN_SRC, "Media API");
  const comp = normalizeWith(competitorRaw, COMPETITOR_SRC, "Competitor");
  const missing = [...own.missing, ...comp.missing.filter((m) => !m.includes("Competitor: competitor"))];
  return {
    own: own.posts,
    competitors: comp.posts,
    hasCompetitorCol: comp.hasCompetitorCol,
    missing,
  };
};