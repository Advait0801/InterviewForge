"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getToken, clearToken } from "@/lib/auth";

export function Navbar() {
  const isAuthed = Boolean(getToken());

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-text-primary">
          InterviewForge
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-text-secondary hover:text-text-primary">
            Dashboard
          </Link>
          <Link href="/problems" className="text-sm text-text-secondary hover:text-text-primary">
            Practice
          </Link>
          <Link href="/interview" className="text-sm text-text-secondary hover:text-text-primary">
            Interview
          </Link>
          <ThemeToggle />
          {isAuthed ? (
            <button
              className="rounded-xl border border-border px-3 py-1 text-sm"
              onClick={() => {
                clearToken();
                window.location.href = "/login";
              }}
              type="button"
            >
              Logout
            </button>
          ) : (
            <Link href="/login" className="rounded-xl border border-border px-3 py-1 text-sm">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
