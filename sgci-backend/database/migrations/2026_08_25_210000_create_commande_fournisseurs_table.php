<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commande_fournisseurs', function (Blueprint $table) {
            $table->id();
            $table->string('numero_commande')->unique();
            $table->foreignId('fournisseur_id')->constrained('fournisseurs')->cascadeOnDelete();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('date_commande')->nullable();
            $table->date('date_livraison_prevue')->nullable();
            $table->date('date_livraison_reelle')->nullable();
            $table->string('statut', 30)->default('en_attente');
            $table->decimal('montant_total', 12, 2)->default(0);
            $table->decimal('montant_paye', 12, 2)->default(0);
            $table->string('conditions_paiement')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['boutique_id', 'statut']);
        });

        Schema::create('ligne_commande_fournisseurs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('commande_fournisseur_id')->constrained('commande_fournisseurs')->cascadeOnDelete();
            $table->foreignId('produit_id')->constrained('produits')->cascadeOnDelete();
            $table->integer('quantite_commandee');
            $table->integer('quantite_recue')->default(0);
            $table->decimal('prix_unitaire', 10, 2);
            $table->decimal('montant_total', 12, 2);
            $table->string('statut', 30)->default('en_attente');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ligne_commande_fournisseurs');
        Schema::dropIfExists('commande_fournisseurs');
    }
};
