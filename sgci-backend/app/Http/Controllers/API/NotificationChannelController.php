<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NotificationChannelController extends Controller
{
    protected $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Envoie une notification de test par email
     */
    public function sendTestEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string',
        ]);

        $user = $request->user();

        $result = $this->notificationService->sendEmail(
            $user,
            'Test Notification SGCI',
            $validated['message']
        );

        if ($result) {
            return response()->json([
                'message' => 'Email de test envoyé avec succès',
            ]);
        }

        return response()->json([
            'message' => 'Erreur lors de l\'envoi de l\'email de test',
        ], 500);
    }

    /**
     * Envoie une notification de test par SMS
     */
    public function sendTestSms(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:160',
        ]);

        $user = $request->user();

        if (!$user->telephone) {
            return response()->json([
                'message' => 'Vous devez avoir un numéro de téléphone pour recevoir des SMS',
            ], 400);
        }

        $result = $this->notificationService->sendSms($user, $validated['message']);

        if ($result) {
            return response()->json([
                'message' => 'SMS de test envoyé avec succès',
            ]);
        }

        return response()->json([
            'message' => 'Erreur lors de l\'envoi du SMS de test',
        ], 500);
    }

    /**
     * Envoie une notification de test par email et SMS
     */
    public function sendTestMultiChannel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string',
        ]);

        $user = $request->user();

        $subject = 'Test Notification SGCI';
        $emailContent = $validated['message'];
        $smsContent = substr($validated['message'], 0, 160);

        $results = $this->notificationService->sendMultiChannel(
            $user,
            $subject,
            $emailContent,
            $smsContent
        );

        return response()->json([
            'message' => 'Notifications de test envoyées',
            'results' => $results,
        ]);
    }

    /**
     * Met à jour les préférences de notification de l'utilisateur.
     * Reçoit un objet JSON avec les clés : alerte_stock, alerte_peremption,
     * nouvelle_vente, validation_arrivage, nouveau_message, rapport_quotidien, push_mobile.
     */
    public function updatePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'alerte_stock' => 'boolean',
            'alerte_peremption' => 'boolean',
            'nouvelle_vente' => 'boolean',
            'validation_arrivage' => 'boolean',
            'nouveau_message' => 'boolean',
            'rapport_quotidien' => 'boolean',
            'push_mobile' => 'boolean',
        ]);

        $user = $request->user();
        $prefs = $user->notification_preferences ?? [];
        $user->notification_preferences = array_merge($prefs, $validated);
        $user->save();

        return response()->json([
            'message' => 'Préférences de notification mises à jour',
            'data' => $user->notification_preferences,
        ]);
    }

    /**
     * Récupère les préférences de notification de l'utilisateur
     */
    public function getPreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        $defaults = [
            'alerte_stock' => true,
            'alerte_peremption' => true,
            'nouvelle_vente' => true,
            'validation_arrivage' => true,
            'nouveau_message' => true,
            'rapport_quotidien' => true,
            'push_mobile' => true,
        ];

        return response()->json([
            'data' => array_merge($defaults, $user->notification_preferences ?? []),
        ]);
    }
}
