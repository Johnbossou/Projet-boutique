<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LigneVente extends Model
{
    use HasFactory;

    protected $fillable = [
        'vente_id',
        'produit_id',
        'quantite',
        'prix_unitaire',
        'sous_total'
    ];

    protected $casts = [
        'prix_unitaire' => 'decimal:2',
        'sous_total' => 'decimal:2',
        'quantite' => 'integer'
    ];

    // Calcul automatique du sous-total
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($ligne) {
            if ($ligne->prix_unitaire && $ligne->quantite) {
                $ligne->sous_total = $ligne->prix_unitaire * $ligne->quantite;
            }
        });

        static::created(function ($ligne) {
            // Mettre à jour le montant total de la vente
            $vente = $ligne->vente;
            if ($vente) {
                $vente->montant_total = $vente->ligneVentes()->sum('sous_total') - $vente->remise;
                $vente->save();
            }
        });

        static::updated(function ($ligne) {
            // Mettre à jour le montant total de la vente
            $vente = $ligne->vente;
            if ($vente) {
                $vente->montant_total = $vente->ligneVentes()->sum('sous_total') - $vente->remise;
                $vente->save();
            }
        });

        static::deleted(function ($ligne) {
            // Mettre à jour le montant total de la vente
            $vente = $ligne->vente;
            if ($vente) {
                $vente->montant_total = $vente->ligneVentes()->sum('sous_total') - $vente->remise;
                $vente->save();
            }
        });
    }

    // Relations
    public function vente()
    {
        return $this->belongsTo(Vente::class);
    }

    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }

    // Accesseurs
    public function getNomProduitAttribute()
    {
        return $this->produit ? $this->produit->nom : 'Produit supprimé';
    }

    // Méthodes utilitaires
    public function mettreAJourPrixUnitaire($nouveauPrix)
    {
        $this->prix_unitaire = $nouveauPrix;
        $this->save();
        return $this;
    }

    public function modifierQuantite($nouvelleQuantite)
    {
        $this->quantite = $nouvelleQuantite;
        $this->save();
        return $this;
    }
}
