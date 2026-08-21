<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class PeremptionService
{
    public function __construct(private readonly FcmService $fcmService)
    {
    }

    /**
     * Vérifie et envoie des alertes pour les produits proches de la péremption
     */
    public function checkAndSendAlerts(int $boutiqueId, int $joursAvant = 7): void
    {
        try {
            // Récupérer les produits proches de la péremption
            $produitsPerimes = Produit::where('boutique_id', $boutiqueId)
                ->perissables()
                ->prochesPeremption($joursAvant)
                ->get();

            if ($produitsPerimes->isEmpty()) {
                Log::info("Aucun produit proche de la péremption pour la boutique {$boutiqueId}");
                return;
            }

            // Récupérer les gérants et propriétaires de la boutique
            $users = User::whereHas('boutiques', function ($query) use ($boutiqueId) {
                $query->where('boutique_id', $boutiqueId)
                    ->whereIn('role_dans_boutique', ['gerant', 'proprietaire']);
            })->get();

            foreach ($users as $user) {
                // Créer une notification pour chaque utilisateur
                foreach ($produitsPerimes as $produit) {
                    $joursRestants = $produit->jours_restants;

                    AppNotification::create([
                        'user_id' => $user->id,
                        'type' => 'peremption_alert',
                        'title' => 'Alerte Péremption',
                        'message' => "Le produit {$produit->nom} expire dans {$joursRestants} jours",
                        'data' => [
                            'produit_id' => $produit->id,
                            'produit_nom' => $produit->nom,
                            'date_peremption' => (string) $produit->date_peremption,
                            'jours_restants' => $joursRestants,
                            'boutique_id' => $boutiqueId,
                        ],
                    ]);

                    // Push FCM : sendToUser gère l'absence de token sans erreur
                    $this->fcmService->sendToUser(
                        $user,
                        'Alerte Péremption',
                        "Le produit {$produit->nom} expire dans {$joursRestants} jours",
                        [
                            'type' => 'peremption_alert',
                            'produit_id' => $produit->id,
                            'boutique_id' => $produit->boutique_id,
                        ]
                    );
                }
            }

            Log::info("Alertes de péremption envoyées pour {$produitsPerimes->count()} produits de la boutique {$boutiqueId}");
        } catch (\Throwable $e) {
            Log::error("Erreur lors de l'envoi des alertes de péremption: {$e->getMessage()}");
        }
    }

    /**
     * Vérifie et envoie des alertes pour les produits périmés
     */
    public function checkAndSendExpiredAlerts(int $boutiqueId): void
    {
        try {
            // Récupérer les produits périmés
            $produitsPerimes = Produit::where('boutique_id', $boutiqueId)
                ->perissables()
                ->perimes()
                ->get();

            if ($produitsPerimes->isEmpty()) {
                Log::info("Aucun produit périmé pour la boutique {$boutiqueId}");
                return;
            }

            // Récupérer les gérants et propriétaires de la boutique
            $users = User::whereHas('boutiques', function ($query) use ($boutiqueId) {
                $query->where('boutique_id', $boutiqueId)
                    ->whereIn('role_dans_boutique', ['gerant', 'proprietaire']);
            })->get();

            foreach ($users as $user) {
                // Créer une notification pour chaque utilisateur
                foreach ($produitsPerimes as $produit) {
                    AppNotification::create([
                        'user_id' => $user->id,
                        'type' => 'peremption_expired',
                        'title' => 'Produit Périmé',
                        'message' => "Le produit {$produit->nom} est périmé depuis le {$produit->date_peremption}",
                        'data' => [
                            'produit_id' => $produit->id,
                            'produit_nom' => $produit->nom,
                            'date_peremption' => (string) $produit->date_peremption,
                            'boutique_id' => $boutiqueId,
                        ],
                    ]);

                    $this->fcmService->sendToUser(
                        $user,
                        'Produit Périmé',
                        "Le produit {$produit->nom} est périmé",
                        [
                            'type' => 'peremption_expired',
                            'produit_id' => $produit->id,
                            'boutique_id' => $produit->boutique_id,
                        ]
                    );
                }
            }

            Log::info("Alertes de produits périmés envoyées pour {$produitsPerimes->count()} produits de la boutique {$boutiqueId}");
        } catch (\Throwable $e) {
            Log::error("Erreur lors de l'envoi des alertes de produits périmés: {$e->getMessage()}");
        }
    }

    /**
     * Synchronise les alertes de péremption pour une boutique
     */
    public function syncPeremptionAlerts(int $boutiqueId, int $joursAvant = 7): array
    {
        try {
            $produitsProches = Produit::where('boutique_id', $boutiqueId)
                ->perissables()
                ->prochesPeremption($joursAvant)
                ->get();

            $produitsPerimes = Produit::where('boutique_id', $boutiqueId)
                ->perissables()
                ->perimes()
                ->get();

            return [
                'proches_peremption' => $produitsProches,
                'perimes' => $produitsPerimes,
            ];
        } catch (\Throwable $e) {
            Log::error("Erreur lors de la synchronisation des alertes de péremption: {$e->getMessage()}");
            return [
                'proches_peremption' => [],
                'perimes' => [],
            ];
        }
    }
}
