<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commande_clients', function (Blueprint $table) {
            $table->id();
            $table->string('numero_commande')->unique();
            // devis_id sans contrainte FK : la table devis n'existe pas encore.
            $table->unsignedBigInteger('devis_id')->nullable()->index();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->date('date_commande')->nullable();
            $table->date('date_livraison_prevue')->nullable();
            $table->date('date_livraison_reelle')->nullable();
            $table->string('statut', 30)->default('en_attente')->index();
            $table->decimal('montant_total', 12, 2)->default(0);
            $table->decimal('montant_paye', 12, 2)->default(0);
            $table->string('mode_paiement', 40)->nullable();
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['boutique_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commande_clients');
    }
};
