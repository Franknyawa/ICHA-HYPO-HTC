"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, User, Lock, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SachetIcon, BouteilleJavelIcon } from "@/components/illustrations/BrandPatternIcons";

// Motif de fond du panneau de marque — sachets et bouteilles dispersés
// avec des tailles, rotations et opacités variées pour un rendu organique
// plutôt qu'un pavage répétitif trop mécanique.
const MOTIF_ICONES = [
  { Icon: SachetIcon, top: "4%", left: "8%", size: 56, rotate: -12, opacity: 0.14 },
  { Icon: BouteilleJavelIcon, top: "12%", left: "72%", size: 70, rotate: 10, opacity: 0.16 },
  { Icon: SachetIcon, top: "28%", left: "42%", size: 44, rotate: 6, opacity: 0.12 },
  { Icon: BouteilleJavelIcon, top: "40%", left: "12%", size: 60, rotate: -8, opacity: 0.14 },
  { Icon: SachetIcon, top: "55%", left: "78%", size: 50, rotate: 18, opacity: 0.13 },
  { Icon: BouteilleJavelIcon, top: "68%", left: "34%", size: 66, rotate: -14, opacity: 0.15 },
  { Icon: SachetIcon, top: "80%", left: "6%", size: 48, rotate: 10, opacity: 0.12 },
  { Icon: BouteilleJavelIcon, top: "85%", left: "62%", size: 58, rotate: -6, opacity: 0.14 },
  { Icon: SachetIcon, top: "18%", left: "58%", size: 38, rotate: -20, opacity: 0.1 },
  { Icon: BouteilleJavelIcon, top: "48%", left: "90%", size: 46, rotate: 14, opacity: 0.11 },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* Panneau de marque */}
      <div
        className="relative flex shrink-0 items-center justify-center overflow-hidden px-6 py-12 md:w-[46%] md:py-0"
        style={{ background: "linear-gradient(155deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)" }}
      >
        {/* Motif décoratif de sachets/bouteilles, dispersé */}
        <div className="pointer-events-none absolute inset-0">
          {MOTIF_ICONES.map(({ Icon, top, left, size, rotate, opacity }, i) => (
            <Icon
              key={i}
              className="absolute text-white"
              style={{
                top,
                left,
                width: size,
                height: size,
                opacity,
                transform: `rotate(${rotate}deg)`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
          <div className="mb-6 rounded-2xl bg-white/95 px-8 py-6 shadow-lg backdrop-blur">
            <Image
              src="/brand/logo-hypo.png"
              alt="Hypo"
              width={240}
              height={133}
              priority
              className="h-auto w-full max-w-[220px]"
            />
          </div>
          <p className="text-lg font-bold text-white">HYPO / HTC — ICHA IMPORT</p>
          <p className="mt-2 text-sm leading-relaxed text-blue-100">
            Plateforme de suivi commercial terrain — recensement, réassort et
            performance de la force de vente, en temps réel.
          </p>
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="relative flex flex-1 items-center justify-center bg-white dark:bg-slate-950 px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-2 flex items-center gap-2 text-brand dark:text-blue-400">
            <ShieldCheck size={18} />
            <p className="text-xs font-bold uppercase tracking-widest">Espace sécurisé</p>
          </div>
          <h1 className="mb-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">Connexion</h1>
          <p className="mb-7 text-sm text-slate-500 dark:text-slate-400">
            Commercial ou administrateur — utilise tes identifiants habituels.
          </p>

          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Identifiant
          </label>
          <div className="relative mb-4">
            <User
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Ton identifiant"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-base text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-blue-950"
              required
            />
          </div>

          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Mot de passe / code personnel
          </label>
          <div className="relative mb-5">
            <Lock
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-base text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-blue-950"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="mb-5 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white shadow-sm transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)" }}
          >
            {loading ? (
              <>
                <Spinner size={18} />
                Connexion...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
