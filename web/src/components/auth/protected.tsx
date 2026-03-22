"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "redirect">("loading");

  useEffect(() => {
    if (isAuthenticated()) {
      setStatus("ok");
    } else {
      setStatus("redirect");
      router.replace("/login");
    }
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "redirect") {
    return null;
  }

  return <>{children}</>;
}
