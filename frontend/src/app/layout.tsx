import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";

import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

export const metadata: Metadata = {
  title: "Bolão da Copa",
  description: "Bolão da Copa - frontend",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={nunito.className}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

