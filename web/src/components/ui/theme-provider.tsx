"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { Toaster } from "sonner";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "if-theme";

/**
 * The stored theme is external state, so it is read through
 * useSyncExternalStore rather than copied into React state inside an effect.
 *
 * The effect version worked, but it set state synchronously on mount, which
 * causes a cascading render (and a visible flash) on every page load. An
 * external store gives the same value with one render and no effect.
 */
const listeners = new Set<() => void>();
let cachedTheme: Theme | null = null;

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    // Private mode or blocked storage: fall back rather than throw.
    return "dark";
  }
}

function subscribeToTheme(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedTheme = null;
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getThemeSnapshot(): Theme {
  // Cached so the snapshot is referentially stable between calls in one render.
  if (cachedTheme === null) cachedTheme = readStoredTheme();
  return cachedTheme;
}

function getThemeServerSnapshot(): Theme {
  return "dark";
}

function writeStoredTheme(next: Theme) {
  cachedTheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable; the in-memory value still drives the UI */
  }
  listeners.forEach((listener) => listener());
}

/** True only after hydration, without a setState-in-effect. */
const noopSubscribe = () => () => {};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    writeStoredTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <ThemeContext.Provider value={{ theme, mounted, setTheme, toggleTheme }}>
      {children}
      <Toaster theme={theme} richColors closeButton position="top-center" />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
