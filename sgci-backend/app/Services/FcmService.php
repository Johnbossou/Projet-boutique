<?php

namespace App\Services;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    protected ?array $credentials = null;

    protected bool $credentialsLoaded = false;

    protected ?string $accessToken = null;

    protected int $accessTokenExpiresAt = 0;

    /**
     * Chargement paresseux des identifiants : le service reste utilisable
     * (et instanciable) même quand Firebase n'est pas configuré,
     * typiquement en dev et dans les tests.
     */
    protected function credentials(): ?array
    {
        if (! $this->credentialsLoaded) {
            $this->credentialsLoaded = true;

            $config = config('firebase.credentials');

            if (! empty($config['project_id']) && ! empty($config['client_email']) && ! empty($config['private_key'])) {
                $this->credentials = $config;
            } else {
                Log::warning('FCM indisponible : Firebase non configuré');
            }
        }

        return $this->credentials;
    }

    /**
     * Jeton OAuth2 obtenu via un JWT RS256 signé avec la clé privée du
     * compte de service (implémentation directe de l'API FCM HTTP v1,
     * sans dépendance externe).
     */
    protected function accessToken(): ?string
    {
        if ($this->accessToken !== null && now()->getTimestamp() < $this->accessTokenExpiresAt - 60) {
            return $this->accessToken;
        }

        $creds = $this->credentials();

        if ($creds === null) {
            return null;
        }

        $now = now()->getTimestamp();

        $header = $this->base64UrlEncode((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claims = $this->base64UrlEncode((string) json_encode([
            'iss' => $creds['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => $creds['token_uri'],
            'iat' => $now,
            'exp' => $now + 3600,
        ]));

        $key = openssl_pkey_get_private(str_replace('\n', "\n", $creds['private_key']));

        if ($key === false || ! openssl_sign($header.'.'.$claims, $signature, $key, OPENSSL_ALGO_SHA256)) {
            Log::error('FCM : signature JWT impossible (clé privée invalide ?)');

            return null;
        }

        $jwt = $header.'.'.$claims.'.'.$this->base64UrlEncode($signature);

        $response = Http::asForm()->timeout(10)->post($creds['token_uri'], [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);

        if ($response->failed() || ! $response->json('access_token')) {
            Log::error('FCM : échec authentification OAuth2', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 300),
            ]);

            return null;
        }

        $this->accessToken = $response->json('access_token');
        $this->accessTokenExpiresAt = $now + (int) $response->json('expires_in', 3600);

        return $this->accessToken;
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

        $accessToken = $this->accessToken();

        if ($accessToken === null) {
            return [
                'success' => false,
                'message' => 'Firebase non configuré',
                'sent' => 0,
                'total' => count($tokens),
            ];
        }

        $projectId = $this->credentials()['project_id'];
        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        $results = [];
        $successCount = 0;

        foreach ($tokens as $deviceToken) {
            try {
                $response = Http::withToken($accessToken)
                    ->acceptJson()
                    ->timeout(10)
                    ->post($url, [
                        'message' => array_filter([
                            'token' => $deviceToken,
                            'notification' => ['title' => $title, 'body' => $body],
                            'data' => ! empty($data) ? array_map('strval', $data) : null,
                            'android' => [
                                'priority' => config('firebase.fcm.default.priority', 'high'),
                            ],
                        ]),
                    ]);

                if ($response->successful()) {
                    $successCount++;
                    $results[] = ['token' => $deviceToken, 'success' => true];
                } else {
                    throw new \RuntimeException('HTTP '.$response->status().': '.substr($response->body(), 0, 200));
                }
            } catch (\Exception $e) {
                Log::error("Erreur envoi FCM token {$deviceToken}", ['error' => $e->getMessage()]);
                $results[] = ['token' => $deviceToken, 'success' => false, 'error' => $e->getMessage()];

                // Désactiver le token en erreur
                FcmToken::where('token', $deviceToken)->update(['is_active' => false]);
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

    protected function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
