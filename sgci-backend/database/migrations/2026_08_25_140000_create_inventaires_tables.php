<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventaires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boutique_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('reference')->unique();
            $table->text('notes')->nullable();
            $table->enum('statut', ['en_cours', 'termine', 'valide', 'annule'])->default('en_cours');
            $table->integer('total_produits')->default(0);
            $table->integer('ecarts_detectes')->default(0);
            $table->timestamps();
        });

        Schema::create('inventaire_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventaire_id')->constrained()->onDelete('cascade');
            $table->foreignId('produit_id')->constrained()->onDelete('cascade');
            $table->integer('quantite_systeme');
            $table->integer('quantite_physique')->nullable();
            $table->integer('ecart')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventaire_lignes');
        Schema::dropIfExists('inventaires');
    }
};
