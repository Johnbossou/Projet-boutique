<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\MouvementStock;
use App\Models\Produit;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MouvementStockController extends Controller
{
    private function userEstGerant(): bool
    {
        return auth()->check() && auth()->user()->role === 'gerant';
    }

    /**
     * Affiche l'historique des mouvements de stock avec filtres
     */
    public function index(Request $request): JsonResponse
    {
        $query = MouvementStock::with(['produit', 'user'])
            ->orderBy('created_at', 'desc');

        // Filtre par boutique courante (multi-tenancy)
        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        // Filtres
        if ($request->has('produit_id')) {
            $query->where('produit_id', $request->produit_id);
        }

        if ($request->has('raison')) {
            $query->where('raison', $request->raison);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('statut')) {
            $query->where('statut', $request->statut);
        }

        if ($request->has('date_debut') && $request->has('date_fin')) {
            $query->whereBetween('created_at', [
                $request->date_debut . ' 00:00:00',
                $request->date_fin . ' 23:59:59'
            ]);
        }

        $mouvements = $query->paginate($request->per_page ?? 25);
        return response()->json($mouvements);
    }

    /**
     * Crée un nouveau mouvement de stock (arrivage)
     * Statut par défaut: "en_attente" jusqu'à validation
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'produit_id' => 'required|exists:produits,id',
            'quantite' => 'required|integer|min:1',
            'raison' => 'required|in:arrivage,vente,ajustement,retour,casse',
            'type' => 'required|in:entrée,sortie',
            'reference_bon' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        // Récupérer le produit et sauvegarder stock actuel
        $produit = Produit::findOrFail($validated['produit_id']);
        $quantiteAvant = $produit->quantite_stock;

        DB::beginTransaction();
        try {
            // Créer le mouvement en attente
            $mouvement = MouvementStock::create([
                'produit_id' => $validated['produit_id'],
                'quantite' => $validated['quantite'],
                'raison' => $validated['raison'],
                'type' => $validated['type'],
                'reference_bon' => $validated['reference_bon'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => auth()->id(),
                'statut' => 'en_attente',
                'quantite_avant' => $quantiteAvant,
                'quantite_apres' => $quantiteAvant, // Sera mis à jour lors de l'acceptation
                'boutique_id' => auth()->user()->current_boutique_id,
            ]);

            DB::commit();
            return response()->json([
                'message' => 'Mouvement de stock créé en attente de validation',
                'mouvement' => $mouvement->load(['produit', 'user']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Valide un mouvement en attente et applique le changement de stock
     */
    public function valider(MouvementStock $mouvement): JsonResponse
    {
        if (!$this->userEstGerant()) {
            return response()->json(['error' => 'Permission refusée'], 403);
        }

        if ($mouvement->statut !== 'en_attente') {
            return response()->json([
                'error' => 'Ce mouvement a déjà été traité'
            ], 400);
        }

        $produit = $mouvement->produit;
        DB::beginTransaction();
        try {
            // Calculer la nouvelle quantité
            $quantiteApres = $mouvement->type === 'entrée'
                ? $produit->quantite_stock + $mouvement->quantite
                : $produit->quantite_stock - $mouvement->quantite;

            // Vérifier qu'on ne peut pas avoir négatif (sauf ajustement)
            if ($quantiteApres < 0 && $mouvement->raison !== 'ajustement') {
                DB::rollBack();
                return response()->json([
                    'error' => 'Stock insuffisant pour cette sortie',
                    'stock_actuel' => $produit->quantite_stock,
                    'demande' => $mouvement->quantite
                ], 400);
            }

            // Mettre à jour le stock du produit
            $produit->update(['quantite_stock' => $quantiteApres]);

            // Mettre à jour le mouvement comme accepté
            $mouvement->update([
                'statut' => 'accepté',
                'quantite_apres' => $quantiteApres,
            ]);

            DB::commit();
            return response()->json([
                'message' => 'Mouvement de stock accepté et stock mis à jour',
                'mouvement' => $mouvement->load(['produit', 'user']),
                'stock_precedent' => $mouvement->quantite_avant,
                'stock_nouveau' => $quantiteApres,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Rejette un mouvement en attente
     */
    public function rejeter(Request $request, MouvementStock $mouvement): JsonResponse
    {
        if (!$this->userEstGerant()) {
            return response()->json(['error' => 'Permission refusée'], 403);
        }

        if ($mouvement->statut !== 'en_attente') {
            return response()->json([
                'error' => 'Ce mouvement a déjà été traité'
            ], 400);
        }

        $validated = $request->validate([
            'raison_rejet' => 'required|string|max:255',
        ]);

        $mouvement->update([
            'statut' => 'rejeté',
            'notes' => 'REJETÉ: ' . $validated['raison_rejet'],
        ]);

        return response()->json([
            'message' => 'Mouvement rejeté',
            'mouvement' => $mouvement->load(['produit', 'user']),
        ]);
    }

    /**
     * Affiche un mouvement spécifique
     */
    public function show(MouvementStock $mouvement): JsonResponse
    {
        return response()->json($mouvement->load(['produit', 'user']));
    }

    /**
     * Statistiques des mouvements
     */
    public function statistiques(Request $request): JsonResponse
    {
        $dateFin = now();
        $dateDebut = $dateFin->clone()->subDays($request->jours ?? 30);

        $query = MouvementStock::acceptes()
            ->whereBetween('created_at', [$dateDebut, $dateFin]);

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        $mouvements = $query->get();

        return response()->json([
            'total_entrees' => $mouvements->where('type', 'entrée')->sum('quantite'),
            'total_sorties' => $mouvements->where('type', 'sortie')->sum('quantite'),
            'arrivages' => $mouvements->where('raison', 'arrivage')->count(),
            'ventes' => $mouvements->where('raison', 'vente')->count(),
            'ajustements' => $mouvements->where('raison', 'ajustement')->count(),
            'retours' => $mouvements->where('raison', 'retour')->count(),
            'casses' => $mouvements->where('raison', 'casse')->count(),
            'periode' => [
                'debut' => $dateDebut->format('Y-m-d'),
                'fin' => $dateFin->format('Y-m-d'),
            ]
        ]);
    }

    /**
     * Export des mouvements pour audit
     */
    public function export(Request $request): JsonResponse
    {
        $query = MouvementStock::with(['produit', 'user']);

        // Filtre par boutique courante (multi-tenancy)
        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        if ($request->has('date_debut') && $request->has('date_fin')) {
            $query->whereBetween('created_at', [
                $request->date_debut . ' 00:00:00',
                $request->date_fin . ' 23:59:59'
            ]);
        }

        $mouvements = $query->get();

        return response()->json($mouvements->map(function ($m) {
            return [
                'id' => $m->id,
                'produit' => $m->produit->nom,
                'type' => $m->libelle_type,
                'raison' => $m->libelle_raison,
                'quantite' => $m->quantite,
                'statut' => $m->libelle_statut,
                'stock_avant' => $m->quantite_avant,
                'stock_apres' => $m->quantite_apres,
                'reference_bon' => $m->reference_bon,
                'user' => $m->user->name,
                'date' => $m->created_at->format('Y-m-d H:i:s'),
                'notes' => $m->notes,
            ];
        }));
    }
}
