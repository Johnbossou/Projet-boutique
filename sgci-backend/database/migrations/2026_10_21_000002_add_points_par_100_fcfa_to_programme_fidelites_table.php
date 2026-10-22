<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programme_fidelites', function (Blueprint $table) {
            // 0 = ancien mode : montant fixe points_par_achat par achat
            // (comportement inchangé pour les programmes existants).
            // > 0 = prorata du panier : floor(montant_total × p / 100),
            // points_par_achat alors ignoré.
            $table->unsignedInteger('points_par_100_fcfa')->default(0)->after('points_par_achat');
        });
    }

    public function down(): void
    {
        Schema::table('programme_fidelites', function (Blueprint $table) {
            $table->dropColumn('points_par_100_fcfa');
        });
    }
};
