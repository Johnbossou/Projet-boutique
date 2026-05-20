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
        Schema::create('mouvements_stock', function (Blueprint $table) {
            $table->id();

            // Clés étrangères
            $table->foreignId('produit_id')->constrained('produits')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');

            // Types et raisons
            $table->enum('type', ['entrée', 'sortie'])->default('entrée');
            $table->enum('raison', ['arrivage', 'vente', 'ajustement', 'retour', 'casse'])->default('arrivage');

            // Données du mouvement
            $table->integer('quantite')->unsigned();
            $table->string('reference_bon')->nullable()->comment('Numéro de bon de commande/arrivage');
            $table->enum('statut', ['en_attente', 'accepté', 'rejeté'])->default('en_attente');

            // Audit trail
            $table->integer('quantite_avant')->unsigned()->nullable();
            $table->integer('quantite_apres')->unsigned()->nullable();
            $table->text('notes')->nullable();

            // Timestamps
            $table->timestamps();

            // Index pour les performances
            $table->index('produit_id');
            $table->index('user_id');
            $table->index('raison');
            $table->index('type');
            $table->index('statut');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mouvements_stock');
    }
};
