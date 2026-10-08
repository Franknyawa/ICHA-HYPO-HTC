"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { clearOfflineCaches } from "@/lib/offline/db";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (!navigator.onLine) {
      // Hors ligne, la session ne peut pas être fermée côté serveur : on le dit
      // plutôt que de faire croire à une déconnexion.
      window.alert("Déconnexion impossible hors ligne. Reconnecte-toi à internet puis réessaie.");
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      setLoading(false);
      return;
    }
    // Rien d'un utilisateur ne doit rester sur le téléphone : pages et données
    // de référence effacées. Les visites en attente, elles, sont conservées
    // (et ne partiront que sous le compte qui les a saisies).
    await clearOfflineCaches();
    const sw = await navigator.serviceWorker?.getRegistration();
    sw?.active?.postMessage({ type: "VIDER_PAGES" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={
        className ??
        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
      }
    >
      <LogOut size={18} />
      {loading ? "..." : "Déconnexion"}
    </button>
  );
}
