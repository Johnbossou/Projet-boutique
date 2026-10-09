<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            // Clé d'idempotence fournie par le client. L'index UNIQUE est
            // composite (boutique + clé) parce que la clé est propre au client :
            // deux boutiques, ou deux caisses, ne doivent pas se bloquer.
            // Plusieurs lignes NULL restent permises (MySQL et SQLite
            // traitent chaque NULL comme distinct), donc un appel sans clé
            // n'est pas concerné.
            $table->string('idempotency_key', 64)->nullable()->after('numero_paiement');

            // Le numéro débité n'était stocké nulle part : impossible de savoir
            // après coup quel numéro a été harcelé sur quel paiement. Sur une
            // opération d'argent, c'est une lacune d'audit, pas un détail.
            $table->string('telephone', 20)->nullable()->after('mode_paiement');

            $table->unique(['boutique_id', 'idempotency_key'], 'paiements_boutique_idempotency_unique');
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropUnique('paiements_boutique_idempotency_unique');
            $table->dropColumn(['idempotency_key', 'telephone']);
        });
    }
};
