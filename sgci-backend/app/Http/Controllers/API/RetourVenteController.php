<?php

namespace App\Http\Controllers\API;

use App\Exceptions\OperationRefusee;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Http\Controllers\Controller;
use App\Models\LigneVente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\RetourVente;
use App\Models\RetourVenteLigne;
use App\Models\Vente;
use App\Traits\Auditable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RetourVenteController extends Controller
{
    use Auditable, VerifieBoutique;

    public function index(Request $request): JsonResponse
    {
        $query = RetourVente::with(['vente', 'user', 'lignes.produit']);

        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        if ($request->has('vente_id') && $request->vente_id) {
            $query->where('vente_id', $request->vente_id);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $retours = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($retours);
    }

    public function show(RetourVente $retour): JsonResponse
    {
        $this->verifierBoutiqueDe($retour);

        $retour->load(['vente.ligneVentes.produit', 'user', 'lignes.produit', 'lignes.ligneVente']);

        return response()->json($retour);
    }

    /**
     * Créer un retour sur une vente terminée.
     * Retour partiel : quantités spécifiques par ligne.
     * Retour total : toutes les lignes retournées en intégralité.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vente_id' => 'required|exists:ventes,id',
            'motif' => ['required', Rule::in(['defectueux', 'erreur_commande', 'insatisfait', 'autre'])],
            'motif_detail' => 'nullable|string|max:1000',
            'type' => ['required', Rule::in(['partiel', 'total'])],
            'notes' => 'nullable|string|max:1000',
            'lignes' => 'required_if:type,partiel|array|min:1',
            'lignes.*.ligne_vente_id' => 'required|exists:ligne_ventes,id',
            'lignes.*.quantite_retournee' => 'required|integer|min:1',
        ]);

        $vente = Vente::findOrFail($validated['vente_id']);
        $this->verifierBoutiqueDe($vente);

        if ($vente->statut !== 'termine') {
            return response()->json(['message' => 'Seules les ventes terminées peuvent faire l\'objet d\'un retour'], 422);
        }

        return DB::transaction(function () use ($validated, $vente, $request) {
            $type = $validated['type'];
            $montantTotalRembourse = 0;

            // BUG : la quantité déjà retournée sur des RETOURS VALIDÉS n'était
            // jamais déduite. Le seul garde-fou comparait la quantité demandée
            // à la quantité VENDUE : un produit vendu 10, retourné 10 (validé,
            // stock crédité), puis retourné 10 encore était accepté. Le stock
            // recevait 20 unités pour 10 ventes.
            // On fige la commande et les retours existants sous verrou pour
            // que deux créations concurrentes ne consomment pas le même quota.
            $venteVerrouillee = Vente::whereKey($vente->id)->lockForUpdate()->firstOrFail();

            $dejaRetourneParLigne = $this->quantiteDejaValideeParLigne($venteVerrouillee->id);

            $restantParLigne = [];

            $quantiteDisponible = function (int $ligneVenteId) use ($venteVerrouillee, $dejaRetourneParLigne, &$restantParLigne): int {
                if (! array_key_exists($ligneVenteId, $restantParLigne)) {
                    $ligne = LigneVente::whereKey($ligneVenteId)
                        ->where('vente_id', $venteVerrouillee->id)
                        ->first();

                    $restantParLigne[$ligneVenteId] = $ligne
                        ? max(0, (int) $ligne->quantite - (int) ($dejaRetourneParLigne[$ligneVenteId] ?? 0))
                        : 0;
                }

                return $restantParLigne[$ligneVenteId];
            };

            $retour = RetourVente::create([
                'vente_id' => $vente->id,
                'boutique_id' => $vente->boutique_id,
                'user_id' => $request->user()->id,
                'type' => $type,
                'motif' => $validated['motif'],
                'motif_detail' => $validated['motif_detail'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'statut' => 'en_attente',
                'montant_rembourse' => 0,
            ]);

            if ($type === 'total') {
                foreach ($venteVerrouillee->ligneVentes as $ligne) {
                    // Un retour total ne peut pas non plus dépasser le reliquat.
                    $disponible = $quantiteDisponible($ligne->id);

                    if ($disponible <= 0) {
                        // Levée et non « return » : un return depuis l'intérieur de
                        // DB::transaction() laisse la transaction se COMMITTER, donc
                        // le RetourVente créé plus haut restait en base alors que le
                        // client recevait 422. Une exception force le rollback.
                        throw new OperationRefusee("Retour total impossible : la ligne #{$ligne->id} a déjà été retournée en totalité");
                    }

                    // On rembourse le RELIQUAT, pas la quantité vendue : sinon le
                    // montant_rembourse incluait des unités déjà rendues.
                    $montantLigne = $disponible * $ligne->prix_unitaire;
                    $montantTotalRembourse += $montantLigne;

                    RetourVenteLigne::create([
                        'retour_vente_id' => $retour->id,
                        'ligne_vente_id' => $ligne->id,
                        'produit_id' => $ligne->produit_id,
                        'quantite_retournee' => $disponible,
                        'prix_unitaire' => $ligne->prix_unitaire,
                        'montant_retourne' => $montantLigne,
                    ]);
                }
            } else {
                foreach ($validated['lignes'] as $ligneData) {
                    $ligneVente = $venteVerrouillee->ligneVentes()->findOrFail($ligneData['ligne_vente_id']);

                    // Comparaison au RELIQUAT (vendu moins déjà retourné et
                    // validé), plus seulement à la quantité vendue.
                    $disponible = $quantiteDisponible($ligneVente->id);

                    if ($ligneData['quantite_retournee'] > $disponible) {
                        // Cf. commentaire plus haut : « return » committerait la
                        // transaction et laisserait un retour orphelin.
                        throw new OperationRefusee(
                            "Quantite retournee superieure au reliquat pour la ligne #{$ligneVente->id} (disponible : {$disponible})"
                        );
                    }

                    // Le reliquat est décrémenté en mémoire : deux entrées du
                    // même payload visant la même ligne ne doivent pas
                    // consommer deux fois le même quota.
                    $restantParLigne[$ligneVente->id] = $disponible - (int) $ligneData['quantite_retournee'];

                    // REGLE METIER (arbitrage explicite) : le remboursement porte
                    // sur le PRIX UNITAIRE des lignes rendues, sans tenir compte de
                    // la remise globale de la vente. Motif : la remise s'applique a
                    // l'ensemble de la commande ; la rembourser en plus des articles
                    // rendus reviendrait a l'annuler pour un client qui ramene tout.
                    //
                    // CONsequence a garder en tete : sur une vente remisee, un retour
                    // total rembourse montant_total, soit PLUS que le montant
                    // effectivement encaisse (montant_total - remise). C'est
                    // deliberé : la remise reste due a la boutique. Une vente remisee
                    // ne doit donc pas etre annulee par un retour, sinon la boutique
                    // perd deux fois.
                    //
                    // Pour un remboursement borne au seul encaissement, il faut
                    // repartir la remise sur les lignes (net au prorata) : ce serait
                    // un autre calcul, et un autre jeu de tests.
                    $montantLigne = $ligneData['quantite_retournee'] * $ligneVente->prix_unitaire;
                    $montantTotalRembourse += $montantLigne;

                    RetourVenteLigne::create([
                        'retour_vente_id' => $retour->id,
                        'ligne_vente_id' => $ligneVente->id,
                        'produit_id' => $ligneVente->produit_id,
                        'quantite_retournee' => $ligneData['quantite_retournee'],
                        'prix_unitaire' => $ligneVente->prix_unitaire,
                        'montant_retourne' => $montantLigne,
                    ]);
                }
            }

            $retour->update(['montant_rembourse' => $montantTotalRembourse]);

            $this->auditCreate($retour);

            return response()->json([
                'message' => 'Retour enregistré avec succès',
                'data' => $retour->load('lignes.produit'),
            ], 201);
        });
    }

    /**
     * Valider un retour : remettre le stock + marquer le statut.
     */
    public function valider(Request $request, RetourVente $retour): JsonResponse
    {
        $this->verifierBoutiqueDe($retour);

        if ($retour->statut !== 'en_attente') {
            return response()->json(['message' => 'Ce retour a déjà été traité'], 422);
        }

        return DB::transaction(function () use ($retour, $request) {
            // Verrou sur la VENTE avant le retour, dans le même ordre que
            // store(). C'est la vente qui porte le reliquat : verrouiller
            // seulement le retour ne protège pas, car deux validations
            // concurrentes portent sur deux RETOURS DIFFÉRENTS et ne se
            // disputeraient jamais le même verrou de retour — chacune
            // validerait de son côté et le stock dépasserait la quantité vendue.
            $venteVerrouillee = Vente::whereKey($retour->vente_id)->lockForUpdate()->first();

            // L'annulation d'une vente restitue le stock de ses lignes. Si la
            // vente a été annulée depuis la création du retour, le valider
            // créditerait ces unités une seconde fois. Vente::annuler()
            // refuse les retours en attente, donc cette situation ne survient
            // que sur des données antérieures ou importées — d'où ce contrôle.
            if ($venteVerrouillee && $venteVerrouillee->statut === 'annule') {
                throw new OperationRefusee(
                    'La vente #'.$retour->vente_id.' est annulée : son stock a déjà été restitué, ce retour ne peut pas être validé.',
                    409
                );
            }

            // Le statut doit être relu SOUS VERROU. Le test ligne 217 précède la
            // transaction : deux validations concurrentes le lisaient toutes les
            // deux à « en_attente » et créditaient le stock deux fois.
            // $retour reste l'instance liée à la route ; les lignes sont relues
            // pour ne pas travailler sur une collection désynchronisée.
            $verrouille = RetourVente::whereKey($retour->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($verrouille->statut !== 'en_attente') {
                // 409 comme dans refuser() : l'état a changé sous nos pieds,
                // ce n'est pas une requête mal formée. Le client doit relire
                // avant de réessayer.
                return response()->json([
                    'message' => 'Ce retour a été traité entre-temps (statut : '.$verrouille->statut.')',
                ], 409);
            }

            $lignes = RetourVenteLigne::where('retour_vente_id', $verrouille->id)->get();

            // Les deux contrôles précèdent TOUTE écriture de stock : lever ici
            // déclenche le rollback, donc le stock n'est jamais crédité à
            // moitié et un retour n'est jamais marqué « validé » sans l'être.
            $this->verifierReliquatAuMomentDeValider($verrouille, $lignes);
            $this->verifierProduitsIntegrables($verrouille, $lignes);

            foreach ($lignes as $ligne) {
                // Scopé à la boutique : un produit référencé par erreur depuis
                // un autre tenant ne doit jamais voir son stock crédité.
                // La condition est inatteignable — verifierProduitsIntegrables()
                // a déjà coupé la transaction si un produit manquait — et reste
                // là en défense en profondeur.
                $produit = Produit::whereKey($ligne->produit_id)
                    ->where('boutique_id', $verrouille->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if ($produit) {
                    $quantiteAvant = $produit->quantite_stock;
                    $quantiteApres = $quantiteAvant + $ligne->quantite_retournee;

                    $produit->update(['quantite_stock' => $quantiteApres]);

                    MouvementStock::create([
                        'produit_id' => $produit->id,
                        'quantite' => $ligne->quantite_retournee,
                        'raison' => 'retour',
                        'type' => 'entree',
                        'reference_bon' => (string) $verrouille->id,
                        'notes' => 'Retour vente #'.$retour->vente_id.' — '.$retour->motif,
                        'user_id' => $request->user()->id,
                        'statut' => 'accepte',
                        'quantite_avant' => $quantiteAvant,
                        'quantite_apres' => $quantiteApres,
                        'boutique_id' => $verrouille->boutique_id,
                    ]);
                }
            }

            $ancienStatut = $verrouille->statut;
            $verrouille->update(['statut' => 'valide']);
            $this->auditUpdate($verrouille, ['statut' => $ancienStatut]);

            return response()->json([
                'message' => 'Retour validé, stock mis à jour',
                'data' => $verrouille->load('lignes.produit'),
            ]);
        });
    }

    /**
     * Refuser un retour.
     */
    public function refuser(Request $request, RetourVente $retour): JsonResponse
    {
        $this->verifierBoutiqueDe($retour);

        if ($retour->statut !== 'en_attente') {
            return response()->json(['message' => 'Ce retour a déjà été traité'], 422);
        }

        return DB::transaction(function () use ($retour) {
            // Même verrou et même relecture que valider(). Sans cela, un refus et
            // une validation lancés ensemble lisaient tous deux « en_attente » :
            // la validation créditait le stock, puis le refus écrasait le statut.
            // Résultat, un retour marqué « refusé » dont les articles sont en
            // stock et revendables — la pire des deux issues, puisque le client
            // comme le vendeur croient à des états opposés.
            $verrouille = RetourVente::whereKey($retour->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($verrouille->statut !== 'en_attente') {
                // 409 et non 422 : l'état a changé sous nos pieds, ce n'est pas
                // une requête mal formée. Le client doit relire avant de
                // réessayer, sinon il enverrait un refus sur un retour déjà
                // validé et crédité.
                return response()->json([
                    'message' => 'Ce retour a été traité entre-temps (statut : '.$verrouille->statut.')',
                ], 409);
            }

            $ancienStatut = $verrouille->statut;
            $verrouille->update(['statut' => 'refuse']);
            $this->auditUpdate($verrouille, ['statut' => $ancienStatut]);

            return response()->json([
                'message' => 'Retour refusé',
                'data' => $verrouille,
            ]);
        });
    }

    /**
     * Quantité déjà rendue et validée, par ligne de vente.
     *
     * La définition du cumul vit sur RetourVente : l'annulation d'une vente
     * doit tenir compte du même cumul, sous peine de créditer deux fois les
     * mêmes unités.
     *
     * @return array<int, int>
     */
    private function quantiteDejaValideeParLigne(int $venteId): array
    {
        return RetourVente::quantiteValideeParLigne($venteId);
    }

    /**
     * Le reliquat est revalidé à la validation, pas seulement à la création.
     *
     * store() ne déduit que les retours DÉJÀ validés : plusieurs retours en
     * attente peuvent donc réclamer chacun la totalité d'une même ligne. Sans
     * ce contrôle, un gérant qui valide les uns après les autres réintègre
     * autant de stock qu'il y a de demandes, pour une vente qui n'en a produit
     * qu'une. C'est le seul moment où le contrôle protège le stock, donc c'est
     * ici qu'il doit être, sous le même verrou que la lecture des cumulats.
     *
     * @param  Collection<int, RetourVenteLigne>  $lignes
     */
    private function verifierReliquatAuMomentDeValider(RetourVente $retour, Collection $lignes): void
    {
        $dejaValide = $this->quantiteDejaValideeParLigne($retour->vente_id);

        // Cumul des lignes du retour lui-même : deux lignes de retour portant
        // sur la même ligne de vente doivent être comparées ensemble.
        $demandeParLigne = $lignes
            ->groupBy('ligne_vente_id')
            ->map(fn (Collection $groupe) => (int) $groupe->sum('quantite_retournee'));

        $depassements = [];

        foreach ($demandeParLigne as $ligneVenteId => $quantite) {
            $ligne = LigneVente::whereKey($ligneVenteId)
                ->where('vente_id', $retour->vente_id)
                ->first();

            $vendu = $ligne ? (int) $ligne->quantite : 0;
            $disponible = max(0, $vendu - (int) ($dejaValide[$ligneVenteId] ?? 0));

            if ($quantite > $disponible) {
                $depassements[] = sprintf(
                    'ligne #%d : %d demandé(s), %d encore disponible(s)',
                    $ligneVenteId,
                    $quantite,
                    $disponible
                );
            }
        }

        if ($depassements !== []) {
            throw new OperationRefusee(
                'Retour non validable, le reliquat a été consommé par un autre retour validé : '.implode(' ; ', $depassements),
                422
            );
        }
    }

    /**
     * Un produit supprimé ou rattaché à une autre boutique rend le retour non
     * réintégrable.
     *
     * L'ancien code sautait simplement ces lignes (`if ($produit)`) tout en
     * marquant le retour « valide » : le client recevait « stock mis à jour »
     * alors que les articles n'étaient pas réintégrés, et la marchandise
     * manquait sans trace. Un refus explicite laisse le gérant corriger les
     * données au lieu de croire à une réintégration.
     *
     * @param  Collection<int, RetourVenteLigne>  $lignes
     */
    private function verifierProduitsIntegrables(RetourVente $retour, Collection $lignes): void
    {
        $introuvables = $lignes
            ->pluck('produit_id')
            ->unique()
            ->filter(fn ($produitId) => ! Produit::whereKey($produitId)
                ->where('boutique_id', $retour->boutique_id)
                ->exists())
            ->values();

        if ($introuvables->isNotEmpty()) {
            throw new OperationRefusee(
                'Produit supprimé ou hors boutique, retour non validé (aucun stock réintégré) : #'
                    .$introuvables->implode(', #'),
                422
            );
        }
    }
}
