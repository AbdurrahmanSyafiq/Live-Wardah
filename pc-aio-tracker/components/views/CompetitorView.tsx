import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { formatNum } from "@/lib/formatters";
import {
  COMPETITOR_METRICS,
  normalizeCompetitorSources,
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
            .map((p) => p.brand),
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

  const inPeriod = (p: { ym: string; day: number; platform: string }) =>
    p.ym === ym &&
    (granularity === "monthly" || weekOfDay(p.day) === week) &&
    (platform === "All" || samePlatform(p.platform, platform));

  const rows = useMemo(() => {
    const sum = (list: typeof posts) => {
      let total = 0;
      list.forEach((p) => (total += p.metrics[metric] || 0));
      return { total, count: list.length };
    };
    const own = sum(
      ownPosts.filter((p) => sameName(p.brand, brand) && inPeriod(p)),
    );
    const result = [
      { name: brand, isOwn: true, total: own.total, count: own.count },
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
      result.push({ name: c, isOwn: false, total: r.total, count: r.count });
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

  if (posts.length === 0 || brandOptions.length === 0) {
    return (
      <div className={`${surface} border rounded-2xl p-8 text-center`}>
        <h2 className={`text-base font-black ${heading}`}>
          Belum ada data competitor
        </h2>
        <p className={`text-sm mt-2 ${muted}`}>
          Pastikan tab &quot;Competitor_sosmed_sinkron&quot; dan &quot;Media API
          (Filtered)&quot; ada, berisi data, dan sudah di-share ke service
          account.
          {parsed.missing.length > 0 &&
            ` Kolom tidak ditemukan: ${parsed.missing.join(", ")}.`}
        </p>
      </div>
    );
  }

  const ownTotal = rows[0]?.total || 0;
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="w-full space-y-5">
      {parsed.missing.length > 0 && (
        <p className="text-xs font-semibold text-amber-500">
          Kolom tidak ditemukan di sheet: {parsed.missing.join(", ")}.
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
                {Array.from(
                  { length: Math.ceil((ym ? daysInMonth(ym) : 28) / 7) },
                  (_, i) => i + 1,
                ).map((w) => {
                  const last = ym ? daysInMonth(ym) : 28;
                  return (
                    <option key={w} value={w}>
                      W{w} ({(w - 1) * 7 + 1}-{Math.min(w * 7, last)})
                    </option>
                  );
                })}
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
                      Tidak ada competitor untuk brand ini.
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
          total dari semua postingan di periode ini
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
                <th className="py-3.5 px-4 text-right">
                  {metricLabel.split(" (")[0]}
                </th>
                <th className="py-3.5 px-4 text-right">Avg / Post</th>
                <th className="py-3.5 px-4 text-right">{brand} vs Brand Ini</th>
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
                    key={r.name}
                    className={
                      isDarkMode ? "text-slate-200" : "text-slate-800"
                    }>
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
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {formatNum(r.total)}
                      <span
                        className="ml-3 inline-block h-1.5 rounded-full align-middle"
                        style={{
                          width: `${Math.max(4, (r.total / maxTotal) * 80)}px`,
                          backgroundColor: r.isOwn
                            ? OWN_COLOR
                            : COMP_COLORS[(i - 1) % COMP_COLORS.length],
                        }}
                      />
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.count > 0
                        ? formatNum(Math.round(r.total / r.count))
                        : "-"}
                    </td>
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
    </div>
  );
}
