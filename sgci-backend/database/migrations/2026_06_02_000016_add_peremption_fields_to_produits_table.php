<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('produits', function (Blueprint $table) {
            $table->date('date_peremption')->nullable()->index();
            $table->date('date_fabrication')->nullable();
            $table->string('lot_numero', 100)->nullable();
            $table->integer('duree_conservation_jours')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('produits', function (Blueprint $table) {
            $table->dropColumn(['date_peremption', 'date_fabrication', 'lot_numero', 'duree_conservation_jours']);
        });
    }
};
