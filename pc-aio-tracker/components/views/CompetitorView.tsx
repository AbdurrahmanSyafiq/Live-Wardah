import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Chart from "chart.js/auto";
import { formatNum } from "@/lib/formatters";
import {
  COMPETITOR_METRICS,
  normalizeCompetitorSources,
  type CompetitorPost,
} from "@/lib/competitorData";

interface CompetitorViewProps {
  rawData: any[]; // tab Competitor_sosmed_sinkron
  ownData?: any[]; // tab Media API (Filtered)
  isDarkMode: boolean;
}

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
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_LONG[m - 1] ?? ym} ${y}`;
};
const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};
// Last day that can be shown for a month: for the current month stop at today's date
const lastVisibleDay = (ym: string) => {
  const total = daysInMonth(ym);
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return ym === cur ? Math.min(total, now.getDate()) : total;
};
// Week 1 = tgl 1-7, Week 2 = 8-14, Week 3 = 15-21, Week 4 = 22-28, Week 5 = 29-akhir bulan
const weekOfDay = (day: number) => Math.ceil(day / 7);

// Angka besar diringkas: 2.456.223.866 -> 2.46B, 622.357.228 -> 622.36M
const compact = (n: number) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};

// Long campaign names: keep the first 3 underscore-separated parts, then "..."
const shortCampaign = (name: string) => {
  const parts = name.split("_");
  return parts.length > 3 ? `${parts.slice(0, 3).join("_")}_...` : name;
};

const OWN_COLOR = "#4DC0BE";
const COMP_COLORS = [
  "#F2B233",
  "#D6657A",
  "#5B7FA6",
  "#8E7CC3",
  "#E07B39",
  "#6BAA75",
  "#B0869B",
  "#7A8B99",
];

export default function CompetitorView({
  rawData,
  ownData = [],
  isDarkMode,
}: CompetitorViewProps) {
  const parsed = useMemo(
    () => normalizeCompetitorSources(ownData, rawData),
    [ownData, rawData],
  );
  const ownPosts = parsed.own;
  const compPosts = parsed.competitors;
  const posts = useMemo(
    () => [...ownPosts, ...compPosts],
    [ownPosts, compPosts],
  );
  const samePlatform = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();
  const sameName = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

  const [granularity, setGranularity] = useState<"monthly" | "weekly">(
    "monthly",
  );
  const [ym, setYm] = useState("");
  const [week, setWeek] = useState(1);
  const [platform, setPlatform] = useState("All");
  const [brand, setBrand] = useState("");
  const [compSel, setCompSel] = useState<string[]>([]);
  const [metric, setMetric] = useState("views");
  const [compOpen, setCompOpen] = useState(false);

  const [popupIdx, setPopupIdx] = useState<number | null>(null);
  const [popupQuery, setPopupQuery] = useState("");
  const [detail, setDetail] = useState<null | {
    kind: "campaign" | "post";
    title: string;
    campaign?: string;
    post?: CompetitorPost;
  }>(null);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const surface = isDarkMode
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-slate-200";
  const heading = isDarkMode ? "text-white" : "text-slate-900";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  const months = useMemo(
    () =>
      Array.from(new Set(posts.map((p) => p.ym))).sort((a, b) =>
        b.localeCompare(a),
      ),
    [posts],
  );
  const platforms = useMemo(() => {
    const seen = new Map<string, string>();
    posts.forEach((p) => {
      const k = p.platform.trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, p.platform.trim());
    });
    return Array.from(seen.values()).sort();
  }, [posts]);
  // Brand = brand kita (kolom brand_2 di Media API)
  const brandOptions = useMemo(
    () => Array.from(new Set(ownPosts.map((p) => p.brand))).sort(),
    [ownPosts],
  );
  // Competitor = kolom Brand di tab competitor. Kalau tab itu punya kolom "Competitor",
  // hanya yang dipasangkan dengan brand terpilih; kalau tidak, semua competitor.
  const competitorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          compPosts
            .filter(
              (p) =>
                !parsed.hasCompetitorCol ||
                !p.competitor ||
                sameName(p.competitor, brand),
            )
            .map((p) => p.brand)
            // the selected brand is already its own bar, so never list it as a competitor
            .filter((name) => !sameName(name, brand)),
        ),
      ).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compPosts, brand, parsed.hasCompetitorCol],
  );
  const metricOptions = COMPETITOR_METRICS;

  // Nilai awal filter
  useEffect(() => {
    if (months.length > 0 && !months.includes(ym)) setYm(months[0]);
  }, [months, ym]);
  useEffect(() => {
    if (brandOptions.length > 0 && !brandOptions.includes(brand))
      setBrand(brandOptions[0]);
  }, [brandOptions, brand]);
  const compKey = competitorOptions.join("|");
  useEffect(() => {
    setCompSel(competitorOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compKey]);

  // Weeks offered in the dropdown (for the running month, only up to today)
  const weekOptions = useMemo(() => {
    if (!ym) return [] as { w: number; label: string }[];
    const last = lastVisibleDay(ym);
    return Array.from({ length: Math.ceil(last / 7) }, (_, i) => {
      const w = i + 1;
      const start = (w - 1) * 7 + 1;
      const end = Math.min(w * 7, last);
      return {
        w,
        label: `W${w} (${start === end ? start : `${start}-${end}`})`,
      };
    });
  }, [ym]);
  useEffect(() => {
    if (weekOptions.length > 0 && week > weekOptions.length)
      setWeek(weekOptions.length);
  }, [weekOptions, week]);

  const inPeriod = (p: { ym: string; day: number; platform: string }) =>
    p.ym === ym &&
    (granularity === "monthly" || weekOfDay(p.day) === week) &&
    (platform === "All" || samePlatform(p.platform, platform));

  const rows = useMemo(() => {
    const sum = (list: typeof posts) => {
      let total = 0;
      const totals: Record<string, number> = {};
      COMPETITOR_METRICS.forEach((m) => (totals[m.key] = 0));
      list.forEach((p) => {
        total += p.metrics[metric] || 0;
        COMPETITOR_METRICS.forEach((m) => {
          totals[m.key] += p.metrics[m.key] || 0;
        });
      });
      return { total, totals, count: list.length, list };
    };
    const own = sum(
      ownPosts.filter((p) => sameName(p.brand, brand) && inPeriod(p)),
    );
    const result = [
      {
        name: brand,
        isOwn: true,
        total: own.total,
        totals: own.totals,
        count: own.count,
        list: own.list as CompetitorPost[],
      },
    ];
    compSel.forEach((c) => {
      const r = sum(
        compPosts.filter(
          (p) =>
            sameName(p.brand, c) &&
            (!parsed.hasCompetitorCol ||
              !p.competitor ||
              sameName(p.competitor, brand)) &&
            inPeriod(p),
        ),
      );
      result.push({
        name: c,
        isOwn: false,
        total: r.total,
        totals: r.totals,
        count: r.count,
        list: r.list as CompetitorPost[],
      });
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ownPosts,
    compPosts,
    brand,
    compSel,
    metric,
    ym,
    week,
    granularity,
    platform,
  ]);

  const metricLabel =
    COMPETITOR_METRICS.find((m) => m.key === metric)?.label || metric;
  const periodText =
    granularity === "monthly"
      ? monthLabel(ym)
      : `${monthLabel(ym)} · Week ${week}`;

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    if (rows.length === 0) return;
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    const textColor = isDarkMode ? "#B6D0CD" : "#3F5957";
    const colors = rows.map((r, i) =>
      r.isOwn ? OWN_COLOR : COMP_COLORS[(i - 1) % COMP_COLORS.length],
    );
    const valueLabels: any = {
      id: "valueLabels",
      afterDatasetsDraw(chart: any) {
        const c = chart.ctx;
        c.save();
        c.font = "bold 12px sans-serif";
        c.fillStyle = textColor;
        c.textAlign = "center";
        chart.getDatasetMeta(0).data.forEach((bar: any, i: number) => {
          const v = chart.data.datasets[0].data[i] as number;
          c.fillText(compact(v), bar.x, bar.y - 8);
        });
        c.restore();
      },
    };
    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: rows.map((r) => r.name),
        datasets: [
          {
            label: metricLabel,
            data: rows.map((r) => r.total),
            backgroundColor: colors,
            borderRadius: 10,
            maxBarThickness: 90,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        layout: { padding: { top: 24 } },
        onClick: (_e: any, els: any[]) => {
          if (els.length > 0) {
            setPopupQuery("");
            setPopupIdx(els[0].index);
          }
        },
        onHover: (e: any, els: any[]) => {
          const t = e?.native?.target as HTMLElement | undefined;
          if (t) t.style.cursor = els.length > 0 ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: any) =>
                `${metricLabel}: ${formatNum(item.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { weight: "bold" } },
          },
          y: {
            beginAtZero: true,
            grid: { color: isDarkMode ? "#1F5559" : "#D5E8E6" },
            border: { dash: [4, 4] },
            ticks: {
              color: isDarkMode ? "#8FB0AD" : "#5B7573",
              callback: (v: any) => compact(Number(v)),
            },
          },
        },
      },
      plugins: [valueLabels],
    });
    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [rows, metricLabel, isDarkMode]);

  const selectCls = `dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors cursor-pointer ${
    isDarkMode
      ? "border-slate-600 text-slate-100 hover:border-indigo-500"
      : "border-slate-300 text-slate-700 hover:border-indigo-500 bg-white"
  }`;
  const labelCls = `text-[10px] font-black uppercase tracking-widest mb-1.5 block ${muted}`;

  // Previous period used for growth: the previous month, same days (monthly)
  // or same week number (weekly). For the running month only the days up to today are compared.
  const prevPeriod = (() => {
    if (!ym) return null;
    const [y, m] = ym.split("-").map(Number);
    const pd = new Date(y, m - 2, 1);
    const pym = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
    const prevTotal = daysInMonth(pym);
    const curEnd = lastVisibleDay(ym);
    if (granularity === "weekly")
      return {
        pym,
        from: (week - 1) * 7 + 1,
        to: Math.min(week * 7, prevTotal, curEnd),
      };
    return { pym, from: 1, to: Math.min(prevTotal, curEnd) };
  })();
  const inPrevPeriod = (p: { ym: string; day: number; platform: string }) =>
    !!prevPeriod &&
    p.ym === prevPeriod.pym &&
    p.day >= prevPeriod.from &&
    p.day <= prevPeriod.to &&
    (platform === "All" || samePlatform(p.platform, platform));

  // Popup for the clicked bar / table row, selected metric only:
  //  - our brand  -> one line per campaign (growth vs the same campaign in the previous period)
  //  - competitor -> one line per post (a single post has no previous period, so no growth per line)
  const popupRow = popupIdx !== null ? rows[popupIdx] : undefined;
  const popupPrevTotal = (() => {
    if (!popupRow) return 0;
    const list = popupRow.isOwn
      ? ownPosts.filter(
          (p) => sameName(p.brand, popupRow.name) && inPrevPeriod(p),
        )
      : compPosts.filter(
          (p) =>
            sameName(p.brand, popupRow.name) &&
            (!parsed.hasCompetitorCol ||
              !p.competitor ||
              sameName(p.competitor, brand)) &&
            inPrevPeriod(p),
        );
    let t = 0;
    list.forEach((p) => (t += p.metrics[metric] || 0));
    return t;
  })();
  const popupItems = (() => {
    if (!popupRow)
      return [] as {
        key: string;
        title: string;
        brand: string;
        sub: string;
        url: string;
        value: number;
        vals: Record<string, number>;
        prev: number | null;
        detail: {
          kind: "campaign" | "post";
          title: string;
          campaign?: string;
          post?: CompetitorPost;
        };
      }[];
    if (popupRow.isOwn) {
      const prevByCampaign = new Map<string, number>();
      ownPosts
        .filter((p) => sameName(p.brand, popupRow.name) && inPrevPeriod(p))
        .forEach((p) => {
          const k = p.campaign || "(no campaign name)";
          prevByCampaign.set(
            k,
            (prevByCampaign.get(k) || 0) + (p.metrics[metric] || 0),
          );
        });
      const m = new Map<string, Record<string, number>>();
      popupRow.list.forEach((p) => {
        const k = p.campaign || "(no campaign name)";
        const cur = m.get(k) || {};
        COMPETITOR_METRICS.forEach((mm) => {
          cur[mm.key] = (cur[mm.key] || 0) + (p.metrics[mm.key] || 0);
        });
        m.set(k, cur);
      });
      return Array.from(m.entries())
        .map(([k, vals]) => ({
          key: k,
          title: k,
          brand: popupRow.name,
          sub: "",
          url: "",
          vals,
          value: vals[metric] || 0,
          prev: prevByCampaign.get(k) ?? 0,
          detail: { kind: "campaign" as const, title: k, campaign: k },
        }))
        .sort((a, b) => b.value - a.value);
    }
    return popupRow.list
      .map((p, i) => ({
        key: `${p.postId}-${i}`,
        title: p.postId || "(no id)",
        brand: popupRow.name,
        sub: p.platform,
        url: p.url,
        vals: p.metrics as Record<string, number>,
        value: p.metrics[metric] || 0,
        prev: null as number | null,
        detail: {
          kind: "post" as const,
          title: p.postId || "(no id)",
          post: p,
        },
      }))
      .sort((a, b) => b.value - a.value);
  })();
  const popupVisible = popupItems.filter((it) =>
    `${it.title} ${it.sub}`
      .toLowerCase()
      .includes(popupQuery.trim().toLowerCase()),
  );

  // Detail popup (second level): all metrics for the clicked campaign or post
  const detailMetrics = COMPETITOR_METRICS.filter((m) => m.key !== "saves");
  const detailData = (() => {
    if (!detail || !popupRow) return null;
    if (detail.kind === "post" && detail.post) {
      // Same layout as a campaign: this post vs the average post of the same competitor in this period
      const post = detail.post;
      const n = popupRow.list.length || 1;
      const sumAll = (k: string) =>
        popupRow.list.reduce((t, p) => t + (p.metrics[k] || 0), 0);
      const summary = detailMetrics.map((m) => ({
        key: m.key,
        label: m.label.split(" (")[0],
        cur: post.metrics[m.key] || 0,
        prev: sumAll(m.key) / n,
      }));
      const day = `${post.ym}-${String(post.day).padStart(2, "0")}`;
      const campaignRows = [
        {
          day,
          platform: post.platform,
          m: post.metrics as Record<string, number>,
        },
      ];
      return { campaignRows, summary, post };
    }
    const key = detail.campaign || "";
    const same = (p: CompetitorPost) =>
      (p.campaign || "(no campaign name)") === key;
    const curList = popupRow.list.filter(same);
    const prevList = ownPosts.filter(
      (p) => sameName(p.brand, popupRow.name) && inPrevPeriod(p) && same(p),
    );
    const sumOf = (list: CompetitorPost[], k: string) => {
      let t = 0;
      list.forEach((p) => (t += p.metrics[k] || 0));
      return t;
    };
    const summary = detailMetrics.map((m) => ({
      key: m.key,
      label: m.label.split(" (")[0],
      cur: sumOf(curList, m.key),
      prev: sumOf(prevList, m.key),
    }));
    // per day (and platform) breakdown for the current period
    const byDay = new Map<
      string,
      { day: string; platform: string; m: Record<string, number> }
    >();
    curList.forEach((p) => {
      const day = `${p.ym}-${String(p.day).padStart(2, "0")}`;
      const k = `${day}|${p.platform}`;
      const cur = byDay.get(k) || {
        day,
        platform: p.platform,
        m: {} as Record<string, number>,
      };
      detailMetrics.forEach((dm) => {
        cur.m[dm.key] = (cur.m[dm.key] || 0) + (p.metrics[dm.key] || 0);
      });
      byDay.set(k, cur);
    });
    const campaignRows = Array.from(byDay.values()).sort((a, b) =>
      a.day.localeCompare(b.day),
    );
    return {
      campaignRows,
      summary,
      post: undefined as CompetitorPost | undefined,
    };
  })();

  const growthCell = (cur: number, prev: number | null) => {
    if (prev === null) return <span className="text-slate-400">-</span>;
    if (prev === 0 && cur === 0)
      return <span className="text-slate-400">-</span>;
    if (prev === 0)
      return <span className="text-emerald-500 font-bold">New</span>;
    const g = ((cur - prev) / prev) * 100;
    return (
      <span
        className={`font-bold ${g >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
        {g >= 0 ? "▲ +" : "▼ "}
        {g.toFixed(1)}%
      </span>
    );
  };

  if (posts.length === 0 || brandOptions.length === 0) {
    return (
      <div className={`${surface} border rounded-2xl p-8 text-center`}>
        <h2 className={`text-base font-black ${heading}`}>
          No competitor data yet
        </h2>
        <p className={`text-sm mt-2 ${muted}`}>
          Make sure the &quot;Competitor_sosmed_sinkron&quot; and &quot;Media
          API (Filtered)&quot; tabs exist, contain data, and are shared with the
          service account.
          {parsed.missing.length > 0 &&
            ` Columns not found: ${parsed.missing.join(", ")}.`}
        </p>
      </div>
    );
  }

  const ownTotal = rows[0]?.total || 0;

  return (
    <div className="w-full space-y-5">
      {parsed.missing.length > 0 && (
        <p className="text-xs font-semibold text-amber-500">
          Columns not found in sheet: {parsed.missing.join(", ")}.
        </p>
      )}

      {/* Filter */}
      <div className={`${surface} border rounded-2xl p-5 shadow-sm`}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className={labelCls}>Brand</span>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={selectCls}>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelCls}>Period</span>
            <div
              className={`flex items-center p-1 rounded-full border ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-200"}`}>
              {(["monthly", "weekly"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${granularity === g ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelCls}>Month</span>
            <select
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className={selectCls}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          {granularity === "weekly" && (
            <div>
              <span className={labelCls}>Week</span>
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className={selectCls}>
                {weekOptions.map((o) => (
                  <option key={o.w} value={o.w}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className={labelCls}>Platform</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={selectCls}>
              <option value="All">All Platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <span className={labelCls}>Competitor</span>
            <button
              type="button"
              onClick={() => setCompOpen(!compOpen)}
              className={`${selectCls} text-left min-w-[180px]`}>
              Competitors ({compSel.length}/{competitorOptions.length})
            </button>
            {compOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setCompOpen(false)}
                />
                <div
                  className={`absolute left-0 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl shadow-xl border p-2 z-50 ${isDarkMode ? "bg-[#0E3A3D] border-slate-700" : "bg-white border-slate-200"}`}>
                  <div className="flex justify-between px-2 py-1 text-[10px] font-black uppercase tracking-wider">
                    <button
                      type="button"
                      className="text-indigo-500 hover:underline"
                      onClick={() => setCompSel(competitorOptions)}>
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-slate-400 hover:underline"
                      onClick={() => setCompSel([])}>
                      Clear
                    </button>
                  </div>
                  {competitorOptions.length === 0 && (
                    <p className="px-2 py-2 text-xs text-slate-400">
                      No competitors for this brand.
                    </p>
                  )}
                  {competitorOptions.map((c) => {
                    const checked = compSel.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setCompSel((prev) =>
                            prev.includes(c)
                              ? prev.filter((x) => x !== c)
                              : [...prev, c],
                          )
                        }
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${checked ? "bg-indigo-600 text-white" : isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"}`}>
                        <span className="truncate">{c}</span>
                        {checked && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div>
            <span className={labelCls}>Metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className={`${selectCls} max-w-[260px]`}>
              {metricOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className={`${surface} border rounded-2xl p-5 sm:p-6 shadow-sm`}>
        <h2 className={`text-base font-black ${heading}`}>
          {metricLabel} · {brand} vs Competitors
        </h2>
        <p className={`text-xs mt-0.5 mb-4 ${muted}`}>
          {periodText} · {platform === "All" ? "All platforms" : platform} ·
          total of all posts in this period
        </p>
        <div className="w-full h-[400px]">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      {/* Tabel ringkasan */}
      <div
        className={`${surface} border rounded-2xl shadow-sm overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-wider bg-black text-white">
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4 text-right">Posts</th>
                {COMPETITOR_METRICS.map((m) => (
                  <th key={m.key} className="py-3.5 px-4 text-right">
                    {m.label.split(" (")[0]}
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right">
                  Comparison ({metricLabel.split(" (")[0]})
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-200"}`}>
              {rows.map((r, i) => {
                // Dari sisi brand terpilih: lebih besar dari baris ini = hijau, lebih kecil = merah
                const diff =
                  r.total > 0 ? ((ownTotal - r.total) / r.total) * 100 : 0;
                return (
                  <tr
                    key={`${i}-${r.name}`}
                    onClick={() => {
                      setPopupQuery("");
                      setPopupIdx(i);
                    }}
                    title="Click to see details"
                    className={`cursor-pointer transition-colors ${isDarkMode ? "text-slate-200 hover:bg-slate-700/40" : "text-slate-800 hover:bg-slate-50"}`}>
                    <td className="py-3 px-4 font-bold">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                        style={{
                          backgroundColor: r.isOwn
                            ? OWN_COLOR
                            : COMP_COLORS[(i - 1) % COMP_COLORS.length],
                        }}
                      />
                      {r.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatNum(r.count)}
                    </td>
                    {COMPETITOR_METRICS.map((m) => (
                      <td
                        key={m.key}
                        className={`py-3 px-4 text-right font-mono ${m.key === metric ? "font-black" : ""}`}>
                        {formatNum(r.totals[m.key] || 0)}
                      </td>
                    ))}
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        r.isOwn
                          ? "text-slate-400"
                          : diff >= 0
                            ? "text-emerald-500"
                            : "text-rose-500"
                      }`}>
                      {r.isOwn || r.total <= 0
                        ? "-"
                        : `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {popupRow &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setDetail(null);
              setPopupIdx(null);
            }}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-6xl max-h-[88vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div>
                  <h3 className="text-xl font-black">
                    {popupRow.name} · {metricLabel.split(" (")[0]}
                  </h3>
                  <p className={`text-sm mt-1 ${muted}`}>
                    {periodText} ·{" "}
                    {platform === "All" ? "All platforms" : platform} ·{" "}
                    {popupRow.isOwn ? "per campaign" : "per post"}
                    {prevPeriod &&
                      ` · compared with ${monthLabel(prevPeriod.pym)}${granularity === "weekly" ? ` · Week ${week} (${prevPeriod.from}-${prevPeriod.to})` : ""}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPopupIdx(null)}
                  aria-label="Close"
                  className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                  ×
                </button>
              </div>

              <div
                className={`px-6 py-4 flex flex-wrap items-center gap-4 border-y ${isDarkMode ? "bg-slate-900/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                <input
                  type="text"
                  value={popupQuery}
                  onChange={(e) => setPopupQuery(e.target.value)}
                  placeholder={
                    popupRow.isOwn ? "Filter by campaign..." : "Filter by id..."
                  }
                  className={`flex-1 min-w-[200px] text-sm rounded-xl px-4 py-2.5 outline-none border ${isDarkMode ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"}`}
                />
                <div className="text-right">
                  <div
                    className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>
                    Total
                  </div>
                  <div className="text-lg font-black font-mono">
                    {formatNum(popupRow.total)}{" "}
                    <span className="text-sm">
                      {growthCell(popupRow.total, popupPrevTotal)}
                    </span>
                  </div>
                  <div className={`text-[10px] font-semibold ${muted}`}>
                    Previous period: {formatNum(popupPrevTotal)}
                  </div>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0">
                    <tr className="text-[11px] font-black uppercase tracking-wider bg-black text-white">
                      <th className="py-3.5 px-4">
                        {popupRow.isOwn ? "Campaign" : "ID"}
                      </th>
                      <th className="py-3.5 px-4">Brand</th>
                      {COMPETITOR_METRICS.map((m) => (
                        <th key={m.key} className="py-3.5 px-4 text-right">
                          {m.label.split(" (")[0]}
                        </th>
                      ))}
                      <th className="py-3.5 px-4 text-right">
                        {metricLabel.split(" (")[0]} vs Prev
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-200"}`}>
                    {popupVisible.length === 0 && (
                      <tr>
                        <td
                          colSpan={3 + COMPETITOR_METRICS.length}
                          className={`py-8 text-center text-sm ${muted}`}>
                          No data in this period.
                        </td>
                      </tr>
                    )}
                    {popupVisible.map((it) => (
                      <tr
                        key={it.key}
                        onClick={() => setDetail(it.detail)}
                        title="Click to see details"
                        className={`cursor-pointer transition-colors ${isDarkMode ? "text-slate-200 hover:bg-slate-700/40" : "text-slate-800 hover:bg-slate-50"}`}>
                        <td className="py-3 px-4 max-w-[420px]">
                          {it.url ? (
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-indigo-500 hover:underline break-all">
                              {it.title}
                            </a>
                          ) : (
                            <div
                              className="font-bold break-words"
                              title={it.title}>
                              {popupRow.isOwn
                                ? shortCampaign(it.title)
                                : it.title}
                            </div>
                          )}
                          {it.sub && (
                            <div
                              className={`text-[11px] mt-0.5 truncate ${muted}`}>
                              {it.sub}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold whitespace-nowrap">
                          {it.brand}
                        </td>
                        {COMPETITOR_METRICS.map((m) => (
                          <td
                            key={m.key}
                            className={`py-3 px-4 text-right font-mono whitespace-nowrap ${m.key === metric ? "font-black" : ""}`}>
                            {formatNum(it.vals[m.key] || 0)}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {growthCell(it.value, it.prev)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {detail &&
        detailData &&
        popupRow &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[310] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDetail(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>
                    {popupRow.name} ·{" "}
                    {detail.kind === "campaign" ? "Campaign" : "Post"}
                  </p>
                  <h3 className="text-base font-black mt-1 break-words">
                    {detail.title}
                  </h3>
                  <p className={`text-xs mt-1 ${muted}`}>
                    {periodText} ·{" "}
                    {platform === "All" ? "All platforms" : platform}
                    {detail.kind === "campaign"
                      ? prevPeriod &&
                        ` · compared with ${monthLabel(prevPeriod.pym)}${granularity === "weekly" ? ` · Week ${week} (${prevPeriod.from}-${prevPeriod.to})` : ""}`
                      : ` · compared with the average ${popupRow.name} post in this period`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  aria-label="Close"
                  className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                  ×
                </button>
              </div>

              <div className="overflow-auto px-6 pb-6 space-y-5">
                {detail.kind === "post" && detailData.post && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>
                      <span className={muted}>Platform: </span>
                      <span className="font-bold">
                        {detailData.post.platform || "-"}
                      </span>
                    </span>
                    <span>
                      <span className={muted}>Posted: </span>
                      <span className="font-bold">
                        {detailData.post.day} {monthLabel(detailData.post.ym)}
                      </span>
                    </span>
                    {detailData.post.url && (
                      <a
                        href={detailData.post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-indigo-500 hover:underline">
                        Open post
                      </a>
                    )}
                  </div>
                )}

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-[11px] font-black uppercase tracking-wider bg-black text-white">
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4 text-right">
                        {detail.kind === "post" ? "This post" : "This period"}
                      </th>
                      <th className="py-3 px-4 text-right">
                        {detail.kind === "post" ? "Avg post" : "Prev period"}
                      </th>
                      <th className="py-3 px-4 text-right">
                        {detail.kind === "post" ? "vs Avg" : "Growth"}
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-200"}`}>
                    {detailData.summary.map((s: any) => (
                      <tr
                        key={s.key}
                        className={`${isDarkMode ? "text-slate-200" : "text-slate-800"} ${s.key === metric ? "font-black" : ""}`}>
                        <td className="py-2.5 px-4 font-bold">{s.label}</td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {formatNum(s.cur)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {formatNum(Math.round(s.prev))}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {growthCell(s.cur, s.prev)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div>
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest mb-2 ${muted}`}>
                    Daily breakdown
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="text-[11px] font-black uppercase tracking-wider bg-black text-white">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Platform</th>
                          {detailMetrics.map((m) => (
                            <th key={m.key} className="py-3 px-4 text-right">
                              {m.label.split(" (")[0]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-200"}`}>
                        {detailData.campaignRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={2 + detailMetrics.length}
                              className={`py-6 text-center ${muted}`}>
                              No data in this period.
                            </td>
                          </tr>
                        )}
                        {detailData.campaignRows.map((d: any) => (
                          <tr
                            key={`${d.day}-${d.platform}`}
                            className={
                              isDarkMode ? "text-slate-200" : "text-slate-800"
                            }>
                            <td className="py-2.5 px-4 font-bold">{d.day}</td>
                            <td className="py-2.5 px-4">{d.platform || "-"}</td>
                            {detailMetrics.map((m) => (
                              <td
                                key={m.key}
                                className={`py-2.5 px-4 text-right font-mono ${m.key === metric ? "font-black" : ""}`}>
                                {formatNum(d.m[m.key] || 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
