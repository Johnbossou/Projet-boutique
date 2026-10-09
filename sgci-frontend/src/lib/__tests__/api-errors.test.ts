import { lireErreurApi } from '../api-errors';

describe('lireErreurApi', () => {
  it('retourne null pour une entrée vide ou non objet', () => {
    expect(lireErreurApi(null)).toBeNull();
    expect(lireErreurApi(undefined)).toBeNull();
    expect(lireErreurApi('texte')).toBeNull();
    expect(lireErreurApi(42)).toBeNull();
    expect(lireErreurApi([])).toBeNull();
  });

  it('retourne le message métier prioritaire', () => {
    expect(lireErreurApi({ message: 'Stock insuffisant pour Sofas.' })).toBe(
      'Stock insuffisant pour Sofas.',
    );
  });

  it('ignore un message vide et cherche ailleurs', () => {
    expect(lireErreurApi({ message: '', errors: { produit_id: ['Requis.'] } })).toBe('Requis.');
  });

  it('ignore un message uniquement composé d espaces', () => {
    expect(lireErreurApi({ message: '   ', error: 'stock_insuffisant' })).toBe('stock_insuffisant');
  });

  it('agrege les erreurs de validation en tableaux', () => {
    const reponse = {
      errors: {
        'ligne_ventes.0.produit_id': ['Le produit est invalide.'],
        'ligne_ventes.1.quantite': ['La quantité doit être au moins 1.'],
      },
    };

    expect(lireErreurApi(reponse)).toBe(
      'Le produit est invalide. La quantité doit être au moins 1.',
    );
  });

  it('accepte une valeur de validation scalaire et non tableau', () => {
    expect(lireErreurApi({ errors: { total: 'Total invalide.' } })).toBe('Total invalide.');
  });

  it('ignore les valeurs de validation non textuelles', () => {
    expect(lireErreurApi({ errors: { total: [null, 42, {}] } })).toBeNull();
  });

  it('privilégie message sur errors', () => {
    const reponse = {
      message: 'Vente refusée : produit hors boutique.',
      errors: { produit_id: ['Le produit est invalide.'] },
    };

    expect(lireErreurApi(reponse)).toBe('Vente refusée : produit hors boutique.');
  });

  it('retombe sur le code erreur quand aucun message n est fourni', () => {
    // Forme OperationRefusee : { error: 'code', message: '...' }.
    expect(lireErreurApi({ error: 'produit_hors_boutique' })).toBe('produit_hors_boutique');
  });

  it('ne renvoie jamais une chaîne vide à l affichage', () => {
    const casVides = [
      {},
      { message: '' },
      { error: '   ' },
      { errors: {} },
      { errors: { a: [] } },
    ];

    casVides.forEach((cas) => {
      const resultat = lireErreurApi(cas);
      expect(resultat === null || resultat.length > 0).toBe(true);
    });
  });
});
