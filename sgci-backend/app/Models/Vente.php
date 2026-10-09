<?php

namespace App\Models;

use App\Exceptions\OperationRefusee;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Vente extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Formulation unique du refus « déjà annulée ».
     *
     * Elle vit ici parce que deux appelants doivent produire exactement le même
     * refus : annuler(), qui relit le statut sous verrou, et le contrôleur,
     * qui court-circuite une vente déjà annulée avant d'atteindre le modèle
     * (une vente « en cours » n'a jamais décrémenté le stock, donc la
     * restitution n'a pas à être rejouée).
     */
    public const MSG_DEJA_ANNULEE = 'Cette vente est déjà annulée.';

    /**
     * Refus d'une seconde annulation, à appeler avant tout traitement.
     *
     * Le contrôleur peut l'appeler sur une instance chargée avant le verrou.
     * C'est sûr : un statut ne revient jamais en arrière, donc une instance
     * rapportant « annule » ne peut pas cacher une vente redevenue annulable
     * entre-temps. L'inverse — lire « termine » alors que la base dit déjà
     * « annule » — reste possible, et c'est annuler() qui le rattrape sous
     * verrou. Les deux retards sont donc couverts, dans les deux sens.
     */
    public static function refuserSiDejaAnnulee(?string $statut): void
    {
        if ($statut === 'annule') {
            throw new OperationRefusee(self::MSG_DEJA_ANNULEE, 409);
        }
    }

    protected $fillable = [
        'numero_vente',
        'montant_total',
        'tva',
        'remise',
        'user_id',
        'client_id',
        'statut',
        'notes',
        'mode_paiement',
        'montant_recu',
        'monnaie_rendue',
        'numero_transaction',
        'reference_carte',
        'banque',
        'boutique_id',
        'idempotency_key',
    ];

    protected $casts = [
        'montant_total' => 'decimal:2',
        'tva' => 'decimal:2',
        'remise' => 'decimal:2',
        'montant_recu' => 'decimal:2',
        'monnaie_rendue' => 'decimal:2',
    ];

    // Génération automatique du numéro de vente
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($vente) {
            if (empty($vente->numero_vente)) {
                $vente->numero_vente = static::genererNumeroVente();
            }
        });
    }

    /**
     * Génère un numéro unique basé sur le max existant (et non count()+1,
     * qui produit des collisions quand des ventes sont supprimées ou créées
     * avec une created_at rétrodatée).
     */
    public static function genererNumeroVente(): string
    {
        $currentYear = date('Y');
        $prefixe = "VENT-{$currentYear}-";

        // withTrashed : les numéros des ventes supprimées logiquement restent
        // réservés (la contrainte UNIQUE les voit toujours).
        $dernier = static::withTrashed()
            ->where('numero_vente', 'like', $prefixe.'%')
            ->orderBy('numero_vente', 'desc')
            ->value('numero_vente');

        $nextId = $dernier ? ((int) substr($dernier, strlen($prefixe))) + 1 : 1;

        return $prefixe.str_pad((string) $nextId, 4, '0', STR_PAD_LEFT);
    }

    // Relations
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    public function ligneVentes()
    {
        return $this->hasMany(LigneVente::class);
    }

    public function produits()
    {
        return $this->hasManyThrough(Produit::class, LigneVente::class, 'vente_id', 'id', 'id', 'produit_id');
    }

    // Méthodes métier
    public function calculerTotal()
    {
        return $this->ligneVentes->sum('sous_total');
    }

    public function appliquerTVA($taux = 0.18)
    {
        $this->tva = $this->montant_total * $taux;
        $this->save();

        return $this;
    }

    public function terminer()
    {
        DB::transaction(function () {
            $this->statut = 'termine';
            $this->save();

            // Diminuer les stocks
            foreach ($this->ligneVentes as $ligne) {
                $produit = $ligne->produit;
                if ($produit) {
                    $produit->diminuerStock($ligne->quantite);
                }
            }
        });
    }

    public function annuler()
    {
        return DB::transaction(function () {
            // Verrou sur la vente + relecture du statut SOUS VERROU.
            //
            // Le contrôle « déjà annulée » vivait dans le contrôleur, avant
            // cette transaction. Deux annulations simultanées le lisaient
            // toutes deux à « termine », entraient toutes les deux ici, et
            // chacune créditait le stock : la marchandise revenait deux fois.
            // Le verrou sur produit ne protégeait de rien, puisque chaque
            // transaction relit quantite_stock et applique son propre
            // crement. Un double-clic suffisait.
            $verrouillee = Vente::whereKey($this->id)
                ->where('boutique_id', $this->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouillee) {
                throw new OperationRefusee('Vente introuvable.', 404);
            }

            if ($verrouillee->statut === 'annule') {
                throw new OperationRefusee(self::MSG_DEJA_ANNULEE, 409);
            }

            // Un retour non tranché sur cette vente la rend non annulable.
            //
            // Sans ce refus, l'ordre naturel « on annule la vente, puis on
            // valide le retour » créditait deux fois les mêmes unités :
            // l'annulation restitue le stock, la validation du retour le
            // crédite encore. Le stock devenait supérieur aux quantités
            // réellement vendues, et l'écart disparaissait avec le retour
            // marqué « valide ».
            //
            // Contrôle À L'INTÉRIEUR de la transaction : dehors, c'était une
            // lecture d'état antérieure au verrou, donc une fenêtre de course.
            //
            // On refuse explicitement plutôt que de refuser les retours en
            // silence : le gérant tranche, et sa décision reste visible.
            $enAttente = RetourVente::enAttentePour($verrouillee->id);

            if ($enAttente->isNotEmpty()) {
                throw new OperationRefusee(
                    'Vente non annulable : '.$enAttente->count().' retour(s) en attente ('
                        .$enAttente->pluck('id')->implode(', ')
                        .'). Validez ou refusez-les avant d\'annuler la vente.',
                    409
                );
            }

            $verrouillee->statut = 'annule';
            $verrouillee->save();

            // Un mouvement compensateur est écrit :
            // sans lui, le journal des mouvements ne contient que la sortie
            // d'origine et l'inventaire ne se réconcilie plus avec
            // produits.quantite_stock (écarts d'inventaire invisibles).
            //
            // On ne restitue que ce qui est ENCORE sorti du stock. Une ligne
            // dont une partie a déjà été restituée par un retour validé a déjà
            // été créditée : la restituer en entier créditait ce retour une
            // seconde fois.
            $dejaRendu = RetourVente::quantiteValideeParLigne($verrouillee->id);

            foreach ($verrouillee->ligneVentes as $ligne) {
                $aRestituer = max(0, (int) $ligne->quantite - (int) ($dejaRendu[$ligne->id] ?? 0));

                if ($aRestituer === 0) {
                    continue;
                }

                $produit = Produit::where('id', $ligne->produit_id)
                    ->where('boutique_id', $verrouillee->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $produit) {
                    continue;
                }

                $quantiteAvant = (int) $produit->quantite_stock;
                $produit->augmenterStock($aRestituer);
                $quantiteApres = (int) $produit->fresh()->quantite_stock;

                MouvementStock::create([
                    'produit_id' => $produit->id,
                    'quantite' => $aRestituer,
                    'raison' => 'annulation_vente',
                    'type' => 'entree',
                    'reference_bon' => (string) $verrouillee->id,
                    'notes' => 'Restitution de stock pour vente annulée #'.$verrouillee->id,
                    'user_id' => $verrouillee->user_id,
                    'statut' => 'accepte',
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                    'boutique_id' => $verrouillee->boutique_id,
                ]);
            }

            return $verrouillee;
        });
    }

    // Scope pour les requêtes courantes
    public function scopeTerminees($query)
    {
        return $query->where('statut', 'termine');
    }

    public function scopeEnCours($query)
    {
        return $query->where('statut', 'en_cours');
    }

    public function scopeAnnulees($query)
    {
        return $query->where('statut', 'annule');
    }

    public function scopeDuJour($query)
    {
        return $query->whereDate('created_at', today());
    }

    // Ajoute cette relation dans la classe Vente
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function facture()
    {
        return $this->hasOne(Facture::class);
    }
}
