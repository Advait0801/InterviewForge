"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex h-8 min-w-[88px] items-center justify-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-primary transition hover:border-primary"
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {!mounted ? (
        <span className="h-4 w-4" />
      ) : isDark ? (
        <svg className="h-4 w-4 text-amber-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 9 11.69 1 1 0 0 0-.36-1.05z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 18a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1zM5.64 5.64a1 1 0 0 1 1.41 0l.71.71a1 1 0 1 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41zm12.02 12.02a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 1 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41zM4 13H3a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2zm17 0h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2zM5.64 18.36a1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1-1.41 0zm12.02-12.02a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0z" />
        </svg>
      )}
      <span>{!mounted ? "" : isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
