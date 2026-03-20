"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    }
  }, [router]);

  if (!isAuthenticated()) {
    return <p className="text-sm text-text-secondary">Redirecting to login...</p>;
  }

  return <>{children}</>;
}
