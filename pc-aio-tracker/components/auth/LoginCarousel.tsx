"use client";
import React, { useEffect, useRef, useState } from "react";

const SLIDES = [
  "/login/slide-1.jpg",
  "/login/slide-2.jpg",
  "/login/slide-3.jpg",
  "/login/slide-4.jpg",
  "/login/slide-5.jpg",
];

const INTERVAL_MS = 2500;

export default function LoginCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);

  const go = (i: number) => setIndex((i + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(
      () => setIndex((p) => (p + 1) % SLIDES.length),
      INTERVAL_MS,
    );
    return () => clearTimeout(t);
  }, [index, paused]);

  return (
    <div
      className="absolute inset-0 select-none touch-pan-y"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}>
      {SLIDES.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}>
          {/* blurred fill so the whole poster can be shown without cropping */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-90"
          />
          <img
            src={src}
            alt="Wardah campaign visual"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain p-10 md:p-14 drop-shadow-2xl"
          />
        </div>
      ))}

      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(index - 1)}
        className="absolute left-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/55 text-white backdrop-blur-sm transition-colors">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(index + 1)}
        className="absolute right-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/55 text-white backdrop-blur-sm transition-colors">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <div className="absolute bottom-6 right-8 z-10 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => go(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
          />
        ))}
      </div>
    </div>
  );
}
