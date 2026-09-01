<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\RetourVente;
use App\Models\RetourVenteLigne;
use App\Models\Vente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Traits\Auditable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RetourVenteController extends Controller
{
    use Auditable;

    public function index(Request $request): JsonResponse
    {
        $query = RetourVente::with(['vente', 'user', 'lignes.produit']);

        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        if ($request->has('vente_id') && $request->vente_id) {
            $query->where('vente_id', $request->vente_id);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $retours = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($retours);
    }

    public function show(RetourVente $retour): JsonResponse
    {
        $this->verifierBoutique($retour);

        $retour->load(['vente.ligneVentes.produit', 'user', 'lignes.produit', 'lignes.ligneVente']);

        return response()->json($retour);
    }

    /**
     * Créer un retour sur une vente terminée.
     * Retour partiel : quantités spécifiques par ligne.
     * Retour total : toutes les lignes retournées en intégralité.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vente_id' => 'required|exists:ventes,id',
            'motif' => ['required', Rule::in(['defectueux', 'erreur_commande', 'insatisfait', 'autre'])],
            'motif_detail' => 'nullable|string|max:1000',
            'type' => ['required', Rule::in(['partiel', 'total'])],
            'notes' => 'nullable|string|max:1000',
            'lignes' => 'required_if:type,partiel|array|min:1',
            'lignes.*.ligne_vente_id' => 'required|exists:ligne_ventes,id',
            'lignes.*.quantite_retournee' => 'required|integer|min:1',
        ]);

        $vente = Vente::findOrFail($validated['vente_id']);
        $this->verifierBoutique($vente);

        if ($vente->statut !== 'termine') {
            return response()->json(['message' => 'Seules les ventes terminées peuvent faire l\'objet d\'un retour'], 422);
        }

        return DB::transaction(function () use ($validated, $vente, $request) {
            $type = $validated['type'];
            $montantTotalRembourse = 0;

            $retour = RetourVente::create([
                'vente_id' => $vente->id,
                'boutique_id' => $vente->boutique_id,
                'user_id' => $request->user()->id,
                'type' => $type,
                'motif' => $validated['motif'],
                'motif_detail' => $validated['motif_detail'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'statut' => 'en_attente',
                'montant_rembourse' => 0,
            ]);

            if ($type === 'total') {
                foreach ($vente->ligneVentes as $ligne) {
                    $montantLigne = $ligne->quantite * $ligne->prix_unitaire;
                    $montantTotalRembourse += $montantLigne;

                    RetourVenteLigne::create([
                        'retour_vente_id' => $retour->id,
                        'ligne_vente_id' => $ligne->id,
                        'produit_id' => $ligne->produit_id,
                        'quantite_retournee' => $ligne->quantite,
                        'prix_unitaire' => $ligne->prix_unitaire,
                        'montant_retourne' => $montantLigne,
                    ]);
                }
            } else {
                foreach ($validated['lignes'] as $ligneData) {
                    $ligneVente = $vente->ligneVentes()->findOrFail($ligneData['ligne_vente_id']);

                    if ($ligneData['quantite_retournee'] > $ligneVente->quantite) {
                        return response()->json([
                            'message' => "Quantité retournée supérieure à la quantité vendue pour le produit #{$ligneVente->produit_id}",
                        ], 422);
                    }

                    $montantLigne = $ligneData['quantite_retournee'] * $ligneVente->prix_unitaire;
                    $montantTotalRembourse += $montantLigne;

                    RetourVenteLigne::create([
                        'retour_vente_id' => $retour->id,
                        'ligne_vente_id' => $ligneVente->id,
                        'produit_id' => $ligneVente->produit_id,
                        'quantite_retournee' => $ligneData['quantite_retournee'],
                        'prix_unitaire' => $ligneVente->prix_unitaire,
                        'montant_retourne' => $montantLigne,
                    ]);
                }
            }

            $retour->update(['montant_rembourse' => $montantTotalRembourse]);

            $this->auditCreate($retour);

            return response()->json([
                'message' => 'Retour enregistré avec succès',
                'data' => $retour->load('lignes.produit'),
            ], 201);
        });
    }

    /**
     * Valider un retour : remettre le stock + marquer le statut.
     */
    public function valider(Request $request, RetourVente $retour): JsonResponse
    {
        $this->verifierBoutique($retour);

        if ($retour->statut !== 'en_attente') {
            return response()->json(['message' => 'Ce retour a déjà été traité'], 422);
        }

        return DB::transaction(function () use ($retour, $request) {
            foreach ($retour->lignes as $ligne) {
                $produit = Produit::whereKey($ligne->produit_id)->lockForUpdate()->first();

                if ($produit) {
                    $quantiteAvant = $produit->quantite_stock;
                    $quantiteApres = $quantiteAvant + $ligne->quantite_retournee;

                    $produit->update(['quantite_stock' => $quantiteApres]);

                    MouvementStock::create([
                        'produit_id' => $produit->id,
                        'quantite' => $ligne->quantite_retournee,
                        'raison' => 'retour',
                        'type' => 'entree',
                        'reference_bon' => (string) $retour->id,
                        'notes' => 'Retour vente #' . $retour->vente_id . ' — ' . $retour->motif,
                        'user_id' => $request->user()->id,
                        'statut' => 'accepte',
                        'quantite_avant' => $quantiteAvant,
                        'quantite_apres' => $quantiteApres,
                        'boutique_id' => $retour->boutique_id,
                    ]);
                }
            }

            $ancienStatut = $retour->statut;
            $retour->update(['statut' => 'valide']);
            $this->auditUpdate($retour, ['statut' => $ancienStatut]);

            return response()->json([
                'message' => 'Retour validé, stock mis à jour',
                'data' => $retour->load('lignes.produit'),
            ]);
        });
    }

    /**
     * Refuser un retour.
     */
    public function refuser(Request $request, RetourVente $retour): JsonResponse
    {
        $this->verifierBoutique($retour);

        if ($retour->statut !== 'en_attente') {
            return response()->json(['message' => 'Ce retour a déjà été traité'], 422);
        }

        $ancienStatut = $retour->statut;
        $retour->update(['statut' => 'refuse']);
        $this->auditUpdate($retour, ['statut' => $ancienStatut]);

        return response()->json([
            'message' => 'Retour refusé',
            'data' => $retour,
        ]);
    }

    protected function verifierBoutique($model): void
    {
        if (auth()->user()->current_boutique_id && $model->boutique_id !== auth()->user()->current_boutique_id) {
            abort(403, 'Non autorisé');
        }
    }
}
