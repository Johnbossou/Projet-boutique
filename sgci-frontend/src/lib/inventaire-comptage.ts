/**
 * Saisie d'une ligne d'inventaire : null = champ effacé, donc quantité non relevée.
 *
 * La distinction entre null et 0 est le cœur de ce module. Elle a déjà coûté
 * une perte de marchandise.
 */
export type SaisieLigne = number | null;

export interface LigneComptagePayload {
  inventaire_ligne_id: number;
  quantite_physique: number;
}

export interface LigneInventaire {
  quantite_physique?: number | null;
}

/**
 * Convertit la valeur brute d'un champ de saisie.
 *
 * Deux pièges que cette fonction existe pour neutraliser :
 *  - '' doit devenir null, et non 0. Number('') vaut 0, donc un simple
 *    effacement pour se corriger était interprété comme une rupture de stock.
 *    À la validation, le produit partait à zéro : une perte de marchandise
 *    provoquée par une frappe.
 *  - une saisie non numérique doit devenir null. Number('abc') vaut NaN, qui
 *    sérialise en null dans le JSON et se fait refuser par le backend avec un
 *    message sans rapport avec la cause réelle.
 *
 * Les valeurs négatives ne sont pas corrigées ici. Le comptant doit voir le
 * refus explicite du serveur plutôt que de constater que sa saisie a été
 * ignorée sans explication.
 */
export function valeurSaisie(brut: string): number | null {
  if (brut.trim() === '') {
    return null;
  }

  const valeur = Number(brut);

  return Number.isFinite(valeur) ? valeur : null;
}

/**
 * Construit le corps de la requête de comptage.
 *
 * Règle : une ligne non relevée n'est jamais envoyée ; une ligne relevée à 0
 * l'est toujours. Filtrer sur 0 avait pour effet de faire disparaître le cas
 * le plus important d'un inventaire — un produit dont le comptant ne relève
 * aucune unité. La rupture constatée en rayon n'ajustait jamais le stock.
 */
export function construirePayloadComptage(
  comptages: Record<string, SaisieLigne>,
): LigneComptagePayload[] {
  return Object.entries(comptages)
    .filter(([, valeur]) => valeur !== undefined && valeur !== null)
    .map(([ligneId, quantite]) => ({
      inventaire_ligne_id: Number(ligneId),
      quantite_physique: Number(quantite),
    }));
}

/**
 * Nombre de lignes encore à compter. Une ligne relevée à 0 est comptée comme
 * relevée : c'est l'inventaire complet, pas un inventaire inachevé.
 */
export function compterLignesRestantes(lignes: LigneInventaire[]): number {
  return lignes.filter(
    (ligne) => ligne.quantite_physique === null || ligne.quantite_physique === undefined,
  ).length;
}