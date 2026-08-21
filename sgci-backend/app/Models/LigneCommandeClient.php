<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LigneCommandeClient extends Model
{
    use HasFactory;

    protected $fillable = [
        'commande_client_id',
        'produit_id',
        'quantite',
        'prix_unitaire',
        'montant_total',
        'remise_pourcentage',
    ];

    protected $casts = [
        'quantite' => 'integer',
        'prix_unitaire' => 'decimal:2',
        'montant_total' => 'decimal:2',
        'remise_pourcentage' => 'decimal:2',
    ];

    /**
     * Relation avec la commande client
     */
    public function commandeClient()
    {
        return $this->belongsTo(CommandeClient::class);
    }

    /**
     * Relation avec le produit
     */
    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }

    /**
     * Calculer le montant total avec remise
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($ligne) {
            if (empty($ligne->montant_total)) {
                $montantBase = $ligne->quantite * $ligne->prix_unitaire;
                $remise = $montantBase * ($ligne->remise_pourcentage / 100);
                $ligne->montant_total = $montantBase - $remise;
            }
        });

        static::updating(function ($ligne) {
            $montantBase = $ligne->quantite * $ligne->prix_unitaire;
            $remise = $montantBase * ($ligne->remise_pourcentage / 100);
            $ligne->montant_total = $montantBase - $remise;
        });
    }
}
