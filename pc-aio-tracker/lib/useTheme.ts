import { useCallback, useEffect, useState } from "react";

const KEY = "wardah-theme";

// Tema (terang/gelap) untuk halaman login dan welcome.
// Pilihan disimpan di browser, dan aman kalau penyimpanan diblokir.
export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      setIsDark(window.localStorage.getItem(KEY) === "dark");
    } catch {
      /* abaikan */
    }
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? "dark" : "light");
      } catch {
        /* abaikan */
      }
      return next;
    });
  }, []);

  return { isDark, toggle };
}
