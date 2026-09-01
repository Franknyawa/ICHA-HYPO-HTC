import type { Metadata } from "next";
import "./globals.css";
import { PwaSetup } from "@/components/PwaSetup";

export const metadata: Metadata = {
  title: "ICHA IMPORT — HYPO/HTC",
  description: "Plateforme de suivi commercial terrain ICHA IMPORT",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
