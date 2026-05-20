<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class MouvementStock extends Model
{
    use HasFactory;

    protected $table = 'mouvements_stock';
    public $timestamps = true;

    protected $fillable = [
        'produit_id',
        'type', // 'entrée' ou 'sortie'
        'quantite',
        'raison', // 'arrivage', 'vente', 'ajustement', 'retour', 'casse'
        'reference_bon', // Numéro de bon de commande/arrivage
        'user_id',
        'statut', // 'en_attente', 'accepté', 'rejeté'
        'notes',
        'quantite_avant',
        'quantite_apres'
    ];

    protected $casts = [
        'quantite' => 'integer',
        'quantite_avant' => 'integer',
        'quantite_apres' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // ==================== RELATIONS ====================
    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // ==================== SCOPES ====================
    public function scopeEntrees($query)
    {
        return $query->where('type', 'entrée');
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
        return $query->where('statut', 'accepté');
    }

    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    public function scopeRejetes($query)
    {
        return $query->where('statut', 'rejeté');
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
            'entrée' => 'Entrée',
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
            'accepté' => 'Accepté',
            'rejeté' => 'Rejeté',
        ];
        return $statuts[$this->statut] ?? $this->statut;
    }
}
