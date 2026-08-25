<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retours_vente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vente_id')->constrained()->onDelete('cascade');
            $table->foreignId('boutique_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['partiel', 'total'])->default('partiel');
            $table->enum('motif', ['defectueux', 'erreur_commande', 'insatisfait', 'autre'])->default('autre');
            $table->text('motif_detail')->nullable();
            $table->decimal('montant_rembourse', 12, 2)->default(0);
            $table->enum('statut', ['en_attente', 'valide', 'refuse'])->default('en_attente');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('retour_vente_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('retour_vente_id')->constrained()->onDelete('cascade');
            $table->foreignId('ligne_vente_id')->constrained()->onDelete('cascade');
            $table->foreignId('produit_id')->constrained()->onDelete('cascade');
            $table->integer('quantite_retournee');
            $table->decimal('prix_unitaire', 10, 2);
            $table->decimal('montant_retourne', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retour_vente_lignes');
        Schema::dropIfExists('retours_vente');
    }
};
