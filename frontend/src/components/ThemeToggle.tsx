"use client";

import { FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return <div className="h-10 w-10 rounded-xl border border-duo-border bg-duo-card" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-duo-border bg-duo-card text-duo-ink shadow-sm transition hover:border-duo-green/40 hover:bg-duo-card/80"
      aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
      title={theme === "light" ? "Tema escuro" : "Tema claro"}
    >
      {theme === "light" ? <FaMoon className="h-4 w-4" /> : <FaSun className="h-4 w-4 text-amber-300" />}
    </button>
  );
}
