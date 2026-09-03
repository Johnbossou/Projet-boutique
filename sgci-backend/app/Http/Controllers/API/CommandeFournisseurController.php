<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CommandeFournisseur;
use App\Models\LigneCommandeFournisseur;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Traits\Auditable;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CommandeFournisseurController extends Controller
{
    use Auditable;
    /**
     * Affiche la liste des commandes fournisseurs de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = CommandeFournisseur::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['fournisseur', 'user', 'lignes.produit']);

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par fournisseur
        if ($request->has('fournisseur_id') && $request->fournisseur_id) {
            $query->where('fournisseur_id', $request->fournisseur_id);
        }

        // Filtre par date
        if ($request->has('date_debut') && $request->date_debut) {
            $query->where('date_commande', '>=', $request->date_debut);
        }
        if ($request->has('date_fin') && $request->date_fin) {
            $query->where('date_commande', '<=', $request->date_fin);
        }

        $commandes = $query->orderBy('date_commande', 'desc')->paginate(15);

        return response()->json([
            'data' => $commandes->items(),
            'total' => $commandes->total(),
            'per_page' => $commandes->perPage(),
            'current_page' => $commandes->currentPage(),
            'last_page' => $commandes->lastPage(),
        ]);
    }

    /**
     * Crée une nouvelle commande fournisseur
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fournisseur_id' => 'required|exists:fournisseurs,id',
            'date_livraison_prevue' => 'nullable|date',
            'conditions_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
            'lignes' => 'required|array|min:1',
            'lignes.*.produit_id' => 'required|exists:produits,id',
            'lignes.*.quantite_commandee' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $commande = CommandeFournisseur::create([
                'fournisseur_id' => $validated['fournisseur_id'],
                'boutique_id' => $request->user()->current_boutique_id,
                'date_commande' => now(),
                'date_livraison_prevue' => $validated['date_livraison_prevue'] ?? null,
                'statut' => 'en_attente',
                'conditions_paiement' => $validated['conditions_paiement'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()->id,
                'montant_total' => 0,
                'montant_paye' => 0,
            ]);

            $montantTotal = 0;

            foreach ($validated['lignes'] as $ligneData) {
                $montantLigne = $ligneData['quantite_commandee'] * $ligneData['prix_unitaire'];
                $montantTotal += $montantLigne;

                LigneCommandeFournisseur::create([
                    'commande_fournisseur_id' => $commande->id,
                    'produit_id' => $ligneData['produit_id'],
                    'quantite_commandee' => $ligneData['quantite_commandee'],
                    'quantite_recue' => 0,
                    'prix_unitaire' => $ligneData['prix_unitaire'],
                    'montant_total' => $montantLigne,
                    'statut' => 'en_attente',
                ]);
            }

            $commande->update(['montant_total' => $montantTotal]);

            $this->auditCreate($commande);

            return response()->json([
                'message' => 'Commande fournisseur créée avec succès',
                'data' => $commande->load('fournisseur', 'lignes.produit'),
            ], 201);
        });
    }

    /**
     * Affiche une commande fournisseur spécifique
     */
    public function show(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commande->load(['fournisseur', 'user', 'lignes.produit']);

        return response()->json($commande);
    }

    /**
     * Met à jour une commande fournisseur
     */
    public function update(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Seules les commandes en attente peuvent être modifiées
        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être modifiées',
            ], 400);
        }

        $validated = $request->validate([
            'date_livraison_prevue' => 'nullable|date',
            'conditions_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $commande->update($validated);

        return response()->json([
            'message' => 'Commande mise à jour avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Valide une commande fournisseur
     */
    public function valider(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être validées',
            ], 400);
        }

        $commande->update(['statut' => 'en_cours']);

        $this->auditUpdate($commande, ['statut' => 'en_attente']);

        return response()->json([
            'message' => 'Commande validée avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Enregistre un règlement sur une commande fournisseur.
     * Accumule dans montant_paye sans jamais dépasser montant_total.
     */
    public function payer(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (in_array($commande->statut, ['annule', 'livre'], true)) {
            return response()->json([
                'message' => 'Cette commande ne peut plus recevoir de paiement',
            ], 400);
        }

        $validated = $request->validate([
            'montant' => 'required|numeric|min:1',
        ]);

        $montantPaiement = (float) $validated['montant'];
        $montantTotal = (float) $commande->montant_total;
        $montantPaye = (float) $commande->montant_paye;

        if ($montantPaye >= $montantTotal) {
            return response()->json([
                'message' => 'Cette commande est déjà entièrement payée',
            ], 400);
        }

        $reste = round($montantTotal - $montantPaye, 2);
        if ($montantPaiement > $reste) {
            return response()->json([
                'message' => "Le règlement dépasse le reste à payer ({$reste} XOF)",
            ], 422);
        }

        $commande->montant_paye += $montantPaiement;
        $commande->save();

        $this->auditUpdate($commande, ['montant_paye' => $montantPaye]);

        return response()->json([
            'message' => 'Règlement enregistré',
            'data' => $commande->fresh(),
        ]);
    }

    /**
     * Réceptionne tout ou partie des lignes d'une commande fournisseur validée.
     * Chaque quantité reçue est tracée via un mouvement de stock « arrivage » validé
     * (le stock de la boutique est incrémenté) et reportée sur quantite_recue.
     * La commande passe en « livre » lorsque toutes les lignes sont entièrement reçues.
     */
    public function receptionner(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_cours') {
            return response()->json([
                'message' => 'Seules les commandes en cours peuvent être réceptionnées',
            ], 400);
        }

        $validated = $request->validate([
            'lignes' => 'required|array|min:1',
            'lignes.*.ligne_id' => 'required|exists:ligne_commande_fournisseurs,id',
            'lignes.*.quantite_recue' => 'required|integer|min:1',
        ]);

        $lignes = $commande->lignes->keyBy('id');

        DB::beginTransaction();
        try {
            $reccu = [];

            foreach ($validated['lignes'] as $receptionLigne) {
                $ligne = $lignes->get($receptionLigne['ligne_id']);

                if (!$ligne || $ligne->commande_fournisseur_id !== $commande->id) {
                    throw new \InvalidArgumentException("Ligne invalide pour cette commande : {$receptionLigne['ligne_id']}");
                }

                $quantiteRecue = (int) $receptionLigne['quantite_recue'];
                $restant = $ligne->quantite_restante;

                if ($quantiteRecue > $restant) {
                    throw new \InvalidArgumentException(
                        "La quantité reçue dépasse le restant attendu (produit {$ligne->produit_id})"
                    );
                }

                $produit = Produit::findOrFail($ligne->produit_id);
                $quantiteAvant = $produit->quantite_stock;

                // Mouvement de stock tracé et directement validé (arrivage)
                $mouvement = MouvementStock::create([
                    'produit_id' => $produit->id,
                    'type' => 'entree',
                    'quantite' => $quantiteRecue,
                    'raison' => 'arrivage',
                    'reference_bon' => $commande->numero_commande,
                    'user_id' => $request->user()->id,
                    'statut' => 'accepte',
                    'notes' => "Réception commande fournisseur #{$commande->numero_commande}",
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteAvant + $quantiteRecue,
                    'boutique_id' => $commande->boutique_id,
                ]);

                $produit->update(['quantite_stock' => $quantiteAvant + $quantiteRecue]);

                $ligne->quantite_recue += $quantiteRecue;
                $ligne->statut = $ligne->estEntierementRecue() ? 'recu' : 'partiel';
                $ligne->save();

                $reccu[] = [
                    'ligne_id' => $ligne->id,
                    'produit_id' => $produit->id,
                    'quantite_recue' => $quantiteRecue,
                    'quantite_restante' => $ligne->quantite_restante,
                    'mouvement_id' => $mouvement->id,
                    'stock_apres' => $produit->quantite_stock,
                ];

                $this->auditCreate($mouvement);
            }

            // Toutes les lignes reçues en intégralité => commande livrée
            $toutesRecues = $commande->lignes->every->estEntierementRecue();
            if ($toutesRecues) {
                $commande->update([
                    'statut' => 'livre',
                    'date_livraison_reelle' => now(),
                ]);
            }

            $commande->refresh();

            DB::commit();

            return response()->json([
                'message' => 'Réception enregistrée, stock mis à jour',
                'data' => [
                    'commande' => $commande->load('lignes.produit', 'fournisseur'),
                    'receptions' => $reccu,
                ],
            ]);
        } catch (\InvalidArgumentException $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la réception'], 500);
        }
    }

    /**
     * Annule une commande fournisseur
     */
    public function annuler(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!in_array($commande->statut, ['en_attente', 'en_cours'])) {
            return response()->json([
                'message' => 'Seules les commandes en attente ou en cours peuvent être annulées',
            ], 400);
        }

        $ancienStatut = $commande->statut;
        $commande->update(['statut' => 'annule']);

        $this->auditUpdate($commande, ['statut' => $ancienStatut]);

        return response()->json([
            'message' => 'Commande annulée avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Supprime (soft delete) une commande fournisseur
     */
    public function destroy(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être supprimées',
            ], 400);
        }

        $this->auditDelete($commande);
        $commande->delete();

        return response()->json(['message' => 'Commande supprimée avec succès']);
    }

    /**
     * Liste les produits dont le stock est sous le seuil, avec quantité suggérée à commander.
     * Ordonnance d'achat automatique pour le gérant.
     */
    public function suggestions(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $produits = \App\Models\Produit::where('boutique_id', $boutiqueId)
            ->enAlerte()
            ->with('categorie')
            ->get()
            ->map(function ($produit) {
                // Commander 2× le seuil d'alerte pour avoir une marge
                $quantiteSuggeree = max(1, ($produit->seuil_alerte * 2) - $produit->quantite_stock);

                return [
                    'produit_id' => $produit->id,
                    'nom' => $produit->nom,
                    'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                    'stock_actuel' => $produit->quantite_stock,
                    'seuil_alerte' => $produit->seuil_alerte,
                    'quantite_suggeree' => $quantiteSuggeree,
                    'rupture' => $produit->estEnRupture(),
                ];
            });

        return response()->json([
            'data' => $produits,
            'total' => $produits->count(),
        ]);
    }
}
