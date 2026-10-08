"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaSetup() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // Échec silencieux : l'app reste utilisable en ligne, seul le
        // fonctionnement "ouverture hors-ligne" est dégradé.
      });
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent || installed) return null;

  return (
    <button
      onClick={async () => {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
        setInstallEvent(null);
      }}
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#c9a24b]/60 bg-[#0a1630] px-5 py-2.5 text-sm font-medium text-[#f3dc9b] shadow-lg"
    >
      <Download size={16} />
      Installer l'application
    </button>
  );
}
