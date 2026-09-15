export const CONFIG = {
  media: { sheet: "Media API", colDate: "Date", colBrand: "Brand", colPlatform: "Platform", colFunnel: "Funnel", colAdType: "KPI", colFormat: "Format", colConsiSize: "Result" },
  commerce: { sheet: "Commerce", colDate: "Date", colBrand: "Brand fx", colPlatform: "Platform", colAdType: "Ad Type" },
  creative: { sheet: "Creative Raw", colPeriod: "Period", colBrand: "Brand", colPlatform: "Platform", colAdType: "Ad Type", colFormat: "Format" },
  signal: { sheet: "Media Signal", colBrand: "Brand", colStatus: "Status", colDateStart: "Start Date", colDateEnd: "End Date" }
};

export const selectClass = "w-full bg-[#1e293b] border border-[#334155] text-slate-100 py-2.5 px-3 rounded-xl text-xs font-semibold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none dropdown-arrow hover:border-[#475569] transition-colors";
export const dateClass = "w-full bg-white border border-slate-200 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center";
export const dateClassDark = "w-full bg-[#1e293b] border border-indigo-500/50 text-indigo-300 py-2 px-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer text-center";
export const defaultFilters = { brand: 'All', funnel: 'All', platform: 'All', adType: 'All', format: 'All', period: 'All' };
export const CREATIVES_PER_PAGE = 8;