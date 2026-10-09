/**
 * Traduit une réponse d'erreur Laravel en message affichable.
 *
 * Le backend renvoie deux formes :
 *  - { message: '...' } pour un refus métier (stock insuffisant, délai) ;
 *  - { errors: { 'ligne_ventes.0.produit_id': ['Le produit est invalide.'] } }
 *    pour une erreur de validation. Sans ce traitement, la caisse affiche
 *    la clé brute du champ ou le code HTTP, ce qui n'aide pas le caissier.
 *
 * Une troisième forme issue de OperationRefusee (403 métier cross-tenant)
 * renvoie { error: 'code', message: '...' } : le message reste prioritaire,
 * le code n'est informatif que si aucun message n'est fourni.
 */
export function lireErreurApi(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const body = data as {
    message?: string;
    error?: string;
    errors?: Record<string, string[] | string>;
  };

  if (typeof body.message === 'string' && body.message.trim().length > 0) {
    return body.message;
  }

  if (body.errors && typeof body.errors === 'object') {
    const messages = Object.values(body.errors)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((m): m is string => typeof m === 'string' && m.length > 0);

    if (messages.length > 0) return messages.join(' ');
  }

  // Aucun message exploitable : on tente le code d'erreur, ex. 'stock_insuffisant'.
  if (typeof body.error === 'string' && body.error.trim().length > 0) {
    return body.error;
  }

  return null;
}
