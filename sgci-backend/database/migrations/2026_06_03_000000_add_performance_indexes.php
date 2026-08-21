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
        // Helpers portables : vérification via Schema::getIndexes()
        // (compatible MySQL et SQLite, contrairement à information_schema)
        $hasIndexOnColumns = function (string $tableName, array $columns): bool {
            $wanted = collect($columns)
                ->map(fn ($c) => strtolower((string) $c))
                ->sort()
                ->values()
                ->all();

            return collect(Schema::getIndexes($tableName))
                ->contains(function ($index) use ($wanted) {
                    $existing = collect($index['columns'])
                        ->map(fn ($c) => strtolower((string) $c))
                        ->sort()
                        ->values()
                        ->all();

                    return $existing === $wanted;
                });
        };

        $addIndexIfNotExists = function ($table, $columns) use ($hasIndexOnColumns) {
            $tableName = $table->getTable();
            $columns = is_array($columns) ? $columns : [$columns];

            if (! $hasIndexOnColumns($tableName, $columns)) {
                $table->index($columns);
            }
        };

        // Users table indexes
        Schema::table('users', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'role');
            $addIndexIfNotExists($table, 'est_actif');
            $addIndexIfNotExists($table, ['role', 'est_actif']);
            $addIndexIfNotExists($table, 'created_at');
        });

        // Boutiques table indexes
        Schema::table('boutiques', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'proprietaire_id');
            $addIndexIfNotExists($table, 'nom');
            $addIndexIfNotExists($table, 'created_at');
        });

        // Produits table indexes
        Schema::table('produits', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'nom');
            $addIndexIfNotExists($table, 'categorie_id');
            $addIndexIfNotExists($table, 'boutique_id');
            $addIndexIfNotExists($table, ['boutique_id', 'categorie_id']);
            $addIndexIfNotExists($table, 'quantite_stock');
            $addIndexIfNotExists($table, 'created_at');
            $addIndexIfNotExists($table, 'code_qr');
        });

        // Categories table indexes
        Schema::table('categories', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'nom');
            $addIndexIfNotExists($table, 'boutique_id');
            $addIndexIfNotExists($table, 'created_at');
        });

        // Ventes table indexes
        Schema::table('ventes', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'user_id');
            $addIndexIfNotExists($table, 'client_id');
            $addIndexIfNotExists($table, 'boutique_id');
            $addIndexIfNotExists($table, 'statut');
            $addIndexIfNotExists($table, 'created_at');
            $addIndexIfNotExists($table, ['boutique_id', 'created_at']);
            $addIndexIfNotExists($table, ['boutique_id', 'statut']);
            $addIndexIfNotExists($table, 'mode_paiement');
        });

        // Ligne_ventes table indexes
        Schema::table('ligne_ventes', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'vente_id');
            $addIndexIfNotExists($table, 'produit_id');
            $addIndexIfNotExists($table, ['vente_id', 'produit_id']);
        });

        // Clients table indexes
        Schema::table('clients', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'nom');
            $addIndexIfNotExists($table, 'email');
            $addIndexIfNotExists($table, 'telephone');
            $addIndexIfNotExists($table, 'boutique_id');
            $addIndexIfNotExists($table, 'statut');
            $addIndexIfNotExists($table, 'created_at');
        });

        // Mouvements_stock table indexes
        Schema::table('mouvements_stock', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'produit_id');
            $addIndexIfNotExists($table, 'user_id');
            $addIndexIfNotExists($table, 'boutique_id');
            $addIndexIfNotExists($table, 'raison');
            $addIndexIfNotExists($table, 'type');
            $addIndexIfNotExists($table, 'statut');
            $addIndexIfNotExists($table, 'created_at');
            $addIndexIfNotExists($table, ['boutique_id', 'created_at']);
        });

        // Audit_logs table indexes
        Schema::table('audit_logs', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'user_id');
            $addIndexIfNotExists($table, 'action');
            $addIndexIfNotExists($table, 'model');
            $addIndexIfNotExists($table, 'created_at');
            $addIndexIfNotExists($table, ['user_id', 'created_at']);
            $addIndexIfNotExists($table, ['action', 'created_at']);
        });

        // Notifications table indexes
        Schema::table('app_notifications', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, 'user_id');
            $addIndexIfNotExists($table, 'type');
            $addIndexIfNotExists($table, 'read_at');
            $addIndexIfNotExists($table, 'created_at');
            $addIndexIfNotExists($table, ['user_id', 'read_at']);
        });

        // Boutique_user pivot table indexes
        Schema::table('boutique_user', function (Blueprint $table) use ($addIndexIfNotExists) {
            $addIndexIfNotExists($table, ['boutique_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $dropIndexIfExists = function ($table, $columns): void {
            $tableName = $table->getTable();
            $columns = is_array($columns) ? $columns : [$columns];

            $wanted = collect($columns)
                ->map(fn ($c) => strtolower((string) $c))
                ->sort()
                ->values()
                ->all();

            $name = collect(Schema::getIndexes($tableName))
                ->first(function ($index) use ($wanted) {
                    $existing = collect($index['columns'])
                        ->map(fn ($c) => strtolower((string) $c))
                        ->sort()
                        ->values()
                        ->all();

                    return $existing === $wanted;
                })['name'] ?? null;

            if ($name !== null && ! $this->isAutoIndex($name)) {
                $table->dropIndex($name);
            }
        };

        foreach ([
            'users' => [['role', 'est_actif'], 'est_actif', 'role', 'created_at'],
            'boutiques' => ['proprietaire_id', 'nom', 'created_at'],
            'produits' => [['boutique_id', 'categorie_id'], 'categorie_id', 'quantite_stock', 'created_at'],
            'categories' => ['nom', 'boutique_id', 'created_at'],
            'ventes' => [['boutique_id', 'statut'], ['boutique_id', 'created_at'], 'mode_paiement', 'statut', 'created_at'],
            'ligne_ventes' => [['vente_id', 'produit_id'], 'produit_id', 'vente_id'],
            'clients' => ['nom', 'telephone', 'statut', 'created_at'],
            'mouvements_stock' => [['boutique_id', 'created_at'], 'statut', 'type', 'raison', 'created_at'],
            'audit_logs' => [['action', 'created_at'], ['user_id', 'created_at'], 'model', 'action', 'created_at'],
            'app_notifications' => [['user_id', 'read_at'], 'type', 'read_at', 'created_at'],
        ] as $tableName => $indexes) {
            Schema::table($tableName, function (Blueprint $table) use ($dropIndexIfExists, $indexes) {
                foreach ($indexes as $columns) {
                    $dropIndexIfExists($table, $columns);
                }
            });
        }
    }

    /**
     * Les index uniques et primaires sont gérés par les migrations de création.
     */
    private function isAutoIndex(string $name): bool
    {
        return str_contains($name, 'unique') || str_contains($name, 'primary');
    }
};
