<?php

namespace App\Services;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FirebaseNotification;

class FcmService
{
    protected ?Messaging $messaging = null;

    protected bool $messagingResolved = false;

    /**
     * Résolution paresseuse de Firebase : le service reste utilisable
     * (et instanciable) même quand Firebase n'est pas configuré,
     * typiquement en dev et dans les tests.
     */
    public function messaging(): ?Messaging
    {
        if (! $this->messagingResolved) {
            $this->messagingResolved = true;

            try {
                $this->messaging = app(Messaging::class);
            } catch (\Throwable $e) {
                Log::warning('FCM indisponible : Firebase non configuré', [
                    'reason' => $e->getMessage(),
                ]);
            }
        }

        return $this->messaging;
    }

    public function sendToUser(User $user, string $title, string $body, array $data = []): array
    {
        $tokens = $user->fcmTokens()->active()->pluck('token')->toArray();

        return $this->sendToTokens($tokens, $title, $body, $data);
    }

    public function sendToMultipleUsers(array $userIds, string $title, string $body, array $data = []): array
    {
        $tokens = FcmToken::whereIn('user_id', $userIds)
            ->active()
            ->pluck('token')
            ->toArray();

        return $this->sendToTokens($tokens, $title, $body, $data);
    }

    protected function sendToTokens(array $tokens, string $title, string $body, array $data = []): array
    {
        if (empty($tokens)) {
            return ['success' => true, 'message' => 'Aucun token actif', 'sent' => 0];
        }

        $messaging = $this->messaging();

        if ($messaging === null) {
            return [
                'success' => false,
                'message' => 'Firebase non configuré',
                'sent' => 0,
                'total' => count($tokens),
            ];
        }

        $notification = FirebaseNotification::create($title, $body);
        $message = CloudMessage::new()->withNotification($notification);

        if (!empty($data)) {
            $message = $message->withData($data);
        }

        $results = [];
        $successCount = 0;

        foreach ($tokens as $token) {
            try {
                $messaging->send($message->withChangedToken($token));
                $successCount++;
                $results[] = ['token' => $token, 'success' => true];
            } catch (\Exception $e) {
                Log::error("Erreur envoi FCM token {$token}", ['error' => $e->getMessage()]);
                $results[] = ['token' => $token, 'success' => false, 'error' => $e->getMessage()];

                // Désactiver le token en erreur
                FcmToken::where('token', $token)->update(['is_active' => false]);
            }
        }

        return [
            'success' => $successCount > 0,
            'sent' => $successCount,
            'total' => count($tokens),
            'results' => $results,
        ];
    }

    public function sendStockAlert(User $user, string $productName, int $currentStock): array
    {
        return $this->sendToUser(
            $user,
            'Alerte Stock',
            "Le produit {$productName} est en rupture de stock ({$currentStock} unités)",
            [
                'type' => 'stock_alert',
                'product_name' => $productName,
                'current_stock' => $currentStock,
            ]
        );
    }

    public function sendNewSale(User $user, string $saleNumber, float $amount): array
    {
        return $this->sendToUser(
            $user,
            'Nouvelle Vente',
            "Vente #{$saleNumber} enregistrée - Montant: {$amount} FCFA",
            [
                'type' => 'new_sale',
                'sale_number' => $saleNumber,
                'amount' => $amount,
            ]
        );
    }

    public function sendArrivalValidation(User $user, string $productName, int $quantity): array
    {
        return $this->sendToUser(
            $user,
            'Arrivage Validé',
            "L'arrivage de {$quantity} unités de {$productName} a été validé",
            [
                'type' => 'arrival_validated',
                'product_name' => $productName,
                'quantity' => $quantity,
            ]
        );
    }
}
