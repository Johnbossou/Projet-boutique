<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recompense_fidelites', function (Blueprint $table) {
            // Seuil de la récompense exprimé en points du mode « points fixes
            // par achat », figé au moment du passage au prorata du panier.
            //
            // C'est la référence du recalage : le seuil courant est exprimé en
            // points de prorata, or le prorata distribue les points
            // différemment. Sans cette référence, un recalage appliqué deux
            // fois cumulerait le facteur (seuil × k, puis × k encore) et les
            // récompenses deviendraient inatteignables.
            $table->unsignedInteger('points_requis_legacy')->nullable()->after('points_requis');
        });
    }

    public function down(): void
    {
        Schema::table('recompense_fidelites', function (Blueprint $table) {
            $table->dropColumn('points_requis_legacy');
        });
    }
};
