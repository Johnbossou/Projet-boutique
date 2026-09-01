<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Inventaire;
use App\Models\InventaireLigne;
use App\Models\Produit;
use App\Models\MouvementStock;
use App\Traits\Auditable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventaireController extends Controller
{
    use Auditable;

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
        $this->verifierBoutique($inventaire);

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

        if (!$boutiqueId) {
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
     */
    public function compter(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutique($inventaire);

        if ($inventaire->statut !== 'en_cours') {
            return response()->json(['message' => 'Cet inventaire n\'est plus en cours de comptage'], 422);
        }

        $validated = $request->validate([
            'lignes' => 'required|array|min:1',
            'lignes.*.inventaire_ligne_id' => 'required|exists:inventaire_lignes,id',
            'lignes.*.quantite_physique' => 'required|integer|min:0',
            'lignes.*.notes' => 'nullable|string|max:500',
        ]);

        $ecarts = 0;

        foreach ($validated['lignes'] as $ligneData) {
            $ligne = InventaireLigne::where('id', $ligneData['inventaire_ligne_id'])
                ->where('inventaire_id', $inventaire->id)
                ->firstOrFail();

            $ecart = $ligneData['quantite_physique'] - $ligne->quantite_systeme;

            $ligne->update([
                'quantite_physique' => $ligneData['quantite_physique'],
                'ecart' => $ecart,
                'notes' => $ligneData['notes'] ?? null,
            ]);

            if ($ecart !== 0) {
                $ecarts++;
            }
        }

        $inventaire->update([
            'ecarts_detectes' => $ecarts,
            'statut' => 'termine',
        ]);

        $this->auditUpdate($inventaire, ['statut' => 'en_cours']);

        $inventaire->load('lignes.produit');

        return response()->json([
            'message' => "Comptage terminé — {$ecarts} écart(s) détecté(s)",
            'data' => $inventaire,
        ]);
    }

    /**
     * Valider un inventaire : appliquer les ajustements de stock.
     */
    public function valider(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutique($inventaire);

        if ($inventaire->statut !== 'termine') {
            return response()->json(['message' => 'L\'inventaire doit être terminé avant validation'], 422);
        }

        return DB::transaction(function () use ($inventaire, $request) {
            foreach ($inventaire->lignes as $ligne) {
                if ($ligne->ecart !== null && $ligne->ecart !== 0) {
                    $produit = Produit::whereKey($ligne->produit_id)->lockForUpdate()->first();

                    if ($produit) {
                        $quantiteAvant = $produit->quantite_stock;
                        $quantiteApres = $ligne->quantite_physique;

                        $produit->update(['quantite_stock' => $quantiteApres]);

                        MouvementStock::create([
                            'produit_id' => $produit->id,
                            'quantite' => abs($ligne->ecart),
                            'raison' => 'ajustement',
                            'type' => $ligne->ecart > 0 ? 'entree' : 'sortie',
                            'reference_bon' => (string) $inventaire->id,
                            'notes' => 'Ajustement inventaire #' . $inventaire->reference . ' — écart de ' . $ligne->ecart,
                            'user_id' => $request->user()->id,
                            'statut' => 'accepte',
                            'quantite_avant' => $quantiteAvant,
                            'quantite_apres' => $quantiteApres,
                            'boutique_id' => $inventaire->boutique_id,
                        ]);
                    }
                }
            }

            $ancienStatut = $inventaire->statut;
            $inventaire->update(['statut' => 'valide']);
            $this->auditUpdate($inventaire, ['statut' => $ancienStatut]);

            return response()->json([
                'message' => 'Inventaire validé, stock ajusté',
                'data' => $inventaire->load('lignes.produit'),
            ]);
        });
    }

    /**
     * Annuler un inventaire.
     */
    public function annuler(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutique($inventaire);

        if (!in_array($inventaire->statut, ['en_cours', 'termine'])) {
            return response()->json(['message' => 'Cet inventaire ne peut plus être annulé'], 422);
        }

        $ancienStatut = $inventaire->statut;
        $inventaire->update(['statut' => 'annule']);
        $this->auditUpdate($inventaire, ['statut' => $ancienStatut]);

        return response()->json([
            'message' => 'Inventaire annulé',
            'data' => $inventaire,
        ]);
    }

    /**
     * Résumé des écarts d'un inventaire validé.
     */
    public function ecarts(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->verifierBoutique($inventaire);

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

    protected function verifierBoutique($model): void
    {
        if (auth()->user()->current_boutique_id && $model->boutique_id !== auth()->user()->current_boutique_id) {
            abort(403, 'Non autorisé');
        }
    }
}
