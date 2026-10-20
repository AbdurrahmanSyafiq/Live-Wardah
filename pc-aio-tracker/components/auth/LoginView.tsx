import React, { useState } from "react";
import { useTheme } from "@/lib/useTheme";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

// Pola daun tipis di atas gradien (hampir tidak terlihat, hanya memberi nuansa "beauty")
const LeafPattern = () => (
  <svg
    className="absolute inset-0 w-full h-full opacity-[0.09] pointer-events-none"
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern
        id="wardah-leaf"
        width="120"
        height="120"
        patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round">
          <path d="M20 70 C28 38, 58 28, 78 32 C74 58, 50 78, 20 70 Z" />
          <path d="M20 70 C38 58, 54 46, 70 36" />
          <path d="M84 104 C88 90, 100 82, 112 82 C112 96, 100 106, 84 104 Z" />
          <path d="M84 104 C94 98, 102 92, 108 86" />
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wardah-leaf)" />
  </svg>
);

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

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [loginError, setLoginError] = useState("");
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const { isDark, toggle } = useTheme();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError("");
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password }),
      });
      const result = await res.json();
      if (result.success) {
        setIsLoginSuccess(true);
        setTimeout(() => {
          onLoginSuccess();
          setIsLoginSuccess(false);
        }, 1200);
      } else {
        setLoginError(result.error || "Incorrect username or password.");
      }
    } catch {
      setLoginError("Server communication failed.");
    }
  };

  const inputCls = `peer w-full bg-transparent border-b-2 font-bold py-3 outline-none transition-colors placeholder-transparent ${
    isDark
      ? "border-[#1F5559] text-[#E6F4F2] focus:border-[#67C7C6]"
      : "border-[#D5E8E6] text-[#0F2A29] focus:border-[#006D77]"
  }`;
  const labelCls = `absolute left-0 top-3 font-semibold text-sm transition-all peer-focus:-top-4 peer-focus:text-xs cursor-text pointer-events-none peer-valid:-top-4 peer-valid:text-xs ${
    isDark
      ? "text-[#8FB0AD] peer-focus:text-[#67C7C6] peer-valid:text-[#8FB0AD]"
      : "text-[#5B7573] peer-focus:text-[#006D77] peer-valid:text-[#5B7573]"
  }`;

  return (
    <div
      className={`flex w-full h-screen font-sans overflow-hidden transition-colors duration-300 ${isDark ? "bg-[#0B3236]" : "bg-white"}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
      />

      {/* Panel gambar: gradien warna Wardah */}
      <div className="hidden md:block w-[60%] h-full relative overflow-hidden">
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: isDark
              ? "linear-gradient(135deg, #072A2D 0%, #0B2F2E 50%, #0A2423 100%)"
              : "linear-gradient(135deg, #00565F 0%, #006D77 50%, #4DC0BE 100%)",
          }}
        />
        <div
          className="fluid-blob-1 absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full opacity-90 mix-blend-screen pointer-events-none"
          style={{
            background: isDark
              ? "radial-gradient(circle, #2DB5AE 0%, #006D77 45%, transparent 70%)"
              : "radial-gradient(circle, #7FE3D8 0%, #3CC1B8 45%, transparent 70%)",
            filter: "blur(75px)",
          }}
        />
        <div
          className="fluid-blob-2 absolute -bottom-32 -right-20 w-[600px] h-[600px] rounded-full opacity-90 mix-blend-screen pointer-events-none"
          style={{
            background: isDark
              ? "radial-gradient(circle, #00565F 0%, #0B3B39 50%, transparent 75%)"
              : "radial-gradient(circle, #00565F 0%, #0B4A47 50%, transparent 75%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="fluid-blob-3 absolute top-1/3 left-1/4 w-[480px] h-[480px] rounded-full opacity-60 mix-blend-screen pointer-events-none"
          style={{
            background: isDark
              ? "radial-gradient(circle, #8FD9CF 0%, #1D6F6B 55%, transparent 75%)"
              : "radial-gradient(circle, #CFF3EE 0%, #6FCFC6 55%, transparent 75%)",
            filter: "blur(90px)",
          }}
        />
        {/* sorotan emas sangat halus, sebagai sentuhan hangat */}
        <div
          className="absolute bottom-10 left-10 w-[260px] h-[260px] rounded-full opacity-25 mix-blend-screen pointer-events-none"
          style={{
            background: "radial-gradient(circle, #F2B233 0%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />
        <LeafPattern />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/15 pointer-events-none" />

        <div className="absolute top-10 left-12 z-10">
          <img
            src="/wardah-logo-white.png"
            alt="Wardah"
            className="h-9 w-auto"
          />
        </div>
        <div className="absolute bottom-10 left-12 z-10">
          <p className="text-white/90 text-sm font-semibold tracking-wide">
            All in One Dashboard
          </p>
          <p className="text-white/60 text-xs mt-1">
            Digital &amp; commerce performance in one place.
          </p>
        </div>
      </div>

      {/* Panel form */}
      <div
        className={`w-full md:w-[40%] flex flex-col justify-center px-12 lg:px-20 relative z-20 transition-colors duration-300 ${isDark ? "bg-[#0B3236]" : "bg-white"}`}>
        <button
          type="button"
          onClick={toggle}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? "bg-[#124246] text-[#67C7C6] hover:bg-[#163535]" : "bg-[#E6F4F2] text-[#006D77] hover:bg-[#d3ece8]"}`}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        {isLoginSuccess ? (
          <div className="flex flex-col items-center justify-center animate-enter text-center">
            <svg
              className={`w-20 h-20 mb-6 ${isDark ? "text-[#67C7C6]" : "text-[#006D77]"}`}
              viewBox="0 0 52 52"
              fill="none">
              <circle
                cx="26"
                cy="26"
                r="25"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                className="checkmark-path"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.1 27.2l7.1 7.2 16.7-16.8"
              />
            </svg>
            <h2
              className={`text-2xl font-black ${isDark ? "text-[#E6F4F2]" : "text-[#0F2A29]"}`}>
              Success
            </h2>
            <p
              className={`font-medium ${isDark ? "text-[#8FB0AD]" : "text-[#5B7573]"}`}>
              Loading workspace...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm mx-auto animate-enter">
            <img
              src={isDark ? "/wardah-logo-white.png" : "/wardah-logo.png"}
              alt="Wardah"
              className="h-8 w-auto mb-10 md:hidden"
            />
            <h2
              className={`whitespace-nowrap text-[clamp(1.5rem,2.4vw,2.4rem)] font-semibold tracking-[0.06em] mb-2 ${isDark ? "text-[#E6F4F2]" : "text-[#0F2A29]"}`}>
              Welcome Back
            </h2>
            <p
              className={`text-sm font-medium mb-12 ${isDark ? "text-[#8FB0AD]" : "text-[#5B7573]"}`}>
              Enter your credentials to continue.
            </p>

            <form onSubmit={handleLogin} className="space-y-8">
              <div className="relative group">
                <input
                  name="username"
                  type="text"
                  required
                  placeholder=" "
                  className={inputCls}
                />
                <label className={labelCls}>Username</label>
              </div>
              <div className="relative group">
                <input
                  name="password"
                  type="password"
                  required
                  placeholder=" "
                  className={inputCls}
                />
                <label className={labelCls}>Password</label>
              </div>

              {loginError && (
                <div className="text-rose-500 text-xs font-bold">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#006D77] hover:bg-[#00565F] text-white font-bold py-4 rounded-full transition-colors mt-8 text-sm">
                Continue
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
