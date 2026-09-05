'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Chart from 'chart.js/auto';

const CONFIG = {
  media: { sheet: "Media API", colDate: "Date", colBrand: "Brand", colPlatform: "Platform", colFunnel: "Funnel", colAdType: "KPI", colFormat: "Format", colConsiSize: "Result" },
  commerce: { sheet: "Commerce", colDate: "Date", colBrand: "Brand fx", colPlatform: "Platform", colAdType: "Ad Type" },
  creative: { sheet: "Creative Raw", colPeriod: "Period", colBrand: "Brand", colPlatform: "Platform", colAdType: "Ad Type", colFormat: "Format" }
};

export default function DashboardApp() {
  const [currentView, setCurrentView] = useState<'login' | 'welcome' | 'dashboard'>('login');
  const [activeEngine, setActiveEngine] = useState<'media' | 'commerce' | 'creative' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dataCache = useRef<Record<string, any[]>>({});
  const [rawData, setRawData] = useState<any[]>([]);
  
  const [filters, setFilters] = useState({ brand: 'All', funnel: 'All', platform: 'All', adType: 'All', format: 'All', period: 'All' });
  const [granularity, setGranularity] = useState('monthly');
  const [dateMonth, setDateMonth] = useState('');
  const [dateWeekly, setDateWeekly] = useState('');
  const [dateDailyStart, setDateDailyStart] = useState('');
  const [dateDailyEnd, setDateDailyEnd] = useState('');

  const [tableColFilter1, setTableColFilter1] = useState('All');
  const [tableColFilter2, setTableColFilter2] = useState('All');

  const [dashboardContext, setDashboardContext] = useState('Overall');
  const [chartMetricsMedia, setChartMetricsMedia] = useState<string[]>(['spend', 'imp']);
  const [chartMetricsComm, setChartMetricsComm] = useState<string[]>(['exp', 'gmv']);
  const [creativePage, setCreativePage] = useState(1);
  const CREATIVES_PER_PAGE = 8;

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Set global chart font matching the dashboard
  useEffect(() => {
    Chart.defaults.font.family = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  }, []);

  useEffect(() => {
    const today = new Date();
    const yyyy_mm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const yyyy_mm_dd = `${yyyy_mm}-${String(today.getDate()).padStart(2, '0')}`;
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const start_yyyy_mm_dd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    
    setDateMonth(yyyy_mm); setDateWeekly(yyyy_mm_dd); setDateDailyStart(start_yyyy_mm_dd); setDateDailyEnd(yyyy_mm_dd);
  }, []);

  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace(/,/g, '').replace(/ /g, '').trim()) || 0;
  };
  const formatIDR = (num: number) => (Number(num)||0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const formatNum = (num: number) => (Number(num)||0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatPct = (num: number) => ((Number(num)||0) * 100).toFixed(2) + "%";
  
  const getGr = (cur: number, prev: number) => {
    if (prev === 0 && cur === 0) return 0;
    if (prev === 0 && cur > 0) return 1; 
    if (prev === 0 && cur < 0) return -1;
    return (cur - prev) / prev;
  };

  const parseSheetDate = (dateStr: any) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    const str = String(dateStr).trim();
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      let year, month, day;
      if (parts[0].length === 4) { year = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; day = parseInt(parts[2].split(' ')[0], 10); } 
      else { day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2].split(' ')[0], 10); }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(str);
  };

  const getMediaDates = useCallback((targetDate: Date, gran: string) => {
    if (!targetDate || isNaN(targetDate.getTime())) return null;
    const getIsoWeekday = (d: Date) => d.getDay() === 0 ? 7 : d.getDay();
    const e5 = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1); 
    let mondayOfE5 = new Date(e5); mondayOfE5.setDate(e5.getDate() - getIsoWeekday(e5) + 1);
    let curFirstWeek = (mondayOfE5.getMonth() === e5.getMonth()) ? new Date(mondayOfE5) : new Date(e5);

    let prevE5 = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    let mondayOfPrevE5 = new Date(prevE5); mondayOfPrevE5.setDate(prevE5.getDate() - getIsoWeekday(prevE5) + 1);
    let prevFirstWeek = (mondayOfPrevE5.getMonth() === prevE5.getMonth()) ? new Date(mondayOfPrevE5) : new Date(prevE5);

    let nextE5 = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
    let mondayOfNextE5 = new Date(nextE5); mondayOfNextE5.setDate(nextE5.getDate() - getIsoWeekday(nextE5) + 1);
    let nextFirstWeek = (mondayOfNextE5.getMonth() === nextE5.getMonth()) ? new Date(mondayOfNextE5) : new Date(nextE5);
    
    let curMonthEnd = new Date(nextFirstWeek); curMonthEnd.setDate(curMonthEnd.getDate() - 1);
    let prevMonthEnd = new Date(curFirstWeek); prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
    let daysDiff = Math.floor((targetDate.getTime() - curFirstWeek.getTime()) / (1000 * 60 * 60 * 24));
    let prevMtdEnd = new Date(prevFirstWeek); prevMtdEnd.setDate(prevFirstWeek.getDate() + daysDiff);
    let chartStartMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() - 2, 1);
    
    return { curStart: curFirstWeek, curMtdEnd: targetDate, curMonthEnd: curMonthEnd, prevStart: prevFirstWeek, prevMtdEnd: prevMtdEnd, prevMonthEnd: prevMonthEnd, chartStart: chartStartMonth };
  }, []);

  const getWeekBucket = (date: Date, mediaStart: Date) => {
    let diff = Math.floor((date.getTime() - mediaStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(diff / 7) + 1;
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoginError('');
    const form = e.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    
    try {
      const res = await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username, password }) });
      const result = await res.json();
      if (result.success) {
        setIsLoginSuccess(true);
        setTimeout(() => { setCurrentView('welcome'); setIsLoginSuccess(false); }, 1200);
      } else {
        setLoginError(result.error || 'Incorrect username or password.');
      }
    } catch (err) { setLoginError('Server communication failed.'); }
  };

  const loadData = async (engine: 'media' | 'commerce' | 'creative', forceSync = false) => {
    setFilters({ brand: 'All', funnel: 'All', platform: 'All', adType: 'All', format: 'All', period: 'All' });
    setDashboardContext('Overall'); setCreativePage(1); setTableColFilter1('All'); setTableColFilter2('All');
    
    if (forceSync) dataCache.current[engine] = undefined as any;
    if (dataCache.current[engine]) { setRawData(dataCache.current[engine]); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getData', sheetName: CONFIG[engine].sheet }) });
      const result = await res.json();
      if (result.success) { dataCache.current[engine] = result.data; setRawData(result.data); } 
      else alert("Error: " + result.error);
    } catch (err) { alert("Network error."); }
    setIsLoading(false);
  };

  const selectEngine = (engine: 'media' | 'commerce' | 'creative') => {
    setActiveEngine(engine); setCurrentView('dashboard'); loadData(engine);
  };

  const handleFilterChange = (key: string, value: string) => { setFilters(prev => ({ ...prev, [key]: value })); setCreativePage(1); };

  const getDependentOptions = (colName: string, filterKeyToExclude: string) => {
    if (!rawData || rawData.length === 0) return ['All'];
    const cfg = CONFIG[activeEngine || 'media'] as any;
    
    let filtered = rawData;
    if (filterKeyToExclude !== 'brand' && filters.brand !== 'All') filtered = filtered.filter(r => String(r[cfg.colBrand]) === filters.brand);
    if (activeEngine === 'media') {
      if (filterKeyToExclude !== 'funnel' && filters.funnel !== 'All') filtered = filtered.filter(r => String(r[cfg.colFunnel]) === filters.funnel);
    }
    if (activeEngine === 'commerce' || activeEngine === 'creative') {
      if (filterKeyToExclude !== 'adType' && filters.adType !== 'All') filtered = filtered.filter(r => String(r[cfg.colAdType]) === filters.adType);
    }
    if (activeEngine === 'creative') {
      if (filterKeyToExclude !== 'period' && filters.period !== 'All') filtered = filtered.filter(r => String(r[cfg.colPeriod]) === filters.period);
      if (filterKeyToExclude !== 'platform' && filters.platform !== 'All') filtered = filtered.filter(r => String(r[cfg.colPlatform]) === filters.platform);
      if (filterKeyToExclude !== 'format' && filters.format !== 'All') filtered = filtered.filter(r => String(r[cfg.colFormat]) === filters.format);
    }

    const unique = Array.from(new Set(filtered.map(r => r[colName]))).filter(v => v && String(v).trim() !== "");
    return ['All', ...unique.sort()];
  };

  const handleToggleMetric = (engine: 'media'|'commerce', value: string) => {
    const setState = engine === 'media' ? setChartMetricsMedia : setChartMetricsComm;
    const current = engine === 'media' ? [...chartMetricsMedia] : [...chartMetricsComm];
    if (current.includes(value)) {
      if (current.length === 1) return;
      setState(current.filter(m => m !== value));
    } else {
      if (current.length >= 3) { alert("Max 3 metrics for chart."); return; }
      setState([...current, value]);
    }
  };

  const { curData, prevData, chartData, creativeData, globalDates } = useMemo(() => {
    if (!activeEngine || rawData.length === 0) return { curData: [], prevData: [], chartData: [], creativeData: [], globalDates: null };
    const cfg = CONFIG[activeEngine];

    const filteredBase = rawData.filter(row => {
      if (filters.brand !== 'All' && String(row[cfg.colBrand]) !== filters.brand) return false;
      if (activeEngine === 'media' && filters.funnel !== 'All' && String(row[cfg.colFunnel]) !== filters.funnel) return false;
      if (activeEngine === 'commerce' && filters.adType !== 'All' && String(row[cfg.colAdType]) !== filters.adType) return false;
      if (activeEngine === 'creative') {
        if (filters.period !== 'All' && String(row[cfg.colPeriod]) !== filters.period) return false;
        if (filters.platform !== 'All' && String(row[cfg.colPlatform]) !== filters.platform) return false;
        if (filters.adType !== 'All' && String(row[cfg.colAdType]) !== filters.adType) return false;
        if (filters.format !== 'All' && String(row[cfg.colFormat]) !== filters.format) return false;
      }
      return true;
    });

    if (activeEngine === 'creative') return { curData: [], prevData: [], chartData: [], creativeData: filteredBase, globalDates: null };

    let cData: any[] = []; let pData: any[] = []; let chData: any[] = [];
    let dates: any = null; let dStart: any = null; let dEnd: any = null;

    if (granularity === 'monthly' && dateMonth) {
      const p = dateMonth.split('-'); dates = getMediaDates(new Date(Number(p[0]), Number(p[1]), 0), 'monthly');
    } else if (granularity === 'weekly' && dateWeekly) {
      const p = dateWeekly.split('-'); dates = getMediaDates(new Date(Number(p[0]), Number(p[1])-1, Number(p[2])), 'weekly');
    } else if (granularity === 'daily' && dateDailyStart && dateDailyEnd) {
      const s = dateDailyStart.split('-'); dStart = new Date(Number(s[0]), Number(s[1])-1, Number(s[2]));
      const e = dateDailyEnd.split('-'); dEnd = new Date(Number(e[0]), Number(e[1])-1, Number(e[2]), 23, 59, 59);
    }

    filteredBase.forEach(row => {
      const rowDate = parseSheetDate(row[cfg.colDate]);
      if (!rowDate) return;
      rowDate.setHours(0,0,0,0);
      row.parsedDate = rowDate;

      if (granularity === 'monthly' && dates) {
        if (rowDate >= dates.curStart && rowDate <= dates.curMonthEnd) { row.bucket = "Month"; cData.push(row); }
        if (rowDate >= dates.prevStart && rowDate <= dates.prevMonthEnd) { row.bucket = "Month"; pData.push(row); }
        if (rowDate >= dates.chartStart && rowDate <= dates.curMonthEnd) {
           let chartRow = {...row};
           chartRow.chartBucket = `${rowDate.getFullYear()}-${String(rowDate.getMonth()+1).padStart(2,'0')}`;
           chData.push(chartRow);
        }
      } else if (granularity === 'weekly' && dates) {
        if (rowDate >= dates.curStart && rowDate <= dates.curMtdEnd) { row.bucket = "W" + getWeekBucket(rowDate, dates.curStart); cData.push(row); chData.push(row); }
        if (rowDate >= dates.prevStart && rowDate <= dates.prevMtdEnd) { row.bucket = "W" + getWeekBucket(rowDate, dates.prevStart); pData.push(row); }
      } else if (granularity === 'daily' && dStart && dEnd) {
        if (rowDate >= dStart && rowDate <= dEnd) { 
          row.bucket = `${rowDate.getFullYear()}-${String(rowDate.getMonth()+1).padStart(2,'0')}-${String(rowDate.getDate()).padStart(2,'0')}`; 
          cData.push(row); chData.push(row);
        }
      }
    });

    return { curData: cData, prevData: pData, chartData: chData, creativeData: [], globalDates: dates };
  }, [rawData, filters, activeEngine, granularity, dateMonth, dateWeekly, dateDailyStart, dateDailyEnd, getMediaDates]);

  const { ctxCurData, ctxPrevData, ctxChartData } = useMemo(() => {
    if (dashboardContext === 'Overall' || activeEngine === 'creative') return { ctxCurData: curData, ctxPrevData: prevData, ctxChartData: chartData };
    const match = dashboardContext.toLowerCase();
    const filterFn = (row: any) => {
      const p = String(row[CONFIG[activeEngine as 'media'|'commerce'].colPlatform] || "").toLowerCase();
      if (match === 'meta') return p.includes('meta') || p.includes('facebook') || p.includes('ig') || p.includes('instagram');
      return p.includes(match);
    };
    return { ctxCurData: curData.filter(filterFn), ctxPrevData: prevData.filter(filterFn), ctxChartData: chartData.filter(filterFn) };
  }, [curData, prevData, chartData, dashboardContext, activeEngine]);

  const mediaKPIs = useMemo(() => {
    let totals = { overall: { spend: 0, impr: 0, engage: 0, pSpend: 0, pImpr: 0, pEngage: 0 }, meta: { spend: 0, impr: 0, engage: 0, pSpend: 0, pImpr: 0, pEngage: 0 }, tiktok: { spend: 0, impr: 0, engage: 0, pSpend: 0, pImpr: 0, pEngage: 0 } };
    const calc = (data: any[], isPrev: boolean) => {
      if (activeEngine !== 'media') return;
      data.forEach(row => {
        const s = parseNum(row["Ad Spend"]); const i = parseNum(row["Impressions"]);
        const e = parseNum(row["Combined Clicks"]) + parseNum(row["Views"]) + parseNum(row["Views 6s"]);
        const plat = String(row[CONFIG.media.colPlatform] || "").toLowerCase();

        if (isPrev) {
          totals.overall.pSpend += s; totals.overall.pImpr += i; totals.overall.pEngage += e;
          if (plat.includes('meta') || plat.includes('ig')) { totals.meta.pSpend += s; totals.meta.pImpr += i; totals.meta.pEngage += e; }
          else if (plat.includes('tiktok')) { totals.tiktok.pSpend += s; totals.tiktok.pImpr += i; totals.tiktok.pEngage += e; }
        } else {
          totals.overall.spend += s; totals.overall.impr += i; totals.overall.engage += e;
          if (plat.includes('meta') || plat.includes('ig')) { totals.meta.spend += s; totals.meta.impr += i; totals.meta.engage += e; }
          else if (plat.includes('tiktok')) { totals.tiktok.spend += s; totals.tiktok.impr += i; totals.tiktok.engage += e; }
        }
      });
    };
    calc(ctxCurData, false); calc(ctxPrevData, true);
    return totals;
  }, [ctxCurData, ctxPrevData, activeEngine]);

  const commerceKPIs = useMemo(() => {
    let totals = { overall: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 }, tiktok: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 }, shopee: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 } };
    const calc = (data: any[], isPrev: boolean) => {
      if (activeEngine !== 'commerce') return;
      data.forEach(row => {
        const e = parseNum(row["Expense"]); const g = parseNum(row["GMV"]);
        const plat = String(row[CONFIG.commerce.colPlatform] || "").toLowerCase();

        if (isPrev) {
          totals.overall.pExp += e; totals.overall.pGmv += g;
          if (plat.includes('tiktok')) { totals.tiktok.pExp += e; totals.tiktok.pGmv += g; }
          else if (plat.includes('shopee')) { totals.shopee.pExp += e; totals.shopee.pGmv += g; }
        } else {
          totals.overall.exp += e; totals.overall.gmv += g;
          if (plat.includes('tiktok')) { totals.tiktok.exp += e; totals.tiktok.gmv += g; }
          else if (plat.includes('shopee')) { totals.shopee.exp += e; totals.shopee.gmv += g; }
        }
      });
    };
    calc(ctxCurData, false); calc(ctxPrevData, true);
    const calcRoas = (g: number, e: number) => e > 0 ? (g / e).toFixed(2) + 'x' : '0.00x';
    return {
      overall: { ...totals.overall, roas: calcRoas(totals.overall.gmv, totals.overall.exp), pRoas: calcRoas(totals.overall.pGmv, totals.overall.pExp), roasNum: totals.overall.exp>0?totals.overall.gmv/totals.overall.exp:0, pRoasNum: totals.overall.pExp>0?totals.overall.pGmv/totals.overall.pExp:0 },
      tiktok: { ...totals.tiktok, roas: calcRoas(totals.tiktok.gmv, totals.tiktok.exp), pRoas: calcRoas(totals.tiktok.pGmv, totals.tiktok.pExp), roasNum: totals.tiktok.exp>0?totals.tiktok.gmv/totals.tiktok.exp:0, pRoasNum: totals.tiktok.pExp>0?totals.tiktok.pGmv/totals.tiktok.pExp:0 },
      shopee: { ...totals.shopee, roas: calcRoas(totals.shopee.gmv, totals.shopee.exp), pRoas: calcRoas(totals.shopee.pGmv, totals.shopee.pExp), roasNum: totals.shopee.exp>0?totals.shopee.gmv/totals.shopee.exp:0, pRoasNum: totals.shopee.pExp>0?totals.shopee.pGmv/totals.shopee.pExp:0 }
    };
  }, [ctxCurData, ctxPrevData, activeEngine]);

  const renderGR = (cur: number, prev: number, isInv = false) => {
    if (granularity === 'daily' || prevData.length === 0) return null;
    const gr = getGr(cur, prev);
    let color = isDarkMode ? "text-slate-400" : "text-slate-200/80"; let arrow = "";
    if (gr > 0) { color = isInv ? "text-red-400" : "text-emerald-400"; arrow = "▲"; } 
    else if (gr < 0) { color = isInv ? "text-emerald-400" : "text-red-400"; arrow = "▼"; } 
    else return <span className={`text-[clamp(10px,1vw,12px)] ml-1.5 font-bold ${color}`}>-</span>;
    return <span className={`text-[clamp(10px,1vw,12px)] ml-1.5 font-bold ${color}`}>{arrow} {formatPct(Math.abs(gr))}</span>;
  };

  // --- CHART RENDERING ---
  useEffect(() => {
    if ((activeEngine !== 'media' && activeEngine !== 'commerce') || ctxChartData.length === 0 || !chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const groupedData: Record<string, any> = {};
    const cfg = CONFIG[activeEngine];
    
    const sortedData = [...ctxChartData].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    sortedData.forEach(row => {
      const d = row.parsedDate;
      let label = "";
      if (granularity === 'monthly') {
         const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
         label = `${mNames[d.getMonth()]} ${d.getFullYear()}`;
      } else if (granularity === 'weekly') {
         label = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
      } else {
         label = `${d.getDate()}/${d.getMonth()+1}`;
      }

      if (!groupedData[label]) groupedData[label] = activeEngine === 'media' ? { spend: 0, imp: 0, clicks: 0, views: 0 } : { exp: 0, gmv: 0, orders: 0 };
      
      if (activeEngine === 'media') {
        groupedData[label].spend += parseNum(row['Ad Spend']); groupedData[label].imp += parseNum(row['Impressions']);
        groupedData[label].clicks += parseNum(row['Combined Clicks']); groupedData[label].views += parseNum(row['Views']) + parseNum(row['Views 6s']);
      } else {
        groupedData[label].exp += parseNum(row['Expense']); groupedData[label].gmv += parseNum(row['GMV']); groupedData[label].orders += parseNum(row['Orders']);
      }
    });

    const labels = Object.keys(groupedData);
    let datasets: any[] = [];
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (activeEngine === 'media') {
      const configs: any = {
        'spend': { label: 'Spend', data: labels.map(l => groupedData[l].spend), color: '#4f46e5', bg: '#4f46e5', type: 'bar' },
        'imp': { label: 'Impr', data: labels.map(l => groupedData[l].imp), color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', type: 'line' },
        'clicks': { label: 'Clicks', data: labels.map(l => groupedData[l].clicks), color: '#84cc16', bg: 'transparent', type: 'line' },
        'views': { label: 'Views', data: labels.map(l => groupedData[l].views), color: '#f59e0b', bg: 'transparent', type: 'line' },
        'ctr': { label: 'CTR', data: labels.map(l => groupedData[l].imp>0 ? (groupedData[l].clicks/groupedData[l].imp)*100 : 0), color: '#ec4899', bg: 'transparent', type: 'line' },
        'vtr': { label: 'VTR', data: labels.map(l => groupedData[l].imp>0 ? (groupedData[l].views/groupedData[l].imp)*100 : 0), color: '#06b6d4', bg: 'transparent', type: 'line' }
      };
      chartMetricsMedia.forEach((key, idx) => {
        const c = configs[key];
        datasets.push({ label: c.label, data: c.data, type: c.type, backgroundColor: c.bg, borderColor: c.color, yAxisID: idx===0?'y':'y1', tension: 0.4, fill: c.type==='line', borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, borderRadius: c.type==='bar'?6:0 });
      });
    } else {
      const configs: any = {
        'exp': { label: 'Expense', data: labels.map(l => groupedData[l].exp), color: '#4f46e5', bg: '#4f46e5', type: 'bar' },
        'gmv': { label: 'GMV', data: labels.map(l => groupedData[l].gmv), color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', type: 'line' },
        'orders': { label: 'Orders', data: labels.map(l => groupedData[l].orders), color: '#84cc16', bg: 'transparent', type: 'line' },
        'roas': { label: 'ROAS', data: labels.map(l => groupedData[l].exp>0 ? groupedData[l].gmv/groupedData[l].exp : 0), color: '#f59e0b', bg: 'transparent', type: 'line' },
        'cpa': { label: 'CPA', data: labels.map(l => groupedData[l].orders>0 ? groupedData[l].exp/groupedData[l].orders : 0), color: '#ec4899', bg: 'transparent', type: 'line' }
      };
      chartMetricsComm.forEach((key, idx) => {
        const c = configs[key];
        datasets.push({ label: c.label, data: c.data, type: c.type, backgroundColor: c.bg, borderColor: c.color, yAxisID: idx===0?'y':'y1', tension: 0.4, fill: c.type==='line', borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, borderRadius: c.type==='bar'?6:0 });
      });
    }

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { 
          legend: { 
            position: 'bottom', 
            labels: { 
              usePointStyle: true, 
              pointStyle: 'rectRounded', 
              boxWidth: 16, 
              boxHeight: 6,
              color: isDarkMode ? '#cbd5e1' : '#475569'
            } 
          } 
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' } },
          y: { type: 'linear', display: true, position: 'left', grid: { color: isDarkMode ? '#334155' : '#e2e8f0' }, border: { dash: [4, 4] }, ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' } },
          y1: { type: 'linear', display: datasets.length > 1, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' } }
        }
      }
    });

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [ctxChartData, chartMetricsMedia, chartMetricsComm, activeEngine, granularity, isDarkMode]);

  // --- MANUAL TABLE RENDERER ---
  const generateTableHTML = useCallback(() => {
    if (activeEngine === 'creative') return { head: '', body: '', uniqueDim1: [], uniqueDim2: [] };
    const isMedia = activeEngine === 'media';
    const cnf = CONFIG[activeEngine as 'media'|'commerce'];
    
    const getBaseMetricsMedia = () => ({ spend:0, imp:0, clicks:0, views15s:0, views6s:0, consiSize:0, gmv:0, purchase:0 });
    const getBaseMetricsCommerce = () => ({ exp:0, imp:0, clicks:0, orders:0, gmv:0, liveViews:0 });
    
    const sumMetricsData = (target: any, row: any) => {
      if (isMedia) {
        target.spend += parseNum(row["Ad Spend"]); target.imp += parseNum(row["Impressions"]);
        target.clicks += parseNum(row["Combined Clicks"]); target.views15s += parseNum(row["Views"]);
        target.views6s += parseNum(row["Views 6s"]); target.consiSize += parseNum(row[CONFIG.media.colConsiSize]); 
        target.gmv += parseNum(row["GMV"]); target.purchase += parseNum(row["Purchases With Shared Items"]);
      } else {
        target.exp += parseNum(row["Expense"]); target.imp += parseNum(row["Impression"]);
        target.clicks += parseNum(row["Clicks"]); target.orders += parseNum(row["Orders"]);
        target.gmv += parseNum(row["GMV"]); target.liveViews += parseNum(row["Live Views"]);
      }
    };

    const getDisplayMetricsArray = (g: any, adTypeLower: string) => {
      if (isMedia) {
        let m = [
          { name: "Cost", raw: g.spend, fmt: formatIDR(g.spend), isInv: true }, { name: "Impression", raw: g.imp, fmt: formatNum(g.imp), isInv: false },
          { name: "Clicks", raw: g.clicks, fmt: formatNum(g.clicks), isInv: false }, { name: "Views (6s)", raw: g.views6s, fmt: formatNum(g.views6s), isInv: false },
          { name: "Views (15s)", raw: g.views15s, fmt: formatNum(g.views15s), isInv: false }, { name: "CTR", raw: g.imp>0?(g.clicks/g.imp):0, fmt: formatPct(g.imp>0?(g.clicks/g.imp):0), isInv: false },
          { name: "VTR (6s)", raw: g.imp>0?(g.views6s/g.imp):0, fmt: formatPct(g.imp>0?(g.views6s/g.imp):0), isInv: false }, { name: "VTR (15s)", raw: g.imp>0?(g.views15s/g.imp):0, fmt: formatPct(g.imp>0?(g.views15s/g.imp):0), isInv: false },
          { name: "CPM", raw: g.imp>0?((g.spend/g.imp)*1000):0, fmt: formatIDR(g.imp>0?((g.spend/g.imp)*1000):0), isInv: true }
        ];
        if (adTypeLower.includes("tiktok consideration")) {
          m.push({ name: "Consi Size", raw: g.consiSize, fmt: formatNum(g.consiSize), isInv: false }); m.push({ name: "Consi Rate", raw: g.imp>0?(g.consiSize/g.imp):0, fmt: formatPct(g.imp>0?(g.consiSize/g.imp):0), isInv: false });
          m.push({ name: "CPCo", raw: g.consiSize>0?(g.spend/g.consiSize):0, fmt: formatIDR(g.consiSize>0?(g.spend/g.consiSize):0), isInv: true });
        }
        if (adTypeLower.includes("cpas shopee") || adTypeLower.includes("cpas view content")) {
          m.push({ name: "GMV", raw: g.gmv, fmt: formatIDR(g.gmv), isInv: false }); m.push({ name: "Purchase", raw: g.purchase, fmt: formatNum(g.purchase), isInv: false });
          m.push({ name: "ROAS", raw: g.spend>0?(g.gmv/g.spend):0, fmt: (g.spend>0?(g.gmv/g.spend):0).toFixed(2)+"x", isInv: false });
        }
        return m;
      } else {
        let m = [
          { name: "Expense", raw: g.exp, fmt: formatIDR(g.exp), isInv: true }, { name: "Orders", raw: g.orders, fmt: formatNum(g.orders), isInv: false },
          { name: "GMV", raw: g.gmv, fmt: formatIDR(g.gmv), isInv: false }, { name: "CPA", raw: g.orders>0?(g.exp/g.orders):0, fmt: formatIDR(g.orders>0?(g.exp/g.orders):0), isInv: true },
          { name: "ROAS", raw: g.exp>0?(g.gmv/g.exp):0, fmt: (g.exp>0?(g.gmv/g.exp):0).toFixed(2)+"x", isInv: false }
        ];
        if (adTypeLower.includes('live official') || adTypeLower.includes('live affiliate')) m.splice(1, 0, { name: "Live Views", raw: g.liveViews, fmt: formatNum(g.liveViews), isInv: false });
        return m;
      }
    };

    const getGrHTML = (cur: number, prev: number, invertColors = false) => {
      const gr = getGr(cur, prev);
      if (cur === 0 && prev === 0) return `<td class="px-4 py-3 text-right font-mono font-medium text-slate-400">0.00%</td>`;
      let color = isDarkMode ? "text-slate-400" : "text-slate-500";
      if (gr > 0) color = invertColors ? "text-red-600 bg-red-50" : "text-emerald-700 bg-emerald-50";
      if (gr < 0) color = invertColors ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50";
      
      if (isDarkMode) {
          if (gr > 0) color = invertColors ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10";
          if (gr < 0) color = invertColors ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10";
      }
      return `<td class="px-4 py-3 text-right font-mono font-bold"><span class="px-2.5 py-1 rounded-lg ${color}">${formatPct(Math.abs(gr))}</span></td>`;
    };

    let dim1Set = new Set<string>(); let dim2Set = new Set<string>();
    ctxCurData.forEach(r => {
      dim1Set.add(isMedia ? String(r[cnf.colAdType]) : String(r[cnf.colPlatform]));
      dim2Set.add(isMedia ? String(r[cnf.colFormat]) : String(r[cnf.colAdType]));
    });

    const filterRow = (k1: string, k2: string) => {
      if (tableColFilter1 !== 'All' && k1 !== tableColFilter1) return false;
      if (tableColFilter2 !== 'All' && k2 !== tableColFilter2) return false;
      return true;
    };

    let thead = ''; let tbody = '';
    const thClass = `px-4 py-4 font-bold text-slate-100 bg-[#0f172a]`;

    if (granularity === 'monthly') {
      thead = `<tr>
        <th class="sticky-col ${thClass}">${isMedia?'Ad Type':'Platform'}</th>
        <th class="sticky-col-2 ${thClass}">${isMedia?'Format':'Ad Type'}</th>
        <th class="sticky-col-3 ${thClass}">Metric</th>
        <th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 z-30">This Month</th>
        <th class="px-4 py-4 text-right font-bold text-slate-400 bg-[#0f172a] sticky top-0 z-30">Prev Month</th>
        <th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 z-30">GR%</th>
      </tr>`;
      
      const grouped: any = {};
      const process = (data: any[], keyName: string) => {
        data.forEach(r => {
          const k1 = isMedia ? String(r[cnf.colAdType]) : String(r[cnf.colPlatform]); const k2 = isMedia ? String(r[cnf.colFormat]) : String(r[cnf.colAdType]);
          if (!filterRow(k1, k2)) return;
          const k = k1 + '_|_' + k2;
          if(!grouped[k]) grouped[k] = { cur: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(), prev: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(), dim1: k1, dim2: k2 };
          sumMetricsData(grouped[k][keyName], r);
        });
      };
      process(ctxCurData, 'cur'); process(ctxPrevData, 'prev');

      Object.values(grouped).forEach((g: any) => {
        const adTypeStr = String(isMedia ? g.dim1 : g.dim2).toLowerCase();
        const mCur = getDisplayMetricsArray(g.cur, adTypeStr); const mPrev = getDisplayMetricsArray(g.prev, adTypeStr);
        mCur.forEach((mc, i) => {
          const mp = mPrev[i]; 
          let rowCls = i%2===0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50'); 
          if(i===0) rowCls += ' group-start';
          
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide">${mc.name}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}">${mc.fmt}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-medium text-slate-400">${mp.fmt}</td>`;
          tbody += getGrHTML(mc.raw, mp.raw, mc.isInv);
          tbody += '</tr>';
        });
      });
    } else if (granularity === 'weekly') {
      let weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
      let weeks = Array.from(weeksFound).sort(); 
      thead = `<tr><th class="sticky-col ${thClass}">${isMedia?'Ad Type':'Platform'}</th><th class="sticky-col-2 ${thClass}">${isMedia?'Format':'Ad Type'}</th><th class="sticky-col-3 ${thClass}">Metric</th>`;
      weeks.forEach(w => {
        const weekNum = parseInt(w.replace('W', ''));
        let curD = new Date(globalDates.curStart); curD.setDate(curD.getDate() + (weekNum * 7) - 1); if (curD > globalDates.curMtdEnd) curD = new Date(globalDates.curMtdEnd);
        let prevD = new Date(globalDates.prevStart); prevD.setDate(prevD.getDate() + (weekNum * 7) - 1); if (prevD > globalDates.prevMtdEnd) prevD = new Date(globalDates.prevMtdEnd);
        const fmtStr = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
        thead += `<th class="px-4 py-4 text-right bg-[#0f172a] border-l border-slate-700 font-bold text-white sticky top-0 z-30">MTD ${fmtStr(curD)}</th><th class="px-4 py-4 text-right text-slate-400 bg-[#0f172a] font-bold sticky top-0 z-30">MTD ${fmtStr(prevD)}</th><th class="px-4 py-4 text-right bg-[#0f172a] font-bold text-white sticky top-0 z-30">GR%</th>`;
      });
      thead += `<th class="px-4 py-4 text-right border-l border-indigo-500 text-indigo-300 font-bold bg-[#020617] sticky top-0 z-30">MTD Total Cur</th><th class="px-4 py-4 text-right text-slate-400 font-bold bg-[#020617] sticky top-0 z-30">MTD Total Prev</th><th class="px-4 py-4 text-right text-indigo-300 font-bold bg-[#020617] sticky top-0 z-30">Total GR%</th></tr>`;

      const grouped: any = {};
      const process = (data: any[], keyName: string) => {
        data.forEach(r => {
          const k1 = isMedia ? String(r[cnf.colAdType]) : String(r[cnf.colPlatform]); const k2 = isMedia ? String(r[cnf.colFormat]) : String(r[cnf.colAdType]);
          if (!filterRow(k1, k2)) return;
          const k = k1 + '_|_' + k2;
          if(!grouped[k]) { grouped[k] = { curTotal: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(), prevTotal: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(), weeks: {}, dim1: k1, dim2: k2 }; weeks.forEach(w => grouped[k].weeks[w] = { cur: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(), prev: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce() }); }
          sumMetricsData(grouped[k][keyName+"Total"], r);
          if(grouped[k].weeks[r.bucket]) sumMetricsData(grouped[k].weeks[r.bucket][keyName], r);
        });
      };
      process(ctxCurData, 'cur'); process(ctxPrevData, 'prev');

      Object.values(grouped).forEach((g: any) => {
        const adTypeStr = String(isMedia ? g.dim1 : g.dim2).toLowerCase();
        const curTotM = getDisplayMetricsArray(g.curTotal, adTypeStr); const prevTotM = getDisplayMetricsArray(g.prevTotal, adTypeStr);
        const weekM: any = {}; let curCumul = isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(); let prevCumul = isMedia?getBaseMetricsMedia():getBaseMetricsCommerce();
        
        weeks.forEach(w => { 
          Object.keys(curCumul).forEach(k => curCumul[k] += g.weeks[w].cur[k]); Object.keys(prevCumul).forEach(k => prevCumul[k] += g.weeks[w].prev[k]);
          weekM[w] = { cur: getDisplayMetricsArray(curCumul, adTypeStr), prev: getDisplayMetricsArray(prevCumul, adTypeStr) }; 
        });

        curTotM.forEach((mc, i) => {
          let rowCls = i%2===0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50'); 
          if(i===0) rowCls += ' group-start';
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide">${mc.name}</td>`;
          weeks.forEach(w => {
            const wc = weekM[w].cur[i], wp = weekM[w].prev[i];
            tbody += `<td class="px-4 py-3 text-right font-mono font-semibold border-l ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">${wc.fmt}</td><td class="px-4 py-3 text-right font-mono font-medium text-slate-400">${wp.fmt}</td>${getGrHTML(wc.raw, wp.raw, wc.isInv)}`;
          });
          const mp = prevTotM[i];
          tbody += `<td class="px-4 py-3 text-right font-mono border-l ${isDarkMode ? 'border-indigo-500 text-indigo-300 bg-indigo-950/50' : 'border-slate-200 text-indigo-700 bg-indigo-50/50'} font-bold">${mc.fmt}</td><td class="px-4 py-3 text-right font-mono font-medium text-slate-500 ${isDarkMode ? 'bg-indigo-950/50' : 'bg-indigo-50/50'}">${mp.fmt}</td>${getGrHTML(mc.raw, mp.raw, mc.isInv)}</tr>`;
        });
      });
    } else if (granularity === 'daily') {
      let daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); let days = Array.from(daysFound).sort(); 
      thead = `<tr><th class="sticky-col ${thClass}">${isMedia?'Ad Type':'Platform'}</th><th class="sticky-col-2 ${thClass}">${isMedia?'Format':'Ad Type'}</th><th class="sticky-col-3 ${thClass}">Metric</th>`;
      days.forEach(d => { const parts = d.split('-'); const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2])); thead += `<th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 z-30">${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}</th>`; });
      thead += `<th class="px-4 py-4 text-right text-indigo-300 border-l border-slate-700 font-bold bg-[#020617] sticky top-0 z-30">Period Total</th></tr>`;

      const grouped: any = {};
      ctxCurData.forEach(r => {
        const k1 = isMedia ? String(r[cnf.colAdType]) : String(r[cnf.colPlatform]); const k2 = isMedia ? String(r[cnf.colFormat]) : String(r[cnf.colAdType]);
        if (!filterRow(k1, k2)) return;
        const k = k1 + '_|_' + k2;
        if(!grouped[k]) { grouped[k] = { total: isMedia?getBaseMetricsMedia():getBaseMetricsCommerce(), days: {}, dim1: k1, dim2: k2 }; days.forEach(d => grouped[k].days[d] = isMedia?getBaseMetricsMedia():getBaseMetricsCommerce()); }
        sumMetricsData(grouped[k].total, r); sumMetricsData(grouped[k].days[r.bucket], r);
      });

      Object.values(grouped).forEach((g: any) => {
        const adTypeStr = String(isMedia ? g.dim1 : g.dim2).toLowerCase();
        const totM = getDisplayMetricsArray(g.total, adTypeStr);
        const dayM: any = {}; days.forEach(d => { dayM[d] = getDisplayMetricsArray(g.days[d], adTypeStr); });

        totM.forEach((mc, i) => {
          let rowCls = i%2===0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50'); 
          if(i===0) rowCls += ' group-start';
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${totM.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${totM.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide">${mc.name}</td>`;
          days.forEach(d => { tbody += `<td class="px-4 py-3 text-right font-mono font-semibold">${dayM[d][i].fmt}</td>`; });
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-indigo-300 bg-indigo-950/50 border-l border-indigo-800/50' : 'text-indigo-700 bg-indigo-50/50 border-l border-indigo-100'}">${mc.fmt}</td></tr>`;
        });
      });
    }

    return { head: thead, body: tbody, uniqueDim1: Array.from(dim1Set).sort(), uniqueDim2: Array.from(dim2Set).sort() };
  }, [ctxCurData, ctxPrevData, granularity, activeEngine, globalDates, tableColFilter1, tableColFilter2, isDarkMode]);

  // --- MODERN LOGIN 60/40 CONTEMPORARY GEOMETRIC ART ---
  if (currentView === 'login') {
    return (
      <div className="flex w-full h-screen font-sans overflow-hidden bg-white">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes checkmark { 0% { stroke-dashoffset: 100; opacity: 0; } 100% { stroke-dashoffset: 0; opacity: 1; } }
          .animate-enter { animation: slideUp 0.5s ease-out forwards; }
          .checkmark-path { stroke-dasharray: 100; stroke-dashoffset: 100; animation: checkmark 0.6s ease-in-out forwards; }
        `}} />
        
        {/* LEFT 60%: Bauhaus/Contemporary Geometric Art Theme */}
        <div className="hidden md:grid w-[60%] grid-cols-4 grid-rows-4 h-full bg-[#0f172a]">
           <div className="bg-[#f1f5f9] rounded-br-full col-span-1 row-span-1"></div>
           <div className="bg-[#4f46e5] col-span-2 row-span-1"></div>
           <div className="bg-[#f472b6] rounded-bl-full col-span-1 row-span-1"></div>
           
           <div className="bg-[#3730a3] flex items-center justify-center col-span-1 row-span-2">
              <div className="w-24 h-24 bg-[#fcd34d] rounded-full"></div>
           </div>
           <div className="bg-[#0f172a] col-span-1 row-span-1 rounded-br-full border-b-[40px] border-r-[40px] border-[#10b981]"></div>
           <div className="bg-[#e2e8f0] col-span-1 row-span-2 rounded-tl-[150px]"></div>
           <div className="bg-[#e2e8f0] col-span-1 row-span-1 rounded-bl-full relative overflow-hidden">
               <div className="absolute top-0 right-0 w-full h-full bg-[#10b981] rounded-bl-full transform translate-x-1/4 -translate-y-1/4"></div>
           </div>

           <div className="bg-[#38bdf8] rounded-tr-full col-span-1 row-span-1"></div>
           <div className="bg-[#b45309] col-span-1 row-span-2 flex flex-col items-center justify-center gap-2">
              <div className="w-4 h-4 bg-[#f8fafc] rounded-full"></div>
              <div className="w-12 h-6 bg-[#f8fafc] rounded-b-full"></div>
              <div className="w-12 h-6 bg-[#f8fafc] rounded-b-full"></div>
           </div>
           <div className="bg-[#0f172a] col-span-1 row-span-1"></div>

           <div className="bg-[#fbcfe8] rounded-tr-[100px] col-span-1 row-span-1 flex items-end">
              <div className="w-full h-1/2 bg-[#f472b6] rounded-tr-full"></div>
           </div>
           <div className="bg-[#0f172a] col-span-1 row-span-1"></div>
           <div className="bg-[#e2e8f0] col-span-1 row-span-1 rounded-tl-full"></div>
        </div>

        {/* RIGHT 40%: Minimalist Form */}
        <div className="w-full md:w-[40%] flex flex-col justify-center px-12 lg:px-20 bg-white relative z-20">
           {isLoginSuccess ? (
              <div className="flex flex-col items-center justify-center animate-enter text-center">
                 <svg className="w-20 h-20 text-emerald-500 mb-6" viewBox="0 0 52 52" fill="none">
                    <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <path className="checkmark-path" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                 </svg>
                 <h2 className="text-2xl font-black text-slate-900">Success</h2>
                 <p className="text-slate-500 font-medium">Loading workspace...</p>
              </div>
           ) : (
              <div className="w-full max-w-sm animate-enter">
                <h2 className="text-[clamp(1.75rem,2.5vw,2.5rem)] font-black text-slate-900 tracking-tight mb-2">Sign in</h2>
                <p className="text-sm text-slate-500 font-medium mb-12">Enter your credentials to continue.</p>
                
                <form onSubmit={handleLogin} className="space-y-8">
                  <div className="relative group">
                    <input name="username" type="text" required placeholder=" " className="peer w-full bg-transparent border-b-2 border-slate-200 text-slate-900 font-bold py-3 outline-none focus:border-indigo-600 transition-colors placeholder-transparent" />
                    <label className="absolute left-0 top-3 text-slate-400 font-semibold text-sm transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-indigo-600 peer-valid:-top-4 peer-valid:text-xs peer-valid:text-slate-500 cursor-text pointer-events-none">Email Address</label>
                  </div>
                  <div className="relative group">
                    <input name="password" type="password" required placeholder=" " className="peer w-full bg-transparent border-b-2 border-slate-200 text-slate-900 font-bold py-3 outline-none focus:border-indigo-600 transition-colors placeholder-transparent" />
                    <label className="absolute left-0 top-3 text-slate-400 font-semibold text-sm transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-indigo-600 peer-valid:-top-4 peer-valid:text-xs peer-valid:text-slate-500 cursor-text pointer-events-none">Password</label>
                  </div>
                  
                  {loginError && <div className="text-rose-500 text-xs font-bold">{loginError}</div>}
                  
                  <button type="submit" className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-bold py-4 rounded-full transition-colors mt-8 text-sm">
                    Continue
                  </button>
                </form>
              </div>
           )}
        </div>
      </div>
    );
  }

  if (currentView === 'welcome') {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-6xl w-full text-center">
          <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-black text-white mb-4 tracking-tight">Select Workspace</h1>
          <p className="text-slate-400 mb-16 text-[clamp(1rem,1.5vw,1.25rem)] font-medium">Choose a tracking module to begin.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <button onClick={() => selectEngine('media')} className="bg-[#1e293b] p-10 rounded-[2rem] hover:bg-[#27354f] transition-all group">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-8"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></div>
              <h2 className="text-2xl font-bold text-white mb-2">Digital Media</h2><p className="text-sm text-slate-400">Analyze full-funnel media metrics.</p>
            </button>
            <button onClick={() => selectEngine('commerce')} className="bg-[#1e293b] p-10 rounded-[2rem] hover:bg-[#27354f] transition-all group">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-8"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
              <h2 className="text-2xl font-bold text-white mb-2">Commerce Tracker</h2><p className="text-sm text-slate-400">Analyze revenue and ROAS.</p>
            </button>
            <button onClick={() => selectEngine('creative')} className="bg-[#1e293b] p-10 rounded-[2rem] hover:bg-[#27354f] transition-all group">
              <div className="w-16 h-16 bg-lime-500 text-white rounded-2xl flex items-center justify-center mb-8"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
              <h2 className="text-2xl font-bold text-white mb-2">Top Creative</h2><p className="text-sm text-slate-400">Review assets and insights.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null; // Prevents render error if states bug out, though Dashboard renders via above
}