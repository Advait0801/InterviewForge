"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { getToken, clearToken } from "@/lib/auth";
import { api } from "@/lib/api";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/problems", label: "Practice" },
  { href: "/interview", label: "Interview" },
  { href: "/system-design", label: "System Design" },
  { href: "/assessments", label: "Assessments" },
  { href: "/paths", label: "Paths" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/analytics", label: "Analytics" },
];

export function Navbar() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const token = getToken();
    queueMicrotask(() => setIsAuthed(Boolean(token)));
    if (token) {
      api.me().then((r) => {
        setAvatarUrl(r.user.avatar_url);
        setUserName(r.user.name ?? r.user.username);
      }).catch(() => {});
    }
  }, []);
  
  useEffect(() => {
    queueMicrotask(() => setMobileOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const frame = requestAnimationFrame(() => firstMobileLinkRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const isActiveRoute = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const logout = () => {
    clearToken();
    setIsAuthed(false);
    window.location.assign("/login");
  };

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5 rounded-lg">
          <Logo size={30} decorative />
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            InterviewForge
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 min-[1320px]:flex">
          {navLinks.map((link) => {
            const isActive = isActiveRoute(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-text-primary/70 hover:text-text-primary"
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-2 -bottom-3 h-[2px] rounded-full bg-gradient-to-r from-primary to-secondary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
          <div className="ml-2 h-5 w-px bg-border" />
          <ThemeToggle />
          {isAuthed === true && (
            <Link href="/settings" className="ml-1 flex-shrink-0 rounded-full" aria-label="Account settings">
              <Avatar src={avatarUrl} name={userName} size="sm" />
            </Link>
          )}
          {isAuthed === true ? (
            <button
              className="rounded-xl border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-text-secondary transition hover:border-error/50 hover:text-error"
              onClick={logout}
              type="button"
            >
              Logout
            </button>
          ) : isAuthed === false ? (
            <Link
              href="/login"
              className="if-action-gradient rounded-xl px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Login
            </Link>
          ) : null}
        </nav>

        {/* Mobile hamburger */}
        <button
          ref={menuButtonRef}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/70 text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary min-[1320px]:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          type="button"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
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
            id="mobile-navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-background/95 shadow-xl backdrop-blur-xl min-[1320px]:hidden"
          >
            <nav aria-label="Mobile navigation" className="mx-auto grid w-full max-w-[1600px] gap-1 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:px-8">
              {navLinks.map((link, index) => {
                const isActive = isActiveRoute(link.href);
                return (
                  <Link
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3 sm:col-span-2">
                <ThemeToggle />
                {isAuthed === true ? (
                  <>
                    <Link
                      href="/settings"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <Avatar src={avatarUrl} name={userName} size="sm" />
                      Settings
                    </Link>
                    <button
                      className="rounded-xl border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:border-error/40 hover:text-error"
                      onClick={logout}
                      type="button"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link onClick={() => setMobileOpen(false)} href="/login" className="if-action-gradient rounded-xl px-4 py-2 text-sm font-medium text-white">
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
