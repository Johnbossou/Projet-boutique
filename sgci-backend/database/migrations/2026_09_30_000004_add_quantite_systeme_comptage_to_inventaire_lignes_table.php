<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajoute inventaire_lignes.quantite_systeme_comptage.
     *
     * L'écart d'inventaire était calculé contre quantite_systeme, figée à la
     * création de l'inventaire. Or la boutique continue de vendre et de
     * réceptionner pendant le comptage. La validation écrasait ensuite le
     * stock par la valeur physique absolue, ce qui détruisait les mouvements
     * intervenus entre l'ouverture de l'inventaire et sa validation : des
     * articles légitimement vendus étaient réintégrés en stock.
     *
     * quantite_systeme_comptage mémorise le stock réellement affiché au moment
     * où le comptant saisit la quantité. L'écart se calcule donc sur une base
     * valide, et la validation appliquera un delta au stock courant au lieu
     * d'une valeur absolue.
     *
     * quantite_systeme est conservé : il reste la référence « théorique à
     * l'ouverture » affichée dans le rapport d'écarts.
     */
    public function up(): void
    {
        Schema::table('inventaire_lignes', function (Blueprint $table) {
            $table->integer('quantite_systeme_comptage')->nullable()->after('quantite_systeme');
        });
    }

    public function down(): void
    {
        Schema::table('inventaire_lignes', function (Blueprint $table) {
            $table->dropColumn('quantite_systeme_comptage');
        });
    }
};
