<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CommandeClient;
use App\Models\Paiement;
use App\Services\MobileMoneyService;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class MobileMoneyController extends Controller
{
    /**
     * Fenêtre de ressemblance pour les clients qui n'envoient pas de clé
     * d'idempotence. Au-delà, deux paiements identiques sont considérés comme
     * deux tentatives distinctes.
     */
    private const FENETRE_DOUBLON = 120;

    protected $mobileMoneyService;

    public function __construct(MobileMoneyService $mobileMoneyService)
    {
        $this->mobileMoneyService = $mobileMoneyService;
    }

    /**
     * Initie un paiement Mobile Money
     */
    public function initiatePayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:100',
            'phone_number' => 'required|string',
            'provider' => 'nullable|string|in:orange,mtn',
            'description' => 'nullable|string',
            // Clé d'idempotence : le client la génère pour une tentative de
            // paiement et la renvoie à l'identique s'il réessaie (timeout,
            // double-tap, retour de connexion). Voir idempotentPayment().
            'idempotency_key' => 'nullable|string|max:64',
            // Scopée à la boutique : sans cette contrainte, un gérant pouvait
            // rattacher son paiement à la commande d'un autre tenant, dont le
            // montant_paye était ensuite crédité par applyTransition().
            'commande_client_id' => [
                'nullable',
                Rule::exists('commande_clients', 'id')
                    ->where('boutique_id', $request->user()->current_boutique_id),
            ],
        ]);

        // Valider le numéro de téléphone
        if (! $this->mobileMoneyService->validatePhoneNumber($validated['phone_number'])) {
            return response()->json([
                'message' => 'Numéro de téléphone invalide',
            ], 400);
        }

        // Déterminer le fournisseur si non spécifié
        $provider = $validated['provider'] ?? $this->mobileMoneyService->detectProvider($validated['phone_number']);

        if (! $provider) {
            return response()->json([
                'message' => 'Impossible de déterminer le fournisseur Mobile Money',
            ], 400);
        }

        // Rejeu de la même tentative : on rend le paiement déjà créé au lieu
        // d'en déclencher un second. Doit précéder la création de ligne, sinon
        // le doublon est déjà en base.
        $rejeu = $this->idempotentPayment($request, $validated, $provider);

        if ($rejeu instanceof Paiement) {
            return response()->json([
                'message' => 'Paiement déjà initié',
                'idempotent' => true,
                'data' => ['paiement' => $rejeu],
            ]);
        }

        // Mettre à jour le service avec le bon fournisseur
        $this->mobileMoneyService = new MobileMoneyService($provider);

        // La vérification du reste à payer et la création de la ligne forment
        // une section critique par commande : les paiements « en_attente » sont
        // des réservations, leur somme immobilise la dette. Sans ce mutex, deux
        // initiations (deux clés d'idempotence distinctes, ou deux double-taps)
        // lisaient le même reste, le laissaient passer toutes les deux, puis le
        // prestataire débitait deux fois — et les callbacks créditaient
        // montant_paye au-delà de montant_total. La commande était payée deux
        // fois pour une dette unique.
        //
        // Le verrou est porté par le cache (store « database » en production) :
        // il est partagé entre les workers, contrairement à un verrou purement
        // in-process. On ne l'ouvre que lorsqu'une commande est rattachée, seul
        // cas où une réservation a un sens.
        $verrou = ! empty($validated['commande_client_id'])
            ? Cache::lock('momo:reservation:commande:'.$validated['commande_client_id'], 10)
            : null;

        if ($verrou) {
            try {
                $verrou->block(5);
            } catch (LockTimeoutException) {
                return response()->json([
                    'message' => 'Un paiement est déjà en cours pour cette commande.',
                ], 409);
            }
        }

        try {
            if (! empty($validated['commande_client_id'])) {
                // Relecture scopée boutique : la contrainte de validation
                // garantit déjà le tenant, mais le contrôle monétaire ne doit
                // pas dépendre d'une entité potentiellement obsolète.
                $commande = CommandeClient::where('id', $validated['commande_client_id'])
                    ->where('boutique_id', $request->user()->current_boutique_id)
                    ->first();

                if (! $commande) {
                    return response()->json(['message' => 'Commande introuvable.'], 404);
                }

                if ($commande->statut === 'annule') {
                    return response()->json([
                        'message' => 'Impossible de payer une commande annulée',
                    ], 400);
                }

                // Reste à payer = dette restante MOINS ce qui est déjà réservé
                // par des paiements en attente.
                $reserve = (float) Paiement::where('commande_client_id', $commande->id)
                    ->where('statut', 'en_attente')
                    ->sum('montant');

                $reste = (float) $commande->montant_restant - $reserve;

                if ((float) $validated['amount'] > $reste + 0.001) {
                    return response()->json([
                        'message' => 'Le montant dépasse le reste à payer de la commande',
                        'reste_a_payer' => round($reste, 2),
                    ], 400);
                }
            }

            // numero_paiement est laissé vide : Paiement::boot() l'alloue via
            // le séquenceur sous verrou.
            try {
                $paiement = Paiement::create([
                    'idempotency_key' => $validated['idempotency_key'] ?? null,
                    'commande_client_id' => $validated['commande_client_id'] ?? null,
                    'boutique_id' => $request->user()->current_boutique_id,
                    'montant' => $validated['amount'],
                    'mode_paiement' => 'mobile_money_'.$provider,
                    'telephone' => $validated['phone_number'],
                    'date_paiement' => now(),
                    'statut' => 'en_attente',
                    'user_id' => $request->user()->id,
                ]);
            } catch (QueryException $e) {
                // Deux requêtes portant la même clé peuvent passer la lecture
                // préalable en même temps : c'est l'index UNIQUE qui tranche.
                // La perdante ne doit pas remonter une 500 — elle rend le
                // paiement déjà créé, comme un rejeu.
                if (! $this->estViolationCleIdempotence($e)) {
                    throw $e;
                }

                $existant = Paiement::where('boutique_id', $request->user()->current_boutique_id)
                    ->where('idempotency_key', $validated['idempotency_key'])
                    ->first();

                if (! $existant) {
                    throw $e;
                }

                return response()->json([
                    'message' => 'Paiement déjà initié',
                    'idempotent' => true,
                    'data' => ['paiement' => $existant],
                ]);
            }
        } finally {
            $verrou?->release();
        }

        // Initier le paiement
        $paymentData = [
            'amount' => $validated['amount'],
            'phone_number' => $validated['phone_number'],
            'external_id' => $paiement->numero_paiement,
            'description' => $validated['description'] ?? 'Paiement SGCI',
            'callback_url' => route('mobile-money.callback'),
        ];

        $result = $this->mobileMoneyService->initiatePayment($paymentData);

        if ($result['success']) {
            $reference = $result['data']['transaction_id'] ?? $result['data']['payment_id'] ?? null;

            if (! is_string($reference) || $reference === '') {
                // Le prestataire a accepté sans rendre de référence : le
                // paiement peut être encaissé mais plus jamais rapproché, ni
                // par le callback (qui cherche cette référence) ni par
                // checkStatus. On garde « en_attente » pour ne pas clore un
                // encaissement possible, et on trace pour un traitement
                // humain.
                Log::error('Mobile Money: initiation réussie sans référence', [
                    'numero_paiement' => $paiement->numero_paiement,
                    'boutique_id' => $paiement->boutique_id,
                    'provider' => $provider,
                ]);

                return response()->json([
                    'message' => 'Paiement accepté par le prestataire mais non traçable : contactez le support avec la référence '.$paiement->numero_paiement,
                    'data' => ['paiement' => $paiement->fresh()],
                ], 502);
            }

            // Mettre à jour le paiement avec la référence de transaction
            $paiement->update([
                'reference_transaction' => $reference,
            ]);

            return response()->json([
                'message' => 'Paiement initié avec succès',
                'data' => [
                    'paiement' => $paiement,
                    'transaction' => $result['data'],
                ],
            ]);
        }

        // Refus explicite du prestataire : le paiement n'a pas eu lieu.
        if ($result['issue_connue'] ?? true) {
            $paiement->update(['statut' => 'echoue']);

            return response()->json([
                'message' => $result['message'],
                'error' => $result['error'] ?? null,
            ], 400);
        }

        // Issue inconnue (timeout, 5xx) : l'argent a pu être débité. Laisser
        // « en_attente » est le seul choix qui ne perde pas d'argent : un
        // callback de succès tardif sera alors appliqué, et checkStatus peut
        // réconcilier entre-temps.
        Log::warning('Mobile Money: issue inconnue, paiement laissé en attente', [
            'numero_paiement' => $paiement->numero_paiement,
            'boutique_id' => $paiement->boutique_id,
            'provider' => $provider,
        ]);

        return response()->json([
            'message' => 'Le prestataire n\'a pas répondu : l\'issue du paiement est inconnue. Vérifiez le statut avant de réessayer.',
            'issue_connue' => false,
            'data' => ['paiement' => $paiement->fresh()],
        ], 502);
    }

    /**
     * La violation vient-elle bien de l'index unique de clé d'idempotence ?
     *
     * Toute autre violation doit remonter telle quelle : la masquer
     * retournerait un « déjà initié » sur une erreur sans rapport, et le client
     * croirait son paiement lancé alors qu'aucun n'existe.
     */
    private function estViolationCleIdempotence(QueryException $e): bool
    {
        if (($e->errorInfo[0] ?? null) !== '23000' && ($e->errorInfo[0] ?? null) !== '23505') {
            return false;
        }

        $message = strtolower($e->getMessage());

        return str_contains($message, 'idempotency')
            || str_contains($message, 'paiements_boutique_idempotency_unique')
            || str_contains($message, 'unique constraint failed: paiements.boutique_id, paiements.idempotency_key');
    }

    /**
     * Retrouve le paiement d'une tentative déjà enregistrée, ou null.
     *
     * Deux barrières, parce que les clients n'envoient pas tous une clé :
     *
     *  1. clé d'idempotence — déterministe, sans fenêtre temporelle, garantie
     *     par l'index UNIQUE (boutique_id, idempotency_key). C'est la seule
     *     forme réellement fiable : elle vient de l'intention du client.
     *
     *  2. à défaut, ressemblance exacte et brutale dans une fenêtre courte. Un
     *     contenu identique ne prouve pas une même tentative — deux encaissements
     *     légitimes de 1 000 F CFA sur la même commande se ressemblent — donc
     *     la fenêtre est bornée et ne s'applique qu'aux paiements encore en
     *     attente, que le client n'a pas encore vus aboutir.
     *
     * Sans cela, un timeout ou un double-tap créait une seconde ligne et
     * déclenchait une seconde demande de débit : le client était débité deux
     * fois pour une seule commande.
     *
     * @param  array<string, mixed>  $validated
     */
    private function idempotentPayment(Request $request, array $validated, string $provider): ?Paiement
    {
        $boutiqueId = $request->user()->current_boutique_id;

        if (! empty($validated['idempotency_key'])) {
            return Paiement::where('boutique_id', $boutiqueId)
                ->where('idempotency_key', $validated['idempotency_key'])
                ->first();
        }

        return Paiement::where('boutique_id', $boutiqueId)
            ->where('user_id', $request->user()->id)
            ->where('commande_client_id', $validated['commande_client_id'] ?? null)
            ->where('montant', $validated['amount'])
            ->where('mode_paiement', 'mobile_money_'.$provider)
            ->where('telephone', $validated['phone_number'])
            ->where('statut', 'en_attente')
            ->where('created_at', '>=', now()->subSeconds(self::FENETRE_DOUBLON))
            ->latest('id')
            ->first();
    }

    /**
     * Vérifie le statut d'un paiement
     */
    public function checkStatus(Request $request, string $paymentId): JsonResponse
    {
        $paiement = Paiement::where('numero_paiement', $paymentId)
            ->where('boutique_id', $request->user()->current_boutique_id)
            ->first();

        if (! $paiement) {
            return response()->json(['message' => 'Paiement non trouvé'], 404);
        }

        // Sans référence, l'appel porterait sur « /payments/ » : le
        // prestataire renverrait autre chose qu'un paiement — typiquement une
        // liste, dont le premier élément serait lu comme le statut de CE
        // paiement. Une transition sur cette base est une creditation au
        // hasard.
        if (blank($paiement->reference_transaction)) {
            return response()->json([
                'message' => 'Paiement sans référence prestataire : statut non vérifiable',
            ], 409);
        }

        // Déterminer le fournisseur
        $provider = str_replace('mobile_money_', '', $paiement->mode_paiement);
        $this->mobileMoneyService = new MobileMoneyService($provider);

        // Vérifier le statut
        $result = $this->mobileMoneyService->checkPaymentStatus($paiement->reference_transaction);

        if ($result['success']) {
            $status = $result['data']['status'] ?? 'unknown';

            // Transition verrouillée et idempotente : montant_paye n'est
            // incrémenté qu'une seule fois, lors du passage en_attente → reussi.
            if (in_array($status, ['successful', 'completed'], true)) {
                $paiement = $this->applyTransition($paiement->numero_paiement, 'reussi') ?? $paiement->fresh();
            } elseif (in_array($status, ['failed', 'cancelled'], true)) {
                $paiement = $this->applyTransition($paiement->numero_paiement, 'echoue') ?? $paiement->fresh();
            }

            return response()->json([
                'message' => 'Statut du paiement récupéré',
                'data' => [
                    'paiement' => $paiement,
                    'status' => $result['data'],
                ],
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Callback pour les notifications de paiement.
     * Sécurisé par signature HMAC SHA-256 du corps brut (header X-SGCI-Signature)
     * lorsque MOBILE_MONEY_CALLBACK_SECRET est configuré.
     */
    public function callback(Request $request): JsonResponse
    {
        $secret = (string) config('services.mobile_money.callback_secret');

        if ($secret === '') {
            return response()->json(['message' => 'Callback non configuré — secret manquant'], 501);
        }

        $signature = $request->header('X-SGCI-Signature');
        $expected = hash_hmac('sha256', $request->getContent(), $secret);

        if (! is_string($signature) || ! hash_equals($expected, $signature)) {
            return response()->json(['message' => 'Signature invalide'], 401);
        }

        $transactionId = $request->input('transaction_id') ?? $request->input('payment_id');
        $status = $request->input('status');

        if (! $transactionId || ! is_string($status)
            || ! in_array($status, ['successful', 'completed', 'failed', 'cancelled'], true)) {
            return response()->json(['message' => 'Données invalides'], 400);
        }

        // Trouver le paiement correspondant
        $paiement = Paiement::where('reference_transaction', $transactionId)->first();

        if (! $paiement) {
            return response()->json(['message' => 'Paiement non trouvé'], 404);
        }

        // Transition idempotente : rejouer un callback ne ré-incrémente jamais
        // le montant payé de la commande.
        $nouveauStatut = in_array($status, ['successful', 'completed'], true) ? 'reussi' : 'echoue';
        $this->applyTransition($paiement->numero_paiement, $nouveauStatut);

        return response()->json(['message' => 'Callback traité avec succès']);
    }

    /**
     * Applique une transition de statut de manière atomique et idempotente :
     * seul un paiement encore "en_attente" peut changer d'état, et le montant
     * payé de la commande associée est incrémenté exactement une fois.
     */
    private function applyTransition(string $numeroPaiement, string $statut): ?Paiement
    {
        return DB::transaction(function () use ($numeroPaiement, $statut) {
            $paiement = Paiement::where('numero_paiement', $numeroPaiement)
                ->lockForUpdate()
                ->first();

            if (! $paiement || $paiement->statut !== 'en_attente') {
                return null;
            }

            $paiement->statut = $statut;

            if ($statut === 'reussi' && $paiement->commande_client_id) {
                // Défense en profondeur : même avec la règle de validation
                // scopée, une ligne Paiement incohérente (import, callback
                // antérieur) ne doit jamais créditer une commande d'un autre
                // tenant. whereKey() seul ne filtre rien.
                CommandeClient::whereKey($paiement->commande_client_id)
                    ->where('boutique_id', $paiement->boutique_id)
                    ->increment('montant_paye', $paiement->montant);
            }

            $paiement->save();

            return $paiement;
        });
    }

    /**
     * Annule un paiement
     */
    public function cancelPayment(Request $request, string $paymentId): JsonResponse
    {
        $paiement = Paiement::where('numero_paiement', $paymentId)
            ->where('boutique_id', $request->user()->current_boutique_id)
            ->first();

        if (! $paiement) {
            return response()->json(['message' => 'Paiement non trouvé'], 404);
        }

        if ($paiement->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seuls les paiements en attente peuvent être annulés',
            ], 400);
        }

        if (blank($paiement->reference_transaction)) {
            return response()->json([
                'message' => 'Paiement sans référence prestataire : annulation impossible',
            ], 409);
        }

        // Déterminer le fournisseur
        $provider = str_replace('mobile_money_', '', $paiement->mode_paiement);
        $this->mobileMoneyService = new MobileMoneyService($provider);

        // Annuler le paiement
        $result = $this->mobileMoneyService->cancelPayment($paiement->reference_transaction);

        if ($result['success']) {
            // L'appel fournisseur est lent : entre le contrôle ligne 243 et
            // cet écriture, un callback pouvait passer le paiement à « reussi »
            // et créditer montant_paye. Un simple update(['statut' => 'echoue'])
            // écrasait alors un paiement réussi sans reprendre le crédit.
            // applyTransition() revalide sous verrou ; en cas de conflit, la
            // commande a déjà été créditée et l'annulation doit être refusée.
            $transition = $this->applyTransition($paiement->numero_paiement, 'echoue');

            if ($transition === null) {
                return response()->json([
                    'message' => 'Le paiement a déjà été finalisé côté prestataire, annulation impossible',
                ], 409);
            }

            return response()->json([
                'message' => 'Paiement annulé avec succès',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Détecte le fournisseur d'un numéro de téléphone
     */
    public function detectProvider(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone_number' => 'required|string',
        ]);

        $provider = $this->mobileMoneyService->detectProvider($validated['phone_number']);

        return response()->json([
            'provider' => $provider,
            'phone_number' => $validated['phone_number'],
        ]);
    }
}
