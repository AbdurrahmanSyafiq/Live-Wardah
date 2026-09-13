'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Chart from 'chart.js/auto';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';

// --- SHADCN/UI TABLE PRIMITIVES ---
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className = '', ...props }, ref) => (
  <table ref={ref} className={`min-w-full text-left text-[clamp(12px,1vw,14px)] whitespace-nowrap border-separate [border-spacing:0] caption-bottom ${className}`} {...props} />
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className = '', ...props }, ref) => (
  <thead ref={ref} className={`[&_tr]:border-b ${className}`} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className = '', ...props }, ref) => (
  <tbody ref={ref} className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className = '', ...props }, ref) => (
  <tr ref={ref} className={`transition-colors ${className}`} {...props} />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className = '', ...props }, ref) => (
  <th ref={ref} className={`px-4 py-4 text-xs font-bold uppercase tracking-wider align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className = '', ...props }, ref) => (
  <td ref={ref} className={`px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
));
TableCell.displayName = "TableCell";

const CONFIG = {
  media: { sheet: "Media API", colDate: "Date", colBrand: "Brand", colPlatform: "Platform", colFunnel: "Funnel", colAdType: "KPI", colFormat: "Format", colConsiSize: "Result" },
  commerce: { sheet: "Commerce", colDate: "Date", colBrand: "Brand fx", colPlatform: "Platform", colAdType: "Ad Type" },
  creative: { sheet: "Creative Raw", colPeriod: "Period", colBrand: "Brand", colPlatform: "Platform", colAdType: "Ad Type", colFormat: "Format" },
  signal: { sheet: "Media Signal", colBrand: "Brand", colStatus: "Status", colDateStart: "Start Date", colDateEnd: "End Date" }
};

const selectClass = "w-full bg-[#1e293b] border border-[#334155] text-slate-100 py-2.5 px-3 rounded-xl text-xs font-semibold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none dropdown-arrow hover:border-[#475569] transition-colors";
const dateClass = "w-full bg-white border border-slate-200 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center";
const dateClassDark = "w-full bg-[#1e293b] border border-indigo-500/50 text-indigo-300 py-2 px-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer text-center";
const defaultFilters = { brand: 'All', funnel: 'All', platform: 'All', adType: 'All', format: 'All', period: 'All' };

interface CompileOptions {
  rawData: any[];
  extraSheetsData: { mediaApi: any[]; commerce: any[] };
  selectedPeriod: { start: string; end: string; label: string };
  parseNum: (val: any) => number;
  parseSheetDate: (val: any) => Date | null;
  toYMD: (val: any) => string;
}

