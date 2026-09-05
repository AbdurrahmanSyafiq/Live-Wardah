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
        if (rowDate >= dates.curStart && rowDate <= dates.curMtdEnd) { row.bucket = "W" + getWeekBucket(rowDate, dates.curStart); cData.push(row); }
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

  // Context filtering ONLY for Chart and Table
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

  // SUMMARY CARDS: Stays visible across all platforms
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
    calc(curData, false); calc(prevData, true);
    return totals;
  }, [curData, prevData, activeEngine]);

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
    calc(curData, false); calc(prevData, true);
    const calcRoas = (g: number, e: number) => e > 0 ? (g / e).toFixed(2) + 'x' : '0.00x';
    return {
      overall: { ...totals.overall, roas: calcRoas(totals.overall.gmv, totals.overall.exp), pRoas: calcRoas(totals.overall.pGmv, totals.overall.pExp), roasNum: totals.overall.exp>0?totals.overall.gmv/totals.overall.exp:0, pRoasNum: totals.overall.pExp>0?totals.overall.pGmv/totals.overall.pExp:0 },
      tiktok: { ...totals.tiktok, roas: calcRoas(totals.tiktok.gmv, totals.tiktok.exp), pRoas: calcRoas(totals.tiktok.pGmv, totals.tiktok.pExp), roasNum: totals.tiktok.exp>0?totals.tiktok.gmv/totals.tiktok.exp:0, pRoasNum: totals.tiktok.pExp>0?totals.tiktok.pGmv/totals.tiktok.pExp:0 },
      shopee: { ...totals.shopee, roas: calcRoas(totals.shopee.gmv, totals.shopee.exp), pRoas: calcRoas(totals.shopee.pGmv, totals.shopee.pExp), roasNum: totals.shopee.exp>0?totals.shopee.gmv/totals.shopee.exp:0, pRoasNum: totals.shopee.pExp>0?totals.shopee.pGmv/totals.shopee.pExp:0 }
    };
  }, [curData, prevData, activeEngine]);

  const renderGR = (cur: number, prev: number, isInv = false) => {
    if (granularity === 'daily' || prevData.length === 0) return null;
    const gr = getGr(cur, prev);
    let color = isDarkMode ? "text-slate-200 bg-slate-700/50" : "text-white bg-white/30"; let arrow = "";
    if (gr > 0) { color = isInv ? "text-white bg-rose-500/60" : "text-white bg-emerald-500/60"; arrow = "▲"; } 
    else if (gr < 0) { color = isInv ? "text-white bg-emerald-500/60" : "text-white bg-rose-500/60"; arrow = "▼"; } 
    else return <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded font-bold ${color}`}>-</span>;
    return <span className={`text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold tracking-wide backdrop-blur-sm shadow-sm ${color}`}>{arrow} {formatPct(Math.abs(gr))}</span>;
  };

  // --- CHART RENDERING ---
  useEffect(() => {
    if ((activeEngine !== 'media' && activeEngine !== 'commerce') || !chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const groupedData: Record<string, any> = {};
    const isMedia = activeEngine === 'media';

    if (granularity === 'weekly' && globalDates) {
      let weeksFound = new Set<string>();
      ctxCurData.forEach(r => { if (r.bucket && r.bucket.startsWith('W')) weeksFound.add(r.bucket); });
      ctxPrevData.forEach(r => { if (r.bucket && r.bucket.startsWith('W')) weeksFound.add(r.bucket); });
      let weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));

      let curRunning = isMedia ? { spend: 0, imp: 0, clicks: 0, views: 0 } : { exp: 0, gmv: 0, orders: 0 };
      let prevRunning = isMedia ? { spend: 0, imp: 0, clicks: 0, views: 0 } : { exp: 0, gmv: 0, orders: 0 };

      weeks.forEach(w => {
        const weekNum = parseInt(w.replace('W', ''));
        let curD = new Date(globalDates.curStart);
        curD.setDate(curD.getDate() + (weekNum * 7) - 1);
        if (curD > globalDates.curMtdEnd) curD = new Date(globalDates.curMtdEnd);

        let prevD = new Date(globalDates.prevStart);
        prevD.setDate(prevD.getDate() + (weekNum * 7) - 1);
        if (prevD > globalDates.prevMtdEnd) prevD = new Date(globalDates.prevMtdEnd);

        const fmtStr = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
        const curLabel = `MTD ${fmtStr(curD)}`;
        const prevLabel = `MTD ${fmtStr(prevD)}`;

        ctxCurData.filter(r => r.bucket === w).forEach(row => {
          if (isMedia) {
            curRunning.spend += parseNum(row['Ad Spend']);
            curRunning.imp += parseNum(row['Impressions']);
            curRunning.clicks += parseNum(row['Combined Clicks']);
            curRunning.views += parseNum(row['Views']) + parseNum(row['Views 6s']);
          } else {
            curRunning.exp += parseNum(row['Expense']);
            curRunning.gmv += parseNum(row['GMV']);
            curRunning.orders += parseNum(row['Orders']);
          }
        });

        ctxPrevData.filter(r => r.bucket === w).forEach(row => {
          if (isMedia) {
            prevRunning.spend += parseNum(row['Ad Spend']);
            prevRunning.imp += parseNum(row['Impressions']);
            prevRunning.clicks += parseNum(row['Combined Clicks']);
            prevRunning.views += parseNum(row['Views']) + parseNum(row['Views 6s']);
          } else {
            prevRunning.exp += parseNum(row['Expense']);
            prevRunning.gmv += parseNum(row['GMV']);
            prevRunning.orders += parseNum(row['Orders']);
          }
        });

        groupedData[curLabel] = { ...curRunning };
        groupedData[prevLabel] = { ...prevRunning };
      });
    } else {
      const sortedData = [...ctxChartData].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
      sortedData.forEach(row => {
        const d = row.parsedDate;
        let label = "";
        if (granularity === 'monthly') {
          const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          label = `${mNames[d.getMonth()]} ${d.getFullYear()}`;
        } else {
          label = `${d.getDate()}/${d.getMonth()+1}`;
        }

        if (!groupedData[label]) groupedData[label] = isMedia ? { spend: 0, imp: 0, clicks: 0, views: 0 } : { exp: 0, gmv: 0, orders: 0 };
        
        if (isMedia) {
          groupedData[label].spend += parseNum(row['Ad Spend']); groupedData[label].imp += parseNum(row['Impressions']);
          groupedData[label].clicks += parseNum(row['Combined Clicks']); groupedData[label].views += parseNum(row['Views']) + parseNum(row['Views 6s']);
        } else {
          groupedData[label].exp += parseNum(row['Expense']); groupedData[label].gmv += parseNum(row['GMV']); groupedData[label].orders += parseNum(row['Orders']);
        }
      });
    }

    const labels = Object.keys(groupedData);
    if (labels.length === 0) return;
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
  }, [ctxChartData, ctxCurData, ctxPrevData, globalDates, chartMetricsMedia, chartMetricsComm, activeEngine, granularity, isDarkMode]);

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
      if (cur === 0 && prev === 0) return `<td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">0.00%</td>`;
      let color = isDarkMode ? "text-slate-400" : "text-slate-500";
      if (gr > 0) color = invertColors ? "text-red-600 bg-red-50" : "text-emerald-700 bg-emerald-50";
      if (gr < 0) color = invertColors ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50";
      
      if (isDarkMode) {
          if (gr > 0) color = invertColors ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10";
          if (gr < 0) color = invertColors ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10";
      }
      return `<td class="px-4 py-3 text-right font-mono font-bold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}"><span class="px-2.5 py-1 rounded-lg ${color}">${formatPct(Math.abs(gr))}</span></td>`;
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
        <th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 border-b border-slate-700">This Month</th>
        <th class="px-4 py-4 text-right font-bold text-slate-400 bg-[#0f172a] sticky top-0 border-b border-slate-700">Prev Month</th>
        <th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 border-b border-slate-700">GR%</th>
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
          if(i===mCur.length - 1) rowCls += ' group-end';
          
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.name}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.fmt}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mp.fmt}</td>`;
          tbody += getGrHTML(mc.raw, mp.raw, mc.isInv);
          tbody += '</tr>';
        });
      });
    } else if (granularity === 'weekly') {
      let weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
      let weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W',''))); 
      thead = `<tr>
        <th class="sticky-col ${thClass}">${isMedia?'Ad Type':'Platform'}</th>
        <th class="sticky-col-2 ${thClass}">${isMedia?'Format':'Ad Type'}</th>
        <th class="sticky-col-3 ${thClass}">Metric</th>`;
      weeks.forEach(w => {
        const weekNum = parseInt(w.replace('W', ''));
        let curD = new Date(globalDates.curStart); curD.setDate(curD.getDate() + (weekNum * 7) - 1); if (curD > globalDates.curMtdEnd) curD = new Date(globalDates.curMtdEnd);
        let prevD = new Date(globalDates.prevStart); prevD.setDate(prevD.getDate() + (weekNum * 7) - 1); if (prevD > globalDates.prevMtdEnd) prevD = new Date(globalDates.prevMtdEnd);
        const fmtStr = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
        thead += `<th class="px-4 py-4 text-right bg-[#0f172a] border-l border-slate-700 font-bold text-white sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD ${fmtStr(curD)}</th>
                  <th class="px-4 py-4 text-right text-slate-400 bg-[#0f172a] font-bold sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD ${fmtStr(prevD)}</th>
                  <th class="px-4 py-4 text-right bg-[#0f172a] font-bold text-white sticky top-0 border-b border-slate-700 whitespace-nowrap">GR%</th>`;
      });
      thead += `<th class="px-4 py-4 text-right border-l border-indigo-500 text-indigo-300 font-bold bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD Total Cur</th>
                <th class="px-4 py-4 text-right text-slate-400 font-bold bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD Total Prev</th>
                <th class="px-4 py-4 text-right text-indigo-300 font-bold bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">Total GR%</th>
              </tr>`;

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
          if(i===curTotM.length - 1) rowCls += ' group-end';
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.name}</td>`;
          weeks.forEach(w => {
            const wc = weekM[w].cur[i], wp = weekM[w].prev[i];
            tbody += `<td class="px-4 py-3 text-right font-mono font-semibold border-l ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${wc.fmt}</td>
                      <td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${wp.fmt}</td>
                      ${getGrHTML(wc.raw, wp.raw, wc.isInv)}`;
          });
          const mp = prevTotM[i];
          tbody += `<td class="px-4 py-3 text-right font-mono border-l ${isDarkMode ? 'border-indigo-500 text-indigo-300 bg-indigo-950/50' : 'border-slate-200 text-indigo-700 bg-indigo-50/50'} font-bold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.fmt}</td>
                    <td class="px-4 py-3 text-right font-mono font-medium text-slate-500 ${isDarkMode ? 'bg-indigo-950/50' : 'bg-indigo-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mp.fmt}</td>
                    ${getGrHTML(mc.raw, mp.raw, mc.isInv)}</tr>`;
        });
      });
    } else if (granularity === 'daily') {
      let daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); let days = Array.from(daysFound).sort(); 
      thead = `<tr>
        <th class="sticky-col ${thClass}">${isMedia?'Ad Type':'Platform'}</th>
        <th class="sticky-col-2 ${thClass}">${isMedia?'Format':'Ad Type'}</th>
        <th class="sticky-col-3 ${thClass}">Metric</th>`;
      days.forEach(d => { 
        const parts = d.split('-'); const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2])); 
        thead += `<th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 border-b border-slate-700 whitespace-nowrap">${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}</th>`; 
      });
      thead += `<th class="px-4 py-4 text-right text-indigo-300 border-l border-slate-700 font-bold bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">Period Total</th></tr>`;

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
          if(i===totM.length - 1) rowCls += ' group-end';
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${totM.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${totM.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.name}</td>`;
          days.forEach(d => { tbody += `<td class="px-4 py-3 text-right font-mono font-semibold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${dayM[d][i].fmt}</td>`; });
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-indigo-300 bg-indigo-950/50 border-l border-indigo-800/50' : 'text-indigo-700 bg-indigo-50/50 border-l border-indigo-100'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.fmt}</td></tr>`;
        });
      });
    }

    return { head: thead, body: tbody, uniqueDim1: Array.from(dim1Set).sort(), uniqueDim2: Array.from(dim2Set).sort() };
  }, [ctxCurData, ctxPrevData, granularity, activeEngine, globalDates, tableColFilter1, tableColFilter2, isDarkMode]);

  const getDrivePreviewLink = (url: string) => {
    if (!url || typeof url !== 'string') return '';
    if (url.includes('/preview')) return url;
    if (url.includes('/view')) return url.replace('/view', '/preview');
    let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://drive.google.com/file/d/${match[1]}/preview`;
    return url;
  };
  const getInstagramEmbedLink = (url: string) => {
    if (!url || typeof url !== 'string') return '';
    if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/')) {
        let cleanUrl = url.split('?')[0];
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
        return cleanUrl.endsWith('/embed') ? cleanUrl : cleanUrl + '/embed';
    }
    return '';
  };

  // --- LOGIN VIEW: BAUHAUS ABSTRACT ART (LINES, RANDOM CIRCLES, BLOCKS) ---
  if (currentView === 'login') {
    return (
      <div className="flex w-full h-screen font-sans overflow-hidden bg-white">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes checkmark { 0% { stroke-dashoffset: 100; opacity: 0; } 100% { stroke-dashoffset: 0; opacity: 1; } }
          .animate-enter { animation: slideUp 0.5s ease-out forwards; }
          .checkmark-path { stroke-dasharray: 100; stroke-dashoffset: 100; animation: checkmark 0.6s ease-in-out forwards; }
        `}} />
        
        {/* LEFT 60%: Bauhaus Abstract Geometric Art (Reference Style) */}
        <div className="hidden md:block w-[60%] h-full relative bg-[#1e1e24] overflow-hidden">
           <svg viewBox="0 0 900 600" className="w-full h-full" preserveAspectRatio="none">
              <rect width="900" height="600" fill="#1e1e24" />

              {/* Large Beige Arch / Block */}
              <path d="M 0 0 L 320 0 L 320 400 C 320 480 250 540 160 540 L 0 540 Z" fill="#f3ebd8" />

              {/* Teal Rounded Block */}
              <path d="M 320 200 L 580 200 C 630 200 670 240 670 290 C 670 340 630 380 580 380 L 320 380 Z" fill="#164e58" />

              {/* Large Pale Circle Right */}
              <circle cx="780" cy="350" r="220" fill="#f3ebd8" />

              {/* Yellow Floating Circle Left */}
              <circle cx="160" cy="320" r="90" fill="#f6b93b" />

              {/* Top Right Pink Semi-Circle / Quarter */}
              <path d="M 700 0 C 820 0 900 80 900 200 L 700 200 Z" fill="#f3b6c8" />

              {/* Top Right Cyan Accent Corner */}
              <polygon points="900,0 900,90 810,0" fill="#4ec5db" />

              {/* Bottom Left Pink Wavy / Organic Shape */}
              <path d="M 0 470 C 50 450 90 520 140 500 C 190 480 220 420 270 430 L 0 600 Z" fill="#f3b6c8" />

              {/* Bottom Center Brown & Beige Segments */}
              <rect x="450" y="380" width="130" height="220" fill="#b47b4e" />
              <path d="M 450 470 C 450 430 580 430 580 470 Z" fill="#f3ebd8" />
              <path d="M 450 560 C 450 520 580 520 580 560 Z" fill="#f3ebd8" />
              <circle cx="515" cy="415" r="8" fill="#f3ebd8" />

              {/* Top Center Solid Charcoal Block */}
              <rect x="320" y="0" width="260" height="200" fill="#1e1e24" />

              {/* Additional Brown Vertical Block */}
              <rect x="580" y="0" width="120" height="200" fill="#b47b4e" />
           </svg>
        </div>

        {/* RIGHT 40%: Form */}
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
                <h2 className="text-[clamp(2rem,3vw,3rem)] font-black text-slate-900 tracking-tight mb-2">Welcome Back</h2>
                <p className="text-sm text-slate-500 font-medium mb-12">Enter your credentials to continue.</p>
                
                <form onSubmit={handleLogin} className="space-y-8">
                  <div className="relative group">
                    <input name="username" type="text" required placeholder=" " className="peer w-full bg-transparent border-b-2 border-slate-200 text-slate-900 font-bold py-3 outline-none focus:border-indigo-600 transition-colors placeholder-transparent" />
                    <label className="absolute left-0 top-3 text-slate-400 font-semibold text-sm transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-indigo-600 peer-valid:-top-4 peer-valid:text-xs peer-valid:text-slate-500 cursor-text pointer-events-none">Username</label>
                  </div>
                  <div className="relative group">
                    <input name="password" type="password" required placeholder=" " className="peer w-full bg-transparent border-b-2 border-slate-200 text-slate-900 font-bold py-3 outline-none focus:border-indigo-600 transition-colors placeholder-transparent" />
                    <label className="absolute left-0 top-3 text-slate-400 font-semibold text-sm transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-indigo-600 peer-valid:-top-4 peer-valid:text-xs peer-valid:text-slate-500 cursor-text pointer-events-none">Password</label>
                  </div>
                  
                  {loginError && <div className="text-rose-500 text-xs font-bold">{loginError}</div>}
                  
                  <button type="submit" className="w-full bg-[#111827] hover:bg-indigo-600 text-white font-bold py-4 rounded-full transition-colors mt-8 text-sm">
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
      <div className="fixed inset-0 z-[100] bg-[#0f172a] flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-6xl w-full text-center">
          <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-black text-white mb-4 tracking-tight">Welcome to All in One Dashboard</h1>
          <p className="text-slate-400 mb-16 text-[clamp(1rem,1.5vw,1.25rem)] font-medium">Please select the first tracker you wish to launch. You can navigate between them at any time.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <button onClick={() => selectEngine('media')} className="bg-[#1e293b] p-10 rounded-3xl hover:bg-[#27354f] transition-all group">
              <div className="w-16 h-16 bg-indigo-500 text-white rounded-2xl flex items-center justify-center mb-8"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></div>
              <h2 className="text-2xl font-bold text-white mb-2">Digital Media</h2><p className="text-sm text-slate-400">Analyze full-funnel media metrics.</p>
            </button>
            <button onClick={() => selectEngine('commerce')} className="bg-[#1e293b] p-10 rounded-3xl hover:bg-[#27354f] transition-all group">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-8"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
              <h2 className="text-2xl font-bold text-white mb-2">Commerce Tracker</h2><p className="text-sm text-slate-400">Analyze revenue and ROAS.</p>
            </button>
            <button onClick={() => selectEngine('creative')} className="bg-[#1e293b] p-10 rounded-3xl hover:bg-[#27354f] transition-all group">
              <div className="w-16 h-16 bg-lime-500 text-white rounded-2xl flex items-center justify-center mb-8"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
              <h2 className="text-2xl font-bold text-white mb-2">Top Creative</h2><p className="text-sm text-slate-400">Review winning creative assets, video metrics, and key insights.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD UI ---
  const selectClass = "w-full bg-[#1e293b] border border-[#334155] text-slate-100 py-3 px-4 rounded-xl text-sm font-semibold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none dropdown-arrow hover:border-[#475569] transition-colors";
  const dateClass = "w-full bg-white border border-slate-200 text-slate-800 py-2.5 px-4 rounded-full text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center";
  const dateClassDark = "w-full bg-[#1e293b] border border-indigo-500/50 text-indigo-300 py-2.5 px-4 rounded-full text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer text-center";

  return (
    <div className={`w-full min-h-screen flex font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`}>
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        
        table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }

        /* Default Header: Sticky Top */
        thead th {
          position: sticky !important;
          top: 0 !important;
          z-index: 30 !important;
          background-color: #0f172a !important;
        }

        /* Locked Top-Left Headers: Column 1, 2, 3 (Sticky BOTH Top and Left) */
        thead th.sticky-col {
          position: sticky !important;
          top: 0 !important;
          left: 0px !important;
          z-index: 60 !important;
          background-color: #0f172a !important;
          width: 180px !important;
          min-width: 180px !important;
          max-width: 180px !important;
          border-right: 1px solid #334155 !important;
          border-bottom: 2px solid #334155 !important;
        }

        thead th.sticky-col-2 {
          position: sticky !important;
          top: 0 !important;
          left: 180px !important;
          z-index: 60 !important;
          background-color: #0f172a !important;
          width: 180px !important;
          min-width: 180px !important;
          max-width: 180px !important;
          border-right: 1px solid #334155 !important;
          border-bottom: 2px solid #334155 !important;
        }

        thead th.sticky-col-3 {
          position: sticky !important;
          top: 0 !important;
          left: 360px !important;
          z-index: 60 !important;
          background-color: #0f172a !important;
          width: 120px !important;
          min-width: 120px !important;
          max-width: 120px !important;
          border-right: 1px solid #334155 !important;
          border-bottom: 2px solid #334155 !important;
          box-shadow: 4px 0 10px -3px rgba(0,0,0,0.3) !important;
        }

        /* Sticky Body Columns: Columns 1, 2, 3 */
        tbody td.sticky-col {
          position: sticky !important;
          left: 0px !important;
          z-index: 20 !important;
          width: 180px !important;
          min-width: 180px !important;
          max-width: 180px !important;
          border-right: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'} !important;
        }

        tbody td.sticky-col-2 {
          position: sticky !important;
          left: 180px !important;
          z-index: 20 !important;
          width: 180px !important;
          min-width: 180px !important;
          max-width: 180px !important;
          border-right: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'} !important;
        }

        tbody td.sticky-col-3 {
          position: sticky !important;
          left: 360px !important;
          z-index: 20 !important;
          width: 120px !important;
          min-width: 120px !important;
          max-width: 120px !important;
          border-right: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'} !important;
          box-shadow: 4px 0 10px -3px rgba(0,0,0,0.08) !important;
        }

        /* Clean Separator Line Between Data Groups (Ad Types/Formats) */
        tr.group-start:not(:first-child) td {
          border-top: 2.5px solid ${isDarkMode ? '#64748b' : '#94a3b8'} !important;
        }
        tr.group-start td[rowspan] {
          border-bottom: 2.5px solid ${isDarkMode ? '#64748b' : '#94a3b8'} !important;
        }
        tr.group-end td {
          border-bottom: 2.5px solid ${isDarkMode ? '#64748b' : '#94a3b8'} !important;
        }
        
        .dropdown-arrow {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e");
          background-position: right center;
          background-repeat: no-repeat;
          background-size: 1rem 1rem;
        }
        select option { background-color: #0f172a; color: #f1f5f9; padding: 10px; }

        input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator {
          cursor: pointer; opacity: 0.6; transition: 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover, input[type="month"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }

        .spinner-large {
          border: 4px solid rgba(132, 224, 37, 0.2);
          border-top: 4px solid #84e025;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}} />

      {isLoading && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="spinner-large mb-4"></div>
          <h3 className="font-bold text-white text-sm tracking-wide">Fetching Data...</h3>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`${isSidebarOpen ? 'w-[300px] translate-x-0' : 'w-0 -translate-x-full lg:w-0'} bg-[#0f172a] border-r border-[#1e293b] h-screen fixed lg:static overflow-y-auto flex-shrink-0 transition-all duration-300 ease-in-out z-40 text-slate-300 flex flex-col`}>
        <div className="p-6 border-b border-[#1e293b] flex justify-between items-center bg-[#0f172a] sticky top-0 z-20">
          <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">PC Brands<br/>All in One Tracker</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white">✕</button>
        </div>
        
        <div className="pt-6 pb-4 px-5 space-y-1.5 border-b border-[#1e293b]">
          <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Workspaces</p>
          <button onClick={() => selectEngine('media')} className={`w-full text-left px-4 py-3.5 rounded-xl text-sm flex items-center gap-3 font-semibold transition-all ${activeEngine === 'media' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#1e293b] text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Digital Media
          </button>
          <button onClick={() => selectEngine('commerce')} className={`w-full text-left px-4 py-3.5 rounded-xl text-sm flex items-center gap-3 font-semibold transition-all ${activeEngine === 'commerce' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#1e293b] text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>Commerce Tracker
          </button>
          <button onClick={() => selectEngine('creative')} className={`w-full text-left px-4 py-3.5 rounded-xl text-sm flex items-center gap-3 font-semibold transition-all ${activeEngine === 'creative' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#1e293b] text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Top Creative
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Filters</p>
          
          {activeEngine !== 'creative' && (
             <div className="bg-[#1e293b] p-4 rounded-2xl border border-[#334155] space-y-3 shadow-inner">
                <div className="flex items-center justify-between mb-1">
                   <label className="text-xs font-bold text-slate-400">Date Range</label>
                   <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="bg-transparent text-indigo-400 text-xs font-bold outline-none cursor-pointer appearance-none pr-8 text-right dropdown-arrow bg-[length:12px_12px] bg-[position:right_center]">
                     <option value="monthly">Monthly</option><option value="weekly">Weekly MTD</option><option value="daily">Daily</option>
                   </select>
                </div>
                
                {granularity === 'monthly' && <input type="month" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} className={isDarkMode ? dateClassDark : dateClass} />}
                {granularity === 'weekly' && <input type="date" value={dateWeekly} onChange={(e) => setDateWeekly(e.target.value)} className={isDarkMode ? dateClassDark : dateClass} />}
                {granularity === 'daily' && (
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center w-full">
                     <input type="date" value={dateDailyStart} onChange={(e) => setDateDailyStart(e.target.value)} className={`${isDarkMode ? dateClassDark : dateClass} !px-1 !text-xs w-full min-w-0`} />
                     <span className="text-slate-500 font-bold text-center">-</span>
                     <input type="date" value={dateDailyEnd} onChange={(e) => setDateDailyEnd(e.target.value)} className={`${isDarkMode ? dateClassDark : dateClass} !px-1 !text-xs w-full min-w-0`} />
                  </div>
                )}
             </div>
          )}

          <div className="space-y-4 px-2">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Brand</label>
              <select value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)} className={selectClass}>
                {getDependentOptions(CONFIG[activeEngine || 'media'].colBrand, 'brand').map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {activeEngine === 'media' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Funnel</label>
                <select value={filters.funnel} onChange={(e) => handleFilterChange('funnel', e.target.value)} className={selectClass}>
                  {getDependentOptions(CONFIG.media.colFunnel, 'funnel').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {(activeEngine === 'commerce' || activeEngine === 'creative') && (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Ad Type</label>
                <select value={filters.adType} onChange={(e) => handleFilterChange('adType', e.target.value)} className={selectClass}>
                  {getDependentOptions(activeEngine === 'commerce' ? CONFIG.commerce.colAdType : CONFIG.creative.colAdType, 'adType').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {activeEngine === 'creative' && (
              <>
                <div><label className="block text-xs font-bold text-slate-400 mb-2">Period</label><select value={filters.period} onChange={(e) => handleFilterChange('period', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colPeriod, 'period').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-400 mb-2">Platform</label><select value={filters.platform} onChange={(e) => handleFilterChange('platform', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colPlatform, 'platform').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-400 mb-2">Format</label><select value={filters.format} onChange={(e) => handleFilterChange('format', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colFormat, 'format').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              </>
            )}
          </div>
        </div>
        <div className="p-6 bg-[#0f172a] border-t border-[#1e293b]">
          <button onClick={() => loadData(activeEngine as any, true)} className="w-full bg-slate-800 hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl border border-slate-700 hover:border-indigo-500 shadow-md transition-all flex justify-center items-center gap-2 text-sm tracking-wide">Sync Live Data</button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-10 h-screen overflow-y-auto w-full transition-all duration-300 relative">
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`mr-4 p-2.5 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <h1 className={`text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {activeEngine === 'media' ? 'Digital Media' : activeEngine === 'commerce' ? 'Commerce Tracker' : 'Top Creative'}
            </h1>
          </div>

          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all shadow-sm flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* --- VIEW 1: MEDIA TRACKER --- */}
        {activeEngine === 'media' && (
          <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8 mb-10">
               <div onClick={() => setDashboardContext('Overall')} className={`bg-indigo-600 rounded-3xl p-6 lg:p-8 shadow-lg transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'Overall' ? 'ring-4 ring-indigo-300 shadow-indigo-600/40' : ''}`}>
                  <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest">Overall Media</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg></div></div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Spend</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(mediaKPIs.overall.spend)}</span>{renderGR(mediaKPIs.overall.spend, mediaKPIs.overall.pSpend, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Impr</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.overall.impr)}</span>{renderGR(mediaKPIs.overall.impr, mediaKPIs.overall.pImpr, false)}</div></div>
                     <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-indigo-200">Engage</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.overall.engage)}</span>{renderGR(mediaKPIs.overall.engage, mediaKPIs.overall.pEngage, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('Meta')} className={`bg-blue-500 rounded-3xl p-6 lg:p-8 shadow-lg transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'Meta' ? 'ring-4 ring-blue-300 shadow-blue-500/40' : ''}`}>
                  <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-blue-100 uppercase tracking-widest">Meta</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></div></div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-blue-400 pb-3"><span className="text-xs font-bold text-blue-100">Spend</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(mediaKPIs.meta.spend)}</span>{renderGR(mediaKPIs.meta.spend, mediaKPIs.meta.pSpend, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-blue-400 pb-3"><span className="text-xs font-bold text-blue-100">Impr</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.meta.impr)}</span>{renderGR(mediaKPIs.meta.impr, mediaKPIs.meta.pImpr, false)}</div></div>
                     <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-blue-100">Engage</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.meta.engage)}</span>{renderGR(mediaKPIs.meta.engage, mediaKPIs.meta.pEngage, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('TikTok')} className={`bg-slate-800 rounded-3xl p-6 lg:p-8 shadow-lg transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'TikTok' ? 'ring-4 ring-slate-400 shadow-slate-900/40' : ''}`}>
                  <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">TikTok</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Spend</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(mediaKPIs.tiktok.spend)}</span>{renderGR(mediaKPIs.tiktok.spend, mediaKPIs.tiktok.pSpend, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Impr</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.tiktok.impr)}</span>{renderGR(mediaKPIs.tiktok.impr, mediaKPIs.tiktok.pImpr, false)}</div></div>
                     <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-slate-400">Engage</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.tiktok.engage)}</span>{renderGR(mediaKPIs.tiktok.engage, mediaKPIs.tiktok.pEngage, false)}</div></div>
                  </div>
               </div>
            </div>
            
            <div className={`p-6 sm:p-8 lg:p-10 rounded-3xl border shadow-sm mb-10 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-6">
                 <div>
                    <h2 className="text-[clamp(1.25rem,2vw,1.75rem)] font-black tracking-tight" id="chartTitleMedia">{dashboardContext} Historical Trend</h2>
                    <p className={`text-sm font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                       {granularity === 'monthly' ? 'Displaying data for the past 3 months' : granularity === 'weekly' ? 'MTD Comparison Analytics' : 'Interactive Multi-Metric Analytics'}
                    </p>
                 </div>
                 
                 <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-2xl border w-full xl:w-auto shadow-inner ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 opacity-60">Metrics</span>
                    {[{id:'spend',l:'Spend', c:'bg-indigo-600'}, {id:'imp',l:'Impr', c:'bg-emerald-500'}, {id:'clicks',l:'Clicks', c:'bg-lime-500'}, {id:'views',l:'Views', c:'bg-amber-500'}, {id:'ctr',l:'CTR', c:'bg-pink-500'}, {id:'vtr',l:'VTR', c:'bg-teal-500'}].map(m => {
                      const isActive = chartMetricsMedia.includes(m.id);
                      return (
                        <button key={m.id} onClick={() => handleToggleMetric('media', m.id)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isActive ? `${m.c} text-white shadow-md` : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                          {m.l}
                        </button>
                      );
                    })}
                 </div>
               </div>
               <div className="w-full h-[380px]"><canvas ref={chartRef}></canvas></div>
            </div>

            <div className={`rounded-3xl border shadow-sm overflow-hidden mb-10 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
                 <h2 className={`font-black uppercase tracking-wider text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Pivot Analysis Table</h2>
                 
                 <div className="flex flex-wrap gap-3 w-full md:w-auto">
                   <select value={tableColFilter1} onChange={(e) => setTableColFilter1(e.target.value)} className={`dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors ${isDarkMode ? 'border-slate-600 text-indigo-300 hover:border-indigo-500' : 'border-slate-300 text-indigo-700 hover:border-indigo-500 bg-slate-50'}`}>
                     <option value="All">All Ad Types / Platforms</option>
                     {generateTableHTML().uniqueDim1.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                   <select value={tableColFilter2} onChange={(e) => setTableColFilter2(e.target.value)} className={`dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors ${isDarkMode ? 'border-slate-600 text-emerald-300 hover:border-emerald-500' : 'border-slate-300 text-emerald-700 hover:border-emerald-500 bg-slate-50'}`}>
                     <option value="All">All Formats / Ad Types</option>
                     {generateTableHTML().uniqueDim2.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>
               </div>
               <div className="overflow-auto max-h-[600px] relative w-full rounded-b-3xl">
                  <table className={`min-w-full text-left text-[clamp(12px,1vw,14px)] whitespace-nowrap border-separate [border-spacing:0] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    <thead dangerouslySetInnerHTML={{ __html: generateTableHTML().head }} />
                    <tbody dangerouslySetInnerHTML={{ __html: generateTableHTML().body }} />
                  </table>
               </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: COMMERCE TRACKER --- */}
        {activeEngine === 'commerce' && (
          <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8 mb-10">
               <div onClick={() => setDashboardContext('Overall')} className={`bg-indigo-600 rounded-3xl p-6 lg:p-8 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'Overall' ? 'ring-4 ring-indigo-300 shadow-indigo-600/40' : ''}`}>
                  <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest">Overall Commerce</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg></div></div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.overall.exp)}</span>{renderGR(commerceKPIs.overall.exp, commerceKPIs.overall.pExp, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.overall.gmv)}</span>{renderGR(commerceKPIs.overall.gmv, commerceKPIs.overall.pGmv, false)}</div></div>
                     <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-indigo-200">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-300 leading-none">{commerceKPIs.overall.roas}</span>{renderGR(commerceKPIs.overall.roasNum, commerceKPIs.overall.pRoasNum, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('TikTok')} className={`bg-slate-800 rounded-3xl p-6 lg:p-8 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'TikTok' ? 'ring-4 ring-slate-400 shadow-slate-900/40' : ''}`}>
                  <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">TikTok Shop</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.tiktok.exp)}</span>{renderGR(commerceKPIs.tiktok.exp, commerceKPIs.tiktok.pExp, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.tiktok.gmv)}</span>{renderGR(commerceKPIs.tiktok.gmv, commerceKPIs.tiktok.pGmv, false)}</div></div>
                     <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-slate-400">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-400 leading-none">{commerceKPIs.tiktok.roas}</span>{renderGR(commerceKPIs.tiktok.roasNum, commerceKPIs.tiktok.pRoasNum, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('Shopee')} className={`bg-orange-500 rounded-3xl p-6 lg:p-8 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'Shopee' ? 'ring-4 ring-orange-300 shadow-orange-500/40' : ''}`}>
                  <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-orange-100 uppercase tracking-widest">Shopee</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" viewBox="0 0 109.59 122.88" fill="currentColor"><path d="M74.98,91.98C76.15,82.36,69.96,76.22,53.6,71c-7.92-2.7-11.66-6.24-11.57-11.12 c0.33-5.4,5.36-9.34,12.04-9.47c4.63,0.09,9.77,1.22,14.76,4.56c0.59,0.37,1.01,0.32,1.35-0.2c0.46-0.74,1.61-2.53,2-3.17 c0.26-0.42,0.31-0.96-0.35-1.44c-0.95-0.7-3.6-2.13-5.03-2.72c-3.88-1.62-8.23-2.64-12.86-2.63c-9.77,0.04-17.47,6.22-18.12,14.47 c-0.42,5.95,2.53,10.79,8.86,14.47c1.34,0.78,8.6,3.67,11.49,4.57c9.08,2.83,13.8,7.9,12.69,13.81c-1.01,5.36-6.65,8.83-14.43,8.93 c-6.17-0.24-11.71-2.75-16.02-6.1c-0.11-0.08-0.65-0.5-0.72-0.56c-0.53-0.42-1.11-0.39-1.47,0.15c-0.26,0.4-1.92,2.8-2.34,3.43 c-0.39,0.55-0.18,0.86,0.23,1.2c1.8,1.5,4.18,3.14,5.81,3.97c4.47,2.28,9.32,3.53,14.48,3.72c3.32,0.22,7.5-0.49,10.63-1.81 C70.63,102.67,74.25,97.92,74.98,91.98L74.98,91.98z M54.79,7.18c-10.59,0-19.22,9.98-19.62,22.47h39.25 C74.01,17.16,65.38,7.18,54.79,7.18L54.79,7.18z M94.99,122.88l-0.41,0l-80.82-0.01h0c-5.5-0.21-9.54-4.66-10.09-10.19l-0.05-1 l-3.61-79.5v0C0,32.12,0,32.06,0,32c0-1.28,1.03-2.33,2.3-2.35l0,0h25.48C28.41,13.15,40.26,0,54.79,0s26.39,13.15,27.01,29.65 h25.4h0.04c1.3,0,2.35,1.05,2.35,2.35c0,0.04,0,0.08,0,0.12v0l-3.96,79.81l-0.04,0.68C105.12,118.21,100.59,122.73,94.99,122.88 L94.99,122.88z"/></svg></div></div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-orange-400 pb-3"><span className="text-xs font-bold text-orange-100">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.shopee.exp)}</span>{renderGR(commerceKPIs.shopee.exp, commerceKPIs.shopee.pExp, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-orange-400 pb-3"><span className="text-xs font-bold text-orange-100">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.shopee.gmv)}</span>{renderGR(commerceKPIs.shopee.gmv, commerceKPIs.shopee.pGmv, false)}</div></div>
                     <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-orange-100">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-200 leading-none">{commerceKPIs.shopee.roas}</span>{renderGR(commerceKPIs.shopee.roasNum, commerceKPIs.shopee.pRoasNum, false)}</div></div>
                  </div>
               </div>
            </div>
            
            <div className={`p-6 sm:p-8 lg:p-10 rounded-3xl border shadow-sm mb-10 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-6">
                 <div>
                    <h2 className="text-[clamp(1.25rem,2vw,1.75rem)] font-black tracking-tight" id="chartTitleCommerce">{dashboardContext} Historical Trend</h2>
                    <p className={`text-sm font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                       {granularity === 'monthly' ? 'Displaying data for the past 3 months' : granularity === 'weekly' ? 'MTD Comparison Analytics' : 'Interactive Multi-Metric Analytics'}
                    </p>
                 </div>
                 
                 <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-2xl border w-full xl:w-auto shadow-inner ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 opacity-60">Metrics</span>
                    {[{id:'exp',l:'Expense', c:'bg-indigo-600'}, {id:'gmv',l:'GMV', c:'bg-emerald-500'}, {id:'orders',l:'Orders', c:'bg-lime-500'}, {id:'roas',l:'ROAS', c:'bg-amber-500'}, {id:'cpa',l:'CPA', c:'bg-pink-500'}].map(m => {
                      const isActive = chartMetricsComm.includes(m.id);
                      return (
                        <button key={m.id} onClick={() => handleToggleMetric('commerce', m.id)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isActive ? `${m.c} text-white shadow-md` : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                          {m.l}
                        </button>
                      );
                    })}
                 </div>
               </div>
               <div className="w-full h-[380px]"><canvas ref={chartRef}></canvas></div>
            </div>

            <div className={`rounded-3xl border shadow-sm overflow-hidden mb-10 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
                 <h2 className={`font-black uppercase tracking-wider text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Platform & Ad Type Pivot</h2>
                 <div className="flex flex-wrap gap-3 w-full md:w-auto">
                   <select value={tableColFilter1} onChange={(e) => setTableColFilter1(e.target.value)} className={`dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors ${isDarkMode ? 'border-slate-600 text-indigo-300 hover:border-indigo-500' : 'border-slate-300 text-indigo-700 hover:border-indigo-500 bg-slate-50'}`}>
                     <option value="All">All Platforms / Ad Types</option>
                     {generateTableHTML().uniqueDim1.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                   <select value={tableColFilter2} onChange={(e) => setTableColFilter2(e.target.value)} className={`dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors ${isDarkMode ? 'border-slate-600 text-emerald-300 hover:border-emerald-500' : 'border-slate-300 text-emerald-700 hover:border-emerald-500 bg-slate-50'}`}>
                     <option value="All">All Ad Types</option>
                     {generateTableHTML().uniqueDim2.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>
               </div>
               <div className="overflow-auto max-h-[600px] relative w-full rounded-b-3xl">
                  <table className={`min-w-full text-left text-[clamp(12px,1vw,14px)] whitespace-nowrap border-separate [border-spacing:0] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    <thead dangerouslySetInnerHTML={{ __html: generateTableHTML().head }} />
                    <tbody dangerouslySetInnerHTML={{ __html: generateTableHTML().body }} />
                  </table>
               </div>
            </div>
          </div>
        )}

        {/* --- VIEW 3: TOP CREATIVE TRACKER --- */}
        {activeEngine === 'creative' && (
          <div className="max-w-[1600px] mx-auto">
            <div className="space-y-6">
              {creativeData.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center"><p className="text-slate-500 font-bold">No creative data found for the selected filters.</p></div>
              ) : (
                creativeData.slice((creativePage - 1) * CREATIVES_PER_PAGE, creativePage * CREATIVES_PER_PAGE).map((row, index) => {
                  const driveLink = getDrivePreviewLink(row['Creative Link']);
                  const igEmbed = getInstagramEmbedLink(row['Social Link']);
                  const iframeSrc = driveLink || igEmbed;
                  const adType = String(row['Ad Type'] || '').toLowerCase();

                  return (
                    <div key={index} className={`rounded-[2rem] border shadow-sm overflow-hidden flex flex-col xl:flex-row transition-all hover:shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-400'}`}>
                       <div className="w-full xl:w-3/12 border-b xl:border-b-0 xl:border-r border-slate-200 relative bg-[#0f172a]">
                         {iframeSrc ? (
                           <iframe src={iframeSrc} className="w-full h-full min-h-[280px]" frameBorder="0" allowFullScreen></iframe>
                         ) : (
                           <div className="w-full h-full min-h-[280px] flex items-center justify-center text-xs text-slate-500 font-medium">No Preview Available</div>
                         )}
                       </div>
                       
                       <div className="w-full xl:w-9/12 p-6 md:p-8 flex flex-col">
                         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
                           <h3 className={`text-sm md:text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} line-clamp-2`}>
                             {row['Ad Name'] || 'Unknown Ad'}
                           </h3>
                           
                           {row['Social Link'] && row['Social Link'] !== '-' && (
                             <a
                               href={row['Social Link']}
                               target="_blank"
                               rel="noopener noreferrer"
                               className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-transform hover:-translate-y-0.5 ${
                                 isDarkMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white hover:bg-indigo-600'
                               }`}
                             >
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                               </svg>
                               Social Link
                             </a>
                           )}
                         </div>

                         <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Spend</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatIDR(parseNum(row['Spend']))}</p></div>
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Impressions</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatNum(parseNum(row['Impressions']))}</p></div>
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CTR</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['CTR'] || '-'}</p></div>
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CPM</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatIDR(parseNum(row['CPM']))}</p></div>
                            
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VTR (6s)</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['VTR (6s)'] || '-'}</p></div>
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VTR (15s)</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['VTR (15s)'] || '-'}</p></div>
                            <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CPCo</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatIDR(parseNum(row['CPCo (Cost/R...)']))}</p></div>
                            {adType.includes('cpas') && (
                              <>
                                <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Purchases</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatNum(parseNum(row['Purchases']))}</p></div>
                                <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>GMV</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatIDR(parseNum(row['GMV']))}</p></div>
                                <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ROAS</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] text-emerald-500`}>{parseNum(row['ROAS']).toFixed(2)}x</p></div>
                              </>
                            )}
                         </div>

                         <div className="mt-auto">
                            <div className="flex items-center justify-between mb-2">
                               <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Creative Analysis
                               </h4>
                            </div>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed border font-medium ${isDarkMode ? 'bg-indigo-950/40 text-indigo-200 border-indigo-900/50' : 'bg-indigo-50/60 text-indigo-900 border-indigo-100'}`}>
                               {row['Insights'] || 'No insights available.'}
                            </div>
                         </div>
                       </div>
                    </div>
                  );
                })
              )}
            </div>

            {creativeData.length > CREATIVES_PER_PAGE && (
              <div className="flex justify-center items-center space-x-3 mt-12 mb-12">
                 <button disabled={creativePage === 1} onClick={() => { setCreativePage(p => p - 1); window.scrollTo(0, 0); }} className={`px-6 py-3 border rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>Previous</button>
                 <span className={`px-6 py-3 font-black rounded-xl border text-sm ${isDarkMode ? 'bg-indigo-900/50 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>Page {creativePage} of {Math.ceil(creativeData.length / CREATIVES_PER_PAGE)}</span>
                 <button disabled={creativePage === Math.ceil(creativeData.length / CREATIVES_PER_PAGE)} onClick={() => { setCreativePage(p => p + 1); window.scrollTo(0, 0); }} className={`px-6 py-3 border rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>Next Page</button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}