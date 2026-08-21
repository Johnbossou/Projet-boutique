<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogService
{
    /**
     * Log une action dans l'audit trail
     */
    public function log(
        string $action,
        ?string $model = null,
        ?int $modelId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?User $user = null,
        ?Request $request = null
    ): AuditLog {
        $request = $request ?? request();
        $user = $user ?? auth()->user();

        return AuditLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'model' => $model,
            'model_id' => $modelId,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);
    }

    /**
     * Log une création
     */
    public function logCreate(string $model, int $modelId, array $newValues, ?User $user = null): AuditLog
    {
        return $this->log('create', $model, $modelId, null, $newValues, $user);
    }

    /**
     * Log une modification
     */
    public function logUpdate(string $model, int $modelId, array $oldValues, array $newValues, ?User $user = null): AuditLog
    {
        return $this->log('update', $model, $modelId, $oldValues, $newValues, $user);
    }

    /**
     * Log une suppression
     */
    public function logDelete(string $model, int $modelId, array $oldValues, ?User $user = null): AuditLog
    {
        return $this->log('delete', $model, $modelId, $oldValues, null, $user);
    }

    /**
     * Log une connexion
     */
    public function logLogin(User $user, ?Request $request = null): AuditLog
    {
        return $this->log('login', 'User', $user->id, null, ['email' => $user->email], $user, $request);
    }

    /**
     * Log une déconnexion
     */
    public function logLogout(User $user, ?Request $request = null): AuditLog
    {
        return $this->log('logout', 'User', $user->id, null, ['email' => $user->email], $user, $request);
    }

    /**
     * Log une inscription
     */
    public function logRegistration(User $user, ?Request $request = null): AuditLog
    {
        return $this->log('registration', 'User', $user->id, null, ['email' => $user->email, 'name' => $user->name], $user, $request);
    }

    /**
     * Log une tentative de connexion échouée
     */
    public function logFailedLogin(string $email, ?Request $request = null): AuditLog
    {
        return $this->log('failed_login', 'User', null, null, ['email' => $email], null, $request);
    }

    /**
     * Log une tentative d'accès non autorisé
     */
    public function logUnauthorizedAccess(string $route, ?User $user = null, ?Request $request = null): AuditLog
    {
        return $this->log('unauthorized_access', null, null, null, ['route' => $route], $user, $request);
    }

    /**
     * Récupère les logs récents
     */
    public function getRecentLogs(int $limit = 50, ?int $userId = null)
    {
        $query = AuditLog::with('user')
            ->orderByDesc('created_at')
            ->limit($limit);

        if ($userId) {
            $query->where('user_id', $userId);
        }

        return $query->get();
    }

    /**
     * Récupère les logs pour un modèle spécifique
     */
    public function getLogsForModel(string $model, int $modelId, int $limit = 50)
    {
        return AuditLog::with('user')
            ->where('model', $model)
            ->where('model_id', $modelId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }
}
