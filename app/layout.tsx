import type { Metadata } from "next";
import "./globals.css";
import { PwaSetup } from "@/components/PwaSetup";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "SIRI IMPORT — Suivi commercial terrain",
  description: "Plateforme de suivi commercial terrain SIRI IMPORT",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SIRI IMPORT",
  },
};

export const viewport = {
  themeColor: "#0a1630",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Doit s'exécuter avant le premier rendu pour éviter un flash de
            thème incorrect — voir components/ThemeProvider.tsx */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          {children}
          <PwaSetup />
        </ThemeProvider>
      </body>
    </html>
  );
}
