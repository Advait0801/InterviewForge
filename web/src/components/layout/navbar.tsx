"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { getToken, clearToken } from "@/lib/auth";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/problems", label: "Practice" },
  { href: "/interview", label: "Interview" },
  { href: "/system-design", label: "System Design" },
];

export function Navbar() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsAuthed(Boolean(getToken()));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo size={30} />
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            InterviewForge
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-text-primary/70 hover:text-text-primary"
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-1 -bottom-3 h-[2px] rounded-full bg-gradient-to-r from-primary to-secondary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
          <div className="ml-2 h-5 w-px bg-border" />
          <ThemeToggle />
          {isAuthed === true && (
            <Link
              href="/settings"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === "/settings" ? "text-primary" : "text-text-primary/70 hover:text-text-primary"
              }`}
            >
              Settings
            </Link>
          )}
          {isAuthed === true ? (
            <button
              className="rounded-xl border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-text-secondary transition hover:border-error/50 hover:text-error"
              onClick={() => {
                clearToken();
                setIsAuthed(false);
                window.location.href = "/login";
              }}
              type="button"
            >
              Logout
            </button>
          ) : isAuthed === false ? (
            <Link
              href="/login"
              className="rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Login
            </Link>
          ) : null}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:text-text-primary md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          type="button"
          aria-label="Toggle menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            {mobileOpen ? (
              <path d="M4 4L14 14M4 14L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <>
                <path d="M2 4.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 9H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 13.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <nav className="flex flex-col gap-1 px-4 py-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    pathname === link.href ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthed === true && (
                <Link
                  href="/settings"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-hover"
                >
                  Settings
                </Link>
              )}
              <div className="mt-2 flex items-center gap-2">
                <ThemeToggle />
                {isAuthed === true ? (
                  <button
                    className="rounded-xl border border-border px-3 py-1.5 text-sm text-text-secondary"
                    onClick={() => {
                      clearToken();
                      setIsAuthed(false);
                      window.location.href = "/login";
                    }}
                    type="button"
                  >
                    Logout
                  </button>
                ) : (
                  <Link href="/login" className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white">
                    Login
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
