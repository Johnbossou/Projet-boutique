import { syncOfflineQueue, type OfflineQueueItem } from '../sync-offline-caisse';

function creerReponse(options: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: options.ok,
    status: options.status,
    json: options.json ?? (async () => ({})),
  } as unknown as Response;
}

describe('syncOfflineQueue', () => {
  const apiFetch = jest.fn();

  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('ne fait rien si la file est vide', async () => {
    const resultat = await syncOfflineQueue([], apiFetch);

    expect(resultat).toEqual({
      synchronisees: [],
      rejetees: [],
      enAttente: [],
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('retire les ventes acceptées et notifie le succès', async () => {
    const file: OfflineQueueItem[] = [
      { id: 'v1', vente: { produits: [] }, timestamp: 1, status: 'pending' },
      { id: 'v2', vente: { produits: [] }, timestamp: 2, status: 'pending' },
    ];

    apiFetch
      .mockResolvedValueOnce(creerReponse({ ok: true, status: 201 }))
      .mockResolvedValueOnce(creerReponse({ ok: true, status: 200 }));

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(resultat.synchronisees).toEqual(['v1', 'v2']);
    expect(resultat.rejetees).toEqual([]);
    expect(resultat.enAttente).toEqual([]);
  });

  it('trait les 4xx comme rejets définitifs et les retire de la file', async () => {
    const file: OfflineQueueItem[] = [
      { id: 'v1', vente: { produits: [] }, timestamp: 1, status: 'pending' },
      { id: 'v2', vente: { produits: [] }, timestamp: 2, status: 'pending' },
    ];

    apiFetch
      .mockResolvedValueOnce(
        creerReponse({
          ok: false,
          status: 422,
          json: async () => ({ message: 'Stock insuffisant pour PRODUIT A.' }),
        }),
      )
      .mockResolvedValueOnce(
        creerReponse({
          ok: false,
          status: 403,
          json: async () => ({ error: 'produit_hors_boutique' }),
        }),
      );

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(resultat.synchronisees).toEqual([]);
    expect(resultat.rejetees).toEqual([
      { id: 'v1', raison: 'Stock insuffisant pour PRODUIT A.' },
      { id: 'v2', raison: 'produit_hors_boutique' },
    ]);
    expect(resultat.enAttente).toEqual([]);
  });

  it('conserve les 5xx et les 3xx pour un nouvel essai', async () => {
    const file: OfflineQueueItem[] = [
      { id: 'v500', vente: {}, timestamp: 1, status: 'pending' },
      { id: 'v302', vente: {}, timestamp: 2, status: 'pending' },
    ];

    apiFetch
      .mockResolvedValueOnce(creerReponse({ ok: false, status: 500 }))
      .mockResolvedValueOnce(creerReponse({ ok: false, status: 302 }));

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(resultat.enAttente).toEqual(['v500', 'v302']);
    expect(resultat.rejetees).toEqual([]);
    expect(resultat.synchronisees).toEqual([]);
  });

  it('conserve les ventes en cas d erreur réseau', async () => {
    const file: OfflineQueueItem[] = [{ id: 'v1', vente: {}, timestamp: 1, status: 'pending' }];

    apiFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(resultat.enAttente).toEqual(['v1']);
    expect(resultat.rejetees).toEqual([]);
    expect(resultat.synchronisees).toEqual([]);
  });

  it('separe rejets définitifs, succès et transitoires dans le même lot', async () => {
    const file: OfflineQueueItem[] = [
      { id: 'ok', vente: {}, timestamp: 1, status: 'pending' },
      { id: 'rej', vente: {}, timestamp: 2, status: 'pending' },
      { id: 'err', vente: {}, timestamp: 3, status: 'pending' },
    ];

    apiFetch
      .mockResolvedValueOnce(creerReponse({ ok: true, status: 201 }))
      .mockResolvedValueOnce(
        creerReponse({
          ok: false,
          status: 422,
          json: async () => ({ message: 'Quantité invalide.' }),
        }),
      )
      .mockResolvedValueOnce(creerReponse({ ok: false, status: 503 }));

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(resultat.synchronisees).toEqual(['ok']);
    expect(resultat.rejetees).toEqual([{ id: 'rej', raison: 'Quantité invalide.' }]);
    expect(resultat.enAttente).toEqual(['err']);
  });

  it('retombe sur le code HTTP si la réponse 4xx n est pas parsable', async () => {
    const file: OfflineQueueItem[] = [{ id: 'v1', vente: {}, timestamp: 1, status: 'pending' }];

    apiFetch.mockResolvedValueOnce(
      creerReponse({
        ok: false,
        status: 422,
        json: async () => { throw new Error('JSON invalide'); },
      }),
    );

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(resultat.rejetees[0]?.raison).toBe('Vente refusée (422)');
  });

  it('priorise le message sur les erreurs de validation', async () => {
    const file: OfflineQueueItem[] = [{ id: 'v1', vente: {}, timestamp: 1, status: 'pending' }];

    apiFetch.mockResolvedValueOnce(
      creerReponse({
        ok: false,
        status: 422,
        json: async () => ({
          message: 'Vente refusée : produit hors boutique.',
          errors: { 'ligne_ventes.0.produit_id': ['Invalide.'] },
        }),
      }),
    );

    const resultat = await syncOfflineQueue(file, apiFetch);

    expect(resultat.rejetees[0]?.raison).toBe('Vente refusée : produit hors boutique.');
  });
});
