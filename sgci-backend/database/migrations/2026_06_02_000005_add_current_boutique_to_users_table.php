<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('current_boutique_id')->nullable()->after('two_factor_confirmed_at')->constrained('boutiques')->onDelete('set null');
            $table->index('current_boutique_id');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['current_boutique_id']);
            $table->dropIndex(['current_boutique_id']);
            $table->dropColumn('current_boutique_id');
        });
    }
};
