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
        Schema::table('users', function (Blueprint $table) {
            // string (et non enum) pour rester portable MySQL/SQLite ;
            // les valeurs valides sont contrôlées au niveau applicatif
            $table->string('role', 20)->default('caissier');
            $table->string('telephone')->nullable();
            $table->boolean('est_actif')->default(true);
            $table->timestamp('derniere_connexion')->nullable();
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'telephone', 'est_actif', 'derniere_connexion']);
        });
    }
};
