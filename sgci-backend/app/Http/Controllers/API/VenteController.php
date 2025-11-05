<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Vente;
use App\Models\LigneVente;
use App\Models\Produit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class VenteController extends Controller
{
    /**
     * Affiche la liste des ventes avec pagination
     */
    public function index(Request $request): JsonResponse
    {
        $query = Vente::with(['user', 'ligneVentes.produit']);

        // Filtre par date
        if ($request->has('date_debut') && $request->date_debut) {
            $query->whereDate('created_at', '>=', $request->date_debut);
        }

        if ($request->has('date_fin') && $request->date_fin) {
            $query->whereDate('created_at', '<=', $request->date_fin);
        }

        // Filtre par caissier
        if ($request->has('user_id') && $request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        $ventes = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($ventes);
    }

    /**
     * Enregistre une nouvelle vente
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ligne_ventes' => 'required|array|min:1',
            'ligne_ventes.*.produit_id' => 'required|exists:produits,id',
            'ligne_ventes.*.quantite' => 'required|integer|min:1',
            'remise' => 'sometimes|numeric|min:0',
            'notes' => 'nullable|string',
            'client_id' => 'nullable|exists:clients,id', // ⬅️ NOUVEAU - OPTIONNEL
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $vente = new Vente();
            $vente->user_id = $request->user()->id;
            $vente->client_id = $validated['client_id'] ?? null; // ⬅️ NOUVEAU - NULL par défaut
            $vente->remise = $validated['remise'] ?? 0;
            $vente->notes = $validated['notes'] ?? null;
            $vente->statut = 'termine';

            // Calcul du total
            $montantTotal = 0;

            foreach ($validated['ligne_ventes'] as $ligne) {
                $produit = Produit::find($ligne['produit_id']);

                // Vérifier le stock
                if ($produit->quantite_stock < $ligne['quantite']) {
                    throw new \Exception("Stock insuffisant pour le produit: " . $produit->nom);
                }

                $prixUnitaire = $produit->prix;
                $sousTotal = $prixUnitaire * $ligne['quantite'];
                $montantTotal += $sousTotal;
            }

            // Appliquer la remise
            $montantTotal -= $validated['remise'] ?? 0;
            $vente->montant_total = $montantTotal;

            // TVA (18%)
            $vente->tva = $montantTotal * 0.18;

            $vente->save();

            // Créer les lignes de vente
            foreach ($validated['ligne_ventes'] as $ligne) {
                $produit = Produit::find($ligne['produit_id']);
                $prixUnitaire = $produit->prix;

                LigneVente::create([
                    'vente_id' => $vente->id,
                    'produit_id' => $ligne['produit_id'],
                    'quantite' => $ligne['quantite'],
                    'prix_unitaire' => $prixUnitaire,
                    'sous_total' => $prixUnitaire * $ligne['quantite'], // ⬅️ CORRECTION IMPORTANTE !
                ]);

                // Diminuer le stock - CORRECTION avec vérification
                if (!$produit->diminuerStock($ligne['quantite'])) {
                    throw new \Exception("Erreur lors de la diminution du stock pour: " . $produit->nom);
                }
            }

            // Charger les relations avec le client
            $vente->load(['user', 'ligneVentes.produit', 'client']);

            return response()->json($vente, 201);
        });
    }

    /**
     * Affiche une vente spécifique
     */
    public function show(Vente $vente): JsonResponse
    {
        $vente->load(['user', 'ligneVentes.produit']);
        return response()->json($vente);
    }

    /**
     * Met à jour une vente (surtout pour annuler)
     */
    public function update(Request $request, Vente $vente): JsonResponse
    {
        // Seulement pour annuler une vente
        if ($request->has('statut') && $request->statut == 'annule') {
            if ($vente->statut != 'annule') {
                $vente->annuler();
                $vente->load(['user', 'ligneVentes.produit']);
                return response()->json($vente);
            }
        }

        return response()->json(['message' => 'Action non autorisée'], 403);
    }

    /**
     * Supprime une vente (si annulée)
     */
    public function destroy(Vente $vente): JsonResponse
    {
        // On ne permet la suppression que si la vente est annulée
        if ($vente->statut != 'annule') {
            return response()->json([
                'message' => 'Impossible de supprimer une vente non annulée.'
            ], 422);
        }

        $vente->delete();

        return response()->json(['message' => 'Vente supprimée avec succès']);
    }

    /**
     * Statistiques des ventes
     */
    public function statistiques(Request $request): JsonResponse
    {
        // Chiffre d'affaires par jour
        $caParJour = Vente::where('statut', 'termine')
            ->selectRaw('DATE(created_at) as date, SUM(montant_total) as total')
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->limit(30)
            ->get();

        // Produits les plus vendus
        $produitsPopulaires = LigneVente::with('produit')
            ->select('produit_id', DB::raw('SUM(quantite) as total_vendus'))
            ->groupBy('produit_id')
            ->orderBy('total_vendus', 'desc')
            ->limit(10)
            ->get();

        // Total des ventes du jour
        $caAujourdhui = Vente::whereDate('created_at', today())
            ->where('statut', 'termine')
            ->sum('montant_total');

        // Total des ventes du mois
        $caMois = Vente::whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->where('statut', 'termine')
            ->sum('montant_total');

        return response()->json([
            'ca_par_jour' => $caParJour,
            'produits_populaires' => $produitsPopulaires,
            'ca_aujourdhui' => $caAujourdhui,
            'ca_mois' => $caMois,
        ]);
    }
}
