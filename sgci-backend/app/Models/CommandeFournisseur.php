<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommandeFournisseur extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'numero_commande',
        'fournisseur_id',
        'boutique_id',
        'date_commande',
        'date_livraison_prevue',
        'date_livraison_reelle',
        'statut',
        'montant_total',
        'montant_paye',
        'conditions_paiement',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'date_commande' => 'date',
        'date_livraison_prevue' => 'date',
        'date_livraison_reelle' => 'date',
        'montant_total' => 'decimal:2',
        'montant_paye' => 'decimal:2',
    ];

    /**
     * Relation avec le fournisseur
     */
    public function fournisseur()
    {
        return $this->belongsTo(Fournisseur::class);
    }

    /**
     * Relation avec la boutique
     */
    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Relation avec l'utilisateur qui a créé la commande
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relation avec les lignes de commande
     */
    public function lignes()
    {
        return $this->hasMany(LigneCommandeFournisseur::class);
    }

    /**
     * Générer automatiquement le numéro de commande
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($commande) {
            if (empty($commande->numero_commande)) {
                $commande->numero_commande = 'CF-' . date('Ymd-His');
            }
        });
    }

    /**
     * Scope pour les commandes en attente
     */
    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    /**
     * Scope pour les commandes en cours
     */
    public function scopeEnCours($query)
    {
        return $query->where('statut', 'en_cours');
    }

    /**
     * Scope pour les commandes livrées
     */
    public function scopeLivre($query)
    {
        return $query->where('statut', 'livre');
    }

    /**
     * Scope pour les commandes annulées
     */
    public function scopeAnnule($query)
    {
        return $query->where('statut', 'annule');
    }

    /**
     * Calculer le montant restant à payer
     */
    public function getMontantRestantAttribute(): float
    {
        return $this->montant_total - $this->montant_paye;
    }

    /**
     * Vérifier si la commande est entièrement payée
     */
    public function estPayee(): bool
    {
        return $this->montant_paye >= $this->montant_total;
    }
}
