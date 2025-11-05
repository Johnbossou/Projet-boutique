<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('ventes', function (Blueprint $table) {
            $table->id();
            $table->string('numero_vente')->unique(); // VENT-2025-001
            $table->decimal('montant_total', 10, 2);
            $table->decimal('tva', 10, 2)->default(0); // TVA béninoise 18%
            $table->decimal('remise', 10, 2)->default(0);
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // Le caissier
            $table->enum('statut', ['en_cours', 'termine', 'annule'])->default('en_cours');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ventes');
    }
};
