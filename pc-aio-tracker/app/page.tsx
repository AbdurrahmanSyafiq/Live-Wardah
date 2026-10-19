"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Chart from "chart.js/auto";
import { CONFIG, defaultFilters } from "@/lib/config";
import {
  parseNum,
  formatIDR,
  formatNum,
  formatPct,
  isValidBrandName,
} from "@/lib/formatters";
import {
  parseSheetDate,
  toYMD,
  getMediaDates,
  getWeekBucket,
} from "@/lib/dateUtils";
import {
  HOME_MONTHS,
  HOME_MONTH_SHEETS,
  normalizeSheetRows,
  buildHomeSummary,
  toSkuRows,
  toCommerceRows,
  toMediaRows,
} from "@/lib/homeData";
import LoginView from "@/components/auth/LoginView";
import WelcomeView from "@/components/navigation/WelcomeView";
import Sidebar from "@/components/navigation/Sidebar";
import GeneralOverviewView from "@/components/views/GeneralOverviewView";
import DigitalMediaView from "@/components/views/DigitalMediaView";
import CommerceTrackerView from "@/components/views/CommerceTrackerView";
import SkuPerformanceView from "@/components/views/SkuPerformanceView";
import TopCreativeView from "@/components/views/TopCreativeView";
import MediaSignalView from "@/components/views/MediaSignalView";

const getColVal = (row: any, ...keys: string[]) => {
  if (!row) return "";
  for (const k of keys) {
    const target = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    const found = Object.keys(row).find(
      (existing) => existing.toLowerCase().replace(/[^a-z0-9]/g, "") === target,
    );
    if (found !== undefined && row[found] !== undefined && row[found] !== "") {
      return row[found];
    }
  }
  return "";
};

