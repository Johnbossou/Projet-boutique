import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  apiToLocal,
  cacheBoutiqueMeta,
  getDelaiAnnulationMs,
  getDelaiAnnulationMsSync,
  getTauxTvaSync,
} from "../boutique-settings";

const META_KEY = "sgci_boutique_api_meta";

beforeEach(async () => {
  await AsyncStorage.clear();
  // Le miroir mémoire est un module-level : on repart de l'état initial.
  await cacheBoutiqueMeta({ nom: "Test", devise: "FCFA", taux_tva: 18, delai_annulation_vente_minutes: 5 });
});

describe("TVA par boutique", () => {
  it("utilise un ratio quand le serveur renvoie un pourcentage", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 18, delai_annulation_vente_minutes: 5 });
    expect(getTauxTvaSync()).toBeCloseTo(0.18, 10);
  });

  it("accepte un ratio déjà normalisé", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 0.075, delai_annulation_vente_minutes: 5 });
    expect(getTauxTvaSync()).toBeCloseTo(0.075, 10);
  });

  it("accepte une boutique à 0 %", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 0, delai_annulation_vente_minutes: 5 });
    expect(getTauxTvaSync()).toBe(0);
  });

  it("retombe sur 18 % si le taux est négatif ou invalide", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: -5, delai_annulation_vente_minutes: 5 });
    expect(getTauxTvaSync()).toBeCloseTo(0.18, 10);
  });

  it("retombe sur 18 % si le taux est absent", async () => {
    await cacheBoutiqueMeta({
      nom: "B",
      devise: "FCFA",
      taux_tva: undefined as unknown as number,
      delai_annulation_vente_minutes: 5,
    });
    expect(getTauxTvaSync()).toBeCloseTo(0.18, 10);
  });

  it("retombe sur 18 % si le taux n'est pas un nombre fini", async () => {
    await cacheBoutiqueMeta({
      nom: "B",
      devise: "FCFA",
      taux_tva: Number.NaN,
      delai_annulation_vente_minutes: 5,
    });
    expect(getTauxTvaSync()).toBeCloseTo(0.18, 10);
  });

  it("persiste le taux pour survive à un redémarrage", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 9.5, delai_annulation_vente_minutes: 5 });

    const brut = await AsyncStorage.getItem(META_KEY);
    expect(brut).not.toBeNull();
    expect(JSON.parse(brut as string).taux_tva).toBe(9.5);
  });
});

describe("Délai d'annulation", () => {
  it("convertit les minutes en millisecondes", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 18, delai_annulation_vente_minutes: 12 });
    expect(getDelaiAnnulationMsSync()).toBe(12 * 60 * 1000);
  });

  it("désactive la fenêtre d'annulation si le délai est 0", async () => {
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 18, delai_annulation_vente_minutes: 0 });
    expect(getDelaiAnnulationMsSync()).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("traite un délai négatif comme corrompu et retombe sur 5 minutes", async () => {
    // Pas MAX_SAFE_INTEGER : une fenêtre d'annulation illimitée permettrait de
    // s'approprier une vente encaissée il y a des heures.
    await cacheBoutiqueMeta({ nom: "B", devise: "FCFA", taux_tva: 18, delai_annulation_vente_minutes: -3 });
    expect(getDelaiAnnulationMsSync()).toBe(5 * 60 * 1000);
    expect(await getDelaiAnnulationMs()).toBe(5 * 60 * 1000);
  });

  it("recharge le délai depuis le stockage", async () => {
    await AsyncStorage.setItem(
      META_KEY,
      JSON.stringify({ taux_tva: 18, delai_annulation_vente_minutes: 30 }),
    );
    expect(await getDelaiAnnulationMs()).toBe(30 * 60 * 1000);
  });

  it("retombe sur 5 minutes si rien n'est stocké", async () => {
    expect(await getDelaiAnnulationMs()).toBe(5 * 60 * 1000);
  });

  it("retombe sur 5 minutes si le JSON est corrompu", async () => {
    await AsyncStorage.setItem(META_KEY, "{pas du json");
    expect(await getDelaiAnnulationMs()).toBe(5 * 60 * 1000);
  });
});

describe("apiToLocal", () => {
  it("convertit les champs optionnels null en chaînes vides", () => {
    const local = apiToLocal({
      nom: "Boutique Test",
      adresse: null,
      telephone: null,
      email: null,
      devise: "FCFA",
      taux_tva: 18,
      delai_annulation_vente_minutes: 5,
    });

    expect(local).toEqual({
      nom: "Boutique Test",
      adresse: "",
      telephone: "",
      email: "",
      tva: 18,
      devise: "FCFA",
    });
  });

  it("conserve les valeurs renseignées", () => {
    const local = apiToLocal({
      nom: "B",
      adresse: "Rue 1",
      telephone: "2290000",
      email: "a@b.c",
      devise: "XOF",
      taux_tva: 7.5,
      delai_annulation_vente_minutes: 5,
    });

    expect(local.adresse).toBe("Rue 1");
    expect(local.devise).toBe("XOF");
    expect(local.tva).toBe(7.5);
  });
});
