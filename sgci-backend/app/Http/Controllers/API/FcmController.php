<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\FcmToken;
use App\Services\FcmService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FcmController extends Controller
{
    protected FcmService $fcmService;

    public function __construct(FcmService $fcmService)
    {
        $this->fcmService = $fcmService;
    }

    public function registerToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|max:500',
            'device_name' => 'nullable|string|max:255',
            'platform' => 'nullable|in:ios,android,web',
        ]);

        try {
            // Vérifier si le token existe déjà pour cet utilisateur
            $existingToken = FcmToken::where('user_id', $request->user()->id)
                ->where('token', $validated['token'])
                ->first();

            if ($existingToken) {
                // Mettre à jour le token existant
                $existingToken->update([
                    'device_name' => $validated['device_name'] ?? $existingToken->device_name,
                    'platform' => $validated['platform'] ?? $existingToken->platform,
                    'last_used_at' => now(),
                    'is_active' => true,
                ]);

                return response()->json([
                    'message' => 'Token mis à jour avec succès',
                    'token' => $existingToken,
                ]);
            }

            // Créer un nouveau token
            $token = FcmToken::create([
                'user_id' => $request->user()->id,
                'token' => $validated['token'],
                'device_name' => $validated['device_name'] ?? 'Unknown Device',
                'platform' => $validated['platform'] ?? 'unknown',
                'last_used_at' => now(),
                'is_active' => true,
            ]);

            return response()->json([
                'message' => 'Token enregistré avec succès',
                'token' => $token,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Erreur enregistrement token FCM', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erreur lors de l\'enregistrement du token',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function unregisterToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        try {
            $token = FcmToken::where('user_id', $request->user()->id)
                ->where('token', $validated['token'])
                ->first();

            if (!$token) {
                return response()->json([
                    'message' => 'Token non trouvé',
                ], 404);
            }

            $token->delete();

            return response()->json([
                'message' => 'Token supprimé avec succès',
            ]);
        } catch (\Exception $e) {
            Log::error('Erreur suppression token FCM', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erreur lors de la suppression du token',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function myTokens(Request $request): JsonResponse
    {
        $tokens = FcmToken::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'tokens' => $tokens,
            'count' => $tokens->count(),
            'active_count' => $tokens->where('is_active', true)->count(),
        ]);
    }

    public function testNotification(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:500',
        ]);

        try {
            $result = $this->fcmService->sendToUser(
                $request->user(),
                $validated['title'],
                $validated['body'],
                ['type' => 'test']
            );

            return response()->json([
                'message' => 'Notification de test envoyée',
                'result' => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Erreur notification test FCM', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erreur lors de l\'envoi de la notification',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
