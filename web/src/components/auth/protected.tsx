"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoadingState } from "@/components/ui/state-panel";

const subscribe = () => () => {};

export function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isAuthed = mounted && isAuthenticated();

  useEffect(() => {
    if (mounted && !isAuthed) {
      router.replace("/login");
    }
  }, [isAuthed, mounted, router]);

  if (!mounted) {
    return <LoadingState label="Checking your session…" className="min-h-screen bg-background" />;
  }

  if (!isAuthed) {
    return null;
  }

  return <>{children}</>;
}
