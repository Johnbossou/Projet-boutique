<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fournisseurs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->string('nom');
            $table->string('email')->nullable();
            $table->string('telephone')->nullable();
            $table->text('adresse')->nullable();
            $table->string('ville')->nullable();
            $table->string('pays')->default('Bénin');
            $table->string('code_postal')->nullable();
            $table->string('contact_principal')->nullable();
            $table->string('email_contact')->nullable();
            $table->string('telephone_contact')->nullable();
            $table->string('conditions_paiement')->nullable();
            $table->integer('delai_livraison')->nullable()->comment('En jours');
            $table->text('notes')->nullable();
            $table->boolean('actif')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['boutique_id', 'actif']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fournisseurs');
    }
};
