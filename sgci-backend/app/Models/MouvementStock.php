<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MouvementStock extends Model
{
    use HasFactory;

    protected $table = 'mouvements_stock';

    public $timestamps = true;

    protected $fillable = [
        'produit_id',
        'type', // 'entree' ou 'sortie'
        'quantite',
        'raison', // 'arrivage', 'vente', 'ajustement', 'retour', 'casse'
        'reference_bon', // Numéro de bon de commande/arrivage
        'user_id',
        'statut', // 'en_attente', 'accepte', 'rejete' (ENUM)
        'notes',
        'quantite_avant',
        'quantite_apres',
        'boutique_id',
        // Workflow d'arrivage complet
        'valide_par',
        'valide_le',
        'motif_rejet',
        'quantite_recue',
        'date_fabrication',
        'date_peremption',
        'commande_fournisseur_id',
        'ligne_commande_fournisseur_id',
        'idempotency_key',
    ];

    protected $casts = [
        'quantite' => 'integer',
        'quantite_avant' => 'integer',
        'quantite_apres' => 'integer',
        'quantite_recue' => 'integer',
        'date_fabrication' => 'date',
        'date_peremption' => 'date',
        'valide_le' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Champs calculés exposés à l'API (mobile + web) pour éviter que chaque
     * client réimplémente la logique de réception partielle.
     */
    protected $appends = ['libelle_statut', 'est_partiel', 'quantite_effective', 'quantite_restante'];

    // ==================== RELATIONS ====================

    /**
     * withTrashed() est indispensable : un produit archive restereferenc par son
     * journal de stock. Sans lui, tout mouvement portant sur un produit archive
     * s'affiche avec produit = null, et l'ecart d'inventaire devient
     * inexpliquable.
     */
    public function produit()
    {
        return $this->belongsTo(Produit::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Gérant qui a validé ou rejeté le mouvement.
     */
    public function validePar()
    {
        return $this->belongsTo(User::class, 'valide_par');
    }

    public function commandeFournisseur()
    {
        return $this->belongsTo(CommandeFournisseur::class);
    }

    public function ligneCommandeFournisseur()
    {
        return $this->belongsTo(LigneCommandeFournisseur::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Quantité réellement entrée en stock (identique à la quantité annoncée
     * si la réception a été complète).
     */
    public function getQuantiteEffectiveAttribute(): int
    {
        return $this->quantite_recue ?? $this->quantite;
    }

    /**
     * Une réception partielle laisse un reliquat à réceptionner.
     * Dérivé de quantite_recue < quantite : pas besoin d'un statut ENUM
     * supplémentaire, qui aurait été rejeté par MySQL/TiDB.
     */
    public function estPartiel(): bool
    {
        return $this->quantite_recue !== null && $this->quantite_recue < $this->quantite;
    }

    public function getEstPartielAttribute(): bool
    {
        return $this->estPartiel();
    }

    public function getQuantiteRestanteAttribute(): int
    {
        return max(0, $this->quantite - $this->quantite_effective);
    }

    // ==================== SCOPES ====================
    public function scopeEntrees($query)
    {
        return $query->where('type', 'entree');
    }

    public function scopeSorties($query)
    {
        return $query->where('type', 'sortie');
    }

    public function scopeArrivages($query)
    {
        return $query->where('raison', 'arrivage');
    }

    public function scopeVentes($query)
    {
        return $query->where('raison', 'vente');
    }

    public function scopeAcceptes($query)
    {
        return $query->where('statut', 'accepte');
    }

    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    public function scopeRejetes($query)
    {
        return $query->where('statut', 'rejete');
    }

    public function scopeParPeriode($query, $dateDebut, $dateFin)
    {
        return $query->whereBetween('created_at', [$dateDebut, $dateFin]);
    }

    public function scopeParRaison($query, $raison)
    {
        return $query->where('raison', $raison);
    }

    public function scopeParProduit($query, $produitId)
    {
        return $query->where('produit_id', $produitId);
    }

    // ==================== MUTATEURS ====================
    public function getLibelleTypeAttribute()
    {
        $types = [
            'entree' => 'Entrée',
            'sortie' => 'Sortie',
        ];

        return $types[$this->type] ?? $this->type;
    }

    public function getLibelleRaisonAttribute()
    {
        $raisons = [
            'arrivage' => 'Arrivage',
            'vente' => 'Vente',
            'ajustement' => 'Ajustement',
            'retour' => 'Retour',
            'casse' => 'Casse',
        ];

        return $raisons[$this->raison] ?? $this->raison;
    }

    public function getLibelleStatutAttribute()
    {
        $statuts = [
            'en_attente' => 'En attente',
            'accepte' => 'Accepté',
            'rejete' => 'Rejeté',
        ];

        if ($this->statut === 'accepte' && $this->estPartiel()) {
            return 'Partiellement reçu';
        }

        return $statuts[$this->statut] ?? $this->statut;
    }
}
