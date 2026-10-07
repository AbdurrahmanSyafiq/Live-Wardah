import React, { useState, useMemo, useEffect } from 'react';
import { parseNum, formatIDR, formatNum } from '@/lib/formatters';
import { parseSheetDate, toYMD } from '@/lib/dateUtils';
import { exportPidPushRankToExcel } from '@/lib/excelExport';
import PidMetricDetailModal, { MetricType } from './PidMetricDetailModal';
import { AddAdjustmentModal, AdjustmentLogsDrawer, AdjustmentLogItem } from './PidAdjustmentModal';

interface PidPushRankTrackerViewProps {
  commerceData: any[];
  categoryData: any[];
  salesData: any[];
  cidData: any[];
  adjustments: any[];
  isDarkMode: boolean;
  onAddAdjustment: (data: any) => Promise<void>;
  onUpdateAdjustmentStatus: (id: string, status: 'Pending' | 'Adjusted', user: string) => Promise<void>;
  onSyncData: () => void;
  isLoading?: boolean;
}

interface DailyRecord {
  date: string;       // YMD
  displayDate: string;// e.g. '1 Sep 2026'
  spend: number;
  adsGmv: number;
  sales: number;
  roas: number;
  cir: number;
}

interface PidItem {
  pid: string;
  skuName: string;
  cluster: string;
  cid: string;
  brand: string;
  platform: string;
  dailyData: Record<string, DailyRecord>;
  totalSpend: number;
  totalAdsGmv: number;
  totalSales: number;
  overallRoas: number;
  overallCir: number;
}

