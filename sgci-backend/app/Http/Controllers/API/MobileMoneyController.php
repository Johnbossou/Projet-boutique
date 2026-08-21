<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\MobileMoneyService;
use App\Models\Paiement;
use App\Models\CommandeClient;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MobileMoneyController extends Controller
{
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
            'commande_client_id' => 'nullable|exists:commande_clients,id',
        ]);

        // Valider le numéro de téléphone
        if (!$this->mobileMoneyService->validatePhoneNumber($validated['phone_number'])) {
            return response()->json([
                'message' => 'Numéro de téléphone invalide',
            ], 400);
        }

        // Déterminer le fournisseur si non spécifié
        $provider = $validated['provider'] ?? $this->mobileMoneyService->detectProvider($validated['phone_number']);
        
        if (!$provider) {
            return response()->json([
                'message' => 'Impossible de déterminer le fournisseur Mobile Money',
            ], 400);
        }

        // Mettre à jour le service avec le bon fournisseur
        $this->mobileMoneyService = new MobileMoneyService($provider);

        // Créer un enregistrement de paiement
        $paiement = Paiement::create([
            'commande_client_id' => $validated['commande_client_id'] ?? null,
            'boutique_id' => $request->user()->current_boutique_id,
            'montant' => $validated['amount'],
            'mode_paiement' => 'mobile_money_' . $provider,
            'date_paiement' => now(),
            'statut' => 'en_attente',
            'user_id' => $request->user()->id,
        ]);

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
            // Mettre à jour le paiement avec la référence de transaction
            $paiement->update([
                'reference_transaction' => $result['data']['transaction_id'] ?? $result['data']['payment_id'] ?? null,
            ]);

            return response()->json([
                'message' => 'Paiement initié avec succès',
                'data' => [
                    'paiement' => $paiement,
                    'transaction' => $result['data'],
                ],
            ]);
        }

        // Marquer le paiement comme échoué
        $paiement->update(['statut' => 'echoue']);

        return response()->json([
            'message' => $result['message'],
            'error' => $result['error'] ?? null,
        ], 400);
    }

    /**
     * Vérifie le statut d'un paiement
     */
    public function checkStatus(Request $request, string $paymentId): JsonResponse
    {
        $paiement = Paiement::where('numero_paiement', $paymentId)
            ->where('boutique_id', $request->user()->current_boutique_id)
            ->first();

        if (!$paiement) {
            return response()->json(['message' => 'Paiement non trouvé'], 404);
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

        if ($secret !== '') {
            $signature = $request->header('X-SGCI-Signature');
            $expected = hash_hmac('sha256', $request->getContent(), $secret);

            if (!is_string($signature) || !hash_equals($expected, $signature)) {
                return response()->json(['message' => 'Signature invalide'], 401);
            }
        }

        $transactionId = $request->input('transaction_id') ?? $request->input('payment_id');
        $status = $request->input('status');

        if (!$transactionId || !is_string($status)
            || !in_array($status, ['successful', 'completed', 'failed', 'cancelled'], true)) {
            return response()->json(['message' => 'Données invalides'], 400);
        }

        // Trouver le paiement correspondant
        $paiement = Paiement::where('reference_transaction', $transactionId)->first();

        if (!$paiement) {
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

            if (!$paiement || $paiement->statut !== 'en_attente') {
                return null;
            }

            $paiement->statut = $statut;

            if ($statut === 'reussi' && $paiement->commande_client_id) {
                CommandeClient::whereKey($paiement->commande_client_id)
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

        if (!$paiement) {
            return response()->json(['message' => 'Paiement non trouvé'], 404);
        }

        if ($paiement->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seuls les paiements en attente peuvent être annulés',
            ], 400);
        }

        // Déterminer le fournisseur
        $provider = str_replace('mobile_money_', '', $paiement->mode_paiement);
        $this->mobileMoneyService = new MobileMoneyService($provider);

        // Annuler le paiement
        $result = $this->mobileMoneyService->cancelPayment($paiement->reference_transaction);

        if ($result['success']) {
            $paiement->update(['statut' => 'echoue']);

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
