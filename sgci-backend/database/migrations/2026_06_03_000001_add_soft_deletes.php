<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Helper portable : ajoute les soft deletes seulement si la colonne n'existe pas
        $addSoftDeletesIfNotExists = function ($table) {
            $tableName = $table->getTable();

            if (! Schema::hasColumn($tableName, 'deleted_at')) {
                $table->softDeletes();
            }
        };

        foreach (['produits', 'ventes', 'clients', 'categories', 'boutiques', 'users'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($addSoftDeletesIfNotExists) {
                $addSoftDeletesIfNotExists($table);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach (['users', 'boutiques', 'categories', 'clients', 'ventes', 'produits'] as $tableName) {
            if (Schema::hasColumn($tableName, 'deleted_at')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropSoftDeletes();
                });
            }
        }
    }
};
