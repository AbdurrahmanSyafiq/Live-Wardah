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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'gmv' | 'expense' | 'orders' | 'roas'>('gmv');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const skuList = useMemo(() => aggregateSkuData(ctxCurData), [ctxCurData]);

  const filtered = useMemo(() => {
    let list = skuList;
    if (platformFilter !== 'All') {
      const match = platformFilter.toLowerCase();
      list = list.filter(item => item.platform.toLowerCase().includes(match));
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => item.pid.toLowerCase().includes(q) || item.skuName.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortAsc ? diff : -diff;
    });
  }, [skuList, platformFilter, searchTerm, sortField, sortAsc]);

  const totalGmv = useMemo(() => filtered.reduce((acc, i) => acc + i.gmv, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.reduce((acc, i) => acc + i.expense, 0), [filtered]);
  const totalOrders = useMemo(() => filtered.reduce((acc, i) => acc + i.orders, 0), [filtered]);

  return (
    <div className="w-full space-y-5">
      {/* Top Filter & Search Bar */}
      <div className={`p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Brand</label>
            <select
              value={filters.brand}
              onChange={e => onFilterChange('brand', e.target.value)}
              className="bg-[#090d16] border border-slate-700 text-slate-200 py-2 px-3 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Platform</label>
            <select
              value={platformFilter}
              onChange={e => { setPlatformFilter(e.target.value); setPage(1); }}
              className="bg-[#090d16] border border-slate-700 text-slate-200 py-2 px-3 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Platforms</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok">TikTok</option>
            </select>
          </div>
        </div>

        <div className="w-full md:w-72">
          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search PID or SKU..."
            className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border outline-none ${
              isDarkMode ? 'bg-[#090d16] border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total SKU GMV</span>
          <h3 className="text-2xl font-black text-emerald-400">{formatIDR(totalGmv)}</h3>
        </div>
        <div className={`p-5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Ad Spend</span>
          <h3 className="text-2xl font-black text-indigo-400">{formatIDR(totalExpense)}</h3>
        </div>
        <div className={`p-5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Orders</span>
          <h3 className="text-2xl font-black text-white">{formatNum(totalOrders)}</h3>
        </div>
      </div>

      {/* Main Table */}
      <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${
                isDarkMode ? 'border-slate-700 text-slate-400 bg-slate-900' : 'border-slate-200 text-slate-600 bg-slate-100'
              }`}>
                <th className="py-4 px-4 w-14 text-center">#</th>
                <th className="py-4 px-4 w-40">PID</th>
                <th className="py-4 px-4 min-w-[320px]">SKU Name</th>
                <th className="py-4 px-4 w-28">Platform</th>
                <th
                  onClick={() => { setSortField('expense'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400"
                >
                  Spend {sortField === 'expense' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => { setSortField('orders'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400"
                >
                  Orders {sortField === 'orders' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => { setSortField('gmv'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400 text-emerald-400"
                >
                  GMV (Highest) {sortField === 'gmv' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => { setSortField('roas'); setSortAsc(!sortAsc); }}
                  className="py-4 px-4 text-right cursor-pointer hover:text-indigo-400"
                >
                  ROAS {sortField === 'roas' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="py-4 px-4 text-right">CPA</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
              {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((item, idx) => (
                <tr
                  key={`${item.pid}-${idx}`}
                  className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-3 px-4 text-center text-slate-500 font-mono">{(page - 1) * PER_PAGE + idx + 1}</td>
                  <td className="py-3 px-4 font-mono font-bold text-indigo-400">{item.pid}</td>
                  <td className="py-3 px-4 font-medium max-w-md truncate" title={item.skuName}>{item.skuName}</td>
                  <td className="py-3 px-4 font-bold">{item.platform || '-'}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">{formatIDR(item.expense)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatNum(item.orders)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{formatIDR(item.gmv)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">{item.roas.toFixed(2)}x</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">{item.orders > 0 ? formatIDR(item.cpa) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > PER_PAGE && (
          <div className={`px-6 py-4 border-t flex items-center justify-between text-xs font-bold ${
            isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'
          }`}>
            <span className="text-slate-400">
              Page {page} of {Math.ceil(filtered.length / PER_PAGE)} ({filtered.length} SKUs total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl border border-slate-700 disabled:opacity-30 hover:bg-slate-800 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page === Math.ceil(filtered.length / PER_PAGE)}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-slate-700 disabled:opacity-30 hover:bg-slate-800 transition-colors"
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