import React from 'react';
import { CONFIG, selectClass, dateClass, dateClassDark } from '@/lib/config';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  currentView: 'login' | 'welcome' | 'home' | 'dashboard';
  activeEngine: 'media' | 'commerce' | 'creative' | 'signal' | 'sku' | 'pidRank' | null;
  onSelectHome: () => void;
  onSelectEngine: (engine: 'media' | 'commerce' | 'creative' | 'signal' | 'sku' | 'pidRank') => void;
  isDarkMode: boolean;
  granularity: string;
  setGranularity: (v: string) => void;
  dateMonth: string;
  setDateMonth: (v: string) => void;
  dateWeekly: string;
  setDateWeekly: (v: string) => void;
  dateDailyStart: string;
  setDateDailyStart: (v: string) => void;
  dateDailyEnd: string;
  setDateDailyEnd: (v: string) => void;
  homeBrand: string;
  setHomeBrand: (v: string) => void;
  homeBrandOptions: string[];
  homePeriods: string[];
  availableHomeMonths: string[];
  onToggleHomeMonth: (m: string) => void;
  onSyncHomeData: () => void;
  selectedSignalPeriod: string;
  setSelectedSignalPeriod: (v: string) => void;
  signalPeriods: { key: string; start: string; end: string; label: string }[];
  filters: any;
  onFilterChange: (k: string, v: string) => void;
  onResetFilters: () => void;
  getDependentOptions: (col: string, exclude: string) => string[];
  onSyncLiveData: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const {
    isSidebarOpen, setIsSidebarOpen, currentView, activeEngine,
    onSelectHome, onSelectEngine, isDarkMode, granularity, setGranularity,
    dateMonth, setDateMonth, dateWeekly, setDateWeekly, dateDailyStart,
    setDateDailyStart, dateDailyEnd, setDateDailyEnd, homeBrand, setHomeBrand,
    homeBrandOptions, homePeriods, availableHomeMonths, onToggleHomeMonth,
    onSyncHomeData, selectedSignalPeriod, setSelectedSignalPeriod, signalPeriods,
    filters, onFilterChange, onResetFilters, getDependentOptions, onSyncLiveData
  } = props;

  return (
    <aside className={`${isSidebarOpen ? 'w-[280px]' : 'w-[72px]'} bg-[#090d16] border-r border-slate-800/80 h-screen sticky top-0 overflow-y-auto overflow-x-hidden flex-shrink-0 transition-all duration-300 ease-in-out z-40 text-slate-300 flex flex-col`}>
      <div className={`h-20 border-b border-slate-800/80 flex items-center bg-[#090d16] sticky top-0 z-20 transition-all ${isSidebarOpen ? 'px-5 justify-between' : 'justify-center px-0'}`}>
        {isSidebarOpen ? (
          <>
            <div className="flex flex-col justify-center overflow-hidden">
              <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">PC Brands</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">All in One Tracker</p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Collapse sidebar"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Expand sidebar"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        )}
      </div>

      <div className="pt-4 pb-4 px-2 space-y-1 border-b border-slate-800/80">
        {isSidebarOpen ? (
          <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 transition-opacity">Workspaces</p>
        ) : (
          <div className="w-8 h-[1px] bg-slate-800 mx-auto my-2" />
        )}

        <button onClick={onSelectHome} title="General Overview" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${currentView === 'home' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l9-9 9 9M5 10v10h14V10M9 20v-6h6v6"></path></svg>
          {isSidebarOpen && <span className="truncate">General Overview</span>}
        </button>

        <button onClick={() => onSelectEngine('media')} title="Digital Media" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${activeEngine === 'media' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          {isSidebarOpen && <span className="truncate">Digital Media</span>}
        </button>

        <button onClick={() => onSelectEngine('commerce')} title="Commerce Tracker" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${activeEngine === 'commerce' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          {isSidebarOpen && <span className="truncate">Commerce Tracker</span>}
        </button>

        <button onClick={() => onSelectEngine('sku')} title="PID & SKU Performance" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${activeEngine === 'sku' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          {isSidebarOpen && <span className="truncate">PID & SKU Analytics</span>}
        </button>

        <button onClick={() => onSelectEngine('pidRank')} title="PID Push Rank Tracker" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${activeEngine === 'pidRank' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          {isSidebarOpen && <span className="truncate">PID Push Rank Tracker</span>}
        </button>

        <button onClick={() => onSelectEngine('creative')} title="Top Creative" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${activeEngine === 'creative' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {isSidebarOpen && <span className="truncate">Top Creative</span>}
        </button>

        <button onClick={() => onSelectEngine('signal')} title="Media Signal" className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${activeEngine === 'signal' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'}`}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          {isSidebarOpen && <span className="truncate">Media Signal</span>}
        </button>
      </div>

      {isSidebarOpen && (
        <div className="p-4 space-y-4 flex-1">
          <p className="px-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Filters</p>

          {currentView !== 'home' && activeEngine !== 'creative' && activeEngine !== 'signal' && (
            <div className="bg-[#111827] p-3 rounded-2xl border border-slate-800 space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-400">Date Range</label>
                <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="bg-transparent text-indigo-400 text-xs font-bold outline-none cursor-pointer appearance-none pr-6 text-right dropdown-arrow bg-[length:10px_10px] bg-[position:right_center]">
                  <option value="monthly">Monthly</option><option value="weekly">Weekly MTD</option><option value="daily">Daily</option>
                </select>
              </div>
              {granularity === 'monthly' && <input type="month" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} className={isDarkMode ? dateClassDark : dateClass} />}
              {granularity === 'weekly' && <input type="date" value={dateWeekly} onChange={(e) => setDateWeekly(e.target.value)} className={isDarkMode ? dateClassDark : dateClass} />}
              {granularity === 'daily' && (
                <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center w-full">
                  <input type="date" value={dateDailyStart} onChange={(e) => setDateDailyStart(e.target.value)} className={`${isDarkMode ? dateClassDark : dateClass} !px-1 !text-xs w-full min-w-0`} />
                  <span className="text-slate-500 font-bold text-center">-</span>
                  <input type="date" value={dateDailyEnd} onChange={(e) => setDateDailyEnd(e.target.value)} className={`${isDarkMode ? dateClassDark : dateClass} !px-1 !text-xs w-full min-w-0`} />
                </div>
              )}
            </div>
          )}

          {currentView === 'home' && (
            <div className="bg-[#111827] p-3.5 rounded-2xl border border-slate-800 space-y-3 shadow-inner">
              <label className="block text-xs font-bold text-slate-400">Home Filters</label>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Brand</span>
                <select value={homeBrand} onChange={(e) => setHomeBrand(e.target.value)} className={selectClass}>
                  {homeBrandOptions.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-slate-400 font-bold">Select Months</span>
                  <span className="text-[10px] text-indigo-400 font-semibold">{homePeriods.length} selected</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-[#090d16] p-2 rounded-xl border border-slate-800">
                  {availableHomeMonths.map(m => {
                    const isSelected = homePeriods.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onToggleHomeMonth(m)}
                        className={`w-full text-left px-2 py-1 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span>{m}</span>
                        {isSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={onSyncHomeData} className="w-full bg-[#1e293b] hover:bg-indigo-600 text-white font-bold py-2 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all text-xs">Sync Home Data</button>
            </div>
          )}

          {activeEngine === 'signal' && (
            <div className="space-y-3 px-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Period Range</label>
                <select value={selectedSignalPeriod} onChange={(e) => setSelectedSignalPeriod(e.target.value)} className={selectClass}>
                  {signalPeriods.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {currentView !== 'home' && (
            <div className="space-y-3 px-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Brand</label>
                <select value={filters.brand} onChange={(e) => onFilterChange('brand', e.target.value)} className={selectClass}>
                  {getDependentOptions(CONFIG[activeEngine === 'sku' ? 'commerce' : (activeEngine || 'media')].colBrand, 'brand').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {activeEngine === 'media' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Funnel</label>
                  <select value={filters.funnel} onChange={(e) => onFilterChange('funnel', e.target.value)} className={selectClass}>
                    {getDependentOptions(CONFIG.media.colFunnel, 'funnel').map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
              {(activeEngine === 'commerce' || activeEngine === 'creative') && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Ad Type</label>
                  <select value={filters.adType} onChange={(e) => onFilterChange('adType', e.target.value)} className={selectClass}>
                    {getDependentOptions(CONFIG[activeEngine === 'commerce' ? 'commerce' : 'creative'].colAdType, 'adType').map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
              {activeEngine === 'creative' && (
                <>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1.5">Period</label><select value={filters.period} onChange={(e) => onFilterChange('period', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colPeriod, 'period').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1.5">Platform</label><select value={filters.platform} onChange={(e) => onFilterChange('platform', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colPlatform, 'platform').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1.5">Format</label><select value={filters.format} onChange={(e) => onFilterChange('format', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colFormat, 'format').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                </>
              )}
              <button onClick={onResetFilters} className="w-full border border-slate-600 text-slate-300 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white font-bold py-2 rounded-xl transition-all text-xs">Reset Filters</button>
            </div>
          )}
        </div>
      )}

      {isSidebarOpen && (
        <div className="p-4 bg-[#090d16] border-t border-slate-800/80 mt-auto">
          <button onClick={onSyncLiveData} className="w-full bg-[#1e293b] hover:bg-indigo-600 text-white font-bold py-3 rounded-xl border border-slate-700 hover:border-indigo-500 shadow-md transition-all flex justify-center items-center gap-2 text-xs tracking-wide">Sync Live Data</button>
        </div>
      )}
    </aside>
  );
}