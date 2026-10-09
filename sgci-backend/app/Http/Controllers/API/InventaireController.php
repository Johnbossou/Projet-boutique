<?php

namespace App\Http\Controllers\API;

use App\Exceptions\OperationRefusee;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Http\Controllers\Controller;
use App\Models\Inventaire;
use App\Models\InventaireLigne;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Traits\Auditable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventaireController extends Controller
{
    use Auditable, VerifieBoutique;

    public function index(Request $request): JsonResponse
    {
        $query = Inventaire::with('user');

        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $inventaires = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($inventaires);
    }

    public function show(Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutiqueDe($inventaire);

        $inventaire->load(['lignes.produit.categorie', 'user']);

        return response()->json($inventaire);
    }

    /**
     * Créer un inventaire physique.
     * Snapshot instantané : chaque produit reçoit sa quantité système au moment de la création.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        $boutiqueId = $request->user()->current_boutique_id;

        if (! $boutiqueId) {
            return response()->json(['message' => 'Boutique non définie'], 422);
        }

        return DB::transaction(function () use ($request, $validated, $boutiqueId) {
            $inventaire = Inventaire::create([
                'boutique_id' => $boutiqueId,
                'user_id' => $request->user()->id,
                'notes' => $validated['notes'] ?? null,
                'statut' => 'en_cours',
            ]);

            $produits = Produit::where('boutique_id', $boutiqueId)->get();
            $totalProduits = 0;

            foreach ($produits as $produit) {
                InventaireLigne::create([
                    'inventaire_id' => $inventaire->id,
                    'produit_id' => $produit->id,
                    'quantite_systeme' => $produit->quantite_stock,
                ]);
                $totalProduits++;
            }

            $inventaire->update(['total_produits' => $totalProduits]);

            $this->auditCreate($inventaire);

            return response()->json([
                'message' => 'Inventaire créé avec succès',
                'data' => $inventaire->load('lignes.produit'),
            ], 201);
        });
    }

    /**
     * Enregistrer les comptages physiques (quantités réelles).
     *
     * Le comptage est partiel par nature : un inventaire se fait en rayon, par
     * lots. L'inventaire reste donc « en_cours » après chaque envoi, et seule la
     * validation exige que toutes les lignes soient saisies.
     *
     * L'écart est mesuré contre le stock affiché AU MOMENT du comptage
     * (quantite_systeme_comptage), et non contre la photo prise à l'ouverture.
     * La boutique vend et réceptionne pendant le comptage : comparer à la photo
     * d'ouverture rendait l'écart faux, et la validation réintégrait ensuite en
     * stock des articles qui avaient été réellement vendus.
     */
    public function compter(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutiqueDe($inventaire);

        if (! in_array($inventaire->statut, ['en_cours', 'termine'], true)) {
            return response()->json(['message' => 'Cet inventaire n\'est plus en cours de comptage'], 422);
        }

        $validated = $request->validate([
            'lignes' => 'required|array|min:1',
            'lignes.*.inventaire_ligne_id' => 'required|exists:inventaire_lignes,id',
            'lignes.*.quantite_physique' => 'required|integer|min:0',
            'lignes.*.notes' => 'nullable|string|max:500',
        ]);

        return DB::transaction(function () use ($validated, $inventaire) {
            // Verrou sur l'inventaire EN PREMIER, dans le même ordre que
            // valider() et annuler() (inventaire puis produit). Sans lui, un
            // comptage concurrent à une validation réécrivait les écarts APRÈS
            // que le stock a été ajusté : le décompte affiché ne correspondait
            // plus à l'ajustement appliqué, et un second décompte l'écrasait.
            $verrouille = Inventaire::whereKey($inventaire->id)
                ->where('boutique_id', $inventaire->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouille) {
                return response()->json(['message' => 'Inventaire introuvable.'], 404);
            }

            if (! in_array($verrouille->statut, ['en_cours', 'termine'], true)) {
                return response()->json(['message' => 'Cet inventaire n\'est plus en cours de comptage'], 422);
            }

            $inventaire = $verrouille;

            foreach ($validated['lignes'] as $ligneData) {
                $ligne = InventaireLigne::where('id', $ligneData['inventaire_ligne_id'])
                    ->where('inventaire_id', $inventaire->id)
                    ->firstOrFail();

                // Verrou : le stock de référence doit être celui affiché au
                // moment de la saisie, pas une valeur relue plus tôt.
                $produit = Produit::where('id', $ligne->produit_id)
                    ->where('boutique_id', $inventaire->boutique_id)
                    ->lockForUpdate()
                    ->first();

                $systemeAuComptage = $produit ? (int) $produit->quantite_stock : (int) $ligne->quantite_systeme;

                $ligne->update([
                    'quantite_physique' => (int) $ligneData['quantite_physique'],
                    'quantite_systeme_comptage' => $systemeAuComptage,
                    'ecart' => (int) $ligneData['quantite_physique'] - $systemeAuComptage,
                    'notes' => $ligneData['notes'] ?? null,
                ]);
            }

            // Le total des écarts porte sur TOUTES les lignes, pas seulement le
            // dernier lot transmis : sinon il était écrasé à chaque envoi et
            // n'annulait jamais les écarts déjà saisis.
            $ecarts = InventaireLigne::where('inventaire_id', $inventaire->id)
                ->whereNotNull('ecart')
                ->where('ecart', '!=', 0)
                ->count();

            $ancienStatut = $inventaire->statut;
            $inventaire->update([
                'ecarts_detectes' => $ecarts,
                'statut' => 'en_cours',
            ]);

            $this->auditUpdate($inventaire, ['statut' => $ancienStatut]);

            $inventaire->load('lignes.produit');

            $restantes = InventaireLigne::where('inventaire_id', $inventaire->id)
                ->whereNull('quantite_physique')
                ->count();

            return response()->json([
                'message' => $restantes > 0
                    ? sprintf('%d ligne(s) comptée(s) — %d restante(s). %d écart(s) détecté(s)', count($validated['lignes']), $restantes, $ecarts)
                    : sprintf('Comptage terminé — %d écart(s) détecté(s)', $ecarts),
                'data' => $inventaire,
                'lignes_restantes' => $restantes,
            ]);
        });
    }

    /**
     * Valider un inventaire : appliquer les ajustements de stock.
     *
     * L'ajustement applique un DELTA au stock courant, jamais une valeur
     * absolue. Écraser le stock par la quantité physique annulait les ventes
     * et réceptions survenues pendant le comptage, ce qui recréait de la
     * marchandise.
     */
    public function valider(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutiqueDe($inventaire);

        // Le contrôle de statut n'est volontairement PAS fait ici : toute
        // lecture d'état avant la transaction est une fenêtre de course. Il est
        // effectué sous verrou, plus bas, et c'est le seul qui fait foi.

        return DB::transaction(function () use ($inventaire, $request) {
            // Verrou sur l'inventaire, et relecture du statut SOUS VERROU.
            //
            // Ce test était fait avant la transaction : deux validations
            // simultanées le lisaient toutes les deux à « en_cours » et
            // appliquaient chacune leur propre lot d'ajustements. Le verrou sur
            // produit ne les protégeait pas : chaque transaction relit
            // quantite_stock, applique le même delta, et les deux écarts
            // s'additionnaient. Un double clic suffisait à doubler l'écart
            // d'inventaire, sans course entre deux caisses.
            $verrouille = Inventaire::whereKey($inventaire->id)
                ->where('boutique_id', $inventaire->boutique_id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($verrouille->statut, ['en_cours', 'termine'], true)) {
                // 409 et non 422 : l'état a changé sous nos pieds. Deux
                // validations ne doivent pas non plus s'ignorer en appliquant
                // chacune la moitié des écarts.
                throw new OperationRefusee(
                    'Cet inventaire a été traité entre-temps (statut : '.$verrouille->statut.')',
                    409
                );
            }

            $lignes = InventaireLigne::where('inventaire_id', $inventaire->id)->get();

            $nonComptees = $lignes->whereNull('quantite_physique')->count();

            if ($nonComptees > 0) {
                throw new OperationRefusee(
                    sprintf(
                        '%d produit(s) n\'ont pas été comptés. Un inventaire ne peut être validé que si toutes les lignes ont une quantité relevée.',
                        $nonComptees
                    ),
                    422
                );
            }

            // Un produit supprimé ou hors boutique ne doit pas être ignoré en
            // silence : le client recevrait « inventaire validé, stock ajusté »
            // alors qu'une partie des écarts n'a pas été appliquée. Même refus
            // que pour la réintégration d'un retour — l'ajustement partiel
            // silencieuse laisse un stock faux sans qu'aucune trace ne le dise.
            $ajustables = $lignes->filter(fn (InventaireLigne $l) => $l->ecart !== null && $l->ecart !== 0);

            $introuvables = $ajustables
                ->pluck('produit_id')
                ->unique()
                ->filter(fn ($produitId) => ! Produit::whereKey($produitId)
                    ->where('boutique_id', $verrouille->boutique_id)
                    ->exists())
                ->values();

            if ($introuvables->isNotEmpty()) {
                throw new OperationRefusee(
                    'Produit supprimé ou hors boutique, inventaire non validé (aucun stock ajusté) : #'
                        .$introuvables->implode(', #'),
                    422
                );
            }

            foreach ($ajustables as $ligne) {
                $produit = Produit::where('id', $ligne->produit_id)
                    ->where('boutique_id', $verrouille->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $produit) {
                    // Inatteignable : le contrôle ci-dessus a déjà coupé la
                    // transaction. Reste en défense en profondeur, pour qu'une
                    // suppression intervenant entre les deux ne puisse pas
                    // laisser un ajustement partiel silencieusement appliqué.
                    continue;
                }

                $quantiteAvant = (int) $produit->quantite_stock;

                // Delta et non valeur absolue : les mouvements survenus entre
                // le comptage et la validation sont conservés.
                $quantiteApres = max(0, $quantiteAvant + (int) $ligne->ecart);

                $produit->update(['quantite_stock' => $quantiteApres]);

                MouvementStock::create([
                    'produit_id' => $produit->id,
                    'quantite' => abs((int) $ligne->ecart),
                    'raison' => 'ajustement',
                    'type' => $ligne->ecart > 0 ? 'entree' : 'sortie',
                    'reference_bon' => $inventaire->reference,
                    'notes' => sprintf(
                        'Ajustement inventaire #%s — écart de %+d (relevé %d, système au comptage %s, stock courant %d)',
                        $inventaire->reference,
                        (int) $ligne->ecart,
                        (int) $ligne->quantite_physique,
                        $ligne->quantite_systeme_comptage === null ? 'n/d' : (int) $ligne->quantite_systeme_comptage,
                        $quantiteAvant
                    ),
                    'user_id' => $request->user()->id,
                    'statut' => 'accepte',
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                    'boutique_id' => $inventaire->boutique_id,
                ]);
            }

            $ancienStatut = $verrouille->statut;
            $verrouille->update(['statut' => 'valide']);
            $this->auditUpdate($verrouille, ['statut' => $ancienStatut]);

            return response()->json([
                'message' => 'Inventaire validé, stock ajusté',
                'data' => $verrouille->load('lignes.produit'),
            ]);
        });
    }

    /**
     * Annuler un inventaire.
     */
    public function annuler(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutiqueDe($inventaire);

        // Même verrou que valider(), et pour la même raison : sans lui, une
        // annulation pouvait se glisser entre deux validations et laisser un
        // inventaire marqué « annule » alors que le stock venait d'être
        // ajusté selon un comptage que le gérant croyait avoir abandonné.
        [$inventaireAnnule, $ancienStatut] = DB::transaction(function () use ($inventaire) {
            $verrouille = Inventaire::whereKey($inventaire->id)
                ->where('boutique_id', $inventaire->boutique_id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($verrouille->statut, ['en_cours', 'termine'], true)) {
                throw new OperationRefusee(
                    'Cet inventaire ne peut plus être annulé (statut : '.$verrouille->statut.')',
                    422
                );
            }

            $ancienStatut = $verrouille->statut;
            $verrouille->update(['statut' => 'annule']);

            return [$verrouille, $ancienStatut];
        });

        $this->auditUpdate($inventaireAnnule, ['statut' => $ancienStatut]);

        return response()->json([
            'message' => 'Inventaire annulé',
            'data' => $inventaireAnnule,
        ]);
    }

    /**
     * Résumé des écarts d'un inventaire validé.
     */
    public function ecarts(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutiqueDe($inventaire);

        $lignes = $inventaire->lignes()
            ->with('produit')
            ->whereNotNull('ecart')
            ->where('ecart', '!=', 0)
            ->orderByRaw('ABS(ecart) DESC')
            ->get();

        return response()->json([
            'inventaire' => $inventaire->only(['reference', 'statut', 'ecarts_detectes', 'created_at']),
            'ecarts' => $lignes->map(fn ($l) => [
                'produit' => $l->produit->nom,
                'categorie' => $l->produit->categorie?->nom ?? '—',
                'quantite_systeme' => $l->quantite_systeme,
                'quantite_physique' => $l->quantite_physique,
                'ecart' => $l->ecart,
                'notes' => $l->notes,
            ]),
            'ecarts_positifs' => $lignes->where('ecart', '>', 0)->count(),
            'ecarts_negatifs' => $lignes->where('ecart', '<', 0)->count(),
        ]);
    }
}
