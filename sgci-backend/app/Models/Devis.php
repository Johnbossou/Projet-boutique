<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Devis extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'numero_devis',
        'client_id',
        'boutique_id',
        'date_devis',
        'date_validite',
        'montant_total',
        'statut',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'date_devis' => 'date',
        'date_validite' => 'date',
        'montant_total' => 'decimal:2',
    ];

    /**
     * Relation avec le client
     */
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * Relation avec la boutique
     */
    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Relation avec l'utilisateur
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relation avec les lignes de devis
     */
    public function lignes()
    {
        return $this->hasMany(LigneDevis::class);
    }

    /**
     * Relation avec la commande client si converti
     */
    public function commandeClient()
    {
        return $this->hasOne(CommandeClient::class);
    }

    /**
     * Générer automatiquement le numéro de devis
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($devis) {
            if (empty($devis->numero_devis)) {
                $devis->numero_devis = 'DEV-' . date('Ymd-His');
            }
        });
    }

    /**
     * Scope pour les devis en attente
     */
    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    /**
     * Scope pour les devis acceptés
     */
    public function scopeAccepte($query)
    {
        return $query->where('statut', 'accepte');
    }

    /**
     * Scope pour les devis refusés
     */
    public function scopeRefuse($query)
    {
        return $query->where('statut', 'refuse');
    }

    /**
     * Scope pour les devis expirés
     */
    public function scopeExpire($query)
    {
        return $query->where('statut', 'en_attente')
            ->where('date_validite', '<', now());
    }

    /**
     * Vérifier si le devis est expiré
     */
    public function estExpire(): bool
    {
        return $this->statut === 'en_attente' && $this->date_validite < now();
    }

    /**
     * Vérifier si le devis peut être converti en commande
     */
    public function peutEtreConverti(): bool
    {
        return $this->statut === 'accepte' && !$this->commandeClient;
    }
}
