<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Categorie extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['nom', 'description', 'couleur', 'icone'];

    // Relations
    public function produits()
    {
        return $this->hasMany(Produit::class);
    }

    // Méthodes statistiques
    public function getNombreProduitsAttribute()
    {
        return $this->produits()->count();
    }

    public function getStockTotalAttribute()
    {
        return $this->produits()->sum('quantite_stock');
    }
}
