<?php

namespace App\Http\Controllers\API;

use App\Events\VenteCreee;
use App\Exceptions\OperationRefusee;
use App\Http\Controllers\Concerns\TauxTva;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Http\Controllers\Controller;
use App\Models\BoutiqueSetting;
use App\Models\Client;
use App\Models\ClientFidelite;
use App\Models\LigneVente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\ProgrammeFidelite;
use App\Models\TransactionPoints;
use App\Models\Vente;
use App\Services\FacturePdfService;
use App\Traits\Auditable;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VenteController extends Controller
{
    use Auditable, TauxTva, VerifieBoutique;

    public function index(Request $request): JsonResponse
    {
        $query = Vente::with(['user', 'ligneVentes.produit', 'client']);

        // Filtre par boutique courante (multi-tenancy)
        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        if ($request->filled('date')) {
            $query->whereDate('created_at', $request->date);
        }

        if ($request->has('date_debut') && $request->date_debut) {
            $query->whereDate('created_at', '>=', $request->date_debut);
        }

        if ($request->has('date_fin') && $request->date_fin) {
            $query->whereDate('created_at', '<=', $request->date_fin);
        }

        if ($request->has('user_id') && $request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $ventes = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($ventes);
    }

    public function store(Request $request): JsonResponse
    {
        // Idempotence : une vente offline renvoyée après perte de réseau
        // ne doit jamais être créée deux fois (double décrément de stock)
        if ($key = $request->input('idempotency_key')) {
            $existante = Vente::where('boutique_id', $request->user()->current_boutique_id)
                ->where('idempotency_key', $key)
                ->first();

            if ($existante) {
                $existante->load(['user', 'ligneVentes.produit', 'client']);

                return response()->json($existante, 200);
            }
        }

        try {
            $validated = $this->validateVentePayload($request);
        } catch (ValidationException $e) {
            throw $e;
        }

        try {
            return DB::transaction(function () use ($validated, $request, $key) {
                $montantTotal = $this->calculerMontantTotal(
                    $validated['ligne_ventes'],
                    $validated['remise'] ?? 0,
                    $request->user()->current_boutique_id,
                );
                $tauxTva = $this->tauxTva($request->user()->current_boutique_id);

                $vente = Vente::create(array_merge(
                    $this->extraireChampsPaiement($validated, $montantTotal),
                    [
                        'user_id' => $request->user()->id,
                        'client_id' => $validated['client_id'] ?? null,
                        'remise' => $validated['remise'] ?? 0,
                        'notes' => $validated['notes'] ?? null,
                        'statut' => 'termine',
                        'montant_total' => $montantTotal,
                        'tva' => round($montantTotal * $tauxTva, 2),
                        'boutique_id' => $request->user()->current_boutique_id,
                        'idempotency_key' => $key,
                    ]
                ));

                $this->creerLignesEtMouvementsStock($vente, $validated['ligne_ventes'], $request->user()->id);

                if ($vente->client_id) {
                    $this->mettreAJourMetriquesClient($vente->client_id);
                    $this->synchroniserPointsFidelite($vente);
                }

                $vente->load(['user', 'ligneVentes.produit', 'client']);

                $this->auditCreate($vente);

                if ($vente->boutique_id) {
                    broadcast(new VenteCreee($vente, $vente->boutique_id));
                }

                return response()->json($vente, 201);
            });
        } catch (OperationRefusee $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function show(Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        $vente->load(['user', 'ligneVentes.produit', 'client']);

        return response()->json($vente);
    }

    public function update(Request $request, Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        if ($request->has('statut') && $request->statut === 'annule') {
            return $this->annuler($vente);
        }

        return response()->json(['message' => 'Action non autorisée'], 403);
    }

    public function destroy(Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        if ($vente->statut !== 'annule') {
            return response()->json([
                'message' => 'Annulez la vente avant suppression (POST /ventes/{id}/annuler).',
            ], 422);
        }

        $clientId = $vente->client_id;
        $this->auditDelete($vente);
        $vente->delete();

        if ($clientId) {
            $this->mettreAJourMetriquesClient($clientId);
        }

        return response()->json(['message' => 'Vente supprimée avec succès']);
    }

    public function checkout(Request $request): JsonResponse
    {
        $validated = $this->validateVentePayload($request, requirePaiement: false);
        $boutiqueId = $request->user()->current_boutique_id;

        try {
            return DB::transaction(function () use ($validated, $request, $boutiqueId) {
                $montantTotal = $this->calculerMontantTotal(
                    $validated['ligne_ventes'],
                    $validated['remise'] ?? 0,
                    $boutiqueId,
                );
                $tauxTva = $this->tauxTva($boutiqueId);

                $vente = Vente::create([
                    'user_id' => $request->user()->id,
                    'client_id' => $validated['client_id'] ?? null,
                    'remise' => $validated['remise'] ?? 0,
                    'notes' => $validated['notes'] ?? null,
                    'statut' => 'en_cours',
                    'montant_total' => $montantTotal,
                    'tva' => round($montantTotal * $tauxTva, 2),
                    'boutique_id' => $boutiqueId,
                ]);

                foreach ($validated['ligne_ventes'] as $ligne) {
                    $produit = $this->produitDeLAboutique($ligne['produit_id'], $boutiqueId);
                    if ($produit->quantite_stock < $ligne['quantite']) {
                        throw new OperationRefusee('Stock insuffisant pour le produit: '.$produit->nom);
                    }

                    LigneVente::create([
                        'vente_id' => $vente->id,
                        'produit_id' => $produit->id,
                        'quantite' => $ligne['quantite'],
                        'prix_unitaire' => $produit->prix,
                        'sous_total' => $produit->prix * $ligne['quantite'],
                    ]);
                }

                $vente->load(['user', 'ligneVentes.produit', 'client']);

                return response()->json($vente, 201);
            });
        } catch (OperationRefusee $e) {
            // 422 : la demande est cohérente mais l'état du stock l'empêche.
            // Sans ce catch, un stock insuffisant remonte une 500.
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function terminer(Request $request, Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        $validated = $request->validate([
            'mode_paiement' => ['nullable', Rule::in(['especes', 'mtn', 'moov', 'carte'])],
            'montant_recu' => 'nullable|numeric|min:0',
            'numero_transaction' => 'nullable|string|max:100',
            'reference_carte' => 'nullable|string|max:100',
            'banque' => 'nullable|string|max:100',
        ]);

        try {
            return DB::transaction(function () use ($vente, $validated, $request) {
                // Contrôle « en cours » SOUS VERROU, et non avant la transaction.
                //
                // Lu dehors, il laissait deux caisses terminer la même vente :
                // chacune le voyait à « en_cours », sortait le stock et encaissait
                // le paiement. Le verrou sur le produit ne l'empêchait pas — chaque
                // transaction relit quantite_stock et applique sa propre sortie.
                // Le verrou sur la vente est donc la seule exclusion mutuelle de
                // cette transition, et il la fait refuser en 409 au lieu d'écraser
                // une annulation concurrente (409 : l'état a changé entre-temps).
                $verrouillee = Vente::whereKey($vente->id)
                    ->where('boutique_id', $vente->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $verrouillee) {
                    return response()->json(['message' => 'Vente introuvable.'], 404);
                }

                if ($verrouillee->statut !== 'en_cours') {
                    return response()->json([
                        'message' => 'Seule une vente en cours peut être terminée.',
                    ], 409);
                }

                $vente = $verrouillee;
                $montantTotal = (float) $vente->montant_total;
                $paiement = $this->extraireChampsPaiement(
                    array_merge($validated, ['mode_paiement' => $validated['mode_paiement'] ?? 'especes']),
                    $montantTotal
                );
                $vente->update($paiement);

                foreach ($vente->ligneVentes as $ligne) {
                    // Re-lire le produit SOUS VERROU : évite le survente si deux
                    // caisses terminent des ventes sur le même stock simultanément.
                    // La contrainte boutique empêche de sortir le stock d'un autre tenant.
                    $produit = Produit::where('id', $ligne->produit_id)
                        ->where('boutique_id', $vente->boutique_id)
                        ->lockForUpdate()
                        ->first();

                    if (! $produit) {
                        // Ligne pointant hors tenant : on refuse plutôt que d'ignorer
                        // silencieusement, sinon la vente est encaissée sans sortie de stock.
                        throw new OperationRefusee('Produit indisponible: #'.$ligne->produit_id);
                    }

                    if ($produit->quantite_stock < $ligne->quantite) {
                        throw new OperationRefusee('Stock insuffisant pour: '.$produit->nom);
                    }

                    $quantiteAvant = $produit->quantite_stock;
                    $quantiteApres = $quantiteAvant - $ligne->quantite;
                    $produit->update(['quantite_stock' => $quantiteApres]);

                    MouvementStock::create([
                        'produit_id' => $produit->id,
                        'quantite' => $ligne->quantite,
                        'raison' => 'vente',
                        'type' => 'sortie',
                        'reference_bon' => (string) $vente->id,
                        'notes' => 'Sortie de stock pour vente #'.$vente->id,
                        'user_id' => $request->user()->id,
                        'statut' => 'accepte',
                        'quantite_avant' => $quantiteAvant,
                        'quantite_apres' => $quantiteApres,
                        'boutique_id' => $vente->boutique_id,
                    ]);
                }

                $vente->update(['statut' => 'termine']);

                if ($vente->client_id) {
                    $this->mettreAJourMetriquesClient($vente->client_id);
                    $this->synchroniserPointsFidelite($vente);
                }

                $vente->load(['user', 'ligneVentes.produit', 'client']);

                return response()->json($vente);
            });
        } catch (OperationRefusee $e) {
            // 422 : vente cohérente mais stock devenu insuffisant ou produit
            // retiré du tenant. Sans ce catch, la caisse voit une 500.
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function annuler(Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        // Aucun pré-contrôle « déjà annulée » ici, volontairement.
        //
        // Il était lu avant la transaction, donc hors verrou : deux requêtes
        // simultanées le voyaient toutes deux à « termine » et passaient toutes
        // les deux. Vente::annuler() relit désormais le statut sous verrou et
        // refuse en 409 ; ce contrôle fait doublon et, en plus, répondait 422
        // à un cas que le modèle classe 409 — deux codes pour la même
        // situation selon que la requête était séquentielle ou concurrente.
        // Le modèle est désormais l'unique autorité.
        $ancienStatut = $vente->statut;

        if ($vente->statut === 'termine') {
            // Même piège que le taux de TVA : BoutiqueSetting::current() est un
            // singleton sans boutique_id, donc le délai d'annulation était
            // celui du premier réglage créé, pour toutes les agences. La table
            // boutiques porte son propre délai en NOT NULL (défaut 5), on le
            // lit donc directement.
            $delai = $vente->boutique?->delai_annulation_vente_minutes
                ?? config('sgci.delai_annulation_vente_minutes', 5);

            if ($delai > 0 && $vente->created_at->diffInMinutes(now()) > $delai) {
                return response()->json([
                    'message' => "Délai d'annulation dépassé ({$delai} minutes).",
                ], 422);
            }

            // annuler() travaille sur une instance relue sous verrou et retourne
            // cette instance. Sans cette réaffectation, on sérialiserait
            // l'instance d'origine, toujours figée à « termine » : la base
            // était correcte mais la réponse HTTP et le journal d'audit
            // annonçaient une vente toujours terminée.
            $vente = $vente->annuler();

            if ($vente->client_id) {
                $this->mettreAJourMetriquesClient($vente->client_id);
                // Vente passée à « annule » par le modèle : les points de
                // l'achat sont repris ici (l'annulation d'une vente en cours,
                // jamais créditée, est un no-op).
                $this->synchroniserPointsFidelite($vente);
            }
        } else {
            // Une vente « en cours » n'a jamais décrémenté le stock : la
            // restitution n'a pas à être rejouée, un simple changement de
            // statut suffit.
            //
            // Mais ce chemin doit être protégé exactement comme terminer() : une
            // mise à jour nue, hors transaction et hors verrou, écrasait le
            // statut sans regarder ce qu'une opération concurrente venait
            // d'écrire. Si terminer() validait au même instant, la vente passait
            // de « termine » à « annule » APRÈS que le stock a été sorti : la
            // marchandise n'était jamais restituée, et le statut affirmait le
            // contraire. Sous verrou, « en_cours » est la seule valeur encore
            // compatible ; tout autre statut est un refus 409.
            $vente = DB::transaction(function () use ($vente) {
                $verrouillee = Vente::whereKey($vente->id)
                    ->where('boutique_id', $vente->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $verrouillee) {
                    throw new OperationRefusee('Vente introuvable.', 404);
                }

                if ($verrouillee->statut !== 'en_cours') {
                    throw new OperationRefusee(
                        $verrouillee->statut === 'annule'
                            ? Vente::MSG_DEJA_ANNULEE
                            : 'Vente déjà traitée entre-temps (statut : '.$verrouillee->statut.').',
                        409
                    );
                }

                $verrouillee->update(['statut' => 'annule']);

                return $verrouillee;
            });
        }

        $this->auditUpdate($vente, ['statut' => $ancienStatut]);

        $vente->load(['user', 'ligneVentes.produit', 'client']);

        return response()->json([
            'message' => 'Vente annulée',
            'vente' => $vente,
        ]);
    }

    public function statsVentesAujourdhui(): JsonResponse
    {
        $query = Vente::whereDate('created_at', today())->where('statut', 'termine');

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        $nombre = $query->count();
        $montant = (float) $query->sum('montant_total');

        return response()->json([
            'date' => today()->toDateString(),
            'nombre_ventes' => $nombre,
            'montant_total' => $montant,
            'montant_moyen' => $nombre > 0 ? round($montant / $nombre, 2) : 0,
        ]);
    }

    public function genererFacture(Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        $service = app(FacturePdfService::class);
        $vente->load(['user', 'ligneVentes.produit', 'client']);

        // L'identité imprimée sur la facture doit être celle de la boutique de
        // la vente. BoutiqueSetting::current() renvoyait les coordonnées d'une
        // boutique unique, donc toutes les factures portaient le même en-tête.
        // pourModele() est le point de résolution partagé avec FacturePdfService.
        $boutique = BoutiqueSetting::pourModele($vente);

        return response()->json([
            'boutique' => [
                'nom' => $boutique->nom,
                'adresse' => $boutique->adresse,
                'telephone' => $boutique->telephone,
                'email' => $boutique->email,
                'devise' => $boutique->devise,
            ],
            'numero_vente' => $vente->numero_vente,
            'date' => $vente->created_at,
            'statut' => $vente->statut,
            'caissier' => $vente->user?->name,
            'client' => $vente->client,
            'lignes' => $vente->ligneVentes,
            'montant_total' => $vente->montant_total,
            'tva' => $vente->tva,
            'remise' => $vente->remise,
            'notes' => $vente->notes,
            'mode_paiement' => $vente->mode_paiement,
            'montant_recu' => $vente->montant_recu,
            'monnaie_rendue' => $vente->monnaie_rendue,
            'numero_transaction' => $vente->numero_transaction,
            'reference_carte' => $vente->reference_carte,
            'banque' => $vente->banque,
            'html' => $service->html($vente),
            'pdf_url' => url("/api/ventes/{$vente->id}/facture/pdf"),
        ]);
    }

    public function genererFacturePdf(Vente $vente)
    {
        $this->verifierBoutiqueDe($vente);

        return app(FacturePdfService::class)->download($vente);
    }

    public function genererFactureHtml(Vente $vente)
    {
        $this->verifierBoutiqueDe($vente);

        $html = app(FacturePdfService::class)->html($vente);

        return response($html)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    public function statistiques(Request $request): JsonResponse
    {
        $query = Vente::where('statut', 'termine');

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        $caParJour = (clone $query)
            ->selectRaw('DATE(created_at) as date, SUM(montant_total) as total')
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->limit(30)
            ->get();

        $produitsPopulaires = LigneVente::with('produit')
            ->whereIn('vente_id', $query->pluck('id'))
            ->select('produit_id', DB::raw('SUM(quantite) as total_vendus'))
            ->groupBy('produit_id')
            ->orderBy('total_vendus', 'desc')
            ->limit(10)
            ->get();

        $caAujourdhui = (clone $query)
            ->whereDate('created_at', today())
            ->sum('montant_total');

        $caMois = (clone $query)
            ->whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->sum('montant_total');

        return response()->json([
            'ca_par_jour' => $caParJour,
            'produits_populaires' => $produitsPopulaires,
            'ca_aujourdhui' => $caAujourdhui,
            'ca_mois' => $caMois,
        ]);
    }

    private function validateVentePayload(Request $request, bool $requirePaiement = true): array
    {
        // Isolation multi-boutiques : les produits et le client cités doivent
        // appartenir à la boutique courante. Sans cette contrainte, un caissier
        // de la boutique B encaisse les produits de la boutique A et décrémente
        // son stock tout en estampillant la vente en boutique B.
        $boutiqueId = $request->user()->current_boutique_id;

        return $request->validate([
            'ligne_ventes' => 'required|array|min:1',
            'ligne_ventes.*.produit_id' => [
                'required',
                Rule::exists('produits', 'id')->where(fn ($q) => $q->where('boutique_id', $boutiqueId)),
            ],
            'ligne_ventes.*.quantite' => 'required|integer|min:1',
            'remise' => 'sometimes|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
            'client_id' => [
                'nullable',
                Rule::exists('clients', 'id')->where(fn ($q) => $q->where('boutique_id', $boutiqueId)),
            ],
            'mode_paiement' => ['nullable', Rule::in(['especes', 'mtn', 'moov', 'carte'])],
            'montant_recu' => 'nullable|numeric|min:0',
            'monnaie_rendue' => 'nullable|numeric|min:0',
            'numero_transaction' => 'nullable|string|max:100',
            'reference_carte' => 'nullable|string|max:100',
            'banque' => 'nullable|string|max:100',
        ]);
    }

    private function extraireChampsPaiement(array $validated, float $montantTotal): array
    {
        $mode = $validated['mode_paiement'] ?? 'especes';
        $montantRecu = isset($validated['montant_recu']) ? (float) $validated['montant_recu'] : null;
        $monnaieRendue = isset($validated['monnaie_rendue'])
            ? (float) $validated['monnaie_rendue']
            : null;

        if ($mode === 'especes' && $montantRecu !== null && $monnaieRendue === null) {
            $monnaieRendue = max(0, round($montantRecu - $montantTotal, 2));
        }

        return [
            'mode_paiement' => $mode,
            'montant_recu' => $montantRecu,
            'monnaie_rendue' => $monnaieRendue,
            'numero_transaction' => $validated['numero_transaction'] ?? null,
            'reference_carte' => $validated['reference_carte'] ?? null,
            'banque' => $validated['banque'] ?? null,
        ];
    }

    private function calculerMontantTotal(array $lignes, float $remise, ?int $boutiqueId = null): float
    {
        $montantTotal = 0;

        foreach ($lignes as $ligne) {
            $produit = $this->produitDeLAboutique($ligne['produit_id'], $boutiqueId);
            if ($produit->quantite_stock < $ligne['quantite']) {
                throw new OperationRefusee('Stock insuffisant pour le produit: '.$produit->nom);
            }
            $montantTotal += $produit->prix * $ligne['quantite'];
        }

        return max(0, $montantTotal - $remise);
    }

    /**
     * Charge un produit en refusant explicitement tout produit d'un autre
     * tenant. La validation de payload a déjà rejeté ces ids, mais on
     * re-vérifie ici car ces helpers sont appelés aussi hors du cycle
     * validé (batch offline) et la ligne pourrait venir d'un autre tenant.
     */
    private function produitDeLAboutique(int $produitId, ?int $boutiqueId): Produit
    {
        $produit = Produit::where('id', $produitId)
            ->where('boutique_id', $boutiqueId)
            ->first();

        if (! $produit) {
            throw new OperationRefusee('Produit indisponible: #'.$produitId);
        }

        return $produit;
    }

    private function creerLignesEtMouvementsStock(Vente $vente, array $lignes, int $userId): void
    {
        $boutiqueId = (int) $vente->boutique_id;

        foreach ($lignes as $ligne) {
            // Verrou pessimiste : sérialise les sorties de stock concurrentes
            $produit = Produit::where('id', $ligne['produit_id'])
                ->where('boutique_id', $boutiqueId)
                ->lockForUpdate()
                ->first();

            if (! $produit) {
                throw new OperationRefusee('Produit indisponible: #'.$ligne['produit_id']);
            }

            $prixUnitaire = $produit->prix;

            LigneVente::create([
                'vente_id' => $vente->id,
                'produit_id' => $ligne['produit_id'],
                'quantite' => $ligne['quantite'],
                'prix_unitaire' => $prixUnitaire,
                'sous_total' => $prixUnitaire * $ligne['quantite'],
            ]);

            $quantiteAvant = $produit->quantite_stock;
            $quantiteApres = $quantiteAvant - $ligne['quantite'];

            if ($quantiteApres < 0) {
                throw new OperationRefusee('Erreur stock pour: '.$produit->nom);
            }

            $produit->update(['quantite_stock' => $quantiteApres]);

            MouvementStock::create([
                'produit_id' => $produit->id,
                'quantite' => $ligne['quantite'],
                'raison' => 'vente',
                'type' => 'sortie',
                'reference_bon' => (string) $vente->id,
                'notes' => 'Sortie de stock pour vente #'.$vente->id,
                'user_id' => $userId,
                'statut' => 'accepte',
                'quantite_avant' => $quantiteAvant,
                'quantite_apres' => $quantiteApres,
                'boutique_id' => $vente->boutique_id,
            ]);
        }
    }

    private function mettreAJourMetriquesClient(int $clientId): void
    {
        try {
            $client = Client::find($clientId);

            if ($client) {
                $totalAchats = Vente::where('client_id', $clientId)
                    ->where('statut', 'termine')
                    ->sum('montant_total');

                $nombreCommandes = Vente::where('client_id', $clientId)
                    ->where('statut', 'termine')
                    ->count();

                $client->update([
                    'total_achats' => $totalAchats,
                    'nombre_commandes' => $nombreCommandes,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Mise à jour métriques client', [
                'client_id' => $clientId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Crédite les points fidélité d'une vente terminée, ou les reprend si elle
     * est annulée.
     *
     * Deux modes de calcul, choisis par le programme :
     *
     * - `points_par_100_fcfa > 0` : prorata du panier —
     *   `floor(montant_total × points_par_100_fcfa / 100)`, sur la base HT
     *   après remise. `points_par_achat` est alors ignoré. C'est le mode
     *   anti-farm : un achat de 50 FCFA ne rapporte rien, un panier de 150
     *   FCFA 1 point ;
     * - `points_par_100_fcfa = 0` (défaut, programmes existants) : ancien
     *   mode — montant fixe `points_par_achat` par achat, comportement
     *   inchangé.
     *
     * Un crédit à 0 point est ignoré (aucune transaction, aucun compte
     * créé) : pas de lignes vides dans l'historique.
     *
     * Deux propriétés font la sûreté du calcul :
     *
     * - idempotence par la vente : chaque transaction porte `vente_id`. Le
     *   crédit n'a lieu qu'au absence de transaction « gain » pour la vente, la
     *   reprise qu'en absence de « retrait ». Rejouer store/sync-offline ou
     *   terminer ne crédite donc jamais deux fois ;
     * - lecture sous verrou : `lockForUpdate()` sur la vente sérialise avec
     *   terminer()/annuler() (aussi exécutés sous verrou), le verrou sur le
     *   compte client empêche deux ventes simultanées d'incrémenter le même
     *   solde au même endroit.
     *
     * Transaction imbriquée (savepoint) volontaire : depuis store(),
     * terminer() ou syncOfflineBatch() on est déjà dans une transaction
     * englobante ; depuis annuler() — la transaction du modèle est close — il
     * faut en ouvrir une, sinon le verrou de la vente serait relâché en
     * autocommit à la fin du SELECT et ne sérialiserait rien.
     *
     * Jamais d'exception : une vente ne doit pas échouer pour un point de
     * fidélité (syncOfflineBatch() ferait échouer l'item de lot). Un échec est
     * journalisé, comme dans `mettreAJourMetriquesClient()`.
     */
    private function synchroniserPointsFidelite(Vente $vente): void
    {
        try {
            DB::transaction(function () use ($vente) {
                if (! $vente->client_id) {
                    return;
                }

                $verrouillee = Vente::whereKey($vente->id)->lockForUpdate()->first();

                if (! $verrouillee
                    || ! $verrouillee->client_id
                    || ! in_array($verrouillee->statut, ['termine', 'annule'], true)) {
                    return;
                }

                // Programmes de la seule boutique de la vente : le programme
                // d'une autre agence ne crédite pas un autre tenant.
                $programme = ProgrammeFidelite::where('boutique_id', $verrouillee->boutique_id)
                    ->where('actif', true)
                    ->first();

                if (! $programme) {
                    return;
                }

                $compte = ClientFidelite::where('programme_fidelite_id', $programme->id)
                    ->where('client_id', $verrouillee->client_id)
                    ->lockForUpdate()
                    ->first();

                $gain = TransactionPoints::where('vente_id', $verrouillee->id)
                    ->where('type', 'gain')
                    ->first();

                if ($verrouillee->statut === 'termine') {
                    if ($gain) {
                        return;
                    }

                    $points = (int) $programme->points_par_100_fcfa > 0
                        ? (int) floor(
                            ((float) $verrouillee->montant_total)
                            * (int) $programme->points_par_100_fcfa / 100
                        )
                        : (int) $programme->points_par_achat;

                    if ($points <= 0) {
                        return;
                    }

                    $compte ??= $this->inscrireAuProgrammeFidelite($programme, $verrouillee->client_id);

                    $compte->ajouterPoints(
                        $points,
                        'Achat vente #'.$verrouillee->id,
                        $verrouillee
                    );

                    return;
                }

                // Annulée : le client ne garde pas les points d'un achat
                // remboursé — sinon « acheter puis annuler » farme des points à
                // l'infini. On ne reprend que les points de CETTE vente.
                if (! $gain || ! $compte) {
                    return;
                }

                if (TransactionPoints::where('vente_id', $verrouillee->id)
                    ->where('type', 'retrait')
                    ->exists()) {
                    return;
                }

                // Le client a pu dépenser ses points entre le crédit et
                // l'annulation : retirerPoints() refuse un retrait supérieur au
                // solde, ce qui ferait échouer l'annulation pour un point déjà
                // consommé. On borne au solde disponible ; la transaction
                // enregistrée reflète ce qui a réellement été repris.
                $reprise = min($compte->points, (int) $gain->points);

                $compte->retirerPoints($reprise, 'Annulation vente #'.$verrouillee->id, $verrouillee);

                // Contrairement à ajouterPoints(), retirerPoints() ne recalcule
                // pas le niveau : sans cela le client resterait à son ancien
                // rang après avoir perdu les points qui le fondaient.
                $compte->mettreAJourNiveau();
            });
        } catch (\Exception $e) {
            Log::error('Points fidélité vente', [
                'vente_id' => $vente->id,
                'statut' => $vente->statut,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Inscrit au programme un client qui achète avant toute inscription
     * explicite : sans auto-inscription, seuls les clients déjà inscrits
     * accumuleraient des points et le crédit à l'achat resterait inopérant.
     */
    private function inscrireAuProgrammeFidelite(ProgrammeFidelite $programme, int $clientId): ClientFidelite
    {
        try {
            return ClientFidelite::create([
                'programme_fidelite_id' => $programme->id,
                'client_id' => $clientId,
                'points' => 0,
                'niveau_actuel' => 'Débutant',
                'date_inscription' => now(),
            ]);
        } catch (QueryException) {
            // Course possible : deux ventes simultanées d'un même client, la
            // contrainte unique (programme, client) a tranché. On relit le
            // compte que l'autre transaction vient de créer.
            return ClientFidelite::where('programme_fidelite_id', $programme->id)
                ->where('client_id', $clientId)
                ->lockForUpdate()
                ->firstOrFail();
        }
    }

    public function syncOfflineBatch(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $validated = $request->validate([
            'ventes' => 'required|array|min:1|max:100',
            'ventes.*.ligne_ventes' => 'required|array|min:1',
            'ventes.*.ligne_ventes.*.produit_id' => [
                'required',
                Rule::exists('produits', 'id')->where(fn ($q) => $q->where('boutique_id', $boutiqueId)),
            ],
            'ventes.*.ligne_ventes.*.quantite' => 'required|integer|min:1',
            'ventes.*.remise' => 'sometimes|numeric|min:0',
            'ventes.*.notes' => 'nullable|string|max:1000',
            'ventes.*.client_id' => [
                'nullable',
                Rule::exists('clients', 'id')->where(fn ($q) => $q->where('boutique_id', $boutiqueId)),
            ],
            'ventes.*.mode_paiement' => ['nullable', Rule::in(['especes', 'mtn', 'moov', 'carte'])],
            'ventes.*.montant_recu' => 'nullable|numeric|min:0',
            'ventes.*.numero_transaction' => 'nullable|string|max:100',
            'ventes.*.reference_carte' => 'nullable|string|max:100',
            'ventes.*.banque' => 'nullable|string|max:100',
            'ventes.*.created_at' => 'nullable|date',
            'ventes.*.idempotency_key' => 'nullable|string|max:100',
        ]);

        $results = [];
        $succes = 0;
        $echecs = 0;

        DB::beginTransaction();

        try {
            foreach ($validated['ventes'] as $index => $venteData) {
                // Savepoint par vente : si la ligne 3 échoue, les ventes 1 et 2
                // du lot restent valides et les écritures partielles de la
                // vente 3 (vente créée, stock déjà décrémenté) sont annulées.
                DB::beginTransaction();

                try {
                    // Rejeu d'une vente déjà synchronisée : si le client fournit
                    // une clé d'idempotence déjà enregistrée pour cette boutique,
                    // on renvoie la vente existante au lieu d'en créer une
                    // seconde. Sans cela, un rejeu réseau du même lot recréait
                    // des ventes « termine » et décrémentait le stock une
                    // nouvelle fois — la perte d'unités la plus silencieuse du
                    // mode hors-ligne.
                    $cleIdempotence = $venteData['idempotency_key'] ?? null;

                    if ($cleIdempotence) {
                        $existante = Vente::where('boutique_id', $boutiqueId)
                            ->where('idempotency_key', $cleIdempotence)
                            ->first();

                        if ($existante) {
                            $existante->load(['user', 'ligneVentes.produit', 'client']);

                            $results[] = [
                                'index' => $index,
                                'success' => true,
                                'vente' => $existante,
                                'idempotent' => true,
                            ];
                            $succes++;
                            DB::commit();

                            continue;
                        }
                    }

                    $montantTotal = $this->calculerMontantTotal(
                        $venteData['ligne_ventes'],
                        $venteData['remise'] ?? 0,
                        $boutiqueId,
                    );
                    $tauxTva = $this->tauxTva($boutiqueId);

                    $vente = Vente::create(array_merge(
                        $this->extraireChampsPaiement($venteData, $montantTotal),
                        [
                            'user_id' => $request->user()->id,
                            'client_id' => $venteData['client_id'] ?? null,
                            'remise' => $venteData['remise'] ?? 0,
                            'notes' => $venteData['notes'] ?? null,
                            'statut' => 'termine',
                            'montant_total' => $montantTotal,
                            'tva' => round($montantTotal * $tauxTva, 2),
                            'created_at' => $venteData['created_at'] ?? now(),
                            'boutique_id' => $request->user()->current_boutique_id,
                            'idempotency_key' => $cleIdempotence,
                        ]
                    ));

                    $this->creerLignesEtMouvementsStock($vente, $venteData['ligne_ventes'], $request->user()->id);

                    if ($vente->client_id) {
                        $this->mettreAJourMetriquesClient($vente->client_id);
                        $this->synchroniserPointsFidelite($vente);
                    }

                    $vente->load(['user', 'ligneVentes.produit', 'client']);

                    $results[] = [
                        'index' => $index,
                        'success' => true,
                        'vente' => $vente,
                    ];
                    $succes++;
                    DB::commit();
                } catch (\Exception $e) {
                    DB::rollBack();

                    $results[] = [
                        'index' => $index,
                        'success' => false,
                        'error' => $e->getMessage(),
                    ];
                    $echecs++;
                    Log::error('Sync offline batch erreur', [
                        'index' => $index,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => "Synchronisation terminée: {$succes} succès, {$echecs} échecs",
                'succes' => $succes,
                'echecs' => $echecs,
                'results' => $results,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Sync offline batch transaction erreur', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erreur lors de la synchronisation batch',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
