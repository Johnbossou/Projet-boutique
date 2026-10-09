<?php

namespace App\Models;

use App\Services\Sequenceur;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Paiement extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero_paiement',
        'idempotency_key',
        'commande_client_id',
        'boutique_id',
        'montant',
        'mode_paiement',
        'telephone',
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
     * PAY-20260821-0001, -0002, ...
     *
     * Allocation par App\Services\Sequenceur : compteur en base sous verrou.
     * Le max() puis INSERT précédent n'était pas atomique — deux caisses
     * simultanées calculaient le même max, et l'index UNIQUE
     * (migration 2026_06_02_000015) rejetait l'un des deux en SQLSTATE
     * 23000. Le compteur reste GLOBAL, jamais par boutique.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($paiement) {
            if (empty($paiement->numero_paiement)) {
                $paiement->numero_paiement = Sequenceur::prochain('PAY');
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
