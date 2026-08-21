<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RecompenseFidelite extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_fidelite_id',
        'nom',
        'description',
        'points_requis',
        'type',
        'valeur',
        'actif',
    ];

    protected $casts = [
        'points_requis' => 'integer',
        'valeur' => 'decimal:2',
        'actif' => 'boolean',
    ];

    /**
     * Relation avec le programme de fidélité
     */
    public function programmeFidelite()
    {
        return $this->belongsTo(ProgrammeFidelite::class);
    }

    /**
     * Relation avec les réclamations de récompenses
     */
    public function reclamations()
    {
        return $this->hasMany(ReclamationRecompense::class);
    }

    /**
     * Scope pour les récompenses actives
     */
    public function scopeActives($query)
    {
        return $query->where('actif', true);
    }

    /**
     * Vérifier si un client peut réclamer cette récompense
     */
    public function peutEtreReclamee(ClientFidelite $clientFidelite): bool
    {
        return $clientFidelite->points >= $this->points_requis;
    }
}
