<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientFidelite extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_fidelite_id',
        'client_id',
        'points',
        'niveau_actuel',
        'date_inscription',
    ];

    protected $casts = [
        'date_inscription' => 'date',
        'points' => 'integer',
    ];

    /**
     * Relation avec le programme de fidélité
     */
    public function programmeFidelite()
    {
        return $this->belongsTo(ProgrammeFidelite::class);
    }

    /**
     * Relation avec le client
     */
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * Relation avec les transactions de points
     */
    public function transactions()
    {
        return $this->hasMany(TransactionPoints::class);
    }

    /**
     * Ajouter des points
     */
    public function ajouterPoints(int $points, string $raison, ?Vente $vente = null): void
    {
        $this->increment('points', $points);

        // Créer une transaction
        TransactionPoints::create([
            'client_fidelite_id' => $this->id,
            'type' => 'gain',
            'points' => $points,
            'raison' => $raison,
            'vente_id' => $vente ? $vente->id : null,
        ]);

        // Mettre à jour le niveau si nécessaire
        $this->mettreAJourNiveau();
    }

    /**
     * Retirer des points
     */
    public function retirerPoints(int $points, string $raison): void
    {
        if ($this->points < $points) {
            throw new \Exception('Points insuffisants');
        }

        $this->decrement('points', $points);

        // Créer une transaction
        TransactionPoints::create([
            'client_fidelite_id' => $this->id,
            'type' => 'retrait',
            'points' => $points,
            'raison' => $raison,
        ]);
    }

    /**
     * Mettre à jour le niveau du client
     */
    public function mettreAJourNiveau(): void
    {
        $niveau = $this->programmeFidelite->calculerNiveau($this->points);
        
        if ($niveau['nom'] !== $this->niveau_actuel) {
            $this->update(['niveau_actuel' => $niveau['nom']]);
        }
    }

    /**
     * Obtenir la remise applicable
     */
    public function getRemiseApplicable(): float
    {
        $niveau = $this->programmeFidelite->calculerNiveau($this->points);
        return $niveau['remise_pourcentage'] ?? 0;
    }
}
