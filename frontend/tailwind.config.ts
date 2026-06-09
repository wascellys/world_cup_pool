import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        duo: {
          green: "#22c55e",
          greenDark: "#16a34a",
          blue: "#38bdf8",
          ink: "var(--duo-ink)",
          muted: "var(--duo-muted)",
          bg: "var(--duo-bg)",
          card: "var(--duo-card)",
          border: "var(--duo-border)",
          accent: "var(--duo-accent)",
        },
      },
      boxShadow: {
        duo: "var(--duo-shadow)",
        duoSm: "var(--duo-shadow-sm)",
        glow: "0 0 24px rgba(34, 197, 94, 0.15)",
      },
      borderRadius: {
        duo: "16px",
      },
      animation: {
        "toast-in": "toast-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateX(1.5rem) scale(0.96)" },
          to: { opacity: "1", transform: "translateX(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
