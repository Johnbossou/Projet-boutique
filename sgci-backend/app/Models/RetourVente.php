<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class RetourVente extends Model
{
    use HasFactory;

    protected $table = 'retours_vente';

    protected $fillable = [
        'vente_id',
        'boutique_id',
        'user_id',
        'type',
        'motif',
        'motif_detail',
        'montant_rembourse',
        'statut',
        'notes',
    ];

    protected $casts = [
        'montant_rembourse' => 'decimal:2',
    ];

    public function vente()
    {
        return $this->belongsTo(Vente::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function lignes()
    {
        return $this->hasMany(RetourVenteLigne::class);
    }

    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    public function scopeValides($query)
    {
        return $query->where('statut', 'valide');
    }

    /**
     * Quantité déjà rendue ET validée, par ligne de vente.
     *
     * Définition UNIQUE du cumul, partagée par la création d'un retour, sa
     * validation et l'annulation d'une vente. Trois copies du même calcul
     * seraient trois occasions de diverger — et c'est exactement le genre de
     * divergence qui crédite du stock deux fois.
     *
     * Volontairement limitée au statut « valide » : un retour en attente ne
     * consomme pas de quota. La conséquence est que plusieurs retours en
     * attente peuvent chacun réclamer la totalité d'une même ligne — d'où la
     * revalidation obligatoire au moment de valider(), là où le stock est
     * réellement crédité.
     *
     * @return array<int, int> indexé par ligne_vente_id
     */
    public static function quantiteValideeParLigne(int $venteId): array
    {
        return RetourVenteLigne::query()
            ->join(
                'retours_vente',
                'retours_vente.id',
                '=',
                'retour_vente_lignes.retour_vente_id'
            )
            ->where('retours_vente.statut', 'valide')
            ->where('retours_vente.vente_id', $venteId)
            ->groupBy('retour_vente_lignes.ligne_vente_id')
            ->select('retour_vente_lignes.ligne_vente_id')
            ->selectRaw('SUM(retour_vente_lignes.quantite_retournee) as total')
            ->pluck('total', 'ligne_vente_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    /**
     * Retours non tranchés sur cette vente.
     *
     * @return Collection<int, self>
     */
    public static function enAttentePour(int $venteId)
    {
        return static::query()
            ->where('vente_id', $venteId)
            ->where('statut', 'en_attente')
            ->orderBy('id')
            ->get();
    }
}
