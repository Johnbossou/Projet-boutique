<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('notification_preferences')->nullable()->after('est_actif');
        });

        // Activer toutes les notifications par défaut pour les utilisateurs existants
        DB::table('users')->whereNull('notification_preferences')->update([
            'notification_preferences' => json_encode([
                'alerte_stock' => true,
                'alerte_peremption' => true,
                'nouvelle_vente' => true,
                'validation_arrivage' => true,
                'nouveau_message' => true,
                'rapport_quotidien' => true,
                'push_mobile' => true,
            ]),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('notification_preferences');
        });
    }
};
