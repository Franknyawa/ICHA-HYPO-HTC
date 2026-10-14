"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Lock, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IchaLogo } from "@/components/brand/IchaLogo";
import { IconCereales, IconHygiene, IconEntretien, IconEpicerie } from "@/components/brand/SiriMark";

const FAMILLES = [
  { Icon: IconCereales, label: "Céréales" },
  { Icon: IconHygiene, label: "Hygiène" },
  { Icon: IconEntretien, label: "Entretien" },
  { Icon: IconEpicerie, label: "Épicerie" },
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
      {/* Panneau de marque — bleu profond, vert et rouge-orangé du logo */}
      <div
        className="relative flex shrink-0 items-center justify-center overflow-hidden px-6 py-10 md:w-[48%] md:py-0"
        style={{
          background:
            "radial-gradient(90% 70% at 90% 100%, rgba(53,153,128,0.45) 0%, rgba(53,153,128,0) 60%), radial-gradient(70% 50% at 0% 0%, rgba(255,52,8,0.20) 0%, rgba(255,52,8,0) 60%), linear-gradient(155deg, #1e3a8a 0%, #1d4ed8 60%, #1e40af 100%)",
        }}
      >
        {/* Grand cercle décoratif */}
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />

        <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
          <div className="siri-rise rounded-3xl bg-white px-8 py-6 shadow-2xl shadow-blue-950/40">
            <IchaLogo height={128} />
          </div>
          <div className="siri-rise siri-rise-2 my-6 flex w-40 items-center gap-2">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/60" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#ff3408]" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/60" />
          </div>
          <p className="siri-rise siri-rise-3 text-sm leading-relaxed text-blue-50/90">
            Suivi commercial terrain — recensement, réassort et performance de
            la force de vente, partout et en temps réel.
          </p>
          <ul className="siri-rise siri-rise-3 mt-8 hidden grid-cols-4 gap-4 md:grid">
            {FAMILLES.map(({ Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[#7fd6bf]">
                  <Icon width={22} height={22} />
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-blue-100/80">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="relative flex flex-1 items-center justify-center bg-white dark:bg-slate-950 px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-2 flex items-center gap-2 text-[#359980]">
            <ShieldCheck size={18} />
            <p className="text-xs font-bold uppercase tracking-widest">Espace sécurisé</p>
          </div>
          <h1
            className="mb-1 text-3xl font-semibold text-slate-900 dark:text-slate-100"
            
          >
            Connexion
          </h1>
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-base text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#359980] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#359980]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-[#359980]/25"
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-base text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#359980] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#359980]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-[#359980]/25"
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
            <p className="mb-5 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-alert dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold tracking-wide text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #2a8670, #359980)" }}
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
        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} ICHA IMPORT
          </p>
        </form>
      </div>
    </main>
  );
}
