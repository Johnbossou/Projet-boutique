<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /**
     * Handle API errors and return consistent response
     *
     * @return JsonResponse
     */
    protected function handleError(Exception $e, string $message = 'Erreur serveur', int $statusCode = 500)
    {
        // Log the error
        Log::error($message, [
            'exception' => get_class($e),
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString(),
            'user_id' => auth()->id(),
            'boutique_id' => auth()->user()?->current_boutique_id,
        ]);

        // Return appropriate response based on exception type
        if ($e instanceof ModelNotFoundException) {
            return response()->json([
                'message' => 'Ressource non trouvée',
            ], 404);
        }

        if ($e instanceof ValidationException) {
            return response()->json([
                'message' => 'Erreur de validation',
                'errors' => $e->errors(),
            ], 422);
        }

        if ($e instanceof AuthenticationException) {
            return response()->json([
                'message' => 'Non authentifié',
            ], 401);
        }

        if ($e instanceof AuthorizationException) {
            return response()->json([
                'message' => 'Accès non autorisé',
            ], 403);
        }

        if ($e instanceof QueryException) {
            return response()->json([
                'message' => 'Erreur de base de données',
                'error' => config('app.debug') ? $e->getMessage() : 'Erreur lors de l\'exécution de la requête',
            ], 500);
        }

        // Generic error response
        return response()->json([
            'message' => $message,
            'error' => config('app.debug') ? $e->getMessage() : 'Une erreur est survenue',
        ], $statusCode);
    }

    /**
     * Handle successful API response
     *
     * @param  mixed  $data
     * @return JsonResponse
     */
    protected function successResponse($data = null, string $message = 'Succès', int $statusCode = 200)
    {
        return response()->json([
            'message' => $message,
            'data' => $data,
        ], $statusCode);
    }

    /**
     * Handle error API response
     *
     * @param  mixed  $errors
     * @return JsonResponse
     */
    protected function errorResponse(string $message, $errors = null, int $statusCode = 400)
    {
        $response = [
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $statusCode);
    }

    /**
     * Log audit trail for sensitive actions
     *
     * @return void
     */
    protected function logAudit(string $action, string $description, array $metadata = [])
    {
        Log::info('Audit Log', [
            'action' => $action,
            'description' => $description,
            'user_id' => auth()->id(),
            'user_email' => auth()->user()?->email,
            'user_role' => auth()->user()?->role,
            'boutique_id' => auth()->user()?->current_boutique_id,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'metadata' => $metadata,
            'timestamp' => now(),
        ]);
    }
}
