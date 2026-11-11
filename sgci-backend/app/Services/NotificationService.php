<?php

namespace App\Services;

use App\Models\User;
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
     *
     * L'envoi passe par SmsService : c'est lui qui respecte l'activation du
     * canal, le mode simulation et le format du fournisseur. Le code
     * d'origine postait lui-meme vers une URL generique, sans regarder
     * SMS_ENABLED ni SMS_SIMULATION : en production il tentait un envoi a
     * chaque notification, vers un domaine d'exemple, et echouait a chaque
     * fois en silence.
     */
    public function sendSms(User $user, string $message): bool
    {
        if (! $user->telephone) {
            Log::warning('Utilisateur sans numéro de téléphone', ['user_id' => $user->id]);

            return false;
        }

        $resultat = app(SmsService::class)->envoyer($user->telephone, $message);

        if (! ($resultat['success'] ?? false)) {
            Log::error('Échec de l\'envoi du SMS', [
                'user_id' => $user->id,
                'raison' => $resultat['message'] ?? 'raison inconnue',
            ]);

            return false;
        }

        return true;
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
}
