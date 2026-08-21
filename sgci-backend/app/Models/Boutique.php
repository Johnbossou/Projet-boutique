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
}
