// Logo ICHA IMPORT redessiné en SVG pur (net à toute taille, aucun fichier image).
// Couleurs du logo d'origine : rouge-orangé #ff3408 et vert #359980.

export const ICHA_ROUGE = "#ff3408";
export const ICHA_VERT = "#359980";

const BOUTEILLE =
  "M15 38h8v22c0 5 9 9 9 18v34c0 4-3 7-7 7H13c-4 0-7-3-7-7V78c0-9 9-13 9-18Z";
const AVION_CORPS = "M0 22 62 14c9-1 16 2 17 7s-6 9-15 10L36 34 22 44h-7l5-12-14 2-6 8H-3l3-12Z";
const AVION_AILE = "M30 18 20 2h7l24 14Z";

/** Logo complet : ICHA (bouteille en guise de I), avion, IMPORT. */
export function IchaLogo({
  height = 80,
  className,
  monochrome,
}: {
  height?: number;
  className?: string;
  /** Une seule couleur (ex. "#fff") pour les fonds sombres */
  monochrome?: string;
}) {
  const rouge = monochrome ?? ICHA_ROUGE;
  const vert = monochrome ?? ICHA_VERT;
  return (
    <svg
      viewBox="0 0 232 176"
      height={height}
      width={(height * 232) / 176}
      className={className}
      role="img"
      aria-label="ICHA IMPORT"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="14" y="30" width="10" height="6" rx="1.5" fill={rouge} />
      <path d={BOUTEILLE} fill={rouge} />
      <g fill="none" stroke={rouge} strokeWidth="14">
        <path d="M100 68A29 29 0 1 0 100 108" />
        <path d="M123 58v60M154 58v60M123 88h31" />
        <path d="M170 118 188 58 206 118M176 100h24" strokeLinejoin="miter" strokeMiterlimit="10" />
      </g>
      <path d="M52 36c9-12 22-14 34-8" fill="none" stroke={rouge} strokeWidth="5" strokeLinecap="round" />
      <g fill={vert} transform="translate(146 4) scale(.8) rotate(-14 40 20)">
        <path d={AVION_CORPS} />
        <path d={AVION_AILE} />
      </g>
      <text
        x="48"
        y="152"
        fontFamily="Poppins, Montserrat, Arial, Helvetica, sans-serif"
        fontWeight={900}
        fontSize="31"
        fill={vert}
        textLength="152"
        lengthAdjust="spacing"
      >
        IMPORT
      </text>
    </svg>
  );
}

/** Emblème compact (carré blanc, bouteille + avion) pour en-têtes et icônes. */
export function IchaEmblem({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="ICHA IMPORT"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="11" fill="#fff" />
      <g transform="translate(8 -1.5) scale(.34)">
        <rect x="14" y="30" width="10" height="6" rx="1.5" fill={ICHA_ROUGE} />
        <path d={BOUTEILLE} fill={ICHA_ROUGE} />
      </g>
      <g fill={ICHA_VERT} transform="translate(20 10) scale(.27) rotate(-14 40 20)">
        <path d={AVION_CORPS} />
        <path d={AVION_AILE} />
      </g>
    </svg>
  );
}
