<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->string('numero_paiement')->unique();
            $table->foreignId('commande_client_id')->nullable()->constrained('commande_clients')->nullOnDelete();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->decimal('montant', 12, 2);
            $table->string('mode_paiement', 40);
            $table->string('reference_transaction')->nullable()->index();
            $table->timestamp('date_paiement')->nullable();
            $table->string('statut', 20)->default('en_attente')->index();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['boutique_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('paiements');
    }
};
