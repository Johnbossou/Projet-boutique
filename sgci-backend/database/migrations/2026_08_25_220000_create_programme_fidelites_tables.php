<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programme_fidelites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->string('nom');
            $table->text('description')->nullable();
            $table->integer('points_par_achat')->default(1);
            $table->decimal('valeur_point', 5, 2)->default(1.00);
            $table->json('niveaux')->nullable();
            $table->boolean('actif')->default(true);
            $table->timestamps();
        });

        Schema::create('client_fidelites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_fidelite_id')->constrained('programme_fidelites')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->integer('points')->default(0);
            $table->string('niveau_actuel')->default('bronze');
            $table->date('date_inscription');
            $table->timestamps();

            $table->unique(['programme_fidelite_id', 'client_id']);
        });

        Schema::create('recompense_fidelites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_fidelite_id')->constrained('programme_fidelites')->cascadeOnDelete();
            $table->string('nom');
            $table->text('description')->nullable();
            $table->integer('points_requis');
            $table->string('type', 30)->default('remise');
            $table->decimal('valeur', 10, 2)->default(0);
            $table->boolean('actif')->default(true);
            $table->timestamps();
        });

        Schema::create('reclamation_recompenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recompense_fidelite_id')->constrained('recompense_fidelites')->cascadeOnDelete();
            $table->foreignId('client_fidelite_id')->constrained('client_fidelites')->cascadeOnDelete();
            $table->date('date_reclamation');
            $table->string('statut', 30)->default('active');
            $table->boolean('utilise')->default(false);
            $table->timestamps();
        });

        Schema::create('transaction_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_fidelite_id')->constrained('client_fidelites')->cascadeOnDelete();
            $table->string('type', 30)->default('gain');
            $table->integer('points');
            $table->text('raison')->nullable();
            $table->foreignId('vente_id')->nullable()->constrained('ventes')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_points');
        Schema::dropIfExists('reclamation_recompenses');
        Schema::dropIfExists('recompense_fidelites');
        Schema::dropIfExists('client_fidelites');
        Schema::dropIfExists('programme_fidelites');
    }
};
