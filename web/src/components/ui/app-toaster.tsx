"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster, toast } from "sonner";

export function AppToaster({ theme }: { theme: "light" | "dark" }) {
  const pathname = usePathname();
  const publicShare = pathname?.startsWith("/share/");
  useEffect(() => {
    if (publicShare) toast.dismiss();
  }, [publicShare]);
  if (publicShare) return null;
  return (
    <Toaster
      theme={theme}
      closeButton
      position="top-center"
      toastOptions={{
        style: {
          color: "var(--text-primary)",
          background: "var(--surface)",
          borderColor: "var(--border)",
        },
      }}
    />
  );
}
