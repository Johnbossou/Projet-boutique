<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Vente;
use App\Models\Produit;
use App\Models\LigneVente;
use App\Models\Categorie;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyticsController extends Controller
{
    private function boutiqueId(Request $request): int
    {
        return $request->user()->current_boutique_id;
    }

    /**
     * Get date range based on period parameter
     */
    private function getDateRange($periode)
    {
        return match($periode) {
            '7j' => Carbon::now()->subDays(7),
            '30j' => Carbon::now()->subDays(30),
            '90j' => Carbon::now()->subDays(90),
            default => Carbon::now()->subDays(30)
        };
    }

    /**
     * GET /api/analytics/stats-globales
     * Returns global stats with period filtering
     */
    public function statsGlobales(Request $request): JsonResponse
    {
        $periode = $request->get('periode', '30j');
        $dateDebut = $this->getDateRange($periode);
        $boutiqueId = $this->boutiqueId($request);

        // Stats des ventes avec filtre de période
        $statsVentes = Vente::where('statut', 'termine')
            ->where('boutique_id', $boutiqueId)
            ->where('created_at', '>=', $dateDebut)
            ->select(
                DB::raw('COUNT(*) as total_ventes'),
                DB::raw('SUM(montant_total) as chiffre_affaires_total'),
                DB::raw('AVG(montant_total) as panier_moyen')
            )
            ->first();

        // Stats des produits (toujours le total, pas de filtre période)
        $statsProduits = Produit::where('boutique_id', $boutiqueId)
            ->select(
            DB::raw('COUNT(*) as total_produits'),
            DB::raw('SUM(quantite_stock) as total_stock'),
            DB::raw('SUM(prix * quantite_stock) as valeur_stock_total')
        )->first();

        $produitsEnAlerte = Produit::enAlerte()->where('boutique_id', $boutiqueId)->count();
        $produitsEnRupture = Produit::enRupture()->where('boutique_id', $boutiqueId)->count();

        return response()->json([
            'ventes' => [
                'total_ventes' => $statsVentes->total_ventes ?? 0,
                'chiffre_affaires_total' => $statsVentes->chiffre_affaires_total ?? 0,
                'panier_moyen' => $statsVentes->panier_moyen ?? 0
            ],
            'produits' => [
                'total_produits' => $statsProduits->total_produits ?? 0,
                'total_stock' => $statsProduits->total_stock ?? 0,
                'valeur_stock_total' => $statsProduits->valeur_stock_total ?? 0,
                'produits_en_alerte' => $produitsEnAlerte,
                'produits_en_rupture' => $produitsEnRupture
            ],
            'metadata' => [
                'periode' => $periode,
                'date_debut' => $dateDebut->toISOString(),
                'date_fin' => Carbon::now()->toISOString()
            ]
        ]);
    }

    /**
     * GET /api/analytics/ventes-quotidiennes
     * Returns daily sales with period filtering
     */
    public function ventesQuotidiennes(Request $request): JsonResponse
    {
        $periode = $request->get('periode', '30j');
        $dateDebut = $this->getDateRange($periode);
        $boutiqueId = $this->boutiqueId($request);

        $ventes = Vente::where('statut', 'termine')
            ->where('boutique_id', $boutiqueId)
            ->where('created_at', '>=', $dateDebut)
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as nombre_ventes'),
                DB::raw('SUM(montant_total) as chiffre_affaires')
            )
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->get();

        return response()->json($ventes);
    }

    /**
     * GET /api/analytics/ventes-mensuelles
     * Returns monthly sales (kept for compatibility)
     */
    public function ventesMensuelles(Request $request): JsonResponse
    {
        $boutiqueId = $this->boutiqueId($request);

        $ventes = Vente::where('statut', 'termine')
            ->where('boutique_id', $boutiqueId)
            ->select(
                DB::raw('YEAR(created_at) as annee'),
                DB::raw('MONTH(created_at) as mois'),
                DB::raw('COUNT(*) as nombre_ventes'),
                DB::raw('SUM(montant_total) as chiffre_affaires')
            )
            ->groupBy('annee', 'mois')
            ->orderBy('annee', 'desc')
            ->orderBy('mois', 'desc')
            ->limit(12)
            ->get();

        return response()->json($ventes);
    }

    /**
     * GET /api/analytics/produits-populaires
     * Returns popular products with period filtering and limit
     */
    public function produitsPopulaires(Request $request): JsonResponse
    {
        $periode = $request->get('periode', '30j');
        $limit = $request->get('limit', 10);
        $dateDebut = $this->getDateRange($periode);
        $boutiqueId = $this->boutiqueId($request);

        $produits = LigneVente::with('produit')
            ->whereHas('vente', function($query) use ($dateDebut, $boutiqueId) {
                $query->where('statut', 'termine')
                      ->where('boutique_id', $boutiqueId)
                      ->where('created_at', '>=', $dateDebut);
            })
            ->select(
                'produit_id',
                DB::raw('SUM(quantite) as total_vendus'),
                DB::raw('SUM(sous_total) as chiffre_affaires')
            )
            ->groupBy('produit_id')
            ->orderBy('total_vendus', 'desc')
            ->limit($limit)
            ->get();

        return response()->json($produits);
    }

    /**
     * GET /api/analytics/chiffre-affaires
     * Returns revenue stats (kept for compatibility)
     */
    public function chiffreAffaires(Request $request): JsonResponse
    {
        $boutiqueId = $this->boutiqueId($request);

        $chiffreAffaires = Vente::where('statut', 'termine')
            ->where('boutique_id', $boutiqueId)
            ->select(
                DB::raw('SUM(montant_total) as total'),
                DB::raw('AVG(montant_total) as panier_moyen'),
                DB::raw('COUNT(*) as nombre_ventes')
            )
            ->first();

        return response()->json($chiffreAffaires);
    }

    /**
     * GET /api/analytics/repartition-categories
     * NEW - Returns sales distribution by category for pie chart
     */
    public function repartitionCategories(Request $request): JsonResponse
    {
        $periode = $request->get('periode', '30j');
        $dateDebut = $this->getDateRange($periode);
        $boutiqueId = $this->boutiqueId($request);

        $categories = LigneVente::join('ventes', 'ligne_ventes.vente_id', '=', 'ventes.id')
            ->join('produits', 'ligne_ventes.produit_id', '=', 'produits.id')
            ->join('categories', 'produits.categorie_id', '=', 'categories.id')
            ->where('ventes.statut', 'termine')
            ->where('ventes.boutique_id', $boutiqueId)
            ->where('ventes.created_at', '>=', $dateDebut)
            ->select(
                'categories.id as categorie_id',
                'categories.nom as categorie',
                DB::raw('SUM(ligne_ventes.sous_total) as chiffre_affaires'),
                DB::raw('SUM(ligne_ventes.quantite) as total_vendus')
            )
            ->groupBy('categories.id', 'categories.nom')
            ->orderBy('chiffre_affaires', 'desc')
            ->get();

        return response()->json($categories);
    }

    /**
     * GET /api/analytics/export
     * NEW - Returns all analytics data for export
     */
    public function exportAnalytics(Request $request): JsonResponse
    {
        $periode = $request->get('periode', '30j');
        $format = $request->get('format', 'json');

        // Collect all data for export
        $data = [
            'stats_globales' => $this->statsGlobales($request)->getData(true),
            'ventes_quotidiennes' => $this->ventesQuotidiennes($request)->getData(true),
            'produits_populaires' => $this->produitsPopulaires($request)->getData(true),
            'repartition_categories' => $this->repartitionCategories($request)->getData(true),
            'metadata' => [
                'periode' => $periode,
                'exported_at' => now()->toISOString(),
                'timezone' => config('app.timezone'),
                'format' => $format
            ]
        ];

        return response()->json($data);
    }

    /**
     * GET /api/analytics/alertes-stock
     * NEW - Returns stock alerts for the dashboard
     */
    public function alertesStock(Request $request): JsonResponse
    {
        $boutiqueId = $this->boutiqueId($request);

        $produitsEnAlerte = Produit::enAlerte()
            ->where('boutique_id', $boutiqueId)
            ->with('categorie')
            ->select('id', 'nom', 'quantite_stock', 'seuil_alerte', 'prix', 'categorie_id')
            ->orderBy('quantite_stock', 'asc')
            ->limit(10)
            ->get();

        $produitsEnRupture = Produit::enRupture()
            ->where('boutique_id', $boutiqueId)
            ->with('categorie')
            ->select('id', 'nom', 'quantite_stock', 'seuil_alerte', 'prix', 'categorie_id')
            ->orderBy('quantite_stock', 'asc')
            ->limit(10)
            ->get();

        return response()->json([
            'produits_en_alerte' => $produitsEnAlerte,
            'produits_en_rupture' => $produitsEnRupture,
            'total_en_alerte' => $produitsEnAlerte->count(),
            'total_en_rupture' => $produitsEnRupture->count()
        ]);
    }
}
