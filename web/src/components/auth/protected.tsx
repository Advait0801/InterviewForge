"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthed] = useState<boolean>(() => isAuthenticated());

  useEffect(() => {
    if (!isAuthed) {
      router.replace("/login");
    }
  }, [isAuthed, router]);

  if (!isAuthed) {
    return null;
  }

  return <>{children}</>;
}
