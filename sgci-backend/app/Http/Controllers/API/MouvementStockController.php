<?php

namespace App\Http\Controllers\API;

use App\Exceptions\OperationRefusee;
use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\CommandeFournisseur;
use App\Models\LigneCommandeFournisseur;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Services\StockAlertService;
use App\Services\WorkflowNotificationService;
use App\Traits\Auditable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Throwable;

class MouvementStockController extends Controller
{
    use Auditable;

    public const RAISONS = ['arrivage', 'vente', 'ajustement', 'retour', 'casse'];

    public const TYPES = ['entree', 'sortie'];

    public function __construct(
        private readonly WorkflowNotificationService $notifications,
        private readonly StockAlertService $stockAlerts,
    ) {}

    // ==================== SÉCURITÉ MULTI-BOUTIQUE ====================

    private function boutiqueId(Request $request): ?int
    {
        return $request->user()?->current_boutique_id;
    }

    private function userEstGerant(): bool
    {
        $user = auth()->user();
        if (! $user) {
            return false;
        }

        return in_array(
            $user->roleDansBoutique($user->current_boutique_id),
            ['gerant', 'proprietaire'],
            true
        );
    }

    /**
     * Un mouvement n'est manipérable que par un utilisateur de la boutique
     * à laquelle il appartient. Sans ce garde-fou, un gérant de la boutique A
     * pourrait valider - et donc modifier le stock de - un mouvement de la
     * boutique B en devinant son identifiant.
     */
    private function appartientALaBoutiqueCourante(MouvementStock $mouvement): bool
    {
        $boutiqueId = auth()->user()?->current_boutique_id;

        return $boutiqueId !== null && (int) $mouvement->boutique_id === (int) $boutiqueId;
    }

    private function refuserSiBoutiqueEtrangere(MouvementStock $mouvement): ?JsonResponse
    {
        if ($this->appartientALaBoutiqueCourante($mouvement)) {
            return null;
        }

        return response()->json([
            'message' => 'Non autorisé',
            'error' => "Ce mouvement n'appartient pas à votre boutique",
        ], 403);
    }

    /**
     * Vérifie qu'un lot n'est pas périmé avant sa fabrication.
     *
     * Contrôle explicite plutôt qu'une règle « after_or_equal » : celle-ci
     * compare à un champ absent du payload lorsque seule la date de
     * péremption est renseignée, ce qui rejetait des saisies valides.
     *
     * @return array<string, string> Erreurs de validation, vide si tout est correct.
     */
    private function verifierCoherenceDates(?string $fabrication, ?string $peremption): array
    {
        if (! $fabrication || ! $peremption) {
            return [];
        }

        if (strtotime($peremption) < strtotime($fabrication)) {
            return [
                'date_peremption' => 'La date de péremption ne peut pas précéder la date de fabrication',
            ];
        }

        return [];
    }

    // ==================== LISTE ====================

    public function index(Request $request): JsonResponse
    {
        $boutiqueId = $this->boutiqueId($request);

        $query = MouvementStock::with(['produit', 'user', 'validePar', 'commandeFournisseur'])
            ->when(
                $boutiqueId,
                fn ($q) => $q->where('boutique_id', $boutiqueId),
                // Sans boutique courante, on ne renvoie rien plutôt que tout.
                fn ($q) => $q->whereRaw('1 = 0')
            )
            ->orderBy('created_at', 'desc');

        if ($request->filled('produit_id')) {
            $query->where('produit_id', $request->produit_id);
        }

        if ($request->filled('raison')) {
            $query->where('raison', $request->raison);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }

        if ($request->filled('commande_fournisseur_id')) {
            $query->where('commande_fournisseur_id', $request->commande_fournisseur_id);
        }

        if ($request->filled('reference_bon')) {
            $query->where('reference_bon', 'like', '%'.$request->reference_bon.'%');
        }

        if ($request->filled('date_debut') && $request->filled('date_fin')) {
            $query->whereBetween('created_at', [
                $request->date_debut.' 00:00:00',
                $request->date_fin.' 23:59:59',
            ]);
        }

        if ($request->filled('q')) {
            $search = trim((string) $request->q);
            $query->where(function ($q) use ($search) {
                $q->where('reference_bon', 'like', '%'.$search.'%')
                    ->orWhereHas('produit', function ($qp) use ($search) {
                        $qp->where('nom', 'like', '%'.$search.'%')
                            ->orWhere('code_barre', 'like', '%'.$search.'%');
                    });
            });
        }

        return response()->json($query->paginate($request->per_page ?? 25));
    }

