<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailService
{
    public function sendStockAlert(User $user, string $productName, int $currentStock, int $threshold): array
    {
        try {
            $data = [
                'user_name' => $user->name,
                'product_name' => $productName,
                'current_stock' => $currentStock,
                'threshold' => $threshold,
                'boutique_name' => config('app.name', 'SGCI Bénin'),
            ];

            Mail::send('emails.stock-alert', $data, function ($message) use ($user, $productName) {
                $message->to($user->email)
                    ->subject("Alerte Stock: {$productName} en rupture");
            });

            Log::info("Email alerte stock envoyé à {$user->email} pour produit {$productName}");

            return [
                'success' => true,
                'message' => 'Email envoyé avec succès',
            ];
        } catch (\Exception $e) {
            Log::error("Erreur envoi email alerte stock", [
                'user_id' => $user->id,
                'product_name' => $productName,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi de l\'email',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function sendNewSaleNotification(User $user, string $saleNumber, float $amount): array
    {
        try {
            $data = [
                'user_name' => $user->name,
                'sale_number' => $saleNumber,
                'amount' => $amount,
                'boutique_name' => config('app.name', 'SGCI Bénin'),
            ];

            Mail::send('emails.new-sale', $data, function ($message) use ($user, $saleNumber) {
                $message->to($user->email)
                    ->subject("Nouvelle Vente: #{$saleNumber}");
            });

            Log::info("Email notification vente envoyé à {$user->email}");

            return [
                'success' => true,
                'message' => 'Email envoyé avec succès',
            ];
        } catch (\Exception $e) {
            Log::error("Erreur envoi email notification vente", [
                'user_id' => $user->id,
                'sale_number' => $saleNumber,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi de l\'email',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function sendArrivalValidation(User $user, string $productName, int $quantity): array
    {
        try {
            $data = [
                'user_name' => $user->name,
                'product_name' => $productName,
                'quantity' => $quantity,
                'boutique_name' => config('app.name', 'SGCI Bénin'),
            ];

            Mail::send('emails.arrival-validated', $data, function ($message) use ($user, $productName) {
                $message->to($user->email)
                    ->subject("Arrivage Validé: {$productName}");
            });

            Log::info("Email arrivage validé envoyé à {$user->email}");

            return [
                'success' => true,
                'message' => 'Email envoyé avec succès',
            ];
        } catch (\Exception $e) {
            Log::error("Erreur envoi email arrivage validé", [
                'user_id' => $user->id,
                'product_name' => $productName,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi de l\'email',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function sendDailyReport(User $user, array $stats): array
    {
        try {
            $data = array_merge($stats, [
                'user_name' => $user->name,
                'boutique_name' => config('app.name', 'SGCI Bénin'),
                'date' => now()->format('d/m/Y'),
            ]);

            Mail::send('emails.daily-report', $data, function ($message) use ($user) {
                $message->to($user->email)
                    ->subject("Rapport Quotidien - " . now()->format('d/m/Y'));
            });

            Log::info("Email rapport quotidien envoyé à {$user->email}");

            return [
                'success' => true,
                'message' => 'Email envoyé avec succès',
            ];
        } catch (\Exception $e) {
            Log::error("Erreur envoi email rapport quotidien", [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi de l\'email',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function sendPasswordReset(User $user, string $resetUrl): array
    {
        try {
            $data = [
                'user_name' => $user->name,
                'reset_url' => $resetUrl,
                'boutique_name' => config('app.name', 'SGCI Bénin'),
            ];

            Mail::send('emails.password-reset', $data, function ($message) use ($user) {
                $message->to($user->email)
                    ->subject('Réinitialisation de votre mot de passe');
            });

            Log::info("Email de réinitialisation envoyé à {$user->email}");

            return [
                'success' => true,
                'message' => 'Email envoyé avec succès',
            ];
        } catch (\Exception $e) {
            Log::error("Erreur envoi email réinitialisation mot de passe", [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi de l\'email',
                'error' => $e->getMessage(),
            ];
        }
    }
}
