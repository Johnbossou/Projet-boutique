<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\MouvementStock;

class Produit extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nom', 'description', 'prix', 'quantite_stock', 'seuil_alerte',
        'categorie_id', 'est_perissable', 'code_qr', 'unite_mesure'
    ];

    protected $casts = [
        'est_perissable' => 'boolean',
        'prix' => 'decimal:2',
    ];

    // Relations
    public function categorie()
    {
        return $this->belongsTo(Categorie::class);
    }

    public function ligneVentes()
    {
        return $this->hasMany(LigneVente::class);
    }

    public function mouvementsStock()
    {
        return $this->hasMany(MouvementStock::class);
    }

    // Méthodes métier importantes
    public function estEnRupture()
    {
        return $this->quantite_stock <= 0;
    }

    public function estEnAlerte()
    {
        return $this->quantite_stock <= $this->seuil_alerte;
    }

    public function getStatutStockAttribute()
    {
        if ($this->estEnRupture()) return 'rupture';
        if ($this->estEnAlerte()) return 'alerte';
        return 'normal';
    }

    public function diminuerStock($quantite)
    {
        if ($this->quantite_stock >= $quantite) {
            $this->decrement('quantite_stock', $quantite);
            return true;
        }
        return false;
    }

    public function augmenterStock($quantite)
    {
        $this->increment('quantite_stock', $quantite);
    }

    // Scope pour les requêtes courantes
    public function scopeEnAlerte($query)
    {
        return $query->whereColumn('quantite_stock', '<=', 'seuil_alerte');
    }

    public function scopeEnRupture($query)
    {
        return $query->where('quantite_stock', '<=', 0);
    }

    public function scopePerissables($query)
    {
        return $query->where('est_perissable', true);
    }
}
