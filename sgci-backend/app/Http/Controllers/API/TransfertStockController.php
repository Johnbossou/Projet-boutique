<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Categorie;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\TransfertStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TransfertStockController extends Controller
{
    /**
     * Affiche la liste des transferts de stock
     */
    public function index(Request $request): JsonResponse
    {
        $query = TransfertStock::with(['boutiqueSource', 'boutiqueDestination', 'produit', 'userSource', 'userDestination']);

        // Filtre par boutique source
        if ($request->has('boutique_source_id') && $request->boutique_source_id) {
            $query->where('boutique_source_id', $request->boutique_source_id);
        }

        // Filtre par boutique destination
        if ($request->has('boutique_destination_id') && $request->boutique_destination_id) {
            $query->where('boutique_destination_id', $request->boutique_destination_id);
        }

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par boutique courante (source ou destination)
        if ($request->user()->current_boutique_id) {
            $query->where(function ($q) use ($request) {
                $q->where('boutique_source_id', $request->user()->current_boutique_id)
                    ->orWhere('boutique_destination_id', $request->user()->current_boutique_id);
            });
        }

        $transferts = $query->orderBy('date_transfert', 'desc')->paginate(15);

        return response()->json($transferts);
    }

    /**
     * Crée un nouveau transfert de stock
     */
    public function store(Request $request): JsonResponse
    {
        $boutiqueSourceId = $request->user()->current_boutique_id;

        // La destination doit être une boutique réellement accessible
        // (possession ou appartenance). Sans ce controle, un gérant pouvait
        // vider son stock vers un tenant choisi par devinette d'identifiant.
        $destinationsAutorisees = $request->user()->boutiquesAccessibles()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $validated = $request->validate([
            'boutique_destination_id' => [
                'required',
                Rule::exists('boutiques', 'id'),
                Rule::in($destinationsAutorisees),
            ],
            'produit_id' => [
                'required',
                Rule::exists('produits', 'id')->where('boutique_id', $boutiqueSourceId),
            ],
            'quantite' => 'required|integer|min:1',
            'motif' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ((int) $validated['boutique_destination_id'] === (int) $boutiqueSourceId) {
            return response()->json([
                'message' => 'La boutique de destination doit être différente de la source',
            ], 422);
        }

        $quantite = (int) $validated['quantite'];

        return DB::transaction(function () use ($request, $validated, $boutiqueSourceId, $quantite) {
            // Verrou sur la ligne produit : le contrôle de stock et le débit
            // doivent être atomiques, sinon deux transferts simultanés
            // lisaient la même quantité et le stock devenait négatif.
            $produit = Produit::where('id', $validated['produit_id'])
                ->where('boutique_id', $boutiqueSourceId)
                ->lockForUpdate()
                ->first();

            if (! $produit) {
                return response()->json([
                    'message' => 'Produit non trouvé dans la boutique source',
                ], 404);
            }

            $quantiteAvant = (int) $produit->quantite_stock;

            if ($quantiteAvant < $quantite) {
                return response()->json([
                    'message' => 'Stock insuffisant pour le transfert',
                ], 400);
            }

            $quantiteApres = $quantiteAvant - $quantite;
            $produit->update(['quantite_stock' => $quantiteApres]);

            $transfert = TransfertStock::create([
                'boutique_source_id' => $boutiqueSourceId,
                'boutique_destination_id' => $validated['boutique_destination_id'],
                'produit_id' => $validated['produit_id'],
                'quantite' => $quantite,
                'statut' => 'en_attente',
                'date_transfert' => now(),
                'motif' => $validated['motif'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_source_id' => $request->user()->id,
            ]);

            // Le débit doit laisser une trace : sans cette ligne, un écart
            // d'inventaire sur la boutique source est inexplicable.
            MouvementStock::create([
                'produit_id' => $produit->id,
                'boutique_id' => $boutiqueSourceId,
                'type' => 'sortie',
                'quantite' => $quantite,
                'raison' => 'transfert',
                'statut' => 'accepte',
                'reference_bon' => $transfert->numero_transfert,
                'user_id' => $request->user()->id,
                'notes' => 'Débit transfert vers boutique #'.$validated['boutique_destination_id'],
                'quantite_avant' => $quantiteAvant,
                'quantite_apres' => $quantiteApres,
            ]);

            return response()->json([
                'message' => 'Transfert de stock créé avec succès',
                'data' => $transfert->load(['boutiqueSource', 'boutiqueDestination', 'produit', 'userSource']),
            ], 201);
        });
    }

    /**
     * Affiche un transfert de stock spécifique
     */
    public function show(Request $request, TransfertStock $transfert): JsonResponse
    {
        // Vérifier que l'utilisateur a accès à ce transfert
        $boutiqueId = $request->user()->current_boutique_id;
        if ($transfert->boutique_source_id !== $boutiqueId && $transfert->boutique_destination_id !== $boutiqueId) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $transfert->load(['boutiqueSource', 'boutiqueDestination', 'produit', 'userSource', 'userDestination']);

        return response()->json($transfert);
    }

    /**
     * Annule un transfert de stock
     */
    public function annuler(Request $request, TransfertStock $transfert): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        if ($transfert->boutique_source_id !== $boutiqueId) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($request, $transfert, $boutiqueId) {
            // Le statut est revérifié sous verrou : tester peutEtreAnnule()
            // avant la transaction laissait deux annulations passer, et le
            // stock source était restitué deux fois.
            $verrouille = TransfertStock::where('id', $transfert->id)
                ->where('boutique_source_id', $boutiqueId)
                ->lockForUpdate()
                ->first();

            if (! $verrouille) {
                return response()->json(['message' => 'Non autorisé'], 403);
            }

            if (! $verrouille->peutEtreAnnule()) {
                return response()->json([
                    'message' => 'Ce transfert ne peut pas être annulé',
                ], 409);
            }

            // Produit scopé à la boutique source : un Produit::find() non scopé
            // pouvait créditer le stock d'un produit qui n'appartient plus à la
            // boutique débitée à la création.
            $produit = Produit::where('id', $verrouille->produit_id)
                ->where('boutique_id', $boutiqueId)
                ->lockForUpdate()
                ->first();

            if ($produit) {
                $quantiteAvant = (int) $produit->quantite_stock;
                $quantiteApres = $quantiteAvant + (int) $verrouille->quantite;

                $produit->update(['quantite_stock' => $quantiteApres]);

                MouvementStock::create([
                    'produit_id' => $produit->id,
                    'boutique_id' => $boutiqueId,
                    'type' => 'entree',
                    'quantite' => (int) $verrouille->quantite,
                    'raison' => 'transfert',
                    'statut' => 'accepte',
                    'reference_bon' => $verrouille->numero_transfert,
                    'user_id' => $request->user()->id,
                    'notes' => 'Restitution source, transfert #'.$verrouille->id.' annulé',
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                ]);
            }

            $verrouille->update(['statut' => 'annule']);

            return response()->json([
                'message' => 'Transfert annulé avec succès',
                'data' => $verrouille,
            ]);
        });
    }

    /**
     * Réceptionne un transfert de stock
     */
    public function recevoir(Request $request, TransfertStock $transfert): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;
        if ($transfert->boutique_destination_id !== $boutiqueId) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($request, $transfert, $boutiqueId) {
            // Statut revérifié sous verrou. Le contrôle hors transaction
            // permettait deux réceptions concurrentes du même transfert, et le
            // stock destination était crédité deux fois.
            $verrouille = TransfertStock::where('id', $transfert->id)
                ->where('boutique_destination_id', $boutiqueId)
                ->lockForUpdate()
                ->first();

            if (! $verrouille) {
                return response()->json(['message' => 'Non autorisé'], 403);
            }

            if (! in_array($verrouille->statut, ['en_attente', 'en_cours'], true)) {
                return response()->json([
                    'message' => 'Ce transfert ne peut pas être reçu',
                ], 409);
            }

            $produit = $this->trouverProduitDestination($verrouille, $boutiqueId);

            if (! $produit) {
                $produit = $this->creerProduitDestination($verrouille, $boutiqueId);
            }

            $quantiteAvant = (int) $produit->quantite_stock;
            $quantiteApres = $quantiteAvant + (int) $verrouille->quantite;
            $produit->update(['quantite_stock' => $quantiteApres]);

            MouvementStock::create([
                'produit_id' => $produit->id,
                'boutique_id' => $boutiqueId,
                'type' => 'entree',
                'quantite' => (int) $verrouille->quantite,
                'raison' => 'transfert',
                'statut' => 'accepte',
                'reference_bon' => $verrouille->numero_transfert,
                'user_id' => $request->user()->id,
                'notes' => 'Crédit transfert depuis boutique #'.$verrouille->boutique_source_id,
                'quantite_avant' => $quantiteAvant,
                'quantite_apres' => $quantiteApres,
            ]);

            $verrouille->update([
                'statut' => 'termine',
                'date_reception' => now(),
                'user_destination_id' => $request->user()->id,
            ]);

            return response()->json([
                'message' => 'Transfert reçu avec succès',
                'data' => $verrouille->load(['boutiqueSource', 'boutiqueDestination', 'produit', 'userDestination']),
            ]);
        });
    }

    /**
     * Retrouve le produit correspondant dans la boutique de destination.
     *
     * Chercher par l'identifiant du produit source ne peut jamais aboutir : les
     * identifiants sont uniques, donc un produit de la destination ne portera
     * jamais l'id du produit source. La recherche se fait donc sur l'identité
     * commerciale, d'abord le code QR (unique globalement, donc fiable), puis à
     * défaut le libellé exact.
     *
     * Sans cela, chaque réception créait un doublon de produit au lieu de
     * créditer l'existant, et le stock de la destination se répartissait entre
     * plusieurs lignes sans que l'écran puisse les réconcilier.
     */
    private function trouverProduitDestination(TransfertStock $transfert, int $boutiqueDestinationId): ?Produit
    {
        $source = Produit::find($transfert->produit_id);

        if (! $source) {
            return null;
        }

        $requete = Produit::where('boutique_id', $boutiqueDestinationId);

        if ($source->code_qr) {
            $parCode = (clone $requete)->where('code_qr', $source->code_qr)->lockForUpdate()->first();

            if ($parCode) {
                return $parCode;
            }
        }

        return (clone $requete)->where('nom', $source->nom)->lockForUpdate()->first();
    }

    /**
     * Duplique le produit source dans la boutique de destination.
     *
     * Deux écueils que la copie naïve franchissait :
     *  - code_qr est unique globalement. Le recopier levait une erreur de
     *    doublon, donc TOUT transfert vers une boutique qui n'a pas encore le
     *    produit échouait définitivement ;
     *  - categorie_id pointait vers la catégorie de la boutique source. Le
     *    nouveau produit référençait donc une catégorie d'un autre tenant, et
     *    la supprimer côté source le supprimait par cascade.
     *
     * La catégorie est donc retrouvée par son nom dans la destination, et
     * créée au besoin. Le code QR est laissé nul : la destination attribuera
     * le sien.
     */
    private function creerProduitDestination(TransfertStock $transfert, int $boutiqueDestinationId): Produit
    {
        $source = Produit::findOrFail($transfert->produit_id);

        $categorie = Categorie::where('boutique_id', $boutiqueDestinationId)
            ->where('nom', $source->categorie?->nom)
            ->first();

        if (! $categorie) {
            $categorie = Categorie::create([
                'nom' => ($source->categorie?->nom ?? 'Import').' (transfert)',
                'boutique_id' => $boutiqueDestinationId,
            ]);
        }

        return Produit::create([
            'nom' => $source->nom,
            'description' => $source->description,
            'prix' => $source->prix,
            'quantite_stock' => 0,
            'seuil_alerte' => $source->seuil_alerte,
            'categorie_id' => $categorie->id,
            'est_perissable' => $source->est_perissable,
            'code_qr' => null,
            'unite_mesure' => $source->unite_mesure,
            'image_url' => $source->image_url,
            'date_peremption' => $source->date_peremption,
            'date_fabrication' => $source->date_fabrication,
            'lot_numero' => $source->lot_numero,
            'duree_conservation_jours' => $source->duree_conservation_jours,
            'boutique_id' => $boutiqueDestinationId,
        ]);
    }

    /**
     * Statistiques des transferts
     */
    public function statistiques(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $totalTransferts = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
                ->orWhere('boutique_destination_id', $boutiqueId);
        })->count();

        $transfertsEnAttente = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
                ->orWhere('boutique_destination_id', $boutiqueId);
        })->enAttente()->count();

        $transfertsEnCours = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
                ->orWhere('boutique_destination_id', $boutiqueId);
        })->enCours()->count();

        $transfertsTermines = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
                ->orWhere('boutique_destination_id', $boutiqueId);
        })->termine()->count();

        return response()->json([
            'total_transferts' => $totalTransferts,
            'transferts_en_attente' => $transfertsEnAttente,
            'transferts_en_cours' => $transfertsEnCours,
            'transferts_termines' => $transfertsTermines,
        ]);
    }
}
