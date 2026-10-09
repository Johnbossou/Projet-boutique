import { lireErreurApi, syncOfflineQueue } from "../sync-offline-caisse";
import { loadOfflineQueue, saveOfflineQueue, type OfflineVentePayload } from "../offline-caisse";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

function file(...ids: string[]): OfflineVentePayload[] {
  return ids.map((id, i) => ({ id, vente: { produits: [] }, timestamp: i }));
}

function reponse(options: { ok: boolean; status: number; json?: () => Promise<unknown> }): Response {
  return {
    ok: options.ok,
    status: options.status,
    json: options.json ?? (async () => ({})),
  } as unknown as Response;
}

beforeEach(async () => {
  apiFetchMock.mockReset();
  await saveOfflineQueue([]);
});

describe("syncOfflineQueue", () => {
  it("ne touche pas l'API quand la file est vide", async () => {
    const resultat = await syncOfflineQueue();

    expect(resultat).toEqual({ synced: 0, rejetees: [], enAttente: 0 });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("retire de la file les ventes acceptées et les compte", async () => {
    await saveOfflineQueue(file("v1", "v2"));
    apiFetchMock.mockResolvedValue(reponse({ ok: true, status: 201 }));

    const resultat = await syncOfflineQueue();

    expect(resultat.synced).toBe(2);
    expect(resultat.rejetees).toEqual([]);
    expect(resultat.enAttente).toBe(0);
    expect(await loadOfflineQueue()).toEqual([]);
  });

  it("retire les 4xx et expose le motif du rejet", async () => {
    await saveOfflineQueue(file("v1", "v2"));
    apiFetchMock
      .mockResolvedValueOnce(
        reponse({
          ok: false,
          status: 422,
          json: async () => ({ message: "Stock insuffisant pour PRODUIT A." }),
        }),
      )
      .mockResolvedValueOnce(
        reponse({
          ok: false,
          status: 403,
          json: async () => ({ error: "produit_hors_boutique" }),
        }),
      );

    const resultat = await syncOfflineQueue();

    expect(resultat.synced).toBe(0);
    expect(resultat.enAttente).toBe(0);
    expect(resultat.rejetees).toEqual([
      { id: "v1", raison: "Stock insuffisant pour PRODUIT A." },
      { id: "v2", raison: "produit_hors_boutique" },
    ]);
    expect(await loadOfflineQueue()).toEqual([]);
  });

  it("conserve les 5xx dans la file", async () => {
    await saveOfflineQueue(file("v1"));
    apiFetchMock.mockResolvedValue(reponse({ ok: false, status: 500 }));

    const resultat = await syncOfflineQueue();

    expect(resultat.enAttente).toBe(1);
    expect(resultat.rejetees).toEqual([]);
    expect((await loadOfflineQueue()).map((v) => v.id)).toEqual(["v1"]);
  });

  it("conserve les ventes en cas d'erreur réseau", async () => {
    await saveOfflineQueue(file("v1"));
    apiFetchMock.mockRejectedValue(new Error("Network request failed"));

    const resultat = await syncOfflineQueue();

    expect(resultat.enAttente).toBe(1);
    expect((await loadOfflineQueue()).map((v) => v.id)).toEqual(["v1"]);
  });

  it("sépare succès, rejets définitifs et échecs transitoires dans un même lot", async () => {
    await saveOfflineQueue(file("ok", "rej", "err"));
    apiFetchMock
      .mockResolvedValueOnce(reponse({ ok: true, status: 201 }))
      .mockResolvedValueOnce(
        reponse({ ok: false, status: 422, json: async () => ({ message: "Quantité invalide." }) }),
      )
      .mockResolvedValueOnce(reponse({ ok: false, status: 503 }));

    const resultat = await syncOfflineQueue();

    expect(resultat.synced).toBe(1);
    expect(resultat.rejetees).toEqual([{ id: "rej", raison: "Quantité invalide." }]);
    expect(resultat.enAttente).toBe(1);
    expect((await loadOfflineQueue()).map((v) => v.id)).toEqual(["err"]);
  });

  it("retombe sur le code HTTP si la réponse 4xx n'est pas parsable", async () => {
    await saveOfflineQueue(file("v1"));
    apiFetchMock.mockResolvedValueOnce(
      reponse({
        ok: false,
        status: 422,
        json: async () => {
          throw new Error("JSON invalide");
        },
      }),
    );

    const resultat = await syncOfflineQueue();

    expect(resultat.rejetees[0]?.raison).toBe("Erreur 422");
  });

  it("envoie l'idempotency_key de la vente pour éviter un doublon au rejeu", async () => {
    await saveOfflineQueue([
      { id: "v1", vente: { produits: [], idempotency_key: "offline_abc" }, timestamp: 0 },
    ]);
    apiFetchMock.mockResolvedValue(reponse({ ok: true, status: 201 }));

    await syncOfflineQueue();

    const corps = JSON.parse(apiFetchMock.mock.calls[0][1].body);
    expect(corps.idempotency_key).toBe("offline_abc");
  });
});

describe("lireErreurApi", () => {
  it("retourne null pour une entrée vide ou non objet", () => {
    expect(lireErreurApi(null)).toBeNull();
    expect(lireErreurApi(undefined)).toBeNull();
    expect(lireErreurApi("texte")).toBeNull();
    expect(lireErreurApi(7)).toBeNull();
  });

  it("retourne le message métier", () => {
    expect(lireErreurApi({ message: "Stock insuffisant." })).toBe("Stock insuffisant.");
  });

  it("ignore un message vide ou composé d'espaces", () => {
    expect(lireErreurApi({ message: "", error: "code_x" })).toBe("code_x");
    expect(lireErreurApi({ message: "   ", error: "code_y" })).toBe("code_y");
  });

  it("agrège les erreurs de validation", () => {
    expect(
      lireErreurApi({
        errors: {
          "ligne_ventes.0.produit_id": ["Le produit est invalide."],
          "ligne_ventes.1.quantite": ["La quantité doit être au moins 1."],
        },
      }),
    ).toBe("Le produit est invalide. La quantité doit être au moins 1.");
  });

  it("accepte une valeur de validation scalaire", () => {
    expect(lireErreurApi({ errors: { total: "Total invalide." } })).toBe("Total invalide.");
  });

  it("privilégie message sur errors", () => {
    expect(
      lireErreurApi({ message: "Refusé.", errors: { produit_id: ["Invalide."] } }),
    ).toBe("Refusé.");
  });

  it("retombe sur le code erreur", () => {
    expect(lireErreurApi({ error: "produit_hors_boutique" })).toBe("produit_hors_boutique");
  });
});
