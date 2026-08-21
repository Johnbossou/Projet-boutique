<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class StockAlertService
{
    public function __construct(private readonly FcmService $fcmService)
    {
    }

    /**
     * Vérifie et envoie des alertes pour les produits en stock bas
     */
    public function checkAndSendAlerts(int $boutiqueId): void
    {
        try {
            // Récupérer les produits en alerte de stock
            $produitsAlerte = Produit::where('boutique_id', $boutiqueId)
                ->enAlerte()
                ->get();

            if ($produitsAlerte->isEmpty()) {
                Log::info("Aucun produit en alerte de stock pour la boutique {$boutiqueId}");
                return;
            }

            // Récupérer les gérants et propriétaires de la boutique
            $users = User::whereHas('boutiques', function ($query) use ($boutiqueId) {
                $query->where('boutique_id', $boutiqueId)
                    ->whereIn('role_dans_boutique', ['gerant', 'proprietaire']);
            })->get();

            foreach ($users as $user) {
                // Créer une notification pour chaque utilisateur
                foreach ($produitsAlerte as $produit) {
                    AppNotification::create([
                        'user_id' => $user->id,
                        'type' => 'stock_alert',
                        'title' => 'Alerte de stock',
                        'message' => "Le produit {$produit->nom} est en alerte de stock ({$produit->quantite_stock} unités, seuil: {$produit->seuil_alerte})",
                        'data' => [
                            'produit_id' => $produit->id,
                            'produit_nom' => $produit->nom,
                            'quantite_stock' => $produit->quantite_stock,
                            'seuil_alerte' => $produit->seuil_alerte,
                            'boutique_id' => $boutiqueId,
                        ],
                    ]);

                    // Push FCM : sendToUser gère l'absence de token sans erreur
                    $this->fcmService->sendToUser(
                        $user,
                        'Alerte de stock',
                        "Le produit {$produit->nom} est en alerte de stock ({$produit->quantite_stock} unités)",
                        [
                            'type' => 'stock_alert',
                            'produit_id' => $produit->id,
                            'boutique_id' => $produit->boutique_id,
                        ]
                    );
                }
            }

            Log::info("Alertes de stock envoyées pour {$produitsAlerte->count()} produits de la boutique {$boutiqueId}");
        } catch (\Throwable $e) {
            Log::error("Erreur lors de l'envoi des alertes de stock: {$e->getMessage()}");
        }
    }

    /**
     * Vérifie et envoie des alertes pour les produits en rupture de stock
     */
    public function checkAndSendRuptureAlerts(int $boutiqueId): void
    {
        try {
            // Récupérer les produits en rupture de stock
            $produitsRupture = Produit::where('boutique_id', $boutiqueId)
                ->enRupture()
                ->get();

            if ($produitsRupture->isEmpty()) {
                Log::info("Aucun produit en rupture de stock pour la boutique {$boutiqueId}");
                return;
            }

            // Récupérer les gérants et propriétaires de la boutique
            $users = User::whereHas('boutiques', function ($query) use ($boutiqueId) {
                $query->where('boutique_id', $boutiqueId)
                    ->whereIn('role_dans_boutique', ['gerant', 'proprietaire']);
            })->get();

            foreach ($users as $user) {
                // Créer une notification pour chaque utilisateur
                foreach ($produitsRupture as $produit) {
                    AppNotification::create([
                        'user_id' => $user->id,
                        'type' => 'stock_rupture',
                        'title' => 'Rupture de stock',
                        'message' => "Le produit {$produit->nom} est en rupture de stock",
                        'data' => [
                            'produit_id' => $produit->id,
                            'produit_nom' => $produit->nom,
                            'quantite_stock' => $produit->quantite_stock,
                            'boutique_id' => $boutiqueId,
                        ],
                    ]);

                    $this->fcmService->sendToUser(
                        $user,
                        'Rupture de stock',
                        "Le produit {$produit->nom} est en rupture de stock",
                        [
                            'type' => 'stock_rupture',
                            'produit_id' => $produit->id,
                            'boutique_id' => $produit->boutique_id,
                        ]
                    );
                }
            }

            Log::info("Alertes de rupture envoyées pour {$produitsRupture->count()} produits de la boutique {$boutiqueId}");
        } catch (\Throwable $e) {
            Log::error("Erreur lors de l'envoi des alertes de rupture: {$e->getMessage()}");
        }
    }

    /**
     * Synchronise les alertes de stock pour une boutique
     */
    public function syncStockAlerts(int $boutiqueId): array
    {
        try {
            $produitsAlerte = Produit::where('boutique_id', $boutiqueId)
                ->enAlerte()
                ->get();

            $produitsRupture = Produit::where('boutique_id', $boutiqueId)
                ->enRupture()
                ->get();

            return [
                'alerte' => $produitsAlerte->count(),
                'rupture' => $produitsRupture->count(),
                'produits_alerte' => $produitsAlerte,
                'produits_rupture' => $produitsRupture,
            ];
        } catch (\Throwable $e) {
            Log::error("Erreur lors de la synchronisation des alertes: {$e->getMessage()}");
            return [
                'alerte' => 0,
                'rupture' => 0,
                'produits_alerte' => [],
                'produits_rupture' => [],
            ];
        }
    }
}
