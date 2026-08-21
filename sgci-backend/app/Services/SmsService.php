<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    protected string $apiKey;
    protected string $senderId;
    protected string $apiUrl;

    public function __construct()
    {
        $this->apiKey = (string) config('services.sms.api_key', '');
        $this->senderId = (string) config('services.sms.sender_id', 'SGCI');
        $this->apiUrl = (string) config('services.sms.api_url', 'https://api.smsprovider.com/send');
    }

    public function sendStockAlert(User $user, string $productName, int $currentStock): array
    {
        if (!$user->telephone) {
            return [
                'success' => false,
                'message' => 'Aucun numéro de téléphone disponible',
            ];
        }

        $message = "ALERTE STOCK: Le produit {$productName} est en rupture ({$currentStock} unités). Veuillez réapprovisionner.";

        return $this->sendSms($user->telephone, $message);
    }

    public function sendNewSaleNotification(User $user, string $saleNumber, float $amount): array
    {
        if (!$user->telephone) {
            return [
                'success' => false,
                'message' => 'Aucun numéro de téléphone disponible',
            ];
        }

        $message = "NOUVELLE VENTE: #{$saleNumber} - Montant: {$amount} FCFA. SGCI Bénin.";

        return $this->sendSms($user->telephone, $message);
    }

    public function sendArrivalValidation(User $user, string $productName, int $quantity): array
    {
        if (!$user->telephone) {
            return [
                'success' => false,
                'message' => 'Aucun numéro de téléphone disponible',
            ];
        }

        $message = "ARRIVAGE VALIDÉ: {$quantity} unités de {$productName} ajoutées au stock. SGCI Bénin.";

        return $this->sendSms($user->telephone, $message);
    }

    protected function sendSms(string $phoneNumber, string $message): array
    {
        try {
            // Nettoyer le numéro de téléphone
            $phone = $this->formatPhoneNumber($phoneNumber);

            // Simulation pour le développement (remplacer par vrai appel API en production)
            if (config('services.sms.simulation', true)) {
                Log::info("SMS SIMULATION: Envoyé à {$phone} - Message: {$message}");
                return [
                    'success' => true,
                    'message' => 'SMS simulé avec succès',
                    'phone' => $phone,
                ];
            }

            // Appel API réel (exemple avec un provider générique)
            $response = Http::post($this->apiUrl, [
                'api_key' => $this->apiKey,
                'sender' => $this->senderId,
                'to' => $phone,
                'message' => $message,
            ]);

            if ($response->successful()) {
                Log::info("SMS envoyé à {$phone}");
                return [
                    'success' => true,
                    'message' => 'SMS envoyé avec succès',
                    'phone' => $phone,
                ];
            }

            Log::error("Erreur envoi SMS", [
                'phone' => $phone,
                'response' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi du SMS',
                'error' => $response->body(),
            ];
        } catch (\Exception $e) {
            Log::error("Exception envoi SMS", [
                'phone' => $phoneNumber,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi du SMS',
                'error' => $e->getMessage(),
            ];
        }
    }

    protected function formatPhoneNumber(string $phone): string
    {
        // Nettoyer et formater le numéro pour le Bénin (+229)
        $phone = preg_replace('/[^0-9]/', '', $phone);

        // Ajouter le code pays si nécessaire
        if (strlen($phone) === 8 && !str_starts_with($phone, '229')) {
            $phone = '229' . $phone;
        }

        if (!str_starts_with($phone, '+')) {
            $phone = '+' . $phone;
        }

        return $phone;
    }
}
