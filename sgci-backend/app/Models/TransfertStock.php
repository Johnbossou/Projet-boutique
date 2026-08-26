<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class TransfertStock extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero_transfert',
        'boutique_source_id',
        'boutique_destination_id',
        'produit_id',
        'quantite',
        'statut',
        'date_transfert',
        'date_reception',
        'motif',
        'notes',
        'user_source_id',
        'user_destination_id',
    ];

    protected $casts = [
        'date_transfert' => 'date',
        'date_reception' => 'date',
        'quantite' => 'integer',
    ];

    /**
     * Relation avec la boutique source
     */
    public function boutiqueSource()
    {
        return $this->belongsTo(Boutique::class, 'boutique_source_id');
    }

    /**
     * Relation avec la boutique destination
     */
    public function boutiqueDestination()
    {
        return $this->belongsTo(Boutique::class, 'boutique_destination_id');
    }

    /**
     * Relation avec le produit
     */
    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }

    /**
     * Relation avec l'utilisateur source
     */
    public function userSource()
    {
        return $this->belongsTo(User::class, 'user_source_id');
    }

    /**
     * Relation avec l'utilisateur destination
     */
    public function userDestination()
    {
        return $this->belongsTo(User::class, 'user_destination_id');
    }

    /**
     * Générer automatiquement le numéro de transfert
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($transfert) {
            if (empty($transfert->numero_transfert)) {
                $transfert->numero_transfert = 'TS-' . date('Ymd-His');
            }
        });
    }

    /**
     * Scope pour les transferts en attente
     */
    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    /**
     * Scope pour les transferts en cours
     */
    public function scopeEnCours($query)
    {
        return $query->where('statut', 'en_cours');
    }

    /**
     * Scope pour les transferts terminés
     */
    public function scopeTermine($query)
    {
        return $query->where('statut', 'termine');
    }

    /**
     * Scope pour les transferts annulés
     */
    public function scopeAnnule($query)
    {
        return $query->where('statut', 'annule');
    }

    /**
     * Vérifier si le transfert est terminé
     */
    public function estTermine(): bool
    {
        return $this->statut === 'termine';
    }

    /**
     * Vérifier si le transfert peut être annulé
     */
    public function peutEtreAnnule(): bool
    {
        return in_array($this->statut, ['en_attente', 'en_cours']);
    }
}
