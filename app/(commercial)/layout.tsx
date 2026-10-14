import type { Metadata } from "next";
import { OfflineManager } from "@/components/commercial/OfflineManager";

// Icône et manifest propres à l'application commerciale (logo sur fond bleu,
// mention « Terrain ») : l'installation depuis l'espace terrain donne cette
// icône, l'admin garde l'icône générale.
export const metadata: Metadata = {
  manifest: "/manifest-commercial.json",
  icons: {
    icon: "/icons/icon-commercial-192.png",
    apple: "/apple-touch-icon-commercial.png",
  },
};

// Tout l'espace terrain : synchronisation + copies locales + bandeau d'état
// hors ligne, présents sur chaque écran sans que les pages aient à s'en occuper.
export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineManager />
      {children}
    </>
  );
}
