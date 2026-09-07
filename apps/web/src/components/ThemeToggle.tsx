"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export const THEME_KEY = "unbound-theme";

// Nothing is stored until someone picks a theme; until then the CSS follows
// the OS via prefers-color-scheme.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read after mount: the server cannot know, and the inline script in
  // layout.tsx has already applied the theme by now.
  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  // Keep following the OS while no explicit choice has been stored.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(THEME_KEY);
      } catch {
        // Blocked storage; treat as no preference.
      }
      if (!stored) setTheme(e.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page view only.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme ? `Switch to ${isDark ? "light" : "dark"} mode` : "Switch colour theme"}
      aria-pressed={theme ? isDark : undefined}
    >
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true"
        style={{ opacity: theme ? 1 : 0 }}
      >
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}
