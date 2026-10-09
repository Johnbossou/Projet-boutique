<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Complète le workflow d'arrivage :
     *  - traçabilité de qui a validé/rejeté (valide_par, valide_le, motif_rejet)
     *  - réception partielle (quantite_recue < quantite)
     *  - rattachement à une commande fournisseur (numéro de bon fiable)
     *  - capture des dates de fabrication/péremption du lot reçu
     *  - idempotence pour éviter les doublons en cas de double envoi
     */
    public function up(): void
    {
        Schema::table('mouvements_stock', function (Blueprint $table) {
            // Traçabilité de la validation
            $table->foreignId('valide_par')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('valide_le')->nullable();
            $table->string('motif_rejet', 255)->nullable();

            // Réception partielle : quantite = quantité annoncée,
            // quantite_recue = quantité effectivement entrée en stock.
            $table->unsignedInteger('quantite_recue')->nullable();

            // Lot / péremption saisis à la réception
            $table->date('date_fabrication')->nullable();
            $table->date('date_peremption')->nullable();

            // Rattachement à la commande fournisseur (numéro de bon fiable)
            $table->foreignId('commande_fournisseur_id')->nullable()->constrained('commande_fournisseurs')->nullOnDelete();
            $table->foreignId('ligne_commande_fournisseur_id')->nullable()->constrained('ligne_commande_fournisseurs')->nullOnDelete();

            // Idempotence : évite les doublons si le client réessaie
            $table->string('idempotency_key', 100)->nullable();

            $table->index(['boutique_id', 'statut'], 'mouvements_boutique_statut_index');
            $table->index('commande_fournisseur_id');
            $table->unique(['boutique_id', 'idempotency_key'], 'mouvements_boutique_idempotency_unique');
        });
    }

    public function down(): void
    {
        // Les moteurs ne gèrent pas de la même façon le retrait des index :
        // SQLite crée les clés étrangères et les contraintes UNIQUE comme
        // contraintes de table (non nommées comme index) et crée un index de
        // support nommé {table}_{colonne}_index pour chaque clé étrangère.
        // MySQL/TiDB nomment leurs index d'après la contrainte. On tente donc
        // chaque retrait et on ignore ceux qui n'existent pas sur le moteur
        // courant : la suppression des colonnes qui suit suffit sur MySQL.
        $index = [
            'mouvements_boutique_idempotency_unique',
            'mouvements_boutique_statut_index',
            'mouvements_stock_commande_fournisseur_id_index',
            'mouvements_stock_ligne_commande_fournisseur_id_index',
            'mouvements_stock_valide_par_index',
        ];

        foreach ($index as $nom) {
            try {
                Schema::table('mouvements_stock', function (Blueprint $table) use ($nom) {
                    $table->dropIndex($nom);
                });
            } catch (Throwable) {
                // Index absent sur ce moteur : rien à retirer.
            }
        }

        Schema::table('mouvements_stock', function (Blueprint $table) {
            $table->dropConstrainedForeignId('commande_fournisseur_id');
            $table->dropConstrainedForeignId('ligne_commande_fournisseur_id');
            $table->dropConstrainedForeignId('valide_par');

            $table->dropColumn([
                'valide_le',
                'motif_rejet',
                'quantite_recue',
                'date_fabrication',
                'date_peremption',
                'idempotency_key',
            ]);
        });
    }
};
