"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Connexion impossible.");
        return;
      }

      router.push(data.redirectTo);
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-blue-800">
          ICHA IMPORT
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Connexion commercial ou administrateur
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Identifiant
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          required
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Mot de passe / code personnel
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          required
        />

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-700 py-2.5 text-base font-medium text-white disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
