<?php

namespace App\Traits;

use App\Services\AuditLogService;
use Illuminate\Database\Eloquent\Model;

trait Auditable
{
    protected function audit(): AuditLogService
    {
        return app(AuditLogService::class);
    }

    /**
     * Log une création dans l'audit trail
     */
    protected function auditCreate(Model $model): void
    {
        $this->audit()->logCreate(
            class_basename($model),
            $model->id,
            $model->toArray()
        );
    }

    /**
     * Log une modification dans l'audit trail
     */
    protected function auditUpdate(Model $model, array $oldValues): void
    {
        $this->audit()->logUpdate(
            class_basename($model),
            $model->id,
            $oldValues,
            $model->toArray()
        );
    }

    /**
     * Log une suppression dans l'audit trail
     */
    protected function auditDelete(Model $model): void
    {
        $this->audit()->logDelete(
            class_basename($model),
            $model->id,
            $model->toArray()
        );
    }
}
