<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Normalise l'encodage des colonnes ENUM de mouvements_stock.
     *
     * Les migrations source contenaient des caractères « accepté » / « rejeté »
     * / « entrée » à l'origine encodés en mojibake, ce qui faisait échouer les
     * INSERT (SQLSTATE 1265 Data truncated) dès qu'on écrivait la valeur propre.
     * On passe sur des valeurs ASCII sans accent pour éliminer tout problème
     * d'encodage entre le code PHP et MySQL.
     */
    public function up(): void
    {
        // Remettre à plat les lignes existantes avant changement d'ENUM
        DB::table('mouvements_stock')->update([
            'statut' => DB::raw("CASE statut WHEN 'accepté' THEN 'accepte' WHEN 'rejeté' THEN 'rejete' ELSE statut END"),
        ]);

        Schema::table('mouvements_stock', function (Blueprint $table) {
            $table->enum('type', ['entree', 'sortie'])->default('entree')->change();
            $table->enum('raison', ['arrivage', 'vente', 'ajustement', 'retour', 'casse'])->default('arrivage')->change();
            $table->enum('statut', ['en_attente', 'accepte', 'rejete'])->default('en_attente')->change();
        });
    }

    public function down(): void
    {
        Schema::table('mouvements_stock', function (Blueprint $table) {
            $table->enum('type', ['entree', 'sortie'])->default('entree')->change();
            $table->enum('raison', ['arrivage', 'vente', 'ajustement', 'retour', 'casse'])->default('arrivage')->change();
            $table->enum('statut', ['en_attente', 'accepte', 'rejete'])->default('en_attente')->change();
        });
    }
};