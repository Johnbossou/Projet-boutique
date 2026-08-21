<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Vente extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'numero_vente',
        'montant_total',
        'tva',
        'remise',
        'user_id',
        'client_id',
        'statut',
        'notes',
        'mode_paiement',
        'montant_recu',
        'monnaie_rendue',
        'numero_transaction',
        'reference_carte',
        'banque',
        'boutique_id',
        'idempotency_key',
    ];

    protected $casts = [
        'montant_total' => 'decimal:2',
        'tva' => 'decimal:2',
        'remise' => 'decimal:2',
        'montant_recu' => 'decimal:2',
        'monnaie_rendue' => 'decimal:2',
    ];

    // GÃ©nÃ©ration automatique du numÃ©ro de vente
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($vente) {
            if (empty($vente->numero_vente)) {
                $vente->numero_vente = static::genererNumeroVente();
            }
        });
    }

    /**
     * GÃ©nÃ¨re un numÃ©ro unique basÃ© sur le max existant (et non count()+1,
     * qui produit des collisions quand des ventes sont supprimÃ©es ou crÃ©Ã©es
     * avec une created_at rÃ©trodatÃ©e).
     */
    public static function genererNumeroVente(): string
    {
        $currentYear = date('Y');
        $prefixe = "VENT-{$currentYear}-";

        // withTrashed : les numÃ©ros des ventes supprimÃ©es logiquement restent
        // rÃ©servÃ©s (la contrainte UNIQUE les voit toujours).
        $dernier = static::withTrashed()
            ->where('numero_vente', 'like', $prefixe.'%')
            ->orderBy('numero_vente', 'desc')
            ->value('numero_vente');

        $nextId = $dernier ? ((int) substr($dernier, strlen($prefixe))) + 1 : 1;

        return $prefixe . str_pad((string) $nextId, 4, '0', STR_PAD_LEFT);
    }

    // Relations
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    public function ligneVentes()
    {
        return $this->hasMany(LigneVente::class);
    }

    public function produits()
    {
        return $this->hasManyThrough(Produit::class, LigneVente::class, 'vente_id', 'id', 'id', 'produit_id');
    }

    // MÃ©thodes mÃ©tier
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

    // Scope pour les requÃªtes courantes
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
