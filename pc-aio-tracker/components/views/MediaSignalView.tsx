import React from 'react';
import { formatIDR, formatNum, formatPct, renderGR, parseNum } from '@/lib/formatters';
import { parseSheetDate, toYMD } from '@/lib/dateUtils';
import { exportMediaSignalToExcel } from '@/lib/excelExport';

interface MediaSignalViewProps {
  signalCompiled: any;
  signalHierarchyGroups: any[];
  rawData: any[];
  extraSheetsData: { mediaApi: any[]; commerce: any[] };
  isDarkMode: boolean;
}

export default function MediaSignalView({
  signalCompiled,
  signalHierarchyGroups,
  rawData,
  extraSheetsData,
  isDarkMode
}: MediaSignalViewProps) {
  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-indigo-600 p-5 rounded-3xl text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Total Ad Spend</p>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-black">{formatIDR(signalCompiled.actual?.totalSpend || 0)}</h3>
            {signalCompiled.prev && renderGR(signalCompiled.actual?.totalSpend || 0, signalCompiled.prev.totalSpend, false, isDarkMode)}
          </div>
          <div className="flex justify-between text-xs mb-1.5 opacity-90 font-medium">
            <span>Plan: {formatIDR(signalCompiled.plan?.totalSpend || 0)}</span>
            <span>{formatPct(signalCompiled.computeAch(signalCompiled.actual?.totalSpend || 0, signalCompiled.plan?.totalSpend || 0))}</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-300 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, signalCompiled.computeAch(signalCompiled.actual?.totalSpend || 0, signalCompiled.plan?.totalSpend || 0) * 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-800 p-5 rounded-3xl text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Impressions</p>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-black">{formatNum(signalCompiled.actual?.impressions || 0)}</h3>
            {signalCompiled.prev && renderGR(signalCompiled.actual?.impressions || 0, signalCompiled.prev.impressions, false, isDarkMode)}
          </div>
          <div className="flex justify-between text-xs mb-1.5 opacity-90 font-medium">
            <span>Plan: {formatNum(signalCompiled.plan?.impressions || 0)}</span>
            <span>{formatPct(signalCompiled.computeAch(signalCompiled.actual?.impressions || 0, signalCompiled.plan?.impressions || 0))}</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, signalCompiled.computeAch(signalCompiled.actual?.impressions || 0, signalCompiled.plan?.impressions || 0) * 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-teal-700 p-5 rounded-3xl text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-200 mb-1">Total Engagements</p>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-black">{formatNum(signalCompiled.actual?.engagements || 0)}</h3>
            {signalCompiled.prev && renderGR(signalCompiled.actual?.engagements || 0, signalCompiled.prev.engagements, false, isDarkMode)}
          </div>
          <div className="flex justify-between text-xs mb-1.5 opacity-90 font-medium">
            <span>Plan: {formatNum(signalCompiled.plan?.engagements || 0)}</span>
            <span>{formatPct(signalCompiled.computeAch(signalCompiled.actual?.engagements || 0, signalCompiled.plan?.engagements || 0))}</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-300 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, signalCompiled.computeAch(signalCompiled.actual?.engagements || 0, signalCompiled.plan?.engagements || 0) * 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-emerald-600 p-5 rounded-3xl text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">GMV Ads</p>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-black">{formatIDR(signalCompiled.actual?.gmvAds || 0)}</h3>
            {signalCompiled.prev && renderGR(signalCompiled.actual?.gmvAds || 0, signalCompiled.prev.gmvAds, false, isDarkMode)}
          </div>
          <div className="flex justify-between text-xs mb-1.5 opacity-90 font-medium">
            <span>Plan: {formatIDR(signalCompiled.plan?.gmvAds || 0)}</span>
            <span>{formatPct(signalCompiled.computeAch(signalCompiled.actual?.gmvAds || 0, signalCompiled.plan?.gmvAds || 0))}</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-white h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, signalCompiled.computeAch(signalCompiled.actual?.gmvAds || 0, signalCompiled.plan?.gmvAds || 0) * 100)}%` }}></div>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-2">
          <div>
            <h2 className="text-lg font-black tracking-tight">TikTok Media Signal Matrix (MTD Achievement & Growth)</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Viewing: {signalCompiled.currentPeriod.start} to {signalCompiled.currentPeriod.end} 
              {signalCompiled.prevPeriod ? ` (compared with ${signalCompiled.prevPeriod.start} to ${signalCompiled.prevPeriod.end})` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              void exportMediaSignalToExcel({
                rawData,
                extraSheetsData,
                selectedPeriod: signalCompiled.currentPeriod,
                parseNum,
                parseSheetDate,
                toYMD
              });
            }}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export All Brands (.xlsx)
          </button>
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead>
              <tr className={`border-b text-xs font-black uppercase tracking-wider ${isDarkMode ? 'border-slate-700 text-slate-400 bg-slate-900/60' : 'border-slate-200 text-slate-500 bg-slate-100/60'}`}>
                <th className="py-3.5 px-4 text-left w-1/4 min-w-[220px]">Metrics</th>
                <th className="py-3.5 px-4 text-right w-36 min-w-[120px]">Actual (MTD)</th>
                <th className="py-3.5 px-4 text-right w-36 min-w-[120px]">Plan Target</th>
                <th className="py-3.5 px-6 text-center w-48 min-w-[160px]">Target Progress</th>
                <th className="py-3.5 px-4 text-right w-24 min-w-[90px]">% Ach</th>
                <th className="py-3.5 px-4 text-right w-36 min-w-[120px]">Prev Period</th>
                <th className="py-3.5 px-4 text-right w-32 min-w-[110px]">MoM Growth</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
              {signalHierarchyGroups.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  <tr className={isDarkMode ? 'bg-slate-900/90' : 'bg-slate-100/80'}>
                    <td colSpan={7} className="py-2.5 px-4 font-black uppercase text-xs tracking-wider text-indigo-400 border-t-2 border-slate-700/60">
                      {group.category}
                    </td>
                  </tr>
                  {group.rows.map((row: any, rIdx: number) => {
                    const actVal = Number(row.act) || 0;
                    const plnVal = Number(row.pln) || 0;
                    const prvVal = Number(row.prv) || 0;
                    const ach = signalCompiled.computeAch(actVal, plnVal);
                    const pctWidth = Math.min(100, Math.max(0, ach * 100));

                    return (
                      <tr key={rIdx} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                        <td className="py-3 px-4 font-medium text-left">{row.name}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{row.fmt(actVal)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">{plnVal > 0 ? row.fmt(plnVal) : '-'}</td>
                        <td className="py-3 px-6 text-center">
                          {plnVal > 0 ? (
                            <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 ${isDarkMode ? 'bg-slate-700/60' : 'bg-slate-200'}`}>
                              <div className={`h-full rounded-full transition-all duration-700 ease-out ${ach >= 1 ? 'bg-emerald-400' : 'bg-indigo-500'}`} style={{ width: `${pctWidth}%` }}></div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic block text-center">No Target</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {plnVal > 0 ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${ach >= 1 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700/40 text-slate-300'}`}>
                              {formatPct(ach)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">{signalCompiled.prevPeriod ? row.fmt(prvVal) : '-'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {signalCompiled.prevPeriod ? renderGR(actVal, prvVal, row.isInv, isDarkMode) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}