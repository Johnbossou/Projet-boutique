<?php

namespace App\Models;

use App\Services\Sequenceur;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommandeClient extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'numero_commande',
        'client_id',
        'boutique_id',
        'devis_id',
        'date_commande',
        'date_livraison_prevue',
        'date_livraison_reelle',
        'statut',
        'montant_total',
        'tva',
        'montant_paye',
        'mode_paiement',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'date_commande' => 'date',
        'date_livraison_prevue' => 'date',
        'date_livraison_reelle' => 'date',
        'montant_total' => 'decimal:2',
        'tva' => 'decimal:2',
        'montant_paye' => 'decimal:2',
    ];

    /**
     * montant_a_payer et montant_restant sont des dérivés TTC : le front et
     * les PDF ne doivent jamais recalculer HT + TVA eux-mêmes (c'est ainsi
     * que la caisse et les factures ont affiché des montants faux).
     */
    protected $appends = ['montant_a_payer', 'montant_restant'];

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
     * Relation avec le devis
     */
    public function devis()
    {
        return $this->belongsTo(Devis::class);
    }

    /**
     * Relation avec l'utilisateur
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
        return $this->hasMany(LigneCommandeClient::class);
    }

    /**
     * Relation avec les paiements
     */
    public function paiements()
    {
        return $this->hasMany(Paiement::class);
    }

    /**
     * Générer automatiquement le numéro de commande
     *
     * Le numéro vient du Sequenceur (compteur en base sous verrou), pas
     * d'un timestamp : 'CMD-'.date('Ymd-His') resolvait à la seconde et
     * deux commandes créées dans la même seconde violaient l'index
     * UNIQUE, remontant une erreur SQLSTATE 23000 à l'utilisateur.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($commande) {
            if (empty($commande->numero_commande)) {
                $commande->numero_commande = Sequenceur::prochain('CMD');
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
     * Ce que le client doit réellement payer : base HT + TVA encaissée.
     *
     * Invariant commun aux ventes et aux commandes : *_total est la base HT,
     * la TVA s'ajoute par-dessus (caisse = HT + TVA, idem ici). Les
     * commandes antérieures à la colonne tva portent 0 — a_payer = total,
     * exactement ce qui a été encaissé.
     */
    public function getMontantAPayerAttribute(): float
    {
        return round((float) $this->montant_total + (float) $this->tva, 2);
    }

    /**
     * Calculer le montant restant à payer (TTC restant dû)
     */
    public function getMontantRestantAttribute(): float
    {
        return round($this->montant_a_payer - (float) $this->montant_paye, 2);
    }

    /**
     * Vérifier si la commande est entièrement payée
     *
     * Comparaison sur le TTC dû et non sur la base HT : avec la TVA, payer
     * la base seule ne solde pas la commande. L'épsilon absorbe les arrondis
     * binaires des décimales (0,01 + 1 799,99 qui ne fait pas exactement
     * 1 800,00 en virgule flottante).
     */
    public function estPayee(): bool
    {
        return (float) $this->montant_paye >= $this->montant_a_payer - 0.001;
    }

    public function facture()
    {
        return $this->hasOne(Facture::class);
    }
}
