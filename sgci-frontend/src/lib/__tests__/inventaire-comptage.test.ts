import {
  construirePayloadComptage,
  compterLignesRestantes,
  valeurSaisie,
} from '../inventaire-comptage';

describe('valeurSaisie', () => {
  /**
   * Régression : effacer un champ pour corriger une saisie valait 0, donc
   * rupture de stock inventoriée. À la validation, le produit partait à zéro.
   */
  it('traduit un champ effacé en non relevé, jamais en zéro', () => {
    expect(valeurSaisie('')).toBeNull();
    expect(valeurSaisie('   ')).toBeNull();
  });

  it('accepte le zéro, qui est une quantité relevée valide', () => {
    expect(valeurSaisie('0')).toBe(0);
    expect(valeurSaisie(' 0 ')).toBe(0);
  });

  it('lit une quantité ordinaire', () => {
    expect(valeurSaisie('18')).toBe(18);
    expect(valeurSaisie('1500')).toBe(1500);
  });

  it('ne produit jamais NaN, qui sérialiserait en null dans le JSON', () => {
    expect(valeurSaisie('abc')).toBeNull();
    expect(valeurSaisie('12abc')).toBeNull();
    expect(valeurSaisie('Infinity')).toBeNull();
    expect(Number.isNaN(Number(valeurSaisie('abc')))).toBe(false);
  });

  it('ne corrige pas une valeur négative, pour que le serveur refuse explicitement', () => {
    expect(valeurSaisie('-3')).toBe(-3);
  });
});

describe('construirePayloadComptage', () => {
  it('renvoie un payload vide si rien n a été saisi', () => {
    expect(construirePayloadComptage({})).toEqual([]);
  });

  it('exclut les lignes effacées et conserve les zéros', () => {
    const payload = construirePayloadComptage({
      '10': 12,
      '11': null,
      '12': 0,
    });

    expect(payload).toEqual([
      { inventaire_ligne_id: 10, quantite_physique: 12 },
      { inventaire_ligne_id: 12, quantite_physique: 0 },
    ]);
  });

  it('envoie la ligne relevée à zéro, seule façon d ajuster un stock à zéro', () => {
    const payload = construirePayloadComptage({ '7': 0 });

    expect(payload).toHaveLength(1);
    expect(payload[0].quantite_physique).toBe(0);
  });

  it('renvoie un payload vide si toutes les lignes ont été effacées', () => {
    expect(construirePayloadComptage({ '10': null, '11': null })).toEqual([]);
  });

  it('convertit les identifiants en entiers', () => {
    const payload = construirePayloadComptage({ '10': 4 });

    expect(typeof payload[0].inventaire_ligne_id).toBe('number');
    expect(payload[0].inventaire_ligne_id).toBe(10);
  });

  it('ne déduplique pas deux saisies de la même ligne', () => {
    expect(construirePayloadComptage({ '10': 4 })).toHaveLength(1);
  });
});

describe('compterLignesRestantes', () => {
  it('compte les lignes non relevées', () => {
    expect(
      compterLignesRestantes([
        { quantite_physique: 12 },
        { quantite_physique: null },
        { quantite_physique: 0 },
        {},
      ]),
    ).toBe(2);
  });

  it('considère un inventaire entièrement compté même si tout est à zéro', () => {
    expect(compterLignesRestantes([{ quantite_physique: 0 }, { quantite_physique: 0 }])).toBe(0);
  });

  it('renvoie zéro pour un inventaire sans ligne', () => {
    expect(compterLignesRestantes([])).toBe(0);
  });
});

describe('cycle de saisie complet', () => {
  it('effacer puis corriger ne transmet que la saisie retenue', () => {
    // Le comptant tape 18, se trompe, efface, puis saisit 15.
    const comptages: Record<string, number | null> = {
      '10': valeurSaisie('18'),
      '11': valeurSaisie('abc'),
    };
    comptages['10'] = valeurSaisie('');
    comptages['11'] = valeurSaisie('15');

    expect(construirePayloadComptage(comptages)).toEqual([
      { inventaire_ligne_id: 11, quantite_physique: 15 },
    ]);
  });

  it('un relevé à zéro survit à l envoi et compte comme ligne relevée', () => {
    const comptages = {
      '20': valeurSaisie('0'),
      '21': valeurSaisie(''),
    };

    expect(construirePayloadComptage(comptages)).toEqual([
      { inventaire_ligne_id: 20, quantite_physique: 0 },
    ]);
    expect(compterLignesRestantes([{ quantite_physique: 0 }, { quantite_physique: null }])).toBe(1);
  });
});