    // ==================== CRÉATION ====================

    public function store(Request $request): JsonResponse
    {
        $boutiqueId = $this->boutiqueId($request);

        if (! $boutiqueId) {
            return response()->json([
                'message' => 'Aucune boutique courante',
                'error' => 'Rattachez-vous à une boutique avant de saisir un mouvement',
            ], 422);
        }

        $validated = $request->validate([
            // Le produit doit appartenir à la boutique : sans ce périmètre,
            // on pourrait créer un mouvement sur un produit d'une autre
            // boutique puis, en le validant, modifier SON stock.
            'produit_id' => [
                'required',
                Rule::exists('produits', 'id')->where('boutique_id', $boutiqueId),
            ],
            'quantite' => 'required|integer|min:1',
            'raison' => ['required', Rule::in(self::RAISONS)],
            'type' => ['required', Rule::in(self::TYPES)],
            'reference_bon' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'date_fabrication' => 'nullable|date',
            'date_peremption' => 'nullable|date',
            'commande_fournisseur_id' => [
                'nullable',
                Rule::exists('commande_fournisseurs', 'id')->where('boutique_id', $boutiqueId),
            ],
            'ligne_commande_fournisseur_id' => [
                'nullable',
                Rule::exists('ligne_commande_fournisseurs', 'id')
                    ->where('commande_fournisseur_id', $request->input('commande_fournisseur_id')),
            ],
            'idempotency_key' => 'nullable|string|max:100',
        ]);

        if ($erreurs = $this->verifierCoherenceDates(
            $validated['date_fabrication'] ?? null,
            $validated['date_peremption'] ?? null
        )) {
            return response()->json([
                'message' => 'Données invalides',
                'error' => reset($erreurs),
                'errors' => $erreurs,
            ], 422);
        }

        // Idempotence : un double envoi ne doit pas créer deux mouvements.
        if (! empty($validated['idempotency_key'])) {
            $existant = MouvementStock::where('boutique_id', $boutiqueId)
                ->where('idempotency_key', $validated['idempotency_key'])
                ->first();

            if ($existant) {
                return response()->json([
                    'message' => 'Arrivage déjà enregistré',
                    'mouvement' => $existant->load(['produit', 'user']),
                    'doublon' => true,
                ], 200);
            }
        }

        // Une sortie ne peut pas dépasser le stock disponible au moment de la
        // saisie : inutile de faire valider une opération impossible.
        if ($validated['type'] === 'sortie' && $validated['raison'] !== 'ajustement') {
            $produit = Produit::findOrFail($validated['produit_id']);

            if ($produit->quantite_stock < $validated['quantite']) {
                return response()->json([
                    'message' => 'Stock insuffisant',
                    'error' => 'Stock insuffisant pour cette sortie',
                    'stock_actuel' => $produit->quantite_stock,
                    'demande' => $validated['quantite'],
                ], 422);
            }
        }

        $ligne = ! empty($validated['ligne_commande_fournisseur_id'])
            ? LigneCommandeFournisseur::findOrFail($validated['ligne_commande_fournisseur_id'])
            : null;

        $produit = Produit::findOrFail($validated['produit_id']);
        $quantiteAvant = $produit->quantite_stock;

        try {
            $mouvement = MouvementStock::create([
                'produit_id' => $validated['produit_id'],
                'quantite' => $validated['quantite'],
                'raison' => $validated['raison'],
                'type' => $validated['type'],
                'reference_bon' => $validated['reference_bon']
                    ?? $ligne?->commandeFournisseur?->numero_commande,
                'notes' => $validated['notes'] ?? null,
                'date_fabrication' => $validated['date_fabrication'] ?? null,
                'date_peremption' => $validated['date_peremption'] ?? null,
                'commande_fournisseur_id' => $validated['commande_fournisseur_id']
                    ?? $ligne?->commande_fournisseur_id,
                'ligne_commande_fournisseur_id' => $ligne?->id,
                'idempotency_key' => $validated['idempotency_key'] ?? null,
                'user_id' => auth()->id(),
                'statut' => 'en_attente',
                'quantite_avant' => $quantiteAvant,
                // Le stock n'est modifié qu'à la validation.
                'quantite_apres' => $quantiteAvant,
                'boutique_id' => $boutiqueId,
            ]);
        } catch (UniqueConstraintViolationException $e) {
            // Deux envois simultanés avec la même clé.
            $existant = MouvementStock::where('boutique_id', $boutiqueId)
                ->where('idempotency_key', $validated['idempotency_key'] ?? '')
                ->first();

            if ($existant) {
                return response()->json([
                    'message' => 'Arrivage déjà enregistré',
                    'mouvement' => $existant->load(['produit', 'user']),
                    'doublon' => true,
                ], 200);
            }

            throw $e;
        }

        $this->auditCreate($mouvement);

        // Le gérant doit savoir qu'une validation l'attend.
        $this->notifications->notifierGerants(
            $boutiqueId,
            auth()->user(),
            'Arrivage à valider',
            sprintf(
                '%s a demandé %s %s de « %s »%s.',
                auth()->user()?->name ?? 'Un utilisateur',
                $mouvement->quantite,
                $mouvement->quantite > 1 ? 'unités' : 'unité',
                $produit->nom,
                $mouvement->reference_bon ? ' (bon '.$mouvement->reference_bon.')' : ''
            ),
            [
                'type' => 'arrivage_a_valider',
                'mouvement_id' => $mouvement->id,
                'produit_id' => $mouvement->produit_id,
                'boutique_id' => $boutiqueId,
            ],
            // L'auteur n'a rien à faire sur sa propre demande.
            [auth()->id()]
        );

        return response()->json([
            'message' => 'Mouvement de stock créé en attente de validation',
            'mouvement' => $mouvement->load(['produit', 'user', 'commandeFournisseur']),
        ], 201);
    }

