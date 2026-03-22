import { Navbar } from "./navbar";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary bg-grid">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
