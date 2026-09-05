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
  
  // --- THEME STATE (DARK MODE TOGGLE) ---
  const [isDarkMode, setIsDarkMode] = useState(false);

  const dataCache = useRef<Record<string, any[]>>({});
  const [rawData, setRawData] = useState<any[]>([]);
  
  // --- FILTER STATES ---
  const [filters, setFilters] = useState({ brand: 'All', funnel: 'All', platform: 'All', adType: 'All', format: 'All', period: 'All' });
  const [granularity, setGranularity] = useState('monthly');
  const [dateMonth, setDateMonth] = useState('');
  const [dateWeekly, setDateWeekly] = useState('');
  const [dateDailyStart, setDateDailyStart] = useState('');
  const [dateDailyEnd, setDateDailyEnd] = useState('');

  // --- INTERNAL TABLE COLUMN DROPDOWN FILTERS ---
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

    return { curStart: curFirstWeek, curMtdEnd: targetDate, curMonthEnd: curMonthEnd, prevStart: prevFirstWeek, prevMtdEnd: prevMtdEnd, prevMonthEnd: prevMonthEnd };
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
      if (result.success) setCurrentView('welcome'); else setLoginError(result.error || 'Incorrect username or password.');
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

  const getUniqueOptions = (colName: string) => {
    if (!rawData || rawData.length === 0) return ['All'];
    const unique = Array.from(new Set(rawData.map(r => r[colName]))).filter(v => v && String(v).trim() !== "");
    return ['All', ...unique.sort()];
  };

  const handleToggleMetric = (engine: 'media'|'commerce', value: string) => {
    const setState = engine === 'media' ? setChartMetricsMedia : setChartMetricsComm;
    const current = engine === 'media' ? [...chartMetricsMedia] : [...chartMetricsComm];
    if (current.includes(value)) {
      if (current.length === 1) return;
      setState(current.filter(m => m !== value));
    } else {
      if (current.length >= 3) { alert("You can only select up to 3 metrics for the chart."); return; }
      setState([...current, value]);
    }
  };

  const { curData, prevData, creativeData, globalDates } = useMemo(() => {
    if (!activeEngine || rawData.length === 0) return { curData: [], prevData: [], creativeData: [], globalDates: null };
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

    if (activeEngine === 'creative') return { curData: [], prevData: [], creativeData: filteredBase, globalDates: null };

    let cData: any[] = []; let pData: any[] = [];
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
      } else if (granularity === 'weekly' && dates) {
        if (rowDate >= dates.curStart && rowDate <= dates.curMtdEnd) { row.bucket = "W" + getWeekBucket(rowDate, dates.curStart); cData.push(row); }
        if (rowDate >= dates.prevStart && rowDate <= dates.prevMtdEnd) { row.bucket = "W" + getWeekBucket(rowDate, dates.prevStart); pData.push(row); }
      } else if (granularity === 'daily' && dStart && dEnd) {
        if (rowDate >= dStart && rowDate <= dEnd) { 
          row.bucket = `${rowDate.getFullYear()}-${String(rowDate.getMonth()+1).padStart(2,'0')}-${String(rowDate.getDate()).padStart(2,'0')}`; 
          cData.push(row); 
        }
      }
    });

    return { curData: cData, prevData: pData, creativeData: [], globalDates: dates };
  }, [rawData, filters, activeEngine, granularity, dateMonth, dateWeekly, dateDailyStart, dateDailyEnd, getMediaDates]);

  const { ctxCurData, ctxPrevData } = useMemo(() => {
    if (dashboardContext === 'Overall' || activeEngine === 'creative') return { ctxCurData: curData, ctxPrevData: prevData };
    const match = dashboardContext.toLowerCase();
    const filterFn = (row: any) => {
      const p = String(row[CONFIG[activeEngine as 'media'|'commerce'].colPlatform] || "").toLowerCase();
      if (match === 'meta') return p.includes('meta') || p.includes('facebook') || p.includes('ig') || p.includes('instagram');
      return p.includes(match);
    };
    return { ctxCurData: curData.filter(filterFn), ctxPrevData: prevData.filter(filterFn) };
  }, [curData, prevData, dashboardContext, activeEngine]);

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
    let color = "text-white/60"; let arrow = "";
    if (gr > 0) { color = isInv ? "text-red-300" : "text-emerald-300"; arrow = "▲"; } 
    else if (gr < 0) { color = isInv ? "text-emerald-300" : "text-red-300"; arrow = "▼"; } 
    else return <span className={`text-[10px] ml-1 font-bold ${color}`}>-</span>;
    return <span className={`text-[10px] ml-1 font-bold ${color}`}>{arrow} {formatPct(Math.abs(gr))}</span>;
  };

  // --- CHART RENDERING (CURVED LINES, NO CIRCLES, SOLID COLOR + SIGNATURE PURPLE/GREEN) ---
  useEffect(() => {
    if ((activeEngine !== 'media' && activeEngine !== 'commerce') || ctxCurData.length === 0 || !chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const groupedData: Record<string, any> = {};
    const cfg = CONFIG[activeEngine];
    
    ctxCurData.forEach(row => {
      if (!row.parsedDate) return;
      const d = row.parsedDate;
      const label = granularity === 'monthly' ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 
                    granularity === 'weekly' ? `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}` : 
                    `${d.getDate()}/${d.getMonth()+1}`;

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

    // Signature Purple (#4f46e5) & Green (#10b981) Palette
    if (activeEngine === 'media') {
      const configs: any = {
        'spend': { label: 'Spend', data: labels.map(l => groupedData[l].spend), color: '#4f46e5', bg: '#4f46e5', type: 'bar' },
        'imp': { label: 'Impr', data: labels.map(l => groupedData[l].imp), color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', type: 'line' },
        'clicks': { label: 'Clicks', data: labels.map(l => groupedData[l].clicks), color: '#84cc16', bg: 'transparent', type: 'line' },
        'views': { label: 'Views', data: labels.map(l => groupedData[l].views), color: '#f59e0b', bg: 'transparent', type: 'line' },
        'ctr': { label: 'CTR', data: labels.map(l => groupedData[l].imp>0 ? (groupedData[l].clicks/groupedData[l].imp)*100 : 0), color: '#ec4899', bg: 'transparent', type: 'line' },
        'vtr': { label: 'VTR', data: labels.map(l => groupedData[l].imp>0 ? (groupedData[l].views/groupedData[l].imp)*100 : 0), color: '#06b6d4', bg: 'transparent', type: 'line' }
      };
      chartMetricsMedia.forEach((key, idx) => {
        const c = configs[key];
        datasets.push({ label: c.label, data: c.data, type: c.type, backgroundColor: c.bg, borderColor: c.color, yAxisID: idx===0?'y':'y1', tension: 0.45, fill: c.type==='line', borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, borderRadius: c.type==='bar'?6:0 });
      });
    } else {
      const configs: any = {
        'exp': { label: 'Expense', data: labels.map(l => groupedData[l].exp), color: '#4f46e5', bg: '#4f46e5', type: 'bar' },
        'gmv': { label: 'GMV', data: labels.map(l => groupedData[l].gmv), color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', type: 'line' },
        'orders': { label: 'Orders', data: labels.map(l => groupedData[l].orders), color: '#84cc16', bg: 'transparent', type: 'line' },
        'roas': { label: 'ROAS', data: labels.map(l => groupedData[l].exp>0 ? groupedData[l].gmv/groupedData[l].exp : 0), color: '#f59e0b', bg: 'transparent', type: 'line' },
        'cpa': { label: 'CPA', data: labels.map(l => groupedData[l].orders>0 ? groupedData[l].exp/groupedData[l].orders : 0), color: '#ec4899', bg: 'transparent', type: 'line' }
      };
      chartMetricsComm.forEach((key, idx) => {
        const c = configs[key];
        datasets.push({ label: c.label, data: c.data, type: c.type, backgroundColor: c.bg, borderColor: c.color, yAxisID: idx===0?'y':'y1', tension: 0.45, fill: c.type==='line', borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, borderRadius: c.type==='bar'?6:0 });
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
              boxHeight: 8, 
              font: { family: "'Inter', sans-serif", weight: 'bold' } 
            } 
          } 
        },
        scales: {
          x: { grid: { display: false } },
          y: { type: 'linear', display: true, position: 'left', grid: { color: isDarkMode ? '#334155' : '#f1f5f9' }, border: { dash: [4, 4] } },
          y1: { type: 'linear', display: datasets.length > 1, position: 'right', grid: { drawOnChartArea: false } }
        }
      }
    });

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [ctxCurData, chartMetricsMedia, chartMetricsComm, activeEngine, granularity, isDarkMode]);

  // --- MANUAL TABLE RENDERER WITH INTERNAL HEADER DROPDOWN FILTERS & SOLID HEADERS ---
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
        if (adTypeLower.includes("cpas shopee")) {
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
      if (cur === 0 && prev === 0) return '<td class="px-4 py-2.5 text-right font-mono font-semibold text-slate-400">0.00%</td>';
      let color = "text-slate-500";
      if (gr > 0) color = invertColors ? "text-red-500 bg-red-50" : "text-emerald-600 bg-emerald-50";
      if (gr < 0) color = invertColors ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50";
      return `<td class="px-4 py-2.5 text-right font-mono font-bold"><span class="px-2 py-0.5 rounded-md ${color}">${formatPct(Math.abs(gr))}</span></td>`;
    };

    // Gather unique options for internal table column filters
    let dim1Set = new Set<string>(); let dim2Set = new Set<string>();
    ctxCurData.forEach(r => {
      dim1Set.add(isMedia ? String(r[cnf.colAdType]) : String(r[cnf.colPlatform]));
      dim2Set.add(isMedia ? String(r[cnf.colFormat]) : String(r[cnf.colAdType]));
    });

    // Apply internal table column filters
    const filterRow = (k1: string, k2: string) => {
      if (tableColFilter1 !== 'All' && k1 !== tableColFilter1) return false;
      if (tableColFilter2 !== 'All' && k2 !== tableColFilter2) return false;
      return true;
    };

    let thead = ''; let tbody = '';

    if (granularity === 'monthly') {
      thead = `<tr>
        <th class="px-4 py-3 sticky-col font-bold text-white bg-[#1e293b]">
          <div class="flex flex-col gap-1"><span>${isMedia?'Ad Type':'Platform'}</span></div>
        </th>
        <th class="px-4 py-3 sticky-col-2 font-bold text-white bg-[#1e293b]">
          <div class="flex flex-col gap-1"><span>${isMedia?'Format':'Ad Type'}</span></div>
        </th>
        <th class="px-4 py-3 sticky-col-3 font-bold text-white bg-[#1e293b]">Metric</th>
        <th class="px-4 py-3 text-right font-bold text-white bg-[#1e293b]">This Month</th>
        <th class="px-4 py-3 text-right font-bold text-slate-300 bg-[#1e293b]">Prev Month</th>
        <th class="px-4 py-3 text-right font-bold text-white bg-[#1e293b]">GR%</th>
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
          const mp = mPrev[i]; let rowCls = i%2===0?'bg-white':'bg-slate-50/50'; if(i===0) rowCls += ' group-start';
          tbody += `<tr class="${rowCls} hover:bg-indigo-50/30 transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col font-bold text-slate-800 align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col-2 font-medium text-slate-500 align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-2.5 sticky-col-3 text-slate-600 font-medium">${mc.name}</td>`;
          tbody += `<td class="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">${mc.fmt}</td>`;
          tbody += `<td class="px-4 py-2.5 text-right font-mono font-medium text-slate-400">${mp.fmt}</td>`;
          tbody += getGrHTML(mc.raw, mp.raw, mc.isInv);
          tbody += '</tr>';
        });
      });
    } else if (granularity === 'weekly') {
      let weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
      let weeks = Array.from(weeksFound).sort(); 
      thead = `<tr><th class="px-4 py-4 sticky-col font-bold text-white bg-[#1e293b]">${isMedia?'Ad Type':'Platform'}</th><th class="px-4 py-4 sticky-col-2 font-bold text-white bg-[#1e293b]">${isMedia?'Format':'Ad Type'}</th><th class="px-4 py-4 sticky-col-3 font-bold text-white bg-[#1e293b]">Metric</th>`;
      weeks.forEach(w => {
        const weekNum = parseInt(w.replace('W', ''));
        let curD = new Date(globalDates.curStart); curD.setDate(curD.getDate() + (weekNum * 7) - 1); if (curD > globalDates.curMtdEnd) curD = new Date(globalDates.curMtdEnd);
        let prevD = new Date(globalDates.prevStart); prevD.setDate(prevD.getDate() + (weekNum * 7) - 1); if (prevD > globalDates.prevMtdEnd) prevD = new Date(globalDates.prevMtdEnd);
        const fmtStr = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
        thead += `<th class="px-4 py-4 text-right bg-[#1e293b] border-l border-slate-700 font-bold text-white">MTD ${fmtStr(curD)}</th><th class="px-4 py-4 text-right text-slate-300 bg-[#1e293b] font-bold">MTD ${fmtStr(prevD)}</th><th class="px-4 py-4 text-right bg-[#1e293b] font-bold text-white">GR%</th>`;
      });
      thead += `<th class="px-4 py-4 text-right border-l border-slate-700 text-blue-200 font-bold bg-[#0f172a]">MTD Total Cur</th><th class="px-4 py-4 text-right text-slate-300 font-bold bg-[#0f172a]">MTD Total Prev</th><th class="px-4 py-4 text-right text-blue-200 font-bold bg-[#0f172a]">Total GR%</th></tr>`;

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
          let rowCls = i%2===0?'bg-white':'bg-slate-50/50'; if(i===0) rowCls += ' group-start';
          tbody += `<tr class="${rowCls} hover:bg-indigo-50/30 transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col font-bold text-slate-800 align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col-2 font-medium text-slate-500 align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-2.5 sticky-col-3 text-slate-600 font-medium">${mc.name}</td>`;
          weeks.forEach(w => {
            const wc = weekM[w].cur[i], wp = weekM[w].prev[i];
            tbody += `<td class="px-4 py-2.5 text-right font-mono font-semibold border-l border-slate-200">${wc.fmt}</td><td class="px-4 py-2.5 text-right font-mono font-medium text-slate-400">${wp.fmt}</td>${getGrHTML(wc.raw, wp.raw, wc.isInv)}`;
          });
          const mp = prevTotM[i];
          tbody += `<td class="px-4 py-2.5 text-right font-mono border-l border-slate-200 font-bold text-indigo-700 bg-indigo-50/50">${mc.fmt}</td><td class="px-4 py-2.5 text-right font-mono font-medium text-slate-500 bg-indigo-50/50">${mp.fmt}</td>${getGrHTML(mc.raw, mp.raw, mc.isInv)}</tr>`;
        });
      });
    } else if (granularity === 'daily') {
      let daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); let days = Array.from(daysFound).sort(); 
      thead = `<tr><th class="px-4 py-4 sticky-col font-bold text-white bg-[#1e293b]">${isMedia?'Ad Type':'Platform'}</th><th class="px-4 py-4 sticky-col-2 font-bold text-white bg-[#1e293b]">${isMedia?'Format':'Ad Type'}</th><th class="px-4 py-4 sticky-col-3 font-bold text-white bg-[#1e293b]">Metric</th>`;
      days.forEach(d => { const parts = d.split('-'); const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2])); thead += `<th class="px-4 py-4 text-right font-bold text-white bg-[#1e293b]">${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}</th>`; });
      thead += `<th class="px-4 py-4 text-right text-blue-200 border-l border-slate-700 font-bold bg-[#1e293b]">Period Total</th></tr>`;

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
          let rowCls = i%2===0?'bg-white':'bg-slate-50/50'; if(i===0) rowCls += ' group-start';
          tbody += `<tr class="${rowCls} hover:bg-indigo-50/30 transition-colors">`;
          if(i===0){
            tbody += `<td rowspan="${totM.length}" class="px-4 py-3 sticky-col font-bold text-slate-800 align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${totM.length}" class="px-4 py-3 sticky-col-2 font-medium text-slate-500 align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-2.5 sticky-col-3 text-slate-600 font-medium">${mc.name}</td>`;
          days.forEach(d => { tbody += `<td class="px-4 py-2.5 text-right font-mono font-semibold">${dayM[d][i].fmt}</td>`; });
          tbody += `<td class="px-4 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/50 border-l border-indigo-100/50">${mc.fmt}</td></tr>`;
        });
      });
    }

    return { head: thead, body: tbody, uniqueDim1: Array.from(dim1Set).sort(), uniqueDim2: Array.from(dim2Set).sort() };
  }, [ctxCurData, ctxPrevData, granularity, activeEngine, globalDates, tableColFilter1, tableColFilter2]);

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

  // --- LOGIN & WELCOME VIEWS ---
  if (currentView === 'login') {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md font-sans z-[200]">
        <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500 text-white rounded-2xl shadow-lg mb-6 transform -rotate-6">
              <svg className="w-8 h-8 transform rotate-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome</h2>
            <p className="text-sm text-gray-500 mt-2">Sign in to access dashboard.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label><input name="username" type="text" required className="w-full bg-white border border-slate-300 text-slate-800 font-semibold py-3 px-4 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label><input name="password" type="password" required className="w-full bg-white border border-slate-300 text-slate-800 font-semibold py-3 px-4 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            {loginError && <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 text-center">{loginError}</div>}
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 mt-4">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === 'welcome') {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-lg flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
        <div className="max-w-5xl w-full text-center">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-6 tracking-tight drop-shadow-lg">Welcome to All in One Dashboard</h1>
          <p className="text-blue-100 mb-12 text-lg sm:text-xl font-medium">Please select the first tracker you wish to launch. You can navigate between them at any time.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
            <button onClick={() => selectEngine('media')} className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:bg-white hover:scale-105 hover:shadow-2xl transition-all duration-300 group flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 transform group-hover:-rotate-6 transition-all">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-white group-hover:text-gray-900 mb-2 transition-colors">Digital Tracker</h2>
              <p className="text-sm text-blue-100 group-hover:text-gray-500 transition-colors">Analyze full-funnel digital media performance.</p>
            </button>
            <button onClick={() => selectEngine('commerce')} className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:bg-white hover:scale-105 hover:shadow-2xl transition-all duration-300 group flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-orange-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30 transform group-hover:-rotate-6 transition-all">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-white group-hover:text-gray-900 mb-2 transition-colors">Commerce Tracker</h2>
              <p className="text-sm text-orange-50 group-hover:text-gray-500 transition-colors">Analyze revenue performance across commerce platforms.</p>
            </button>
            <button onClick={() => selectEngine('creative')} className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:bg-white hover:scale-105 hover:shadow-2xl transition-all duration-300 group flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-lime-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-lime-500/30 transform group-hover:-rotate-6 transition-all">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-white group-hover:text-gray-900 mb-2 transition-colors">Top Creative</h2>
              <p className="text-sm text-lime-100 group-hover:text-gray-500 transition-colors">Review winning creative assets, video metrics, and key insights.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD LAYOUT (WITH DARK MODE & STYLISH CALENDAR/DROPDOWNS) ---
  return (
    <div className={`w-full min-h-screen flex font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-[#f4f7fe] text-slate-800'}`}>
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .sticky-col { position: sticky; left: 0; z-index: 10; min-width: 180px; max-width: 180px; border-right: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}; }
        .sticky-col-2 { position: sticky; left: 180px; z-index: 10; min-width: 180px; max-width: 180px; border-right: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}; }
        .sticky-col-3 { position: sticky; left: 360px; z-index: 10; min-width: 120px; max-width: 120px; border-right: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}; box-shadow: 4px 0 10px -3px rgba(0,0,0,0.05); }
        
        thead tr th { position: sticky; top: 0; z-index: 30; background-color: #1e293b !important; color: white !important; }
        thead th.sticky-col, thead th.sticky-col-2, thead th.sticky-col-3 { z-index: 40 !important; background-color: #1e293b !important; color: white !important; border-right: 1px solid #334155; }
        
        td.sticky-col, td.sticky-col-2, td.sticky-col-3 { background-color: ${isDarkMode ? '#1e293b' : '#ffffff'} !important; color: ${isDarkMode ? '#f1f5f9' : '#1e293b'} !important; z-index: 10; }
        tr.group-start td { border-top: 2px solid ${isDarkMode ? '#475569' : '#cbd5e1'} !important; }
        
        /* Modern Select & Calendar styling */
        select, input[type="date"], input[type="month"] {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e");
          background-position: right 0.75rem center;
          background-repeat: no-repeat;
          background-size: 1rem 1rem;
          appearance: none;
        }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }

        .spinner-large { border: 4px solid rgba(79, 70, 229, 0.2); border-top: 4px solid #4f46e5; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}} />

      {isLoading && <div className="fixed inset-0 z-[300] bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center"><div className="spinner-large mb-4"></div><h3 className="font-bold text-slate-900">Fetching Dashboard...</h3><p className="text-xs text-slate-500 mt-1">Downloading live dataset. Please wait</p></div>}

      {/* SIDEBAR */}
      <aside className={`${isSidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full lg:w-0'} bg-[#1e1b4b] h-screen fixed lg:static overflow-y-auto flex-shrink-0 transition-all duration-300 ease-in-out z-40 text-indigo-100 shadow-2xl flex flex-col`}>
        <div>
          <div className="p-6 border-b border-indigo-900/50 flex justify-between items-center"><h1 className="text-xl font-extrabold text-white tracking-tight">PC Brands All in One Tracker</h1><button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-indigo-300 hover:text-white">✕</button></div>
          
          <div className="pt-6 pb-4 border-b border-indigo-900/50 px-4 space-y-1">
            <p className="px-3 text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">Dashboard Menu</p>
            <button onClick={() => selectEngine('media')} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 transition-all ${activeEngine === 'media' ? 'bg-[#98e036] text-[#4f46e5] font-bold shadow-md' : 'hover:bg-white/10 text-indigo-200'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Digital Media Tracker
            </button>
            <button onClick={() => selectEngine('commerce')} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 transition-all ${activeEngine === 'commerce' ? 'bg-[#98e036] text-[#4f46e5] font-bold shadow-md' : 'hover:bg-white/10 text-indigo-200'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>Commerce Tracker
            </button>
            <button onClick={() => selectEngine('creative')} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 transition-all ${activeEngine === 'creative' ? 'bg-[#98e036] text-[#4f46e5] font-bold shadow-md' : 'hover:bg-white/10 text-indigo-200'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Top Creative
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Parameters</p>
            
            {activeEngine !== 'creative' && (
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1.5">Granularity</label>
                <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-lime-400 pr-10">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly (MTD)</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            )}
            {granularity === 'monthly' && activeEngine !== 'creative' && (
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1.5">Select Month</label>
                <input type="month" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10" />
              </div>
            )}
            {granularity === 'weekly' && activeEngine !== 'creative' && (
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1.5">MTD Date</label>
                <input type="date" value={dateWeekly} onChange={(e) => setDateWeekly(e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10" />
              </div>
            )}
            {granularity === 'daily' && activeEngine !== 'creative' && (
              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-indigo-300 mb-1.5">Start Date</label><input type="date" value={dateDailyStart} onChange={(e) => setDateDailyStart(e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10" /></div>
                <div><label className="block text-xs font-bold text-indigo-300 mb-1.5">End Date</label><input type="date" value={dateDailyEnd} onChange={(e) => setDateDailyEnd(e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10" /></div>
              </div>
            )}

            <hr className="border-indigo-900/50 my-4" />

            <div>
              <label className="block text-xs font-bold text-indigo-300 mb-1.5">Brand</label>
              <select value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-lime-400 pr-10">
                {getUniqueOptions(CONFIG[activeEngine || 'media'].colBrand).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {activeEngine === 'media' && (
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1.5">Funnel</label>
                <select value={filters.funnel} onChange={(e) => handleFilterChange('funnel', e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-lime-400 pr-10">
                  {getUniqueOptions(CONFIG.media.colFunnel).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {(activeEngine === 'commerce' || activeEngine === 'creative') && (
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1.5">Ad Type</label>
                <select value={filters.adType} onChange={(e) => handleFilterChange('adType', e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-lime-400 pr-10">
                  {getUniqueOptions(activeEngine === 'commerce' ? CONFIG.commerce.colAdType : CONFIG.creative.colAdType).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {activeEngine === 'creative' && (
              <>
                <div><label className="block text-xs font-bold text-indigo-300 mb-1.5">Period</label><select value={filters.period} onChange={(e) => handleFilterChange('period', e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10">{getUniqueOptions(CONFIG.creative.colPeriod).map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-indigo-300 mb-1.5">Platform</label><select value={filters.platform} onChange={(e) => handleFilterChange('platform', e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10">{getUniqueOptions(CONFIG.creative.colPlatform).map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-indigo-300 mb-1.5">Format</label><select value={filters.format} onChange={(e) => handleFilterChange('format', e.target.value)} className="w-full bg-[#312e81] border border-[#4338ca] text-white py-3 px-3 rounded-xl text-sm shadow-inner outline-none pr-10">{getUniqueOptions(CONFIG.creative.colFormat).map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              </>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-indigo-900/50 mt-auto bg-[#1e1b4b]">
          <button onClick={() => loadData(activeEngine as any, true)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-md transition-transform hover:-translate-y-0.5 flex justify-center items-center gap-2 text-sm">Force Sync Live Data</button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 h-screen overflow-y-auto w-full transition-all duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`mr-4 p-2.5 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`} id="pageHeaderTitle">
              {activeEngine === 'media' ? 'Digital Media Tracker' : activeEngine === 'commerce' ? 'Commerce Tracker' : 'Top Creative'}
            </h1>
          </div>

          {/* ALTERNATE VERSION: DARK MODE TOGGLE BUTTON */}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {/* --- VIEW 1: MEDIA TRACKER --- */}
        {activeEngine === 'media' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-8">
               <div onClick={() => setDashboardContext('Overall')} className={`bg-indigo-600 rounded-2xl p-6 shadow-md transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'Overall' ? 'ring-4 ring-indigo-300' : ''}`}>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Overall Media</h3><div className="p-2 bg-white/20 rounded-lg"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg></div></div>
                  <div className="space-y-3">
                     <div className="flex justify-between items-end border-b border-indigo-400/30 pb-2"><span className="text-xs font-semibold text-indigo-100">Spend</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(mediaKPIs.overall.spend)}</span>{renderGR(mediaKPIs.overall.spend, mediaKPIs.overall.pSpend, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-indigo-400/30 pb-2"><span className="text-xs font-semibold text-indigo-100">Impr</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatNum(mediaKPIs.overall.impr)}</span>{renderGR(mediaKPIs.overall.impr, mediaKPIs.overall.pImpr, false)}</div></div>
                     <div className="flex justify-between items-end"><span className="text-xs font-semibold text-indigo-100">Engage</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatNum(mediaKPIs.overall.engage)}</span>{renderGR(mediaKPIs.overall.engage, mediaKPIs.overall.pEngage, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('Meta')} className={`bg-blue-500 rounded-2xl p-6 shadow-md transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'Meta' ? 'ring-4 ring-blue-300' : ''}`}>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Meta</h3><div className="p-2 bg-white/20 rounded-lg"><svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></div></div>
                  <div className="space-y-3">
                     <div className="flex justify-between items-end border-b border-blue-400/30 pb-2"><span className="text-xs font-semibold text-blue-100">Spend</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(mediaKPIs.meta.spend)}</span>{renderGR(mediaKPIs.meta.spend, mediaKPIs.meta.pSpend, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-blue-400/30 pb-2"><span className="text-xs font-semibold text-blue-100">Impr</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatNum(mediaKPIs.meta.impr)}</span>{renderGR(mediaKPIs.meta.impr, mediaKPIs.meta.pImpr, false)}</div></div>
                     <div className="flex justify-between items-end"><span className="text-xs font-semibold text-blue-100">Engage</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatNum(mediaKPIs.meta.engage)}</span>{renderGR(mediaKPIs.meta.engage, mediaKPIs.meta.pEngage, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('TikTok')} className={`bg-slate-800 rounded-2xl p-6 shadow-md transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'TikTok' ? 'ring-4 ring-slate-400' : ''}`}>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-widest">TikTok</h3><div className="p-2 bg-white/20 rounded-lg"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
                  <div className="space-y-3">
                     <div className="flex justify-between items-end border-b border-slate-600/50 pb-2"><span className="text-xs font-semibold text-slate-300">Spend</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(mediaKPIs.tiktok.spend)}</span>{renderGR(mediaKPIs.tiktok.spend, mediaKPIs.tiktok.pSpend, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-slate-600/50 pb-2"><span className="text-xs font-semibold text-slate-300">Impr</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatNum(mediaKPIs.tiktok.impr)}</span>{renderGR(mediaKPIs.tiktok.impr, mediaKPIs.tiktok.pImpr, false)}</div></div>
                     <div className="flex justify-between items-end"><span className="text-xs font-semibold text-slate-300">Engage</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatNum(mediaKPIs.tiktok.engage)}</span>{renderGR(mediaKPIs.tiktok.engage, mediaKPIs.tiktok.pEngage, false)}</div></div>
                  </div>
               </div>
            </div>
            
            <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm mb-8 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
                 <div><h2 className="text-xl font-bold tracking-tight" id="chartTitleMedia">{dashboardContext} Trend</h2><p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Displaying historical 3 Months to Selected Month</p></div>
                 <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 rounded-xl border w-full xl:w-auto shadow-inner ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-bold uppercase tracking-widest w-full sm:w-auto">Metrics</span>
                    {[{id:'spend',l:'Spend',c:'text-indigo-400'}, {id:'imp',l:'Impr',c:'text-emerald-400'}, {id:'clicks',l:'Clicks',c:'text-lime-400'}, {id:'views',l:'Views',c:'text-amber-400'}, {id:'ctr',l:'CTR',c:'text-pink-400'}, {id:'vtr',l:'VTR',c:'text-teal-400'}].map(m => (
                      <label key={m.id} className={`text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${m.c}`}><input type="checkbox" checked={chartMetricsMedia.includes(m.id)} onChange={() => handleToggleMetric('media', m.id)} className="w-4 h-4 rounded text-indigo-600 focus:ring-current" /> {m.l}</label>
                    ))}
                 </div>
               </div>
               <div className="w-full h-[320px]"><canvas ref={chartRef}></canvas></div>
            </div>

            <div className={`rounded-2xl border shadow-sm overflow-hidden mb-8 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className={`p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-100 bg-white'}`}>
                 <h2 className={`font-bold uppercase text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Detailed Context Metrics</h2>
                 
                 {/* COLUMN DROPDOWN FILTERS */}
                 <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                   <select value={tableColFilter1} onChange={(e) => setTableColFilter1(e.target.value)} className={`bg-slate-900 border text-xs font-semibold py-2 px-3 rounded-xl outline-none pr-8 ${isDarkMode ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-700'}`}>
                     <option value="All">All Ad Types</option>
                     {generateTableHTML().uniqueDim1.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                   <select value={tableColFilter2} onChange={(e) => setTableColFilter2(e.target.value)} className={`bg-slate-900 border text-xs font-semibold py-2 px-3 rounded-xl outline-none pr-8 ${isDarkMode ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-700'}`}>
                     <option value="All">All Formats</option>
                     {generateTableHTML().uniqueDim2.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>
               </div>
               <div className="overflow-x-auto max-h-[600px] relative table-container">
                  <table className={`min-w-full text-left text-sm whitespace-nowrap border-collapse ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`} dangerouslySetInnerHTML={{ __html: generateTableHTML().head + generateTableHTML().body }} />
               </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: COMMERCE TRACKER --- */}
        {activeEngine === 'commerce' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-8">
               <div onClick={() => setDashboardContext('Overall')} className={`kpi-card bg-indigo-600 rounded-2xl p-6 shadow-md cursor-pointer ${dashboardContext === 'Overall' ? 'active ring-4 ring-indigo-300' : ''}`}>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Overall Commerce</h3><div className="p-2 bg-white/20 rounded-lg"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg></div></div>
                  <div className="space-y-3">
                     <div className="flex justify-between items-end border-b border-indigo-400/30 pb-2"><span className="text-xs font-semibold text-indigo-100">Expense</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(commerceKPIs.overall.exp)}</span>{renderGR(commerceKPIs.overall.exp, commerceKPIs.overall.pExp, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-indigo-400/30 pb-2"><span className="text-xs font-semibold text-indigo-100">GMV</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(commerceKPIs.overall.gmv)}</span>{renderGR(commerceKPIs.overall.gmv, commerceKPIs.overall.pGmv, false)}</div></div>
                     <div className="flex justify-between items-end"><span className="text-xs font-semibold text-indigo-100">ROAS</span><div className="text-right"><span className="font-extrabold text-xl text-white">{commerceKPIs.overall.roas}</span>{renderGR(commerceKPIs.overall.roasNum, commerceKPIs.overall.pRoasNum, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('TikTok')} className={`kpi-card bg-slate-800 rounded-2xl p-6 shadow-md cursor-pointer ${dashboardContext === 'TikTok' ? 'active ring-4 ring-slate-400' : ''}`}>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-widest">TikTok Shop</h3><div className="p-2 bg-white/20 rounded-lg"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
                  <div className="space-y-3">
                     <div className="flex justify-between items-end border-b border-slate-600/50 pb-2"><span className="text-xs font-semibold text-slate-300">Expense</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(commerceKPIs.tiktok.exp)}</span>{renderGR(commerceKPIs.tiktok.exp, commerceKPIs.tiktok.pExp, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-slate-600/50 pb-2"><span className="text-xs font-semibold text-slate-300">GMV</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(commerceKPIs.tiktok.gmv)}</span>{renderGR(commerceKPIs.tiktok.gmv, commerceKPIs.tiktok.pGmv, false)}</div></div>
                     <div className="flex justify-between items-end"><span className="text-xs font-semibold text-slate-300">ROAS</span><div className="text-right"><span className="font-extrabold text-xl text-emerald-400">{commerceKPIs.tiktok.roas}</span>{renderGR(commerceKPIs.tiktok.roasNum, commerceKPIs.tiktok.pRoasNum, false)}</div></div>
                  </div>
               </div>
               <div onClick={() => setDashboardContext('Shopee')} className={`kpi-card bg-orange-500 rounded-2xl p-6 shadow-md cursor-pointer ${dashboardContext === 'Shopee' ? 'active ring-4 ring-orange-300' : ''}`}>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Shopee</h3><div className="p-2 bg-white/20 rounded-lg"><svg className="w-5 h-5 text-white" viewBox="0 0 109.59 122.88" fill="currentColor"><path d="M74.98,91.98C76.15,82.36,69.96,76.22,53.6,71c-7.92-2.7-11.66-6.24-11.57-11.12 c0.33-5.4,5.36-9.34,12.04-9.47c4.63,0.09,9.77,1.22,14.76,4.56c0.59,0.37,1.01,0.32,1.35-0.2c0.46-0.74,1.61-2.53,2-3.17 c0.26-0.42,0.31-0.96-0.35-1.44c-0.95-0.7-3.6-2.13-5.03-2.72c-3.88-1.62-8.23-2.64-12.86-2.63c-9.77,0.04-17.47,6.22-18.12,14.47 c-0.42,5.95,2.53,10.79,8.86,14.47c1.34,0.78,8.6,3.67,11.49,4.57c9.08,2.83,13.8,7.9,12.69,13.81c-1.01,5.36-6.65,8.83-14.43,8.93 c-6.17-0.24-11.71-2.75-16.02-6.1c-0.11-0.08-0.65-0.5-0.72-0.56c-0.53-0.42-1.11-0.39-1.47,0.15c-0.26,0.4-1.92,2.8-2.34,3.43 c-0.39,0.55-0.18,0.86,0.23,1.2c1.8,1.5,4.18,3.14,5.81,3.97c4.47,2.28,9.32,3.53,14.48,3.72c3.32,0.22,7.5-0.49,10.63-1.81 C70.63,102.67,74.25,97.92,74.98,91.98L74.98,91.98z M54.79,7.18c-10.59,0-19.22,9.98-19.62,22.47h39.25 C74.01,17.16,65.38,7.18,54.79,7.18L54.79,7.18z M94.99,122.88l-0.41,0l-80.82-0.01h0c-5.5-0.21-9.54-4.66-10.09-10.19l-0.05-1 l-3.61-79.5v0C0,32.12,0,32.06,0,32c0-1.28,1.03-2.33,2.3-2.35l0,0h25.48C28.41,13.15,40.26,0,54.79,0s26.39,13.15,27.01,29.65 h25.4h0.04c1.3,0,2.35,1.05,2.35,2.35c0,0.04,0,0.08,0,0.12v0l-3.96,79.81l-0.04,0.68C105.12,118.21,100.59,122.73,94.99,122.88 L94.99,122.88z"/></svg></div></div>
                  <div className="space-y-3">
                     <div className="flex justify-between items-end border-b border-orange-400/30 pb-2"><span className="text-xs font-semibold text-orange-100">Expense</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(commerceKPIs.shopee.exp)}</span>{renderGR(commerceKPIs.shopee.exp, commerceKPIs.shopee.pExp, true)}</div></div>
                     <div className="flex justify-between items-end border-b border-orange-400/30 pb-2"><span className="text-xs font-semibold text-orange-100">GMV</span><div className="text-right"><span className="font-extrabold text-xl text-white">{formatIDR(commerceKPIs.shopee.gmv)}</span>{renderGR(commerceKPIs.shopee.gmv, commerceKPIs.shopee.pGmv, false)}</div></div>
                     <div className="flex justify-between items-end"><span className="text-xs font-semibold text-orange-100">ROAS</span><div className="text-right"><span className="font-extrabold text-xl text-white">{commerceKPIs.shopee.roas}</span>{renderGR(commerceKPIs.shopee.roasNum, commerceKPIs.shopee.pRoasNum, false)}</div></div>
                  </div>
               </div>
            </div>
            
            <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm mb-8 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
                 <div><h2 className="text-xl font-bold tracking-tight" id="chartTitleCommerce">{dashboardContext} Trend</h2><p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Always displaying up to 3 Months -> Current Selected Month</p></div>
                 <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 rounded-xl border w-full xl:w-auto shadow-inner ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-bold uppercase tracking-widest w-full sm:w-auto">Metrics</span>
                    {[{id:'exp',l:'Expense',c:'text-indigo-400'}, {id:'gmv',l:'GMV',c:'text-emerald-400'}, {id:'orders',l:'Orders',c:'text-lime-400'}, {id:'roas',l:'ROAS',c:'text-amber-400'}, {id:'cpa',l:'CPA',c:'text-pink-400'}].map(m => (
                      <label key={m.id} className={`text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${m.c}`}><input type="checkbox" checked={chartMetricsComm.includes(m.id)} onChange={() => handleToggleMetric('commerce', m.id)} className="w-4 h-4 rounded text-indigo-600 focus:ring-current" /> {m.l}</label>
                    ))}
                 </div>
               </div>
               <div className="w-full h-[320px]"><canvas ref={chartRef}></canvas></div>
            </div>

            <div className={`rounded-2xl border shadow-sm overflow-hidden mb-8 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className={`p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-100 bg-white'}`}>
                 <h2 className={`font-bold uppercase text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Detailed Platform & Ad Type Metrics</h2>
               </div>
               <div className="overflow-x-auto max-h-[600px] relative table-container">
                  <table className={`min-w-full text-left text-sm whitespace-nowrap border-collapse ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`} dangerouslySetInnerHTML={{ __html: generateTableHTML().head + generateTableHTML().body }} />
               </div>
            </div>
          </div>
        )}

        {/* --- VIEW 3: TOP CREATIVE TRACKER (VERIFIED ALL METRICS) --- */}
        {activeEngine === 'creative' && (
          <div>
            <div className="space-y-6">
              {creativeData.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center"><p className="text-slate-500">No creative data found for the selected filters.</p></div>
              ) : (
                creativeData.slice((creativePage - 1) * CREATIVES_PER_PAGE, creativePage * CREATIVES_PER_PAGE).map((row, index) => {
                  const driveLink = getDrivePreviewLink(row['Creative Link']);
                  const igEmbed = getInstagramEmbedLink(row['Social Link']);
                  const iframeSrc = driveLink || igEmbed;
                  const adType = String(row['Ad Type'] || '').toLowerCase();

                  return (
                    <div key={index} className={`rounded-[1.5rem] border shadow-sm overflow-hidden flex flex-col xl:flex-row ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                       <div className="w-full xl:w-3/12 border-b xl:border-b-0 xl:border-r border-slate-200 relative bg-slate-950">
                         {iframeSrc ? <iframe src={iframeSrc} className="w-full h-full min-h-[250px]" frameBorder="0" allowFullScreen></iframe> : <div className="w-full h-full min-h-[250px] flex items-center justify-center text-xs text-slate-500 font-medium">No Preview Available</div>}
                       </div>
                       <div className="w-full xl:w-9/12 p-5 flex flex-col">
                         <div className="flex justify-between items-center mb-4">
                           <h3 className="text-lg font-bold">{row['Ad Name'] || 'Unknown Ad'}</h3>
                           {row['Social Link'] && row['Social Link'] !== '-' && (
                             <a href={row['Social Link']} target="_blank" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700 transition shadow-sm whitespace-nowrap">
                               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>Social Link
                             </a>
                           )}
                         </div>

                         {/* VERIFIED CREATIVE METRICS */}
                         <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm p-4 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">Spend</p><p className="font-mono font-medium">{formatIDR(parseNum(row['Spend']))}</p></div>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">Impressions</p><p className="font-mono font-medium">{formatNum(parseNum(row['Impressions']))}</p></div>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">CTR</p><p className="font-mono font-medium">{row['CTR'] || '-'}</p></div>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">CPM</p><p className="font-mono font-medium">{formatIDR(parseNum(row['CPM']))}</p></div>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">VTR (6s)</p><p className="font-mono font-medium">{row['VTR (6s)'] || '-'}</p></div>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">VTR (15s)</p><p className="font-mono font-medium">{row['VTR (15s)'] || '-'}</p></div>
                            <div><p className="text-slate-400 font-bold mb-1 text-xs">CPCo</p><p className="font-mono font-medium">{formatIDR(parseNum(row['CPCo (Cost/R...)']))}</p></div>
                            {adType.includes('cpas') && (
                              <>
                                <div><p className="text-slate-400 font-bold mb-1 text-xs">Purchases</p><p className="font-mono font-medium">{formatNum(parseNum(row['Purchases']))}</p></div>
                                <div><p className="text-slate-400 font-bold mb-1 text-xs">GMV</p><p className="font-mono font-medium">{formatIDR(parseNum(row['GMV']))}</p></div>
                                <div><p className="text-slate-400 font-bold mb-1 text-xs">ROAS</p><p className="font-mono font-medium">{parseNum(row['ROAS']).toFixed(2)}x</p></div>
                              </>
                            )}
                         </div>

                         <div className="mt-auto">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Creative Insights</h4>
                            <div className={`p-3 rounded-xl text-xs leading-relaxed border ${isDarkMode ? 'bg-slate-900 text-indigo-200 border-slate-700' : 'bg-indigo-50/50 text-indigo-900 border-indigo-100/50'}`}>
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
              <div className="flex justify-center items-center space-x-2 mt-8 mb-8">
                 <button disabled={creativePage === 1} onClick={() => { setCreativePage(p => p - 1); window.scrollTo(0, 0); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-50">Prev</button>
                 <span className="px-4 py-2 font-bold text-indigo-600 bg-indigo-50 rounded-xl">Page {creativePage} of {Math.ceil(creativeData.length / CREATIVES_PER_PAGE)}</span>
                 <button disabled={creativePage === Math.ceil(creativeData.length / CREATIVES_PER_PAGE)} onClick={() => { setCreativePage(p => p + 1); window.scrollTo(0, 0); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}