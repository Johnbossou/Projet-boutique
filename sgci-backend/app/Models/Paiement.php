<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Paiement extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero_paiement',
        'commande_client_id',
        'boutique_id',
        'montant',
        'mode_paiement',
        'reference_transaction',
        'date_paiement',
        'statut',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'montant' => 'decimal:2',
        'date_paiement' => 'date',
    ];

    /**
     * Relation avec la commande client
     */
    public function commandeClient()
    {
        return $this->belongsTo(CommandeClient::class);
    }

    /**
     * Relation avec la boutique
     */
    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Relation avec l'utilisateur
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Générer automatiquement un numéro de paiement unique.
     * Basé sur le max existant (et non count) pour rester robuste
     * même après suppressions : PAY-20260821-0001, -0002, ...
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($paiement) {
            if (empty($paiement->numero_paiement)) {
                $prefix = 'PAY-' . now()->format('Ymd');

                $query = self::where('numero_paiement', 'like', $prefix . '-%');

                if ($paiement->boutique_id) {
                    $query->where('boutique_id', $paiement->boutique_id);
                }

                $last = $query->max('numero_paiement');

                $suffix = $last ? ((int) substr($last, strlen($prefix) + 1)) + 1 : 1;
                $paiement->numero_paiement = $prefix . '-' . str_pad((string) $suffix, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    /**
     * Scope pour les paiements réussis
     */
    public function scopeReussi($query)
    {
        return $query->where('statut', 'reussi');
    }

    /**
     * Scope pour les paiements échoués
     */
    public function scopeEchoue($query)
    {
        return $query->where('statut', 'echoue');
    }

    /**
     * Scope pour les paiements en attente
     */
    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }
}
