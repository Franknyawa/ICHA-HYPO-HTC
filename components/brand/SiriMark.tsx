// Identité visuelle ICHA IMPORT. `SiriMark` est conservé comme alias de
// l'emblème (voir IchaLogo.tsx) pour ne pas toucher aux imports existants.
import { IchaEmblem } from "./IchaLogo";

export function SiriMark({ size = 40, className }: { size?: number; className?: string; idSuffix?: string }) {
  return <IchaEmblem size={size} className={className} />;
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
