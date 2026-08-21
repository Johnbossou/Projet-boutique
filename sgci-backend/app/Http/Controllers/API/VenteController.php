<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Services\FacturePdfService;
use App\Models\BoutiqueSetting;
use App\Models\Client;
use App\Models\LigneVente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\Vente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class VenteController extends Controller
{
    use VerifieBoutique;

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
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        }

        try {
            return DB::transaction(function () use ($validated, $request, $key) {
                $montantTotal = $this->calculerMontantTotal($validated['ligne_ventes'], $validated['remise'] ?? 0);
                $tauxTva = $this->tauxTva();

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
                }

                $vente->load(['user', 'ligneVentes.produit', 'client']);

                return response()->json($vente, 201);
            });
        } catch (\RuntimeException $e) {
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

        return response()->json(['message' => 'Action non autorisÃ©e'], 403);
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
        $vente->delete();

        if ($clientId) {
            $this->mettreAJourMetriquesClient($clientId);
        }

        return response()->json(['message' => 'Vente supprimÃ©e avec succÃ¨s']);
    }

    public function checkout(Request $request): JsonResponse
    {
        $validated = $this->validateVentePayload($request, requirePaiement: false);

        return DB::transaction(function () use ($validated, $request) {
            $montantTotal = $this->calculerMontantTotal($validated['ligne_ventes'], $validated['remise'] ?? 0);
            $tauxTva = $this->tauxTva();

            $vente = Vente::create([
                'user_id' => $request->user()->id,
                'client_id' => $validated['client_id'] ?? null,
                'remise' => $validated['remise'] ?? 0,
                'notes' => $validated['notes'] ?? null,
                'statut' => 'en_cours',
                'montant_total' => $montantTotal,
                'tva' => round($montantTotal * $tauxTva, 2),
                'boutique_id' => $request->user()->current_boutique_id,
            ]);

            foreach ($validated['ligne_ventes'] as $ligne) {
                $produit = Produit::findOrFail($ligne['produit_id']);
                if ($produit->quantite_stock < $ligne['quantite']) {
                    throw new \RuntimeException('Stock insuffisant pour le produit: ' . $produit->nom);
                }

                LigneVente::create([
                    'vente_id' => $vente->id,
                    'produit_id' => $ligne['produit_id'],
                    'quantite' => $ligne['quantite'],
                    'prix_unitaire' => $produit->prix,
                    'sous_total' => $produit->prix * $ligne['quantite'],
                ]);
            }

            $vente->load(['user', 'ligneVentes.produit', 'client']);

            return response()->json($vente, 201);
        });
    }

    public function terminer(Request $request, Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        if ($vente->statut !== 'en_cours') {
            return response()->json(['message' => 'Seule une vente en cours peut Ãªtre terminÃ©e.'], 422);
        }

        $validated = $request->validate([
            'mode_paiement' => ['nullable', Rule::in(['especes', 'mtn', 'moov', 'carte'])],
            'montant_recu' => 'nullable|numeric|min:0',
            'numero_transaction' => 'nullable|string|max:100',
            'reference_carte' => 'nullable|string|max:100',
            'banque' => 'nullable|string|max:100',
        ]);

        return DB::transaction(function () use ($vente, $validated, $request) {
            $montantTotal = (float) $vente->montant_total;
            $paiement = $this->extraireChampsPaiement(
                array_merge($validated, ['mode_paiement' => $validated['mode_paiement'] ?? 'especes']),
                $montantTotal
            );
            $vente->update($paiement);

            foreach ($vente->ligneVentes as $ligne) {
                // Re-lire le produit SOUS VERROU : évite le survente si deux
                // caisses terminent des ventes sur le même stock simultanément.
                $produit = Produit::whereKey($ligne->produit_id)->lockForUpdate()->first();

                if (!$produit) {
                    continue;
                }

                if ($produit->quantite_stock < $ligne->quantite) {
                    throw new \RuntimeException('Stock insuffisant pour: ' . $produit->nom);
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
                    'notes' => 'Sortie de stock pour vente #' . $vente->id,
                    'user_id' => $request->user()->id,
                    'statut' => 'acceptÃ©',
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                    'boutique_id' => $vente->boutique_id,
                ]);
            }

            $vente->update(['statut' => 'termine']);

            if ($vente->client_id) {
                $this->mettreAJourMetriquesClient($vente->client_id);
            }

            $vente->load(['user', 'ligneVentes.produit', 'client']);

            return response()->json($vente);
        });
    }

    public function annuler(Vente $vente): JsonResponse
    {
        $this->verifierBoutiqueDe($vente);

        if ($vente->statut === 'annule') {
            return response()->json(['message' => 'Cette vente est dÃ©jÃ  annulÃ©e.'], 422);
        }

        if ($vente->statut === 'termine') {
            $delai = BoutiqueSetting::current()->delai_annulation_vente_minutes
                ?? config('sgci.delai_annulation_vente_minutes', 5);

            if ($delai > 0 && $vente->created_at->diffInMinutes(now()) > $delai) {
                return response()->json([
                    'message' => "DÃ©lai d'annulation dÃ©passÃ© ({$delai} minutes).",
                ], 422);
            }

            $vente->annuler();

            if ($vente->client_id) {
                $this->mettreAJourMetriquesClient($vente->client_id);
            }
        } else {
            $vente->update(['statut' => 'annule']);
        }

        $vente->load(['user', 'ligneVentes.produit', 'client']);

        return response()->json([
            'message' => 'Vente annulÃ©e',
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
        $boutique = BoutiqueSetting::current();

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
        return $request->validate(array_merge([
            'ligne_ventes' => 'required|array|min:1',
            'ligne_ventes.*.produit_id' => 'required|exists:produits,id',
            'ligne_ventes.*.quantite' => 'required|integer|min:1',
            'remise' => 'sometimes|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
            'client_id' => 'nullable|exists:clients,id',
            'mode_paiement' => ['nullable', Rule::in(['especes', 'mtn', 'moov', 'carte'])],
            'montant_recu' => 'nullable|numeric|min:0',
            'monnaie_rendue' => 'nullable|numeric|min:0',
            'numero_transaction' => 'nullable|string|max:100',
            'reference_carte' => 'nullable|string|max:100',
            'banque' => 'nullable|string|max:100',
        ], $requirePaiement ? [] : []));
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

    private function calculerMontantTotal(array $lignes, float $remise): float
    {
        $montantTotal = 0;

        foreach ($lignes as $ligne) {
            $produit = Produit::findOrFail($ligne['produit_id']);
            if ($produit->quantite_stock < $ligne['quantite']) {
                throw new \RuntimeException('Stock insuffisant pour le produit: ' . $produit->nom);
            }
            $montantTotal += $produit->prix * $ligne['quantite'];
        }

        return max(0, $montantTotal - $remise);
    }

    private function creerLignesEtMouvementsStock(Vente $vente, array $lignes, int $userId): void
    {
        foreach ($lignes as $ligne) {
            // Verrou pessimiste : sérialise les sorties de stock concurrentes
            $produit = Produit::whereKey($ligne['produit_id'])->lockForUpdate()->firstOrFail();
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
                throw new \RuntimeException('Erreur stock pour: ' . $produit->nom);
            }

            $produit->update(['quantite_stock' => $quantiteApres]);

            MouvementStock::create([
                'produit_id' => $produit->id,
                'quantite' => $ligne['quantite'],
                'raison' => 'vente',
                'type' => 'sortie',
                'reference_bon' => (string) $vente->id,
                'notes' => 'Sortie de stock pour vente #' . $vente->id,
                'user_id' => $userId,
                'statut' => 'acceptÃ©',
                'quantite_avant' => $quantiteAvant,
                'quantite_apres' => $quantiteApres,
                'boutique_id' => $vente->boutique_id,
            ]);
        }
    }

    private function tauxTva(): float
    {
        $settings = BoutiqueSetting::current();
        $taux = $settings->taux_tva ?? 18;

        return $taux > 1 ? $taux / 100 : (float) $taux;
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
            Log::error('Mise Ã  jour mÃ©triques client', [
                'client_id' => $clientId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function syncOfflineBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ventes' => 'required|array|min:1|max:100',
            'ventes.*.ligne_ventes' => 'required|array|min:1',
            'ventes.*.ligne_ventes.*.produit_id' => 'required|exists:produits,id',
            'ventes.*.ligne_ventes.*.quantite' => 'required|integer|min:1',
            'ventes.*.remise' => 'sometimes|numeric|min:0',
            'ventes.*.notes' => 'nullable|string|max:1000',
            'ventes.*.client_id' => 'nullable|exists:clients,id',
            'ventes.*.mode_paiement' => ['nullable', Rule::in(['especes', 'mtn', 'moov', 'carte'])],
            'ventes.*.montant_recu' => 'nullable|numeric|min:0',
            'ventes.*.numero_transaction' => 'nullable|string|max:100',
            'ventes.*.reference_carte' => 'nullable|string|max:100',
            'ventes.*.banque' => 'nullable|string|max:100',
            'ventes.*.created_at' => 'nullable|date',
        ]);

        $results = [];
        $succes = 0;
        $echecs = 0;

        DB::beginTransaction();

        try {
            foreach ($validated['ventes'] as $index => $venteData) {
                try {
                    $montantTotal = $this->calculerMontantTotal($venteData['ligne_ventes'], $venteData['remise'] ?? 0);
                    $tauxTva = $this->tauxTva();

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
                        ]
                    ));

                    $this->creerLignesEtMouvementsStock($vente, $venteData['ligne_ventes'], $request->user()->id);

                    if ($vente->client_id) {
                        $this->mettreAJourMetriquesClient($vente->client_id);
                    }

                    $vente->load(['user', 'ligneVentes.produit', 'client']);

                    $results[] = [
                        'index' => $index,
                        'success' => true,
                        'vente' => $vente,
                    ];
                    $succes++;
                } catch (\Exception $e) {
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
                'message' => "Synchronisation terminÃ©e: {$succes} succÃ¨s, {$echecs} Ã©checs",
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