    // ==================== MODIFICATION (uniquement en attente) ====================

    public function update(Request $request, MouvementStock $mouvement): JsonResponse
    {
        if ($refus = $this->refuserSiBoutiqueEtrangere($mouvement)) {
            return $refus;
        }

        if ($mouvement->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Mouvement déjà traité',
                'error' => 'Seul un mouvement en attente peut être modifié',
            ], 409);
        }

        // Seul l'auteur peut corriger sa saisie avant validation.
        if ((int) $mouvement->user_id !== (int) auth()->id() && ! $this->userEstGerant()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $boutiqueId = $this->boutiqueId($request);

        $validated = $request->validate([
            'produit_id' => [
                'sometimes',
                'required',
                Rule::exists('produits', 'id')->where('boutique_id', $boutiqueId),
            ],
            'quantite' => 'sometimes|required|integer|min:1',
            'raison' => ['sometimes', 'required', Rule::in(self::RAISONS)],
            'type' => ['sometimes', 'required', Rule::in(self::TYPES)],
            'reference_bon' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'date_fabrication' => 'nullable|date',
            'date_peremption' => 'nullable|date',
        ]);

        if ($erreurs = $this->verifierCoherenceDates(
            $validated['date_fabrication'] ?? $mouvement->date_fabrication?->format('Y-m-d'),
            $validated['date_peremption'] ?? $mouvement->date_peremption?->format('Y-m-d')
        )) {
            return response()->json([
                'message' => 'Données invalides',
                'error' => reset($erreurs),
                'errors' => $erreurs,
            ], 422);
        }

        return DB::transaction(function () use ($mouvement, $validated) {
            // Relecture SOUS VERROU avant d'écrire. La garde « en_attente »
            // ci-dessus est une lecture hors transaction : sans ce verrou, une
            // modification concurrente à une validation réécrivait quantité ou
            // produit APRÈS que le stock a été appliqué, et le ledger ne
            // correspondait plus à ce qui avait été mouvementé.
            $verrouille = MouvementStock::whereKey($mouvement->id)
                ->where('boutique_id', $mouvement->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouille) {
                return response()->json(['message' => 'Mouvement introuvable.'], 404);
            }

            if ($verrouille->statut !== 'en_attente') {
                return response()->json([
                    'message' => 'Mouvement déjà traité',
                    'error' => 'Seul un mouvement en attente peut être modifié',
                ], 409);
            }

            $avant = $verrouille->only(array_keys($validated));

            // Le stock de référence doit refléter le nouveau produit choisi.
            if (isset($validated['produit_id']) && $validated['produit_id'] != $verrouille->produit_id) {
                $verrouille->quantite_avant = Produit::findOrFail($validated['produit_id'])->quantite_stock;
            }

            $verrouille->fill($validated);
            $verrouille->save();

            $this->auditUpdate($verrouille, $avant);

            return response()->json([
                'message' => 'Mouvement mis à jour',
                'mouvement' => $verrouille->fresh()->load(['produit', 'user', 'commandeFournisseur']),
            ]);
        });
    }

    // ==================== SUPPRESSION (uniquement en attente) ====================

    /**
     * Supprime un mouvement en attente
     *
     * Le statut est relu sous verrou, dans le meme ordre d'acquition que
     * valider() : mouvement d'abord, puis produit. Sans cela, une suppression
     * et une validation concurrentes lisaient toutes deux « en_attente » :
     *
     *   - la validation appliquait l'entrée en stock (10 -> 50) et la
     *     suppression effaçait la ligne juste après. Le stock avait bougé sans
     *     aucune ligne de ledger, et l'écart devenait invisible et définitif ;
     *   - à l'inverse, la suppression pouvait gagner et la réception était
     *     perdue sans trace.
     *
     * L'ordre des verrous est le point délicat : valider() verrouille le
     * mouvement puis le produit. Il faut faire exactement pareil ici, sinon deux
     * transactions qui cherchent les memes lignes dans des ordres opposés
     * s'attendent l'une l'autre jusqu'à l'expiration du délai InnoDB.
     */
    public function destroy(Request $request, MouvementStock $mouvement): JsonResponse
    {
        if ($refus = $this->refuserSiBoutiqueEtrangere($mouvement)) {
            return $refus;
        }

        if ((int) $mouvement->user_id !== (int) auth()->id() && ! $this->userEstGerant()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($mouvement) {
            $verrouille = MouvementStock::where('id', $mouvement->id)
                ->where('boutique_id', $mouvement->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouille) {
                return response()->json([
                    'message' => 'Mouvement introuvable',
                ], 404);
            }

            if ($verrouille->statut !== 'en_attente') {
                return response()->json([
                    'message' => 'Ce mouvement a déjà été traité entre-temps (statut : '.$verrouille->statut.')',
                    'error' => 'Seul un mouvement en attente peut être supprimé',
                    'statut' => $verrouille->statut,
                ], 409);
            }

            $this->auditDelete($verrouille);
            $verrouille->delete();

            return response()->json(['message' => 'Mouvement supprimé']);
        });
    }

    // ==================== VALIDATION ====================

    public function valider(Request $request, MouvementStock $mouvement): JsonResponse
    {
        if ($refus = $this->refuserSiBoutiqueEtrangere($mouvement)) {
            return $refus;
        }

        if (! $this->userEstGerant()) {
            return response()->json(['message' => 'Permission refusée'], 403);
        }

        if ($mouvement->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Mouvement déjà traité',
                'error' => 'Ce mouvement a déjà été traité',
            ], 409);
        }

        // Réception partielle : le gérant peut n'entrer qu'une partie du lot.
        $validated = $request->validate([
            'quantite_recue' => 'nullable|integer|min:1',
            'notes' => 'nullable|string|max:1000',
        ]);

        $quantiteRecue = $validated['quantite_recue'] ?? $mouvement->quantite;

        if ($quantiteRecue > $mouvement->quantite) {
            return response()->json([
                'message' => 'Quantité invalide',
                'error' => 'La quantité reçue ne peut pas dépasser la quantité annoncée',
                'quantite_annoncee' => $mouvement->quantite,
            ], 422);
        }

        $produit = $mouvement->produit;

        if (! $produit) {
            return response()->json(['message' => 'Produit introuvable'], 404);
        }

        try {
            $resultat = DB::transaction(function () use ($mouvement, $quantiteRecue, $validated) {
                // Le statut était contrôlé AVANT la transaction : deux
                // validations concurrentes du même mouvement passaient toutes
                // deux la garde et appliquaient la sortie deux fois. La relecture
                // sous verrou rend le contrôle atomique — la seconde attend
                // puis refuse.
                $mouvementVerrouille = MouvementStock::where('id', $mouvement->id)
                    ->where('boutique_id', $mouvement->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $mouvementVerrouille) {
                    throw new \DomainException('Mouvement introuvable');
                }

                if ($mouvementVerrouille->statut !== 'en_attente') {
                    throw new OperationRefusee('Ce mouvement a déjà été traité', 409);
                }

                // Idem pour le stock : sans verrou, deux sorties partantes
                // lisaient le même quantite_stock, passaient toutes deux la
                // garde « < 0 » et écrivaient la même valeur absolue. Le stock
                // restait supérieur à la réalité et le ledger ne réconciliait
                // plus.
                $produitVerrouille = Produit::where('id', $mouvementVerrouille->produit_id)
                    ->where('boutique_id', $mouvementVerrouille->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $produitVerrouille) {
                    throw new \DomainException('Produit introuvable');
                }

                $quantiteAvant = $produitVerrouille->quantite_stock;

                $quantiteApres = $mouvementVerrouille->type === 'entree'
                    ? $quantiteAvant + $quantiteRecue
                    : $quantiteAvant - $quantiteRecue;

                if ($quantiteApres < 0) {
                    throw new \DomainException('Stock insuffisant pour cette sortie');
                }

                $champsProduit = ['quantite_stock' => $quantiteApres];

                if ($mouvementVerrouille->type === 'entree') {
                    $champsProduit += $this->champsPeremption($produitVerrouille, $mouvementVerrouille);
                }

                $produitVerrouille->update($champsProduit);

                $mouvementVerrouille->update([
                    // Le stock a bien été mouvementé : le statut reste
                    // « accepte ». Le caractère partiel est porté par
                    // quantite_recue < quantite, sans statut ENUM supplémentaire
                    // (que MySQL et TiDB auraient refusé).
                    'statut' => 'accepte',
                    'quantite_recue' => $quantiteRecue,
                    'quantite_apres' => $quantiteApres,
                    'valide_par' => auth()->id(),
                    'valide_le' => now(),
                    'notes' => $validated['notes'] ?? $mouvementVerrouille->notes,
                ]);

                return [
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                    'commande' => $this->reporterSurCommandeFournisseur($mouvementVerrouille, $quantiteRecue),
                ];
            });
        } catch (OperationRefusee $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error' => $e->getMessage(),
            ], $e->statutHttp());
        } catch (\DomainException $e) {
            // La valeur affichée est relue : le modèle porté par la route était
            // chargé avant la transaction et pouvait être périmé.
            return response()->json([
                'message' => $e->getMessage(),
                'error' => $e->getMessage(),
                'stock_actuel' => Produit::whereKey($mouvement->produit_id)->value('quantite_stock'),
                'demande' => $quantiteRecue,
            ], 400);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['error' => $e->getMessage()], 500);
        }

        // Les écritures ont porté sur les modèles relus sous verrou, pas sur
        // les instances issues du model binding de la route. Sans cette
        // relecture, tout ce qui suit travaille sur un état périmé : un
        // arrivage partiel était annoncé comme complet (estPartiel() lisait
        // quantite_recue à null), la réponse renvoyait un mouvement sans son
        // nouveau statut ni sa quantité, et la résolution d'alerte jugeait le
        // stock d'avant l'entrée — donc une alerte « stock bas » légitime
        // restait ouverte après une entrée qui l'avait invalidée.
        $mouvement->refresh();
        $produit->refresh();

        $this->auditUpdate($mouvement, ['statut' => 'en_attente']);

        $partiel = $mouvement->estPartiel();

        // L'auteur de la demande doit connaître l'issue.
        $auteur = $mouvement->user;
        if ($auteur) {
            $this->notifications->notifier(
                collect([$auteur]),
                null,
                $partiel ? 'Arrivage partiellement reçu' : 'Arrivage validé',
                sprintf(
                    '%s de « %s » par %s (stock : %s → %s).',
                    $partiel
                        ? sprintf('%s/%s unités réceptionnées', $quantiteRecue, $mouvement->quantite)
                        : sprintf('%s unités entrées en stock', $quantiteRecue),
                    $produit->nom,
                    auth()->user()?->name ?? 'un gérant',
                    $resultat['quantite_avant'],
                    $resultat['quantite_apres']
                ),
                [
                    'type' => 'arrivage_valide',
                    'mouvement_id' => $mouvement->id,
                    'produit_id' => $produit->id,
                    'boutique_id' => $mouvement->boutique_id,
                ]
            );
        }

        // Une entrée peut faire remonter le produit au-dessus du seuil :
        // une alerte « stock bas » déjà émise ne doit plus hanter l'utilisateur.
        if ($mouvement->type === 'entree') {
            $this->resoudreAlertesStock($produit, (int) $mouvement->boutique_id);
        }

        return response()->json([
            'message' => $partiel
                ? 'Réception partielle enregistrée, stock mis à jour'
                : 'Mouvement de stock accepté et stock mis à jour',
            'partiel' => $partiel,
            'quantite_restante' => $mouvement->quantite_restante,
            'mouvement' => $mouvement->load(['produit', 'user', 'validePar', 'commandeFournisseur']),
            'stock_precedent' => $resultat['quantite_avant'],
            'stock_nouveau' => $resultat['quantite_apres'],
            'commande_fournisseur' => $resultat['commande'],
        ]);
    }

    /**
     * Champs produit à mettre à jour après réception d'un lot.
     *
     * Péremption : on retient la date la plus proche, sinon un stock déjà
     * périmé resterait affiché comme valide alors qu'un lot neuf est en rayon.
     * Fabrication : on retient la plus ancienne, c'est elle qui borne la
     * durée de vie restante.
     *
     * @return array<string, mixed>
     */
    private function champsPeremption(Produit $produit, MouvementStock $mouvement): array
    {
        $champs = [];

        if ($mouvement->date_peremption) {
            $existante = $produit->date_peremption;

            $champs['date_peremption'] = (! $existante || $existante < now())
                ? $mouvement->date_peremption
                : min($existante, $mouvement->date_peremption);

            $champs['est_perissable'] = true;
        }

        if ($mouvement->date_fabrication) {
            $existante = $produit->date_fabrication;

            $champs['date_fabrication'] = $existante
                ? min($existante, $mouvement->date_fabrication)
                : $mouvement->date_fabrication;
        }

        return $champs;
    }

    /**
     * Report la quantité reçue sur la ligne de commande fournisseur et fait
     * passer la commande en « livre » quand tout est réceptionné.
     */
    private function reporterSurCommandeFournisseur(MouvementStock $mouvement, int $quantiteRecue): ?array
    {
        $commandeId = $mouvement->commande_fournisseur_id;
        if (! $commandeId) {
            return null;
        }

        $commande = CommandeFournisseur::with('lignes')->find($commandeId);
        if (! $commande) {
            return null;
        }

        $ligne = $mouvement->ligne_commande_fournisseur_id
            ? $commande->lignes->firstWhere('id', $mouvement->ligne_commande_fournisseur_id)
            : $commande->lignes->firstWhere('produit_id', $mouvement->produit_id);

        if ($ligne) {
            $ligne->quantite_recue = min(
                $ligne->quantite_commandee,
                $ligne->quantite_recue + $quantiteRecue
            );
            $ligne->statut = $ligne->estEntierementRecue() ? 'recu' : 'partiel';
            $ligne->save();
        }

        $commande->refresh();

        if ($commande->statut === 'en_cours' && $commande->lignes->every->estEntierementRecue()) {
            $commande->update([
                'statut' => 'livre',
                'date_livraison_reelle' => now(),
            ]);
        }

        return $commande->fresh()->load('lignes')->toArray();
    }

    /**
     * Repasse au vert les notifications d'alerte de stock devenues fausses.
     */
    private function resoudreAlertesStock(Produit $produit, int $boutiqueId): void
    {
        try {
            if ($produit->quantite_stock < $produit->seuil_alerte) {
                return; // Toujours en alerte, rien à résoudre.
            }

            AppNotification::where('type', 'stock_alert')
                ->whereNull('read_at')
                ->where('data->boutique_id', $boutiqueId)
                ->where('data->produit_id', $produit->id)
                ->update(['read_at' => now()]);

            $this->stockAlerts->syncStockAlerts($boutiqueId);
        } catch (Throwable $e) {
            // Informatif : ne doit jamais faire échouer la validation.
            report($e);
        }
    }

    // ==================== REJET ====================

    public function rejeter(Request $request, MouvementStock $mouvement): JsonResponse
    {
        if ($refus = $this->refuserSiBoutiqueEtrangere($mouvement)) {
            return $refus;
        }

        if (! $this->userEstGerant()) {
            return response()->json(['message' => 'Permission refusée'], 403);
        }

        $validated = $request->validate([
            'raison_rejet' => 'required|string|max:255',
        ]);

        $motif = $validated['raison_rejet'];

        try {
            $mouvement = DB::transaction(function () use ($mouvement, $motif) {
                // Relecture SOUS VERROU, comme valider(). Le contrôle de statut
                // était fait avant toute transaction : un rejet lancé en même
                // temps qu'une validation lisait tous deux « en_attente », et le
                // rejet écrasait ensuite le statut « accepte » que la validation
                // venait d'écrire. Le stock avait été mouvementé, mais le
                // mouvement s'affichait « rejete » — l'écart entre le ledger et
                // produits.quantite_stock devenait invisible et définitif.
                $verrouille = MouvementStock::whereKey($mouvement->id)
                    ->where('boutique_id', $mouvement->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $verrouille) {
                    throw new \DomainException('Mouvement introuvable');
                }

                if ($verrouille->statut !== 'en_attente') {
                    throw new OperationRefusee('Ce mouvement a déjà été traité', 409);
                }

                $verrouille->update([
                    'statut' => 'rejete',
                    'motif_rejet' => $motif,
                    'valide_par' => auth()->id(),
                    'valide_le' => now(),
                ]);

                return $verrouille;
            });
        } catch (OperationRefusee $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error' => $e->getMessage(),
            ], $e->statutHttp());
        } catch (\DomainException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error' => $e->getMessage(),
            ], 400);
        }

        $this->auditUpdate($mouvement, ['statut' => 'en_attente']);

        // L'auteur doit savoir pourquoi sa demande est tombée.
        $auteur = $mouvement->user;
        if ($auteur) {
            $this->notifications->notifier(
                collect([$auteur]),
                null,
                'Arrivage rejeté',
                sprintf(
                    'Votre demande de %s « %s » a été rejetée : %s',
                    $mouvement->quantite,
                    $mouvement->produit?->nom ?? 'produit',
                    $motif
                ),
                [
                    'type' => 'arrivage_rejete',
                    'mouvement_id' => $mouvement->id,
                    'produit_id' => $mouvement->produit_id,
                    'boutique_id' => $mouvement->boutique_id,
                ]
            );
        }

        return response()->json([
            'message' => 'Mouvement rejeté',
            'mouvement' => $mouvement->load(['produit', 'user', 'validePar']),
        ]);
    }

    // ==================== DÉTAIL ====================

    public function show(Request $request, MouvementStock $mouvement): JsonResponse
    {
        if ($refus = $this->refuserSiBoutiqueEtrangere($mouvement)) {
            return $refus;
        }

        return response()->json(
            $mouvement->load(['produit', 'user', 'validePar', 'commandeFournisseur'])
        );
    }

    // ==================== STATISTIQUES ====================

    public function statistiques(Request $request): JsonResponse
    {
        $dateFin = now();
        $dateDebut = $dateFin->clone()->subDays($request->jours ?? 30);
        $boutiqueId = $this->boutiqueId($request);

        $query = MouvementStock::whereBetween('created_at', [$dateDebut, $dateFin])
            ->when(
                $boutiqueId,
                fn ($q) => $q->where('boutique_id', $boutiqueId),
                fn ($q) => $q->whereRaw('1 = 0')
            );

        $accules = (clone $query)->where('statut', 'accepte')->get();

        // Réceptions partielles : validées (statut accepte) mais lot incomplet.
        // Dérivé des quantités, pas d'un statut ENUM.
        $receptionsPartielles = (clone $query)
            ->where('statut', 'accepte')
            ->whereNotNull('quantite_recue')
            ->whereColumn('quantite_recue', '<', 'quantite')
            ->count();

        return response()->json([
            'total_entrees' => $accules->where('type', 'entree')->sum('quantite_recue'),
            'total_sorties' => $accules->where('type', 'sortie')->sum('quantite_recue'),
            'arrivages' => $accules->where('raison', 'arrivage')->count(),
            'ventes' => $accules->where('raison', 'vente')->count(),
            'ajustements' => $accules->where('raison', 'ajustement')->count(),
            'retours' => $accules->where('raison', 'retour')->count(),
            'casses' => $accules->where('raison', 'casse')->count(),
            'en_attente' => (clone $query)->where('statut', 'en_attente')->count(),
            'rejetes' => (clone $query)->where('statut', 'rejete')->count(),
            'receptions_partielles' => $receptionsPartielles,
            'periode' => [
                'debut' => $dateDebut->format('Y-m-d'),
                'fin' => $dateFin->format('Y-m-d'),
            ],
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        $boutiqueId = $this->boutiqueId($request);

        $query = MouvementStock::with(['produit', 'user', 'validePar'])
            ->when(
                $boutiqueId,
                fn ($q) => $q->where('boutique_id', $boutiqueId),
                fn ($q) => $q->whereRaw('1 = 0')
            )
            ->orderBy('created_at', 'desc');

        if ($request->filled('date_debut') && $request->filled('date_fin')) {
            $query->whereBetween('created_at', [
                $request->date_debut.' 00:00:00',
                $request->date_fin.' 23:59:59',
            ]);
        }

        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }

        return response()->json(
            $query->get()->map(fn (MouvementStock $m) => [
                'id' => $m->id,
                'produit' => $m->produit?->nom,
                'type' => $m->libelle_type,
                'raison' => $m->libelle_raison,
                'quantite' => $m->quantite,
                'quantite_recue' => $m->quantite_effective,
                'statut' => $m->libelle_statut,
                'stock_avant' => $m->quantite_avant,
                'stock_apres' => $m->quantite_apres,
                'reference_bon' => $m->reference_bon,
                'date_fabrication' => $m->date_fabrication?->format('Y-m-d'),
                'date_peremption' => $m->date_peremption?->format('Y-m-d'),
                'user' => $m->user?->name,
                'valide_par' => $m->validePar?->name,
                'valide_le' => $m->valide_le?->format('Y-m-d H:i:s'),
                'motif_rejet' => $m->motif_rejet,
                'date' => $m->created_at->format('Y-m-d H:i:s'),
                'notes' => $m->notes,
            ])
        );
    }
}
