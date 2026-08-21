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
        'nom',
        'description',
        'prix',
        'quantite_stock',
        'seuil_alerte',
        'categorie_id',
        'est_perissable',
        'code_qr',
        'unite_mesure',
        'image_url',
        'boutique_id',
        'date_peremption',
        'date_fabrication',
        'lot_numero',
        'duree_conservation_jours',
    ];

    protected $casts = [
        'est_perissable' => 'boolean',
        'prix' => 'decimal:2',
        'date_peremption' => 'date',
        'date_fabrication' => 'date',
    ];

    // Relations
    public function categorie()
    {
        return $this->belongsTo(Categorie::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
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

    public function scopePerimes($query)
    {
        return $query->where('est_perissable', true)
            ->where('date_peremption', '<', now());
    }

    public function scopeProchesPeremption($query, $jours = 7)
    {
        return $query->where('est_perissable', true)
            ->where('date_peremption', '>', now())
            ->where('date_peremption', '<=', now()->addDays($jours));
    }

    public function estPerime(): bool
    {
        return $this->est_perissable && $this->date_peremption && $this->date_peremption < now();
    }

    public function estProchePeremption(int $jours = 7): bool
    {
        return $this->est_perissable 
            && $this->date_peremption 
            && $this->date_peremption > now() 
            && $this->date_peremption <= now()->addDays($jours);
    }

    public function getJoursRestantsAttribute(): ?int
    {
        if (!$this->est_perissable || !$this->date_peremption) {
            return null;
        }
        
        return now()->diffInDays($this->date_peremption, false);
    }
}
