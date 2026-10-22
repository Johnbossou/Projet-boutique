<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Concerns\TauxTva;
use App\Http\Controllers\Controller;
use App\Models\CommandeClient;
use App\Models\LigneCommandeClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommandeClientController extends Controller
{
    use TauxTva;

    /**
     * Affiche la liste des commandes clients de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = CommandeClient::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['client', 'devis', 'user', 'lignes.produit', 'paiements']);

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
            $query->where('date_commande', '>=', $request->date_debut);
        }
        if ($request->has('date_fin') && $request->date_fin) {
            $query->where('date_commande', '<=', $request->date_fin);
        }

        $commandes = $query->orderBy('date_commande', 'desc')->paginate(15);

        return response()->json($commandes);
    }

    /**
     * Crée une nouvelle commande client
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'devis_id' => 'nullable|exists:devis,id',
            'date_livraison_prevue' => 'nullable|date',
            'mode_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
            'lignes' => 'required|array|min:1',
            'lignes.*.produit_id' => 'required|exists:produits,id',
            'lignes.*.quantite' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
            'lignes.*.remise_pourcentage' => 'nullable|numeric|min:0|max:100',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $commande = CommandeClient::create([
                'client_id' => $validated['client_id'],
                'boutique_id' => $request->user()->current_boutique_id,
                'devis_id' => $validated['devis_id'] ?? null,
                'date_commande' => now(),
                'date_livraison_prevue' => $validated['date_livraison_prevue'] ?? null,
                'statut' => 'en_attente',
                'mode_paiement' => $validated['mode_paiement'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()->id,
                'montant_total' => 0,
                'montant_paye' => 0,
            ]);

            $montantTotal = 0;

            foreach ($validated['lignes'] as $ligneData) {
                $remise = $ligneData['remise_pourcentage'] ?? 0;
                $montantBase = $ligneData['quantite'] * $ligneData['prix_unitaire'];
                $montantLigne = $montantBase - ($montantBase * ($remise / 100));
                $montantTotal += $montantLigne;

                LigneCommandeClient::create([
                    'commande_client_id' => $commande->id,
                    'produit_id' => $ligneData['produit_id'],
                    'quantite' => $ligneData['quantite'],
                    'prix_unitaire' => $ligneData['prix_unitaire'],
                    'remise_pourcentage' => $remise,
                    'montant_total' => $montantLigne,
                ]);
            }

            // Même invariant que la caisse : montant_total reste la base HT
            // (somme des lignes après remise) et la TVA du taux boutique
            // s'ajoute par-dessus — le client paie montant_a_payer =
            // HT + TVA. Sans cette ligne, le même produit était taxé à 18 %
            // à la caisse et à 0 % en commande : les clients contournaient la
            // TVA en commandant, et la boutique sous-encaissait une TVA
            // qu'elle devait pourtant reverser.
            $commande->update([
                'montant_total' => $montantTotal,
                'tva' => round($montantTotal * $this->tauxTva($request->user()->current_boutique_id), 2),
            ]);

            return response()->json([
                'message' => 'Commande client créée avec succès',
                'data' => $commande->load('client', 'lignes.produit'),
            ], 201);
        });
    }

    /**
     * Affiche une commande client spécifique
     */
    public function show(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commande->load(['client', 'devis', 'user', 'lignes.produit', 'paiements']);

        return response()->json($commande);
    }

    /**
     * Met à jour une commande client
     */
    public function update(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'date_livraison_prevue' => 'nullable|date',
            'mode_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($commande, $validated) {
            $verrouillee = $this->commande_verrouillee($commande);

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable'], 404);
            }

            if ($verrouillee->statut !== 'en_attente') {
                return $this->dejaTraitee($verrouillee, 'modifiée');
            }

            $verrouillee->update($validated);

            return response()->json([
                'message' => 'Commande mise à jour avec succès',
                'data' => $verrouillee,
            ]);
        });
    }

    /**
     * Valide une commande client
     */
    public function valider(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($commande) {
            $verrouillee = $this->commande_verrouillee($commande);

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable'], 404);
            }

            if ($verrouillee->statut !== 'en_attente') {
                return $this->dejaTraitee($verrouillee, 'validée');
            }

            $verrouillee->update(['statut' => 'en_cours']);

            return response()->json([
                'message' => 'Commande validée avec succès',
                'data' => $verrouillee,
            ]);
        });
    }

    /**
     * Annule une commande client
     *
     * Le statut est relu sous verrou, et non sur l'instance liee a la route.
     * Deux annulations simultanees lisaient toutes deux « en_cours » sur
     * cette instance, passaient le controle, puis ecrivaient « annule » deux
     * fois : les deux repondaient 200 sans qu'aucune trace ne distingue la
     * seconde d'un double clic.
     *
     * Concretement, sur une commande dont le paiement MobileMoney vient d'etre
     * credite : le statut devenait « annule » pendant que montant_paye
     * restait a son montant. La boutique annulait une commande deja payee, et
     * l'argent encaisse ne l etait ni rapporte ni trace comme tel.
     */
    public function annuler(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $resultat = DB::transaction(function () use ($commande) {
            $verrouillee = $this->commande_verrouillee($commande);

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable'], 404);
            }

            if (! in_array($verrouillee->statut, ['en_attente', 'en_cours'], true)) {
                return $this->dejaTraitee($verrouillee, 'annulée');
            }

            // Un montant encaisse sur une commande qu'on annule doit etre
            // signale : l'argent reste chez la boutique, mais il ne peut plus
            // disparaitre dans un statut « annule » sans trace. Le rembordement
            // effectif reste une decision metier — voir la note sur les
            // commandes clients dans AMELIORATIONS_ET_MANQUANTS.md — mais le
            // silence ne peut plus etre l'etat par defaut.
            $encaisse = (float) $verrouillee->montant_paye;

            $verrouillee->update(['statut' => 'annule']);

            return response()->json([
                'message' => $encaisse > 0
                    ? 'Commande annulée. Attention : '.$encaisse.' ont déjà été encaissés et n’ont pas été remboursés.'
                    : 'Commande annulée avec succès',
                'data' => $verrouillee->fresh(),
                'montant_paye' => $encaisse,
            ]);
        });

        return $resultat;
    }

    /**
     * Marque une commande comme livrée
     */
    public function livrer(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($commande) {
            $verrouillee = $this->commande_verrouillee($commande);

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable'], 404);
            }

            if ($verrouillee->statut !== 'en_cours') {
                return $this->dejaTraitee($verrouillee, 'livrée');
            }

            $verrouillee->update([
                'statut' => 'livre',
                'date_livraison_reelle' => now(),
            ]);

            return response()->json([
                'message' => 'Commande livrée avec succès',
                'data' => $verrouillee,
            ]);
        });
    }

    /**
     * Relit la commande sous verrou exclusive dans la transaction courante.
     *
     * Les quatre transitions de ce controleur passent par la : elles avaient
     * toutes le meme defaut, et c'est ce qui justifie un seul point d'entree
     * plutot que quatre relectures recopiees. L'instance liee a la route a ete
     * lue au routage, avant que l'autre requete n'ait ecrit : son statut n'est
     * plus le statut de la base. Verifier ce statut perime, puis ecrire, c'est
     * laisser deux operations opposées reussir ensemble.
     *
     * L'ordre de verrou est le meme partout (mouvement, produit, commande) :
     * deux transactions qui prennent les memes lignes dans des ordres
     * opposes s'attendent jusqu'a l'expiration du delai InnoDB.
     */
    private function commande_verrouillee(CommandeClient $commande): ?CommandeClient
    {
        return CommandeClient::whereKey($commande->id)
            ->where('boutique_id', $commande->boutique_id)
            ->lockForUpdate()
            ->first();
    }

    /**
     * Refus commun quand le statut relu n'autorise plus l'operation demandee.
     *
     * 409 et non 400 : la commande existe, elle n'est simplement plus dans un
     * etat compatible. La distinction 409 / 400 est ce qui permet au client de
     * dire « traite entre-temps » plutot que « erreur de parametre » — et c'est
     * aussi ce qui rend une double operation concurrente detectable au lieu
     * d'etre silencieusement acceptee.
     */
    private function dejaTraitee(CommandeClient $commande, string $operation): JsonResponse
    {
        return response()->json([
            'message' => 'Commande déjà traitée entre-temps (statut : '.$commande->statut.') — '.$operation.' refusée.',
            'statut' => $commande->statut,
        ], 409);
    }
}
