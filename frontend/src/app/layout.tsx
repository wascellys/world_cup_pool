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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://front-production-685e.up.railway.app";
const previewImage = "/FIFA-2026.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Bolão da Copa",
  description: "Bolão da Copa do Mundo",
  openGraph: {
    title: "Bolão da Copa",
    description: "Bolão da Copa do Mundo",
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: "Bolão da Copa do Mundo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bolão da Copa",
    description: "Bolão da Copa do Mundo",
    images: [previewImage],
  },
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
