"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
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
