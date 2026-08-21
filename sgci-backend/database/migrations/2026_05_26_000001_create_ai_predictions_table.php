<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('produit_id')->constrained()->onDelete('cascade');
            $table->date('date_prediction');
            $table->integer('demande_predite');
            $table->integer('demande_reelle')->nullable();
            $table->decimal('erreur_absolue', 10, 2)->nullable();
            $table->decimal('erreur_pourcentage', 5, 2)->nullable();
            $table->string('type_prediction'); // 'demande_hebdo', 'demande_mensuelle', 'reapprovisionnement'
            $table->json('metadonnees')->nullable(); // Stocke les paramètres utilisés
            $table->timestamp('date_validation')->nullable(); // Quand la prédiction a été validée
            $table->timestamps();

            $table->index(['produit_id', 'date_prediction']);
            $table->index('date_prediction');
            $table->index('type_prediction');
            $table->index('date_validation');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_predictions');
    }
};
