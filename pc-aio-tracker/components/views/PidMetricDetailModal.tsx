import React, { useState, useMemo } from 'react';
import { formatIDR, formatNum, formatPct } from '@/lib/formatters';

export type MetricType = 'spend' | 'adsGmv' | 'sales' | 'roas' | 'cir';

interface DailyRecord {
  date: string;       // e.g. '2026-09-01'
  displayDate: string;// e.g. '1 Sep 2026'
  spend: number;
  adsGmv: number;
  sales: number;
  roas: number;
  cir: number;
}

interface PidMetricDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pidItem: {
    pid: string;
    skuName: string;
    cluster: string;
    cid: string;
    brand: string;
    platform: string;
    dailyData: Record<string, DailyRecord>;
  } | null;
  initialMetric?: MetricType;
  dates: string[]; // List of YMD dates in chronological order
  isDarkMode: boolean;
  onOpenAddAdjustment: (date: string, pid: string, skuName: string, metric: string, value: number) => void;
  adjustments?: any[];
}

const METRIC_CONFIG: Record<MetricType, { label: string; unit: string; format: (v: number) => string; color: string; bgColor: string }> = {
  spend: {
    label: 'Spend',
    unit: 'IDR',
    format: (v: number) => formatIDR(v),
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30'
  },
  adsGmv: {
    label: 'Ads GMV',
    unit: 'IDR',
    format: (v: number) => formatIDR(v),
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10 border-indigo-500/30'
  },
  sales: {
    label: 'Sales',
    unit: 'IDR',
    format: (v: number) => formatIDR(v),
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30'
  },
  roas: {
    label: 'ROAS',
    unit: 'x',
    format: (v: number) => v > 0 ? `${v.toFixed(2)}x` : '-',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30'
  },
  cir: {
    label: 'CIR',
    unit: '%',
    format: (v: number) => v > 0 ? `${v.toFixed(2)}%` : '-',
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10 border-rose-500/30'
  }
};

