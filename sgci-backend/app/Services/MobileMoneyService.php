<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MobileMoneyService
{
    private string $provider;
    private string $apiKey;
    private string $apiSecret;
    private string $baseUrl;

    public function __construct(string $provider = 'orange')
    {
        $this->provider = $provider;

        // Lire les clés réellement définies dans config/services.php
        if ($provider === 'orange') {
            $config = config('services.orange_money', []);
            $this->apiKey = $config['client_id'] ?? '';
            $this->apiSecret = $config['client_secret'] ?? '';
            $this->baseUrl = rtrim($config['base_url'] ?? 'https://api.orange.com', '/');
        } elseif ($provider === 'mtn') {
            $config = config('services.mtn_money', []);
            $this->apiKey = $config['api_user'] ?? '';
            $this->apiSecret = $config['api_key'] ?? '';
            $this->baseUrl = rtrim($config['base_url'] ?? 'https://sandbox.momodeveloper.mtn.com', '/');
        } else {
            $this->apiKey = '';
            $this->apiSecret = '';
            $this->baseUrl = '';
        }
    }

    /**
     * Initie un paiement Mobile Money
     */
    public function initiatePayment(array $paymentData): array
    {
        try {
            $payload = [
                'amount' => $paymentData['amount'],
                'currency' => $paymentData['currency'] ?? 'XOF',
                'phone_number' => $paymentData['phone_number'],
                'external_id' => $paymentData['external_id'],
                'description' => $paymentData['description'] ?? 'Paiement SGCI',
                'callback_url' => $paymentData['callback_url'] ?? route('mobile-money.callback'),
            ];

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->getAccessToken(),
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->post($this->baseUrl . '/payments', $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json(),
                    'message' => 'Paiement initié avec succès',
                ];
            }

            Log::error('Mobile Money payment failed', [
                'provider' => $this->provider,
                'response' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'Échec de l\'initiation du paiement',
                'error' => $response->json(),
            ];
        } catch (\Exception $e) {
            Log::error('Mobile Money service error', [
                'provider' => $this->provider,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors du traitement du paiement',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Vérifie le statut d'un paiement
     */
    public function checkPaymentStatus(string $paymentId): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->getAccessToken(),
                'Accept' => 'application/json',
            ])->get($this->baseUrl . '/payments/' . $paymentId);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json(),
                ];
            }

            return [
                'success' => false,
                'message' => 'Impossible de vérifier le statut du paiement',
            ];
        } catch (\Exception $e) {
            Log::error('Mobile Money status check error', [
                'provider' => $this->provider,
                'payment_id' => $paymentId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de la vérification du statut',
            ];
        }
    }

    /**
     * Annule un paiement
     */
    public function cancelPayment(string $paymentId): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->getAccessToken(),
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl . '/payments/' . $paymentId . '/cancel');

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Paiement annulé avec succès',
                ];
            }

            return [
                'success' => false,
                'message' => 'Impossible d\'annuler le paiement',
            ];
        } catch (\Exception $e) {
            Log::error('Mobile Money cancel error', [
                'provider' => $this->provider,
                'payment_id' => $paymentId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'annulation du paiement',
            ];
        }
    }

    /**
     * Obtient un token d'accès
     */
    private function getAccessToken(): string
    {
        $response = Http::asForm()->post($this->baseUrl . '/oauth/token', [
            'grant_type' => 'client_credentials',
            'client_id' => $this->apiKey,
            'client_secret' => $this->apiSecret,
        ]);

        if ($response->successful()) {
            return $response->json('access_token');
        }

        throw new \Exception('Impossible d\'obtenir le token d\'accès');
    }

    /**
     * Valide un numéro de téléphone Mobile Money
     */
    public function validatePhoneNumber(string $phoneNumber): bool
    {
        // Validation pour les numéros Bénin
        $pattern = '/^(?:\+229|00229)?[0-9]{8}$/';
        return preg_match($pattern, $phoneNumber) === 1;
    }

    /**
     * Détermine le fournisseur basé sur le numéro de téléphone
     */
    public function detectProvider(string $phoneNumber): ?string
    {
        // Préfixes Orange Money Bénin
        $orangePrefixes = ['01', '02', '04', '07', '08', '09', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
        
        // Préfixes MTN Mobile Money Bénin
        $mtnPrefixes = ['05', '06', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69'];

        // Nettoyer le numéro
        $cleanNumber = preg_replace('/[^0-9]/', '', $phoneNumber);
        
        // Extraire les 2 premiers chiffres après le code pays (229)
        if (strlen($cleanNumber) === 10) {
            $prefix = substr($cleanNumber, 2, 2);
        } elseif (strlen($cleanNumber) === 8) {
            $prefix = substr($cleanNumber, 0, 2);
        } else {
            return null;
        }

        if (in_array($prefix, $orangePrefixes)) {
            return 'orange';
        } elseif (in_array($prefix, $mtnPrefixes)) {
            return 'mtn';
        }

        return null;
    }
}
