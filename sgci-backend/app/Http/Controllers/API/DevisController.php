<?php

namespace App\Http\Controllers\API;

use App\Exceptions\OperationRefusee;
use App\Http\Controllers\Concerns\TauxTva;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Http\Controllers\Controller;
use App\Models\CommandeClient;
use App\Models\Devis;
use App\Models\LigneCommandeClient;
use App\Models\LigneDevis;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DevisController extends Controller
{
    use TauxTva, VerifieBoutique;

    /**
     * Affiche la liste des devis de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        // commandeClient est chargée pour que le front sache si le devis a
        // déjà été converti : sans elle, le bouton « Convertir » reste affiché
        // après une conversion et renvoie un 409 au clic suivant.
        $query = Devis::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['client', 'user', 'lignes.produit', 'commandeClient']);

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par client
        if ($request->has('client_id') && $request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        // Filtre par date
        if ($request->has('date_debut') && $request->date_debut) {
            $query->where('date_devis', '>=', $request->date_debut);
        }
        if ($request->has('date_fin') && $request->date_fin) {
            $query->where('date_devis', '<=', $request->date_fin);
        }

        $devis = $query->orderBy('date_devis', 'desc')->paginate(15);

        return response()->json($devis);
    }

    /**
     * Crée un nouveau devis
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'date_validite' => 'nullable|date|after:today',
            'notes' => 'nullable|string',
            'lignes' => 'required|array|min:1',
            'lignes.*.produit_id' => 'required|exists:produits,id',
            'lignes.*.quantite' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
            'lignes.*.remise_pourcentage' => 'nullable|numeric|min:0|max:100',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $devis = Devis::create([
                'client_id' => $validated['client_id'],
                'boutique_id' => $request->user()->current_boutique_id,
                'date_devis' => now(),
                'date_validite' => $validated['date_validite'] ?? now()->addDays(30),
                'statut' => 'en_attente',
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()->id,
                'montant_total' => 0,
            ]);

            $montantTotal = 0;

            foreach ($validated['lignes'] as $ligneData) {
                $remise = $ligneData['remise_pourcentage'] ?? 0;
                $montantBase = $ligneData['quantite'] * $ligneData['prix_unitaire'];
                $montantLigne = $montantBase - ($montantBase * ($remise / 100));
                $montantTotal += $montantLigne;

                LigneDevis::create([
                    'devis_id' => $devis->id,
                    'produit_id' => $ligneData['produit_id'],
                    'quantite' => $ligneData['quantite'],
                    'prix_unitaire' => $ligneData['prix_unitaire'],
                    'remise_pourcentage' => $remise,
                    'montant_total' => $montantLigne,
                ]);
            }

            $devis->update(['montant_total' => $montantTotal]);

            return response()->json([
                'message' => 'Devis créé avec succès',
                'data' => $devis->load('client', 'lignes.produit'),
            ], 201);
        });
    }

    /**
     * Affiche un devis spécifique
     */
    public function show(Request $request, Devis $devis): JsonResponse
    {
        if ($devis->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $devis->load(['client', 'user', 'lignes.produit', 'commandeClient']);

        return response()->json($devis);
    }

    /**
     * Met à jour un devis
     */
    public function update(Request $request, Devis $devis): JsonResponse
    {
        if ($devis->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($devis->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seuls les devis en attente peuvent être modifiés',
            ], 400);
        }

        $validated = $request->validate([
            'date_validite' => 'nullable|date|after:today',
            'notes' => 'nullable|string',
        ]);

        $devis->update($validated);

        return response()->json([
            'message' => 'Devis mis à jour avec succès',
            'data' => $devis,
        ]);
    }

    /**
     * Accepte un devis
     */
    public function accepter(Request $request, Devis $devis): JsonResponse
    {
        if ($devis->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($devis->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seuls les devis en attente peuvent être acceptés',
            ], 400);
        }

        if ($devis->estExpire()) {
            return response()->json([
                'message' => 'Ce devis est expiré',
            ], 400);
        }

        $devis->update(['statut' => 'accepte']);

        return response()->json([
            'message' => 'Devis accepté avec succès',
            'data' => $devis,
        ]);
    }

    /**
     * Refuse un devis
     */
    public function refuser(Request $request, Devis $devis): JsonResponse
    {
        if ($devis->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($devis->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seuls les devis en attente peuvent être refusés',
            ], 400);
        }

        $devis->update(['statut' => 'refuse']);

        return response()->json([
            'message' => 'Devis refusé avec succès',
            'data' => $devis,
        ]);
    }

    /**
     * Convertit un devis en commande client
     */
    public function convertirEnCommande(Request $request, Devis $devis): JsonResponse
    {
        if ($devis->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Le verrou et le re-contrôle sont DANS la transaction : vérifier
        // peutEtreConverti() avant ouvrait une course — deux double-clics
        // passaient tous deux le contrôle et créaient deux commandes depuis
        // le même devis.
        try {
            return DB::transaction(function () use ($request, $devis) {
                $devis = Devis::whereKey($devis->id)->lockForUpdate()->firstOrFail();

                if (! $devis->peutEtreConverti()) {
                    throw new OperationRefusee('Ce devis ne peut pas être converti en commande', 409);
                }

                // Le devis reste une offre en base HT (le devis affiche le
                // total tel quel, comme la caisse affiche un sous-total) ;
                // la commande, elle, applique le taux boutique au moment de
                // la conversion — un devis accepté paie HT + TVA, au même
                // régime que la caisse.
                $commande = CommandeClient::create([
                    'client_id' => $devis->client_id,
                    'boutique_id' => $devis->boutique_id,
                    'devis_id' => $devis->id,
                    'date_commande' => now(),
                    'statut' => 'en_attente',
                    'montant_total' => $devis->montant_total,
                    'tva' => round((float) $devis->montant_total * $this->tauxTva($devis->boutique_id), 2),
                    'montant_paye' => 0,
                    'user_id' => $request->user()->id,
                ]);

                foreach ($devis->lignes as $ligneDevis) {
                    LigneCommandeClient::create([
                        'commande_client_id' => $commande->id,
                        'produit_id' => $ligneDevis->produit_id,
                        'quantite' => $ligneDevis->quantite,
                        'prix_unitaire' => $ligneDevis->prix_unitaire,
                        'remise_pourcentage' => $ligneDevis->remise_pourcentage,
                        'montant_total' => $ligneDevis->montant_total,
                    ]);
                }

                return response()->json([
                    'message' => 'Devis converti en commande avec succès',
                    'data' => $commande->load('client', 'lignes.produit'),
                ], 201);
            }, 3);
        } catch (OperationRefusee $e) {
            // Laisse un 409 explicite plutôt qu'un 400 : la conversion est
            // déjà faite, c'est un conflit d'état, pas une requête invalide.
            return response()->json(['message' => $e->getMessage()], $e->statutHttp());
        }
    }

    /**
     * Génère le PDF d'un devis
     */
    public function pdf(Request $request, Devis $devis): Response
    {
        $this->verifierBoutiqueDe($devis);

        $devis->load(['client', 'user', 'lignes.produit', 'boutique']);

        $pdf = Pdf::loadView('devis.template', [
            'devis' => $devis,
            'boutique' => $devis->boutique,
        ]);

        $filename = 'devis/'.$devis->numero_devis.'.pdf';
        Storage::disk('public')->put($filename, $pdf->output());

        return $pdf->download($devis->numero_devis.'.pdf');
    }
}
