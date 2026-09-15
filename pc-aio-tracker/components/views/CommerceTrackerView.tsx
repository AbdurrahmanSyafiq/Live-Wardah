import React, { useRef, useEffect, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { Table, TableHeader, TableRow, TableHead, TableBody } from '@/components/tables/PlatformTable';
import { formatIDR, formatNum, formatPct, renderGR, parseNum, getGrHTML } from '@/lib/formatters';
import { CONFIG } from '@/lib/config';

interface CommerceTrackerViewProps {
  commerceKPIs: any;
  dashboardContext: string;
  setDashboardContext: (c: string) => void;
  granularity: string;
  isDarkMode: boolean;
  chartTypeEngine: 'combo' | 'bar' | 'line';
  setChartTypeEngine: (t: 'combo' | 'bar' | 'line') => void;
  chartMetricsComm: string[];
  handleToggleMetric: (engine: 'media' | 'commerce', value: string) => void;
  ctxCurData: any[];
  ctxPrevData: any[];
  ctxChartData: any[];
  globalDates: any;
  tableColFilter1: string;
  setTableColFilter1: (v: string) => void;
  tableColFilter2: string;
  setTableColFilter2: (v: string) => void;
}

export default function CommerceTrackerView({
  commerceKPIs,
  dashboardContext,
  setDashboardContext,
  granularity,
  isDarkMode,
  chartTypeEngine,
  setChartTypeEngine,
  chartMetricsComm,
  handleToggleMetric,
  ctxCurData,
  ctxPrevData,
  ctxChartData,
  globalDates,
  tableColFilter1,
  setTableColFilter1,
  tableColFilter2,
  setTableColFilter2
}: CommerceTrackerViewProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const groupedData: Record<string, any> = {};

    if (granularity === 'weekly' && globalDates) {
      const weeksFound = new Set<string>();
      ctxCurData.forEach(r => { if (r.bucket && r.bucket.startsWith('W')) weeksFound.add(r.bucket); });
      ctxPrevData.forEach(r => { if (r.bucket && r.bucket.startsWith('W')) weeksFound.add(r.bucket); });
      const weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));

      const appendMtdSeries = (data: any[], periodStart: Date, periodEnd: Date) => {
        const running = { exp: 0, gmv: 0, orders: 0 };
        weeks.forEach(w => {
          const weekNum = parseInt(w.replace('W', ''));
          const periodDate = new Date(periodStart);
          periodDate.setDate(periodDate.getDate() + (weekNum * 7) - 1);
          if (periodDate > periodEnd) periodDate.setTime(periodEnd.getTime());

          data.filter(r => r.bucket === w).forEach(row => {
            running.exp += parseNum(row['Expense']);
            running.gmv += parseNum(row['GMV']);
            running.orders += parseNum(row['Items Sold'] || row['Item sold'] || row['items_sold'] || row['Orders']);
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

        if (!groupedData[label]) groupedData[label] = { exp: 0, gmv: 0, orders: 0 };
        groupedData[label].exp += parseNum(row['Expense']);
        groupedData[label].gmv += parseNum(row['GMV']); 
        groupedData[label].orders += parseNum(row['Items Sold'] || row['Item sold'] || row['items_sold'] || row['Orders']);
      });
    }

    const labels = Object.keys(groupedData);
    if (labels.length === 0) return;
    const datasets: any[] = [];
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

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

    chartInstance.current = new Chart(ctx, {
      type: chartTypeEngine === 'line' ? 'line' : 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeInOutQuart' },
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
          tooltip: { animation: { duration: 0 } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' } },
          y: { type: 'linear', display: true, position: 'left', grid: { color: isDarkMode ? '#334155' : '#e2e8f0' }, border: { dash: [4, 4] }, ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' } },
          y1: { type: 'linear', display: datasets.length > 1, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' } }
        }
      }
    });

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [ctxChartData, ctxCurData, ctxPrevData, globalDates, chartMetricsComm, granularity, isDarkMode, chartTypeEngine]);

  const generateCommercePlatformSummaryBodyHTML = useCallback(() => {
    const filterPlatform = (rows: any[], plat: 'Overall' | 'TikTok' | 'Shopee') => {
      if (plat === 'Overall') return rows;
      return rows.filter(r => {
        const p = String(r[CONFIG.commerce.colPlatform] || '').toLowerCase();
        if (plat === 'TikTok') return p.includes('tiktok');
        return p.includes('shopee');
      });
    };

    const calcSum = (rows: any[]) => {
      let exp = 0, gmv = 0, orders = 0;
      rows.forEach(r => {
        exp += parseNum(r['Expense']);
        gmv += parseNum(r['GMV']);
        orders += parseNum(r['Items Sold'] || r['Item sold'] || r['items_sold'] || r['Orders']);
      });
      return {
        exp,
        orders,
        gmv,
        cpa: orders > 0 ? exp / orders : 0,
        roas: exp > 0 ? gmv / exp : 0
      };
    };

    const platforms: ('Overall' | 'TikTok' | 'Shopee')[] = ['Overall', 'TikTok', 'Shopee'];
    const metricNames = [
      { name: 'Expense', key: 'exp', fmt: formatIDR, isInv: false },
      { name: 'Orders', key: 'orders', fmt: formatNum, isInv: false },
      { name: 'GMV', key: 'gmv', fmt: formatIDR, isInv: false },
      { name: 'CPA', key: 'cpa', fmt: formatIDR, isInv: true },
      { name: 'ROAS', key: 'roas', fmt: (v: number) => (v || 0).toFixed(2) + 'x', isInv: false }
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
          tbody += getGrHTML(curV, prevV, m.isInv, isDarkMode);
          tbody += `</tr>`;
        });
      });
    } else if (granularity === 'weekly' && globalDates) {
      const weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
      const weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));

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
                      ${getGrHTML(wc, wp, m.isInv, isDarkMode)}`;
          });

          const curTotVal = (curTotal as any)[m.key];
          const prevTotVal = (prevTotal as any)[m.key];
          tbody += `<td class="px-4 py-3 text-right font-mono border-l ${isDarkMode ? 'border-indigo-500 text-indigo-300 bg-indigo-950/50' : 'border-slate-200 text-indigo-700 bg-indigo-50/50'} font-bold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(curTotVal)}</td>
                    <td class="px-4 py-3 text-right font-mono font-medium text-slate-500 ${isDarkMode ? 'bg-indigo-950/50' : 'bg-indigo-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${m.fmt(prevTotVal)}</td>
                    ${getGrHTML(curTotVal, prevTotVal, m.isInv, isDarkMode)}</tr>`;
        });
      });
    } else if (granularity === 'daily') {
      const daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); const days = Array.from(daysFound).sort();

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
  }, [ctxCurData, ctxPrevData, granularity, globalDates, isDarkMode]);

  const generateTableHTML = useCallback(() => {
    const cnf = CONFIG.commerce;
    const getBaseMetrics = () => ({ exp:0, imp:0, clicks:0, orders:0, gmv:0, liveViews:0 });

    const sumMetricsData = (target: any, row: any) => {
      target.exp += parseNum(row["Expense"]);
      target.imp += parseNum(row["Impression"]);
      target.clicks += parseNum(row["Clicks"]);
      target.orders += parseNum(row["Items Sold"] || row["Item sold"] || row["items_sold"] || row["Orders"]);
      target.gmv += parseNum(row["GMV"]);
      target.liveViews += parseNum(row["Live Views"]);
    };

    const getDisplayMetricsArray = (g: any, adTypeLower: string) => {
      const m = [
        { name: "Expense", raw: g.exp, fmt: formatIDR(g.exp), isInv: false },
        { name: "Orders", raw: g.orders, fmt: formatNum(g.orders), isInv: false },
        { name: "GMV", raw: g.gmv, fmt: formatIDR(g.gmv), isInv: false },
        { name: "CPA", raw: g.orders>0?(g.exp/g.orders):0, fmt: formatIDR(g.orders>0?(g.exp/g.orders):0), isInv: true },
        { name: "ROAS", raw: g.exp>0?(g.gmv/g.exp):0, fmt: (g.exp>0?(g.gmv/g.exp):0).toFixed(2)+"x", isInv: false }
      ];
      if (adTypeLower.includes('live official') || adTypeLower.includes('live affiliate')) {
        m.splice(1, 0, { name: "Live Views", raw: g.liveViews, fmt: formatNum(g.liveViews), isInv: false });
      }
      return m;
    };

    const dim1Set = new Set<string>();
    const dim2Set = new Set<string>();
    ctxCurData.forEach(r => {
      dim1Set.add(String(r[cnf.colPlatform]));
      dim2Set.add(String(r[cnf.colAdType]));
    });

    const filterRow = (k1: string, k2: string) => {
      if (tableColFilter1 !== 'All' && k1 !== tableColFilter1) return false;
      if (tableColFilter2 !== 'All' && k2 !== tableColFilter2) return false;
      return true;
    };

    let thead = '';
    let tbody = '';
    const thClass = `px-4 py-4 font-bold text-slate-100 bg-[#0f172a]`;

    if (granularity === 'monthly') {
      thead = `<tr>
        <th class="sticky-col ${thClass}">Platform</th>
        <th class="sticky-col-2 ${thClass}">Ad Type</th>
        <th class="sticky-col-3 ${thClass}">Metric</th>
        <th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 border-b border-slate-700">This Month</th>
        <th class="px-4 py-4 text-right font-bold text-slate-400 bg-[#0f172a] sticky top-0 border-b border-slate-700">Prev Month</th>
        <th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 border-b border-slate-700">GR%</th>
      </tr>`;

      const grouped: any = {};
      const process = (data: any[], keyName: string) => {
        data.forEach(r => {
          const k1 = String(r[cnf.colPlatform]);
          const k2 = String(r[cnf.colAdType]);
          if (!filterRow(k1, k2)) return;
          const k = k1 + '_|_' + k2;
          if (!grouped[k]) grouped[k] = { cur: getBaseMetrics(), prev: getBaseMetrics(), dim1: k1, dim2: k2 };
          sumMetricsData(grouped[k][keyName], r);
        });
      };
      process(ctxCurData, 'cur');
      process(ctxPrevData, 'prev');

      Object.values(grouped).forEach((g: any) => {
        const adTypeStr = String(g.dim2).toLowerCase();
        const mCur = getDisplayMetricsArray(g.cur, adTypeStr);
        const mPrev = getDisplayMetricsArray(g.prev, adTypeStr);
        mCur.forEach((mc, i) => {
          const mp = mPrev[i];
          let rowCls = i % 2 === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50');
          if (i === 0) rowCls += ' group-start';
          if (i === mCur.length - 1) rowCls += ' group-end';

          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if (i === 0) {
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${mCur.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.name}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.fmt}</td>`;
          tbody += `<td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mp.fmt}</td>`;
          tbody += getGrHTML(mc.raw, mp.raw, mc.isInv, isDarkMode);
          tbody += '</tr>';
        });
      });
    } else if (granularity === 'weekly' && globalDates) {
      const weeksFound = new Set<string>();
      ctxCurData.forEach(r => weeksFound.add(r.bucket));
      ctxPrevData.forEach(r => weeksFound.add(r.bucket));
      const weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));

      thead = `<tr>
        <th class="sticky-col ${thClass}">Platform</th>
        <th class="sticky-col-2 ${thClass}">Ad Type</th>
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
          const k1 = String(r[cnf.colPlatform]);
          const k2 = String(r[cnf.colAdType]);
          if (!filterRow(k1, k2)) return;
          const k = k1 + '_|_' + k2;
          if (!grouped[k]) {
            grouped[k] = { curTotal: getBaseMetrics(), prevTotal: getBaseMetrics(), weeks: {}, dim1: k1, dim2: k2 };
            weeks.forEach(w => grouped[k].weeks[w] = { cur: getBaseMetrics(), prev: getBaseMetrics() });
          }
          sumMetricsData(grouped[k][keyName + "Total"], r);
          if (grouped[k].weeks[r.bucket]) sumMetricsData(grouped[k].weeks[r.bucket][keyName], r);
        });
      };
      process(ctxCurData, 'cur');
      process(ctxPrevData, 'prev');

      Object.values(grouped).forEach((g: any) => {
        const adTypeStr = String(g.dim2).toLowerCase();
        const curTotM = getDisplayMetricsArray(g.curTotal, adTypeStr);
        const prevTotM = getDisplayMetricsArray(g.prevTotal, adTypeStr);
        const weekM: any = {};
        let curCumul = getBaseMetrics();
        let prevCumul = getBaseMetrics();

        weeks.forEach(w => {
          Object.keys(curCumul).forEach(k => curCumul[k as keyof typeof curCumul] += g.weeks[w].cur[k]);
          Object.keys(prevCumul).forEach(k => prevCumul[k as keyof typeof prevCumul] += g.weeks[w].prev[k]);
          weekM[w] = { cur: getDisplayMetricsArray(curCumul, adTypeStr), prev: getDisplayMetricsArray(prevCumul, adTypeStr) };
        });

        curTotM.forEach((mc, i) => {
          let rowCls = i % 2 === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50');
          if (i === 0) rowCls += ' group-start';
          if (i === curTotM.length - 1) rowCls += ' group-end';
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if (i === 0) {
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col font-bold ${isDarkMode ? 'text-slate-200 bg-slate-800' : 'text-slate-900 bg-white'} align-top whitespace-normal break-words">${g.dim1}</td>`;
            tbody += `<td rowspan="${curTotM.length}" class="px-4 py-3 sticky-col-2 font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-white'} align-top whitespace-normal break-words">${g.dim2}</td>`;
          }
          tbody += `<td class="px-4 py-3 sticky-col-3 ${isDarkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-white'} font-medium tracking-wide border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.name}</td>`;
          weeks.forEach(w => {
            const wc = weekM[w].cur[i], wp = weekM[w].prev[i];
            tbody += `<td class="px-4 py-3 text-right font-mono font-semibold border-l ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${wc.fmt}</td>
                      <td class="px-4 py-3 text-right font-mono font-medium text-slate-400 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${wp.fmt}</td>
                      ${getGrHTML(wc.raw, wp.raw, wc.isInv, isDarkMode)}`;
          });
          const mp = prevTotM[i];
          tbody += `<td class="px-4 py-3 text-right font-mono border-l ${isDarkMode ? 'border-indigo-500 text-indigo-300 bg-indigo-950/50' : 'border-slate-200 text-indigo-700 bg-indigo-50/50'} font-bold border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mc.fmt}</td>
                    <td class="px-4 py-3 text-right font-mono font-medium text-slate-500 ${isDarkMode ? 'bg-indigo-950/50' : 'bg-indigo-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}">${mp.fmt}</td>
                    ${getGrHTML(mc.raw, mp.raw, mc.isInv, isDarkMode)}</tr>`;
        });
      });
    } else if (granularity === 'daily') {
      const daysFound = new Set<string>();
      ctxCurData.forEach(r => daysFound.add(r.bucket));
      const days = Array.from(daysFound).sort();
      thead = `<tr>
        <th class="sticky-col ${thClass}">Platform</th>
        <th class="sticky-col-2 ${thClass}">Ad Type</th>
        <th class="sticky-col-3 ${thClass}">Metric</th>`;
      days.forEach(d => {
        const parts = d.split('-'); const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
        thead += `<th class="px-4 py-4 text-right font-bold text-white bg-[#0f172a] sticky top-0 border-b border-slate-700 whitespace-nowrap">${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}</th>`;
      });
      thead += `<th class="px-4 py-4 text-right text-indigo-300 border-l border-slate-700 font-bold bg-[#020617] sticky top-0 border-b border-slate-700 whitespace-nowrap">Period Total</th></tr>`;

      const grouped: any = {};
      ctxCurData.forEach(r => {
        const k1 = String(r[cnf.colPlatform]);
        const k2 = String(r[cnf.colAdType]);
        if (!filterRow(k1, k2)) return;
        const k = k1 + '_|_' + k2;
        if (!grouped[k]) {
          grouped[k] = { total: getBaseMetrics(), days: {}, dim1: k1, dim2: k2 };
          days.forEach(d => grouped[k].days[d] = getBaseMetrics());
        }
        sumMetricsData(grouped[k].total, r);
        sumMetricsData(grouped[k].days[r.bucket], r);
      });

      Object.values(grouped).forEach((g: any) => {
        const adTypeStr = String(g.dim2).toLowerCase();
        const totM = getDisplayMetricsArray(g.total, adTypeStr);
        const dayM: any = {};
        days.forEach(d => { dayM[d] = getDisplayMetricsArray(g.days[d], adTypeStr); });

        totM.forEach((mc, i) => {
          let rowCls = i % 2 === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : (isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-50');
          if (i === 0) rowCls += ' group-start';
          if (i === totM.length - 1) rowCls += ' group-end';
          tbody += `<tr class="${rowCls} hover:${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/50'} transition-colors">`;
          if (i === 0) {
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
  }, [ctxCurData, ctxPrevData, granularity, globalDates, tableColFilter1, tableColFilter2, isDarkMode]);

  const tableData = generateTableHTML();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <div onClick={() => setDashboardContext('Overall')} className={`bg-indigo-600 rounded-3xl p-5 lg:p-6 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'Overall' ? 'ring-4 ring-indigo-300 shadow-indigo-600/40' : ''}`}>
          <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest">Overall Commerce</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg></div></div>
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.overall.exp)}</span>{renderGR(commerceKPIs.overall.exp, commerceKPIs.overall.pExp, false, isDarkMode)}</div></div>
            <div className="flex justify-between items-end border-b border-indigo-500 pb-3"><span className="text-xs font-bold text-indigo-200">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.overall.gmv)}</span>{renderGR(commerceKPIs.overall.gmv, commerceKPIs.overall.pGmv, false, isDarkMode)}</div></div>
            <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-indigo-200">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-300 leading-none">{commerceKPIs.overall.roas}</span>{renderGR(commerceKPIs.overall.roasNum, commerceKPIs.overall.pRoasNum, false, isDarkMode)}</div></div>
          </div>
        </div>
        <div onClick={() => setDashboardContext('TikTok')} className={`bg-slate-800 rounded-3xl p-5 lg:p-6 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'TikTok' ? 'ring-4 ring-slate-400 shadow-slate-900/40' : ''}`}>
          <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">TikTok Shop</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></div></div>
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.tiktok.exp)}</span>{renderGR(commerceKPIs.tiktok.exp, commerceKPIs.tiktok.pExp, false, isDarkMode)}</div></div>
            <div className="flex justify-between items-end border-b border-slate-600 pb-3"><span className="text-xs font-bold text-slate-400">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.tiktok.gmv)}</span>{renderGR(commerceKPIs.tiktok.gmv, commerceKPIs.tiktok.pGmv, false, isDarkMode)}</div></div>
            <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-slate-400">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-400 leading-none">{commerceKPIs.tiktok.roas}</span>{renderGR(commerceKPIs.tiktok.roasNum, commerceKPIs.tiktok.pRoasNum, false, isDarkMode)}</div></div>
          </div>
        </div>
        <div onClick={() => setDashboardContext('Shopee')} className={`bg-orange-500 rounded-3xl p-5 lg:p-6 shadow-lg cursor-pointer transition-all hover:-translate-y-1 ${dashboardContext === 'Shopee' ? 'ring-4 ring-orange-300 shadow-orange-500/40' : ''}`}>
          <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black text-orange-100 uppercase tracking-widest">Shopee</h3><div className="p-2.5 bg-white/20 rounded-xl"><svg className="w-5 h-5 text-white" viewBox="0 0 109.59 122.88" fill="currentColor"><path d="M74.98,91.98C76.15,82.36,69.96,76.22,53.6,71c-7.92-2.7-11.66-6.24-11.57-11.12 c0.33-5.4,5.36-9.34,12.04-9.47c4.63,0.09,9.77,1.22,14.76,4.56c0.59,0.37,1.01,0.32,1.35-0.2c0.46-0.74,1.61-2.53,2-3.17 c0.26-0.42,0.31-0.96-0.35-1.44c-0.95-0.7-3.6-2.13-5.03-2.72c-3.88-1.62-8.23-2.64-12.86-2.63c-9.77,0.04-17.47,6.22-18.12,14.47 c-0.42,5.95,2.53,10.79,8.86,14.47c1.34,0.78,8.6,3.67,11.49,4.57c9.08,2.83,13.8,7.9,12.69,13.81c-1.01,5.36-6.65,8.83-14.43,8.93 c-6.17-0.24-11.71-2.75-16.02-6.1c-0.11-0.08-0.65-0.5-0.72-0.56c-0.53-0.42-1.11-0.39-1.47,0.15c-0.26,0.4-1.92,2.8-2.34,3.43 c-0.39,0.55-0.18,0.86,0.23,1.2c1.8,1.5,4.18,3.14,5.81,3.97c4.47,2.28,9.32,3.53,14.48,3.72c3.32,0.22,7.5-0.49,10.63-1.81 C70.63,102.67,74.25,97.92,74.98,91.98L74.98,91.98z M54.79,7.18c-10.59,0-19.22,9.98-19.62,22.47h39.25 C74.01,17.16,65.38,7.18,54.79,7.18L54.79,7.18z M94.99,122.88l-0.41,0l-80.82-0.01h0c-5.5-0.21-9.54-4.66-10.09-10.19l-0.05-1 l-3.61-79.5v0C0,32.12,0,32.06,0,32c0-1.28,1.03-2.33,2.3-2.35l0,0h25.48C28.41,13.15,40.26,0,54.79,0s26.39,13.15,27.01,29.65 h25.4h0.04c1.3,0,2.35,1.05,2.35,2.35c0,0.04,0,0.08,0,0.12v0l-3.96,79.81l-0.04,0.68C105.12,118.21,100.59,122.73,94.99,122.88 L94.99,122.88z"/></svg></div></div>
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-orange-400 pb-3"><span className="text-xs font-bold text-orange-100">Expense</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.shopee.exp)}</span>{renderGR(commerceKPIs.shopee.exp, commerceKPIs.shopee.pExp, false, isDarkMode)}</div></div>
            <div className="flex justify-between items-end border-b border-orange-400 pb-3"><span className="text-xs font-bold text-orange-100">GMV</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-white leading-none">{formatIDR(commerceKPIs.shopee.gmv)}</span>{renderGR(commerceKPIs.shopee.gmv, commerceKPIs.shopee.pGmv, false, isDarkMode)}</div></div>
            <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-orange-100">ROAS</span><div className="text-right flex items-center justify-end gap-2"><span className="font-black text-[clamp(1.1rem,2vw,1.5rem)] text-emerald-200 leading-none">{commerceKPIs.shopee.roas}</span>{renderGR(commerceKPIs.shopee.roasNum, commerceKPIs.shopee.pRoasNum, false, isDarkMode)}</div></div>
          </div>
        </div>
      </div>
      
      <div className={`p-5 sm:p-6 lg:p-7 rounded-3xl border shadow-sm mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-7 gap-4">
          <div>
            <h2 className="text-[clamp(1.1rem,1.8vw,1.5rem)] font-black tracking-tight">{dashboardContext} Historical Trend</h2>
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

        <div key={`chart-comm-${dashboardContext}-${chartTypeEngine}-${chartMetricsComm.join('-')}`} className="w-full h-[380px] chart-appearance-animate">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-5 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
          <div>
            <h2 className={`font-black uppercase tracking-wider text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Platform Summary Rollup</h2>
            <p className="text-xs text-slate-400 mt-0.5">Core performance across platforms (Expense, Orders, GMV, CPA, ROAS)</p>
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
              {granularity === 'weekly' && globalDates && (() => {
                const weeksFound = new Set<string>(); ctxCurData.forEach(r => weeksFound.add(r.bucket)); ctxPrevData.forEach(r => weeksFound.add(r.bucket));
                const weeks = Array.from(weeksFound).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));
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
                const daysFound = new Set<string>(); ctxCurData.forEach(r => daysFound.add(r.bucket)); const days = Array.from(daysFound).sort();
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
            <TableBody dangerouslySetInnerHTML={{ __html: generateCommercePlatformSummaryBodyHTML() }} />
          </Table>
        </div>
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-5 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
          <h2 className={`font-black uppercase tracking-wider text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Platform & Ad Type Pivot</h2>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select value={tableColFilter1} onChange={(e) => setTableColFilter1(e.target.value)} className={`dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors ${isDarkMode ? 'border-slate-600 text-indigo-300 hover:border-indigo-500' : 'border-slate-300 text-indigo-700 hover:border-indigo-500 bg-slate-50'}`}>
              <option value="All">All Platforms / Ad Types</option>
              {tableData.uniqueDim1.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select value={tableColFilter2} onChange={(e) => setTableColFilter2(e.target.value)} className={`dropdown-arrow bg-transparent border text-xs font-bold py-2.5 px-4 rounded-full outline-none pr-10 shadow-sm transition-colors ${isDarkMode ? 'border-slate-600 text-emerald-300 hover:border-emerald-500' : 'border-slate-300 text-emerald-700 hover:border-emerald-500 bg-slate-50'}`}>
              <option value="All">All Ad Types</option>
              {tableData.uniqueDim2.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-auto max-h-[850px] relative w-full rounded-b-3xl">
          <table className={`min-w-full text-left text-[clamp(12px,1vw,14px)] whitespace-nowrap border-separate [border-spacing:0] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            <thead dangerouslySetInnerHTML={{ __html: tableData.head }} />
            <tbody dangerouslySetInnerHTML={{ __html: tableData.body }} />
          </table>
        </div>
      </div>
    </div>
  );
}