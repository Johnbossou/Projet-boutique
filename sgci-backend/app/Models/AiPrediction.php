<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiPrediction extends Model
{
    use HasFactory;

    protected $fillable = [
        'produit_id',
        'date_prediction',
        'demande_predite',
        'demande_reelle',
        'erreur_absolue',
        'erreur_pourcentage',
        'type_prediction',
        'metadonnees',
        'date_validation',
    ];

    protected $casts = [
        'date_prediction' => 'date',
        'demande_predite' => 'integer',
        'demande_reelle' => 'integer',
        'erreur_absolue' => 'decimal:2',
        'erreur_pourcentage' => 'decimal:2',
        'metadonnees' => 'array',
        'date_validation' => 'datetime',
    ];

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class);
    }

    public function scopeValidees($query)
    {
        return $query->whereNotNull('date_validation');
    }

    public function scopeEnAttente($query)
    {
        return $query->whereNull('date_validation');
    }

    public function scopeParType($query, string $type)
    {
        return $query->where('type_prediction', $type);
    }

    public function scopeParPeriode($query, $debut, $fin)
    {
        return $query->whereBetween('date_prediction', [$debut, $fin]);
    }

    public function calculerErreur(int $demandeReelle): void
    {
        $this->demande_reelle = $demandeReelle;
        
        if ($demandeReelle > 0) {
            $this->erreur_absolue = abs($this->demande_predite - $demandeReelle);
            $this->erreur_pourcentage = ($this->erreur_absolue / $demandeReelle) * 100;
        } else {
            $this->erreur_absolue = $this->demande_predite;
            $this->erreur_pourcentage = $this->demande_predite > 0 ? 100 : 0;
        }
        
        $this->date_validation = now();
        $this->save();
    }

    public function estPrecise(float $tolerancePourcentage = 20): bool
    {
        if ($this->erreur_pourcentage === null) {
            return false;
        }
        
        return $this->erreur_pourcentage <= $tolerancePourcentage;
    }
}
