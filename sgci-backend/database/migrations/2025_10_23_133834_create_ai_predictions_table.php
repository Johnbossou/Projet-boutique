<?php

// Fichier: database/migrations/2025_01_15_000001_create_ai_predictions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('ai_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('produit_id')->constrained()->onDelete('cascade');
            $table->timestamp('date_prediction');
            $table->decimal('valeur_predite', 10, 2); // La prédiction faite
            $table->decimal('valeur_reelle', 10, 2)->nullable(); // La valeur réelle observée ensuite
            $table->integer('stock_initial'); // Stock au moment de la prédiction
            $table->decimal('confiance', 5, 4)->nullable(); // Niveau de confiance 0-1
            $table->timestamps();

            // Index pour l'analyse des performances
            $table->index(['produit_id', 'date_prediction']);
            $table->index('date_prediction');
        });
    }

    public function down()
    {
        Schema::dropIfExists('ai_predictions');
    }
};
