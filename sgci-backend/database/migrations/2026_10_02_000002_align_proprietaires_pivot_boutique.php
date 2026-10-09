<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (! Schema::hasTable('boutique_user') || ! Schema::hasTable('boutiques')) {
            return;
        }

        $corriges = $this->alignerProprietaires('proprietaire');

        if ($corriges > 0) {
            // journalise le nombre de lignes réalignées : la migration est
            // idempotente, donc un second passage doit renvoyer 0.
            logger()->info('Pivot boutique_user : propriétaires réalignés', [
                'lignes' => $corriges,
            ]);
        }
    }

    public function down()
    {
        if (! Schema::hasTable('boutique_user') || ! Schema::hasTable('boutiques')) {
            return;
        }

        // Retour à l'état produit par la migration 2026_06_02_000013, qui
        // inscrivait le propriétaire en « gerant ».
        $this->alignerProprietaires('gerant');
    }

    /**
     * Bascule le rôle pivot des seuls utilisateurs qui sont réellement
     * propriétaire de la boutique concernée.
     *
     * On ne s'appuie PAS sur users.role : un propriétaire peut être gérant
     * d'AUTRES boutiques, et ces lignes-là ne doivent pas être touchées. La
     * condition porte donc sur boutiques.proprietaire_id, ce qui rend
     * l'opération idempotente et sans effet de bord.
     */
    private function alignerProprietaires(string $role): int
    {
        $actuel = $role === 'proprietaire' ? 'gerant' : 'proprietaire';

        return DB::table('boutique_user')
            ->where('role_dans_boutique', $actuel)
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('boutiques')
                    ->whereColumn('boutiques.id', 'boutique_user.boutique_id')
                    ->whereColumn('boutiques.proprietaire_id', 'boutique_user.user_id');
            })
            ->update([
                'role_dans_boutique' => $role,
                'updated_at' => now(),
            ]);
    }
};
