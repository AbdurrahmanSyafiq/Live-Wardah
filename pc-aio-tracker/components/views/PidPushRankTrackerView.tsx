import React, { useState, useMemo } from 'react';
import { parseNum, formatNum } from '@/lib/formatters';
import { toYMD } from '@/lib/dateUtils';
import { exportPidPushRankToExcel } from '@/lib/excelExport';
import PidMetricDetailModal, { MetricType } from './PidMetricDetailModal';
import { AddAdjustmentModal, AdjustmentLogsDrawer } from './PidAdjustmentModal';

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
  const [startDate] = useState('');
  const [endDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'cluster' | 'skuName' | 'pid' | 'spend' | 'adsGmv' | 'sales' | 'roas' | 'cir'>('spend');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

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

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

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
    if (!activeMonth) return allAvailableDates.slice(-14);
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

        const roas = spend > 0 ? adsGmv / spend : 0;
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

  // Summary KPIs
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

  // Check if PID + Date has adjustment
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
    const periodLabel = activeMonth || 'Period';
    await exportPidPushRankToExcel(filteredItems, activeDates, displayDatesMap, periodLabel);
  };

  // High contrast color classes
  const mainText = isDarkMode ? 'text-slate-100' : 'text-slate-900';
  const secText = isDarkMode ? 'text-slate-400' : 'text-slate-700';
  const borderCol = isDarkMode ? 'border-slate-800' : 'border-slate-300';
  const cardBg = isDarkMode ? 'bg-[#0f172a]' : 'bg-white';
  const tableHeaderTopBg = isDarkMode ? 'bg-[#182338]' : 'bg-slate-200';
  const tableHeaderSubBg = isDarkMode ? 'bg-[#101827]' : 'bg-slate-100';
  const tableFreezeBg = isDarkMode ? 'bg-[#0f172a]' : 'bg-white';
  const tableFreezeHoverBg = isDarkMode ? 'group-hover:bg-[#1a253a]' : 'group-hover:bg-slate-100';
  const tableRowHoverBg = isDarkMode ? 'hover:bg-[#131d33]' : 'hover:bg-slate-50';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Controls Bar */}
      <div className={`p-6 rounded-2xl border ${borderCol} ${cardBg} shadow-sm space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            <div>
              <h1 className={`text-xl font-black tracking-tight ${mainText}`}>
                PID Push Rank Tracker
              </h1>
              <p className={`text-xs ${secText} mt-0.5`}>
                Cross-examine daily Spend, Ads GMV, Sales, ROAS, and CIR with cluster ranking and live operational adjustment logs.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsLogsDrawerOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm ${
                isDarkMode
                  ? 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-600 hover:text-white border-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-600 hover:text-white border-indigo-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Adjustment
            </button>

            <button
              onClick={handleExportExcel}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200 border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>

            <button
              onClick={onSyncData}
              disabled={isLoading}
              title="Sync fresh data from Google Sheets"
              className={`p-2 rounded-xl border transition-colors shrink-0 ${
                isDarkMode
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border-slate-300'
              }`}
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Filter Bar Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          <div>
            <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${secText}`}>
              Active Period
            </label>
            <select
              value={activeMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
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

          <div>
            <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${secText}`}>
              Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${secText}`}>
              Platform
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => { setSelectedPlatform(e.target.value); setPage(1); }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${secText}`}>
              Cluster / Class
            </label>
            <select
              value={selectedCluster}
              onChange={(e) => { setSelectedCluster(e.target.value); setPage(1); }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {clusterOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${secText}`}>
              Search PID / SKU
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search PID or SKU..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className={`w-full py-2 px-3 pl-8 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <svg className={`w-3.5 h-3.5 absolute left-2.5 top-3 ${secText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={`p-4 rounded-2xl border ${borderCol} ${cardBg} shadow-sm`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${secText}`}>Total PIDs</div>
          <div className={`text-xl font-black mt-1 ${mainText}`}>{summaryKPIs.totalPids}</div>
          <div className={`text-[11px] font-medium mt-0.5 ${secText}`}>{activeDates.length} Days Tracking</div>
        </div>

        <div className={`p-4 rounded-2xl border ${borderCol} ${cardBg} shadow-sm`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${secText}`}>Total Spend</div>
          <div className={`text-xl font-black mt-1 ${mainText}`}>Rp {formatNum(summaryKPIs.totalSpend)}</div>
          <div className={`text-[11px] font-medium mt-0.5 ${secText}`}>Commerce Expense</div>
        </div>

        <div className={`p-4 rounded-2xl border ${borderCol} ${cardBg} shadow-sm`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${secText}`}>Total Ads GMV</div>
          <div className={`text-xl font-black mt-1 ${mainText}`}>Rp {formatNum(summaryKPIs.totalAdsGmv)}</div>
          <div className={`text-[11px] font-medium mt-0.5 ${secText}`}>Paid Advertising</div>
        </div>

        <div className={`p-4 rounded-2xl border ${borderCol} ${cardBg} shadow-sm`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${secText}`}>Total Sales</div>
          <div className={`text-xl font-black mt-1 ${mainText}`}>Rp {formatNum(summaryKPIs.totalSales)}</div>
          <div className={`text-[11px] font-medium mt-0.5 ${secText}`}>PID Sales Sheet</div>
        </div>

        <div className={`p-4 rounded-2xl border ${borderCol} ${cardBg} shadow-sm`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${secText}`}>Blended ROAS</div>
          <div className={`text-xl font-black mt-1 ${mainText}`}>
            {summaryKPIs.overallRoas > 0 ? `${summaryKPIs.overallRoas.toFixed(2)}x` : '-'}
          </div>
          <div className={`text-[11px] font-medium mt-0.5 ${secText}`}>Ads GMV / Spend</div>
        </div>

        <div className={`p-4 rounded-2xl border ${borderCol} ${cardBg} shadow-sm`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${secText}`}>Blended CIR</div>
          <div className={`text-xl font-black mt-1 ${mainText}`}>
            {summaryKPIs.overallCir > 0 ? `${summaryKPIs.overallCir.toFixed(2)}%` : '-'}
          </div>
          <div className={`text-[11px] font-medium mt-0.5 ${secText}`}>Spend / Ads GMV</div>
        </div>
      </div>

      {/* 4. Tracking Result Table with Frozen 4 Columns */}
      <div className={`rounded-2xl border ${borderCol} shadow-sm overflow-hidden ${cardBg}`}>
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left border-separate border-spacing-0 text-xs whitespace-nowrap">
            {/* Top Multi-level Header */}
            <thead className="sticky top-0 z-30 font-bold uppercase tracking-wider text-[11px]">
              {/* Row 1: Fixed 4 Column Headers + Merged Date Headers */}
              <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                {/* Col 1: Cluster (Frozen) */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('cluster')}
                  className={`w-[130px] min-w-[130px] max-w-[130px] py-3 px-3 border-r ${borderCol} sticky left-0 top-0 z-50 ${tableHeaderTopBg} ${mainText} cursor-pointer hover:underline select-none align-middle`}
                >
                  Cluster {sortField === 'cluster' ? (sortAsc ? '▲' : '▼') : ''}
                </th>

                {/* Col 2: CID (Frozen) */}
                <th
                  rowSpan={2}
                  className={`w-[140px] min-w-[140px] max-w-[140px] py-3 px-3 border-r ${borderCol} sticky left-[130px] top-0 z-50 ${tableHeaderTopBg} ${mainText} align-middle`}
                >
                  CID
                </th>

                {/* Col 3: SKU Name (Frozen) */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('skuName')}
                  className={`w-[260px] min-w-[260px] max-w-[260px] py-3 px-4 border-r ${borderCol} sticky left-[270px] top-0 z-50 ${tableHeaderTopBg} ${mainText} cursor-pointer hover:underline select-none align-middle`}
                >
                  SKU Name {sortField === 'skuName' ? (sortAsc ? '▲' : '▼') : ''}
                </th>

                {/* Col 4: PID (Frozen + Divider) */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('pid')}
                  className={`w-[160px] min-w-[160px] max-w-[160px] py-3 px-3 border-r-2 ${isDarkMode ? 'border-slate-600' : 'border-slate-400'} shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] sticky left-[530px] top-0 z-50 ${tableHeaderTopBg} ${mainText} cursor-pointer hover:underline select-none align-middle`}
                >
                  PID {sortField === 'pid' ? (sortAsc ? '▲' : '▼') : ''}
                </th>

                {/* Date Columns: Spanning 5 sub-columns each */}
                {activeDates.map((dateStr) => (
                  <th
                    key={dateStr}
                    colSpan={5}
                    className={`py-2.5 px-3 text-center border-r border-b ${borderCol} ${tableHeaderTopBg} ${mainText} font-black tracking-wide`}
                  >
                    {formatDisplayDate(dateStr)}
                  </th>
                ))}
              </tr>

              {/* Row 2: Sub-columns (Spend, Ads GMV, Sales, ROAS, CIR) */}
              <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                {activeDates.map((dateStr) => (
                  <React.Fragment key={`sub-${dateStr}`}>
                    <th className={`w-[90px] min-w-[90px] max-w-[90px] py-2 px-2 text-right font-black border-r border-b ${borderCol} ${tableHeaderSubBg} ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Spend
                    </th>
                    <th className={`w-[95px] min-w-[95px] max-w-[95px] py-2 px-2 text-right font-black border-r border-b ${borderCol} ${tableHeaderSubBg} ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Ads GMV
                    </th>
                    <th className={`w-[95px] min-w-[95px] max-w-[95px] py-2 px-2 text-right font-black border-r border-b ${borderCol} ${tableHeaderSubBg} ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Sales
                    </th>
                    <th className={`w-[70px] min-w-[70px] max-w-[70px] py-2 px-2 text-right font-black border-r border-b ${borderCol} ${tableHeaderSubBg} ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      ROAS
                    </th>
                    <th className={`w-[70px] min-w-[70px] max-w-[70px] py-2 px-2 text-right font-black border-r border-b ${borderCol} ${tableHeaderSubBg} ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      CIR
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {paginatedItems.map((item) => (
                <tr
                  key={item.pid}
                  className={`group transition-colors ${tableRowHoverBg}`}
                >
                  {/* Frozen Column 1: Cluster */}
                  <td className={`w-[130px] min-w-[130px] max-w-[130px] py-3 px-3 border-r border-b ${borderCol} sticky left-0 z-20 ${tableFreezeBg} ${tableFreezeHoverBg}`}>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border truncate max-w-[115px] ${
                        isDarkMode
                          ? 'bg-slate-800 text-slate-200 border-slate-700'
                          : 'bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                      title={item.cluster}
                    >
                      {item.cluster}
                    </span>
                  </td>

                  {/* Frozen Column 2: CID */}
                  <td className={`w-[140px] min-w-[140px] max-w-[140px] py-3 px-3 border-r border-b ${borderCol} font-mono text-[11px] font-semibold sticky left-[130px] z-20 ${tableFreezeBg} ${tableFreezeHoverBg} ${secText} select-all truncate`}>
                    {item.cid || '-'}
                  </td>

                  {/* Frozen Column 3: SKU Name */}
                  <td
                    className={`w-[260px] min-w-[260px] max-w-[260px] py-3 px-4 border-r border-b ${borderCol} sticky left-[270px] z-20 ${tableFreezeBg} ${tableFreezeHoverBg}`}
                    title={item.skuName}
                  >
                    <div className={`font-bold truncate leading-snug ${mainText}`}>
                      {item.skuName}
                    </div>
                    {item.brand && (
                      <span className={`text-[10px] font-semibold ${secText}`}>{item.brand}</span>
                    )}
                  </td>

                  {/* Frozen Column 4: PID (+ Distinct Boundary Divider) */}
                  <td className={`w-[160px] min-w-[160px] max-w-[160px] py-3 px-3 border-r-2 border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-400'} shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] font-mono text-[11px] font-black sticky left-[530px] z-20 ${tableFreezeBg} ${tableFreezeHoverBg} ${mainText} select-all truncate`}>
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
                          className={`w-[90px] min-w-[90px] max-w-[90px] py-2.5 px-2 text-right font-mono border-r border-b ${borderCol} cursor-pointer transition-colors relative hover:bg-indigo-500/10`}
                          title="Click to view Spend details"
                        >
                          <span className={rec.spend > 0 ? `${mainText} font-bold` : `${secText}`}>
                            {rec.spend > 0 ? formatNum(rec.spend) : '-'}
                          </span>
                          {adj && adj.metric === 'Spend' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          )}
                        </td>

                        {/* Ads GMV Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'adsGmv' })}
                          className={`w-[95px] min-w-[95px] max-w-[95px] py-2.5 px-2 text-right font-mono border-r border-b ${borderCol} cursor-pointer transition-colors relative hover:bg-indigo-500/10`}
                          title="Click to view Ads GMV details"
                        >
                          <span className={rec.adsGmv > 0 ? `${mainText} font-bold` : `${secText}`}>
                            {rec.adsGmv > 0 ? formatNum(rec.adsGmv) : '-'}
                          </span>
                          {adj && adj.metric === 'Ads GMV' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          )}
                        </td>

                        {/* Sales Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'sales' })}
                          className={`w-[95px] min-w-[95px] max-w-[95px] py-2.5 px-2 text-right font-mono border-r border-b ${borderCol} cursor-pointer transition-colors relative hover:bg-indigo-500/10`}
                          title="Click to view Sales details"
                        >
                          <span className={rec.sales > 0 ? `${mainText} font-bold` : `${secText}`}>
                            {rec.sales > 0 ? formatNum(rec.sales) : '-'}
                          </span>
                          {adj && adj.metric === 'Sales' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          )}
                        </td>

                        {/* ROAS Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'roas' })}
                          className={`w-[70px] min-w-[70px] max-w-[70px] py-2.5 px-2 text-right font-mono border-r border-b ${borderCol} cursor-pointer transition-colors hover:bg-indigo-500/10`}
                          title="Click to view ROAS details"
                        >
                          <span className={rec.roas > 0 ? `${mainText} font-bold` : `${secText}`}>
                            {rec.roas > 0 ? rec.roas.toFixed(2) : '-'}
                          </span>
                        </td>

                        {/* CIR Cell */}
                        <td
                          onClick={() => setActiveDrilldown({ pidItem: item, metric: 'cir' })}
                          className={`w-[70px] min-w-[70px] max-w-[70px] py-2.5 px-2 text-right font-mono border-r border-b ${borderCol} cursor-pointer transition-colors hover:bg-indigo-500/10`}
                          title="Click to view CIR details"
                        >
                          <span className={rec.cir > 0 ? `${mainText} font-bold` : `${secText}`}>
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
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 ${borderCol} ${tableHeaderSubBg}`}>
          <div className={`text-xs ${secText}`}>
            Showing <span className={`font-bold ${mainText}`}>{paginatedItems.length}</span> of <span className={`font-bold ${mainText}`}>{filteredItems.length}</span> PIDs.
            <span className="ml-2 font-medium">(First 4 columns are frozen. Click any metric cell to open single-metric popup)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                isDarkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                  : 'border-slate-300 hover:bg-slate-200 text-slate-800'
              }`}
            >
              Previous
            </button>
            <span className={`text-xs font-bold px-2 ${mainText}`}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                isDarkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                  : 'border-slate-300 hover:bg-slate-200 text-slate-800'
              }`}
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
