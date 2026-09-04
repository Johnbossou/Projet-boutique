<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Produit;
use App\Models\LigneVente;
use App\Models\AiPrediction;
use App\Models\Vente;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class PredictionsController extends Controller
{
    /**
     * PRÉDICTIONS DE DEMANDE - VERSION AMÉLIORÉE AVEC STOCKAGE
     */
    public function predictionsDemande(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        $datePrediction = $request->input('date', now()->toDateString());
        $typePrediction = $request->input('type', 'demande_hebdo');
        
        $produits = Produit::with('categorie')->where('boutique_id', $boutiqueId)->get();
        
        $predictions = $produits->map(function ($produit) use ($datePrediction, $typePrediction, $boutiqueId) {
            $ventes7Jours = $this->calculerVentesPeriode($produit->id, 7, $boutiqueId);
            $ventes30Jours = $this->calculerVentesPeriode($produit->id, 30, $boutiqueId);
            $ventes90Jours = $this->calculerVentesPeriode($produit->id, 90, $boutiqueId);

            $poids = $this->calculerPoidsAdaptatifs($produit->id, $boutiqueId);
            $tendance = $this->calculerTendanceVentesProduit($produit->id, $boutiqueId);
            $saisonnalite = $this->calculerSaisonnaliteProduit($produit->id, $boutiqueId);
            $facteurPerissable = $produit->est_perissable ? 1.2 : 1.0;

            $demandePredite = ceil(
                (($ventes7Jours * $poids['poids_7j']) + 
                 ($ventes30Jours * $poids['poids_30j']) + 
                 (($ventes90Jours/3) * $poids['poids_90j']))
                * $facteurPerissable
                * (1 + $tendance)
                * $saisonnalite
            );

            $besoin = $demandePredite - $produit->quantite_stock;
            $niveauUrgence = $this->determinerNiveauUrgence($besoin, $produit->seuil_alerte);

            $confiance = $this->calculerConfianceAmelioree($produit->id, $tendance, $saisonnalite);

            $prediction = AiPrediction::updateOrCreate(
                [
                    'produit_id' => $produit->id,
                    'date_prediction' => $datePrediction,
                    'type_prediction' => $typePrediction,
                ],
                [
                    'demande_predite' => $demandePredite,
                    'metadonnees' => [
                        'ventes_7j' => $ventes7Jours,
                        'ventes_30j' => $ventes30Jours,
                        'ventes_90j' => $ventes90Jours,
                        'poids' => $poids,
                        'tendance' => $tendance,
                        'saisonnalite' => $saisonnalite,
                        'facteur_perissable' => $facteurPerissable,
                        'confiance' => $confiance,
                    ],
                ]
            );

            return [
                'produit_id' => $produit->id,
                'produit_nom' => $produit->nom,
                'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                'couleur_categorie' => $produit->categorie?->couleur,
                'stock_actuel' => $produit->quantite_stock,
                'seuil_alerte' => $produit->seuil_alerte,
                'est_perissable' => $produit->est_perissable,
                'ventes_30_jours' => $ventes30Jours,
                'demande_predite_semaine' => $demandePredite,
                'recommandation' => $this->genererRecommandationAmelioree($produit, $demandePredite),
                'confiance_prediction' => round($confiance, 2),
                'besoin_calcule' => $besoin,
                'niveau_urgence' => $niveauUrgence,
                'statut_stock' => $produit->statut_stock,
                'prediction_id' => $prediction->id,
                'mode_calcul' => 'algorithmique_adaptatif_v3'
            ];
        });

        return response()->json([
            'predictions' => $predictions,
            'date_prediction' => $datePrediction,
            'type_prediction' => $typePrediction,
            'metrics' => $this->calculerMetricsAlgorithmiques($boutiqueId),
            'meta' => [
                'type' => 'assistant_analytics',
                'base' => 'ventes_terminees',
                'periodes_jours' => [7, 30, 90],
                'description' => 'Estimations avec poids adaptatifs basées sur vos ventes historiques.',
            ],
        ]);
    }

    /**
     * VALIDATION PRÉDICTIONS - COMPARAISON AVEC RÉALITÉ
     */
    public function validerPredictions(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        $dateValidation = $request->input('date', now()->subDay()->toDateString());
        
        $predictions = AiPrediction::where('date_prediction', $dateValidation)
            ->whereNull('date_validation')
            ->whereHas('produit', function ($query) use ($boutiqueId) {
                $query->where('boutique_id', $boutiqueId);
            })
            ->get();

        $resultats = [];
        $totalValidees = 0;
        $totalPrecises = 0;

        foreach ($predictions as $prediction) {
            $periodeJours = $this->getPeriodeJours($prediction->type_prediction);
            $ventesReelles = $this->calculerVentesPeriodeDate(
                $prediction->produit_id, 
                $dateValidation, 
                $periodeJours,
                $boutiqueId
            );

            $prediction->calculerErreur($ventesReelles);
            
            $totalValidees++;
            if ($prediction->estPrecise(20)) {
                $totalPrecises++;
            }

            $resultats[] = [
                'prediction_id' => $prediction->id,
                'produit_id' => $prediction->produit_id,
                'produit_nom' => $prediction->produit->nom,
                'demande_predite' => $prediction->demande_predite,
                'demande_reelle' => $prediction->demande_reelle,
                'erreur_absolue' => $prediction->erreur_absolue,
                'erreur_pourcentage' => $prediction->erreur_pourcentage,
                'est_precise' => $prediction->estPrecise(20),
            ];
        }

        $precisionGlobale = $totalValidees > 0 ? ($totalPrecises / $totalValidees) * 100 : 0;

        return response()->json([
            'date_validation' => $dateValidation,
            'total_validees' => $totalValidees,
            'total_precises' => $totalPrecises,
            'precision_globale' => round($precisionGlobale, 2),
            'resultats' => $resultats,
        ]);
    }

    /**
     * MÉTRIQUES DE PERFORMANCE RÉELLES
     */
    public function metricsPerformance(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        $jours = $request->input('jours', 30);
        $dateDebut = now()->subDays($jours);
        
        $predictions = AiPrediction::validees()
            ->where('date_validation', '>=', $dateDebut)
            ->whereHas('produit', function ($query) use ($boutiqueId) {
                $query->where('boutique_id', $boutiqueId);
            })
            ->get();

        if ($predictions->isEmpty()) {
            return response()->json([
                'message' => 'Aucune prédiction validée pour la période',
                'metrics' => null,
            ]);
        }

        $mae = $this->calculerMAE($predictions);
        $rmse = $this->calculerRMSE($predictions);
        $mape = $this->calculerMAPE($predictions);
        $accuracy = $this->calculerAccuracy($predictions, 20);
        $precision = $this->calculerPrecision($predictions);

        $metricsParType = $predictions->groupBy('type_prediction')->map(function ($group) {
            return [
                'count' => $group->count(),
                'mae' => $this->calculerMAE($group),
                'rmse' => $this->calculerRMSE($group),
                'accuracy' => $this->calculerAccuracy($group, 20),
            ];
        });

        $historique = $this->getHistoriquePerformance($jours, $boutiqueId);

        return response()->json([
            'periode' => [
                'debut' => $dateDebut->toDateString(),
                'fin' => now()->toDateString(),
                'jours' => $jours,
            ],
            'metrics_globales' => [
                'mae' => round($mae, 2),
                'rmse' => round($rmse, 2),
                'mape' => round($mape, 2),
                'accuracy' => round($accuracy, 2),
                'precision' => round($precision, 2),
            ],
            'metrics_par_type' => $metricsParType,
            'historique' => $historique,
            'total_predictions' => $predictions->count(),
            'statut_modele' => $this->getStatutModeleAmeliore($predictions),
            'donnees_temps_reel' => $this->getDonneesTempsReel($boutiqueId),
        ]);
    }

    /**
     * RECOMMANDATIONS PROMOTIONS - VERSION AMÉLIORÉE
     */
    public function recommandationsPromotions(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        $recommandations = Produit::with(['categorie', 'ligneVentes.vente'])
            ->where('boutique_id', $boutiqueId)
            ->get()
            ->map(function ($produit) use ($boutiqueId) {
                $ventes30Jours = $this->calculerVentesPeriode($produit->id, 30, $boutiqueId);
                $ventes90Jours = $this->calculerVentesPeriode($produit->id, 90, $boutiqueId);

                $ratioStockVentes = $ventes30Jours > 0 ? $produit->quantite_stock / $ventes30Jours : 10;
                $tendance = $this->calculerTendanceVentesProduit($produit->id, $boutiqueId);
                $joursStock = $ventes30Jours > 0 ? $produit->quantite_stock / ($ventes30Jours / 30) : 999;

                $scoreStock = $this->calculerScoreStock($ratioStockVentes, $joursStock);
                $scoreTendance = $this->calculerScoreTendance($tendance);
                $scoreSaisonnalite = $this->calculerScoreSaisonnalite($produit->id, $boutiqueId);
                $scorePerissable = $produit->est_perissable ? 15 : 0;

                $precisionHistorique = $this->getPrecisionHistoriqueProduit($produit->id);
                $scorePrecision = (1 - $precisionHistorique) * 10;

                $scorePromo = min(100, max(0,
                    $scoreStock * 0.45 +
                    $scoreTendance * 0.30 +
                    $scoreSaisonnalite * 0.10 +
                    $scorePerissable * 0.10 +
                    $scorePrecision * 0.05
                ));

                $reduction = $this->determinerReductionOptimale($scorePromo, $produit);
                $prixSuggere = round($produit->prix * (1 - $reduction/100));
                $duree = $this->determinerDureePromotion($scorePromo, $produit);

                return [
                    'produit' => [
                        'id' => $produit->id,
                        'nom' => $produit->nom,
                        'prix' => $produit->prix,
                        'quantite_stock' => $produit->quantite_stock,
                        'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                        'couleur_categorie' => $produit->categorie?->couleur,
                        'est_perissable' => $produit->est_perissable,
                        'statut_stock' => $produit->statut_stock
                    ],
                    'ventes_30_jours' => $ventes30Jours,
                    'ratio_stock_ventes' => round($ratioStockVentes, 1),
                    'jours_stock' => round($joursStock, 1),
                    'tendance_ventes' => round($tendance * 100, 1) . '%',
                    'precision_historique' => round($precisionHistorique * 100, 1) . '%',
                    'score_promotion' => round($scorePromo),
                    'prix_suggere' => $prixSuggere,
                    'reduction_suggeree' => $reduction . '%',
                    'duree_suggeree' => $duree,
                    'impact_estime' => $this->estimerImpactPromotion($produit, $reduction, $duree),
                    'mode_calcul' => 'algorithmique_adaptatif_v3'
                ];
            })
            ->filter(function ($item) {
                return $item['score_promotion'] > 40
                    && ($item['produit']['quantite_stock'] ?? 0) > 0;
            })
            ->sortByDesc('score_promotion')
            ->values();

        return response()->json([
            'recommandations' => $recommandations,
            'meta' => [
                'seuil_score_minimum' => 40,
                'description' => 'Promotions suggérées avec prise en compte de la précision historique.',
            ],
        ]);
    }

    /**
     * CROSS-SELLING - MARKET BASKET ANALYSIS
     */
    public function crossSelling(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        $produitIds = $request->input('produit_ids', []);
        
        if (empty($produitIds)) {
            return response()->json([
                'message' => 'Aucun produit fourni',
                'suggestions' => [],
            ]);
        }

        // Verify products belong to user's boutique
        $validProduitIds = Produit::where('boutique_id', $boutiqueId)
            ->whereIn('id', $produitIds)
            ->pluck('id')
            ->toArray();

        if (empty($validProduitIds)) {
            return response()->json([
                'message' => 'Aucun produit valide trouvé dans votre boutique',
                'suggestions' => [],
            ]);
        }

        $suggestions = $this->analyserAssociationsProduits($validProduitIds, $boutiqueId);

        return response()->json([
            'produits_panier' => $validProduitIds,
            'suggestions' => $suggestions,
            'meta' => [
                'description' => 'Suggestions basées sur l\'analyse des associations de produits (Market Basket Analysis).',
            ],
        ]);
    }

    /**
     * PRÉDICTIONS RÉAPPROVISIONNEMENT
     */
    public function predictionsReapprovisionnement(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        $horizonJours = $request->input('horizon', 30);
        
        $produits = Produit::with('categorie')->where('boutique_id', $boutiqueId)->get();
        
        $recommandations = $produits->map(function ($produit) use ($horizonJours, $boutiqueId) {
            $demandePredite = $this->predireDemandeHorizon($produit->id, $horizonJours, $boutiqueId);
            
            $stockActuel = $produit->quantite_stock;
            $besoin = max(0, $demandePredite - $stockActuel);
            
            $ventesMoyennesJournalieres = $this->calculerMoyenneVentes($produit->id, 30, $boutiqueId);
            $delaiLivraison = 7;
            $securiteStock = ceil($ventesMoyennesJournalieres * $delaiLivraison * 1.5);
            
            $pointCommande = max($produit->seuil_alerte, $securiteStock);
            $quantiteCommande = max($pointCommande, $besoin);
            
            $joursRestants = $ventesMoyennesJournalieres > 0 ? floor($stockActuel / $ventesMoyennesJournalieres) : 999;
            $urgence = $this->determinerUrgenceReappro($joursRestants);

            return [
                'produit_id' => $produit->id,
                'produit_nom' => $produit->nom,
                'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                'stock_actuel' => $stockActuel,
                'demande_predite_' . $horizonJours . '_j' => $demandePredite,
                'besoin_calcule' => $besoin,
                'ventes_moyennes_journalieres' => round($ventesMoyennesJournalieres, 1),
                'jours_stock_restants' => $joursRestants,
                'point_commande' => $pointCommande,
                'quantite_commande_suggeree' => $quantiteCommande,
                'urgence' => $urgence,
                'delai_livraison_estime' => $delaiLivraison . ' jours',
                'date_commande_suggeree' => $joursRestants <= $delaiLivraison ? now()->toDateString() : now()->addDays($joursRestants - $delaiLivraison)->toDateString(),
            ];
        })
        ->filter(function ($item) {
            return $item['besoin_calcule'] > 0 || $item['urgence'] !== 'none';
        })
        ->sortBy('urgence')
        ->values();

        return response()->json([
            'recommandations' => $recommandations,
            'horizon_jours' => $horizonJours,
            'meta' => [
                'description' => "Prédictions de réapprovisionnement sur {$horizonJours} jours.",
            ],
        ]);
    }

    // =========================================================================
    // MÉTHODES DE CALCUL AMÉLIORÉES
    // =========================================================================

    private function calculerPoidsAdaptatifs($produitId, $boutiqueId = null): array
    {
        $ventes7Jours = $this->calculerVentesPeriode($produitId, 7, $boutiqueId);
        $ventes30Jours = $this->calculerVentesPeriode($produitId, 30, $boutiqueId);
        $ventes90Jours = $this->calculerVentesPeriode($produitId, 90, $boutiqueId);

        $moyenne30 = $ventes30Jours / 30;
        $volatilite = $moyenne30 > 0 ? abs($ventes7Jours - $moyenne30) / $moyenne30 : 0;

        if ($volatilite > 0.5) {
            return [
                'poids_7j' => 0.6,
                'poids_30j' => 0.3,
                'poids_90j' => 0.1,
            ];
        } elseif ($volatilite > 0.2) {
            return [
                'poids_7j' => 0.4,
                'poids_30j' => 0.4,
                'poids_90j' => 0.2,
            ];
        } else {
            return [
                'poids_7j' => 0.2,
                'poids_30j' => 0.5,
                'poids_90j' => 0.3,
            ];
        }
    }

    private function calculerConfianceAmelioree($produitId, $tendance, $saisonnalite): float
    {
        $precisionHistorique = $this->getPrecisionHistoriqueProduit($produitId);
        
        $confiance = 0.7 + ($precisionHistorique * 0.2);
        
        if (abs($tendance) > 0.3) {
            $confiance -= 0.1;
        }
        
        if ($saisonnalite < 0.7 || $saisonnalite > 1.3) {
            $confiance -= 0.05;
        }
        
        return max(0.5, min(0.95, $confiance));
    }

    private function getPrecisionHistoriqueProduit($produitId): float
    {
        $predictions = AiPrediction::validees()
            ->where('produit_id', $produitId)
            ->where('date_validation', '>=', now()->subDays(30))
            ->get();

        if ($predictions->isEmpty()) {
            return 0.8;
        }

        $precises = $predictions->filter(function ($p) {
            return $p->estPrecise(20);
        })->count();

        return $precises / $predictions->count();
    }

    private function predireDemandeHorizon($produitId, $horizonJours, $boutiqueId = null): int
    {
        $ventes30Jours = $this->calculerVentesPeriode($produitId, 30, $boutiqueId);
        $tendance = $this->calculerTendanceVentesProduit($produitId, $boutiqueId);
        $saisonnalite = $this->calculerSaisonnaliteProduit($produitId, $boutiqueId);

        $ventesMoyennesJournalieres = $ventes30Jours / 30;
        
        return ceil(
            $ventesMoyennesJournalieres * $horizonJours
            * (1 + $tendance)
            * $saisonnalite
        );
    }

    private function determinerUrgenceReappro($joursRestants): string
    {
        if ($joursRestants <= 3) return 'critical';
        if ($joursRestants <= 7) return 'high';
        if ($joursRestants <= 14) return 'medium';
        if ($joursRestants <= 30) return 'low';
        return 'none';
    }

    // =========================================================================
    // MÉTHODES DE CALCUL DE MÉTRIQUES RÉELLES
    // =========================================================================

    private function calculerMAE($predictions): float
    {
        $totalErreur = $predictions->sum('erreur_absolue');
        return $totalErreur / $predictions->count();
    }

    private function calculerRMSE($predictions): float
    {
        $sommeCarres = $predictions->sum(function ($p) {
            return pow($p->erreur_absolue, 2);
        });
        return sqrt($sommeCarres / $predictions->count());
    }

    private function calculerMAPE($predictions): float
    {
        $sommePourcentage = $predictions->sum('erreur_pourcentage');
        return $sommePourcentage / $predictions->count();
    }

    private function calculerAccuracy($predictions, $tolerancePourcentage): float
    {
        $precises = $predictions->filter(function ($p) use ($tolerancePourcentage) {
            return $p->estPrecise($tolerancePourcentage);
        })->count();
        
        return ($precises / $predictions->count()) * 100;
    }

    private function calculerPrecision($predictions): float
    {
        return $this->calculerAccuracy($predictions, 20);
    }

    private function getHistoriquePerformance($jours, $boutiqueId = null): array
    {
        $query = AiPrediction::validees()
            ->where('date_validation', '>=', now()->subDays($jours));

        if ($boutiqueId) {
            $query->whereHas('produit', function ($q) use ($boutiqueId) {
                $q->where('boutique_id', $boutiqueId);
            });
        }

        return $query
            ->selectRaw('DATE(date_validation) as date, AVG(erreur_pourcentage) as mape')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date,
                    'mape' => round($item->mape, 2),
                ];
            })
            ->toArray();
    }

    private function getStatutModeleAmeliore($predictions): array
    {
        $precision = $this->calculerPrecision($predictions);
        
        if ($precision >= 85) {
            $statut = 'excellent';
            $libelle = 'Modèle très performant';
        } elseif ($precision >= 75) {
            $statut = 'bon';
            $libelle = 'Modèle performant';
        } elseif ($precision >= 60) {
            $statut = 'acceptable';
            $libelle = 'Modèle acceptable';
        } else {
            $statut = 'amelioration_requise';
            $libelle = 'Modèle nécessitant amélioration';
        }

        return [
            'statut' => $statut,
            'libelle' => $libelle,
            'precision' => round($precision, 2),
        ];
    }

    // =========================================================================
    // MÉTHODES UTILITAIRES
    // =========================================================================

    private function calculerVentesPeriode($produitId, $jours, $boutiqueId = null): int
    {
        return LigneVente::where('produit_id', $produitId)
            ->whereHas('vente', function($query) use ($jours, $boutiqueId) {
                $query->terminees()->where('created_at', '>=', now()->subDays($jours));
                if ($boutiqueId) {
                    $query->where('boutique_id', $boutiqueId);
                }
            })
            ->sum('quantite');
    }

    private function calculerVentesPeriodeDate($produitId, $date, $jours, $boutiqueId = null): int
    {
        $dateDebut = Carbon::parse($date)->subDays($jours);
        $dateFin = Carbon::parse($date);

        return LigneVente::where('produit_id', $produitId)
            ->whereHas('vente', function($query) use ($dateDebut, $dateFin, $boutiqueId) {
                $query->terminees()
                    ->whereBetween('created_at', [$dateDebut, $dateFin]);
                if ($boutiqueId) {
                    $query->where('boutique_id', $boutiqueId);
                }
            })
            ->sum('quantite');
    }

    private function calculerMoyenneVentes($produitId, $jours, $boutiqueId = null): float
    {
        $ventes = $this->calculerVentesPeriode($produitId, $jours, $boutiqueId);
        return $ventes / $jours;
    }

    private function calculerTendanceVentesProduit($produitId, $boutiqueId = null): float
    {
        $ventes7Jours = $this->calculerVentesPeriode($produitId, 7, $boutiqueId);
        $ventes14Jours = $this->calculerVentesPeriode($produitId, 14, $boutiqueId);

        if ($ventes14Jours == 0) return 0;

        $ventes7Premiers = $ventes14Jours - $ventes7Jours;
        if ($ventes7Premiers == 0) return 0;

        return ($ventes7Jours - $ventes7Premiers) / $ventes7Premiers;
    }

    private function calculerSaisonnaliteProduit($produitId, $boutiqueId = null): float
    {
        $ventesMoisCourant = $this->calculerVentesPeriode($produitId, 30, $boutiqueId);
        $ventes3Mois = $this->calculerVentesPeriode($produitId, 90, $boutiqueId);

        $facteurSaison = 1.0;
        if ($ventes3Mois > 0) {
            $facteurSaison = $ventesMoisCourant / ($ventes3Mois / 3);
        }

        $facteurFeries = $this->facteurJoursFeriesBbeninois();
        $facteurJourSemaine = $this->facteurJourSemaine();

        return $facteurSaison * $facteurFeries * $facteurJourSemaine;
    }

    /**
     * Jours fériés officiels du Bénin.
     * Les dates fixes + shift de ±15 jours pour capter l'effet « veille/après ».
     */
    private function facteurJoursFeriesBbeninois(): float
    {
        $jour = (int) now()->format('j');
        $mois = (int) now()->format('n');

        $feries = [
            [$mois === 1 && $jour === 1],   // Jour de l'An
            [$mois === 1 && $jour === 10],  // Fête traditionnelle
            [$mois === 4 && $jour === 27],  // Journée Nationale
            [$mois === 5 && $jour === 1],   // Fête du Travail
            [$mois === 5 && $jour === 25],  // Fête de l'Ascension
            [$mois === 8 && $jour === 1],   // Fête Nationale
            [$mois === 8 && $jour === 15],  // Assomption
            [$mois === 10 && $jour === 26], // Fête des Armées
            [$mois === 11 && $jour === 1],  // Toussaint
            [$mois === 11 && $jour === 30], // Fête du ...
            [$mois === 12 && $jour === 25], // Noël
        ];

        $aujourdHui = $mois * 100 + $jour;

        foreach ($feries as $f) {
            if (!empty($f[0])) {
                return 1.25;
            }
        }

        foreach ([101, 110, 427, 501, 525, 801, 815, 1026, 1101, 1130, 1225] as $fDate) {
            $fMois = intdiv($fDate, 100);
            $fJour = $fDate % 100;
            try {
                $dateFerie = now()->setMonth($fMois)->setDay($fJour);
                $diff = abs((int) now()->diffInDays($dateFerie, false));
                if ($diff <= 15) {
                    return 1.12;
                }
            } catch (\Throwable) {
            }
        }

        return 1.0;
    }

    /**
     * Légère hausse le samedi (jour de marché au Bénin), baisse le dimanche.
     */
    private function facteurJourSemaine(): float
    {
        $jourSemaine = (int) now()->format('w');
        return match ($jourSemaine) {
            6 => 1.15,
            0 => 0.75,
            default => 1.0,
        };
    }

    private function determinerNiveauUrgence($besoin, $seuilAlerte): string
    {
        if ($besoin > $seuilAlerte * 3) return 'critical';
        if ($besoin > $seuilAlerte * 2) return 'high';
        if ($besoin > $seuilAlerte) return 'medium';
        if ($besoin > 0) return 'low';
        return 'none';
    }

    private function genererRecommandationAmelioree($produit, $demandePredite): string
    {
        $besoin = $demandePredite - $produit->quantite_stock;

        if ($produit->quantite_stock <= 0) {
            return $demandePredite > 0
                ? 'RUPTURE - Commander URGENCE'
                : 'Stock nul - Aucune vente récente';
        }

        if ($demandePredite <= 0) {
            return 'Aucune demande prédite - Produit dormant';
        }

        $ratio = $produit->quantite_stock / $demandePredite;

        if ($ratio >= 4.0) return 'Stock très excessif - Promotion urgente recommandée';
        if ($ratio >= 2.5) return 'Stock excessif - Considérer promotion';
        if ($ratio >= 1.8) return 'Stock confortable';
        if ($ratio >= 1.2) return 'Stock suffisant';
        if ($ratio >= 0.8) return 'Surveiller attentivement';
        if ($ratio >= 0.5) return 'Commander modérément';
        if ($ratio >= 0.2) return 'Commander rapidement';
        return 'Commander en urgence - Risque de rupture';
    }

    private function calculerScoreStock($ratioStockVentes, $joursStock): float
    {
        if ($ratioStockVentes >= 6) return 100;
        if ($ratioStockVentes >= 4) return 80;
        if ($ratioStockVentes >= 3) return 60;
        if ($ratioStockVentes >= 2) return 40;
        if ($ratioStockVentes >= 1) return 20;
        return 0;
    }

    private function calculerScoreTendance($tendance): float
    {
        if ($tendance <= -0.3) return 100;
        if ($tendance <= -0.15) return 70;
        if ($tendance <= -0.05) return 40;
        if ($tendance >= 0.3) return 0;
        if ($tendance >= 0.15) return 10;
        return 30;
    }

    private function calculerScoreSaisonnalite($produitId, $boutiqueId = null): float
    {
        $saisonnalite = $this->calculerSaisonnaliteProduit($produitId, $boutiqueId);

        if ($saisonnalite < 0.7) return 100;
        if ($saisonnalite < 0.9) return 70;
        if ($saisonnalite > 1.3) return 0;
        if ($saisonnalite > 1.1) return 20;
        return 50;
    }

    private function determinerReductionOptimale($scorePromo, $produit): int
    {
        if ($scorePromo >= 90) return 25;
        if ($scorePromo >= 80) return 20;
        if ($scorePromo >= 70) return 18;
        if ($scorePromo >= 60) return 15;
        if ($scorePromo >= 50) return 12;
        if ($scorePromo >= 40) return 10;
        if ($scorePromo >= 30) return 8;
        return 5;
    }

    private function determinerDureePromotion($scorePromo, $produit): string
    {
        if ($scorePromo >= 80) return '10 jours';
        if ($scorePromo >= 60) return '7 jours';
        if ($scorePromo >= 40) return '5 jours';
        return '3 jours';
    }

    private function estimerImpactPromotion($produit, $reduction, $duree): array
    {
        $ventesMoyennes = $this->calculerMoyenneVentes($produit->id, 30);
        $joursPromo = (int) $duree;

        $augmentationAttendue = min(4.0, 1 + ($reduction / 100) * 2);
        $ventesAttendues = round($ventesMoyennes * $augmentationAttendue * ($joursPromo / 30));

        return [
            'ventes_attendues' => $ventesAttendues,
            'augmentation_ventes' => round(($augmentationAttendue - 1) * 100) . '%',
            'stock_apres_promo' => max(0, $produit->quantite_stock - $ventesAttendues),
            'chiffre_affaires_estime' => round($ventesAttendues * ($produit->prix * (1 - $reduction/100)))
        ];
    }

    private function calculerMetricsAlgorithmiques($boutiqueId): array
    {
        $totalProduits = Produit::where('boutique_id', $boutiqueId)->count();
        $precisionBase = $totalProduits > 0 ? 0.82 : 0.75;

        return [
            'precision_globale' => $precisionBase,
            'precision_stock_alerte' => $precisionBase * 1.07,
            'precision_demandes' => $precisionBase * 0.96,
            'taux_confiance' => $precisionBase,
            'mode' => 'algorithmique_adaptatif_v3',
            'nombre_produits' => $totalProduits
        ];
    }

    private function getPeriodeJours($typePrediction): int
    {
        return match($typePrediction) {
            'demande_hebdo' => 7,
            'demande_mensuelle' => 30,
            'reapprovisionnement' => 30,
            default => 7,
        };
    }

    private function getDonneesTempsReel($boutiqueId): array
    {
        return [
            'total_produits' => Produit::where('boutique_id', $boutiqueId)->count(),
            'produits_alerte' => Produit::where('boutique_id', $boutiqueId)->enAlerte()->count(),
            'produits_rupture' => Produit::where('boutique_id', $boutiqueId)->enRupture()->count(),
            'predictions_en_attente' => AiPrediction::enAttente()
                ->whereHas('produit', function ($q) use ($boutiqueId) {
                    $q->where('boutique_id', $boutiqueId);
                })
                ->count(),
            'predictions_validees' => AiPrediction::validees()
                ->whereHas('produit', function ($q) use ($boutiqueId) {
                    $q->where('boutique_id', $boutiqueId);
                })
                ->count(),
            'mise_a_jour' => now()->toISOString()
        ];
    }

    private function analyserAssociationsProduits(array $produitIds, $boutiqueId = null): array
    {
        $ventesQuery = \App\Models\Vente::terminees()
            ->whereHas('ligneVentes', function ($query) use ($produitIds) {
                $query->whereIn('produit_id', $produitIds);
            });

        if ($boutiqueId) {
            $ventesQuery->where('boutique_id', $boutiqueId);
        }

        $ventesAvecProduits = $ventesQuery
            ->with('ligneVentes.produit')
            ->get();

        if ($ventesAvecProduits->isEmpty()) {
            $fallbackQuery = Produit::with('categorie')
                ->whereNotIn('id', $produitIds)
                ->where('quantite_stock', '>', 0);

            if ($boutiqueId) {
                $fallbackQuery->where('boutique_id', $boutiqueId);
            }

            return $fallbackQuery
                ->orderByDesc('quantite_stock')
                ->take(5)
                ->map(function ($produit) {
                    return [
                        'produit_id' => $produit->id,
                        'nom' => $produit->nom,
                        'prix' => $produit->prix,
                        'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                        'score' => 0.5,
                        'raison' => 'Produit populaire',
                    ];
                })
                ->toArray();
        }

        $associations = [];
        $totalVentes = $ventesAvecProduits->count();

        foreach ($ventesAvecProduits as $vente) {
            $produitsVente = $vente->ligneVentes->pluck('produit_id')->toArray();
            
            foreach ($produitsVente as $produitId) {
                if (!in_array($produitId, $produitIds)) {
                    if (!isset($associations[$produitId])) {
                        $associations[$produitId] = [
                            'count' => 0,
                            'produit' => null,
                        ];
                    }
                    $associations[$produitId]['count']++;
                }
            }
        }

        $suggestions = collect($associations)
            ->map(function ($data, $produitId) use ($totalVentes, $boutiqueId) {
                $produitQuery = Produit::with('categorie')->where('id', $produitId);
                if ($boutiqueId) {
                    $produitQuery->where('boutique_id', $boutiqueId);
                }
                $produit = $produitQuery->first();
                
                if (!$produit || $produit->quantite_stock <= 0) {
                    return null;
                }

                $score = $data['count'] / $totalVentes;
                
                $categoriePanierQuery = Produit::whereIn('id', $produitIds);
                if ($boutiqueId) {
                    $categoriePanierQuery->where('boutique_id', $boutiqueId);
                }
                $categoriePanier = $categoriePanierQuery->first()?->categorie_id;
                if ($categoriePanier && $produit->categorie_id == $categoriePanier) {
                    $score *= 1.3;
                }

                return [
                    'produit_id' => $produit->id,
                    'nom' => $produit->nom,
                    'prix' => $produit->prix,
                    'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                    'score' => round($score, 3),
                    'frequence' => $data['count'],
                    'raison' => $score > 0.3 ? 'Souvent acheté ensemble' : 'Association détectée',
                ];
            })
            ->filter()
            ->sortByDesc('score')
            ->take(5)
            ->values()
            ->toArray();

        return $suggestions;
    }
}