const cleanStr = (v: any) => String(v || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

const formatDisplayDate = (ymd: string): string => {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10);
  const y = parts[0];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1] || ''} ${y}`;
};

export default function PidPushRankTrackerView({
  commerceData,
  categoryData,
  salesData,
  cidData,
  adjustments,
  isDarkMode,
  onAddAdjustment,
  onUpdateAdjustmentStatus,
  onSyncData,
  isLoading = false
}: PidPushRankTrackerViewProps) {
  // Filters State
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [selectedCluster, setSelectedCluster] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'cluster' | 'skuName' | 'pid' | 'spend' | 'adsGmv' | 'sales' | 'roas' | 'cir'>('spend');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Modals State
  const [activeDrilldown, setActiveDrilldown] = useState<{
    pidItem: PidItem | null;
    metric: MetricType;
  } | null>(null);

  const [addAdjustmentModal, setAddAdjustmentModal] = useState<{
    isOpen: boolean;
    data?: {
      date: string;
      pid: string;
      skuName: string;
      metric: string;
      value?: number;
    };
  }>({ isOpen: false });

  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);

  // 1. Build Category / Cluster Map from 'PID CATEGORY'
  const categoryMap = useMemo(() => {
    const map = new Map<string, { cluster: string; skuName?: string; brand?: string; platform?: string }>();
    categoryData.forEach((row) => {
      const pid = cleanStr(row['PID']);
      if (!pid) return;
      const cluster = cleanStr(row['Class​'] || row['Class'] || row['CLASS'] || row['Cluster'] || row['CLUSTER']);
      const skuName = cleanStr(row['Nama Produk​'] || row['Nama Produk'] || row['Product Name']);
      const brand = cleanStr(row['Brand']);
      const platform = cleanStr(row['Platform']);
      map.set(pid, { cluster: cluster || 'Unclassified', skuName, brand, platform });
    });
    return map;
  }, [categoryData]);

  // 2. Build CID Map from 'PID CID' and 'Commerce'
  const cidMap = useMemo(() => {
    const map = new Map<string, string>();
    cidData.forEach((row) => {
      const pid = cleanStr(row['PID']);
      const cid = cleanStr(row['CID']);
      if (pid && cid && !map.has(pid)) {
        map.set(pid, cid);
      }
    });
    return map;
  }, [cidData]);

  // 3. Collect all distinct months and dates available
  const { allAvailableDates, availableMonths } = useMemo(() => {
    const datesSet = new Set<string>();
    const monthsSet = new Set<string>();

    const addDate = (raw: any) => {
      const ymd = toYMD(raw);
      if (ymd && ymd.length === 10 && ymd.startsWith('202')) {
        datesSet.add(ymd);
        monthsSet.add(ymd.slice(0, 7)); // YYYY-MM
      }
    };

    commerceData.forEach((r) => addDate(r['Date']));
    salesData.forEach((r) => addDate(r['Date']));

    const sortedDates = Array.from(datesSet).sort();
    const sortedMonths = Array.from(monthsSet).sort().reverse();
    return { allAvailableDates: sortedDates, availableMonths: sortedMonths };
  }, [commerceData, salesData]);

  // Derive active month without triggering cascading renders in effect
  const activeMonth = useMemo(() => {
    if (selectedMonth) return selectedMonth;
    if (availableMonths.length > 0) {
      const sep = availableMonths.find(m => m.endsWith('-09'));
      return sep || availableMonths[0];
    }
    return '';
  }, [selectedMonth, availableMonths]);

  // Sync date range based on active month or custom
  const activeDates = useMemo(() => {
    if (!activeMonth) return allAvailableDates.slice(-14); // Fallback last 14 days
    if (activeMonth === 'custom' && startDate && endDate) {
      return allAvailableDates.filter(d => d >= startDate && d <= endDate);
    }
    return allAvailableDates.filter(d => d.startsWith(activeMonth));
  }, [allAvailableDates, activeMonth, startDate, endDate]);

  // 4. Aggregate PID Performance Data
  const pidItems = useMemo(() => {
    const pidsMap = new Map<string, {
      pid: string;
      skuName: string;
      cluster: string;
      cid: string;
      brand: string;
      platform: string;
      daily: Map<string, { spend: number; adsGmv: number; sales: number }>;
    }>();

    // Helper to get or init item
    const getOrCreate = (pid: string, defaultSku = '', defaultBrand = '', defaultPlatform = '', defaultCid = '') => {
      let item = pidsMap.get(pid);
      if (!item) {
        const catInfo = categoryMap.get(pid);
        const mappedCid = cidMap.get(pid) || defaultCid;
        item = {
          pid,
          skuName: defaultSku || catInfo?.skuName || 'Product',
          cluster: catInfo?.cluster || 'Unclassified',
          cid: mappedCid || '-',
          brand: catInfo?.brand || defaultBrand || '',
          platform: catInfo?.platform || defaultPlatform || '',
          daily: new Map()
        };
        pidsMap.set(pid, item);
      } else {
        if (!item.skuName || item.skuName === 'Product') {
          if (defaultSku) item.skuName = defaultSku;
        }
        if (!item.cid || item.cid === '-') {
          if (defaultCid) item.cid = defaultCid;
        }
        if (!item.brand && defaultBrand) item.brand = defaultBrand;
        if (!item.platform && defaultPlatform) item.platform = defaultPlatform;
      }
      return item;
    };

    // Pre-populate with all classified PIDs from PID CATEGORY
    categoryData.forEach((row) => {
      const pid = cleanStr(row['PID']);
      if (pid) {
        getOrCreate(
          pid,
          cleanStr(row['Nama Produk​'] || row['Nama Produk']),
          cleanStr(row['Brand']),
          cleanStr(row['Platform'])
        );
      }
    });

    // Populate Commerce Data (Spend, Ads GMV)
    commerceData.forEach((row) => {
      const pid = cleanStr(row['PID']);
      if (!pid) return;

      const dateYmd = toYMD(row['Date']);
      if (!dateYmd) return;

      const exp = parseNum(row['Expense'] || row['Spend'] || row['Cost'] || 0);
      const gmv = parseNum(row['GMV'] || row['Ads GMV'] || 0);
      const skuName = cleanStr(row['SKU Name'] || row['Ad Name'] || row['Product Name']);
      const brand = cleanStr(row['Brand fx'] || row['Brand']);
      const platform = cleanStr(row['Platform']);
      const cid = cleanStr(row['PID / CID'] || row['CID']);

      const item = getOrCreate(pid, skuName, brand, platform, cid);
      let dayRec = item.daily.get(dateYmd);
      if (!dayRec) {
        dayRec = { spend: 0, adsGmv: 0, sales: 0 };
        item.daily.set(dateYmd, dayRec);
      }
      dayRec.spend += exp;
      dayRec.adsGmv += gmv;
    });

    // Populate PID SALES Data
    salesData.forEach((row) => {
      const pid = cleanStr(row['PID']);
      if (!pid) return;

      const dateYmd = toYMD(row['Date']);
      if (!dateYmd) return;

      const sales = parseNum(row['Sales'] || 0);
      const brand = cleanStr(row['Brand']);

      const item = getOrCreate(pid, '', brand, '');
      let dayRec = item.daily.get(dateYmd);
      if (!dayRec) {
        dayRec = { spend: 0, adsGmv: 0, sales: 0 };
        item.daily.set(dateYmd, dayRec);
      }
      dayRec.sales += sales;
    });

    // Convert into final array of PidItem
    const result: PidItem[] = [];
    pidsMap.forEach((val) => {
      const dailyData: Record<string, DailyRecord> = {};
      let totalSpend = 0;
      let totalAdsGmv = 0;
      let totalSales = 0;

      activeDates.forEach((d) => {
        const dRec = val.daily.get(d) || { spend: 0, adsGmv: 0, sales: 0 };
        const spend = dRec.spend;
        const adsGmv = dRec.adsGmv;
        const sales = dRec.sales;

        // Formula: ROAS = Ads GMV / Spend
        const roas = spend > 0 ? adsGmv / spend : 0;
        // Formula: CIR = Spend / Ads GMV * 100% (or Spend / Sales if user prefers, matching screenshot 100k/2.694M = 3.71%)
        const cir = adsGmv > 0 ? (spend / adsGmv) * 100 : 0;

        totalSpend += spend;
        totalAdsGmv += adsGmv;
        totalSales += sales;

        dailyData[d] = {
          date: d,
          displayDate: formatDisplayDate(d),
          spend,
          adsGmv,
          sales,
          roas,
          cir
        };
      });

      const overallRoas = totalSpend > 0 ? totalAdsGmv / totalSpend : 0;
      const overallCir = totalAdsGmv > 0 ? (totalSpend / totalAdsGmv) * 100 : 0;

      result.push({
        pid: val.pid,
        skuName: val.skuName,
        cluster: val.cluster,
        cid: val.cid,
        brand: val.brand,
        platform: val.platform,
        dailyData,
        totalSpend,
        totalAdsGmv,
        totalSales,
        overallRoas,
        overallCir
      });
    });

    return result;
  }, [categoryData, categoryMap, cidMap, commerceData, salesData, activeDates]);

  // Filter options
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    pidItems.forEach((i) => { if (i.brand) set.add(i.brand.trim()); });
    return ['All', ...Array.from(set).sort()];
  }, [pidItems]);

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    pidItems.forEach((i) => { if (i.platform) set.add(i.platform.trim()); });
    return ['All', ...Array.from(set).sort()];
  }, [pidItems]);

  const clusterOptions = useMemo(() => {
    const set = new Set<string>();
    pidItems.forEach((i) => { if (i.cluster) set.add(i.cluster.trim()); });
    return ['All', ...Array.from(set).sort()];
  }, [pidItems]);

  // Apply Filter and Sorting
  const filteredItems = useMemo(() => {
    let list = pidItems;

    if (selectedBrand !== 'All') {
      const b = selectedBrand.toLowerCase();
      list = list.filter((i) => i.brand.toLowerCase().includes(b));
    }

    if (selectedPlatform !== 'All') {
      const p = selectedPlatform.toLowerCase();
      list = list.filter((i) => i.platform.toLowerCase().includes(p));
    }

    if (selectedCluster !== 'All') {
      const c = selectedCluster.toLowerCase();
      list = list.filter((i) => i.cluster.toLowerCase() === c);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (i) =>
          i.pid.toLowerCase().includes(q) ||
          i.skuName.toLowerCase().includes(q) ||
          i.cid.toLowerCase().includes(q) ||
          i.cluster.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (sortField === 'cluster' || sortField === 'skuName' || sortField === 'pid') {
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      let diff = 0;
      if (sortField === 'spend') diff = a.totalSpend - b.totalSpend;
      else if (sortField === 'adsGmv') diff = a.totalAdsGmv - b.totalAdsGmv;
      else if (sortField === 'sales') diff = a.totalSales - b.totalSales;
      else if (sortField === 'roas') diff = a.overallRoas - b.overallRoas;
      else if (sortField === 'cir') diff = a.overallCir - b.overallCir;

      return sortAsc ? diff : -diff;
    });
  }, [pidItems, selectedBrand, selectedPlatform, selectedCluster, searchTerm, sortField, sortAsc]);

  // Overall KPI Cards Summary
  const summaryKPIs = useMemo(() => {
    const totalSpend = filteredItems.reduce((acc, i) => acc + i.totalSpend, 0);
    const totalAdsGmv = filteredItems.reduce((acc, i) => acc + i.totalAdsGmv, 0);
    const totalSales = filteredItems.reduce((acc, i) => acc + i.totalSales, 0);
    const overallRoas = totalSpend > 0 ? totalAdsGmv / totalSpend : 0;
    const overallCir = totalAdsGmv > 0 ? (totalSpend / totalAdsGmv) * 100 : 0;
    return {
      totalPids: filteredItems.length,
      totalSpend,
      totalAdsGmv,
      totalSales,
      overallRoas,
      overallCir
    };
  }, [filteredItems]);

  // Paginated Items
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredItems.slice(start, start + PER_PAGE);
  }, [filteredItems, page]);

  const totalPages = Math.ceil(filteredItems.length / PER_PAGE) || 1;

  // Pending adjustments count
  const pendingAdjustmentsCount = useMemo(() => {
    return adjustments.filter((a) => a.status !== 'Adjusted').length;
  }, [adjustments]);

  // Helper to check if PID + Date has adjustment
  const getAdjustment = (pid: string, displayDate: string, ymd: string) => {
    return adjustments.find(
      (a) => a.pid === pid && (a.date === displayDate || a.date === ymd)
    );
  };

  const handleExportExcel = async () => {
    const displayDatesMap: Record<string, string> = {};
    activeDates.forEach((d) => {
      displayDatesMap[d] = formatDisplayDate(d);
    });
    const periodLabel = selectedMonth === 'custom' ? `${startDate}_to_${endDate}` : selectedMonth || 'Period';
    await exportPidPushRankToExcel(filteredItems, activeDates, displayDatesMap, periodLabel);
  };

  const getClusterBadgeStyle = (cluster: string) => {
    const c = cluster.toUpperCase();
    if (c.includes('SCALE')) {
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
    if (c.includes('REVIEW')) {
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
    if (c.includes('HIDDEN')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (c.includes('KILL') || c.includes('DROP')) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Controls Bar */}
      <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
              <div>
                <h1 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  PID Push Rank Tracker
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cross-examine daily Spend, Ads GMV, Sales, ROAS, and CIR with cluster ranking and live operational adjustment logs.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsLogsDrawerOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border-indigo-500/30 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Adjustment Logs
              {pendingAdjustmentsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  {pendingAdjustmentsCount} Pending
                </span>
              )}
            </button>

            <button
              onClick={() => setAddAdjustmentModal({ isOpen: true })}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              New Adjustment
            </button>

            <button
              onClick={handleExportExcel}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                isDarkMode
                  ? 'bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export Excel
            </button>

            <button
              onClick={onSyncData}
              disabled={isLoading}
              title="Sync fresh data from Google Sheets"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700 shrink-0"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>

        {/* 2. Filter Bar Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {/* Month / Date Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Active Period
            </label>
            <select
              value={activeMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {availableMonths.map((m) => {
                const parts = m.split('-');
                const label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Platform
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => { setSelectedPlatform(e.target.value); setPage(1); }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Cluster / Class Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Cluster / Class
            </label>
            <select
              value={selectedCluster}
              onChange={(e) => { setSelectedCluster(e.target.value); setPage(1); }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {clusterOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Search PID / SKU
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className={`w-full py-2 px-3 pl-8 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total PIDs</div>
          <div className="text-xl font-black mt-1 text-slate-200">{summaryKPIs.totalPids}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{activeDates.length} Days Tracking</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider">Total Spend</div>
          <div className="text-xl font-black mt-1 text-amber-400">{formatIDR(summaryKPIs.totalSpend)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Commerce Expense</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-wider">Total Ads GMV</div>
          <div className="text-xl font-black mt-1 text-indigo-400">{formatIDR(summaryKPIs.totalAdsGmv)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Paid Advertising</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">Total Sales</div>
          <div className="text-xl font-black mt-1 text-emerald-400">{formatIDR(summaryKPIs.totalSales)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">PID Sales Sheet</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="text-[10px] font-bold text-blue-400/80 uppercase tracking-wider">Blended ROAS</div>
          <div className="text-xl font-black mt-1 text-blue-400">
            {summaryKPIs.overallRoas > 0 ? `${summaryKPIs.overallRoas.toFixed(2)}x` : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ads GMV / Spend</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="text-[10px] font-bold text-rose-400/80 uppercase tracking-wider">Blended CIR</div>
          <div className="text-xl font-black mt-1 text-rose-400">
            {summaryKPIs.overallCir > 0 ? `${summaryKPIs.overallCir.toFixed(2)}%` : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Spend / Ads GMV</div>
        </div>
      </div>

      {/* 4. Tracking Result Table (Exact Matching User Image) */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            {/* Top Multi-level Header */}
            <thead className={`sticky top-0 z-30 font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-[#090d16] text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
              {/* Row 1: Left fixed blanks/titles + Merged Date Headers */}
              <tr className="border-b border-slate-800">
                <th
                  onClick={() => handleSort('cluster')}
                  className="py-3 px-3 min-w-[130px] border-r border-slate-800 sticky left-0 z-40 bg-inherit cursor-pointer hover:text-indigo-400 select-none"
                >
                  Cluster {sortField === 'cluster' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="py-3 px-3 min-w-[140px] border-r border-slate-800 sticky left-[130px] z-40 bg-inherit">
                  CID
                </th>
                <th
                  onClick={() => handleSort('skuName')}
                  className="py-3 px-4 min-w-[260px] max-w-[320px] border-r border-slate-800 sticky left-[270px] z-40 bg-inherit cursor-pointer hover:text-indigo-400 select-none"
                >
                  SKU Name {sortField === 'skuName' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('pid')}
                  className="py-3 px-3 min-w-[150px] border-r-2 border-indigo-500/50 sticky left-[550px] z-40 bg-inherit cursor-pointer hover:text-indigo-400 select-none"
                >
                  PID {sortField === 'pid' ? (sortAsc ? '▲' : '▼') : ''}
                </th>

                {/* Date Columns headers spanning 5 subcolumns each */}
                {activeDates.map((dateStr) => (
                  <th
                    key={dateStr}
                    colSpan={5}
                    className="py-2.5 px-3 text-center border-r border-slate-800 bg-slate-900/80 font-black tracking-wide text-indigo-300"
                  >
                    {formatDisplayDate(dateStr)}
                  </th>
                ))}
              </tr>

              {/* Row 2: Sub-columns (Spend, Ads GMV, Sales, ROAS, CIR) for each day */}
              <tr className="border-b border-slate-800 text-[10px] text-slate-400">
                <th className="py-2 px-3 border-r border-slate-800 sticky left-0 z-40 bg-inherit"></th>
                <th className="py-2 px-3 border-r border-slate-800 sticky left-[130px] z-40 bg-inherit"></th>
                <th className="py-2 px-4 border-r border-slate-800 sticky left-[270px] z-40 bg-inherit"></th>
                <th className="py-2 px-3 border-r-2 border-indigo-500/50 sticky left-[550px] z-40 bg-inherit"></th>

                {activeDates.map((dateStr) => (
                  <React.Fragment key={`sub-${dateStr}`}>
                    <th className="py-2 px-2.5 text-right font-bold text-amber-400 min-w-[85px] border-r border-slate-800/60">
                      Spend
                    </th>
                    <th className="py-2 px-2.5 text-right font-bold text-indigo-400 min-w-[95px] border-r border-slate-800/60">
                      Ads GMV
                    </th>
                    <th className="py-2 px-2.5 text-right font-bold text-emerald-400 min-w-[95px] border-r border-slate-800/60">
                      Sales
                    </th>
                    <th className="py-2 px-2 text-right font-bold text-blue-400 min-w-[65px] border-r border-slate-800/60">
                      ROAS
                    </th>
                    <th className="py-2 px-2 text-right font-bold text-rose-400 min-w-[65px] border-r border-slate-800">
                      CIR
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
              {paginatedItems.map((item) => (
                <tr
                  key={item.pid}
                  className={`group transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800/40 bg-[#0b101c]' : 'hover:bg-slate-50 bg-white'
                  }`}
                >
                  {/* Sticky Column: Cluster */}
                  <td className="py-3 px-3 border-r border-slate-800 sticky left-0 z-20 bg-inherit">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border truncate max-w-[120px] ${getClusterBadgeStyle(
                        item.cluster
                      )}`}
                      title={item.cluster}
                    >
                      {item.cluster}
                    </span>
                  </td>

                  {/* Sticky Column: CID */}
                  <td className="py-3 px-3 border-r border-slate-800 font-mono text-[11px] text-slate-400 sticky left-[130px] z-20 bg-inherit select-all">
                    {item.cid || '-'}
                  </td>

                  {/* Sticky Column: SKU Name */}
                  <td
                    className="py-3 px-4 border-r border-slate-800 sticky left-[270px] z-20 bg-inherit max-w-[280px]"
                    title={item.skuName}
                  >
                    <div className="font-semibold text-slate-200 truncate leading-snug">
                      {item.skuName}
                    </div>
                    {item.brand && (
                      <span className="text-[10px] text-slate-400 font-medium">{item.brand}</span>
                    )}
                  </td>

                  {/* Sticky Column: PID */}
                  <td className="py-3 px-3 border-r-2 border-indigo-500/50 font-mono text-[11px] text-indigo-300 font-bold sticky left-[550px] z-20 bg-inherit select-all">
                    {item.pid}
                  </td>

                  {/* Daily Metric Cells */}
                  {activeDates.map((dateStr) => {
                    const rec = item.dailyData[dateStr] || {
                      date: dateStr,
                      displayDate: formatDisplayDate(dateStr),
                      spend: 0,
                      adsGmv: 0,
                      sales: 0,
                      roas: 0,
                      cir: 0
                    };

                    const adj = getAdjustment(item.pid, rec.displayDate, dateStr);

                    return (
                      <React.Fragment key={`cell-${item.pid}-${dateStr}`}>
                        {/* Spend Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'spend' })}
                          className="py-2.5 px-2.5 text-right font-mono border-r border-slate-800/60 cursor-pointer hover:bg-amber-500/15 transition-colors relative group/cell"
                          title="Click to view full Spend history"
                        >
                          <span className={rec.spend > 0 ? 'text-slate-200 font-semibold' : 'text-slate-600'}>
                            {formatNum(rec.spend)}
                          </span>
                          {adj && adj.metric === 'Spend' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                        </td>

                        {/* Ads GMV Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'adsGmv' })}
                          className="py-2.5 px-2.5 text-right font-mono border-r border-slate-800/60 cursor-pointer hover:bg-indigo-500/15 transition-colors relative group/cell"
                          title="Click to view full Ads GMV history"
                        >
                          <span className={rec.adsGmv > 0 ? 'text-indigo-200 font-semibold' : 'text-slate-600'}>
                            {formatNum(rec.adsGmv)}
                          </span>
                          {adj && adj.metric === 'Ads GMV' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          )}
                        </td>

                        {/* Sales Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'sales' })}
                          className="py-2.5 px-2.5 text-right font-mono border-r border-slate-800/60 cursor-pointer hover:bg-emerald-500/15 transition-colors relative group/cell"
                          title="Click to view full Sales history"
                        >
                          <span className={rec.sales > 0 ? 'text-emerald-300 font-semibold' : 'text-slate-600'}>
                            {formatNum(rec.sales)}
                          </span>
                          {adj && adj.metric === 'Sales' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </td>

                        {/* ROAS Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'roas' })}
                          className="py-2.5 px-2 text-right font-mono border-r border-slate-800/60 cursor-pointer hover:bg-blue-500/15 transition-colors"
                          title="Click to view full ROAS history"
                        >
                          <span className={rec.roas > 0 ? 'text-blue-300 font-semibold' : 'text-slate-600'}>
                            {rec.roas > 0 ? rec.roas.toFixed(2) : '-'}
                          </span>
                        </td>

                        {/* CIR Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'cir' })}
                          className="py-2.5 px-2 text-right font-mono border-r border-slate-800 cursor-pointer hover:bg-rose-500/15 transition-colors"
                          title="Click to view full CIR history"
                        >
                          <span className={rec.cir > 0 ? 'text-rose-300 font-semibold' : 'text-slate-600'}>
                            {rec.cir > 0 ? `${rec.cir.toFixed(2)}%` : '-'}
                          </span>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination & Table Footer */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 ${isDarkMode ? 'border-slate-800 bg-[#090d16]' : 'border-slate-100 bg-slate-50'}`}>
          <div className="text-xs text-slate-400">
            Showing <span className="font-bold text-slate-200">{paginatedItems.length}</span> of <span className="font-bold text-slate-200">{filteredItems.length}</span> PIDs.
            <span className="ml-2 text-slate-500">(Click any daily metric number to inspect its isolated timeline)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-bold px-2 text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 6. Drilldown Single-Metric Modal */}
      {activeDrilldown && (
        <PidMetricDetailModal
          isOpen={true}
          onClose={() => setActiveDrilldown(null)}
          pidItem={activeDrilldown.pidItem}
          initialMetric={activeDrilldown.metric}
          dates={activeDates}
          isDarkMode={isDarkMode}
          adjustments={adjustments}
          onOpenAddAdjustment={(date, pid, skuName, metric, value) => {
            setAddAdjustmentModal({
              isOpen: true,
              data: { date, pid, skuName, metric, value }
            });
          }}
        />
      )}

      {/* 7. Add Adjustment Modal */}
      <AddAdjustmentModal
        isOpen={addAdjustmentModal.isOpen}
        onClose={() => setAddAdjustmentModal({ isOpen: false })}
        initialData={addAdjustmentModal.data}
        onSubmit={onAddAdjustment}
        isDarkMode={isDarkMode}
      />

      {/* 8. Adjustment Logs Drawer */}
      <AdjustmentLogsDrawer
        isOpen={isLogsDrawerOpen}
        onClose={() => setIsLogsDrawerOpen(false)}
        logs={adjustments}
        onUpdateStatus={onUpdateAdjustmentStatus}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

