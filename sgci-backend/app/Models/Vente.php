<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Vente extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero_vente', 'montant_total', 'tva', 'remise', 'user_id', 'client_id', 'statut', 'notes',
    ];

    protected $casts = [
        'montant_total' => 'decimal:2',
        'tva' => 'decimal:2',
        'remise' => 'decimal:2',
    ];

    // Génération automatique du numéro de vente
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($vente) {
            if (empty($vente->numero_vente)) {
                $currentYear = date('Y');
                $nextId = self::whereYear('created_at', $currentYear)->count() + 1;
                $vente->numero_vente = 'VENT-' . $currentYear . '-' . str_pad($nextId, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    // Relations
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function ligneVentes()
    {
        return $this->hasMany(LigneVente::class);
    }

    public function produits()
    {
        return $this->hasManyThrough(Produit::class, LigneVente::class, 'vente_id', 'id', 'id', 'produit_id');
    }

    // Méthodes métier
    public function calculerTotal()
    {
        return $this->ligneVentes->sum('sous_total');
    }

    public function appliquerTVA($taux = 0.18)
    {
        $this->tva = $this->montant_total * $taux;
        $this->save();
        return $this;
    }

    public function terminer()
    {
        DB::transaction(function () {
            $this->statut = 'termine';
            $this->save();

            // Diminuer les stocks
            foreach ($this->ligneVentes as $ligne) {
                $produit = $ligne->produit;
                if ($produit) {
                    $produit->diminuerStock($ligne->quantite);
                }
            }
        });
    }

    public function annuler()
    {
        DB::transaction(function () {
            $this->statut = 'annule';
            $this->save();

            // Restaurer les stocks
            foreach ($this->ligneVentes as $ligne) {
                $produit = $ligne->produit;
                if ($produit) {
                    $produit->augmenterStock($ligne->quantite);
                }
            }
        });
    }

    // Scope pour les requêtes courantes
    public function scopeTerminees($query)
    {
        return $query->where('statut', 'termine');
    }

    public function scopeEnCours($query)
    {
        return $query->where('statut', 'en_cours');
    }

    public function scopeAnnulees($query)
    {
        return $query->where('statut', 'annule');
    }

    public function scopeDuJour($query)
    {
        return $query->whereDate('created_at', today());
    }
    // Ajoute cette relation dans la classe Vente
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

}
