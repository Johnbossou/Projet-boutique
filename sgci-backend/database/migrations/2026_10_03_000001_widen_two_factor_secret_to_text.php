<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La 2FA est INOPÉRANTE sur MySQL tant que cette migration n'est pas appliquée.
 *
 * Laravel chiffre le secret avant de le stocker : le texte produit n'est pas
 * le secret de 32 caractères mais un envelope (iv + value + mac + tag) encodé
 * en base64, soit 256 caractères pour une clé applicative standard.
 *
 * La colonne était varchar(255). MySQL/MariaDB, en mode strict (le défaut),
 * tronque ou refuse : l'enregistrement du secret partait en
 * "Data too long for column 'two_factor_secret'" et l'activation de la 2FA
 * échouait pour TOUT le monde. SQLite, lui, ignore les longueurs déclarées :
 * la suite complète passait au vert en local et cassait en production.
 *
 * text et non varchar(512) : la taille exacte dépend de la clé applicative et
 * du cipher, elle n'est pas un invariant du schéma. text supprime la classe
 * entière de bugs au lieu de repousser le plafond.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'two_factor_secret')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'two_factor_secret')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('two_factor_secret')->nullable()->change();
        });
    }
};
