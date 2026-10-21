import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatIDR, formatNum } from "@/lib/formatters";
import { aggregateSkuData, type SkuItem } from "./SkuPerformanceModal";

interface SkuPerformanceViewProps {
  ctxCurData: any[];
  isDarkMode: boolean;
  filters: any;
  onFilterChange: (k: string, v: string) => void;
  brandOptions: string[];
}

// Angka besar diringkas: 2.456.223.866 -> 2.46B, 622.357.228 -> 622.36M
const compact = (n: number) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};
const compactIDR = (n: number) => `Rp ${compact(n)}`;

type SortField =
  | "pid"
  | "skuName"
  | "platform"
  | "expense"
  | "impressions"
  | "clicks"
  | "gmv"
  | "roas";

export default function SkuPerformanceView({
  ctxCurData,
  isDarkMode,
  filters,
  onFilterChange,
  brandOptions,
}: SkuPerformanceViewProps) {
  const [platformFilter, setPlatformFilter] = useState("All");
  const [adTypeFilter, setAdTypeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("gmv");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;
  // Pop up: klik kartu ringkasan (kpiPopup) atau klik baris tabel (rowPopup)
  const [kpiPopup, setKpiPopup] = useState<{
    label: string;
    full: string;
    short: string;
  } | null>(null);
  const [rowPopup, setRowPopup] = useState<SkuItem | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setKpiPopup(null);
        setRowPopup(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const skuList = useMemo(() => aggregateSkuData(ctxCurData), [ctxCurData]);

  // Platform yang ada di data (Shopee, Lazada, Meta, TikTok, ...)
  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    skuList.forEach((item) => {
      if (item.platform && item.platform.trim() !== "")
        set.add(item.platform.trim());
    });
    return Array.from(set).sort();
  }, [skuList]);

  // Extract unique Ad Types available dynamically
  const adTypeOptions = useMemo(() => {
    const types = new Set<string>();
    skuList.forEach((item) => {
      if (item.adType && item.adType.trim() !== "") {
        types.add(item.adType.trim());
      }
    });
    return ["All", ...Array.from(types).sort()];
  }, [skuList]);

  // Filter SKUs
  const filtered = useMemo(() => {
    let list = skuList;

    if (platformFilter !== "All") {
      const match = platformFilter.toLowerCase();
      list = list.filter((item) => item.platform.toLowerCase().includes(match));
    }

    if (adTypeFilter !== "All") {
      const match = adTypeFilter.toLowerCase();
      list = list.filter((item) => item.adType.toLowerCase() === match);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.pid.toLowerCase().includes(q) ||
          item.skuName.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (
        sortField === "pid" ||
        sortField === "skuName" ||
        sortField === "platform"
      ) {
        const va = String(a[sortField] || "").toLowerCase();
        const vb = String(b[sortField] || "").toLowerCase();
        const diff = va.localeCompare(vb);
        return sortAsc ? diff : -diff;
      }
      const diff = (a[sortField] as number) - (b[sortField] as number);
      return sortAsc ? diff : -diff;
    });
  }, [skuList, platformFilter, adTypeFilter, searchTerm, sortField, sortAsc]);

  const totalGmv = useMemo(
    () => filtered.reduce((acc, i) => acc + i.gmv, 0),
    [filtered],
  );
  const totalExpense = useMemo(
    () => filtered.reduce((acc, i) => acc + i.expense, 0),
    [filtered],
  );
  const totalImpressions = useMemo(
    () => filtered.reduce((acc, i) => acc + i.impressions, 0),
    [filtered],
  );
  const totalClicks = useMemo(
    () => filtered.reduce((acc, i) => acc + i.clicks, 0),
    [filtered],
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(
        field === "pid" || field === "skuName" || field === "platform",
      );
    }
  };

  const sortArrow = (field: SortField) =>
    sortField === field ? (sortAsc ? " ▲" : " ▼") : "";

  // --- EXCEL EXPORT (uses the SheetJS "xlsx" package — run `npm install xlsx`
  // if it isn't already a dependency) — exports exactly what's currently
  // filtered/sorted on screen, not the whole unfiltered dataset.
  const handleExportExcel = async () => {
    const XLSX = await import("xlsx");
    const exportRows = filtered.map((item, idx) => ({
      "#": idx + 1,
      PID: item.pid,
      "SKU Name": item.skuName,
      Platform: item.platform || "-",
      Spend: item.expense,
      Impressions: item.impressions,
      Clicks: item.clicks,
      GMV: item.gmv,
      ROAS: Number(item.roas.toFixed(2)),
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 4 },
      { wch: 18 },
      { wch: 40 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 8 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PID & SKU Performance");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `PID_SKU_Performance_${dateStr}.xlsx`);
  };

  // Shared dropdown class with full light/dark contrast
  const selectStyle = `py-2 px-3 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
    isDarkMode
      ? "bg-[#0E3A3D] border-slate-700 text-slate-100 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
      : "bg-slate-50 border-slate-300 text-slate-800 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }`;

  return (
    <div className="w-full space-y-5">
      {/* Top Filter & Search Bar */}
      <div
        className={`p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isDarkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Brand Filter */}
          <div>
            <label
              className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}>
              Brand
            </label>
            <select
              value={filters.brand}
              onChange={(e) => onFilterChange("brand", e.target.value)}
              className={selectStyle}>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <label
              className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}>
              Platform
            </label>
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setPage(1);
              }}
              className={selectStyle}>
              <option value="All">All Platforms</option>
              {platformOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Ad Type Filter */}
          <div>
            <label
              className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}>
              Funnel
            </label>
            <select
              value={adTypeFilter}
              onChange={(e) => {
                setAdTypeFilter(e.target.value);
                setPage(1);
              }}
              className={selectStyle}>
              {adTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="w-full md:w-80">
            <label
              className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}>
              Search SKU / PID
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search PID or Product Name..."
              className={`w-full py-2 px-3.5 rounded-xl text-xs font-semibold border outline-none transition-all shadow-sm ${
                isDarkMode
                  ? "bg-[#0E3A3D] border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500"
                  : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white"
              }`}
            />
          </div>

          {/* Download Excel Button */}
          <button
            onClick={handleExportExcel}
            title="Download data (sesuai filter & sort saat ini) sebagai Excel"
            className={`shrink-0 inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold border shadow-sm transition-all ${
              isDarkMode
                ? "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500"
                : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
            }`}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
              />
            </svg>
            Download Excel
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (klik untuk lihat nilai lengkap) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() =>
            setKpiPopup({
              label: "Total Ad Spend",
              full: formatIDR(totalExpense),
              short: compactIDR(totalExpense),
            })
          }
          title="Klik untuk lihat nilai lengkap"
          className={`p-5 rounded-2xl border shadow-sm text-left cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}>
          <span
            className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
            Total Ad Spend
          </span>
          <h3
            className={`text-2xl font-black text-indigo-600 dark:text-indigo-400`}>
            {compactIDR(totalExpense)}
          </h3>
        </button>
        <button
          type="button"
          onClick={() =>
            setKpiPopup({
              label: "Total Impressions",
              full: formatNum(totalImpressions),
              short: compact(totalImpressions),
            })
          }
          title="Klik untuk lihat nilai lengkap"
          className={`p-5 rounded-2xl border shadow-sm text-left cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}>
          <span
            className={`text-xs font-bold normal-case tracking-wider block mb-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
            Total Impressions
          </span>
          <h3
            className={`text-2xl font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {compact(totalImpressions)}
          </h3>
        </button>
        <button
          type="button"
          onClick={() =>
            setKpiPopup({
              label: "Total Clicks",
              full: formatNum(totalClicks),
              short: compact(totalClicks),
            })
          }
          title="Klik untuk lihat nilai lengkap"
          className={`p-5 rounded-2xl border shadow-sm text-left cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}>
          <span
            className={`text-xs font-bold normal-case tracking-wider block mb-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
            Total Clicks
          </span>
          <h3
            className={`text-2xl font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {compact(totalClicks)}
          </h3>
        </button>
        <button
          type="button"
          onClick={() =>
            setKpiPopup({
              label: "Total SKU GMV",
              full: formatIDR(totalGmv),
              short: compactIDR(totalGmv),
            })
          }
          title="Klik untuk lihat nilai lengkap"
          className={`p-5 rounded-2xl border shadow-sm text-left cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}>
          <span
            className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
            Total SKU GMV
          </span>
          <h3
            className={`text-2xl font-black text-emerald-600 dark:text-emerald-400`}>
            {compactIDR(totalGmv)}
          </h3>
        </button>
      </div>

      {/* Main Table */}
      <div
        className={`rounded-3xl border shadow-sm overflow-hidden ${
          isDarkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className="border-b border-black text-[11px] font-black uppercase tracking-wider bg-black text-white">
                <th className="py-4 px-4 w-14 text-center">#</th>
                <th
                  onClick={() => toggleSort("pid")}
                  className="py-4 px-4 w-40 cursor-pointer hover:text-indigo-400 select-none">
                  PID{sortArrow("pid")}
                </th>
                <th
                  onClick={() => toggleSort("skuName")}
                  className="py-4 px-4 min-w-[320px] cursor-pointer hover:text-indigo-400 select-none">
                  SKU Name{sortArrow("skuName")}
                </th>
                <th
                  onClick={() => toggleSort("platform")}
                  className="py-4 px-4 w-28 cursor-pointer hover:text-indigo-400 select-none">
                  Platform{sortArrow("platform")}
                </th>
                <th
                  onClick={() => toggleSort("expense")}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400 select-none">
                  Spend{sortArrow("expense")}
                </th>
                <th
                  onClick={() => toggleSort("impressions")}
                  className="py-4 px-4 text-right normal-case cursor-pointer hover:text-indigo-400 select-none">
                  Impressions{sortArrow("impressions")}
                </th>
                <th
                  onClick={() => toggleSort("clicks")}
                  className="py-4 px-4 text-right normal-case cursor-pointer hover:text-indigo-400 select-none">
                  Clicks{sortArrow("clicks")}
                </th>
                <th
                  onClick={() => toggleSort("gmv")}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400 select-none">
                  GMV{sortArrow("gmv")}
                </th>
                <th
                  onClick={() => toggleSort("roas")}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400 select-none">
                  ROAS{sortArrow("roas")}
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-200"}`}>
              {filtered
                .slice((page - 1) * PER_PAGE, page * PER_PAGE)
                .map((item, idx) => (
                  <tr
                    key={`${item.pid}-${idx}`}
                    onClick={() => setRowPopup(item)}
                    title="Klik untuk lihat detail"
                    className={`cursor-pointer transition-colors ${
                      isDarkMode
                        ? "hover:bg-indigo-900/30 text-slate-200"
                        : "hover:bg-indigo-50 text-slate-800"
                    }`}>
                    <td
                      className={`py-3.5 px-4 text-center font-mono ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}>
                      {(page - 1) * PER_PAGE + idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.pid}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-semibold max-w-md truncate ${
                        isDarkMode ? "text-slate-200" : "text-slate-900"
                      }`}
                      title={item.skuName}>
                      {item.skuName}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-bold ${
                        isDarkMode ? "text-slate-300" : "text-slate-800"
                      }`}>
                      {item.platform || "-"}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-bold ${
                        isDarkMode ? "text-slate-200" : "text-slate-900"
                      }`}>
                      {formatIDR(item.expense)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-bold ${
                        isDarkMode ? "text-slate-200" : "text-slate-900"
                      }`}>
                      {formatNum(item.impressions)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-bold ${
                        isDarkMode ? "text-slate-200" : "text-slate-900"
                      }`}>
                      {formatNum(item.clicks)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formatIDR(item.gmv)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.roas.toFixed(2)}x
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {filtered.length > PER_PAGE && (
          <div
            className={`px-6 py-4 border-t flex items-center justify-between text-xs font-bold ${
              isDarkMode
                ? "border-slate-700 bg-slate-900/40 text-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
            <span>
              Page {page} of {Math.ceil(filtered.length / PER_PAGE)} (
              {filtered.length} SKUs total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className={`px-4 py-2 rounded-xl border font-bold disabled:opacity-30 transition-all ${
                  isDarkMode
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-300 text-slate-700 bg-white hover:bg-slate-100 shadow-sm"
                }`}>
                Previous
              </button>
              <button
                disabled={page === Math.ceil(filtered.length / PER_PAGE)}
                onClick={() => setPage((p) => p + 1)}
                className={`px-4 py-2 rounded-xl border font-bold disabled:opacity-30 transition-all ${
                  isDarkMode
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-300 text-slate-700 bg-white hover:bg-slate-100 shadow-sm"
                }`}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pop up nilai lengkap dari kartu ringkasan */}
      {kpiPopup &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setKpiPopup(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}>
              <div className="flex items-start justify-between gap-4">
                <span
                  className={`text-xs font-bold tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {kpiPopup.label}
                </span>
                <button
                  type="button"
                  onClick={() => setKpiPopup(null)}
                  aria-label="Close"
                  className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                  ×
                </button>
              </div>
              <p className="text-3xl font-black mt-3 break-all">
                {kpiPopup.full}
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* Pop up detail per baris */}
      {rowPopup &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setRowPopup(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className={`text-[11px] font-bold tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    PID
                  </p>
                  <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 break-all">
                    {rowPopup.pid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRowPopup(null)}
                  aria-label="Close"
                  className={`shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full text-3xl leading-none font-bold transition-colors ${isDarkMode ? "text-slate-300 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
                  ×
                </button>
              </div>

              <p
                className={`text-[11px] font-bold tracking-wider mt-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                SKU Name
              </p>
              <p className="font-semibold break-words">{rowPopup.skuName}</p>

              <div className="flex flex-wrap gap-2 mt-3">
                {[rowPopup.platform, rowPopup.brand, rowPopup.adType]
                  .filter(Boolean)
                  .map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        isDarkMode
                          ? "bg-slate-700 text-slate-200"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                      {t}
                    </span>
                  ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                {[
                  { label: "Spend", value: formatIDR(rowPopup.expense) },
                  {
                    label: "Impressions",
                    value: formatNum(rowPopup.impressions),
                  },
                  { label: "Clicks", value: formatNum(rowPopup.clicks) },
                  { label: "GMV", value: formatIDR(rowPopup.gmv) },
                  { label: "ROAS", value: `${rowPopup.roas.toFixed(2)}x` },
                  {
                    label: "CTR",
                    value:
                      rowPopup.impressions > 0
                        ? `${((rowPopup.clicks / rowPopup.impressions) * 100).toFixed(2)}%`
                        : "-",
                  },
                  {
                    label: "CPM",
                    value:
                      rowPopup.impressions > 0
                        ? formatIDR(
                            (rowPopup.expense / rowPopup.impressions) * 1000,
                          )
                        : "-",
                  },
                  {
                    label: "CPC",
                    value:
                      rowPopup.clicks > 0
                        ? formatIDR(rowPopup.expense / rowPopup.clicks)
                        : "-",
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className={`rounded-xl p-3 ${isDarkMode ? "bg-slate-900/60" : "bg-slate-50"}`}>
                    <span
                      className={`text-[11px] font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {m.label}
                    </span>
                    <strong className="block text-base font-black mt-0.5 break-all">
                      {m.value}
                    </strong>
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
