<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Installation fraîche : les migrations s'exécutent avant les seeders,
        // il n'y a donc aucun utilisateur ni donnée à migrer.
        if (! Schema::hasTable('users') || DB::table('users')->count() === 0) {
            return;
        }

        // Propriétaire de la boutique par défaut : le premier utilisateur
        // 'proprietaire', sinon le premier utilisateur existant (jamais un ID hardcodé).
        $owner = DB::table('users')->where('role', 'proprietaire')->orderBy('id')->first()
            ?? DB::table('users')->orderBy('id')->first();
        $defaultBoutiqueId = DB::table('boutiques')->insertGetId([
            'nom' => 'Boutique par défaut',
            'adresse' => 'Adresse par défaut',
            'telephone' => '+229 00 00 00 00',
            'email' => 'default@sgci.bj',
            'devise' => 'XOF',
            'taux_tva' => 18.00,
            'delai_annulation_vente_minutes' => 5,
            'proprietaire_id' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Assigner la boutique par défaut à tous les utilisateurs existants
        DB::table('users')->whereNull('current_boutique_id')->update([
            'current_boutique_id' => $defaultBoutiqueId,
        ]);

        // Assigner les utilisateurs existants à la boutique par défaut via la table pivot
        $users = DB::table('users')->get();
        foreach ($users as $user) {
            // Déterminer le rôle dans la boutique
            $roleDansBoutique = 'caissier';
            if ($user->role === 'gerant') {
                $roleDansBoutique = 'gerant';
            } elseif ($user->role === 'proprietaire') {
                $roleDansBoutique = 'gerant'; // Le propriétaire est aussi gérant de sa boutique par défaut
            }

            DB::table('boutique_user')->insert([
                'boutique_id' => $defaultBoutiqueId,
                'user_id' => $user->id,
                'role_dans_boutique' => $roleDansBoutique,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Assigner la boutique par défaut à tous les produits existants
        DB::table('produits')->whereNull('boutique_id')->update([
            'boutique_id' => $defaultBoutiqueId,
        ]);

        // Assigner la boutique par défaut à toutes les ventes existantes
        DB::table('ventes')->whereNull('boutique_id')->update([
            'boutique_id' => $defaultBoutiqueId,
        ]);

        // Assigner la boutique par défaut à tous les clients existants
        DB::table('clients')->whereNull('boutique_id')->update([
            'boutique_id' => $defaultBoutiqueId,
        ]);

        // Assigner la boutique par défaut à toutes les catégories existantes
        DB::table('categories')->whereNull('boutique_id')->update([
            'boutique_id' => $defaultBoutiqueId,
        ]);

        // Assigner la boutique par défaut à tous les mouvements de stock existants
        DB::table('mouvements_stock')->whereNull('boutique_id')->update([
            'boutique_id' => $defaultBoutiqueId,
        ]);

        // Assigner la boutique par défaut à tous les logs d'audit existants
        DB::table('audit_logs')->whereNull('boutique_id')->update([
            'boutique_id' => $defaultBoutiqueId,
        ]);
    }

    public function down()
    {
        // Supprimer la boutique par défaut
        DB::table('boutiques')->where('nom', 'Boutique par défaut')->delete();

        // Réinitialiser les boutique_id à null
        DB::table('users')->update(['current_boutique_id' => null]);
        DB::table('produits')->update(['boutique_id' => null]);
        DB::table('ventes')->update(['boutique_id' => null]);
        DB::table('clients')->update(['boutique_id' => null]);
        DB::table('categories')->update(['boutique_id' => null]);
        DB::table('mouvements_stock')->update(['boutique_id' => null]);
        DB::table('audit_logs')->update(['boutique_id' => null]);

        // Supprimer les entrées boutique_user
        DB::table('boutique_user')->truncate();
    }
};
