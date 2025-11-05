<?php

// Fichier: database/migrations/2025_01_15_000000_create_ai_metrics_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('ai_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('type_entrainement', 50); // 'modele_demande', 'modele_promotions'
            $table->timestamp('date_debut');
            $table->timestamp('date_fin')->nullable();
            $table->enum('statut', ['en_cours', 'termine', 'erreur'])->default('en_cours');
            $table->decimal('precision', 5, 4)->nullable(); // 0.0000 à 0.9999
            $table->decimal('loss', 8, 6)->nullable(); // Pour suivre la loss du modèle
            $table->json('metrics')->nullable(); // Métriques supplémentaires
            $table->text('erreur')->nullable(); // Message d'erreur si échec
            $table->timestamps();

            // Index pour les requêtes fréquentes
            $table->index(['statut', 'date_debut']);
            $table->index('type_entrainement');
        });
    }

    public function down()
    {
        Schema::dropIfExists('ai_metrics');
    }
};