export async function exportMediaSignalToExcel({ rawData, extraSheetsData, selectedPeriod, parseNum, parseSheetDate, toYMD }: CompileOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Media Signal Tracker';
  workbook.created = new Date();
  const clean = (value: any) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const brands = Array.from(new Set(rawData.map(row => String(row['Brand'] || '').trim()).filter(Boolean))).sort();
  if (!brands.length) { alert('No brand data available to export.'); return; }

  const start = parseSheetDate(selectedPeriod.start); if (start) start.setHours(0, 0, 0, 0);
  const end = parseSheetDate(selectedPeriod.end); if (end) end.setHours(23, 59, 59, 999);
  const find = (row: any, names: string[]) => {
    for (const name of names) {
      const key = Object.keys(row).find(existing => existing.toLowerCase().trim() === name.toLowerCase().trim());
      if (key !== undefined && row[key] !== undefined && row[key] !== '') return row[key];
    }
    return '';
  };
  const usedNames = new Set<string>();
  const sheetName = (brand: string) => {
    const base = brand.replace(/[:\\/?*\[\]]/g, '').slice(0, 31) || 'Brand';
    let name = base; let suffix = 2;
    while (usedNames.has(name)) { const tail = ` (${suffix++})`; name = `${base.slice(0, 31 - tail.length)}${tail}`; }
    usedNames.add(name); return name;
  };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } }, left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } }, right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
  };

  for (const brand of brands) {
    const target = clean(brand);
    const subset = rawData.filter(row => {
      if (clean(row['Brand']) !== target) return false;
      if (toYMD(row['Start Date'] || row['start_date']) !== selectedPeriod.start || toYMD(row['End Date'] || row['end_date']) !== selectedPeriod.end) return false;
      const status = String(find(row, ['Status', 'status', 'Type'])).toLowerCase().trim();
      return status.includes('actual') || (!status.includes('plan') && status !== '');
    });
    const sum = (names: string[]) => subset.reduce((total, row) => total + parseNum(find(row, names)), 0);
    const impressions = sum(['Impressions', 'Total Impressions']);
    const paidImpressions = sum(['Paid Impressions']);
    const organicImpressions = sum(['Organic Impressions']);
    const engagements = sum(['Engagements', 'Total Engagements']);
    const paidEngagements = sum(['Paid Engagements']);
    const organicEngagements = sum(['Organic Engagements']);
    const views100 = sum(['Video Views At 100', 'Video Views At 100%', 'video_views_at_100']);
    const views6s = sum(['6 Sec Video Views', '6-sec Video Views', '6_sec_video_views']);
    const shares = sum(['Shares']); const comments = sum(['Comments']); const likes = sum(['Likes']);
    const clicks = sum(['Clicks']); const searchVolume = sum(['Search Volume', 'Search Volumes', 'search_volume']);
    const productCardClicks = sum(['Product Card Clicks', 'product_card_clicks']);
    let spendAwareness = 0, spendConsideration = 0, spendConversionMedia = 0, totalMediaSpend = 0, impAwareness = 0, impConsideration = 0;
    if (extraSheetsData.mediaApi?.length && start && end) extraSheetsData.mediaApi.forEach(row => {
      const platform = String(row['Platform'] || '').toLowerCase().trim();
      if (!platform.includes('tiktok') || clean(row['Brand'] || row['Brand fx']) !== target) return;
      const date = parseSheetDate(row['Date']); if (!date || date < start || date > end) return;
      const funnel = String(row['Funnel'] || row['KPI'] || '').toLowerCase().trim();
      const spend = parseNum(row['Ad Spend'] || row['Spend'] || row['Expense']); const imp = parseNum(row['Impressions'] || row['Impression']);
      totalMediaSpend += spend;
      if (funnel.includes('awareness')) { spendAwareness += spend; impAwareness += imp; }
      else if (funnel.includes('consideration')) { spendConsideration += spend; impConsideration += imp; }
      else if (funnel.includes('conversion')) spendConversionMedia += spend;
    });
    let gmvCommerce = 0, itemsSold = 0, spendConversionComm = 0;
    if (extraSheetsData.commerce?.length && start && end) extraSheetsData.commerce.forEach(row => {
      const platform = String(row['Platform'] || '').toLowerCase().trim();
      if (!platform.includes('tiktok') || clean(row['Brand fx'] || row['Brand']) !== target) return;
      const date = parseSheetDate(row['Date']); if (!date || date < start || date > end) return;
      gmvCommerce += parseNum(row['GMV']); 
      itemsSold += parseNum(row['Items Sold']) || parseNum(row['Item sold']) || parseNum(row['items_sold']) || parseNum(row['Orders']); 
      spendConversionComm += parseNum(row['Expense']);
    });
    const gmv = gmvCommerce || sum(['GMV Ads', 'gmv_ads', 'GMV']);
    const sold = itemsSold || sum(['Items Sold', 'Item sold', 'items_sold', 'Orders']);
    const spendConversion = spendConversionComm || spendConversionMedia || sum(['Spend Conversion', 'spend_conversion']);
    const impConversion = Math.max(0, paidImpressions - impAwareness - impConsideration);
    const totalSpend = Math.max(spendAwareness + spendConsideration + spendConversion, totalMediaSpend) || sum(['Total TikTok Spend', 'Total TikTok', 'Ad Spend', 'Spend', 'total_spend']);
    const pct = (value: number, total: number) => total > 0 ? value / total : 0;
    const periodLabel = `${selectedPeriod.start} to ${selectedPeriod.end}`;
    const rows: Array<{ cat?: string; metric?: string; val?: number | string; type?: string }> = [
      { metric: 'Metrics', val: periodLabel, type: 'header' }, { cat: 'Sales', metric: 'TikTok', val: gmv }, { type: 'blank' },
      { cat: 'Scale Signal', metric: 'Impressions', val: impressions }, { metric: 'Paid', val: paidImpressions }, { metric: 'Organic', val: organicImpressions }, { metric: '% Organic', val: pct(organicImpressions, impressions), type: 'pct' },
      { cat: 'ER', metric: 'Engagements', val: engagements }, { metric: 'Paid', val: paidEngagements }, { metric: 'Organic', val: organicEngagements }, { metric: '% Organic', val: pct(organicEngagements, engagements), type: 'pct' },
      { cat: 'Attention Signal', metric: 'Video Views at 100%', val: views100 }, { metric: 'Shares', val: shares }, { metric: 'Comments', val: comments }, { metric: 'Likes', val: likes }, { metric: '6-sec Video Views', val: views6s },
      { cat: 'Intent Signal', metric: 'Clicks', val: clicks }, { metric: 'Search Volumes', val: searchVolume }, { cat: 'Commerce Signal', metric: 'Product Card Clicks', val: productCardClicks },
      { cat: 'Commerce Performance', metric: 'GMV Ads', val: gmv }, { metric: 'AOV', val: sold > 0 ? gmv / sold : 0 }, { metric: 'Item sold', val: sold }, { metric: 'CR', val: pct(sold, clicks), type: 'pct' },
      { cat: 'Engagement Performance', metric: 'CTR', val: pct(clicks, impressions), type: 'pct' }, { metric: 'VTR', val: pct(views100, impressions), type: 'pct' }, { metric: 'ER %', val: pct(engagements, impressions), type: 'pct' }, { type: 'blank' },
      { cat: 'Audience Acquisition', metric: 'New Awareness Audience', val: sum(['New Awareness Audience', 'new_awareness_audience']) }, { metric: 'New Consideration Audience', val: sum(['New Consideration Audience', 'new_consideration_audience']) }, { metric: 'New Conversion Audience', val: sum(['New Conversion Audience', 'new_conversion_audience']) }, { type: 'blank' },
      { cat: 'Funnel Delivery & Spend', metric: 'Impression Awareness', val: impAwareness }, { metric: 'CPM Awareness', val: impAwareness > 0 ? spendAwareness / impAwareness * 1000 : 0 }, { metric: 'Impression Consideration', val: impConsideration }, { metric: 'CPM Consideration', val: impConsideration > 0 ? spendConsideration / impConsideration * 1000 : 0 }, { metric: 'Impression Conversion', val: impConversion }, { metric: 'CPM Conversion', val: impConversion > 0 ? spendConversion / impConversion * 1000 : 0 }, { type: 'blank' },
      { cat: 'Ads Spend', metric: 'Funnel', val: periodLabel, type: 'subhead' }, { metric: 'Awareness', val: spendAwareness }, { metric: 'Consideration', val: spendConsideration }, { metric: 'Conversion', val: spendConversion }, { metric: 'Total TikTok', val: totalSpend, type: 'total' }, { metric: 'Awareness %', val: pct(spendAwareness, totalSpend), type: 'pct' }, { metric: 'Consideration %', val: pct(spendConsideration, totalSpend), type: 'pct' }, { metric: 'Conversion %', val: pct(spendConversion, totalSpend), type: 'pct' }, { metric: 'Total TikTok %', val: 1, type: 'total' }
    ];
    const worksheet = workbook.addWorksheet(sheetName(brand));
    worksheet.columns = [{ width: 28 }, { width: 34 }, { width: 24 }];
    rows.forEach(item => {
      const row = worksheet.addRow([item.cat || '', item.metric || '', item.val ?? '']);
      if (item.type === 'blank') { row.height = 12; return; }
      row.height = 20;
      row.eachCell((cell, column) => {
        cell.font = { name: 'Calibri', size: 11, bold: ['header', 'subhead', 'total'].includes(item.type || '') };
        cell.border = border; cell.alignment = { vertical: 'middle', horizontal: column === 3 ? 'right' : item.type === 'header' || item.type === 'subhead' ? 'center' : 'left' };
        if (item.type === 'subhead') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }; cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; }
        if (item.type === 'total') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        if (column === 3 && typeof item.val === 'number') cell.numFmt = item.type === 'pct' || (item.type === 'total' && item.val <= 1) ? '0.00%' : '#,##0';
      });
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Media_Signal_All_Brands_${selectedPeriod.start}_to_${selectedPeriod.end}.xlsx`);
}

export default function DashboardApp() {
  const [currentView, setCurrentView] = useState<'login' | 'welcome' | 'home' | 'dashboard'>('login');
  const [activeEngine, setActiveEngine] = useState<'media' | 'commerce' | 'creative' | 'signal' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dataCache = useRef<Record<string, any[]>>({});
  const [rawData, setRawData] = useState<any[]>([]);
  const [extraSheetsData, setExtraSheetsData] = useState<{ mediaApi: any[]; commerce: any[] }>({ mediaApi: [], commerce: [] });
  const [homeMediaData, setHomeMediaData] = useState<any[]>([]);
  const [homeCommerceData, setHomeCommerceData] = useState<any[]>([]);
  
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedSignalPeriod, setSelectedSignalPeriod] = useState<string>('');
  const [granularity, setGranularity] = useState('monthly');
  const [dateMonth, setDateMonth] = useState('');
  const [dateWeekly, setDateWeekly] = useState('');
  const [dateDailyStart, setDateDailyStart] = useState('');
  const [dateDailyEnd, setDateDailyEnd] = useState('');
  
  // Home Filters & Momentum Metric State
  const [homeBrand, setHomeBrand] = useState('All');
  const [homePeriods, setHomePeriods] = useState<string[]>([]);
  const [homeMomentumMetrics, setHomeMomentumMetrics] = useState<string[]>(['spend', 'commerceGmv']);
  const [isMomentumDropdownOpen, setIsMomentumDropdownOpen] = useState(false);

  const [tableColFilter1, setTableColFilter1] = useState('All');
  const [tableColFilter2, setTableColFilter2] = useState('All');

  const [dashboardContext, setDashboardContext] = useState('Overall');
  const [chartMetricsMedia, setChartMetricsMedia] = useState<string[]>(['spend', 'imp']);
  const [chartMetricsComm, setChartMetricsComm] = useState<string[]>(['exp', 'gmv']);
  const [creativePage, setCreativePage] = useState(1);
  const CREATIVES_PER_PAGE = 8;

  const [chartTypeEngine, setChartTypeEngine] = useState<'combo' | 'bar' | 'line'>('combo');
  const [homeMomentumType, setHomeMomentumType] = useState<'bar' | 'line' | 'area'>('bar');

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    Chart.defaults.font.family = "'Nunito Sans', sans-serif";
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const today = new Date();
    const yyyy_mm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const yyyy_mm_dd = `${yyyy_mm}-${String(today.getDate()).padStart(2, '0')}`;
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const start_yyyy_mm_dd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    
    setDateMonth(yyyy_mm); setDateWeekly(yyyy_mm_dd); setDateDailyStart(start_yyyy_mm_dd); setDateDailyEnd(yyyy_mm_dd);
    setHomePeriods([yyyy_mm]);
  }, []);

  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let parsed = Number(String(val).replace(/[^0-9.-]+/g, ""));
    return isNaN(parsed) ? 0 : parsed;
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

  const toYMD = (val: any) => {
    const d = parseSheetDate(val);
    if (!d || isNaN(d.getTime())) return String(val || '').trim();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    let prevMtdEnd = new Date(prevE5.getFullYear(), prevE5.getMonth(), Math.min(targetDate.getDate(), new Date(prevE5.getFullYear(), prevE5.getMonth() + 1, 0).getDate()));
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

  const loadData = async (engine: 'media' | 'commerce' | 'creative' | 'signal', forceSync = false) => {
    setDashboardContext('Overall'); setCreativePage(1); setTableColFilter1('All'); setTableColFilter2('All');
    
    if (forceSync) {
      dataCache.current[CONFIG[engine].sheet] = undefined as any;
      if (engine === 'signal') {
        dataCache.current['Media API'] = undefined as any;
        dataCache.current['Commerce'] = undefined as any;
      }
    }

    setIsLoading(true);
    try {
      const fetchSheet = async (sheetName: string) => {
        if (!forceSync && dataCache.current[sheetName]) return dataCache.current[sheetName];
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getData', sheetName })
        });
        const result = await res.json();
        if (result.success) {
          dataCache.current[sheetName] = result.data;
          return result.data;
        }
        return [];
      };

      if (engine === 'signal') {
        const [signalData, mediaApiData, commerceData] = await Promise.all([
          fetchSheet("Media Signal"),
          fetchSheet("Media API"),
          fetchSheet("Commerce")
        ]);
        setRawData(signalData);
        setExtraSheetsData({ mediaApi: mediaApiData, commerce: commerceData });
      } else {
        const data = await fetchSheet(CONFIG[engine].sheet);
        setRawData(data);
      }
    } catch (err) { alert("Network error loading sheet data."); }
    setIsLoading(false);
  };

  const selectEngine = (engine: 'media' | 'commerce' | 'creative' | 'signal') => {
    setActiveEngine(engine); setCurrentView('dashboard'); loadData(engine);
  };

  const loadHomeData = async (forceSync = false) => {
    setIsLoading(true);
    try {
      if (forceSync) {
        dataCache.current['Media API'] = undefined as any;
        dataCache.current['Commerce'] = undefined as any;
      }

      const fetchSheet = async (sheetName: string) => {
        if (!forceSync && dataCache.current[sheetName]) return dataCache.current[sheetName];
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getData', sheetName })
        });
        const result = await res.json();
        if (result.success) {
          dataCache.current[sheetName] = result.data;
          return result.data;
        }
        return [];
      };

      const [mediaData, commerceData] = await Promise.all([fetchSheet('Media API'), fetchSheet('Commerce')]);
      setHomeMediaData(mediaData);
      setHomeCommerceData(commerceData);
    } catch (err) {
      alert('Network error loading Home data.');
    }
    setIsLoading(false);
  };

  const selectHome = (forceSync = false) => {
    setActiveEngine(null);
    setCurrentView('home');
    loadHomeData(forceSync);
  };

  const handleFilterChange = (key: string, value: string) => { setFilters(prev => ({ ...prev, [key]: value })); setCreativePage(1); };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setTableColFilter1('All');
    setTableColFilter2('All');
    setCreativePage(1);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  const isValidBrandName = (brand: any) => {
    const s = String(brand || '').trim();
    if (!s) return false;
    const lower = s.toLowerCase();
    return lower !== '-' && lower !== 'na' && lower !== 'n/a' && lower !== 'null' && lower !== 'undefined';
  };

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

    const unique = Array.from(new Set(filtered.map(r => r[colName]))).filter(v => {
      if (!v || String(v).trim() === "") return false;
      if (colName.toLowerCase().includes('brand')) return isValidBrandName(v);
      return true;
    });
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
  const signalPeriods = useMemo(() => {
    if (activeEngine !== 'signal' || rawData.length === 0) return [];
    const unique = new Map<string, { start: string; end: string }>();
    rawData.forEach(r => {
      const s = toYMD(r['Start Date'] || r['start_date']);
      const e = toYMD(r['End Date'] || r['end_date']);
      if (s && e) {
        const key = `${s}_to_${e}`;
        if (!unique.has(key)) unique.set(key, { start: s, end: e });
      }
    });

    const list = Array.from(unique.entries()).map(([key, val]) => ({
      key,
      start: val.start,
      end: val.end,
      label: `${val.start} to ${val.end}`
    }));

    return list.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [rawData, activeEngine]);

  useEffect(() => {
    if (activeEngine === 'signal' && signalPeriods.length > 0 && !selectedSignalPeriod) {
      setSelectedSignalPeriod(signalPeriods[0].key);
    }
  }, [activeEngine, signalPeriods, selectedSignalPeriod]);

  // --- MEDIA SIGNAL DATA COMPILER ---
  const signalCompiled = useMemo(() => {
    if (activeEngine !== 'signal' || rawData.length === 0 || !selectedSignalPeriod) return null;

    const currentPeriodObj = signalPeriods.find(p => p.key === selectedSignalPeriod);
    if (!currentPeriodObj) return null;

    const shiftMonth = (value: string) => {
      const date = parseSheetDate(value);
      if (!date || isNaN(date.getTime())) return '';
      const targetMonth = date.getMonth() - 1;
      const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
      const shifted = new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
      return toYMD(shifted);
    };
    const prevPeriodObj = {
      start: shiftMonth(currentPeriodObj.start),
      end: shiftMonth(currentPeriodObj.end)
    };

    const cleanStr = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetBrand = cleanStr(filters.brand);

    const findVal = (row: any, candidates: string[]) => {
      for (const cand of candidates) {
        const found = Object.keys(row).find(k => k.toLowerCase().trim() === cand.toLowerCase().trim());
        if (found !== undefined && row[found] !== undefined && row[found] !== '') {
          return row[found];
        }
      }
      return '';
    };
    const compilePeriod = (periodObj: { start: string; end: string } | null, isPlanOnly = false) => {
      if (!periodObj) return null;

      const pStart = parseSheetDate(periodObj.start); if (pStart) pStart.setHours(0,0,0,0);
      const pEnd = parseSheetDate(periodObj.end); if (pEnd) pEnd.setHours(23,59,59,999);

      const signalSubset = rawData.filter(row => {
        const b = cleanStr(row['Brand']);
        if (targetBrand !== 'all' && b !== targetBrand) return false;
        const s = toYMD(row['Start Date'] || row['start_date']);
        const e = toYMD(row['End Date'] || row['end_date']);
        if (s !== periodObj.start || e !== periodObj.end) return false;

        const statusVal = String(findVal(row, ['Status', 'status', 'Type'])).toLowerCase().trim();
        return isPlanOnly ? statusVal.includes('plan') : statusVal.includes('actual') || (!statusVal.includes('plan') && statusVal !== '');
      });

      const sumSignal = (keys: string[]) => {
        return signalSubset.reduce((acc, row) => {
          const val = findVal(row, keys);
          return acc + parseNum(val);
        }, 0);
      };

      const impressions = sumSignal(['Impressions', 'Total Impressions']);
      const paidImpressions = sumSignal(['Paid Impressions']);
      const organicImpressions = sumSignal(['Organic Impressions']);
      const engagements = sumSignal(['Engagements', 'Total Engagements']);
      const paidEngagements = sumSignal(['Paid Engagements']);
      const organicEngagements = sumSignal(['Organic Engagements']);
      const views100 = sumSignal(['Video Views At 100', 'Video Views At 100%', 'video_views_at_100']);
      const views6s = sumSignal(['6 Sec Video Views', '6-sec Video Views', '6_sec_video_views']);
      const shares = sumSignal(['Shares']);
      const comments = sumSignal(['Comments']);
      const likes = sumSignal(['Likes']);
      const clicks = sumSignal(['Clicks']);
      const searchVolume = sumSignal(['Search Volume', 'Search Volumes', 'search_volume']);
      const productCardClicks = sumSignal(['Product Card Clicks', 'product_card_clicks']);
      const newAwareness = sumSignal(['New Awareness Audience', 'new_awareness_audience']);
      const newConsideration = sumSignal(['New Consideration Audience', 'new_consideration_audience']);
      const newConversion = sumSignal(['New Conversion Audience', 'new_conversion_audience']);

      let spendAwareness = 0; let spendConsideration = 0; let spendConversionMedia = 0; let totalMediaSpend = 0;
      let impAwareness = 0; let impConsideration = 0;

      if (!isPlanOnly && extraSheetsData.mediaApi && extraSheetsData.mediaApi.length > 0 && pStart && pEnd) {
        extraSheetsData.mediaApi.forEach(row => {
          const plat = String(row['Platform'] || '').toLowerCase().trim();
          const b = cleanStr(row['Brand'] || row['Brand fx']);
          if (!plat.includes('tiktok')) return;
          if (targetBrand !== 'all' && b !== targetBrand) return;
          const rDate = parseSheetDate(row['Date']);
          if (!rDate || rDate < pStart || rDate > pEnd) return;

          const f = String(row['Funnel'] || row['KPI'] || '').toLowerCase().trim();
          const s = parseNum(row['Ad Spend'] || row['Spend'] || row['Expense']);
          const i = parseNum(row['Impressions'] || row['Impression']);

          totalMediaSpend += s;
          if (f.includes('awareness')) { spendAwareness += s; impAwareness += i; }
          else if (f.includes('consideration')) { spendConsideration += s; impConsideration += i; }
          else if (f.includes('conversion')) { spendConversionMedia += s; }
        });
      }

      let gmvCommerce = 0; let itemsSold = 0; let spendConversionComm = 0;

      if (!isPlanOnly && extraSheetsData.commerce && extraSheetsData.commerce.length > 0 && pStart && pEnd) {
        extraSheetsData.commerce.forEach(row => {
          const plat = String(row['Platform'] || '').toLowerCase().trim();
          const b = cleanStr(row['Brand fx'] || row['Brand']);
          if (!plat.includes('tiktok')) return;
          if (targetBrand !== 'all' && b !== targetBrand) return;
          const rDate = parseSheetDate(row['Date']);
          if (!rDate || rDate < pStart || rDate > pEnd) return;

          gmvCommerce += parseNum(row['GMV']);
          itemsSold += parseNum(row['Items Sold']) || parseNum(row['Item sold']) || parseNum(row['items_sold']) || parseNum(row['Orders']);
          spendConversionComm += parseNum(row['Expense']);
        });
      }

      const signalSpend = sumSignal(['Total TikTok Spend', 'Total TikTok', 'Ad Spend', 'Spend', 'total_spend']);
      const spendConversion = spendConversionComm || spendConversionMedia || sumSignal(['Spend Conversion', 'spend_conversion']);
      const totalSpend = isPlanOnly
        ? signalSpend || sumSignal(['Spend Awareness', 'Spend Consideration', 'Spend Conversion'])
        : Math.max(spendAwareness + spendConsideration + spendConversion, totalMediaSpend) || signalSpend;

      const impConversion = isPlanOnly ? 0 : (sumSignal(['Impression Conversion', 'imp_conversion']) || Math.max(0, paidImpressions - impAwareness - impConsideration));
      const gmvAds = gmvCommerce || sumSignal(['GMV Ads', 'gmv_ads', 'GMV']);
      const finalItemsSold = itemsSold || sumSignal(['Items Sold', 'Item sold', 'items_sold', 'Orders']);

      return {
        impressions, paidImpressions, organicImpressions,
        pctOrganicImp: impressions > 0 ? organicImpressions / impressions : 0,
        engagements, paidEngagements, organicEngagements,
        pctOrganicEng: engagements > 0 ? organicEngagements / engagements : 0,
        views100, views6s, shares, comments, likes,
        clicks, searchVolume, productCardClicks,
        gmvAds, itemsSold: finalItemsSold,
        aov: finalItemsSold > 0 ? gmvAds / finalItemsSold : 0,
        cr: clicks > 0 ? finalItemsSold / clicks : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        vtr: impressions > 0 ? views100 / impressions : 0,
        er: impressions > 0 ? engagements / impressions : 0,
        newAwareness, newConsideration, newConversion,
        costPerConsi: newConsideration > 0 ? spendConsideration / newConsideration : 0,
        costPerConv: newConversion > 0 ? spendConversion / newConversion : 0,
        impAwareness, impConsideration, impConversion,
        cpmAwareness: impAwareness > 0 ? (spendAwareness / impAwareness) * 1000 : 0,
        cpmConsideration: impConsideration > 0 ? (spendConsideration / impConsideration) * 1000 : 0,
        cpmConversion: impConversion > 0 ? (spendConversion / impConversion) * 1000 : 0,
        spendAwareness, spendConsideration, spendConversion, totalSpend
      };
    };

    const actual = compilePeriod(currentPeriodObj, false);
    const plan = compilePeriod(currentPeriodObj, true);
    const prev = compilePeriod(prevPeriodObj, false);

    const computeAch = (act: number, pln: number) => {
      if (pln <= 0) return act > 0 ? 1 : 0;
      return act / pln;
    };

    return {
      actual,
      plan,
      prev,
      computeAch,
      currentPeriod: currentPeriodObj,
      prevPeriod: prevPeriodObj
    };
  }, [rawData, extraSheetsData, filters.brand, activeEngine, selectedSignalPeriod, signalPeriods]);

  const signalHierarchyGroups = useMemo(() => {
    if (!signalCompiled) return [];

    const metric = (name: string, key: string, fmt: (value: number) => string, isInv = false, overridePlan?: number) => ({
      name,
      act: signalCompiled.actual?.[key],
      pln: overridePlan !== undefined ? overridePlan : signalCompiled.plan?.[key],
      prv: signalCompiled.prev?.[key],
      fmt,
      isInv
    });

    return [
      {
        category: "Scale Signal",
        rows: [
          metric("Total Impressions", "impressions", formatNum),
          metric("Paid Impressions", "paidImpressions", formatNum),
          metric("Organic Impressions", "organicImpressions", formatNum),
          metric("% Organic Impressions", "pctOrganicImp", formatPct)
        ]
      },
      {
        category: "Engagement Signal & Performance",
        rows: [
          metric("Total Engagements", "engagements", formatNum),
          metric("Paid Engagements", "paidEngagements", formatNum),
          metric("Organic Engagements", "organicEngagements", formatNum),
          metric("% Organic Engagements", "pctOrganicEng", formatPct),
          metric("CTR", "ctr", formatPct),
          metric("VTR", "vtr", formatPct),
          metric("ER %", "er", formatPct)
        ]
      },
      {
        category: "Attention Signal",
        rows: [
          metric("Video Views at 100%", "views100", formatNum),
          metric("6-sec Video Views", "views6s", formatNum),
          metric("Shares", "shares", formatNum),
          metric("Comments", "comments", formatNum),
          metric("Likes", "likes", formatNum)
        ]
      },
      {
        category: "Intent Signal",
        rows: [
          metric("Clicks", "clicks", formatNum),
          metric("Search Volumes", "searchVolume", formatNum)
        ]
      },
      {
        category: "Commerce Signal & Performance",
        rows: [
          metric("Product Card Clicks", "productCardClicks", formatNum),
          metric("GMV Ads", "gmvAds", formatIDR),
          metric("Items Sold", "itemsSold", formatNum),
          metric("AOV", "aov", formatIDR),
          metric("CR %", "cr", formatPct)
        ]
      },
      {
        category: "Audience Acquisition & Efficiency",
        rows: [
          metric("New Awareness Audience", "newAwareness", formatNum),
          metric("New Consideration Audience", "newConsideration", formatNum),
          metric("New Conversion Audience", "newConversion", formatNum),
          metric("Cost per new Consi", "costPerConsi", formatIDR, true),
          metric("Cost per new Conversion", "costPerConv", formatIDR, true)
        ]
      },
      {
        category: "Funnel Delivery & Spend Breakdown",
        rows: [
          metric("Impression Awareness", "impAwareness", formatNum),
          metric("CPM Awareness", "cpmAwareness", formatIDR, true),
          metric("Impression Consideration", "impConsideration", formatNum),
          metric("CPM Consideration", "cpmConsideration", formatIDR, true),
          metric("Impression Conversion", "impConversion", formatNum, false, 0),
          metric("CPM Conversion", "cpmConversion", formatIDR, true),
          metric("Spend Awareness", "spendAwareness", formatIDR, false),
          metric("Spend Consideration", "spendConsideration", formatIDR, false),
          metric("Spend Conversion", "spendConversion", formatIDR, false),
          metric("Total TikTok Spend", "totalSpend", formatIDR, false)
        ]
      }
    ];
  }, [signalCompiled]);

  const { curData, prevData, chartData, creativeData, globalDates } = useMemo(() => {
    if (!activeEngine || activeEngine === 'signal' || rawData.length === 0) return { curData: [], prevData: [], chartData: [], creativeData: [], globalDates: null };
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

  const { ctxCurData, ctxPrevData, ctxChartData } = useMemo(() => {
    if (dashboardContext === 'Overall' || activeEngine === 'creative' || activeEngine === 'signal') return { ctxCurData: curData, ctxPrevData: prevData, ctxChartData: chartData };
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

  const homeBrandOptions = useMemo(() => {
    const brands = new Set<string>();
    homeMediaData.forEach(row => {
      const brand = String(row['Brand'] || '').trim();
      if (isValidBrandName(brand)) brands.add(brand);
    });
    homeCommerceData.forEach(row => {
      const brand = String(row['Brand fx'] || '').trim();
      if (isValidBrandName(brand)) brands.add(brand);
    });
    return ['All', ...Array.from(brands).sort()];
  }, [homeMediaData, homeCommerceData]);

  const availableHomeMonths = useMemo(() => {
    const months = new Set<string>();
    const addDate = (dStr: any) => {
      const d = parseSheetDate(dStr);
      if (d && !isNaN(d.getTime())) {
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    };
    homeMediaData.forEach(r => addDate(r['Date']));
    homeCommerceData.forEach(r => addDate(r['Date']));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [homeMediaData, homeCommerceData]);

  const handleToggleHomeMonth = (month: string) => {
    setHomePeriods(prev => {
      if (prev.includes(month)) {
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== month);
      } else {
        return [...prev, month].sort();
      }
    });
  };

  const handleToggleMomentumMetric = (metricKey: string) => {
    setHomeMomentumMetrics(prev => {
      if (prev.includes(metricKey)) {
        if (prev.length === 1) return prev;
        return prev.filter(k => k !== metricKey);
      } else {
        if (prev.length >= 2) return [prev[1], metricKey];
        return [...prev, metricKey];
      }
    });
  };

  // --- HOME / GENERAL OVERVIEW SUMMARY COMPILER ---
  const homeSummary = useMemo(() => {
    if (!homePeriods.length) return null;

    const normalizeDate = (value: any) => {
      const date = parseSheetDate(value);
      if (!date || isNaN(date.getTime())) return null;
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const getMonthRanges = (periodList: string[]) => {
      return periodList.map(p => {
        const [year, month] = p.split('-').map(Number);
        return {
          start: new Date(year, month - 1, 1),
          end: new Date(year, month, 0, 23, 59, 59, 999)
        };
      });
    };

    const getPrevMonthRanges = (periodList: string[]) => {
      return periodList.map(p => {
        const [year, month] = p.split('-').map(Number);
        return {
          start: new Date(year, month - 2, 1),
          end: new Date(year, month - 1, 0, 23, 59, 59, 999)
        };
      });
    };

    const currentRanges = getMonthRanges(homePeriods);
    const previousRanges = getPrevMonthRanges(homePeriods);

    const inRanges = (date: Date | null, ranges: { start: Date; end: Date }[]) => {
      if (!date) return false;
      return ranges.some(r => date >= r.start && date <= r.end);
    };

    const matchesBrand = (value: any) => homeBrand === 'All' || String(value || '').trim() === homeBrand;
    const mediaRows = homeMediaData.filter(row => matchesBrand(row['Brand']));
    const commerceRows = homeCommerceData.filter(row => matchesBrand(row['Brand fx']));

    const currentMedia = mediaRows.filter(row => inRanges(normalizeDate(row['Date']), currentRanges));
    const previousMedia = mediaRows.filter(row => inRanges(normalizeDate(row['Date']), previousRanges));
    const currentCommerce = commerceRows.filter(row => inRanges(normalizeDate(row['Date']), currentRanges));
    const previousCommerce = commerceRows.filter(row => inRanges(normalizeDate(row['Date']), previousRanges));

    const sum = (rows: any[], field: string) => rows.reduce((total, row) => total + parseNum(row[field]), 0);
    const mediaMetrics = (rows: any[]) => {
      const spend = sum(rows, 'Ad Spend');
      const impressions = sum(rows, 'Impressions');
      const clicks = sum(rows, 'Combined Clicks');
      const views6s = sum(rows, 'Views 6s');
      const views15s = sum(rows, 'Views');
      const engagement = clicks + views6s + views15s;
      const views = views15s + views6s;
      return { spend, impressions, clicks, views, engagement, ctr: impressions ? clicks / impressions : 0, vtr: impressions ? views / impressions : 0 };
    };
    const commerceMetrics = (rows: any[]) => {
      const expense = sum(rows, 'Expense');
      const impressions = rows.reduce(
        (acc, row) => acc + (parseNum(row['Impression']) || parseNum(row['Impressions']) || 0),
        0
      );
      const clicks = rows.reduce(
        (acc, row) => acc + (parseNum(row['Clicks']) || parseNum(row['Combined Clicks']) || 0),
        0
      );
      const gmv = sum(rows, 'GMV');
      const orders = rows.reduce(
        (total, row) => total + parseNum(row['Items Sold'] || row['Item sold'] || row['items_sold'] || row['Orders']),
        0
      );
      return { expense, impressions, clicks, gmv, orders, roas: expense ? gmv / expense : 0 };
    };
    const groupSum = (rows: any[], key: string, value: string) => {
      const grouped = new Map<string, number>();
      rows.forEach(row => {
        const label = String(row[key] || 'Unspecified').trim() || 'Unspecified';
        grouped.set(label, (grouped.get(label) || 0) + parseNum(row[value]));
      });
      return Array.from(grouped, ([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    };

    const latestSortedMonth = [...homePeriods].sort().pop() || '';
    const [latestYear, latestMonth] = latestSortedMonth.split('-').map(Number);
    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const trend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(latestYear, latestMonth - 1 - (5 - index), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      const media = mediaMetrics(mediaRows.filter(row => inRanges(normalizeDate(row['Date']), [{ start, end }])));
      const commerce = commerceMetrics(commerceRows.filter(row => inRanges(normalizeDate(row['Date']), [{ start, end }])));
      return {
        key: monthKey(date),
        label: date.toLocaleString('en-GB', { month: 'short' }),
        spend: media.spend + commerce.expense,
        mediaSpend: media.spend,
        commerceExpense: commerce.expense,
        impressions: media.impressions + commerce.impressions,
        clicks: media.clicks + commerce.clicks,
        engagement: media.engagement + commerce.clicks,
        commerceGmv: commerce.gmv,
        orders: commerce.orders
      };
    });

    const funnelTrend = trend.map(item => {
      const date = new Date(`${item.key}-01T00:00:00`);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      const rows = mediaRows.filter(row => inRanges(normalizeDate(row['Date']), [{ start, end }]));
      return { ...item, mix: groupSum(rows, 'Funnel', 'Ad Spend').slice(0, 4) };
    });

    const platformTrend = trend.map(item => {
      const date = new Date(`${item.key}-01T00:00:00`);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      const mRows = mediaRows.filter(row => inRanges(normalizeDate(row['Date']), [{ start, end }]));
      const cRows = commerceRows.filter(row => inRanges(normalizeDate(row['Date']), [{ start, end }]));
      const mPlat = groupSum(mRows, 'Platform', 'Ad Spend');
      const cPlat = groupSum(cRows, 'Platform', 'Expense');
      const combined = new Map<string, number>();
      mPlat.concat(cPlat).forEach(p => combined.set(p.label, (combined.get(p.label) || 0) + p.total));
      const mix = Array.from(combined, ([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total).slice(0, 4);
      return { ...item, mix };
    });

    const current = { media: mediaMetrics(currentMedia), commerce: commerceMetrics(currentCommerce) };
    const previous = { media: mediaMetrics(previousMedia), commerce: commerceMetrics(previousCommerce) };

    const currentTotalSpend = current.media.spend + current.commerce.expense;
    const previousTotalSpend = previous.media.spend + previous.commerce.expense;

    const currentTotalImpressions = current.media.impressions + current.commerce.impressions;
    const previousTotalImpressions = previous.media.impressions + previous.commerce.impressions;

    const currentTotalEngagement = current.media.engagement + current.commerce.clicks;
    const previousTotalEngagement = previous.media.engagement + previous.commerce.clicks;

    const maxOf = (items: { total: number }[]) => Math.max(...items.map(item => item.total), 1);
    const platformMix = groupSum(currentMedia, 'Platform', 'Ad Spend').concat(groupSum(currentCommerce, 'Platform', 'Expense'));
    const platformTotals = Array.from(
      platformMix.reduce((map, item) => map.set(item.label, (map.get(item.label) || 0) + item.total), new Map<string, number>()),
      ([label, total]) => ({ label, total })
    ).sort((a, b) => b.total - a.total);

    const formattedPeriodLabel = homePeriods.length === 1
      ? new Date(`${homePeriods[0]}-01`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
      : `${homePeriods.length} Months Selected (${homePeriods.sort().join(', ')})`;

    return {
      current,
      previous,
      currentTotalSpend,
      previousTotalSpend,
      currentTotalImpressions,
      previousTotalImpressions,
      currentTotalEngagement,
      previousTotalEngagement,
      trend,
      funnelTrend,
      platformTrend,
      funnelMix: groupSum(currentMedia, 'Funnel', 'Ad Spend').slice(0, 5),
      formatMix: groupSum(currentMedia, 'Format', 'Ad Spend').slice(0, 6),
      platformMix: platformTotals.slice(0, 5),
      maxOf,
      periodLabel: formattedPeriodLabel
    };
  }, [homeMediaData, homeCommerceData, homeBrand, homePeriods]);

  const renderGR = (cur: number, prev: number, isInv = false) => {
    if (prev === 0 && cur === 0) return <span className="text-[10px] ml-2 font-bold opacity-40">-</span>;
    const gr = getGr(cur, prev);
    let color = isDarkMode ? "text-slate-200 bg-slate-700/50" : "text-white bg-white/30"; let arrow = "";
    if (gr > 0) { color = isInv ? "text-white bg-rose-500/60" : "text-white bg-emerald-500/60"; arrow = "▲"; } 
    else if (gr < 0) { color = isInv ? "text-white bg-emerald-500/60" : "text-white bg-rose-500/60"; arrow = "▼"; } 
    else return <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded font-bold ${color}`}>-</span>;
    return <span className={`text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold tracking-wide backdrop-blur-sm shadow-sm ${color}`}>{arrow} {formatPct(Math.abs(gr))}</span>;
  };

  // --- CHART RENDERING (ENGINE TABS) ---
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

      const appendMtdSeries = (data: any[], periodStart: Date, periodEnd: Date) => {
        const running = isMedia ? { spend: 0, imp: 0, clicks: 0, views: 0 } : { exp: 0, gmv: 0, orders: 0 };
        weeks.forEach(w => {
          const weekNum = parseInt(w.replace('W', ''));
          const periodDate = new Date(periodStart);
          periodDate.setDate(periodDate.getDate() + (weekNum * 7) - 1);
          if (periodDate > periodEnd) periodDate.setTime(periodEnd.getTime());

          data.filter(r => r.bucket === w).forEach(row => {
            if (isMedia) {
              running.spend += parseNum(row['Ad Spend']);
              running.imp += parseNum(row['Impressions']);
              running.clicks += parseNum(row['Combined Clicks']);
              running.views += parseNum(row['Views']) + parseNum(row['Views 6s']);
            } else {
              running.exp += parseNum(row['Expense']);
              running.gmv += parseNum(row['GMV']);
              running.orders += parseNum(row['Items Sold'] || row['Item sold'] || row['items_sold'] || row['Orders']);
            }
          });

          const fmtStr = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
          groupedData[`MTD ${fmtStr(periodDate)}`] = { ...running };
        });
      };

      appendMtdSeries(ctxPrevData, globalDates.prevStart, globalDates.prevMtdEnd);
      appendMtdSeries(ctxCurData, globalDates.curStart, globalDates.curMtdEnd);
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
          groupedData[label].exp += parseNum(row['Expense']); groupedData[label].gmv += parseNum(row['GMV']); 
          groupedData[label].orders += parseNum(row['Items Sold'] || row['Item sold'] || row['items_sold'] || row['Orders']);
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
        'spend': { label: 'Spend', data: labels.map(l => groupedData[l].spend), color: '#4f46e5', bg: '#4f46e5', defaultType: 'bar' },
        'imp': { label: 'Impr', data: labels.map(l => groupedData[l].imp), color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', defaultType: 'line' },
        'clicks': { label: 'Clicks', data: labels.map(l => groupedData[l].clicks), color: '#84cc16', bg: 'transparent', defaultType: 'line' },
        'views': { label: 'Views', data: labels.map(l => groupedData[l].views), color: '#f59e0b', bg: 'transparent', defaultType: 'line' },
        'ctr': { label: 'CTR', data: labels.map(l => groupedData[l].imp>0 ? (groupedData[l].clicks/groupedData[l].imp)*100 : 0), color: '#ec4899', bg: 'transparent', defaultType: 'line' },
        'vtr': { label: 'VTR', data: labels.map(l => groupedData[l].imp>0 ? (groupedData[l].views/groupedData[l].imp)*100 : 0), color: '#06b6d4', bg: 'transparent', defaultType: 'line' }
      };
      chartMetricsMedia.forEach((key, idx) => {
        const c = configs[key];
        const assignedType = chartTypeEngine === 'combo' ? c.defaultType : chartTypeEngine;
        datasets.push({
          label: c.label,
          data: c.data,
          type: assignedType,
          backgroundColor: c.bg,
          borderColor: c.color,
          yAxisID: idx === 0 ? 'y' : 'y1',
          tension: 0.4,
          fill: assignedType === 'line' && key === 'imp',
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderRadius: assignedType === 'bar' ? 6 : 0
        });
      });
    } else {
      const configs: any = {
        'exp': { label: 'Expense', data: labels.map(l => groupedData[l].exp), color: '#4f46e5', bg: '#4f46e5', defaultType: 'bar' },
        'gmv': { label: 'GMV', data: labels.map(l => groupedData[l].gmv), color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', defaultType: 'line' },
        'orders': { label: 'Orders', data: labels.map(l => groupedData[l].orders), color: '#84cc16', bg: 'transparent', defaultType: 'line' },
        'roas': { label: 'ROAS', data: labels.map(l => groupedData[l].exp>0 ? groupedData[l].gmv/groupedData[l].exp : 0), color: '#f59e0b', bg: 'transparent', defaultType: 'line' },
        'cpa': { label: 'CPA', data: labels.map(l => groupedData[l].orders>0 ? groupedData[l].exp/groupedData[l].orders : 0), color: '#ec4899', bg: 'transparent', defaultType: 'line' }
      };
      chartMetricsComm.forEach((key, idx) => {
        const c = configs[key];
        const assignedType = chartTypeEngine === 'combo' ? c.defaultType : chartTypeEngine;
        datasets.push({
          label: c.label,
          data: c.data,
          type: assignedType,
          backgroundColor: c.bg,
          borderColor: c.color,
          yAxisID: idx === 0 ? 'y' : 'y1',
          tension: 0.4,
          fill: assignedType === 'line' && key === 'gmv',
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderRadius: assignedType === 'bar' ? 6 : 0
        });
      });
    }

    chartInstance.current = new Chart(ctx, {
      type: chartTypeEngine === 'line' ? 'line' : 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 400,
          easing: 'easeInOutQuart'
        },
        interaction: { mode: 'index', intersect: false },
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
          },
          tooltip: {
            animation: { duration: 0 }
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
  }, [ctxChartData, ctxCurData, ctxPrevData, globalDates, chartMetricsMedia, chartMetricsComm, activeEngine, granularity, isDarkMode, chartTypeEngine]);

  const getGrHTML = useCallback((cur: number, prev: number, invertColors = false) => {
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
  }, [isDarkMode]);

  // --- PLATFORM SUMMARY BODY GENERATOR (DIGITAL MEDIA) ---
  const generatePlatformSummaryBodyHTML = useCallback(() => {
    if (activeEngine !== 'media') return '';

    const filterPlatform = (rows: any[], plat: 'Overall' | 'Meta' | 'TikTok') => {
      if (plat === 'Overall') return rows;
      return rows.filter(r => {
        const p = String(r[CONFIG.media.colPlatform] || '').toLowerCase();
        if (plat === 'Meta') return p.includes('meta') || p.includes('facebook') || p.includes('ig') || p.includes('instagram');
        return p.includes('tiktok');
      });
    };

    const calcSum = (rows: any[]) => {
      let spend = 0, imp = 0, clicks = 0, v6 = 0, v15 = 0;
      rows.forEach(r => {
        spend += parseNum(r['Ad Spend']);
        imp += parseNum(r['Impressions']);
        clicks += parseNum(r['Combined Clicks']);
        v6 += parseNum(r['Views 6s']);
        v15 += parseNum(r['Views']);
      });
      return {
        spend,
        imp,
        cpm: imp > 0 ? (spend / imp) * 1000 : 0,
        ctr: imp > 0 ? clicks / imp : 0,
        vtr6: imp > 0 ? v6 / imp : 0,
        vtr15: imp > 0 ? v15 / imp : 0
      };
    };

    const platforms: ('Overall' | 'Meta' | 'TikTok')[] = ['Overall', 'Meta', 'TikTok'];
    const metricNames = [
      { name: 'Spend', key: 'spend', fmt: formatIDR, isInv: false },
      { name: 'Impression', key: 'imp', fmt: formatNum, isInv: false },
      { name: 'CPM', key: 'cpm', fmt: formatIDR, isInv: true },
      { name: 'CTR', key: 'ctr', fmt: formatPct, isInv: false },
      { name: 'VTR (6s)', key: 'vtr6', fmt: formatPct, isInv: false },
      { name: 'VTR (15s)', key: 'vtr15', fmt: formatPct, isInv: false }
    ];

    let tbody = '';

    if (granularity === 'monthly') {
      platforms.forEach(plat => {
        const curTotals = calcSum(filterPlatform(ctxCurData, plat));
        const prevTotals = calcSum(filterPlatform(ctxPrevData, plat));

        metricNames.forEach((m, i) => {
          const curV = (curTotals as any)[m.key];
          const prevV = (prevTotals as any)[m.key];
          let rowCls = i % 2 === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50');
          if (i === 0) rowCls += ' group-start';
          if (i === metricNames.length - 1) rowCls += ' group-end';

          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if (i === 0) {
            tbody += `<td rowspan="${metricNames.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${plat}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-2 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.name}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(curV)}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(prevV)}</td>`;
          tbody += getGrHTML(curV, prevV, m.isInv);
          tbody += `</tr>`;
        });
      });
    } else if (granularity === 'weekly') {
      let weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
      let weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));

      platforms.forEach(plat => {
        const curRows = filterPlatform(ctxCurData, plat);
        const prevRows = filterPlatform(ctxPrevData, plat);
        const curTotal = calcSum(curRows);
        const prevTotal = calcSum(prevRows);

        metricNames.forEach((m, i) => {
          let rowCls = i % 2 === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50');
          if (i === 0) rowCls += ' group-start';
          if (i === metricNames.length - 1) rowCls += ' group-end';

          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if (i === 0) {
            tbody += `<td rowspan="${metricNames.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${plat}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-2 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.name}</td>`;

          let curCumulRows: any[] = [];
          let prevCumulRows: any[] = [];

          weeks.forEach(w => {
            curCumulRows = curCumulRows.concat(curRows.filter(r => r.bucket === w));
            prevCumulRows = prevCumulRows.concat(prevRows.filter(r => r.bucket === w));
            const wc = (calcSum(curCumulRows) as any)[m.key];
            const wp = (calcSum(prevCumulRows) as any)[m.key];

            tbody += `<td class="px-4 py-3 text-right font-mono font-semibold border-l ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(wc)}</td>
                      <td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(wp)}</td>
                      ${getGrHTML(wc, wp, m.isInv)}`;
          });

          const curTotVal = (curTotal as any)[m.key];
          const prevTotVal = (prevTotal as any)[m.key];
          tbody += `<td class="px-4 py-3 text-right font-mono border-l ${isDarkMode ? 'border-indigo-500 text-indigo-300 bg-indigo-950/50' : 'border-slate-200 text-indigo-700 bg-indigo-50/50'} font-bold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(curTotVal)}</td>
                    <td class="px-4 py-3 text-right font-mono font-medium text-slate-500 ${isDarkMode ? 'bg-indigo-950/50' : 'bg-indigo-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(prevTotVal)}</td>
                    ${getGrHTML(curTotVal, prevTotVal, m.isInv)}</tr>`;
        });
      });
    } else if (granularity === 'daily') {
      let daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); let days = Array.from(daysFound).sort();

      platforms.forEach(plat => {
        const platRows = filterPlatform(ctxCurData, plat);
        const totalSum = calcSum(platRows);

        metricNames.forEach((m, i) => {
          let rowCls = i % 2 === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50');
          if (i === 0) rowCls += ' group-start';
          if (i === metricNames.length - 1) rowCls += ' group-end';

          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if (i === 0) {
            tbody += `<td rowspan="${metricNames.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${plat}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-2 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.name}</td>`;

          days.forEach(d => {
            const daySum = calcSum(platRows.filter(r => r.bucket === d));
            tbody += `<td class="px-4 py-3 text-right font-mono font-semibold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt((daySum as any)[m.key])}</td>`;
          });
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-indigo-300 bg-indigo-950/50 border-l border-indigo-800/50' : 'text-indigo-700 bg-indigo-50/50 border-l border-indigo-100'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt((totalSum as any)[m.key])}</td></tr>`;
        });
      });
    }

    return tbody;
  }, [ctxCurData, ctxPrevData, granularity, activeEngine, isDarkMode, getGrHTML]);

  // --- MANUAL TABLE RENDERER FOR MEDIA & COMMERCE ---
  const generateTableHTML = useCallback(() => {
    if (activeEngine === 'creative' || activeEngine === 'signal') return { head: '', body: '', uniqueDim1: [], uniqueDim2: [] };
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
        target.clicks += parseNum(row["Clicks"]); 
        target.orders += parseNum(row["Items Sold"] || row["Item sold"] || row["items_sold"] || row["Orders"]);
        target.gmv += parseNum(row["GMV"]); target.liveViews += parseNum(row["Live Views"]);
      }
    };

    const getDisplayMetricsArray = (g: any, adTypeLower: string) => {
      if (isMedia) {
        let m = [
          { name: "Cost", raw: g.spend, fmt: formatIDR(g.spend), isInv: false }, { name: "Impression", raw: g.imp, fmt: formatNum(g.imp), isInv: false },
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
          { name: "Expense", raw: g.exp, fmt: formatIDR(g.exp), isInv: false }, { name: "Orders", raw: g.orders, fmt: formatNum(g.orders), isInv: false },
          { name: "GMV", raw: g.gmv, fmt: formatIDR(g.gmv), isInv: false }, { name: "CPA", raw: g.orders>0?(g.exp/g.orders):0, fmt: formatIDR(g.orders>0?(g.exp/g.orders):0), isInv: true },
          { name: "ROAS", raw: g.exp>0?(g.gmv/g.exp):0, fmt: (g.exp>0?(g.gmv/g.exp):0).toFixed(2)+"x", isInv: false }
        ];
        if (adTypeLower.includes('live official') || adTypeLower.includes('live affiliate')) m.splice(1, 0, { name: "Live Views", raw: g.liveViews, fmt: formatNum(g.liveViews), isInv: false });
        return m;
      }
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
                <th class="px-4 py-4 text-right text-slate-400 bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD Total Prev</th>
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
  }, [ctxCurData, ctxPrevData, granularity, activeEngine, globalDates, tableColFilter1, tableColFilter2, isDarkMode, getGrHTML]);

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
  // --- LOGIN VIEW ---
  if (currentView === 'login') {
    return (
      <div className="flex w-full h-screen font-sans overflow-hidden bg-white">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes checkmark { 0% { stroke-dashoffset: 100; opacity: 0; } 100% { stroke-dashoffset: 0; opacity: 1; } }
          @keyframes fluidMove1 { 0% { transform: translate(0px, 0px) scale(1); } 50% { transform: translate(80px, 60px) scale(1.15); } 100% { transform: translate(0px, 0px) scale(1); } }
          @keyframes fluidMove2 { 0% { transform: translate(0px, 0px) scale(1.1); } 50% { transform: translate(-70px, -50px) scale(0.95); } 100% { transform: translate(0px, 0px) scale(1.1); } }
          @keyframes fluidMove3 { 0% { transform: translate(0px, 0px) scale(1); } 50% { transform: translate(60px, -70px) scale(1.2); } 100% { transform: translate(0px, 0px) scale(1); } }
          .animate-enter { animation: slideUp 0.5s ease-out forwards; }
          .checkmark-path { stroke-dasharray: 100; stroke-dashoffset: 100; animation: checkmark 0.6s ease-in-out forwards; }
          .fluid-blob-1 { animation: fluidMove1 14s ease-in-out infinite; }
          .fluid-blob-2 { animation: fluidMove2 18s ease-in-out infinite; }
          .fluid-blob-3 { animation: fluidMove3 16s ease-in-out infinite; }
        `}} />
        
        <div className="hidden md:block w-[60%] h-full relative bg-[#090d16] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#12082b] via-[#210e4a] to-[#0a1f24]" />
          <div className="fluid-blob-1 absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full opacity-90 mix-blend-screen pointer-events-none" style={{ background: 'radial-gradient(circle, #8beb3a 0%, #43ca55 45%, transparent 70%)', filter: 'blur(75px)' }} />
          <div className="fluid-blob-2 absolute -bottom-32 -right-20 w-[600px] h-[600px] rounded-full opacity-95 mix-blend-screen pointer-events-none" style={{ background: 'radial-gradient(circle, #7a22cf 0%, #48118d 50%, transparent 75%)', filter: 'blur(80px)' }} />
          <div className="fluid-blob-3 absolute top-1/3 left-1/4 w-[480px] h-[480px] rounded-full opacity-70 mix-blend-screen pointer-events-none" style={{ background: 'radial-gradient(circle, #299e74 0%, #1f5068 55%, transparent 75%)', filter: 'blur(90px)' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30 pointer-events-none" />
        </div>

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
              <div className="w-full max-w-sm mx-auto animate-enter">
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
      <div className="welcome-screen fixed inset-0 z-[100] bg-[#090d16] flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-6xl w-full text-center">
          <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-black text-white mb-4 tracking-tight">Welcome to All in One Dashboard</h1>
          <p className="text-slate-400 mb-16 text-[clamp(1rem,1.5vw,1.25rem)] font-medium">Please select the tracker you wish to launch. You can navigate between them at any time.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <button onClick={() => selectHome()} className="bg-[#111827] p-8 rounded-3xl hover:bg-[#1e293b] transition-all group border border-indigo-500/20">
              <div className="w-14 h-14 mx-auto bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12h18M3 6h18M3 18h18"></path></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">General Overview</h2>
              <p className="text-xs text-slate-400">Cross-channel performance summary.</p>
            </button>

            <button onClick={() => selectEngine('media')} className="bg-[#111827] p-8 rounded-3xl hover:bg-[#1e293b] transition-all group">
              <div className="w-14 h-14 bg-indigo-500 text-white rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Digital Media</h2>
              <p className="text-xs text-slate-400">Full-funnel media metrics.</p>
            </button>

            <button onClick={() => selectEngine('commerce')} className="bg-[#111827] p-8 rounded-3xl hover:bg-[#1e293b] transition-all group">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Commerce Tracker</h2>
              <p className="text-xs text-slate-400">Revenue and ROAS metrics.</p>
            </button>

            <button onClick={() => selectEngine('creative')} className="bg-[#111827] p-8 rounded-3xl hover:bg-[#1e293b] transition-all group">
              <div className="w-14 h-14 bg-lime-500 text-white rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Top Creative</h2>
              <p className="text-xs text-slate-400">Winning creative assets.</p>
            </button>

            <button onClick={() => selectEngine('signal')} className="bg-[#111827] p-8 rounded-3xl hover:bg-[#1e293b] transition-all group border border-emerald-500/20">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Media Signal</h2>
              <p className="text-xs text-slate-400">TikTok Actual vs Plan.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-shell w-full min-h-screen flex font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#090d16] text-slate-100' : 'bg-[#e7e7ef] text-slate-800'}`}>
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        
        table { border-collapse: separate !important; border-spacing: 0 !important; }
        thead th { position: sticky !important; top: 0 !important; z-index: 30 !important; background-color: #090d16 !important; }
        thead th.sticky-col { position: sticky !important; top: 0 !important; left: 0px !important; z-index: 60 !important; background-color: #090d16 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid #1e293b !important; border-bottom: 2px solid #1e293b !important; }
        thead th.sticky-col-2 { position: sticky !important; top: 0 !important; left: 180px !important; z-index: 60 !important; background-color: #090d16 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid #1e293b !important; border-bottom: 2px solid #1e293b !important; }
        thead th.sticky-col-3 { position: sticky !important; top: 0 !important; left: 360px !important; z-index: 60 !important; background-color: #090d16 !important; width: 120px !important; min-width: 120px !important; max-width: 120px !important; border-right: 1px solid #1e293b !important; border-bottom: 2px solid #1e293b !important; box-shadow: 4px 0 10px -3px rgba(0,0,0,0.3) !important; }
        tbody td.sticky-col { position: sticky !important; left: 0px !important; z-index: 20 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'} !important; }
        tbody td.sticky-col-2 { position: sticky !important; left: 180px !important; z-index: 20 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'} !important; }
        tbody td.sticky-col-3 { position: sticky !important; left: 360px !important; z-index: 20 !important; width: 120px !important; min-width: 120px !important; max-width: 120px !important; border-right: 1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'} !important; box-shadow: 4px 0 10px -3px rgba(0,0,0,0.08) !important; }
        tr.group-start:not(:first-child) td { border-top: 2.5px solid ${isDarkMode ? '#64748b' : '#94a3b8'} !important; }
        tr.group-start td[rowspan] { border-bottom: 2.5px solid ${isDarkMode ? '#64748b' : '#94a3b8'} !important; }
        tr.group-end td { border-bottom: 2.5px solid ${isDarkMode ? '#64748b' : '#94a3b8'} !important; }

        .dashboard-shell .rounded-3xl { border-radius: 0.75rem !important; }
        .dashboard-shell .rounded-\[2rem\] { border-radius: 0.75rem !important; }
        
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .view-transition-container {
          animation: pageFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes chartAppearance {
          0% {
            opacity: 0;
            transform: scale(0.985) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .chart-appearance-animate {
          animation: chartAppearance 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .dropdown-arrow { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e"); background-position: right center; background-repeat: no-repeat; background-size: 1rem 1rem; }
        select option { background-color: #090d16; color: #f1f5f9; padding: 10px; }
      `}} />

      {isLoading && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h3 className="font-bold text-white text-sm tracking-wide">Fetching Data...</h3>
        </div>
      )}

      {/* COMPACT & EXPANDABLE SIDEBAR */}
      <aside className={`${isSidebarOpen ? 'w-[280px]' : 'w-[72px]'} bg-[#090d16] border-r border-slate-800/80 h-screen sticky top-0 overflow-y-auto overflow-x-hidden flex-shrink-0 transition-all duration-300 ease-in-out z-40 text-slate-300 flex flex-col`}>
{/* Top Header with integrated Hamburger icon */}
        <div className={`h-20 border-b border-slate-800/80 flex items-center bg-[#090d16] sticky top-0 z-20 transition-all ${isSidebarOpen ? 'px-5 justify-between' : 'justify-center px-0'}`}>
          {isSidebarOpen ? (
            <>
              <div className="flex flex-col justify-center overflow-hidden">
                <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">
                  PC Brands
                </h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  All in One Tracker
                </p>
              </div>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Collapse sidebar"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Expand sidebar"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Nav Workspaces */}
        <div className="pt-4 pb-4 px-2 space-y-1 border-b border-slate-800/80">
          {isSidebarOpen ? (
            <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 transition-opacity">Workspaces</p>
          ) : (
            <div className="w-8 h-[1px] bg-slate-800 mx-auto my-2" />
          )}

          <button
            onClick={() => selectHome()}
            title="General Overview"
            className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${
              currentView === 'home' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l9-9 9 9M5 10v10h14V10M9 20v-6h6v6"></path></svg>
            {isSidebarOpen && <span className="truncate">General Overview</span>}
          </button>

          <button
            onClick={() => selectEngine('media')}
            title="Digital Media"
            className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${
              activeEngine === 'media' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            {isSidebarOpen && <span className="truncate">Digital Media</span>}
          </button>

          <button
            onClick={() => selectEngine('commerce')}
            title="Commerce Tracker"
            className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${
              activeEngine === 'commerce' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            {isSidebarOpen && <span className="truncate">Commerce Tracker</span>}
          </button>

          <button
            onClick={() => selectEngine('creative')}
            title="Top Creative"
            className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${
              activeEngine === 'creative' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {isSidebarOpen && <span className="truncate">Top Creative</span>}
          </button>

          <button
            onClick={() => selectEngine('signal')}
            title="Media Signal"
            className={`w-full rounded-xl text-sm flex items-center font-semibold transition-all ${isSidebarOpen ? 'px-3.5 py-3 gap-3' : 'justify-center p-3'} ${
              activeEngine === 'signal' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-[#111827] text-slate-400'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            {isSidebarOpen && <span className="truncate">Media Signal</span>}
          </button>
        </div>

        {/* Global Filters & Context Controls */}
        {isSidebarOpen && (
          <div className="p-4 space-y-4 flex-1">
            <p className="px-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Filters</p>
            
            {/* Standard Date Picker */}
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

            {/* Home Filters */}
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
                          onClick={() => handleToggleHomeMonth(m)}
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

                <button onClick={() => loadHomeData(true)} className="w-full bg-[#1e293b] hover:bg-indigo-600 text-white font-bold py-2 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all text-xs">Sync Home Data</button>
              </div>
            )}

            {/* Signal Range Filter */}
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

            {/* Engine Subfilters */}
            {currentView !== 'home' && (
              <div className="space-y-3 px-1">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Brand</label>
                  <select value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)} className={selectClass}>
                    {getDependentOptions(CONFIG[activeEngine || 'media'].colBrand, 'brand').map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {activeEngine === 'media' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Funnel</label>
                    <select value={filters.funnel} onChange={(e) => handleFilterChange('funnel', e.target.value)} className={selectClass}>
                      {getDependentOptions(CONFIG.media.colFunnel, 'funnel').map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                {(activeEngine === 'commerce' || activeEngine === 'creative') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Ad Type</label>
                    <select value={filters.adType} onChange={(e) => handleFilterChange('adType', e.target.value)} className={selectClass}>
                      {getDependentOptions(CONFIG[activeEngine === 'commerce' ? 'commerce' : 'creative'].colAdType, 'adType').map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                {activeEngine === 'creative' && (
                  <>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1.5">Period</label><select value={filters.period} onChange={(e) => handleFilterChange('period', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colPeriod, 'period').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1.5">Platform</label><select value={filters.platform} onChange={(e) => handleFilterChange('platform', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colPlatform, 'platform').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1.5">Format</label><select value={filters.format} onChange={(e) => handleFilterChange('format', e.target.value)} className={selectClass}>{getDependentOptions(CONFIG.creative.colFormat, 'format').map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                  </>
                )}
                <button onClick={resetFilters} className="w-full border border-slate-600 text-slate-300 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white font-bold py-2 rounded-xl transition-all text-xs">Reset Filters</button>
              </div>
            )}
          </div>
        )}

        {isSidebarOpen && (
          <div className="p-4 bg-[#090d16] border-t border-slate-800/80 mt-auto">
            <button onClick={() => loadData(activeEngine as any, true)} className="w-full bg-[#1e293b] hover:bg-indigo-600 text-white font-bold py-3 rounded-xl border border-slate-700 hover:border-indigo-500 shadow-md transition-all flex justify-center items-center gap-2 text-xs tracking-wide">Sync Live Data</button>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 h-screen overflow-y-auto w-full transition-all duration-300 relative">
        {/* Title Header with direct alignment to the content below */}
        <div className="flex items-center justify-between mb-5 w-full">
          <div>
            <h1 className={`text-2xl lg:text-3xl font-black tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {currentView === 'home' ? 'General Overview' : activeEngine === 'signal' ? 'TikTok Media Signal Tracker' : activeEngine === 'media' ? 'Digital Media' : activeEngine === 'commerce' ? 'Commerce Tracker' : 'Top Creative'}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} className={`p-2.5 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isFullscreen ? 'M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6' : 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 15v3a2 2 0 0 0 2 2h3'}></path></svg>
            </button>

            {/* Single Dark Mode Icon Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`p-2.5 rounded-xl shadow-sm border transition-colors ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth="2" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic view container with full width */}
        <div key={currentView === 'home' ? 'home' : (activeEngine || 'dashboard')} className="view-transition-container w-full">
          {currentView === 'home' && homeSummary && (() => {
            const homeSurface = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
            const homeHeading = isDarkMode ? 'text-white' : 'text-slate-900';
            const homeMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

            const metricOptions = [
              { key: 'spend', label: 'Spend', color: '#6366f1', fmt: formatIDR },
              { key: 'commerceGmv', label: 'Commerce GMV', color: '#10b981', fmt: formatIDR },
              { key: 'impressions', label: 'Impressions', color: '#06b6d4', fmt: formatNum },
              { key: 'clicks', label: 'Clicks', color: '#84cc16', fmt: formatNum },
              { key: 'engagement', label: 'Engagement', color: '#f59e0b', fmt: formatNum },
              { key: 'orders', label: 'Orders', color: '#ec4899', fmt: formatNum },
            ];

            const activeMetricConfigs = metricOptions.filter(m => homeMomentumMetrics.includes(m.key));

            const growth = (current: number, previous: number) => {
              if (previous === 0 && current === 0) return '-';
              const rate = getGr(current, previous);
              return `${rate >= 0 ? '+' : ''}${formatPct(rate)}`;
            };

            const metricCard = (
              label: string,
              value: string,
              change: string,
              gradId: string,
              hexColor: string,
              chartData: { label: string; val: number }[],
              fmt: (val: number) => string
            ) => {
              const isPositive = change.startsWith('+');
              const isNeutral = change === '-';
              const badgeClass = isNeutral
                ? (isDarkMode ? 'text-slate-400' : 'text-slate-500')
                : isPositive
                ? 'text-emerald-500'
                : 'text-rose-500';

              return (
                <div className={`${homeSurface} border shadow-sm rounded-2xl flex flex-col justify-between overflow-hidden h-[180px] pt-5 pb-0 relative`}>
                  <div className="px-5 flex items-center justify-between mb-1 z-10">
                    <span className={`text-xs font-bold uppercase tracking-wider ${homeMuted}`}>{label}</span>
                    <span className={`text-xs font-black tracking-tight ${badgeClass}`}>
                      {change}
                    </span>
                  </div>

                  <div className="px-5 z-10 mb-2">
                    <strong className={`text-[clamp(1.35rem,1.8vw,1.85rem)] font-black ${homeHeading} tracking-tight block leading-tight`}>
                      {value}
                    </strong>
                  </div>

                  <div className="h-16 w-full mt-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={hexColor} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={hexColor} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" hide padding={{ left: 0, right: 0 }} />
                        <RechartsTooltip
                          isAnimationActive={false}
                          animationDuration={0}
                          wrapperStyle={{ zIndex: 50, outline: 'none' }}
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                            borderRadius: '0.5rem',
                            fontSize: '11px',
                            padding: '4px 8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          formatter={(v: any) => [fmt(Number(v)), label]}
                          labelStyle={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="val" 
                          stroke={hexColor} 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill={`url(#${gradId})`} 
                          isAnimationActive={false} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            };

            const mixBars = (items: { label: string; total: number }[], colors: string[]) => (
              <div className="space-y-3">{items.length === 0 ? <p className="text-sm text-slate-400">No data for this period.</p> : items.map((item, index) => (
                <div key={item.label} className="group relative cursor-pointer" title={`${item.label}: ${formatIDR(item.total)}`}>
                  <div className={`flex justify-between text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} mb-1`}>
                    <span className="truncate pr-3">{item.label}</span>
                    <span>{formatIDR(item.total)}</span>
                  </div>
                  <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'} overflow-hidden`}>
                    <div className={`h-full rounded-full ${colors[index % colors.length]}`} style={{ width: `${Math.max(3, (item.total / homeSummary.maxOf(items)) * 100)}%` }}></div>
                  </div>
                </div>
              ))}</div>
            );

            const renderStackBars = (trendData: { key: string; label: string; mix: { label: string; total: number }[] }[]) => {
              const stackColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-400', 'bg-cyan-400'];
              const max = Math.max(...trendData.map(item => item.mix.reduce((total, mix) => total + mix.total, 0)), 1);
              return (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                  <div className={`h-20 flex items-end gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} pb-0`}>
                    {trendData.map(item => {
                      const total = item.mix.reduce((sum, mix) => sum + mix.total, 0) || 1;
                      return (
                        <div key={item.key} className="flex-1 h-full flex items-end group relative cursor-pointer">
                          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col gap-1 p-2 rounded-lg text-[10px] font-bold shadow-xl z-30 pointer-events-none whitespace-nowrap border ${
                            isDarkMode ? 'bg-[#0f172a] text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200'
                          }`}>
                            <span className="text-slate-400 font-extrabold border-b border-slate-200 dark:border-slate-700 pb-0.5">{item.label}</span>
                            {item.mix.map(mix => (
                              <div key={mix.label} className="flex items-center justify-between gap-3">
                                <span>{mix.label}</span>
                                <span className="text-indigo-400 font-mono">{formatIDR(mix.total)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="w-full flex flex-col-reverse transition-all duration-300 ease-out" style={{ height: `${Math.max(6, (total / max) * 100)}%` }}>
                            {item.mix.map((mix, index) => (
                              <div key={mix.label} className={`w-full ${stackColors[index % stackColors.length]} first:rounded-b-sm last:rounded-t-sm`} style={{ height: `${(mix.total / total) * 100}%` }}></div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`flex justify-between pt-1.5 text-[9px] font-bold ${homeMuted}`}>
                    {trendData.map(item => <span key={item.key}>{item.label}</span>)}
                  </div>
                </div>
              );
            };

            const mixDonut = (items: { label: string; total: number }[], colors: string[], centerLabel: string) => {
              const total = items.reduce((sum, item) => sum + item.total, 0) || 1;
              let start = 0;
              const gradient = items.map((item, index) => {
                const end = start + (item.total / total) * 100;
                const slice = `${colors[index % colors.length]} ${start}% ${end}%`;
                start = end;
                return slice;
              }).join(', ');

              return (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shrink-0 relative flex items-center justify-center shadow-inner" style={{ background: `conic-gradient(${gradient || '#e2e8f0 0 100%'})` }}>
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${isDarkMode ? 'bg-[#090d16]' : 'bg-white'} flex items-center justify-center shadow`}>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${homeHeading}`}>{centerLabel}</span>
                    </div>
                  </div>
                  <div className="w-full min-w-0 overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <tbody>
                        {items.slice(0, 5).map((item, index) => (
                          <tr key={item.label} className="border-b border-transparent hover:bg-slate-500/5 transition-colors group relative cursor-pointer" title={`${item.label}: ${formatIDR(item.total)} (${formatPct(item.total / total)})`}>
                            <td className="py-1 pr-2 w-4">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: colors[index % colors.length] }}></span>
                            </td>
                            <td className={`py-1 pr-2 font-bold text-xs max-w-[110px] truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              {item.label}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-xs font-bold text-indigo-400">
                              {formatPct(item.total / total)}
                            </td>
                            <td className={`py-1 pl-2 text-right font-mono text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {formatIDR(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            };

            return (
              <div className="w-full space-y-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Performance snapshot</p>
                    <p className="text-sm text-slate-500 font-medium">{homeSummary.periodLabel} across paid media and commerce channels</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {metricCard('Media spend', formatIDR(homeSummary.currentTotalSpend), growth(homeSummary.currentTotalSpend, homeSummary.previousTotalSpend), 'gradSpend', '#6366f1', homeSummary.trend.map(item => ({ label: item.label, val: item.spend })), formatIDR)}
                  {metricCard('Impressions', formatNum(homeSummary.currentTotalImpressions), growth(homeSummary.currentTotalImpressions, homeSummary.previousTotalImpressions), 'gradImp', '#06b6d4', homeSummary.trend.map(item => ({ label: item.label, val: item.impressions })), formatNum)}
                  {metricCard('Commerce GMV', formatIDR(homeSummary.current.commerce.gmv), growth(homeSummary.current.commerce.gmv, homeSummary.previous.commerce.gmv), 'gradGmv', '#10b981', homeSummary.trend.map(item => ({ label: item.label, val: item.commerceGmv })), formatIDR)}
                  {metricCard('Engagement', formatNum(homeSummary.currentTotalEngagement), growth(homeSummary.currentTotalEngagement, homeSummary.previousTotalEngagement), 'gradEng', '#f59e0b', homeSummary.trend.map(item => ({ label: item.label, val: item.engagement })), formatNum)}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
                  <div className={`${homeSurface} border rounded-2xl p-5 shadow-sm xl:col-span-7 flex flex-col justify-between`}>
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                        <div>
                          <h2 className={`text-base font-black ${homeHeading}`}>Six-month momentum</h2>
                          <p className={`text-xs ${homeMuted} mt-0.5`}>Trend comparison across selected metrics</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsMomentumDropdownOpen(!isMomentumDropdownOpen)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'}`}
                            >
                              <span>Metrics ({homeMomentumMetrics.length}/2)</span>
                              <span className="text-[10px]">▼</span>
                            </button>

                            {isMomentumDropdownOpen && (
                              <div className={`absolute right-0 mt-2 w-52 rounded-xl shadow-xl border p-2 z-50 ${isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-slate-200'}`}>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-1">Select up to 2</p>
                                {metricOptions.map(m => {
                                  const isChecked = homeMomentumMetrics.includes(m.key);
                                  return (
                                    <button
                                      key={m.key}
                                      type="button"
                                      onClick={() => handleToggleMomentumMetric(m.key)}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${isChecked ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }}></span>
                                        <span>{m.label}</span>
                                      </div>
                                      {isChecked && <span>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                            {(['bar', 'line', 'area'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => setHomeMomentumType(type)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${homeMomentumType === type ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {homeMomentumType === 'bar' ? (
                            <BarChart data={homeSummary.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                              <XAxis dataKey="label" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="left" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                              {activeMetricConfigs.length > 1 && (
                                <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                              )}
                              <RechartsTooltip isAnimationActive={false} animationDuration={0} contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '0.75rem', fontSize: '12px' }} formatter={(v: any, name: any) => {
                                const cfg = activeMetricConfigs.find(m => m.label === name);
                                return [cfg ? cfg.fmt(Number(v)) : v, name];
                              }} />
                              {activeMetricConfigs.map((cfg, idx) => (
                                <Bar key={cfg.key} yAxisId={idx === 1 ? 'right' : 'left'} dataKey={cfg.key} name={cfg.label} fill={cfg.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
                              ))}
                            </BarChart>
                          ) : homeMomentumType === 'line' ? (
                            <LineChart data={homeSummary.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                              <XAxis dataKey="label" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="left" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                              {activeMetricConfigs.length > 1 && (
                                <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                              )}
                              <RechartsTooltip isAnimationActive={false} animationDuration={0} contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '0.75rem', fontSize: '12px' }} formatter={(v: any, name: any) => {
                                const cfg = activeMetricConfigs.find(m => m.label === name);
                                return [cfg ? cfg.fmt(Number(v)) : v, name];
                              }} />
                              {activeMetricConfigs.map((cfg, idx) => (
                                <Line key={cfg.key} yAxisId={idx === 1 ? 'right' : 'left'} type="monotone" dataKey={cfg.key} name={cfg.label} stroke={cfg.color} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                              ))}
                            </LineChart>
                          ) : (
                            <AreaChart data={homeSummary.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                {activeMetricConfigs.map(cfg => (
                                  <linearGradient key={cfg.key} id={`areaGrad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={cfg.color} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={cfg.color} stopOpacity={0.0} />
                                  </linearGradient>
                                ))}
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                              <XAxis dataKey="label" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="left" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                              {activeMetricConfigs.length > 1 && (
                                <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                              )}
                              <RechartsTooltip isAnimationActive={false} animationDuration={0} contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '0.75rem', fontSize: '12px' }} formatter={(v: any, name: any) => {
                                const cfg = activeMetricConfigs.find(m => m.label === name);
                                return [cfg ? cfg.fmt(Number(v)) : v, name];
                              }} />
                              {activeMetricConfigs.map((cfg, idx) => (
                                <Area key={cfg.key} yAxisId={idx === 1 ? 'right' : 'left'} type="monotone" dataKey={cfg.key} name={cfg.label} stroke={cfg.color} strokeWidth={2.5} fillOpacity={1} fill={`url(#areaGrad-${cfg.key})`} />
                              ))}
                            </AreaChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className={`flex flex-wrap gap-4 mt-3 text-[11px] font-bold ${homeMuted}`}>
                      {activeMetricConfigs.map(cfg => (
                        <span key={cfg.key} className="flex items-center gap-1.5">
                          <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }}></i>
                          {cfg.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={`${homeSurface} border rounded-2xl p-5 shadow-sm xl:col-span-5 flex flex-col justify-between`}>
                    <div>
                      <h2 className={`text-base font-black ${homeHeading} mb-1`}>Platform mix</h2>
                      <p className={`text-xs ${homeMuted} mb-4`}>Investment and commerce activity</p>
                      {mixDonut(homeSummary.platformMix, ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'], 'MIX')}
                    </div>
                    <div className="mt-auto">
                      {renderStackBars(homeSummary.platformTrend)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className={`${homeSurface} border rounded-2xl p-5 shadow-sm`}>
                    <h2 className={`text-base font-black ${homeHeading} mb-1`}>Funnel mix</h2>
                    <p className={`text-xs ${homeMuted} mb-3`}>Media spend by funnel stage</p>
                    {mixDonut(homeSummary.funnelMix, ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'], 'MIX')}
                    {renderStackBars(homeSummary.funnelTrend)}
                  </div>
                  <div className={`${homeSurface} border rounded-2xl p-5 shadow-sm`}>
                    <h2 className={`text-base font-black ${homeHeading} mb-1`}>Format mix</h2>
                    <p className={`text-xs ${homeMuted} mb-4`}>Creative investment by format</p>
                    {mixBars(homeSummary.formatMix, ['bg-violet-500','bg-blue-500','bg-teal-500','bg-orange-400'])}
                  </div>
                  <div className={`${homeSurface} border rounded-2xl p-5 shadow-sm`}>
                    <h2 className={`text-base font-black ${homeHeading} mb-1`}>Channel health</h2>
                    <p className={`text-xs ${homeMuted} mb-4`}>Core media efficiency metrics</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`${isDarkMode ? 'bg-[#090d16]' : 'bg-slate-50'} rounded-xl p-3`}>
                        <span className={`text-[10px] font-bold ${homeMuted}`}>CTR</span>
                        <strong className={`block text-lg ${homeHeading} mt-1`}>{formatPct(homeSummary.current.media.ctr)}</strong>
                      </div>
                      <div className={`${isDarkMode ? 'bg-[#090d16]' : 'bg-slate-50'} rounded-xl p-3`}>
                        <span className={`text-[10px] font-bold ${homeMuted}`}>VTR</span>
                        <strong className={`block text-lg ${homeHeading} mt-1`}>{formatPct(homeSummary.current.media.vtr)}</strong>
                      </div>
                      <div className={`${isDarkMode ? 'bg-[#090d16]' : 'bg-slate-50'} rounded-xl p-3`}>
                        <span className={`text-[10px] font-bold ${homeMuted}`}>ROAS</span>
                        <strong className={`block text-lg ${homeHeading} mt-1`}>{homeSummary.current.commerce.roas.toFixed(2)}x</strong>
                      </div>
                      <div className={`${isDarkMode ? 'bg-[#090d16]' : 'bg-slate-50'} rounded-xl p-3`}>
                        <span className={`text-[10px] font-bold ${homeMuted}`}>Clicks</span>
                        <strong className={`block text-lg ${homeHeading} mt-1`}>{formatNum(homeSummary.current.media.clicks)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* --- VIEW 1: DIGITAL MEDIA --- */}
          {activeEngine === 'media' && (
            <div className="w-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 mb-6">
                <div onClick={() => setDashboardContext('Overall')} className={`bg-indigo-600 rounded-3xl p-5 lg:p-6 shadow-lg transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'Overall' ? 'ring-4 ring-indigo-300 shadow-indigo-600/40' : ''}`}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest">Overall Media</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg></div></div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Spend</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(mediaKPIs.overall.spend)}</span>{renderGR(mediaKPIs.overall.spend, mediaKPIs.overall.pSpend, false)}</div></div>
                       <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Impr</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.overall.impr)}</span>{renderGR(mediaKPIs.overall.impr, mediaKPIs.overall.pImpr, false)}</div></div>
                       <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-indigo-200">Engage</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.overall.engage)}</span>{renderGR(mediaKPIs.overall.engage, mediaKPIs.overall.pEngage, false)}</div></div>
                    </div>
                 </div>
                 <div onClick={() => setDashboardContext('Meta')} className={`bg-blue-500 rounded-3xl p-5 lg:p-6 shadow-lg transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'Meta' ? 'ring-4 ring-blue-300 shadow-blue-500/40' : ''}`}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-blue-100 uppercase tracking-widest">Meta</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></div></div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-blue-400 pb-3"><span className="text-xs font-bold text-blue-100">Spend</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(mediaKPIs.meta.spend)}</span>{renderGR(mediaKPIs.meta.spend, mediaKPIs.meta.pSpend, false)}</div></div>
                       <div className="flex justify-between items-end border-b border-blue-400 pb-3"><span className="text-xs font-bold text-blue-100">Impr</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.meta.impr)}</span>{renderGR(mediaKPIs.meta.impr, mediaKPIs.meta.pImpr, false)}</div></div>
                       <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-blue-100">Engage</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.meta.engage)}</span>{renderGR(mediaKPIs.meta.engage, mediaKPIs.meta.pEngage, false)}</div></div>
                    </div>
                 </div>
                 <div onClick={() => setDashboardContext('TikTok')} className={`bg-slate-800 rounded-3xl p-5 lg:p-6 shadow-lg transition-all cursor-pointer hover:-translate-y-1 ${dashboardContext === 'TikTok' ? 'ring-4 ring-slate-400 shadow-slate-900/40' : ''}`}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">TikTok</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Spend</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(mediaKPIs.tiktok.spend)}</span>{renderGR(mediaKPIs.tiktok.spend, mediaKPIs.tiktok.pSpend, false)}</div></div>
                       <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Impr</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.tiktok.impr)}</span>{renderGR(mediaKPIs.tiktok.impr, mediaKPIs.tiktok.pImpr, false)}</div></div>
                       <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-slate-400">Engage</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatNum(mediaKPIs.tiktok.engage)}</span>{renderGR(mediaKPIs.tiktok.engage, mediaKPIs.tiktok.pEngage, false)}</div></div>
                    </div>
                 </div>
              </div>
              
              <div className={`p-5 sm:p-6 lg:p-7 rounded-3xl border shadow-sm mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-7 gap-4">
                   <div>
                      <h2 className="text-[clamp(1.1rem,1.8vw,1.5rem)] font-black tracking-tight" id="chartTitleMedia">{dashboardContext} Historical Trend</h2>
                      <p className={`text-sm font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                         {granularity === 'monthly' ? 'Displaying data for the past 3 months' : granularity === 'weekly' ? 'MTD Comparison Analytics' : 'Interactive Multi-Metric Analytics'}
                      </p>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-3">
                     <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                       {(['combo', 'bar', 'line'] as const).map(t => (
                         <button
                           key={t}
                           onClick={() => setChartTypeEngine(t)}
                           className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${chartTypeEngine === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                         >
                           {t}
                         </button>
                       ))}
                     </div>

                     <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-2xl border w-full xl:w-auto shadow-inner ${isDarkMode ? 'bg-[#090d16] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
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
                 </div>

                 <div
                   key={`chart-media-${dashboardContext}-${chartTypeEngine}-${chartMetricsMedia.join('-')}`}
                   className="w-full h-[380px] chart-appearance-animate"
                 >
                   <canvas ref={chartRef}></canvas>
                 </div>
              </div>

              {/* Platform Summary Table */}
              <div className={`rounded-3xl border shadow-sm overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`p-5 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
                  <div>
                    <h2 className={`font-black uppercase tracking-wider text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Platform Summary Rollup</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Core performance across platforms (Spend, Impression, CPM, CTR, VTR)</p>
                  </div>
                </div>
                <div className="overflow-auto max-h-[400px] relative w-full">
                  <Table className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>
                    <TableHeader>
                      {granularity === 'monthly' && (
                        <TableRow className="border-b border-slate-700 bg-[#090d16]">
                          <TableHead className="sticky-col text-slate-100 bg-[#090d16]">Platform</TableHead>
                          <TableHead className="sticky-col-2 text-slate-100 bg-[#090d16]">Metric</TableHead>
                          <TableHead className="text-right text-white bg-[#090d16] sticky top-0 border-b border-slate-700">This Month</TableHead>
                          <TableHead className="text-right text-slate-400 bg-[#090d16] sticky top-0 border-b border-slate-700">Prev Month</TableHead>
                          <TableHead className="text-right text-white bg-[#090d16] sticky top-0 border-b border-slate-700">GR%</TableHead>
                        </TableRow>
                      )}

                      {granularity === 'weekly' && (() => {
                        let weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
                        let weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));
                        return (
                          <TableRow className="border-b border-slate-700 bg-[#090d16]">
                            <TableHead className="sticky-col text-slate-100 bg-[#090d16]">Platform</TableHead>
                            <TableHead className="sticky-col-2 text-slate-100 bg-[#090d16]">Metric</TableHead>
                            {weeks.map(w => {
                              const weekNum = parseInt(w.replace('W', ''));
                              let curD = new Date(globalDates.curStart); curD.setDate(curD.getDate() + (weekNum * 7) - 1); if (curD > globalDates.curMtdEnd) curD = new Date(globalDates.curMtdEnd);
                              let prevD = new Date(globalDates.prevStart); prevD.setDate(prevD.getDate() + (weekNum * 7) - 1); if (prevD > globalDates.prevMtdEnd) prevD = new Date(globalDates.prevMtdEnd);
                              const fmtStr = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
                              return (
                                <React.Fragment key={w}>
                                  <TableHead className="text-right bg-[#090d16] border-l border-slate-700 text-white sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD {fmtStr(curD)}</TableHead>
                                  <TableHead className="text-right text-slate-400 bg-[#090d16] sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD {fmtStr(prevD)}</TableHead>
                                  <TableHead className="text-right bg-[#090d16] text-white sticky top-0 border-b border-slate-700 whitespace-nowrap">GR%</TableHead>
                                </React.Fragment>
                              );
                            })}
                            <TableHead className="text-right border-l border-indigo-500 text-indigo-300 bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD Total Cur</TableHead>
                            <TableHead className="text-right text-slate-400 bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">MTD Total Prev</TableHead>
                            <TableHead className="text-right text-indigo-300 bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">Total GR%</TableHead>
                          </TableRow>
                        );
                      })()}

                      {granularity === 'daily' && (() => {
                        let daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); let days = Array.from(daysFound).sort();
                        return (
                          <TableRow className="border-b border-slate-700 bg-[#090d16]">
                            <TableHead className="sticky-col text-slate-100 bg-[#090d16]">Platform</TableHead>
                            <TableHead className="sticky-col-2 text-slate-100 bg-[#090d16]">Metric</TableHead>
                            {days.map(d => {
                              const parts = d.split('-'); const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
                              return (
                                <TableHead key={d} className="text-right text-white bg-[#090d16] sticky top-0 border-b border-slate-700 whitespace-nowrap">
                                  {dt.getDate()} {dt.toLocaleString('en-GB', { month: 'short' })}
                                </TableHead>
                              );
                            })}
                            <TableHead className="text-right text-indigo-300 border-l border-slate-700 bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">Period Total</TableHead>
                          </TableRow>
                        );
                      })()}
                    </TableHeader>
                    <TableBody dangerouslySetInnerHTML={{ __html: generatePlatformSummaryBodyHTML() }} />
                  </Table>
                </div>
              </div>

              {/* Full Table */}
              <div className={`rounded-3xl border shadow-sm overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`p-5 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
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
                 <div className="overflow-auto max-h-[850px] relative w-full rounded-b-3xl">
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
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 mb-6">
                <div onClick={() => setDashboardContext('Overall')} className={`bg-indigo-600 rounded-3xl p-5 lg:p-6 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'Overall' ? 'ring-4 ring-indigo-300 shadow-indigo-600/40' : ''}`}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest">Overall Commerce</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg></div></div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.overall.exp)}</span>{renderGR(commerceKPIs.overall.exp, commerceKPIs.overall.pExp, false)}</div></div>
                       <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.overall.gmv)}</span>{renderGR(commerceKPIs.overall.gmv, commerceKPIs.overall.pGmv, false)}</div></div>
                       <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-indigo-200">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-300 leading-none">{commerceKPIs.overall.roas}</span>{renderGR(commerceKPIs.overall.roasNum, commerceKPIs.overall.pRoasNum, false)}</div></div>
                    </div>
                 </div>
                 <div onClick={() => setDashboardContext('TikTok')} className={`bg-slate-800 rounded-3xl p-5 lg:p-6 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'TikTok' ? 'ring-4 ring-slate-400 shadow-slate-900/40' : ''}`}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">TikTok Shop</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.tiktok.exp)}</span>{renderGR(commerceKPIs.tiktok.exp, commerceKPIs.tiktok.pExp, false)}</div></div>
                       <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.tiktok.gmv)}</span>{renderGR(commerceKPIs.tiktok.gmv, commerceKPIs.tiktok.pGmv, false)}</div></div>
                       <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-slate-400">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-400 leading-none">{commerceKPIs.tiktok.roas}</span>{renderGR(commerceKPIs.tiktok.roasNum, commerceKPIs.tiktok.pRoasNum, false)}</div></div>
                    </div>
                 </div>
                 <div onClick={() => setDashboardContext('Shopee')} className={`bg-orange-500 rounded-3xl p-5 lg:p-6 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'Shopee' ? 'ring-4 ring-orange-300 shadow-orange-500/40' : ''}`}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-orange-100 uppercase tracking-widest">Shopee</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" viewBox="0 0 109.59 122.88" fill="currentColor"><path d="M74.98,91.98C76.15,82.36,69.96,76.22,53.6,71c-7.92-2.7-11.66-6.24-11.57-11.12 c0.33-5.4,5.36-9.34,12.04-9.47c4.63,0.09,9.77,1.22,14.76,4.56c0.59,0.37,1.01,0.32,1.35-0.2c0.46-0.74,1.61-2.53,2-3.17 c0.26-0.42,0.31-0.96-0.35-1.44c-0.95-0.7-3.6-2.13-5.03-2.72c-3.88-1.62-8.23-2.64-12.86-2.63c-9.77,0.04-17.47,6.22-18.12,14.47 c-0.42,5.95,2.53,10.79,8.86,14.47c1.34,0.78,8.6,3.67,11.49,4.57c9.08,2.83,13.8,7.9,12.69,13.81c-1.01,5.36-6.65,8.83-14.43,8.93 c-6.17-0.24-11.71-2.75-16.02-6.1c-0.11-0.08-0.65-0.5-0.72-0.56c-0.53-0.42-1.11-0.39-1.47,0.15c-0.26,0.4-1.92,2.8-2.34,3.43 c-0.39,0.55-0.18,0.86,0.23,1.2c1.8,1.5,4.18,3.14,5.81,3.97c4.47,2.28,9.32,3.53,14.48,3.72c3.32,0.22,7.5-0.49,10.63-1.81 C70.63,102.67,74.25,97.92,74.98,91.98L74.98,91.98z M54.79,7.18c-10.59,0-19.22,9.98-19.62,22.47h39.25 C74.01,17.16,65.38,7.18,54.79,7.18L54.79,7.18z M94.99,122.88l-0.41,0l-80.82-0.01h0c-5.5-0.21-9.54-4.66-10.09-10.19l-0.05-1 l-3.61-79.5v0C0,32.12,0,32.06,0,32c0-1.28,1.03-2.33,2.3-2.35l0,0h25.48C28.41,13.15,40.26,0,54.79,0s26.39,13.15,27.01,29.65 h25.4h0.04c1.3,0,2.35,1.05,2.35,2.35c0,0.04,0,0.08,0,0.12v0l-3.96,79.81l-0.04,0.68C105.12,118.21,100.59,122.73,94.99,122.88 L94.99,122.88z"/></svg></div></div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-orange-400 pb-3"><span className="text-xs font-bold text-orange-100">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.shopee.exp)}</span>{renderGR(commerceKPIs.shopee.exp, commerceKPIs.shopee.pExp, false)}</div></div>
                       <div className="flex justify-between items-end border-b border-orange-400 pb-3"><span className="text-xs font-bold text-orange-100">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.shopee.gmv)}</span>{renderGR(commerceKPIs.shopee.gmv, commerceKPIs.shopee.pGmv, false)}</div></div>
                       <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-orange-100">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-200 leading-none">{commerceKPIs.shopee.roas}</span>{renderGR(commerceKPIs.shopee.roasNum, commerceKPIs.shopee.pRoasNum, false)}</div></div>
                    </div>
                 </div>
              </div>
              
              <div className={`p-5 sm:p-6 lg:p-7 rounded-3xl border shadow-sm mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-7 gap-4">
                   <div>
                      <h2 className="text-[clamp(1.1rem,1.8vw,1.5rem)] font-black tracking-tight" id="chartTitleCommerce">{dashboardContext} Historical Trend</h2>
                      <p className={`text-sm font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                         {granularity === 'monthly' ? 'Displaying data for the past 3 months' : granularity === 'weekly' ? 'MTD Comparison Analytics' : 'Interactive Multi-Metric Analytics'}
                      </p>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-3">
                     <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                       {(['combo', 'bar', 'line'] as const).map(t => (
                         <button
                           key={t}
                           onClick={() => setChartTypeEngine(t)}
                           className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${chartTypeEngine === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                         >
                           {t}
                         </button>
                       ))}
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
                 </div>

                 <div
                   key={`chart-comm-${dashboardContext}-${chartTypeEngine}-${chartMetricsComm.join('-')}`}
                   className="w-full h-[380px] chart-appearance-animate"
                 >
                   <canvas ref={chartRef}></canvas>
                 </div>
              </div>

              {/* Full Table */}
              <div className={`rounded-3xl border shadow-sm overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`p-5 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
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
                 <div className="overflow-auto max-h-[850px] relative w-full rounded-b-3xl">
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
            <div className="w-full">
              <div className="space-y-4">
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
                         <div className="w-full xl:w-3/12 border-b xl:border-b-0 xl:border-r border-slate-200 relative bg-[#090d16]">
                           {iframeSrc ? (
                             <iframe src={iframeSrc} className="w-full h-full min-h-[280px]" frameBorder="0" allowFullScreen></iframe>
                           ) : (
                             <div className="w-full h-full min-h-[280px] flex items-center justify-center text-xs text-slate-500 font-medium">No Preview Available</div>
                           )}
                         </div>
                         
                         <div className="w-full xl:w-9/12 p-5 md:p-6 flex flex-col">
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

                           <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Spend</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatIDR(parseNum(row['Spend']))}</p></div>
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Impressions</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatNum(parseNum(row['Impressions']))}</p></div>
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CTR</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['CTR'] || '-'}</p></div>
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CPM</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formatIDR(parseNum(row['CPM']))}</p></div>
                              
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VTR (6s)</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['VTR (6s)'] || '-'}</p></div>
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VTR (15s)</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['VTR (15s)'] || '-'}</p></div>
                              <div><p className={`font-bold mb-1.5 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CPCo</p><p className={`font-mono font-bold text-[clamp(14px,1vw,16px)] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{row['CPCo (Cost/Result)'] || '-'}</p></div>
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
                              <div className={`p-3 rounded-2xl text-sm leading-relaxed border font-medium ${isDarkMode ? 'bg-indigo-950/40 text-indigo-200 border-indigo-900/50' : 'bg-indigo-50/60 text-indigo-900 border-indigo-100'}`}>
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

          {/* --- VIEW 4: MEDIA SIGNAL TRACKER --- */}
          {activeEngine === 'signal' && signalCompiled && (
            <div className="w-full space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-indigo-600 p-5 rounded-3xl text-white shadow-lg">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Total Ad Spend</p>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-black">{formatIDR(signalCompiled.actual?.totalSpend || 0)}</h3>
                    {signalCompiled.prev && renderGR(signalCompiled.actual?.totalSpend || 0, signalCompiled.prev.totalSpend, false)}
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
                    {signalCompiled.prev && renderGR(signalCompiled.actual?.impressions || 0, signalCompiled.prev.impressions, false)}
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
                    {signalCompiled.prev && renderGR(signalCompiled.actual?.engagements || 0, signalCompiled.prev.engagements, false)}
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
                    {signalCompiled.prev && renderGR(signalCompiled.actual?.gmvAds || 0, signalCompiled.prev.gmvAds, false)}
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

              {/* PROGRESS & ACHIEVEMENT HIERARCHY TABLE */}
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
                          {group.rows.map((row, rIdx) => {
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
                                  {signalCompiled.prevPeriod ? renderGR(actVal, prvVal, row.isInv) : '-'}
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
          )}
        </div>

      </main>
    </div>
  );
}