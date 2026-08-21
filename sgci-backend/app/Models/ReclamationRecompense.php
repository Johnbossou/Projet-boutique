<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReclamationRecompense extends Model
{
    use HasFactory;

    protected $fillable = [
        'recompense_fidelite_id',
        'client_fidelite_id',
        'date_reclamation',
        'statut',
        'utilise',
    ];

    protected $casts = [
        'date_reclamation' => 'date',
        'utilise' => 'boolean',
    ];

    /**
     * Relation avec la récompense
     */
    public function recompense()
    {
        return $this->belongsTo(RecompenseFidelite::class, 'recompense_fidelite_id');
    }

    /**
     * Relation avec le client fidélité
     */
    public function clientFidelite()
    {
        return $this->belongsTo(ClientFidelite::class);
    }

    /**
     * Scope pour les réclamations en attente
     */
    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    /**
     * Scope pour les réclamations validées
     */
    public function scopeValide($query)
    {
        return $query->where('statut', 'valide');
    }

    /**
     * Scope pour les réclamations utilisées
     */
    public function scopeUtilise($query)
    {
        return $query->where('utilise', true);
    }
}
