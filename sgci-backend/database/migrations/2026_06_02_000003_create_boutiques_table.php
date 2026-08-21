<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('boutiques', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('adresse')->nullable();
            $table->string('telephone')->nullable();
            $table->string('email')->nullable();
            $table->string('devise', 10)->default('XOF');
            $table->decimal('taux_tva', 5, 2)->default(18.00);
            $table->integer('delai_annulation_vente_minutes')->default(5);
            $table->foreignId('proprietaire_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();
            
            $table->index('proprietaire_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('boutiques');
    }
};
