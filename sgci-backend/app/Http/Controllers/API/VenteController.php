<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Vente;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\Client; // ✅ AJOUT IMPORTANT
use App\Models\MouvementStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log; // ✅ AJOUT DE L'IMPORT
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
            'client_id' => 'nullable|exists:clients,id',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $vente = new Vente();
            $vente->user_id = $request->user()->id;
            $vente->client_id = $validated['client_id'] ?? null;
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
                    'sous_total' => $prixUnitaire * $ligne['quantite'],
                ]);

                // Diminuer le stock et enregistrer le mouvement de vente
                $quantiteAvant = $produit->quantite_stock;
                $quantiteApres = $quantiteAvant - $ligne['quantite'];

                if ($quantiteApres < 0) {
                    throw new \Exception("Erreur lors de la diminution du stock pour: " . $produit->nom);
                }

                $produit->update(['quantite_stock' => $quantiteApres]);

                MouvementStock::create([
                    'produit_id' => $produit->id,
                    'quantite' => $ligne['quantite'],
                    'raison' => 'vente',
                    'type' => 'sortie',
                    'reference_bon' => $vente->id,
                    'notes' => 'Sortie de stock pour vente #' . $vente->id,
                    'user_id' => $request->user()->id,
                    'statut' => 'accepté',
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                ]);
            }

            // ✅ NOUVEAU : Mettre à jour les métriques du client si un client est associé
            if ($vente->client_id) {
                $this->mettreAJourMetriquesClient($vente->client_id);
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

                // ✅ NOUVEAU : Mettre à jour les métriques du client si annulation
                if ($vente->client_id) {
                    $this->mettreAJourMetriquesClient($vente->client_id);
                }

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

        // ✅ NOUVEAU : Sauvegarder l'ID client avant suppression
        $clientId = $vente->client_id;

        $vente->delete();

        // ✅ NOUVEAU : Mettre à jour les métriques du client après suppression
        if ($clientId) {
            $this->mettreAJourMetriquesClient($clientId);
        }

        return response()->json(['message' => 'Vente supprimée avec succès']);
    }

    /**
     * Panier en cours : crée une vente sans déduire le stock
     */
    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ligne_ventes' => 'required|array|min:1',
            'ligne_ventes.*.produit_id' => 'required|exists:produits,id',
            'ligne_ventes.*.quantite' => 'required|integer|min:1',
            'remise' => 'sometimes|numeric|min:0',
            'notes' => 'nullable|string',
            'client_id' => 'nullable|exists:clients,id',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $montantTotal = 0;

            foreach ($validated['ligne_ventes'] as $ligne) {
                $produit = Produit::findOrFail($ligne['produit_id']);
                if ($produit->quantite_stock < $ligne['quantite']) {
                    throw new \Exception("Stock insuffisant pour le produit: " . $produit->nom);
                }
                $montantTotal += $produit->prix * $ligne['quantite'];
            }

            $montantTotal -= $validated['remise'] ?? 0;

            $vente = Vente::create([
                'user_id' => $request->user()->id,
                'client_id' => $validated['client_id'] ?? null,
                'remise' => $validated['remise'] ?? 0,
                'notes' => $validated['notes'] ?? null,
                'statut' => 'en_cours',
                'montant_total' => $montantTotal,
                'tva' => $montantTotal * 0.18,
            ]);

            foreach ($validated['ligne_ventes'] as $ligne) {
                $produit = Produit::findOrFail($ligne['produit_id']);
                LigneVente::create([
                    'vente_id' => $vente->id,
                    'produit_id' => $ligne['produit_id'],
                    'quantite' => $ligne['quantite'],
                    'prix_unitaire' => $produit->prix,
                    'sous_total' => $produit->prix * $ligne['quantite'],
                ]);
            }

            $vente->load(['user', 'ligneVentes.produit', 'client']);

            return response()->json($vente, 201);
        });
    }

    public function terminer(Vente $vente): JsonResponse
    {
        if ($vente->statut !== 'en_cours') {
            return response()->json(['message' => 'Seule une vente en cours peut être terminée.'], 422);
        }

        $vente->terminer();

        if ($vente->client_id) {
            $this->mettreAJourMetriquesClient($vente->client_id);
        }

        $vente->load(['user', 'ligneVentes.produit', 'client']);

        return response()->json($vente);
    }

    public function annuler(Vente $vente): JsonResponse
    {
        if ($vente->statut === 'annule') {
            return response()->json(['message' => 'Cette vente est déjà annulée.'], 422);
        }

        if ($vente->statut === 'termine') {
            $vente->annuler();
            if ($vente->client_id) {
                $this->mettreAJourMetriquesClient($vente->client_id);
            }
        } else {
            $vente->update(['statut' => 'annule']);
        }

        $vente->load(['user', 'ligneVentes.produit', 'client']);

        return response()->json($vente);
    }

    public function statsVentesAujourdhui(): JsonResponse
    {
        $query = Vente::whereDate('created_at', today())->where('statut', 'termine');
        $nombre = $query->count();
        $montant = (float) $query->sum('montant_total');

        return response()->json([
            'date' => today()->toDateString(),
            'nombre_ventes' => $nombre,
            'montant_total' => $montant,
            'montant_moyen' => $nombre > 0 ? round($montant / $nombre, 2) : 0,
        ]);
    }

    public function genererFacture(Vente $vente): JsonResponse
    {
        $vente->load(['user', 'ligneVentes.produit', 'client']);

        return response()->json([
            'numero_vente' => $vente->numero_vente,
            'date' => $vente->created_at,
            'statut' => $vente->statut,
            'caissier' => $vente->user?->name,
            'client' => $vente->client,
            'lignes' => $vente->ligneVentes,
            'montant_total' => $vente->montant_total,
            'tva' => $vente->tva,
            'remise' => $vente->remise,
            'notes' => $vente->notes,
        ]);
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

    /**
     * ✅ NOUVELLE MÉTHODE : Met à jour les métriques d'un client (total_achats et nombre_commandes)
     *
     * @param int $clientId
     * @return void
     */
    private function mettreAJourMetriquesClient($clientId): void
    {
        try {
            $client = Client::find($clientId);

            if ($client) {
                // Recalculer le total des achats (ventes terminées uniquement)
                $totalAchats = Vente::where('client_id', $clientId)
                    ->where('statut', 'termine')
                    ->sum('montant_total');

                // Recalculer le nombre de commandes (ventes terminées uniquement)
                $nombreCommandes = Vente::where('client_id', $clientId)
                    ->where('statut', 'termine')
                    ->count();

                // Mettre à jour le client uniquement si les valeurs ont changé
                if ($client->total_achats != $totalAchats || $client->nombre_commandes != $nombreCommandes) {
                    $client->update([
                        'total_achats' => $totalAchats,
                        'nombre_commandes' => $nombreCommandes
                    ]);

                    // Log pour débogage
                    Log::info("Métriques client mises à jour", [
                        'client_id' => $clientId,
                        'nom' => $client->nom,
                        'ancien_total' => $client->total_achats,
                        'nouveau_total' => $totalAchats,
                        'ancien_nb_commandes' => $client->nombre_commandes,
                        'nouveau_nb_commandes' => $nombreCommandes
                    ]);
                }
            }
        } catch (\Exception $e) {
            // Log l'erreur mais ne pas interrompre le processus
            Log::error("Erreur lors de la mise à jour des métriques du client", [
                'client_id' => $clientId,
                'error' => $e->getMessage()
            ]);
        }
    }
}
