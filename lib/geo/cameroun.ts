// Liste FIXE des régions et villes du Cameroun utilisées par l'application.
// Les villes ne se gèrent plus en back office : pour en ajouter une, on la
// déclare ici (elle est ensuite créée automatiquement en base).
// Coordonnées approximatives (centre-ville) : elles servent à deviner la
// ville du commercial à partir de sa position GPS.

type VilleDef = [nom: string, lat: number, lng: number];

const DEFINITION: Record<string, VilleDef[]> = {
  Littoral: [
    ["Douala", 4.0483, 9.7043], ["Edéa", 3.8, 10.1333], ["Nkongsamba", 4.9547, 9.9404], ["Loum", 4.7184, 9.7351],
    ["Mbanga", 4.5, 9.5667], ["Manjo", 4.8392, 9.8207], ["Penja", 4.6333, 9.6833], ["Dibombari", 4.1833, 9.6667],
  ],
  Centre: [
    ["Yaoundé", 3.848, 11.5021], ["Mbalmayo", 3.5167, 11.5], ["Obala", 4.1667, 11.5333], ["Bafia", 4.75, 11.2333],
    ["Mfou", 3.7167, 11.6333], ["Akonolinga", 3.7667, 12.25], ["Eséka", 3.65, 10.7667], ["Ntui", 4.45, 11.6167],
    ["Nanga-Eboko", 4.6833, 12.3667],
  ],
  Ouest: [
    ["Bafoussam", 5.4737, 10.4176], ["Dschang", 5.4439, 10.0533], ["Mbouda", 5.6264, 10.2547], ["Bafang", 5.1578, 10.1786],
    ["Foumban", 5.7267, 10.9], ["Bangangté", 5.1467, 10.5214], ["Baham", 5.3, 10.4],
  ],
  "Sud-Ouest": [
    ["Buea", 4.156, 9.2632], ["Limbé", 4.0227, 9.2042], ["Kumba", 4.6363, 9.4469], ["Tiko", 4.0753, 9.36],
    ["Mutengene", 4.0917, 9.3167], ["Muyuka", 4.2833, 9.4], ["Mamfé", 5.7667, 9.2833], ["Idenau", 4.0, 8.99],
  ],
  "Nord-Ouest": [
    ["Bamenda", 5.9597, 10.146], ["Kumbo", 6.2, 10.6833], ["Wum", 6.3833, 10.0667], ["Mbengwi", 6.0167, 10.0],
    ["Ndop", 6.0, 10.4333],
  ],
  Sud: [
    ["Kribi", 2.9394, 9.9095], ["Ebolowa", 2.9, 11.15], ["Sangmélima", 2.9333, 11.9833], ["Ambam", 2.3833, 11.2833],
    ["Campo", 2.3667, 9.8167],
  ],
  Est: [
    ["Bertoua", 4.5833, 13.6833], ["Batouri", 4.4333, 14.3667], ["Abong-Mbang", 3.9833, 13.1833],
    ["Yokadouma", 3.5167, 15.05], ["Garoua-Boulaï", 5.8833, 14.55],
  ],
  Adamaoua: [
    ["Ngaoundéré", 7.3167, 13.5833], ["Meiganga", 6.5167, 14.3], ["Tibati", 6.4667, 12.6333], ["Banyo", 6.75, 11.8167],
  ],
  Nord: [["Garoua", 9.3, 13.4], ["Guider", 9.9333, 13.9444], ["Tcholliré", 8.4, 14.1667], ["Poli", 8.4833, 13.2333]],
  "Extrême-Nord": [
    ["Maroua", 10.5909, 14.3159], ["Kousséri", 12.0769, 15.0306], ["Mokolo", 10.7408, 13.8014], ["Yagoua", 10.3427, 15.2358],
  ],
};

export const NOMS_REGIONS = Object.keys(DEFINITION);

export const REGIONS_CAMEROUN: Record<string, string[]> = Object.fromEntries(
  Object.entries(DEFINITION).map(([region, villes]) => [region, villes.map((v) => v[0])])
);

export const TOUTES_LES_VILLES: { nom: string; region: string; lat: number; lng: number }[] = Object.entries(
  DEFINITION
).flatMap(([region, villes]) => villes.map(([nom, lat, lng]) => ({ nom, region, lat, lng })));

export function regionDeVille(nomVille: string): string | null {
  return TOUTES_LES_VILLES.find((v) => v.nom === nomVille)?.region ?? null;
}

/** Coordonnées par nom de ville, pour déduire la ville depuis le GPS. */
export const COORDONNEES_VILLES: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  TOUTES_LES_VILLES.map((v) => [v.nom, { lat: v.lat, lng: v.lng }])
);