export default function PidMetricDetailModal({
  isOpen,
  onClose,
  pidItem,
  initialMetric = 'spend',
  dates,
  isDarkMode,
  onOpenAddAdjustment,
  adjustments = []
}: PidMetricDetailModalProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(initialMetric);

  // Sync selected metric when initialMetric changes
  React.useEffect(() => {
    if (initialMetric) setSelectedMetric(initialMetric);
  }, [initialMetric, isOpen]);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const rows = useMemo(() => {
    if (!pidItem) return [];
    
    return dates.map((d, idx) => {
      const record = pidItem.dailyData[d] || {
        date: d,
        displayDate: d,
        spend: 0,
        adsGmv: 0,
        sales: 0,
        roas: 0,
        cir: 0
      };

      const val = record[selectedMetric] || 0;
      
      // Calculate DoD
      let dodVal = 0;
      let dodPct = 0;
      if (idx > 0) {
        const prevDate = dates[idx - 1];
        const prevRecord = pidItem.dailyData[prevDate];
        const prevVal = prevRecord ? (prevRecord[selectedMetric] || 0) : 0;
        dodVal = val - prevVal;
        dodPct = prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : 0;
      }

      // Find adjustments for this PID and date
      const adjForDay = adjustments.filter(
        a => a.pid === pidItem.pid && (a.date === record.displayDate || a.date === d)
      );

      return {
        date: d,
        displayDate: record.displayDate,
        value: val,
        dodVal,
        dodPct,
        adjustments: adjForDay
      };
    });
  }, [pidItem, dates, selectedMetric, adjustments]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!rows.length) return { total: 0, avg: 0, max: 0, min: 0 };
    const values = rows.map(r => r.value).filter(v => v > 0);
    const total = rows.reduce((acc, r) => acc + r.value, 0);
    const avg = values.length ? total / values.length : 0;
    const max = values.length ? Math.max(...values) : 0;
    const min = values.length ? Math.min(...values) : 0;
    return { total, avg, max, min };
  }, [rows]);

  if (!isOpen || !pidItem) return null;

  const currentCfg = METRIC_CONFIG[selectedMetric];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
          isDarkMode ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-6 border-b flex items-start justify-between ${isDarkMode ? 'border-slate-800 bg-[#131d33]' : 'border-slate-100 bg-slate-50'}`}>
          <div className="space-y-1 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {pidItem.cluster || 'No Cluster'}
              </span>
              <span className="text-xs text-slate-400 font-mono">PID: {pidItem.pid}</span>
              {pidItem.cid && (
                <span className="text-xs text-slate-400 font-mono">CID: {pidItem.cid}</span>
              )}
            </div>
            <h2 className="text-lg font-bold line-clamp-2 leading-tight">
              {pidItem.skuName}
            </h2>
            <p className="text-xs text-slate-400">
              Daily Single-Metric View: <span className={`font-semibold ${currentCfg.color}`}>{currentCfg.label}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metric Switcher Tabs */}
        <div className={`px-6 pt-4 pb-2 border-b flex flex-wrap gap-2 ${isDarkMode ? 'border-slate-800 bg-[#0c1222]' : 'border-slate-100 bg-slate-50/50'}`}>
          {(['spend', 'adsGmv', 'sales', 'roas', 'cir'] as MetricType[]).map((m) => {
            const cfg = METRIC_CONFIG[m];
            const isAct = selectedMetric === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMetric(m)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isAct
                    ? `${cfg.bgColor} ${cfg.color} border shadow-sm ring-1 ring-inset ring-current`
                    : isDarkMode
                    ? 'bg-[#1e293b] text-slate-400 hover:text-slate-200'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Summary Stats Cards */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {selectedMetric === 'roas' || selectedMetric === 'cir' ? 'Average' : 'Total'}
            </div>
            <div className={`text-base font-extrabold mt-0.5 ${currentCfg.color}`}>
              {selectedMetric === 'roas' || selectedMetric === 'cir'
                ? currentCfg.format(stats.avg)
                : currentCfg.format(stats.total)}
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Daily Average</div>
            <div className="text-base font-extrabold text-slate-200 mt-0.5">
              {currentCfg.format(stats.avg)}
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Peak Value</div>
            <div className="text-base font-extrabold text-emerald-400 mt-0.5">
              {currentCfg.format(stats.max)}
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lowest Value</div>
            <div className="text-base font-extrabold text-slate-400 mt-0.5">
              {currentCfg.format(stats.min)}
            </div>
          </div>
        </div>

        {/* Focused Daily Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <table className="w-full text-left border-collapse text-xs">
              <thead className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-[#1e293b] text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">{currentCfg.label}</th>
                  <th className="py-3 px-4 text-right">DoD Change</th>
                  <th className="py-3 px-4">Adjustment / Notes</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {rows.map((row, idx) => (
                  <tr
                    key={row.date}
                    className={`transition-colors ${
                      isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-300">
                      {row.displayDate}
                    </td>

                    <td className={`py-3 px-4 text-right font-extrabold ${currentCfg.color}`}>
                      {currentCfg.format(row.value)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {idx === 0 ? (
                        <span className="text-slate-500 font-mono">-</span>
                      ) : (
                        <span
                          className={`font-semibold font-mono ${
                            row.dodVal > 0
                              ? 'text-emerald-400'
                              : row.dodVal < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {row.dodVal > 0 ? '+' : ''}
                          {row.dodPct.toFixed(1)}%
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {row.adjustments.length > 0 ? (
                        <div className="space-y-1">
                          {row.adjustments.map((adj) => (
                            <div key={adj.id || adj.adjustment} className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  adj.status === 'Adjusted'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {adj.status || 'Pending'}
                              </span>
                              <span className="truncate max-w-[200px] text-slate-300" title={adj.adjustment}>
                                {adj.adjustment}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No notes</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() =>
                          onOpenAddAdjustment(
                            row.displayDate,
                            pidItem.pid,
                            pidItem.skuName,
                            currentCfg.label,
                            row.value
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all border border-indigo-500/30"
                      >
                        + Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-[#0c1222]' : 'border-slate-100 bg-slate-50'}`}>
          <div className="text-xs text-slate-400">
            Showing only <span className="font-semibold text-slate-200">{currentCfg.label}</span> performance across {dates.length} days.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

