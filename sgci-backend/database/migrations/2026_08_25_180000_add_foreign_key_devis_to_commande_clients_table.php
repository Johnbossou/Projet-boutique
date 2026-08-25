<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commande_clients', function (Blueprint $table) {
            $table->foreign('devis_id')->references('id')->on('devis')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commande_clients', function (Blueprint $table) {
            $table->dropForeign(['devis_id']);
        });
    }
};
