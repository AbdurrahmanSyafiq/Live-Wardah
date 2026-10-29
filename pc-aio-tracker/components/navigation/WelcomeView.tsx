import React, { useEffect, useState } from "react";
import { useTheme } from "@/lib/useTheme";

interface WelcomeViewProps {
  onSelectHome: () => void;
  onSelectEngine: (
    engine:
      | "media"
      | "commerce"
      | "creative"
      | "signal"
      | "competitor"
      | "creativeReport",
  ) => void;
}

const SunIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

const BG_SLIDES = [
  "/login/slide-1.jpg",
  "/login/slide-2.jpg",
  "/login/slide-3.jpg",
  "/login/slide-4.jpg",
  "/login/slide-5.jpg",
];

export default function WelcomeView({
  onSelectHome,
  onSelectEngine,
}: WelcomeViewProps) {
  const { isDark, toggle } = useTheme();

  const [bgIndex, setBgIndex] = useState(0);
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 11
        ? "Good morning"
        : h < 15
          ? "Good afternoon"
          : h < 19
            ? "Good evening"
            : "Good night",
    );
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setBgIndex((p) => (p + 1) % BG_SLIDES.length),
      6000,
    );
    return () => clearInterval(t);
  }, []);

  const cardCls = `w-full md:w-[calc((100%-4rem)/5)] p-5 rounded-2xl flex flex-col items-center justify-start transition-all group border backdrop-blur-xl hover:-translate-y-1 hover:shadow-2xl ${
    isDark
      ? "bg-black/25 border-white/15 hover:bg-black/40 hover:border-[#67C7C6]/60"
      : "bg-white/15 border-white/30 hover:bg-white/25 hover:border-white/60"
  }`;
  const titleCls = "text-base font-bold mb-1 text-white leading-tight";
  const descCls = "text-[11px] text-white/75 leading-snug";

  return (
    <div className="welcome-screen fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 font-sans overflow-y-auto bg-[#00404A]">
      {/* Background: slowly changing campaign visuals under a teal overlay */}
      <div className="fixed inset-0 pointer-events-none">
        {BG_SLIDES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 transition-opacity duration-[1500ms] ease-in-out"
            style={{ opacity: i === bgIndex ? 1 : 0 }}
          />
        ))}
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{
            background: isDark
              ? "linear-gradient(135deg, rgba(4,26,28,0.88) 0%, rgba(7,42,45,0.82) 100%)"
              : "linear-gradient(135deg, rgba(0,64,74,0.80) 0%, rgba(0,109,119,0.68) 60%, rgba(47,163,165,0.58) 100%)",
          }}
        />
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-white/15 text-white hover:bg-white/25 backdrop-blur-md border border-white/20">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="relative z-10 max-w-6xl w-full text-center my-auto py-6">
        <img
          src="/wardah-logo-white.png"
          alt="Wardah"
          className="h-9 w-auto mx-auto mb-10"
        />
        <p className="text-white/80 text-sm font-semibold tracking-[0.25em] uppercase mb-3">
          {greeting}
        </p>
        <h1 className="text-[clamp(1.9rem,3.6vw,3.1rem)] font-semibold mb-4 tracking-[0.04em] text-white drop-shadow-lg">
          Welcome to All in One Dashboard
        </h1>
        <p className="mb-14 text-[clamp(1rem,1.5vw,1.2rem)] font-medium text-white/85">
          Please select the tracker you wish to launch. You can navigate between
          them at any time.
        </p>
        <div className="flex flex-col md:flex-row md:flex-nowrap justify-center gap-4 text-center">
          <button onClick={onSelectHome} className={cardCls}>
            <div className="w-12 h-12 mx-auto bg-[#00565F] text-white rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12h18M3 6h18M3 18h18"></path>
              </svg>
            </div>
            <h2 className={titleCls}>General Overview</h2>
            <p className={descCls}>Cross-channel performance summary.</p>
          </button>

          <button onClick={() => onSelectEngine("media")} className={cardCls}>
            <div className="w-12 h-12 mx-auto bg-[#006D77] text-white rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h2 className={titleCls}>Digital Media</h2>
            <p className={descCls}>Full-funnel media metrics.</p>
          </button>

          <button
            onClick={() => onSelectEngine("commerce")}
            className={cardCls}>
            <div className="w-12 h-12 mx-auto bg-[#2FA3A5] text-white rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <h2 className={titleCls}>Commerce Tracker</h2>
            <p className={descCls}>Revenue and ROAS metrics.</p>
          </button>

          <button
            onClick={() => onSelectEngine("creativeReport")}
            className={cardCls}>
            <div className="w-12 h-12 mx-auto bg-[#D6657A] text-white rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h2 className={titleCls}>Creative Report</h2>
            <p className={descCls}>Creative performance breakdown.</p>
          </button>

          <button
            onClick={() => onSelectEngine("competitor")}
            className={cardCls}>
            <div className="w-12 h-12 mx-auto bg-[#5B7FA6] text-white rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h2 className={titleCls}>Competitor</h2>
            <p className={descCls}>Brand vs competitor benchmarks.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
