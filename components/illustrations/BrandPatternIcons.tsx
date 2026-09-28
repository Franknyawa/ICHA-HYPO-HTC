// Icônes décoratives dessinées à la main (sachet + bouteille de javel)
// pour le motif de fond de la page de connexion — pas des photos, des
// silhouettes simples en une seule couleur, pensées pour être répétées
// en motif à faible opacité.

export function SachetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Corps du sachet, légèrement bombé */}
      <path
        d="M10 22 C10 16 14 12 20 12 H44 C50 12 54 16 54 22 V64 C54 71 49 76 42 76 H22 C15 76 10 71 10 64 Z"
        fill="currentColor"
      />
      {/* Zone de scellage thermique en haut */}
      <rect x="14" y="6" width="36" height="10" rx="3" fill="currentColor" opacity="0.55" />
      {/* Ligne de scellage */}
      <line x1="18" y1="11" x2="46" y2="11" stroke="white" strokeWidth="1.4" opacity="0.5" />
      {/* Reflet / pli du sachet */}
      <path d="M22 24 C22 40 22 56 22 68" stroke="white" strokeWidth="2" opacity="0.18" strokeLinecap="round" />
    </svg>
  );
}

export function BouteilleJavelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 88" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Bouchon */}
      <rect x="24" y="4" width="16" height="10" rx="2" fill="currentColor" />
      {/* Goulot */}
      <rect x="27" y="12" width="10" height="10" fill="currentColor" />
      {/* Épaules qui s'évasent vers le corps */}
      <path
        d="M27 22 H37 L48 34 V78 C48 82.5 44.5 86 40 86 H24 C19.5 86 16 82.5 16 78 V34 Z"
        fill="currentColor"
      />
      {/* Étiquette */}
      <rect x="21" y="46" width="22" height="24" rx="2" fill="white" opacity="0.4" />
      <line x1="25" y1="53" x2="39" y2="53" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
      <line x1="25" y1="58" x2="39" y2="58" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
      <line x1="25" y1="63" x2="35" y2="63" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
      {/* Reflet sur le corps */}
      <path d="M21 38 C21 52 21 66 21 78" stroke="white" strokeWidth="2" opacity="0.15" strokeLinecap="round" />
    </svg>
  );
}
