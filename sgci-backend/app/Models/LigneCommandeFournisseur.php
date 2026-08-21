<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LigneCommandeFournisseur extends Model
{
    use HasFactory;

    protected $fillable = [
        'commande_fournisseur_id',
        'produit_id',
        'quantite_commandee',
        'quantite_recue',
        'prix_unitaire',
        'montant_total',
        'statut',
    ];

    protected $casts = [
        'quantite_commandee' => 'integer',
        'quantite_recue' => 'integer',
        'prix_unitaire' => 'decimal:2',
        'montant_total' => 'decimal:2',
    ];

    /**
     * Relation avec la commande fournisseur
     */
    public function commandeFournisseur()
    {
        return $this->belongsTo(CommandeFournisseur::class);
    }

    /**
     * Relation avec le produit
     */
    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }

    /**
     * Calculer le montant total
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($ligne) {
            if (empty($ligne->montant_total)) {
                $ligne->montant_total = $ligne->quantite_commandee * $ligne->prix_unitaire;
            }
        });

        static::updating(function ($ligne) {
            $ligne->montant_total = $ligne->quantite_commandee * $ligne->prix_unitaire;
        });
    }

    /**
     * Vérifier si la ligne est entièrement reçue
     */
    public function estEntierementRecue(): bool
    {
        return $this->quantite_recue >= $this->quantite_commandee;
    }

    /**
     * Calculer la quantité restante à recevoir
     */
    public function getQuantiteRestanteAttribute(): int
    {
        return max(0, $this->quantite_commandee - $this->quantite_recue);
    }
}
