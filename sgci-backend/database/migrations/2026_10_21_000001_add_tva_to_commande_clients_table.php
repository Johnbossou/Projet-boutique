<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commande_clients', function (Blueprint $table) {
            // Même régime que ventes.montant_total / ventes.tva :
            // montant_total reste la base HT (somme des lignes après remise),
            // tva est la TVA du taux boutique ajoutée à la création. Le client
            // paie montant_a_payer = montant_total + tva, comme à la caisse.
            // Les commandes antérieures restent à 0 : HT = TTC, fidèle à ce
            // qui a réellement été encaissé (aucun rétroactif).
            $table->decimal('tva', 12, 2)->default(0)->after('montant_total');
        });
    }

    public function down(): void
    {
        Schema::table('commande_clients', function (Blueprint $table) {
            $table->dropColumn('tva');
        });
    }
};
