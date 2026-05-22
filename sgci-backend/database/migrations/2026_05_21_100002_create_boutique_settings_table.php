<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boutique_settings', function (Blueprint $table) {
            $table->id();
            $table->string('nom')->default('SGCI Bénin');
            $table->string('adresse')->nullable();
            $table->string('telephone', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('devise', 10)->default('FCFA');
            $table->decimal('taux_tva', 5, 2)->default(18.00);
            $table->unsignedInteger('delai_annulation_vente_minutes')->default(5);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boutique_settings');
    }
};
