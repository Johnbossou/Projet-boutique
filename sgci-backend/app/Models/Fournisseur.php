<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Fournisseur extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nom',
        'email',
        'telephone',
        'adresse',
        'ville',
        'pays',
        'code_postal',
        'contact_principal',
        'email_contact',
        'telephone_contact',
        'conditions_paiement',
        'delai_livraison',
        'notes',
        'actif',
        'boutique_id',
    ];

    protected $casts = [
        'actif' => 'boolean',
    ];

    /**
     * Relation avec la boutique
     */
    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Relation avec les commandes fournisseurs
     */
    public function commandesFournisseurs()
    {
        return $this->hasMany(CommandeFournisseur::class);
    }

    /**
     * Scope pour les fournisseurs actifs
     */
    public function scopeActifs($query)
    {
        return $query->where('actif', true);
    }

    /**
     * Scope pour les fournisseurs inactifs
     */
    public function scopeInactifs($query)
    {
        return $query->where('actif', false);
    }

    /**
     * Vérifier si le fournisseur est actif
     */
    public function estActif(): bool
    {
        return $this->actif;
    }
}
