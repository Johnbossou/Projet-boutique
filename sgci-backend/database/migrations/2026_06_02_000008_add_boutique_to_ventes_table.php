<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->foreignId('boutique_id')->nullable()->after('id')->constrained('boutiques')->onDelete('cascade');
            $table->index('boutique_id');
        });
    }

    public function down()
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropForeign(['boutique_id']);
            $table->dropIndex(['boutique_id']);
            $table->dropColumn('boutique_id');
        });
    }
};
