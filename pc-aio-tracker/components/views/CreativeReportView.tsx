import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { createPortal } from "react-dom";
import { formatIDR, formatNum, formatPct, renderGR } from "@/lib/formatters";
import {
  normalizeCreativeRows,
  pilarSortKey,
  dayNumberToIso,
  isoToDayNumber,
  shiftRangeOneMonthBack,
  type CreativeRow,
} from "@/lib/creativeReportData";

interface CreativeReportViewProps {
  rawData: any[];
  isDarkMode: boolean;
  // date filter lives in the sidebar
  granularity: string; // "monthly" = by month, "daily" = date range
  dateMonth: string; // "2026-10"
  dateDailyStart: string; // "2026-10-01"
  dateDailyEnd: string;
}

const compact = (n: number) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return String(Math.round(v));
};

type Totals = { spend: number; impressions: number; clicks: number };
const formatNumber = (n: number) => (Number(n) || 0).toLocaleString("en-US");

const sumRows = (rows: CreativeRow[]): Totals => {
  const t = { spend: 0, impressions: 0, clicks: 0 };
  rows.forEach((r) => {
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.clicks += r.clicks;
  });
  return t;
};

function MultiSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
  isDarkMode,
  labelCls,
  wide = false,
}: {
  label: string;
  allLabel: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  isDarkMode: boolean;
  labelCls: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <span className={labelCls}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`dropdown-arrow border text-xs font-bold py-2.5 px-4 pr-10 rounded-lg outline-none min-w-[180px] max-w-[260px] truncate text-left ${
          isDarkMode
            ? "bg-transparent border-slate-600 text-slate-100"
            : "bg-white border-slate-300 text-slate-700"
        }`}>
        {selected.length === 0
          ? allLabel
          : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute left-0 mt-2 ${wide ? "w-80" : "w-64"} max-h-72 overflow-y-auto rounded-xl shadow-xl border p-2 z-50 ${isDarkMode ? "bg-[#0E3A3D] border-slate-700" : "bg-white border-slate-200"}`}>
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-500 hover:underline">
              {allLabel}
            </button>
            {options.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() =>
                    onChange(
                      on ? selected.filter((x) => x !== o) : [...selected, o],
                    )
                  }
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${on ? "bg-indigo-600 text-white" : isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className="truncate">{o}</span>
                  {on && <span>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Stable key functions (so the cards only recompute when their data changes)
const keyAccount = (r: CreativeRow) => r.account || "(no account)";
const keyPilar = (r: CreativeRow) => r.pilar || "(no pilar)";
const keyFormat = (r: CreativeRow) => r.format || "(no format)";
const keyAdGroup = (r: CreativeRow) => r.adGroup || "(no ad group)";

const MIX_COLORS = ["#4DC0BE", "#F2B233", "#D6657A", "#5B7FA6", "#94A3B8"];
const DOT_COLORS = [
  "#4DC0BE",
  "#F2B233",
  "#D6657A",
  "#5B7FA6",
  "#8E7CC3",
  "#E07B39",
  "#6BAA75",
  "#B0869B",
  "#7A8B99",
  "#C9A227",
];
type MixAgg = Totals & {
  v6: number;
  v15: number;
  eng: number;
  ads: Set<string>;
};
type MixMetric = "spend" | "impressions" | "clicks" | "ctr";
const MIX_METRICS: { key: MixMetric; label: string }[] = [
  { key: "spend", label: "SPEND" },
  { key: "impressions", label: "IMPRESSIONS" },
  { key: "clicks", label: "CLICKS" },
  { key: "ctr", label: "CTR" },
];

// "Rp 12.22B" with the unit letter in bold, like the reference cards
const MixValue = ({ metric, value }: { metric: MixMetric; value: number }) => {
  if (metric === "ctr") return <>{(value * 100).toFixed(2)}%</>;
  const s = compact(value);
  const m = s.match(/^(.*?)([KMB])$/);
  const prefix = metric === "spend" ? "Rp " : "";
  return m ? (
    <>
      {prefix}
      {m[1]}
      <span className="font-black">{m[2]}</span>
    </>
  ) : (
    <>
      {prefix}
      {s}
    </>
  );
};

function MixCard({
  title,
  curRows,
  prevRows,
  keyOf,
  isDarkMode,
}: {
  title: string;
  curRows: CreativeRow[];
  prevRows: CreativeRow[];
  keyOf: (r: CreativeRow) => string;
  isDarkMode: boolean;
}) {
  const [metric, setMetric] = useState<MixMetric>("spend");
  const [more, setMore] = useState(false);
  const [itemPopup, setItemPopup] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const items = useMemo(() => {
    const aggregate = (list: CreativeRow[]) => {
      const m = new Map<string, MixAgg>();
      list.forEach((r) => {
        const k = keyOf(r) || "(none)";
        const a = m.get(k) || {
          spend: 0,
          impressions: 0,
          clicks: 0,
          v6: 0,
          v15: 0,
          eng: 0,
          ads: new Set<string>(),
        };
        a.spend += r.spend;
        a.impressions += r.impressions;
        a.clicks += r.clicks;
        a.v6 += r.views6s;
        a.v15 += r.views15s;
        a.eng += r.engagement;
        if (r.adName) a.ads.add(r.adName);
        m.set(k, a);
      });
      return m;
    };
    const cur = aggregate(curRows);
    const prev = aggregate(prevRows);
    const valueOf = (a: MixAgg | undefined) =>
      !a
        ? 0
        : metric === "ctr"
          ? a.impressions > 0
            ? a.clicks / a.impressions
            : 0
          : a[metric];
    const list = Array.from(cur.entries()).map(([name, a]) => ({
      name,
      a,
      value: valueOf(a),
      prevA: prev.get(name),
      prevValue: valueOf(prev.get(name)),
      // CTR has no meaningful share, so its pie uses each item's share of clicks
      share: metric === "ctr" ? a.clicks : a[metric],
    }));
    list.sort((x, y) => y.value - x.value);
    const totalShare = list.reduce((t, i) => t + i.share, 0);
    return { list, totalShare };
  }, [curRows, prevRows, keyOf, metric]);

  const pieData = useMemo(() => {
    const top = items.list.slice(0, 4);
    const rest = items.list.slice(4).reduce((t, i) => t + i.share, 0);
    const rows = top.map((i) => ({
      name: i.name,
      share: i.share,
      isOthers: false,
    }));
    if (items.list.length > 4)
      rows.push({ name: "Others", share: rest, isOthers: true });
    return rows;
  }, [items]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || pieData.length === 0 || items.totalShare <= 0) return;
    chartRef.current = new Chart(ctx, {
      type: "pie",
      data: {
        labels: pieData.map((p) => p.name),
        datasets: [
          {
            data: pieData.map((p) => p.share),
            backgroundColor: pieData.map(
              (_, i) => MIX_COLORS[i % MIX_COLORS.length],
            ),
            borderWidth: 2,
            borderColor: isDarkMode ? "#124246" : "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        // Click a slice: open the table with all items
        onClick: (_e: any, els: any[]) => {
          if (els.length > 0) setMore(true);
        },
        onHover: (e: any, els: any[]) => {
          const t = e?.native?.target as HTMLElement | undefined;
          if (t) t.style.cursor = els.length > 0 ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          // Keep the tooltip short: the canvas is small and would clip long names
          tooltip: {
            callbacks: {
              title: (items2: any[]) => {
                const l = String(items2[0]?.label ?? "");
                return l.length > 22 ? `${l.slice(0, 22)}…` : l;
              },
              label: (it: any) =>
                `${((it.parsed / items.totalShare) * 100).toFixed(1)}%`,
            },
          },
        },
      },
    });
    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [pieData, items.totalShare, isDarkMode]);

  const surface = isDarkMode
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-slate-200";
  const heading = isDarkMode ? "text-white" : "text-slate-900";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  const badge = (cur: number, prev: number) => {
    if (prev === 0 && cur === 0) return null;
    if (prev === 0)
      return (
        <span className="text-[11px] font-black px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
          New
        </span>
      );
    const g = ((cur - prev) / prev) * 100;
    const up = g >= 0;
    return (
      <span
        className={`text-[11px] font-black px-2.5 py-1 rounded-lg border whitespace-nowrap ${up ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
        {up ? "+" : ""}
        {g.toFixed(2)}% vs prev
      </span>
    );
  };

  // Plain growth badge for the item popup ("-5.31%"), "-" when there is nothing to compare
  const badgeGrowth = (cur: number, prev: number) => {
    if (prev === 0 && cur === 0)
      return (
        <span
          className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${isDarkMode ? "border-slate-600 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
          -
        </span>
      );
    if (prev === 0)
      return (
        <span className="text-[11px] font-black px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200">
          New
        </span>
      );
    const g = ((cur - prev) / prev) * 100;
    const up = g >= 0;
    return (
      <span
        className={`text-[11px] font-black px-2.5 py-1 rounded-lg border whitespace-nowrap ${up ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
        {up ? "+" : ""}
        {g.toFixed(2)}%
      </span>
    );
  };

  const maxValue = Math.max(...items.list.map((i) => i.value), 0);

  return (
    <div className={`${surface} border rounded-2xl p-5 shadow-sm`}>
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h3 className={`text-xl font-black ${heading}`}>{title}</h3>
          <p className={`text-sm mt-1 ${muted}`}>
            Distribution &amp; change vs previous period
          </p>
        </div>
        <div
          className={`flex items-center p-1 rounded-xl border ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-200"}`}>
          {MIX_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition-all ${metric === m.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {items.list.length === 0 ? (
        <p className={`py-10 text-center text-sm ${muted}`}>
          No data for the selected filters.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-5">
          <div className="max-h-[360px] overflow-y-auto pr-3 space-y-4">
            {items.list.map((i, idx) => (
              <div
                key={i.name}
                onClick={() => setItemPopup(i.name)}
                title="Click to see details"
                className={`cursor-pointer rounded-lg p-2 -m-2 transition-colors ${isDarkMode ? "hover:bg-slate-700/40" : "hover:bg-indigo-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold truncate ${heading}`}>
                    {i.name}
                  </span>
                  {badge(i.value, i.prevValue)}
                </div>
                <div
                  className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <MixValue metric={metric} value={i.value} />
                </div>
                <div
                  className={`mt-1.5 h-2 rounded-full overflow-hidden ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxValue > 0 ? Math.max(2, (i.value / maxValue) * 100) : 0}%`,
                      backgroundColor: MIX_COLORS[Math.min(idx, 4)],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center">
            <div className="w-[180px] h-[180px]">
              <canvas ref={canvasRef}></canvas>
            </div>
            <div className="mt-4 w-full space-y-1.5">
              {pieData.map((p, idx) => (
                <div
                  key={p.name}
                  onClick={() => setMore(true)}
                  title="Click to see all"
                  className={`flex items-center justify-between gap-2 text-xs cursor-pointer rounded-md px-1 -mx-1 py-0.5 transition-colors ${isDarkMode ? "hover:bg-slate-700/40" : "hover:bg-indigo-50"}`}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: MIX_COLORS[idx % MIX_COLORS.length],
                      }}
                    />
                    <span
                      className={`truncate ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {p.name}
                    </span>
                  </span>
                  <span className={`font-bold ${muted}`}>
                    {items.totalShare > 0
                      ? `${((p.share / items.totalShare) * 100).toFixed(1)}%`
                      : "-"}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMore(true)}
              className="mt-4 text-xs font-bold text-indigo-500 hover:underline">
              More Details
            </button>
          </div>
        </div>
      )}

      {more &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setMore(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div>
                  <h3 className="text-xl font-black">{title} — More Details</h3>
                  <p className={`text-sm mt-1 ${muted}`}>
                    All items, metric{" "}
                    {MIX_METRICS.find(
                      (m) => m.key === metric,
                    )?.label.toLowerCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMore(false)}
                  aria-label="Close"
                  className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                  ×
                </button>
              </div>
              <div
                className={`overflow-auto border-t ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="sticky top-0">
                    <tr className="text-xs font-black uppercase tracking-wider bg-[#0E3A3D] text-white [&>th]:text-white">
                      <th className="py-3.5 px-4 w-12">#</th>
                      <th className="py-3.5 px-4">
                        {title.replace(" Mix", "")}
                      </th>
                      <th className="py-3.5 px-4 text-right">
                        {MIX_METRICS.find((m) => m.key === metric)?.label}
                      </th>
                      <th className="py-3.5 px-4 text-right">
                        {metric === "ctr" ? "Share of clicks" : "Share"}
                      </th>
                      <th className="py-3.5 px-4 text-right">vs prev</th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-100"}`}>
                    {items.list.map((i, idx) => (
                      <tr
                        key={i.name}
                        onClick={() => setItemPopup(i.name)}
                        title="Click to see details"
                        className={`cursor-pointer transition-colors ${isDarkMode ? "text-slate-200 hover:bg-slate-700/40" : "text-slate-700 hover:bg-slate-50"}`}>
                        <td className={`py-3.5 px-4 ${muted}`}>{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full mr-3"
                            style={{
                              backgroundColor:
                                DOT_COLORS[idx % DOT_COLORS.length],
                            }}
                          />
                          {i.name}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {metric === "spend"
                            ? formatIDR(i.value)
                            : metric === "ctr"
                              ? `${(i.value * 100).toFixed(2)}%`
                              : formatNumber(i.value)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {items.totalShare > 0
                            ? `${((i.share / items.totalShare) * 100).toFixed(1)}%`
                            : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {badge(i.value, i.prevValue) || "-"}
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

      {itemPopup &&
        typeof document !== "undefined" &&
        (() => {
          const it = items.list.find((x) => x.name === itemPopup);
          if (!it) return null;
          const blank: MixAgg = {
            spend: 0,
            impressions: 0,
            clicks: 0,
            v6: 0,
            v15: 0,
            eng: 0,
            ads: new Set<string>(),
          };
          const cur = it.a;
          const prv = it.prevA || blank;
          const rate = (n: number, d: number) => (d > 0 ? n / d : 0);
          const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
          const rows: {
            l: string;
            c: number;
            p: number;
            fmt: (n: number) => string;
          }[] = [
            { l: "Spend", c: cur.spend, p: prv.spend, fmt: formatIDR },
            {
              l: "Impressions",
              c: cur.impressions,
              p: prv.impressions,
              fmt: formatNumber,
            },
            {
              l: "CPM",
              c: rate(cur.spend, cur.impressions) * 1000,
              p: rate(prv.spend, prv.impressions) * 1000,
              fmt: formatIDR,
            },
            { l: "Clicks", c: cur.clicks, p: prv.clicks, fmt: formatNumber },
            {
              l: "CTR",
              c: rate(cur.clicks, cur.impressions),
              p: rate(prv.clicks, prv.impressions),
              fmt: pct,
            },
            {
              l: "6s VTR",
              c: rate(cur.v6, cur.impressions),
              p: rate(prv.v6, prv.impressions),
              fmt: pct,
            },
            {
              l: "15s VTR",
              c: rate(cur.v15, cur.impressions),
              p: rate(prv.v15, prv.impressions),
              fmt: pct,
            },
            {
              l: "ER",
              c: rate(cur.eng, cur.impressions),
              p: rate(prv.eng, prv.impressions),
              fmt: pct,
            },
            {
              l: "Creative Count",
              c: cur.ads.size,
              p: prv.ads.size,
              fmt: formatNumber,
            },
          ];
          return createPortal(
            <div
              className="fixed inset-0 z-[310] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setItemPopup(null)}>
              <div
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
                <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-black break-words">
                      {it.name}
                    </h3>
                    <p className={`text-sm mt-1 ${muted}`}>
                      This Period vs Previous Period
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItemPopup(null)}
                    aria-label="Close"
                    className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                    ×
                  </button>
                </div>
                <div
                  className={`overflow-auto border-t px-6 py-5 ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
                  <div
                    className={`rounded-xl border overflow-hidden ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="text-xs font-black uppercase tracking-wider bg-[#0E3A3D] text-white [&>th]:text-white">
                          <th className="py-3.5 px-4">Metric</th>
                          <th className="py-3.5 px-4 text-right">
                            This Period
                          </th>
                          <th className="py-3.5 px-4 text-right">
                            Prev Period
                          </th>
                          <th className="py-3.5 px-4 text-right">Growth</th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {rows.map((r) => (
                          <tr
                            key={r.l}
                            className={
                              isDarkMode ? "text-slate-200" : "text-slate-800"
                            }>
                            <td className="py-3.5 px-4 font-bold">{r.l}</td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {r.fmt(r.c)}
                            </td>
                            <td
                              className={`py-3.5 px-4 text-right whitespace-nowrap ${muted}`}>
                              {r.fmt(r.p)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {badgeGrowth(r.c, r.p)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}
    </div>
  );
}

export default function CreativeReportView({
  rawData,
  isDarkMode,
  granularity,
  dateMonth,
  dateDailyStart,
  dateDailyEnd,
}: CreativeReportViewProps) {
  const parsed = useMemo(() => normalizeCreativeRows(rawData), [rawData]);
  const rows = parsed.rows;

  const bounds = useMemo(() => {
    if (rows.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    rows.forEach((r) => {
      if (r.t < min) min = r.t;
      if (r.t > max) max = r.t;
    });
    return { min, max };
  }, [rows]);

  const platforms = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      const k = r.platform.toLowerCase();
      if (k && !seen.has(k)) seen.set(k, r.platform);
    });
    return Array.from(seen.values()).sort();
  }, [rows]);
  const funnels = useMemo(
    () => Array.from(new Set(rows.map((r) => r.funnel).filter(Boolean))).sort(),
    [rows],
  );

  const [selPlatforms, setSelPlatforms] = useState<string[]>([]); // empty = all
  const [selFunnels, setSelFunnels] = useState<string[]>([]); // empty = all
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [popup, setPopup] = useState<
    null | "spend" | "impressions" | "clicks" | "ctr"
  >(null);

  // Resolve the date range chosen in the sidebar, plus the previous period to compare with:
  //  - by month (full month)      -> the whole previous month (Sep vs Aug)
  //  - by month (still running)   -> same days of the previous month (month to date)
  //  - date range                 -> same dates one month earlier (1-22 Sep vs 1-22 Aug)
  const { fromT, toT, prevFromT, prevToT } = useMemo(() => {
    const DAYMS = 86400000;
    const none = { fromT: null, toT: null, prevFromT: null, prevToT: null };
    if (granularity === "daily") {
      const f = isoToDayNumber(dateDailyStart);
      const t = isoToDayNumber(dateDailyEnd);
      if (f === null || t === null) return none;
      const p = shiftRangeOneMonthBack(f, t);
      return { fromT: f, toT: t, prevFromT: p.from, prevToT: p.to };
    }
    const mt = String(dateMonth).match(/^(\d{4})-(\d{2})$/);
    if (!mt) return none;
    const y = +mt[1];
    const m = +mt[2];
    const first = Math.floor(Date.UTC(y, m - 1, 1) / DAYMS);
    const last = Math.floor(Date.UTC(y, m, 0) / DAYMS);
    // The newest month is usually incomplete: stop at the latest date in the data
    const end =
      bounds && bounds.max >= first && bounds.max < last ? bounds.max : last;
    if (end < last) {
      const p = shiftRangeOneMonthBack(first, end);
      return { fromT: first, toT: end, prevFromT: p.from, prevToT: p.to };
    }
    return {
      fromT: first,
      toT: last,
      prevFromT: Math.floor(Date.UTC(y, m - 2, 1) / DAYMS),
      prevToT: first - 1,
    };
  }, [granularity, dateMonth, dateDailyStart, dateDailyEnd, bounds]);
  const label = "vs prev period";
  const fmtDay = (t: number | null) =>
    t === null
      ? "-"
      : new Date(t * 86400000).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
  const periodText = `${fmtDay(fromT)} - ${fmtDay(toT)}`;
  const prevPeriodText = `${fmtDay(prevFromT)} - ${fmtDay(prevToT)}`;

  const matches = (r: CreativeRow) =>
    (selPlatforms.length === 0 ||
      selPlatforms.some((p) => p.toLowerCase() === r.platform.toLowerCase())) &&
    (selFunnels.length === 0 || selFunnels.includes(r.funnel));

  const { cur, prev, curRows, prevRows } = useMemo(() => {
    const empty = { spend: 0, impressions: 0, clicks: 0 };
    if (
      fromT === null ||
      toT === null ||
      prevFromT === null ||
      prevToT === null
    )
      return {
        cur: empty,
        prev: empty,
        curRows: [] as CreativeRow[],
        prevRows: [] as CreativeRow[],
      };
    const inR = (r: CreativeRow, a: number, b: number) => r.t >= a && r.t <= b;
    const base = rows.filter(matches);
    const curRows = base.filter((r) => inR(r, fromT, toT));
    const prevRows = base.filter((r) => inR(r, prevFromT, prevToT));
    return {
      cur: sumRows(curRows),
      prev: sumRows(prevRows),
      curRows,
      prevRows,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fromT, toT, prevFromT, prevToT, selPlatforms, selFunnels]);

  // Pivot: columns = pilar, one section per account, rows = metrics
  const pivot = useMemo(() => {
    type Agg = {
      spend: number;
      impressions: number;
      clicks: number;
      v6: number;
      v15: number;
      eng: number;
      ads: Set<string>;
    };
    const blank = (): Agg => ({
      spend: 0,
      impressions: 0,
      clicks: 0,
      v6: 0,
      v15: 0,
      eng: 0,
      ads: new Set<string>(),
    });
    const add = (a: Agg, r: CreativeRow) => {
      a.spend += r.spend;
      a.impressions += r.impressions;
      a.clicks += r.clicks;
      a.v6 += r.views6s;
      a.v15 += r.views15s;
      a.eng += r.engagement;
      if (r.adName) a.ads.add(r.adName);
    };
    const pilarCols = Array.from(
      new Set(curRows.map((r) => r.pilar || "(no pilar)")),
    ).sort((a, b) => pilarSortKey(a).localeCompare(pilarSortKey(b)));
    const accounts = new Map<string, { cells: Map<string, Agg>; total: Agg }>();
    const addTo = (name: string, r: CreativeRow) => {
      const acc = accounts.get(name) || {
        cells: new Map<string, Agg>(),
        total: blank(),
      };
      const p = r.pilar || "(no pilar)";
      const cell = acc.cells.get(p) || blank();
      add(cell, r);
      add(acc.total, r);
      acc.cells.set(p, cell);
      accounts.set(name, acc);
    };
    curRows.forEach((r) => {
      addTo("All Accounts", r);
      addTo(r.account || "(no account)", r);
    });
    const names = Array.from(accounts.keys())
      .filter((n) => n !== "All Accounts")
      .sort(
        (a, b) => accounts.get(b)!.total.spend - accounts.get(a)!.total.spend,
      );
    // With no rows (e.g. a pilar without data in this period) there is nothing to list
    return {
      pilarCols,
      accounts,
      order: accounts.has("All Accounts") ? ["All Accounts", ...names] : [],
    };
  }, [curRows]);

  const ctr = (t: Totals) => (t.impressions > 0 ? t.clicks / t.impressions : 0);

  const surface = isDarkMode
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-slate-200";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const labelCls = `text-[10px] font-black uppercase tracking-widest mb-1.5 block ${muted}`;

  if (rows.length === 0) {
    return (
      <div className={`${surface} border rounded-2xl p-8 text-center`}>
        <h2
          className={`text-base font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          No creative data yet
        </h2>
        <p className={`text-sm mt-2 ${muted}`}>
          Make sure the &quot;Creative Report&quot; tab exists, contains data,
          and is shared with the service account.
          {parsed.missing.length > 0 &&
            ` Columns not found: ${parsed.missing.join(", ")}.`}
        </p>
      </div>
    );
  }

  const growth = (c: number, p: number) => {
    if (p === 0 && c === 0) return null;
    if (p === 0) return { text: "New", up: true };
    const g = (c - p) / p;
    return { text: `${g >= 0 ? "+" : ""}${(g * 100).toFixed(2)}%`, up: g >= 0 };
  };

  const cards: {
    key: "spend" | "impressions" | "clicks" | "ctr";
    title: string;
    value: string;
    c: number;
    p: number;
  }[] = [
    {
      key: "spend",
      title: "Spend",
      value: `Rp ${compact(cur.spend)}`,
      c: cur.spend,
      p: prev.spend,
    },
    {
      key: "impressions",
      title: "Impressions",
      value: compact(cur.impressions),
      c: cur.impressions,
      p: prev.impressions,
    },
    {
      key: "clicks",
      title: "Clicks",
      value: compact(cur.clicks),
      c: cur.clicks,
      p: prev.clicks,
    },
    {
      key: "ctr",
      title: "CTR",
      value: `${(ctr(cur) * 100).toFixed(2)}%`,
      c: ctr(cur),
      p: ctr(prev),
    },
  ];

  // Popup rows: full values for this period and the previous period
  const popupRows = (() => {
    const spend = {
      l: "Spend",
      full: formatIDR(cur.spend),
      prevFull: formatIDR(prev.spend),
      cur: cur.spend,
      prev: prev.spend,
    };
    const imp = {
      l: "Impressions",
      full: formatNum(cur.impressions),
      prevFull: formatNum(prev.impressions),
      cur: cur.impressions,
      prev: prev.impressions,
    };
    const clk = {
      l: "Clicks",
      full: formatNum(cur.clicks),
      prevFull: formatNum(prev.clicks),
      cur: cur.clicks,
      prev: prev.clicks,
    };
    const ctrRow = {
      l: "CTR",
      full: formatPct(ctr(cur)),
      prevFull: formatPct(ctr(prev)),
      cur: ctr(cur),
      prev: ctr(prev),
    };
    if (popup === "spend") return [spend];
    if (popup === "impressions") return [imp];
    if (popup === "clicks") return [clk];
    if (popup === "ctr") return [ctrRow, clk, imp];
    return [];
  })();

  return (
    <div className="w-full space-y-5">
      {parsed.missing.length > 0 && (
        <p className="text-xs font-semibold text-amber-500">
          Columns not found in sheet: {parsed.missing.join(", ")} (counted as
          0).
        </p>
      )}

      {/* Filters */}
      <div className={`${surface} border rounded-2xl p-5 shadow-sm`}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <MultiSelect
            label="Platform"
            allLabel="All Platforms"
            options={platforms}
            selected={selPlatforms}
            onChange={setSelPlatforms}
            isDarkMode={isDarkMode}
            labelCls={labelCls}
          />
          <MultiSelect
            label="Funnel"
            allLabel="All Funnels"
            options={funnels}
            selected={selFunnels}
            onChange={setSelFunnels}
            isDarkMode={isDarkMode}
            labelCls={labelCls}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const g = growth(c.c, c.p);
          return (
            <button
              type="button"
              key={c.key}
              onClick={() => setPopup(c.key)}
              title="Click to see full values"
              className={`${surface} border rounded-2xl p-5 shadow-sm text-left cursor-pointer transition-all hover:shadow-md hover:border-indigo-500`}>
              <p
                className={`text-xs font-black uppercase tracking-widest ${muted}`}>
                {c.title}
              </p>
              <p className="text-xs mt-1.5 min-h-[16px]">
                {g ? (
                  <>
                    <span
                      className={`font-bold ${g.up ? "text-emerald-500" : "text-rose-500"}`}>
                      {g.text}
                    </span>{" "}
                    <span className={muted}>{label}</span>
                  </>
                ) : (
                  <span className={muted}>- {label}</span>
                )}
              </p>
              <p
                className={`text-2xl 2xl:text-3xl font-black mt-5 whitespace-nowrap ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                {c.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Mix cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <MixCard
          title="Account Name (Brand) Mix"
          curRows={curRows}
          prevRows={prevRows}
          keyOf={keyAccount}
          isDarkMode={isDarkMode}
        />
        <MixCard
          title="Pilar Mix"
          curRows={curRows}
          prevRows={prevRows}
          keyOf={keyPilar}
          isDarkMode={isDarkMode}
        />
        <MixCard
          title="Format Mix"
          curRows={curRows}
          prevRows={prevRows}
          keyOf={keyFormat}
          isDarkMode={isDarkMode}
        />
        <MixCard
          title="Ad Group Mix"
          curRows={curRows}
          prevRows={prevRows}
          keyOf={keyAdGroup}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Pivot table: account x pilar, broken down by metric */}
      {(() => {
        type A = {
          spend: number;
          impressions: number;
          clicks: number;
          v6: number;
          v15: number;
          eng: number;
          ads: Set<string>;
        };
        const metricsDef: {
          key: string;
          label: string;
          val: (a: A) => number | null;
          fmt: (n: number) => string;
          color: "none" | "higher" | "count";
        }[] = [
          {
            key: "spend",
            label: "Spend",
            val: (a) => a.spend,
            fmt: compact,
            color: "none",
          },
          {
            key: "impr",
            label: "Impressions",
            val: (a) => a.impressions,
            fmt: compact,
            color: "none",
          },
          {
            key: "cpm",
            label: "CPM",
            val: (a) =>
              a.impressions > 0 ? (a.spend / a.impressions) * 1000 : null,
            fmt: compact,
            color: "none",
          },
          {
            key: "ctr",
            label: "CTR",
            val: (a) => (a.impressions > 0 ? a.clicks / a.impressions : null),
            fmt: (n) => `${(n * 100).toFixed(2)}%`,
            color: "higher",
          },
          {
            key: "v6",
            label: "6s VTR",
            val: (a) => (a.impressions > 0 ? a.v6 / a.impressions : null),
            fmt: (n) => `${(n * 100).toFixed(2)}%`,
            color: "higher",
          },
          {
            key: "v15",
            label: "15s VTR",
            val: (a) => (a.impressions > 0 ? a.v15 / a.impressions : null),
            fmt: (n) => `${(n * 100).toFixed(2)}%`,
            color: "higher",
          },
          {
            key: "er",
            label: "ER",
            val: (a) => (a.impressions > 0 ? a.eng / a.impressions : null),
            fmt: (n) => `${(n * 100).toFixed(2)}%`,
            color: "higher",
          },
          {
            key: "cc",
            label: "Creative Count",
            val: (a) => a.ads.size,
            fmt: (n) => formatNumber(n),
            color: "count",
          },
        ];
        const sections = pivot.order;
        const cols = pivot.pilarCols;
        const border = isDarkMode ? "border-slate-700" : "border-slate-200";
        const cellBase = `py-3 px-4 text-center text-xs border ${border} whitespace-nowrap`;
        const emptyA: A = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          v6: 0,
          v15: 0,
          eng: 0,
          ads: new Set<string>(),
        };
        return (
          <div
            className={`${surface} border rounded-2xl shadow-sm overflow-hidden`}>
            <div
              className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b ${border}`}>
              <div>
                <h3
                  className={`text-base font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  Account &amp; Pilar Performance Breakdown
                </h3>
                <p className={`text-xs mt-0.5 ${muted}`}>
                  Key metrics per account, split by pilar
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCollapsed(sections)}
                  className={`px-4 py-2 rounded-lg border text-xs font-bold transition-colors ${isDarkMode ? "border-slate-600 text-slate-200 hover:border-indigo-500" : "border-slate-300 text-slate-700 hover:border-indigo-500"}`}>
                  Minimize All
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed([])}
                  className={`px-4 py-2 rounded-lg border text-xs font-bold transition-colors ${isDarkMode ? "border-slate-600 text-slate-200 hover:border-indigo-500" : "border-slate-300 text-slate-700 hover:border-indigo-500"}`}>
                  Expand All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th
                      className={`sticky left-0 z-10 py-3.5 px-4 text-xs font-black text-left text-white bg-[#006D77] border ${border}`}>
                      Account / Metric
                    </th>
                    {cols.map((c) => (
                      <th
                        key={c}
                        className={`py-3.5 px-4 text-xs font-black text-white bg-[#006D77] border ${border} min-w-[150px]`}>
                        {c}
                      </th>
                    ))}
                    <th
                      className={`py-3.5 px-4 text-xs font-black text-white bg-[#00565F] border ${border} min-w-[130px]`}>
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sections.length === 0 && (
                    <tr>
                      <td
                        colSpan={cols.length + 2}
                        className={`py-10 text-center text-sm ${muted}`}>
                        No data for the selected filters.
                      </td>
                    </tr>
                  )}
                  {sections.map((name) => {
                    const acc = pivot.accounts.get(name);
                    if (!acc) return null;
                    const isCollapsed = collapsed.includes(name);
                    return (
                      <React.Fragment key={name}>
                        <tr
                          onClick={() =>
                            setCollapsed((s) =>
                              s.includes(name)
                                ? s.filter((x) => x !== name)
                                : [...s, name],
                            )
                          }
                          className={`cursor-pointer ${isDarkMode ? "bg-slate-900/60 hover:bg-slate-900" : "bg-slate-50 hover:bg-slate-100"}`}>
                          <td
                            colSpan={cols.length + 2}
                            className={`py-3.5 px-4 text-sm font-black border ${border} ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                            <span className="inline-block w-4 text-xs">
                              {isCollapsed ? "▸" : "▾"}
                            </span>
                            {name}
                          </td>
                        </tr>
                        {!isCollapsed &&
                          metricsDef.map((m) => {
                            const totalVal = m.val(acc.total);
                            return (
                              <tr key={`${name}-${m.key}`}>
                                <td
                                  className={`sticky left-0 z-10 py-3 px-4 text-xs font-bold text-left border ${border} ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}`}>
                                  {m.label}
                                </td>
                                {cols.map((c) => {
                                  const val = m.val(acc.cells.get(c) || emptyA);
                                  let tone = "";
                                  if (
                                    m.color === "higher" &&
                                    val !== null &&
                                    totalVal !== null
                                  )
                                    tone =
                                      val >= totalVal
                                        ? isDarkMode
                                          ? "bg-emerald-900/40 text-emerald-300"
                                          : "bg-emerald-50 text-emerald-700"
                                        : isDarkMode
                                          ? "bg-rose-900/40 text-rose-300"
                                          : "bg-rose-50 text-rose-600";
                                  return (
                                    <td
                                      key={c}
                                      className={`${cellBase} font-mono ${tone || (isDarkMode ? "text-slate-200" : "text-slate-800")} ${tone ? "font-bold" : ""}`}>
                                      {val === null ? "–" : m.fmt(val)}
                                    </td>
                                  );
                                })}
                                <td
                                  className={`${cellBase} font-mono font-black ${isDarkMode ? "bg-slate-900/50 text-white" : "bg-slate-100 text-slate-900"}`}>
                                  {totalVal === null ? "–" : m.fmt(totalVal)}
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className={`px-5 py-3 text-[11px] ${muted}`}>
              CPM = spend ÷ impressions × 1000 · CTR = clicks ÷ impressions ·
              VTR = views ÷ impressions · ER = post engagement ÷ impressions ·
              Creative Count = unique Ad Names. Green / red compares each pilar
              with the Grand Total of the same account.
            </p>
          </div>
        );
      })()}

      {popup &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPopup(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex items-start justify-between gap-4">
                <span
                  className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  {cards.find((c) => c.key === popup)?.title}
                </span>
                <button
                  type="button"
                  onClick={() => setPopup(null)}
                  aria-label="Close"
                  className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                  ×
                </button>
              </div>
              <div
                className={`mt-2 text-xs font-semibold space-y-0.5 ${muted}`}>
                <div>
                  Current period:{" "}
                  <span
                    className={
                      isDarkMode ? "text-slate-200" : "text-slate-700"
                    }>
                    {periodText}
                  </span>
                </div>
                <div>
                  Previous period:{" "}
                  <span
                    className={
                      isDarkMode ? "text-slate-200" : "text-slate-700"
                    }>
                    {prevPeriodText}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {popupRows.map((row) => (
                  <div
                    key={row.l}
                    className={`border-b pb-3 last:border-b-0 last:pb-0 ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
                    <div
                      className={`text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {row.l}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-2xl font-black break-all">
                        {row.full}
                      </div>
                      {renderGR(row.cur, row.prev, false, isDarkMode)}
                    </div>
                    <div className={`mt-2 text-xs font-semibold ${muted}`}>
                      Previous period:{" "}
                      <span
                        className={`font-black ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                        {row.prevFull}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
