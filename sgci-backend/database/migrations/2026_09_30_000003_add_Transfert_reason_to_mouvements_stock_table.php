<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajoute la raison « transfert » à l'ENUM mouvements_stock.raison.
     *
     * Les transferts entre boutiques débitaient et créditaient
     * produits.quantite_stock sans écrire une seule ligne de journal : le
     * ledger devenait incapable de justifier un écart d'inventaire, puisque
     * la seule trace du mouvement était le journal transferts_stocks, sans
     * quantite_avant / quantite_apres.
     *
     * TransfertStockController ecrit désormais :
     *  - type sortie, raison transfert, boutique = source  (débit à la création) ;
     *  - type entree,  raison transfert, boutique = destination (crédit à la réception) ;
     *  - type entree,  raison transfert, boutique = source (restitution à l'annulation).
     */
    public function up(): void
    {
        Schema::table('mouvements_stock', function (Blueprint $table) {
            $table->enum('raison', [
                'arrivage',
                'vente',
                'ajustement',
                'retour',
                'casse',
                'annulation_vente',
                'transfert',
            ])->default('arrivage')->change();
        });
    }

    public function down(): void
    {
        throw new RuntimeException(
            'Rollback impossible : des mouvements raison=transfert existent et '
            .'le ledger de stock perdrait sa justification. '
            .'Convertissez-les vers une autre raison avant de downgrader.'
        );
    }
};
