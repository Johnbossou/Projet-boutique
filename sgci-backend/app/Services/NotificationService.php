<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Envoie une notification par email
     */
    public function sendEmail(User $user, string $subject, string $content, array $data = []): bool
    {
        try {
            if (! $user->email) {
                Log::warning('Utilisateur sans email', ['user_id' => $user->id]);

                return false;
            }

            Mail::raw($content, function ($message) use ($user, $subject) {
                $message->to($user->email)
                    ->subject($subject);
            });

            Log::info('Email envoyé avec succès', [
                'user_id' => $user->id,
                'subject' => $subject,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Erreur lors de l\'envoi de l\'email', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Envoie une notification par SMS
     */
    public function sendSms(User $user, string $message): bool
    {
        try {
            if (! $user->telephone) {
                Log::warning('Utilisateur sans numéro de téléphone', ['user_id' => $user->id]);

                return false;
            }

            // Utiliser un service SMS (ex: Twilio, Orange SMS, etc.)
            $apiKey = config('services.sms.api_key');
            $senderId = config('services.sms.sender_id', 'SGCI');

            $response = Http::post(config('services.sms.api_url'), [
                'api_key' => $apiKey,
                'sender_id' => $senderId,
                'phone_number' => $this->formatPhoneNumber($user->telephone),
                'message' => $message,
            ]);

            if ($response->successful()) {
                Log::info('SMS envoyé avec succès', [
                    'user_id' => $user->id,
                    'phone' => $user->telephone,
                ]);

                return true;
            }

            Log::error('Échec de l\'envoi SMS', [
                'user_id' => $user->id,
                'response' => $response->body(),
            ]);

            return false;
        } catch (\Exception $e) {
            Log::error('Erreur lors de l\'envoi du SMS', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Envoie une notification par email et SMS
     */
    public function sendMultiChannel(User $user, string $subject, string $emailContent, string $smsContent, array $data = []): array
    {
        $results = [
            'email' => false,
            'sms' => false,
        ];

        // Envoyer par email
        $results['email'] = $this->sendEmail($user, $subject, $emailContent, $data);

        // Envoyer par SMS
        $results['sms'] = $this->sendSms($user, $smsContent);

        return $results;
    }

    /**
     * Formate un numéro de téléphone pour l'envoi SMS
     */
    private function formatPhoneNumber(string $phone): string
    {
        // Nettoyer le numéro
        $clean = preg_replace('/[^0-9]/', '', $phone);

        // Ajouter le code pays Bénin si nécessaire
        if (strlen($clean) === 8) {
            return '+229'.$clean;
        }

        if (strlen($clean) === 10 && substr($clean, 0, 2) === '229') {
            return '+'.$clean;
        }

        return $clean;
    }
}
