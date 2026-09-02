<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Boutique extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nom',
        'adresse',
        'telephone',
        'email',
        'devise',
        'taux_tva',
        'delai_annulation_vente_minutes',
        'proprietaire_id',
    ];

    protected $casts = [
        'taux_tva' => 'decimal:2',
    ];

    // Relations
    public function proprietaire()
    {
        return $this->belongsTo(User::class, 'proprietaire_id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'boutique_user')->withPivot('role_dans_boutique')->withTimestamps();
    }

    public function produits()
    {
        return $this->hasMany(Produit::class);
    }

    public function ventes()
    {
        return $this->hasMany(Vente::class);
    }

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function categories()
    {
        return $this->hasMany(Categorie::class);
    }

    public function mouvementsStock()
    {
        return $this->hasMany(MouvementStock::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    // Scopes
    public function scopeForProprietaire($query, $proprietaireId)
    {
        return $query->where('proprietaire_id', $proprietaireId);
    }

    public function scopeActive($query)
    {
        return $query->where('created_at', '<=', now());
    }

    // Méthodes métier
    public function estProprietaire(User $user)
    {
        return $this->proprietaire_id === $user->id;
    }

    public function aAcces(User $user)
    {
        if ($user->role === 'proprietaire') {
            return $this->proprietaire_id === $user->id;
        }
        
        return $this->users()->where('user_id', $user->id)->exists();
    }

    /**
     * Le gérant actif de cette boutique (via le pivot role_dans_boutique).
     */
    public function gerantActuel()
    {
        return $this->users()
            ->wherePivot('role_dans_boutique', 'gerant')
            ->where('users.est_actif', true)
            ->first();
    }

    /**
     * Applique la règle métier « un seul gérant par boutique ».
     *
     * @param int    $nouveauGerantId  id du user qui doit devenir gérant (0 si pas encore créé)
     * @param string $role              gerant ou caissier (rôle visé)
     * @param bool   $confirmer         true = l'utilisateur a les mains libres pour rétrograder
     *
     * @return array{ok:bool, code:string, message?:string, gerant_actuel?:array}
     */
    public function gererPromotionGerant(int $nouveauGerantId, string $role, bool $confirmer = false): array
    {
        // Le rôle visé n'est pas gérant : aucun contrôle nécessaire.
        if ($role !== 'gerant') {
            return ['ok' => true, 'code' => 'pas_gerant'];
        }

        $gerantActuel = $this->gerantActuel();

        // Aucun gérant existant : OK.
        if (!$gerantActuel) {
            return ['ok' => true, 'code' => 'ok'];
        }

        // Le user ciblé (déjà créé) est lui-même le gérant actuel : rien à faire.
        if ($nouveauGerantId > 0 && $gerantActuel->id === $nouveauGerantId) {
            return ['ok' => true, 'code' => 'ok'];
        }

        // Un autre gérant existe : il faut la confirmation côté client.
        if (!$confirmer) {
            return [
                'ok' => false,
                'code' => 'gerant_existant',
                'gerant_actuel' => [
                    'id' => $gerantActuel->id,
                    'name' => $gerantActuel->name,
                    'email' => $gerantActuel->email,
                ],
                'message' => 'Cette boutique a déjà un gérant : ' . $gerantActuel->name,
            ];
        }

        // Confirmé : rétrograder l'ancien gérant en caissier (pivot + rôle global, s'il est encore gérant ailleurs on garde).
        $this->users()->updateExistingPivot($gerantActuel->id, ['role_dans_boutique' => 'caissier']);

        $estGerantAilleurs = $gerantActuel->boutiques()
            ->wherePivot('role_dans_boutique', 'gerant')
            ->where('boutique_user.boutique_id', '!=', $this->id)
            ->exists();

        if (!$estGerantAilleurs) {
            $gerantActuel->role = 'caissier';
            $gerantActuel->save();
        }

        return ['ok' => true, 'code' => 'remplace'];
    }

    /**
     * Rattache (ou met à jour) un user au pivot de cette boutique avec un rôle donné,
     * et synchronise le rôle global du user.
     */
    public function rattacherUser(int $userId, string $role)
    {
        $existe = $this->users()->where('user_id', $userId)->exists();
        if ($existe) {
            $this->users()->updateExistingPivot($userId, ['role_dans_boutique' => $role]);
        } else {
            $this->users()->attach($userId, ['role_dans_boutique' => $role]);
        }

        $user = \App\Models\User::find($userId);
        if ($user && $user->role !== 'proprietaire') {
            if ($role === 'gerant') {
                $user->role = 'gerant';
            } elseif ($user->role === 'gerant') {
                // redevient caissier sauf s'il est encore gérant d'une autre boutique
                $encoreGerant = $user->boutiques()
                    ->wherePivot('role_dans_boutique', 'gerant')
                    ->where('boutique_user.boutique_id', '!=', $this->id)
                    ->exists();
                if (!$encoreGerant) {
                    $user->role = 'caissier';
                }
            }
            $user->save();
        }
    }
}