export default function DashboardApp() {
  const [currentView, setCurrentView] = useState<
    "login" | "welcome" | "home" | "dashboard"
  >("login");
  const [activeEngine, setActiveEngine] = useState<
    "media" | "commerce" | "creative" | "signal" | "sku" | null
  >(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const dataCache = useRef<Record<string, any[]>>({});
  const [rawData, setRawData] = useState<any[]>([]);
  const [cirDailyData, setCirDailyData] = useState<any[]>([]);
  const [extraSheetsData, setExtraSheetsData] = useState<{
    mediaApi: any[];
    commerce: any[];
  }>({ mediaApi: [], commerce: [] });
  const [homeSheetData, setHomeSheetData] = useState<Record<string, any[]>>({});

  const [filters, setFilters] = useState(defaultFilters);
  const [selectedSignalPeriod, setSelectedSignalPeriod] = useState<string>("");
  const [granularity, setGranularity] = useState("monthly");
  const [dateMonth, setDateMonth] = useState("");
  const [dateWeekly, setDateWeekly] = useState("");
  const [dateDailyStart, setDateDailyStart] = useState("");
  const [dateDailyEnd, setDateDailyEnd] = useState("");

  const [homeBrand, setHomeBrand] = useState("All");
  const [homePeriods, setHomePeriods] = useState<string[]>([]);
  const [homeMomentumMetrics, setHomeMomentumMetrics] = useState<string[]>([
    "spend",
    "gmv",
  ]);

  const [tableColFilter1, setTableColFilter1] = useState("All");
  const [tableColFilter2, setTableColFilter2] = useState("All");

  const [dashboardContext, setDashboardContext] = useState("Overall");
  const [chartMetricsMedia, setChartMetricsMedia] = useState<string[]>([
    "spend",
    "imp",
  ]);
  const [chartMetricsComm, setChartMetricsComm] = useState<string[]>([
    "exp",
    "gmv",
  ]);

  const [chartTypeEngine, setChartTypeEngine] = useState<
    "combo" | "bar" | "line"
  >("combo");
  const [homeMomentumType, setHomeMomentumType] = useState<
    "bar" | "line" | "area"
  >("bar");

  useEffect(() => {
    Chart.defaults.font.family = "'Nunito Sans', sans-serif";
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const today = new Date();
    const yyyy_mm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const yyyy_mm_dd = `${yyyy_mm}-${String(today.getDate()).padStart(2, "0")}`;
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const start_yyyy_mm_dd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

    setDateMonth(yyyy_mm);
    setDateWeekly(yyyy_mm_dd);
    setDateDailyStart(start_yyyy_mm_dd);
    setDateDailyEnd(yyyy_mm_dd);
    setHomePeriods([HOME_MONTHS.includes(yyyy_mm) ? yyyy_mm : HOME_MONTHS[0]]);
  }, []);

  const loadData = async (
    engine: "media" | "commerce" | "creative" | "signal" | "sku",
    forceSync = false,
  ) => {
    setDashboardContext("Overall");
    setTableColFilter1("All");
    setTableColFilter2("All");

    if (forceSync) {
      if (engine === "sku" || engine === "commerce") {
        dataCache.current[CONFIG.commerce.sheet] = undefined as any;
        dataCache.current["CIR DAILY"] = undefined as any;
      } else {
        dataCache.current[CONFIG[engine].sheet] = undefined as any;
      }
      if (engine === "sku" || engine === "commerce" || engine === "media") {
        Object.values(HOME_MONTH_SHEETS).forEach((name) => {
          dataCache.current[name] = undefined as any;
        });
      }
      if (engine === "signal") {
        dataCache.current["Media API"] = undefined as any;
        dataCache.current["Commerce"] = undefined as any;
      }
    }

    setIsLoading(true);
    try {
      const fetchSheet = async (sheetName: string) => {
        if (!forceSync && dataCache.current[sheetName])
          return dataCache.current[sheetName];
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getData", sheetName }),
        });
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          dataCache.current[sheetName] = result.data;
          return result.data;
        }
        return [];
      };

      if (engine === "media") {
        // Digital Media dibaca dari sheet bulanan: Meta biasa + TikTok Awareness/Consideration
        const parts = await Promise.all(
          Object.entries(HOME_MONTH_SHEETS).map(async ([ym, sheetName]) =>
            toMediaRows(await fetchSheet(sheetName), ym),
          ),
        );
        const mediaRows = parts.flat();
        if (mediaRows.length === 0)
          alert(
            "No digital media data loaded. Check that the monthly sheet tabs exist and are shared with the service account.",
          );
        setRawData(mediaRows);
      } else if (engine === "commerce") {
        // Commerce dibaca dari sheet bulanan (Wardah Sep / Wardah Oct): CPAS Shopee & Lazada + TikTok Conversion
        const parts = await Promise.all(
          Object.entries(HOME_MONTH_SHEETS).map(async ([ym, sheetName]) =>
            toCommerceRows(await fetchSheet(sheetName), ym),
          ),
        );
        const commRows = parts.flat();
        if (commRows.length === 0)
          alert(
            "No commerce data loaded. Check that the monthly sheet tabs exist and are shared with the service account.",
          );
        setRawData(commRows);
        setCirDailyData([]); // belum ada sumber data GMV Sales untuk CIR
      } else if (engine === "sku") {
        // PID & SKU dibaca dari sheet bulanan (Wardah Sep / Wardah Oct), bukan tab "Commerce"
        const parts = await Promise.all(
          Object.entries(HOME_MONTH_SHEETS).map(async ([ym, sheetName]) =>
            toSkuRows(await fetchSheet(sheetName), ym),
          ),
        );
        const skuRows = parts.flat();
        if (skuRows.length === 0)
          alert(
            "No data loaded for PID & SKU. Check that the monthly sheet tabs exist and are shared with the service account.",
          );
        setRawData(skuRows);
      } else if (engine === "signal") {
        const [signalData, mediaApiData, commerceData] = await Promise.all([
          fetchSheet("Media Signal"),
          fetchSheet("Media API"),
          fetchSheet("Commerce"),
        ]);
        setRawData(signalData);
        setExtraSheetsData({ mediaApi: mediaApiData, commerce: commerceData });
      } else {
        const data = await fetchSheet(CONFIG[engine].sheet);
        setRawData(data);
      }
    } catch (err) {
      console.error(err);
      alert("Network error loading sheet data.");
    }
    setIsLoading(false);
  };

  const selectEngine = (
    engine: "media" | "commerce" | "creative" | "signal" | "sku",
  ) => {
    setActiveEngine(engine);
    setCurrentView("dashboard");
    loadData(engine);
  };

  const loadHomeData = async (forceSync = false) => {
    setIsLoading(true);
    try {
      const entries = Object.entries(HOME_MONTH_SHEETS); // [["2026-10","Wardah Oct"], ...]
      if (forceSync) {
        entries.forEach(([, sheetName]) => {
          dataCache.current[sheetName] = undefined as any;
        });
      }

      const errors: string[] = [];
      const fetchSheet = async (sheetName: string) => {
        if (!forceSync && dataCache.current[sheetName])
          return dataCache.current[sheetName];
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getData", sheetName }),
        });
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          dataCache.current[sheetName] = result.data;
          return result.data;
        }
        errors.push(`${sheetName}: ${result.error || "unknown error"}`);
        return [];
      };

      const results = await Promise.all(
        entries.map(([, sheetName]) => fetchSheet(sheetName)),
      );
      const next: Record<string, any[]> = {};
      entries.forEach(([ym], i) => {
        next[ym] = results[i];
      });
      setHomeSheetData(next);
      if (errors.length)
        alert(`Failed to load Home data:\n${errors.join("\n")}`);
    } catch {
      alert("Network error loading Home data.");
    }
    setIsLoading(false);
  };

  const selectHome = (forceSync = false) => {
    setActiveEngine(null);
    setCurrentView("home");
    loadHomeData(forceSync);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setTableColFilter1("All");
    setTableColFilter2("All");
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  const getDependentOptions = (colName: string, filterKeyToExclude: string) => {
    if (!rawData || rawData.length === 0) return ["All"];
    const activeCfgKey =
      activeEngine === "sku" ? "commerce" : activeEngine || "media";
    const cfg = CONFIG[activeCfgKey] as any;

    let filtered = rawData;
    if (filterKeyToExclude !== "brand" && filters.brand !== "All")
      filtered = filtered.filter(
        (r) => String(r[cfg.colBrand]) === filters.brand,
      );
    if (activeEngine === "media") {
      if (filterKeyToExclude !== "funnel" && filters.funnel !== "All")
        filtered = filtered.filter(
          (r) => String(r[cfg.colFunnel]) === filters.funnel,
        );
    }
    if (activeEngine === "commerce" || activeEngine === "creative") {
      if (filterKeyToExclude !== "adType" && filters.adType !== "All")
        filtered = filtered.filter(
          (r) => String(r[cfg.colAdType]) === filters.adType,
        );
    }
    if (activeEngine === "creative") {
      if (filterKeyToExclude !== "period" && filters.period !== "All")
        filtered = filtered.filter(
          (r) => String(r[cfg.colPeriod]) === filters.period,
        );
      if (filterKeyToExclude !== "platform" && filters.platform !== "All")
        filtered = filtered.filter(
          (r) => String(r[cfg.colPlatform]) === filters.platform,
        );
      if (filterKeyToExclude !== "format" && filters.format !== "All")
        filtered = filtered.filter(
          (r) => String(r[cfg.colFormat]) === filters.format,
        );
    }

    const unique = Array.from(new Set(filtered.map((r) => r[colName]))).filter(
      (v) => {
        if (!v || String(v).trim() === "") return false;
        if (colName.toLowerCase().includes("brand")) return isValidBrandName(v);
        return true;
      },
    );
    return ["All", ...unique.sort()];
  };

  const handleToggleMetric = (engine: "media" | "commerce", value: string) => {
    const setState =
      engine === "media" ? setChartMetricsMedia : setChartMetricsComm;
    const current =
      engine === "media" ? [...chartMetricsMedia] : [...chartMetricsComm];
    if (current.includes(value)) {
      if (current.length === 1) return;
      setState(current.filter((m) => m !== value));
    } else {
      if (current.length >= 3) {
        alert("Max 3 metrics for chart.");
        return;
      }
      setState([...current, value]);
    }
  };

  const signalPeriods = useMemo(() => {
    if (activeEngine !== "signal" || rawData.length === 0) return [];
    const unique = new Map<string, { start: string; end: string }>();
    rawData.forEach((r) => {
      const s = toYMD(r["Start Date"] || r["start_date"]);
      const e = toYMD(r["End Date"] || r["end_date"]);
      if (s && e) {
        const key = `${s}_to_${e}`;
        if (!unique.has(key)) unique.set(key, { start: s, end: e });
      }
    });

    const list = Array.from(unique.entries()).map(([key, val]) => ({
      key,
      start: val.start,
      end: val.end,
      label: `${val.start} to ${val.end}`,
    }));

    return list.sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
    );
  }, [rawData, activeEngine]);

  useEffect(() => {
    if (
      activeEngine === "signal" &&
      signalPeriods.length > 0 &&
      !selectedSignalPeriod
    ) {
      setSelectedSignalPeriod(signalPeriods[0].key);
    }
  }, [activeEngine, signalPeriods, selectedSignalPeriod]);

  const signalCompiled = useMemo(() => {
    if (
      activeEngine !== "signal" ||
      rawData.length === 0 ||
      !selectedSignalPeriod
    )
      return null;

    const currentPeriodObj = signalPeriods.find(
      (p) => p.key === selectedSignalPeriod,
    );
    if (!currentPeriodObj) return null;

    const shiftMonth = (value: string) => {
      const date = parseSheetDate(value);
      if (!date || isNaN(date.getTime())) return "";
      const targetMonth = date.getMonth() - 1;
      const lastDay = new Date(
        date.getFullYear(),
        targetMonth + 1,
        0,
      ).getDate();
      const shifted = new Date(
        date.getFullYear(),
        targetMonth,
        Math.min(date.getDate(), lastDay),
      );
      return toYMD(shifted);
    };
    const prevPeriodObj = {
      start: shiftMonth(currentPeriodObj.start),
      end: shiftMonth(currentPeriodObj.end),
    };

    const cleanStr = (s: any) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const targetBrand = cleanStr(filters.brand);

    const findVal = (row: any, candidates: string[]) => {
      for (const cand of candidates) {
        const found = Object.keys(row).find(
          (k) => k.toLowerCase().trim() === cand.toLowerCase().trim(),
        );
        if (
          found !== undefined &&
          row[found] !== undefined &&
          row[found] !== ""
        ) {
          return row[found];
        }
      }
      return "";
    };

    const compilePeriod = (
      periodObj: { start: string; end: string } | null,
      isPlanOnly = false,
    ) => {
      if (!periodObj) return null;

      const pStart = parseSheetDate(periodObj.start);
      if (pStart) pStart.setHours(0, 0, 0, 0);
      const pEnd = parseSheetDate(periodObj.end);
      if (pEnd) pEnd.setHours(23, 59, 59, 999);

      const signalSubset = rawData.filter((row) => {
        const b = cleanStr(row["Brand"]);
        if (targetBrand !== "all" && b !== targetBrand) return false;
        const s = toYMD(row["Start Date"] || row["start_date"]);
        const e = toYMD(row["End Date"] || row["end_date"]);
        if (s !== periodObj.start || e !== periodObj.end) return false;

        const statusVal = String(findVal(row, ["Status", "status", "Type"]))
          .toLowerCase()
          .trim();
        return isPlanOnly
          ? statusVal.includes("plan")
          : statusVal.includes("actual") ||
              (!statusVal.includes("plan") && statusVal !== "");
      });

      const sumSignal = (keys: string[]) => {
        return signalSubset.reduce((acc, row) => {
          const val = findVal(row, keys);
          return acc + parseNum(val);
        }, 0);
      };

      const impressions = sumSignal(["Impressions", "Total Impressions"]);
      const paidImpressions = sumSignal(["Paid Impressions"]);
      const organicImpressions = sumSignal(["Organic Impressions"]);
      const engagements = sumSignal(["Engagements", "Total Engagements"]);
      const paidEngagements = sumSignal(["Paid Engagements"]);
      const organicEngagements = sumSignal(["Organic Engagements"]);
      const views100 = sumSignal([
        "Video Views At 100",
        "Video Views At 100%",
        "video_views_at_100",
      ]);
      const views6s = sumSignal([
        "6 Sec Video Views",
        "6-sec Video Views",
        "6_sec_video_views",
      ]);
      const shares = sumSignal(["Shares"]);
      const comments = sumSignal(["Comments"]);
      const likes = sumSignal(["Likes"]);
      const clicks = sumSignal(["Clicks"]);
      const searchVolume = sumSignal([
        "Search Volume",
        "Search Volumes",
        "search_volume",
      ]);
      const productCardClicks = sumSignal([
        "Product Card Clicks",
        "product_card_clicks",
      ]);
      const newAwareness = sumSignal([
        "New Awareness Audience",
        "new_awareness_audience",
      ]);
      const newConsideration = sumSignal([
        "New Consideration Audience",
        "new_consideration_audience",
      ]);
      const newConversion = sumSignal([
        "New Conversion Audience",
        "new_conversion_audience",
      ]);

      let spendAwareness = 0;
      let spendConsideration = 0;
      let spendConversionMedia = 0;
      let totalMediaSpend = 0;
      let impAwareness = 0;
      let impConsideration = 0;

      if (
        !isPlanOnly &&
        extraSheetsData.mediaApi &&
        extraSheetsData.mediaApi.length > 0 &&
        pStart &&
        pEnd
      ) {
        extraSheetsData.mediaApi.forEach((row) => {
          const plat = String(row["Platform"] || "")
            .toLowerCase()
            .trim();
          const b = cleanStr(row["Brand"] || row["Brand fx"]);
          if (!plat.includes("tiktok")) return;
          if (targetBrand !== "all" && b !== targetBrand) return;
          const rDate = parseSheetDate(row["Date"]);
          if (!rDate || rDate < pStart || rDate > pEnd) return;

          const f = String(row["Funnel"] || row["KPI"] || "")
            .toLowerCase()
            .trim();
          const s = parseNum(row["Ad Spend"] || row["Spend"] || row["Expense"]);
          const i = parseNum(row["Impressions"] || row["Impression"]);

          totalMediaSpend += s;
          if (f.includes("awareness")) {
            spendAwareness += s;
            impAwareness += i;
          } else if (f.includes("consideration")) {
            spendConsideration += s;
            impConsideration += i;
          } else if (f.includes("conversion")) {
            spendConversionMedia += s;
          }
        });
      }

      let gmvCommerce = 0;
      let itemsSold = 0;
      let spendConversionComm = 0;

      if (
        !isPlanOnly &&
        extraSheetsData.commerce &&
        extraSheetsData.commerce.length > 0 &&
        pStart &&
        pEnd
      ) {
        extraSheetsData.commerce.forEach((row) => {
          const plat = String(row["Platform"] || "")
            .toLowerCase()
            .trim();
          const b = cleanStr(row["Brand fx"] || row["Brand"]);
          if (!plat.includes("tiktok")) return;
          if (targetBrand !== "all" && b !== targetBrand) return;
          const rDate = parseSheetDate(row["Date"]);
          if (!rDate || rDate < pStart || rDate > pEnd) return;

          gmvCommerce += parseNum(row["GMV"]);
          itemsSold +=
            parseNum(row["Items Sold"]) ||
            parseNum(row["Item sold"]) ||
            parseNum(row["items_sold"]) ||
            parseNum(row["Orders"]);
          spendConversionComm += parseNum(row["Expense"]);
        });
      }

      const signalSpend = sumSignal([
        "Total TikTok Spend",
        "Total TikTok",
        "Ad Spend",
        "Spend",
        "total_spend",
      ]);
      const spendConversion =
        spendConversionComm ||
        spendConversionMedia ||
        sumSignal(["Spend Conversion", "spend_conversion"]);
      const totalSpend = isPlanOnly
        ? signalSpend ||
          sumSignal([
            "Spend Awareness",
            "Spend Consideration",
            "Spend Conversion",
          ])
        : Math.max(
            spendAwareness + spendConsideration + spendConversion,
            totalMediaSpend,
          ) || signalSpend;

      const impConversion = isPlanOnly
        ? 0
        : sumSignal(["Impression Conversion", "imp_conversion"]) ||
          Math.max(0, paidImpressions - impAwareness - impConsideration);
      const gmvAds = gmvCommerce || sumSignal(["GMV Ads", "gmv_ads", "GMV"]);
      const finalItemsSold =
        itemsSold ||
        sumSignal(["Items Sold", "Item sold", "items_sold", "Orders"]);

      return {
        impressions,
        paidImpressions,
        organicImpressions,
        pctOrganicImp: impressions > 0 ? organicImpressions / impressions : 0,
        engagements,
        paidEngagements,
        organicEngagements,
        pctOrganicEng: engagements > 0 ? organicEngagements / engagements : 0,
        views100,
        views6s,
        shares,
        comments,
        likes,
        clicks,
        searchVolume,
        productCardClicks,
        gmvAds,
        itemsSold: finalItemsSold,
        aov: finalItemsSold > 0 ? gmvAds / finalItemsSold : 0,
        cr: clicks > 0 ? finalItemsSold / clicks : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        vtr: impressions > 0 ? views100 / impressions : 0,
        er: impressions > 0 ? engagements / impressions : 0,
        newAwareness,
        newConsideration,
        newConversion,
        costPerConsi:
          newConsideration > 0 ? spendConsideration / newConsideration : 0,
        costPerConv: newConversion > 0 ? spendConversion / newConversion : 0,
        impAwareness,
        impConsideration,
        impConversion,
        cpmAwareness:
          impAwareness > 0 ? (spendAwareness / impAwareness) * 1000 : 0,
        cpmConsideration:
          impConsideration > 0
            ? (spendConsideration / impConsideration) * 1000
            : 0,
        cpmConversion:
          impConversion > 0 ? (spendConversion / impConversion) * 1000 : 0,
        spendAwareness,
        spendConsideration,
        spendConversion,
        totalSpend,
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
      prevPeriod: prevPeriodObj,
    };
  }, [
    rawData,
    extraSheetsData,
    filters.brand,
    activeEngine,
    selectedSignalPeriod,
    signalPeriods,
  ]);

  const signalHierarchyGroups = useMemo(() => {
    if (!signalCompiled) return [];

    const metric = (
      name: string,
      key: string,
      fmt: (value: number) => string,
      isInv = false,
      overridePlan?: number,
    ) => ({
      name,
      act: signalCompiled.actual?.[key],
      pln:
        overridePlan !== undefined ? overridePlan : signalCompiled.plan?.[key],
      prv: signalCompiled.prev?.[key],
      fmt,
      isInv,
    });

    return [
      {
        category: "Scale Signal",
        rows: [
          metric("Total Impressions", "impressions", formatNum),
          metric("Paid Impressions", "paidImpressions", formatNum),
          metric("Organic Impressions", "organicImpressions", formatNum),
          metric("% Organic Impressions", "pctOrganicImp", formatPct),
        ],
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
          metric("ER %", "er", formatPct),
        ],
      },
      {
        category: "Attention Signal",
        rows: [
          metric("Video Views at 100%", "views100", formatNum),
          metric("6-sec Video Views", "views6s", formatNum),
          metric("Shares", "shares", formatNum),
          metric("Comments", "comments", formatNum),
          metric("Likes", "likes", formatNum),
        ],
      },
      {
        category: "Intent Signal",
        rows: [
          metric("Clicks", "clicks", formatNum),
          metric("Search Volumes", "searchVolume", formatNum),
        ],
      },
      {
        category: "Commerce Signal & Performance",
        rows: [
          metric("Product Card Clicks", "productCardClicks", formatNum),
          metric("GMV Ads", "gmvAds", formatIDR),
          metric("Items Sold", "itemsSold", formatNum),
          metric("AOV", "aov", formatIDR),
          metric("CR %", "cr", formatPct),
        ],
      },
      {
        category: "Audience Acquisition & Efficiency",
        rows: [
          metric("New Awareness Audience", "newAwareness", formatNum),
          metric("New Consideration Audience", "newConsideration", formatNum),
          metric("New Conversion Audience", "newConversion", formatNum),
          metric("Cost per new Consi", "costPerConsi", formatIDR, true),
          metric("Cost per new Conversion", "costPerConv", formatIDR, true),
        ],
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
          metric("Total TikTok Spend", "totalSpend", formatIDR, false),
        ],
      },
    ];
  }, [signalCompiled]);

  const { curData, prevData, chartData, creativeData, globalDates } =
    useMemo(() => {
      if (!activeEngine || activeEngine === "signal" || rawData.length === 0)
        return {
          curData: [],
          prevData: [],
          chartData: [],
          creativeData: [],
          globalDates: null,
        };
      const activeCfgKey = activeEngine === "sku" ? "commerce" : activeEngine;
      const cfg = CONFIG[activeCfgKey];

      const filteredBase = rawData.filter((row) => {
        if (
          filters.brand !== "All" &&
          String(row[cfg.colBrand]) !== filters.brand
        )
          return false;
        if (
          activeEngine === "media" &&
          filters.funnel !== "All" &&
          String(row[cfg.colFunnel]) !== filters.funnel
        )
          return false;
        if (
          activeEngine === "commerce" &&
          filters.adType !== "All" &&
          String(row[cfg.colAdType]) !== filters.adType
        )
          return false;
        if (activeEngine === "creative") {
          if (
            filters.period !== "All" &&
            String(row[cfg.colPeriod]) !== filters.period
          )
            return false;
          if (
            filters.platform !== "All" &&
            String(row[cfg.colPlatform]) !== filters.platform
          )
            return false;
          if (
            filters.adType !== "All" &&
            String(row[cfg.colAdType]) !== filters.adType
          )
            return false;
          if (
            filters.format !== "All" &&
            String(row[cfg.colFormat]) !== filters.format
          )
            return false;
        }
        return true;
      });

      if (activeEngine === "creative")
        return {
          curData: [],
          prevData: [],
          chartData: [],
          creativeData: filteredBase,
          globalDates: null,
        };

      let cData: any[] = [];
      let pData: any[] = [];
      let chData: any[] = [];
      let dates: any = null;
      let dStart: any = null;
      let dEnd: any = null;

      if (granularity === "monthly" && dateMonth) {
        const p = dateMonth.split("-");
        dates = getMediaDates(
          new Date(Number(p[0]), Number(p[1]), 0),
          "monthly",
        );
      } else if (granularity === "weekly" && dateWeekly) {
        const p = dateWeekly.split("-");
        dates = getMediaDates(
          new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])),
          "weekly",
        );
      } else if (granularity === "daily" && dateDailyStart && dateDailyEnd) {
        const s = dateDailyStart.split("-");
        dStart = new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
        const e = dateDailyEnd.split("-");
        dEnd = new Date(
          Number(e[0]),
          Number(e[1]) - 1,
          Number(e[2]),
          23,
          59,
          59,
        );
      }

      filteredBase.forEach((row) => {
        const rowDate = parseSheetDate(row[cfg.colDate]);
        if (!rowDate) return;
        rowDate.setHours(0, 0, 0, 0);
        row.parsedDate = rowDate;

        if (granularity === "monthly" && dates) {
          if (rowDate >= dates.curStart && rowDate <= dates.curMonthEnd) {
            row.bucket = "Month";
            cData.push(row);
          }
          if (rowDate >= dates.prevStart && rowDate <= dates.prevMonthEnd) {
            row.bucket = "Month";
            pData.push(row);
          }
          if (rowDate >= dates.chartStart && rowDate <= dates.curMonthEnd) {
            let chartRow = { ...row };
            chartRow.chartBucket = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}`;
            chData.push(chartRow);
          }
        } else if (granularity === "weekly" && dates) {
          if (rowDate >= dates.curStart && rowDate <= dates.curMtdEnd) {
            row.bucket = "W" + getWeekBucket(rowDate, dates.curStart);
            cData.push(row);
          }
          if (rowDate >= dates.prevStart && rowDate <= dates.prevMtdEnd) {
            row.bucket = "W" + getWeekBucket(rowDate, dates.prevStart);
            pData.push(row);
          }
        } else if (granularity === "daily" && dStart && dEnd) {
          if (rowDate >= dStart && rowDate <= dEnd) {
            row.bucket = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}-${String(rowDate.getDate()).padStart(2, "0")}`;
            cData.push(row);
            chData.push(row);
          }
        }
      });

      return {
        curData: cData,
        prevData: pData,
        chartData: chData,
        creativeData: [],
        globalDates: dates,
      };
    }, [
      rawData,
      filters,
      activeEngine,
      granularity,
      dateMonth,
      dateWeekly,
      dateDailyStart,
      dateDailyEnd,
    ]);

  // --- CIR DAILY DATA PIPELINE (WITH BRAND FX / BRAND COMPATIBILITY) ---
  const { cirCurData, cirPrevData } = useMemo(() => {
    if (
      activeEngine !== "commerce" ||
      !cirDailyData ||
      cirDailyData.length === 0
    ) {
      return { cirCurData: [], cirPrevData: [] };
    }

    const filteredCir = cirDailyData.filter((row) => {
      if (filters.brand !== "All") {
        const rowBrand = String(row["Brand fx"] || row["Brand"] || "")
          .trim()
          .toLowerCase();
        if (rowBrand !== filters.brand.trim().toLowerCase()) return false;
      }
      return true;
    });

    let cData: any[] = [];
    let pData: any[] = [];
    let dates: any = null;
    let dStart: any = null;
    let dEnd: any = null;

    if (granularity === "monthly" && dateMonth) {
      const p = dateMonth.split("-");
      dates = getMediaDates(new Date(Number(p[0]), Number(p[1]), 0), "monthly");
    } else if (granularity === "weekly" && dateWeekly) {
      const p = dateWeekly.split("-");
      dates = getMediaDates(
        new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])),
        "weekly",
      );
    } else if (granularity === "daily" && dateDailyStart && dateDailyEnd) {
      const s = dateDailyStart.split("-");
      dStart = new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
      const e = dateDailyEnd.split("-");
      dEnd = new Date(Number(e[0]), Number(e[1]) - 1, Number(e[2]), 23, 59, 59);
    }

    filteredCir.forEach((row) => {
      const rawDateStr = getColVal(row, "Date", "Tanggal");
      const rowDate = parseSheetDate(rawDateStr);
      if (!rowDate) return;
      rowDate.setHours(0, 0, 0, 0);

      const rowCopy = { ...row, parsedDate: rowDate };

      if (granularity === "monthly" && dates) {
        if (rowDate >= dates.curStart && rowDate <= dates.curMonthEnd) {
          rowCopy.bucket = "Month";
          cData.push(rowCopy);
        }
        if (rowDate >= dates.prevStart && rowDate <= dates.prevMonthEnd) {
          rowCopy.bucket = "Month";
          pData.push(rowCopy);
        }
      } else if (granularity === "weekly" && dates) {
        if (rowDate >= dates.curStart && rowDate <= dates.curMtdEnd) {
          rowCopy.bucket = "W" + getWeekBucket(rowDate, dates.curStart);
          cData.push(rowCopy);
        }
        if (rowDate >= dates.prevStart && rowDate <= dates.prevMtdEnd) {
          rowCopy.bucket = "W" + getWeekBucket(rowDate, dates.prevStart);
          pData.push(rowCopy);
        }
      } else if (granularity === "daily" && dStart && dEnd) {
        if (rowDate >= dStart && rowDate <= dEnd) {
          rowCopy.bucket = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}-${String(rowDate.getDate()).padStart(2, "0")}`;
          cData.push(rowCopy);
        }
      }
    });

    return { cirCurData: cData, cirPrevData: pData };
  }, [
    cirDailyData,
    filters.brand,
    activeEngine,
    granularity,
    dateMonth,
    dateWeekly,
    dateDailyStart,
    dateDailyEnd,
  ]);

  const { ctxCurData, ctxPrevData, ctxChartData } = useMemo(() => {
    if (
      dashboardContext === "Overall" ||
      activeEngine === "creative" ||
      activeEngine === "signal" ||
      activeEngine === "sku"
    ) {
      return {
        ctxCurData: curData,
        ctxPrevData: prevData,
        ctxChartData: chartData,
      };
    }
    const match = dashboardContext.toLowerCase();
    const filterFn = (row: any) => {
      const p = String(
        row[CONFIG[activeEngine as "media" | "commerce"].colPlatform] || "",
      ).toLowerCase();
      if (match === "meta")
        return (
          p.includes("meta") ||
          p.includes("facebook") ||
          p.includes("ig") ||
          p.includes("instagram")
        );
      return p.includes(match);
    };
    return {
      ctxCurData: curData.filter(filterFn),
      ctxPrevData: prevData.filter(filterFn),
      ctxChartData: chartData.filter(filterFn),
    };
  }, [curData, prevData, chartData, dashboardContext, activeEngine]);

  const mediaKPIs = useMemo(() => {
    let totals = {
      overall: {
        spend: 0,
        impr: 0,
        engage: 0,
        pSpend: 0,
        pImpr: 0,
        pEngage: 0,
      },
      meta: { spend: 0, impr: 0, engage: 0, pSpend: 0, pImpr: 0, pEngage: 0 },
      tiktok: { spend: 0, impr: 0, engage: 0, pSpend: 0, pImpr: 0, pEngage: 0 },
    };
    const calc = (data: any[], isPrev: boolean) => {
      if (activeEngine !== "media") return;
      data.forEach((row) => {
        const s = parseNum(row["Ad Spend"]);
        const i = parseNum(row["Impressions"]);
        const e =
          parseNum(row["Combined Clicks"]) +
          parseNum(row["Views"]) +
          parseNum(row["Views 6s"]);
        const plat = String(row[CONFIG.media.colPlatform] || "").toLowerCase();

        if (isPrev) {
          totals.overall.pSpend += s;
          totals.overall.pImpr += i;
          totals.overall.pEngage += e;
          if (plat.includes("meta") || plat.includes("ig")) {
            totals.meta.pSpend += s;
            totals.meta.pImpr += i;
            totals.meta.pEngage += e;
          } else if (plat.includes("tiktok")) {
            totals.tiktok.pSpend += s;
            totals.tiktok.pImpr += i;
            totals.tiktok.pEngage += e;
          }
        } else {
          totals.overall.spend += s;
          totals.overall.impr += i;
          totals.overall.engage += e;
          if (plat.includes("meta") || plat.includes("ig")) {
            totals.meta.spend += s;
            totals.meta.impr += i;
            totals.meta.engage += e;
          } else if (plat.includes("tiktok")) {
            totals.tiktok.spend += s;
            totals.tiktok.impr += i;
            totals.tiktok.engage += e;
          }
        }
      });
    };
    calc(curData, false);
    calc(prevData, true);
    return totals;
  }, [curData, prevData, activeEngine]);

  const commerceKPIs = useMemo(() => {
    let totals = {
      overall: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 },
      tiktok: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 },
      shopee: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 },
      lazada: { exp: 0, gmv: 0, pExp: 0, pGmv: 0 },
    };
    const calc = (data: any[], isPrev: boolean) => {
      if (activeEngine !== "commerce" && activeEngine !== "sku") return;
      data.forEach((row) => {
        const e = parseNum(row["Expense"]);
        const g = parseNum(row["GMV"]);
        const plat = String(
          row[CONFIG.commerce.colPlatform] || "",
        ).toLowerCase();

        if (isPrev) {
          totals.overall.pExp += e;
          totals.overall.pGmv += g;
          if (plat.includes("tiktok")) {
            totals.tiktok.pExp += e;
            totals.tiktok.pGmv += g;
          } else if (plat.includes("shopee")) {
            totals.shopee.pExp += e;
            totals.shopee.pGmv += g;
          } else if (plat.includes("lazada")) {
            totals.lazada.pExp += e;
            totals.lazada.pGmv += g;
          }
        } else {
          totals.overall.exp += e;
          totals.overall.gmv += g;
          if (plat.includes("tiktok")) {
            totals.tiktok.exp += e;
            totals.tiktok.gmv += g;
          } else if (plat.includes("shopee")) {
            totals.shopee.exp += e;
            totals.shopee.gmv += g;
          } else if (plat.includes("lazada")) {
            totals.lazada.exp += e;
            totals.lazada.gmv += g;
          }
        }
      });
    };
    calc(curData, false);
    calc(prevData, true);
    const calcRoas = (g: number, e: number) =>
      e > 0 ? (g / e).toFixed(2) + "x" : "0.00x";
    return {
      overall: {
        ...totals.overall,
        roas: calcRoas(totals.overall.gmv, totals.overall.exp),
        pRoas: calcRoas(totals.overall.pGmv, totals.overall.pExp),
        roasNum:
          totals.overall.exp > 0 ? totals.overall.gmv / totals.overall.exp : 0,
        pRoasNum:
          totals.overall.pExp > 0
            ? totals.overall.pGmv / totals.overall.pExp
            : 0,
      },
      tiktok: {
        ...totals.tiktok,
        roas: calcRoas(totals.tiktok.gmv, totals.tiktok.exp),
        pRoas: calcRoas(totals.tiktok.pGmv, totals.tiktok.pExp),
        roasNum:
          totals.tiktok.exp > 0 ? totals.tiktok.gmv / totals.tiktok.exp : 0,
        pRoasNum:
          totals.tiktok.pExp > 0 ? totals.tiktok.pGmv / totals.tiktok.pExp : 0,
      },
      shopee: {
        ...totals.shopee,
        roas: calcRoas(totals.shopee.gmv, totals.shopee.exp),
        pRoas: calcRoas(totals.shopee.pGmv, totals.shopee.pExp),
        roasNum:
          totals.shopee.exp > 0 ? totals.shopee.gmv / totals.shopee.exp : 0,
        pRoasNum:
          totals.shopee.pExp > 0 ? totals.shopee.pGmv / totals.shopee.pExp : 0,
      },
      lazada: {
        ...totals.lazada,
        roas: calcRoas(totals.lazada.gmv, totals.lazada.exp),
        pRoas: calcRoas(totals.lazada.pGmv, totals.lazada.pExp),
        roasNum:
          totals.lazada.exp > 0 ? totals.lazada.gmv / totals.lazada.exp : 0,
        pRoasNum:
          totals.lazada.pExp > 0 ? totals.lazada.pGmv / totals.lazada.pExp : 0,
      },
    };
  }, [curData, prevData, activeEngine]);

  // Data Home: baris dari semua sheet bulanan dirapikan jadi satu format
  const homeNormalized = useMemo(() => {
    const rows: ReturnType<typeof normalizeSheetRows>["rows"] = [];
    const missing = new Set<string>();
    Object.entries(homeSheetData as Record<string, any[]>).forEach(
      ([ym, raw]) => {
        const r = normalizeSheetRows(raw, ym);
        r.rows.forEach((row) => rows.push(row));
        r.missing.forEach((m) => missing.add(m));
      },
    );
    return { rows, missing: Array.from(missing) };
  }, [homeSheetData]);

  const homeBrandOptions = useMemo(() => {
    const brands = new Set<string>();
    homeNormalized.rows.forEach((row) => {
      if (isValidBrandName(row.brand)) brands.add(row.brand);
    });
    return ["All", ...Array.from(brands).sort()];
  }, [homeNormalized]);

  // Filter bulan: fixed sesuai sheet yang tersedia (lihat HOME_MONTH_SHEETS di lib/homeData.ts)
  const availableHomeMonths = HOME_MONTHS;

  const handleToggleHomeMonth = (month: string) => {
    setHomePeriods((prev) => {
      if (prev.includes(month)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== month);
      } else {
        return [...prev, month].sort();
      }
    });
  };

  const homeSummary = useMemo(() => {
    if (!homePeriods.length) return null;
    return buildHomeSummary(
      homeNormalized.rows,
      homePeriods,
      homeBrand,
      homeNormalized.missing,
    );
  }, [homeNormalized, homeBrand, homePeriods]);

  if (currentView === "login") {
    return <LoginView onLoginSuccess={() => setCurrentView("welcome")} />;
  }

  if (currentView === "welcome") {
    return (
      <WelcomeView
        onSelectHome={() => selectHome()}
        onSelectEngine={(engine) => selectEngine(engine)}
      />
    );
  }

  return (
    <div
      className={`dashboard-shell w-full min-h-screen flex font-sans transition-colors duration-300 ${isDarkMode ? "bg-[#090d16] text-slate-100" : "bg-[#e7e7ef] text-slate-800"}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        
        table { border-collapse: separate !important; border-spacing: 0 !important; }
        thead th { position: sticky !important; top: 0 !important; z-index: 30 !important; background-color: #090d16 !important; }
        thead th.sticky-col { position: sticky !important; top: 0 !important; left: 0px !important; z-index: 60 !important; background-color: #090d16 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid #1e293b !important; border-bottom: 2px solid #1e293b !important; }
        thead th.sticky-col-2 { position: sticky !important; top: 0 !important; left: 180px !important; z-index: 60 !important; background-color: #090d16 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid #1e293b !important; border-bottom: 2px solid #1e293b !important; }
        thead th.sticky-col-3 { position: sticky !important; top: 0 !important; left: 360px !important; z-index: 60 !important; background-color: #090d16 !important; width: 120px !important; min-width: 120px !important; max-width: 120px !important; border-right: 1px solid #1e293b !important; border-bottom: 2px solid #1e293b !important; box-shadow: 4px 0 10px -3px rgba(0,0,0,0.3) !important; }
        tbody td.sticky-col { position: sticky !important; left: 0px !important; z-index: 20 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid ${isDarkMode ? "#1e293b" : "#e2e8f0"} !important; }
        tbody td.sticky-col-2 { position: sticky !important; left: 180px !important; z-index: 20 !important; width: 180px !important; min-width: 180px !important; max-width: 180px !important; border-right: 1px solid ${isDarkMode ? "#1e293b" : "#e2e8f0"} !important; }
        tbody td.sticky-col-3 { position: sticky !important; left: 360px !important; z-index: 20 !important; width: 120px !important; min-width: 120px !important; max-width: 120px !important; border-right: 1px solid ${isDarkMode ? "#1e293b" : "#e2e8f0"} !important; box-shadow: 4px 0 10px -3px rgba(0,0,0,0.08) !important; }
        tr.group-start:not(:first-child) td { border-top: 2.5px solid ${isDarkMode ? "#64748b" : "#94a3b8"} !important; }
        tr.group-start td[rowspan] { border-bottom: 2.5px solid ${isDarkMode ? "#64748b" : "#94a3b8"} !important; }
        tr.group-end td { border-bottom: 2.5px solid ${isDarkMode ? "#64748b" : "#94a3b8"} !important; }

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
      `,
        }}
      />

      {isLoading && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h3 className="font-bold text-white text-sm tracking-wide">
            Fetching Data...
          </h3>
        </div>
      )}

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentView={currentView}
        activeEngine={activeEngine}
        onSelectHome={() => selectHome()}
        onSelectEngine={(engine) => selectEngine(engine)}
        isDarkMode={isDarkMode}
        granularity={granularity}
        setGranularity={setGranularity}
        dateMonth={dateMonth}
        setDateMonth={setDateMonth}
        dateWeekly={dateWeekly}
        setDateWeekly={setDateWeekly}
        dateDailyStart={dateDailyStart}
        setDateDailyStart={setDateDailyStart}
        dateDailyEnd={dateDailyEnd}
        setDateDailyEnd={setDateDailyEnd}
        homeBrand={homeBrand}
        setHomeBrand={setHomeBrand}
        homeBrandOptions={homeBrandOptions}
        homePeriods={homePeriods}
        availableHomeMonths={availableHomeMonths}
        onToggleHomeMonth={handleToggleHomeMonth}
        onSyncHomeData={() => loadHomeData(true)}
        selectedSignalPeriod={selectedSignalPeriod}
        setSelectedSignalPeriod={setSelectedSignalPeriod}
        signalPeriods={signalPeriods}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
        getDependentOptions={getDependentOptions}
        onSyncLiveData={() => loadData(activeEngine as any, true)}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 h-screen overflow-y-auto w-full transition-all duration-300 relative">
        <div className="flex items-center justify-between mb-5 w-full">
          <div>
            <h1
              className={`text-2xl lg:text-3xl font-black tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {currentView === "home"
                ? "General Overview"
                : activeEngine === "signal"
                  ? "TikTok Media Signal Tracker"
                  : activeEngine === "media"
                    ? "Digital Media"
                    : activeEngine === "commerce"
                      ? "Commerce Tracker"
                      : activeEngine === "sku"
                        ? "PID & SKU Performance"
                        : "Top Creative"}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className={`p-2.5 rounded-xl shadow-sm border transition-colors ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600"}`}>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={
                    isFullscreen
                      ? "M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6"
                      : "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 15v3a2 2 0 0 0 2 2h3"
                  }></path>
              </svg>
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              className={`p-2.5 rounded-xl shadow-sm border transition-colors ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                  : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
              }`}>
              {isDarkMode ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" strokeWidth="2" />
                  <path
                    strokeLinecap="round"
                    strokeWidth="2"
                    d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div
          key={currentView === "home" ? "home" : activeEngine || "dashboard"}
          className="view-transition-container w-full">
          {currentView === "home" && homeSummary && (
            <GeneralOverviewView
              homeSummary={homeSummary}
              isDarkMode={isDarkMode}
              homeMomentumMetrics={homeMomentumMetrics}
              setHomeMomentumMetrics={setHomeMomentumMetrics}
              homeMomentumType={homeMomentumType}
              setHomeMomentumType={setHomeMomentumType}
            />
          )}

          {activeEngine === "media" && (
            <DigitalMediaView
              mediaKPIs={mediaKPIs}
              dashboardContext={dashboardContext}
              setDashboardContext={setDashboardContext}
              granularity={granularity}
              isDarkMode={isDarkMode}
              chartTypeEngine={chartTypeEngine}
              setChartTypeEngine={setChartTypeEngine}
              chartMetricsMedia={chartMetricsMedia}
              handleToggleMetric={handleToggleMetric}
              ctxCurData={ctxCurData}
              ctxPrevData={ctxPrevData}
              ctxChartData={ctxChartData}
              globalDates={globalDates}
              tableColFilter1={tableColFilter1}
              setTableColFilter1={setTableColFilter1}
              tableColFilter2={tableColFilter2}
              setTableColFilter2={setTableColFilter2}
            />
          )}

          {activeEngine === "commerce" && (
            <CommerceTrackerView
              commerceKPIs={commerceKPIs}
              dashboardContext={dashboardContext}
              setDashboardContext={setDashboardContext}
              granularity={granularity}
              isDarkMode={isDarkMode}
              chartTypeEngine={chartTypeEngine}
              setChartTypeEngine={setChartTypeEngine}
              chartMetricsComm={chartMetricsComm}
              handleToggleMetric={handleToggleMetric}
              ctxCurData={ctxCurData}
              ctxPrevData={ctxPrevData}
              ctxChartData={ctxChartData}
              cirCurData={cirCurData}
              cirPrevData={cirPrevData}
              globalDates={globalDates}
              tableColFilter1={tableColFilter1}
              setTableColFilter1={setTableColFilter1}
              tableColFilter2={tableColFilter2}
              setTableColFilter2={setTableColFilter2}
            />
          )}

          {activeEngine === "sku" && (
            <SkuPerformanceView
              ctxCurData={ctxCurData}
              isDarkMode={isDarkMode}
              filters={filters}
              onFilterChange={handleFilterChange}
              brandOptions={getDependentOptions(
                CONFIG.commerce.colBrand,
                "brand",
              )}
            />
          )}

          {activeEngine === "creative" && (
            <TopCreativeView
              creativeData={creativeData}
              isDarkMode={isDarkMode}
            />
          )}

          {activeEngine === "signal" && signalCompiled && (
            <MediaSignalView
              signalCompiled={signalCompiled}
              signalHierarchyGroups={signalHierarchyGroups}
              rawData={rawData}
              extraSheetsData={extraSheetsData}
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      </main>
    </div>
  );
}
