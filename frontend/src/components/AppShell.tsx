"use client";

import type { PropsWithChildren } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-duo-green/10 blur-3xl dark:bg-duo-green/5" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/5" />
      </div>

      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative px-4 py-10 pt-16">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </div>
  );
}
