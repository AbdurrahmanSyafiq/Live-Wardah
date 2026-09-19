import React, { useState, useMemo } from 'react';
import { formatIDR, formatNum } from '@/lib/formatters';
import { aggregateSkuData } from './SkuPerformanceModal';

interface SkuPerformanceViewProps {
  ctxCurData: any[];
  isDarkMode: boolean;
  filters: any;
  onFilterChange: (k: string, v: string) => void;
  brandOptions: string[];
}

export default function SkuPerformanceView({
  ctxCurData,
  isDarkMode,
  filters,
  onFilterChange,
  brandOptions,
}: SkuPerformanceViewProps) {
  const [platformFilter, setPlatformFilter] = useState('All');
  const [adTypeFilter, setAdTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'gmv' | 'expense' | 'orders' | 'roas'>('gmv');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const skuList = useMemo(() => aggregateSkuData(ctxCurData), [ctxCurData]);

  // Extract unique Ad Types available dynamically
  const adTypeOptions = useMemo(() => {
    const types = new Set<string>();
    skuList.forEach(item => {
      if (item.adType && item.adType.trim() !== '') {
        types.add(item.adType.trim());
      }
    });
    return ['All', ...Array.from(types).sort()];
  }, [skuList]);

  // Filter SKUs
  const filtered = useMemo(() => {
    let list = skuList;

    if (platformFilter !== 'All') {
      const match = platformFilter.toLowerCase();
      list = list.filter(item => item.platform.toLowerCase().includes(match));
    }

    if (adTypeFilter !== 'All') {
      const match = adTypeFilter.toLowerCase();
      list = list.filter(item => item.adType.toLowerCase() === match);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => item.pid.toLowerCase().includes(q) || item.skuName.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortAsc ? diff : -diff;
    });
  }, [skuList, platformFilter, adTypeFilter, searchTerm, sortField, sortAsc]);

  const totalGmv = useMemo(() => filtered.reduce((acc, i) => acc + i.gmv, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.reduce((acc, i) => acc + i.expense, 0), [filtered]);
  const totalOrders = useMemo(() => filtered.reduce((acc, i) => acc + i.orders, 0), [filtered]);

  // Shared dropdown class with full light/dark contrast
  const selectStyle = `py-2 px-3 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
    isDarkMode
      ? 'bg-[#0f172a] border-slate-700 text-slate-100 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500'
      : 'bg-slate-50 border-slate-300 text-slate-800 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 shadow-sm'
  }`;

  return (
    <div className="w-full space-y-5">
      {/* Top Filter & Search Bar */}
      <div className={`p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Brand Filter */}
          <div>
            <label className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>Brand</label>
            <select
              value={filters.brand}
              onChange={e => onFilterChange('brand', e.target.value)}
              className={selectStyle}
            >
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <label className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>Platform</label>
            <select
              value={platformFilter}
              onChange={e => { setPlatformFilter(e.target.value); setPage(1); }}
              className={selectStyle}
            >
              <option value="All">All Platforms</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok">TikTok</option>
            </select>
          </div>

          {/* Ad Type Filter */}
          <div>
            <label className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>Ad Type</label>
            <select
              value={adTypeFilter}
              onChange={e => { setAdTypeFilter(e.target.value); setPage(1); }}
              className={selectStyle}
            >
              {adTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-80">
          <label className={`text-[10px] font-extrabold block mb-1 uppercase tracking-wider ${
            isDarkMode ? 'text-slate-400' : 'text-slate-600'
          }`}>Search SKU / PID</label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search PID or Product Name..."
            className={`w-full py-2 px-3.5 rounded-xl text-xs font-semibold border outline-none transition-all shadow-sm ${
              isDarkMode
                ? 'bg-[#0f172a] border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white'
            }`}
          />
        </div>
      </div>

      {/* Summary KPI Cards with High Contrast */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-5 rounded-2xl border shadow-sm ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}>Total SKU GMV</span>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatIDR(totalGmv)}</h3>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}>Total Ad Spend</span>
          <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{formatIDR(totalExpense)}</h3>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}>Total Orders</span>
          <h3 className={`text-2xl font-black ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>{formatNum(totalOrders)}</h3>
        </div>
      </div>

      {/* Main Table */}
      <div className={`rounded-3xl border shadow-sm overflow-hidden ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${
                isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-300 text-slate-800 bg-slate-100'
              }`}>
                <th className="py-4 px-4 w-14 text-center">#</th>
                <th className="py-4 px-4 w-40">PID</th>
                <th className="py-4 px-4 min-w-[320px]">SKU Name</th>
                <th className="py-4 px-4 w-28">Platform</th>
                <th
                  onClick={() => { setSortField('expense'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none"
                >
                  Spend {sortField === 'expense' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => { setSortField('orders'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none"
                >
                  Orders {sortField === 'orders' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => { setSortField('gmv'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer text-emerald-700 dark:text-emerald-400 font-extrabold select-none"
                >
                  GMV (Highest) {sortField === 'gmv' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => { setSortField('roas'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none"
                >
                  ROAS {sortField === 'roas' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="py-4 px-4 text-right">CPA</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/60' : 'divide-slate-200'}`}>
              {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((item, idx) => (
                <tr
                  key={`${item.pid}-${idx}`}
                  className={`transition-colors ${
                    isDarkMode
                      ? 'hover:bg-slate-700/30 text-slate-200'
                      : 'hover:bg-indigo-50/60 text-slate-800'
                  }`}
                >
                  <td className={`py-3.5 px-4 text-center font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>{(page - 1) * PER_PAGE + idx + 1}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.pid}</td>
                  <td className={`py-3.5 px-4 font-semibold max-w-md truncate ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-900'
                  }`} title={item.skuName}>{item.skuName}</td>
                  <td className={`py-3.5 px-4 font-bold ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-800'
                  }`}>{item.platform || '-'}</td>
                  <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-900'
                  }`}>{formatIDR(item.expense)}</td>
                  <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-900'
                  }`}>{formatNum(item.orders)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                    {formatIDR(item.gmv)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-300">
                    {item.roas.toFixed(2)}x
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono font-semibold ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>{item.orders > 0 ? formatIDR(item.cpa) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {filtered.length > PER_PAGE && (
          <div className={`px-6 py-4 border-t flex items-center justify-between text-xs font-bold ${
            isDarkMode ? 'border-slate-700 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}>
            <span>
              Page {page} of {Math.ceil(filtered.length / PER_PAGE)} ({filtered.length} SKUs total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className={`px-4 py-2 rounded-xl border font-bold disabled:opacity-30 transition-all ${
                  isDarkMode
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100 shadow-sm'
                }`}
              >
                Previous
              </button>
              <button
                disabled={page === Math.ceil(filtered.length / PER_PAGE)}
                onClick={() => setPage(p => p + 1)}
                className={`px-4 py-2 rounded-xl border font-bold disabled:opacity-30 transition-all ${
                  isDarkMode
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100 shadow-sm'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}