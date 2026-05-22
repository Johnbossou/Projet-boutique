<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->enum('mode_paiement', ['especes', 'mtn', 'moov', 'carte'])->nullable()->after('notes');
            $table->decimal('montant_recu', 12, 2)->nullable()->after('mode_paiement');
            $table->decimal('monnaie_rendue', 12, 2)->nullable()->after('montant_recu');
            $table->string('numero_transaction', 100)->nullable()->after('monnaie_rendue');
            $table->string('reference_carte', 100)->nullable()->after('numero_transaction');
            $table->string('banque', 100)->nullable()->after('reference_carte');
        });
    }

    public function down(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropColumn([
                'mode_paiement',
                'montant_recu',
                'monnaie_rendue',
                'numero_transaction',
                'reference_carte',
                'banque',
            ]);
        });
    }
};
