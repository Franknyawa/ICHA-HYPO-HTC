import { OfflineManager } from "@/components/commercial/OfflineManager";

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
