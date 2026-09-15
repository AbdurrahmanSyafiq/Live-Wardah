import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface CompileOptions {
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