import React from "react";
import { useTheme } from "@/lib/useTheme";

interface WelcomeViewProps {
  onSelectHome: () => void;
  onSelectEngine: (
    engine: "media" | "commerce" | "creative" | "signal",
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

export default function WelcomeView({
  onSelectHome,
  onSelectEngine,
}: WelcomeViewProps) {
  const { isDark, toggle } = useTheme();

  const cardCls = `p-8 rounded-3xl transition-all group border hover:-translate-y-1 ${
    isDark
      ? "bg-[#102A2A] border-[#1D4442] hover:bg-[#163535] hover:border-[#2DB5AE]/50"
      : "bg-white border-[#D5E8E6] hover:bg-[#F4FAF9] hover:border-[#2FA3A5]/50 shadow-sm hover:shadow-md"
  }`;
  const titleCls = `text-xl font-bold mb-1 ${isDark ? "text-[#E6F4F2]" : "text-[#0F2A29]"}`;
  const descCls = `text-xs ${isDark ? "text-[#8FB0AD]" : "text-[#5B7573]"}`;

  return (
    <div
      className={`welcome-screen fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 font-sans transition-colors duration-300 ${isDark ? "bg-[#0B1F1F]" : "bg-[#F4FAF9]"}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? "bg-[#102A2A] text-[#67C7C6] hover:bg-[#163535]" : "bg-[#E6F4F2] text-[#006D77] hover:bg-[#d3ece8]"}`}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="max-w-4xl w-full text-center">
        <img
          src={isDark ? "/wardah-logo-white.png" : "/wardah-logo.png"}
          alt="Wardah"
          className="h-9 w-auto mx-auto mb-10"
        />
        <h1
          className={`text-[clamp(2.5rem,5vw,4rem)] font-black mb-4 tracking-tight ${isDark ? "text-white" : "text-[#00565F]"}`}>
          Welcome to All in One Dashboard
        </h1>
        <p
          className={`mb-16 text-[clamp(1rem,1.5vw,1.25rem)] font-medium ${isDark ? "text-[#8FB0AD]" : "text-[#5B7573]"}`}>
          Please select the tracker you wish to launch. You can navigate between
          them at any time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <button onClick={onSelectHome} className={cardCls}>
            <div className="w-14 h-14 mx-auto bg-[#00565F] text-white rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7"
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
            <div className="w-14 h-14 mx-auto bg-[#006D77] text-white rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7"
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
            <div className="w-14 h-14 mx-auto bg-[#2FA3A5] text-white rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7"
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
        </div>
      </div>
    </div>
  );
}
