<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('boutique_id')->nullable()->after('model_id')->constrained('boutiques')->onDelete('set null');
            $table->index('boutique_id');
        });
    }

    public function down()
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropForeign(['boutique_id']);
            $table->dropIndex(['boutique_id']);
            $table->dropColumn('boutique_id');
        });
    }
};
