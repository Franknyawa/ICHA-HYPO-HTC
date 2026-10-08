// Identité visuelle SIRI IMPORT — dessinée en SVG pur (aucun fichier image à
// télécharger, donc rien à attendre au chargement de la page de connexion).
// Emblème : écu sombre cerclé d'or avec un monogramme "S" à double courbe.

export function SiriMark({
  size = 40,
  className,
  idSuffix = "a",
}: {
  size?: number;
  className?: string;
  /** Suffixe d'id des dégradés — à varier si plusieurs marques sur la même page */
  idSuffix?: string;
}) {
  const or = `siri-or-${idSuffix}`;
  const nuit = `siri-nuit-${idSuffix}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="SIRI IMPORT"
    >
      <defs>
        <linearGradient id={or} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3dc9b" />
          <stop offset="0.5" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#8f6b1f" />
        </linearGradient>
        <linearGradient id={nuit} x1="24" y1="2" x2="24" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14264d" />
          <stop offset="1" stopColor="#081124" />
        </linearGradient>
      </defs>
      {/* Écu */}
      <path
        d="M24 2.5 42.5 12v17.5c0 8-7.6 13.6-18.5 16.5C13.1 43.1 5.5 37.5 5.5 29.5V12Z"
        fill={`url(#${nuit})`}
        stroke={`url(#${or})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Filet intérieur */}
      <path
        d="M24 6.4 39 14v15.2c0 6.3-6.1 10.9-15 13.5-8.9-2.6-15-7.2-15-13.5V14Z"
        stroke={`url(#${or})`}
        strokeWidth="0.7"
        opacity="0.55"
        strokeLinejoin="round"
      />
      {/* Monogramme S */}
      <path
        d="M31 17.2c-1.3-2.6-4.1-3.9-7.3-3.9-4.2 0-7 2.2-7 5.4 0 3.2 2.6 4.4 7.3 5.5 4.9 1.1 7.5 2.5 7.5 6 0 3.4-3.2 5.7-7.6 5.7-3.6 0-6.5-1.5-7.9-4.4"
        stroke={`url(#${or})`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Icônes de familles de produits — tracés linéaires, une couleur (currentColor).
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconCereales(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path {...P} d="M12 21V10" />
      <path {...P} d="M12 4.2c-1.2 1.1-1.2 2.7 0 3.8 1.2-1.1 1.2-2.7 0-3.8Z" />
      <path {...P} d="M12 10.4c-2.6-.4-3.8-2.4-3.8-4.5 2.6.4 3.8 2.4 3.8 4.5Z" />
      <path {...P} d="M12 10.4c2.6-.4 3.8-2.4 3.8-4.5-2.6.4-3.8 2.4-3.8 4.5Z" />
      <path {...P} d="M12 15.6c-2.6-.4-3.8-2.4-3.8-4.5 2.6.4 3.8 2.4 3.8 4.5Z" />
      <path {...P} d="M12 15.6c2.6-.4 3.8-2.4 3.8-4.5-2.6.4-3.8 2.4-3.8 4.5Z" />
    </svg>
  );
}

export function IconHygiene(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        {...P}
        d="M7.5 3.8c-2.4 0-4 1.9-4 4.4 0 2.1 1 3.6 1.5 6 .4 2.1.8 6 2.6 6 1.6 0 1.5-3.8 3.4-3.8s1.8 3.8 3.4 3.8c1.8 0 2.2-3.9 2.6-6 .5-2.4 1.5-3.9 1.5-6 0-2.5-1.6-4.4-4-4.4-1.7 0-2.3.9-3.5.9S9.2 3.8 7.5 3.8Z"
      />
    </svg>
  );
}

export function IconEntretien(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path {...P} d="M12 3.2c3.4 4.4 6 7.4 6 10.8a6 6 0 0 1-12 0c0-3.4 2.6-6.4 6-10.8Z" />
      <path {...P} d="M9.2 14.4a2.9 2.9 0 0 0 2.4 2.5" />
    </svg>
  );
}

export function IconEpicerie(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path {...P} d="M5.5 6c0-1.1 2.9-2 6.5-2s6.5.9 6.5 2v12c0 1.1-2.9 2-6.5 2s-6.5-.9-6.5-2Z" />
      <path {...P} d="M5.5 6c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2" />
      <path {...P} d="M5.5 12c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2" />
    </svg>
  );
}
