<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    protected string $apiKey;

    protected string $senderId;

    protected string $apiUrl;

    protected string $provider;

    public function __construct()
    {
        $this->apiKey = (string) config('services.sms.api_key', '');
        $this->senderId = (string) config('services.sms.sender_id', 'SGCI');
        $this->provider = (string) config('services.sms.service', 'africas_talking');
        $this->apiUrl = (string) config('services.sms.api_url', '');
    }

    public function sendStockAlert(User $user, string $productName, int $currentStock): array
    {
        if (! $user->telephone) {
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
        if (! $user->telephone) {
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
        if (! $user->telephone) {
            return [
                'success' => false,
                'message' => 'Aucun numéro de téléphone disponible',
            ];
        }

        $message = "ARRIVAGE VALIDÉ: {$quantity} unités de {$productName} ajoutées au stock. SGCI Bénin.";

        return $this->sendSms($user->telephone, $message);
    }

    /**
     * Envoie un SMS a un numero.
     *
     * Point d'entree public : les autres services (notifications, commandes
     * fournisseur...) n'ont pas a connaitre les regles du canal.
     *
     * @return array{success: bool, message: string, phone?: string, error?: mixed}
     */
    public function envoyer(string $phoneNumber, string $message): array
    {
        return $this->sendSms($phoneNumber, $message);
    }

    protected function sendSms(string $phoneNumber, string $message): array
    {
        try {
            // Nettoyer le numéro de téléphone
            $phone = $this->formatPhoneNumber($phoneNumber);

            // Les SMS peuvent etre desactives entierement : c'est une
            // decision de l exploitant, pas une erreur de configuration. Le
            // service le dit, il ne part en erreur.
            if (! config('services.sms.enabled', false)) {
                Log::info('SMS desactive : message non envoye', ['phone' => $phone]);

                return [
                    'success' => false,
                    'message' => 'Les SMS sont desactives sur cette installation',
                    'phone' => $phone,
                ];
            }

            // Simulation pour le développement (remplacer par vrai appel API en production)
            if (config('services.sms.simulation', true)) {
                Log::info("SMS SIMULATION: Envoyé à {$phone} - Message: {$message}");

                return [
                    'success' => true,
                    'message' => 'SMS simulé avec succès',
                    'phone' => $phone,
                ];
            }

            if ($this->apiKey === '') {
                Log::error('Envoi SMS impossible : cle fournisseur absente');

                return [
                    'success' => false,
                    'message' => 'Cle du fournisseur SMS absente',
                    'phone' => $phone,
                ];
            }

            $response = $this->appelFournisseur($phone, $message);

            if ($response->successful()) {
                Log::info("SMS envoyé à {$phone}");

                return [
                    'success' => true,
                    'message' => 'SMS envoyé avec succès',
                    'phone' => $phone,
                ];
            }

            Log::error('Erreur envoi SMS', [
                'phone' => $phone,
                'response' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi du SMS',
                'error' => $response->body(),
            ];
        } catch (\Exception $e) {
            Log::error('Exception envoi SMS', [
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

    /**
     * Appel au fournisseur, selon le service configure.
     *
     * Africa's Talking n'est pas une API « cle + url + corps » : l'URL
     * porte le nom d'utilisateur et le corps est forme. Poster la meme
     * structure qu'un autre fournisseur renvoyait une erreur incomprehensible,
     * et l'URL par defaut du projet etait un domaine d'exemple : aucun SMS
     * n'aurait jamais pu partir.
     */
    protected function appelFournisseur(string $phone, string $message): Response
    {
        if ($this->provider === 'africas_talking') {
            return Http::asForm()->post($this->urlAfricasTalking(), [
                'username' => (string) config('services.sms.username', ''),
                'api_key' => $this->apiKey,
                'from' => $this->senderId,
                'to' => $phone,
                'message' => $message,
            ]);
        }

        return Http::post($this->apiUrl !== '' ? $this->apiUrl : 'https://api.smsprovider.com/send', [
            'api_key' => $this->apiKey,
            'sender' => $this->senderId,
            'to' => $phone,
            'message' => $message,
        ]);
    }

    /**
     * URL Africa's Talking : le nom d'utilisateur est dans l'URL.
     */
    protected function urlAfricasTalking(): string
    {
        if ($this->apiUrl !== '') {
            return $this->apiUrl;
        }

        $utilisateur = (string) config('services.sms.username', '');

        return 'https://api.africastalking.com/'.($utilisateur !== '' ? $utilisateur : 'sandbox').'/';
    }

    protected function formatPhoneNumber(string $phone): string
    {
        // Nettoyer et formater le numéro pour le Bénin (+229)
        $phone = preg_replace('/[^0-9]/', '', $phone);

        // Ajouter le code pays si nécessaire
        if (strlen($phone) === 8 && ! str_starts_with($phone, '229')) {
            $phone = '229'.$phone;
        }

        if (! str_starts_with($phone, '+')) {
            $phone = '+'.$phone;
        }

        return $phone;
    }
}
