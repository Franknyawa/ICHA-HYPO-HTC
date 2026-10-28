import { TrendingDown, TrendingUp, Minus, CalendarCheck, Trophy, Boxes, PieChart } from "lucide-react";
import { getCartonsParJour, type CartonsJour } from "@/lib/queries/dashboard";
import { jourDouala } from "@/lib/utils/periode";
import { arrondiCartons, partsVente, texteDetail } from "@/lib/utils/cartons-equiv";

const fmt = (n: number) => (n === 0 ? "—" : Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
const fcfa = (n: number) => (n === 0 ? "—" : n.toLocaleString("fr-FR"));
const pct = (n: number) => `${String(n).replace(".", ",")} %`;

function libelleJour(j: string, aujourdhui: string) {
  const d = new Date(`${j}T12:00:00Z`);
  const txt = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return j === aujourdhui ? `Aujourd'hui · ${txt}` : txt;
}

function Puce({ icone: Icone, titre, valeur, sous, ton }: { icone: React.ElementType; titre: string; valeur: string; sous: string; ton: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ton}`}>
        <Icone size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titre}</p>
        <p className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-slate-100">{valeur}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sous}</p>
      </div>
    </div>
  );
}

/**
 * Ventes par jour (14 derniers jours) : cartons vendus en cartons, et sachets / filets vendus au détail (à l'unité),
 * par produit, avec la part de chacun. Aucune conversion de cartons en sachets.
 */
export async function CartonsParJourSection() {
  const lignes = await getCartonsParJour(14);
  const aujourdhui = jourDouala();
  const somme = (cle: keyof CartonsJour) => lignes.reduce((s, l) => s + (l[cle] as number), 0);
  const avecVentes = lignes.filter((l) => l.commandes > 0);
  const visibles = lignes.filter((l) => l.commandes > 0 || l.jour === aujourdhui);
  const masques = lignes.length - visibles.length;
  const volJour = (l: CartonsJour) => ({ gros: l.total, detailEq: l.detailEq, sd: l.detailSd, fd: l.detailFd });
  const volTotal = { gros: somme("total"), detailEq: somme("detailEq"), sd: somme("detailSd"), fd: somme("detailFd") };
  const partsTotal = partsVente(volTotal);
  const maxVol = Math.max(...lignes.map((l) => l.total + l.detailEq), 0.1);
  const meilleur = avecVentes.reduce<CartonsJour | null>((m, l) => (!m || l.total > m.total ? l : m), null);
  const moyenne = avecVentes.length ? somme("total") / avecVentes.length : 0;
  const auj = lignes[0];
  const hier = lignes[1];
  const ecart = auj && hier ? Math.round((auj.total - hier.total) * 10) / 10 : 0;
  const Fleche = ecart > 0 ? TrendingUp : ecart < 0 ? TrendingDown : Minus;

  const th = "px-2.5 py-2.5 text-right font-semibold";
  const td = "px-2.5 py-2.5 text-right tabular-nums";
  const unites = (sd: number, fd: number) => texteDetail({ sd, fd });

  return (
    <div>
      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#1e3a8a] dark:text-blue-300">Ventes par jour : cartons et détail</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Commandes validées chaque jour sur les 14 derniers jours. « Cartons » = vendus en cartons (demi-cartons compris) ; « Détail » = sachets et filets vendus à l&apos;unité.
      </p>

      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Puce
          icone={Boxes}
          titre="Total 14 jours"
          valeur={`${fmt(arrondiCartons(somme("total")))} cartons`}
          sous={`+ ${unites(volTotal.sd, volTotal.fd)} au détail · ${somme("commandes")} cmd`}
          ton="bg-blue-100 text-blue-700"
        />
        <Puce
          icone={PieChart}
          titre="Part cartons / détail"
          valeur={partsTotal ? `${pct(partsTotal.cartons)} / ${pct(partsTotal.detail)}` : "—"}
          sous="en volume vendu sur la période"
          ton="bg-amber-100 text-amber-700"
        />
        <Puce
          icone={Trophy}
          titre="Meilleur jour (cartons)"
          valeur={meilleur ? `${fmt(meilleur.total)} cartons` : "—"}
          sous={meilleur ? `${libelleJour(meilleur.jour, aujourdhui)} · moyenne ${fmt(Math.round(moyenne * 10) / 10)}/jour` : "Aucune vente"}
          ton="bg-teal-100 text-teal-700"
        />
        <Puce
          icone={Fleche}
          titre="Aujourd'hui vs hier"
          valeur={`${ecart > 0 ? "+" : ""}${String(ecart).replace(".", ",")} cartons`}
          sous={`${fmt(auj?.total ?? 0)} aujourd'hui · ${fmt(hier?.total ?? 0)} hier`}
          ton={ecart > 0 ? "bg-emerald-100 text-emerald-700" : ecart < 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Jour</th>
              <th className="px-2.5 py-2.5 text-left font-semibold">
                Cartons / détail{" "}
                <span className="ml-1 inline-flex items-center gap-1 font-normal">
                  <span className="h-2 w-2 rounded-sm bg-blue-600" /> cartons
                  <span className="ml-1 h-2 w-2 rounded-sm bg-amber-400" /> détail
                </span>
              </th>
              <th className={`${th} bg-blue-50/70 text-blue-800 dark:bg-blue-950/20`}>
                HYPO<span className="block text-[10px] font-normal">cartons · détail</span>
              </th>
              <th className={`${th} bg-teal-50/70 text-teal-800 dark:bg-teal-950/20`}>
                HTC<span className="block text-[10px] font-normal">cartons · détail</span>
              </th>
              <th className={th}>
                Total cartons<span className="block text-[10px] font-normal">vendus en cartons</span>
              </th>
              <th className={th}>
                Total détail<span className="block text-[10px] font-normal">à l&apos;unité</span>
              </th>
              <th className={th}>Cmd</th>
              <th className={th}>
                Facturé<span className="block text-[10px] font-normal">FCFA</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibles.map((l) => {
              const estAuj = l.jour === aujourdhui;
              const p = partsVente(volJour(l));
              const largeur = ((l.total + l.detailEq) / maxVol) * 100;
              return (
                <tr key={l.jour} className={estAuj ? "bg-amber-50/60 dark:bg-slate-800/40" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-left font-medium text-slate-700 dark:text-slate-200">{libelleJour(l.jour, aujourdhui)}</td>
                  <td className="w-56 px-2.5 py-2.5">
                    {p ? (
                      <>
                        <span className="block h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" style={{ width: `${Math.max(10, largeur)}%` }}>
                          <span className="flex h-full">
                            <span className="h-full bg-blue-600" style={{ width: `${p.cartons}%` }} />
                            <span className="h-full flex-1 bg-amber-400" />
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[10px] text-slate-400">
                          {pct(p.cartons)} cartons · {pct(p.detail)} détail
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className={`${td} bg-blue-50/40 dark:bg-blue-950/10`}>
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">{fmt(l.hypo)}</span>
                    <span className="block text-[11px] text-slate-400">{l.hypoSd + l.hypoFd > 0 ? `+ ${unites(l.hypoSd, l.hypoFd)}` : "pas de détail"}</span>
                  </td>
                  <td className={`${td} bg-teal-50/40 dark:bg-teal-950/10`}>
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">{fmt(l.htc)}</span>
                    <span className="block text-[11px] text-slate-400">{l.htcSd + l.htcFd > 0 ? `+ ${unites(l.htcSd, l.htcFd)}` : "pas de détail"}</span>
                  </td>
                  <td className={`${td} text-sm font-bold text-slate-900 dark:text-slate-100`}>{fmt(l.total)}</td>
                  <td className={`${td} text-slate-600 dark:text-slate-300`}>{unites(l.detailSd, l.detailFd)}</td>
                  <td className={td}>{l.commandes || "—"}</td>
                  <td className={td}>{fcfa(l.montant)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800/60">
            <tr>
              <td className="px-3 py-3 text-left" colSpan={2}>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarCheck size={14} /> Total 14 jours
                  {partsTotal && <span className="ml-2 text-[11px] font-normal text-slate-500">{pct(partsTotal.cartons)} cartons · {pct(partsTotal.detail)} détail</span>}
                </span>
              </td>
              <td className={td}>
                {fmt(arrondiCartons(somme("hypo")))}
                <span className="block text-[11px] font-normal text-slate-500">{unites(somme("hypoSd"), somme("hypoFd"))}</span>
              </td>
              <td className={td}>
                {fmt(arrondiCartons(somme("htc")))}
                <span className="block text-[11px] font-normal text-slate-500">{unites(somme("htcSd"), somme("htcFd"))}</span>
              </td>
              <td className={td}>{fmt(arrondiCartons(somme("total")))}</td>
              <td className={td}>{unites(volTotal.sd, volTotal.fd)}</td>
              <td className={td}>{somme("commandes")}</td>
              <td className={td}>{fcfa(somme("montant"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {masques > 0 && <p className="mt-2 text-[11px] text-slate-400">{masques} jour{masques > 1 ? "s" : ""} sans vente non affiché{masques > 1 ? "s" : ""}.</p>}
    </div>
  );
}

export function CartonsParJourSkeleton() {
  return <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />;
}
