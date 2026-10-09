<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La déduplication des ventes est faite par boutique dans VenteController
 * (where boutique_id + idempotency_key), mais l'index unique était GLOBAL.
 *
 * Conséquence : deux boutiques distinctes qui envoient la même clé
 * (clé générée par appareil, horodatage, compteur local...) voyaient la
 * seconde vente rejetée par la base, alors qu'elle est légitime.
 *
 * On aligne la contrainte sur la logique applicative, comme cela a été fait
 * pour mouvements_stock dans 2026_09_29_000000_complete_arrivage_workflow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key']);
        });

        Schema::table('ventes', function (Blueprint $table) {
            $table->unique(
                ['boutique_id', 'idempotency_key'],
                'ventes_boutique_idempotency_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropUnique('ventes_boutique_idempotency_unique');
        });

        Schema::table('ventes', function (Blueprint $table) {
            $table->unique('idempotency_key');
        });
    }
};
