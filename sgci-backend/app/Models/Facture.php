<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Facture extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'numero_facture',
        'vente_id',
        'commande_client_id',
        'client_id',
        'boutique_id',
        'date_facture',
        'date_echeance',
        'montant_ht',
        'montant_tva',
        'montant_ttc',
        'statut',
        'envoyee',
        'chemin_pdf',
        'notes',
    ];

    protected $casts = [
        'date_facture' => 'date',
        'date_echeance' => 'date',
        'montant_ht' => 'decimal:2',
        'montant_tva' => 'decimal:2',
        'montant_ttc' => 'decimal:2',
        'envoyee' => 'boolean',
    ];

    /**
     * Relation avec la vente
     */
    public function vente()
    {
        return $this->belongsTo(Vente::class);
    }

    /**
     * Relation avec la commande client
     */
    public function commandeClient()
    {
        return $this->belongsTo(CommandeClient::class);
    }

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
     * Scope pour les factures payées
     */
    public function scopePayee($query)
    {
        return $query->where('statut', 'paye');
    }

    /**
     * Scope pour les factures en attente
     */
    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    /**
     * Scope pour les factures envoyées
     */
    public function scopeEnvoyee($query)
    {
        return $query->where('envoyee', true);
    }

    /**
     * Scope pour les factures non envoyées
     */
    public function scopeNonEnvoyee($query)
    {
        return $query->where('envoyee', false);
    }

    /**
     * Vérifier si la facture est payée
     */
    public function estPayee(): bool
    {
        return $this->statut === 'paye';
    }

    /**
     * Obtenir l'URL du PDF
     */
    public function getUrlPdfAttribute(): string
    {
        return Storage::disk('public')->url($this->chemin_pdf);
    }
}
