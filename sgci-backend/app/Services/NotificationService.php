<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Http;

class NotificationService
{
    /**
     * Vérifie si l'utilisateur souhaite recevoir ce type de notification.
     * Retourne false si la préférence est explicitement désactivée.
     */
    private function shouldNotify(User $user, string $preferenceKey): bool
    {
        return $user->prefereNotification($preferenceKey);
    }

    /**
     * Envoie une notification par email
     */
    public function sendEmail(User $user, string $subject, string $content, array $data = []): bool
    {
        try {
            if (!$user->email) {
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
            if (!$user->telephone) {
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
     * Envoie une notification de stock bas par email et SMS
     */
    public function sendStockAlert(User $user, string $productName, int $currentStock, int $threshold): array
    {
        if (!$this->shouldNotify($user, 'alerte_stock')) {
            return ['skipped' => true, 'reason' => 'preference_desactivee'];
        }

        $subject = "⚠️ Alert Stock: {$productName}";
        
        $emailContent = "Bonjour {$user->name},\n\n" .
            "Le produit {$productName} est en alerte de stock.\n\n" .
            "Stock actuel: {$currentStock}\n" .
            "Seuil d'alerte: {$threshold}\n\n" .
            "Veuillez procéder au réapprovisionnement.\n\n" .
            "Cordialement,\nL'équipe SGCI";

        $smsContent = "Alerte Stock: {$productName} (Stock: {$currentStock}, Seuil: {$threshold}). Merci de réapprovisionner.";

        return $this->sendMultiChannel($user, $subject, $emailContent, $smsContent);
    }

    /**
     * Envoie une notification de rupture de stock par email et SMS
     */
    public function sendStockRupture(User $user, string $productName): array
    {
        if (!$this->shouldNotify($user, 'alerte_stock')) {
            return ['skipped' => true, 'reason' => 'preference_desactivee'];
        }

        $subject = "🚨 Rupture Stock: {$productName}";
        
        $emailContent = "Bonjour {$user->name},\n\n" .
            "Le produit {$productName} est en rupture de stock.\n\n" .
            "Veuillez procéder au réapprovisionnement urgent.\n\n" .
            "Cordialement,\nL'équipe SGCI";

        $smsContent = "Rupture Stock: {$productName}. Réapprovisionnement urgent requis.";

        return $this->sendMultiChannel($user, $subject, $emailContent, $smsContent);
    }

    /**
     * Envoie une notification de péremption par email et SMS
     */
    public function sendPeremptionAlert(User $user, string $productName, string $expirationDate, int $daysRemaining): array
    {
        if (!$this->shouldNotify($user, 'alerte_peremption')) {
            return ['skipped' => true, 'reason' => 'preference_desactivee'];
        }

        $subject = "⏰ Alert Péremption: {$productName}";
        
        $emailContent = "Bonjour {$user->name},\n\n" .
            "Le produit {$productName} expire dans {$daysRemaining} jours.\n\n" .
            "Date de péremption: {$expirationDate}\n\n" .
            "Veuillez prendre les mesures nécessaires.\n\n" .
            "Cordialement,\nL'équipe SGCI";

        $smsContent = "Alert Péremption: {$productName} expire dans {$daysRemaining} jours.";

        return $this->sendMultiChannel($user, $subject, $emailContent, $smsContent);
    }

    /**
     * Envoie une notification de nouvelle commande par email et SMS
     */
    public function sendNewOrderAlert(User $user, string $orderNumber, string $clientName, float $amount): array
    {
        if (!$this->shouldNotify($user, 'nouvelle_vente')) {
            return ['skipped' => true, 'reason' => 'preference_desactivee'];
        }

        $subject = "📦 Nouvelle Commande: {$orderNumber}";
        
        $emailContent = "Bonjour {$user->name},\n\n" .
            "Une nouvelle commande a été reçue.\n\n" .
            "Numéro de commande: {$orderNumber}\n" .
            "Client: {$clientName}\n" .
            "Montant: {$amount} FCFA\n\n" .
            "Cordialement,\nL'équipe SGCI";

        $smsContent = "Nouvelle commande {$orderNumber} de {$clientName} ({$amount} FCFA).";

        return $this->sendMultiChannel($user, $subject, $emailContent, $smsContent);
    }

    /**
     * Envoie une notification de paiement reçu par email et SMS
     */
    public function sendPaymentReceived(User $user, string $paymentNumber, float $amount): array
    {
        if (!$this->shouldNotify($user, 'nouvelle_vente')) {
            return ['skipped' => true, 'reason' => 'preference_desactivee'];
        }

        $subject = "💰 Paiement Reçu: {$paymentNumber}";
        
        $emailContent = "Bonjour {$user->name},\n\n" .
            "Un paiement a été reçu.\n\n" .
            "Numéro de paiement: {$paymentNumber}\n" .
            "Montant: {$amount} FCFA\n\n" .
            "Cordialement,\nL'équipe SGCI";

        $smsContent = "Paiement reçu: {$paymentNumber} ({$amount} FCFA).";

        return $this->sendMultiChannel($user, $subject, $emailContent, $smsContent);
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
            return '+229' . $clean;
        }
        
        if (strlen($clean) === 10 && substr($clean, 0, 2) === '229') {
            return '+' . $clean;
        }
        
        return $clean;
    }

    /**
     * Envoie une notification enregistrée dans la base par email et SMS
     */
    public function sendNotificationFromModel(AppNotification $notification): array
    {
        $user = $notification->user;
        
        if (!$user) {
            return ['email' => false, 'sms' => false];
        }

        if (!$this->shouldNotify($user, $notification->type ?? 'systeme')) {
            return ['skipped' => true, 'reason' => 'preference_desactivee'];
        }

        $subject = $notification->title;
        $emailContent = $notification->message;
        $smsContent = substr($notification->message, 0, 160); // Limite SMS

        return $this->sendMultiChannel($user, $subject, $emailContent, $smsContent);
    }
}
