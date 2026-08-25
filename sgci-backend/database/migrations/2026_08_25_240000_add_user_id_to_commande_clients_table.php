<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commande_clients', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete()->after('boutique_id');
        });
    }

    public function down(): void
    {
        Schema::table('commande_clients', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};
