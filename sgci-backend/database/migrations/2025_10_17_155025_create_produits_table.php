<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('produits', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->text('description')->nullable();
            $table->decimal('prix', 10, 2); // 10 chiffres, 2 décimales
            $table->integer('quantite_stock')->default(0);
            $table->integer('seuil_alerte')->default(5);
            $table->foreignId('categorie_id')->constrained()->onDelete('cascade');
            $table->boolean('est_perissable')->default(false);
            $table->string('code_qr')->unique()->nullable();
            $table->string('unite_mesure')->default('unite'); // kg, litre, unité
            $table->timestamps();
            $table->softDeletes(); // Pour archiver au lieu de supprimer
        });
    }

    public function down()
    {
        Schema::dropIfExists('produits');
    }
};
