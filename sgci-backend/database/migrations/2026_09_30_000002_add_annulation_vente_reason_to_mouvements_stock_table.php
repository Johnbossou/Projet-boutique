<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajoute la raison « annulation_vente » à l'ENUM mouvements_stock.raison.
     *
     * Vente::annuler() écrit un mouvement compensateur de type « sortie » avec
     * cette raison. Elle était absente de l'ENUM : sur MySQL/TiDB en mode strict
     * l'INSERT levait SQLSTATE 1265 (Data truncated), ce qui annulait toute la
     * transaction — la vente restait « termine » et le stock n'etait pas restitue.
     *
     * Le test unitaire passait car SQLite n'applique pas les ENUM.
     */
    public function up(): void
    {
        Schema::table('mouvements_stock', function (Blueprint $table) {
            $table->enum('raison', ['arrivage', 'vente', 'ajustement', 'retour', 'casse', 'annulation_vente'])
                ->default('arrivage')
                ->change();
        });
    }

    public function down(): void
    {
        // Les mouvements d'annulation deviennent irrepresentables : on refuse
        // le rollback plutot que de corrompre silencieusement le ledger.
        throw new RuntimeException(
            'Rollback impossible : des mouvements raison=annulation_vente existent. '
            .'Convertissez-les vers une autre raison avant de downgrader.'
        );
    }
};
