<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('factures', function (Blueprint $table) {
            $table->id();
            $table->string('numero_facture')->unique();
            $table->foreignId('vente_id')->nullable()->constrained('ventes')->nullOnDelete();
            $table->foreignId('commande_client_id')->nullable()->constrained('commande_clients')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->date('date_facture');
            $table->date('date_echeance')->nullable();
            $table->decimal('montant_ht', 12, 2)->default(0);
            $table->decimal('montant_tva', 12, 2)->default(0);
            $table->decimal('montant_ttc', 12, 2)->default(0);
            $table->string('statut', 30)->default('en_attente');
            $table->boolean('envoyee')->default(false);
            $table->string('chemin_pdf')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['boutique_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factures');
    }
};
