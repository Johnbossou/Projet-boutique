<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transferts_stocks', function (Blueprint $table) {
            $table->id();
            $table->string('numero_transfert')->unique();
            $table->foreignId('boutique_source_id')->constrained('boutiques')->cascadeOnDelete();
            $table->foreignId('boutique_destination_id')->constrained('boutiques')->cascadeOnDelete();
            $table->foreignId('produit_id')->constrained('produits')->cascadeOnDelete();
            $table->integer('quantite');
            $table->string('statut', 30)->default('en_attente');
            $table->date('date_transfert')->nullable();
            $table->date('date_reception')->nullable();
            $table->text('motif')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_source_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_destination_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['boutique_source_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transferts_stocks');
    }
};
