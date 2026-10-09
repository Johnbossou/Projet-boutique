<?php

namespace App\Http\Controllers\API;

use App\Exceptions\OperationRefusee;
use App\Http\Controllers\Controller;
use App\Models\CommandeFournisseur;
use App\Models\LigneCommandeFournisseur;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Traits\Auditable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CommandeFournisseurController extends Controller
{
    use Auditable;

    /**
     * Affiche la liste des commandes fournisseurs de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = CommandeFournisseur::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['fournisseur', 'user', 'lignes.produit']);

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par fournisseur
        if ($request->has('fournisseur_id') && $request->fournisseur_id) {
            $query->where('fournisseur_id', $request->fournisseur_id);
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
     * Crée une nouvelle commande fournisseur
     */
    public function store(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $validated = $request->validate([
            // Le fournisseur doit appartenir à la boutique de la commande.
            // exists:fournisseurs,id seul autorisait un gérant à attacher le
            // fournisseur d'un autre tenant : la commande renvoyait ensuite
            // load('fournisseur'), donc nom, email, téléphone, adresse et
            // contacts d'un autre tenant en clair. Le scope strict correspond
            // au reste du module (FournisseurController impose déjà
            // boutique_id = current à la création et refuse l'accès sinon).
            'fournisseur_id' => [
                'required',
                Rule::exists('fournisseurs', 'id')->where('boutique_id', $boutiqueId),
            ],
            'date_livraison_prevue' => 'nullable|date',
            'conditions_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
            'lignes' => 'required|array|min:1',
            // Le produit doit appartenir à la boutique de la commande. Sans ce
            // scope, une commande pouvait référencer un produit d'un autre
            // tenant, et sa réception incrémentait le stock de cet autre tenant.
            'lignes.*.produit_id' => [
                'required',
                Rule::exists('produits', 'id')->where('boutique_id', $boutiqueId),
            ],
            'lignes.*.quantite_commandee' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $commande = CommandeFournisseur::create([
                'fournisseur_id' => $validated['fournisseur_id'],
                'boutique_id' => $request->user()->current_boutique_id,
                'date_commande' => now(),
                'date_livraison_prevue' => $validated['date_livraison_prevue'] ?? null,
                'statut' => 'en_attente',
                'conditions_paiement' => $validated['conditions_paiement'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()->id,
                'montant_total' => 0,
                'montant_paye' => 0,
            ]);

            $montantTotal = 0;

            foreach ($validated['lignes'] as $ligneData) {
                $montantLigne = $ligneData['quantite_commandee'] * $ligneData['prix_unitaire'];
                $montantTotal += $montantLigne;

                LigneCommandeFournisseur::create([
                    'commande_fournisseur_id' => $commande->id,
                    'produit_id' => $ligneData['produit_id'],
                    'quantite_commandee' => $ligneData['quantite_commandee'],
                    'quantite_recue' => 0,
                    'prix_unitaire' => $ligneData['prix_unitaire'],
                    'montant_total' => $montantLigne,
                    'statut' => 'en_attente',
                ]);
            }

            $commande->update(['montant_total' => $montantTotal]);

            $this->auditCreate($commande);

            return response()->json([
                'message' => 'Commande fournisseur créée avec succès',
                'data' => $commande->load('fournisseur', 'lignes.produit'),
            ], 201);
        });
    }

    /**
     * Affiche une commande fournisseur spécifique
     */
    public function show(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commande->load(['fournisseur', 'user', 'lignes.produit']);

        return response()->json($commande);
    }

    /**
     * Met à jour une commande fournisseur
     */
    public function update(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Seules les commandes en attente peuvent être modifiées
        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être modifiées',
            ], 409);
        }

        $validated = $request->validate([
            'date_livraison_prevue' => 'nullable|date',
            'conditions_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $commande->update($validated);

        return response()->json([
            'message' => 'Commande mise à jour avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Valide une commande fournisseur
     */
    public function valider(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($commande) {
            // Relecture SOUS VERROU. Le contrôle « en_attente » portait sur
            // l'instance liée à la route, lue avant la transaction : deux
            // validations concurrentes le voyaient toutes deux, et valider en
            // même temps qu'annuler() pouvait « ressusciter » une commande
            // annulée — porte d'entrée vers un crédit de stock non désiré à la
            // réception. Sous verrou, une seule transition passe.
            $verrouillee = CommandeFournisseur::where('id', $commande->id)
                ->where('boutique_id', $commande->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable.'], 404);
            }

            if ($verrouillee->statut !== 'en_attente') {
                return response()->json([
                    'message' => 'Seules les commandes en attente peuvent être validées',
                ], 409);
            }

            $verrouillee->update(['statut' => 'en_cours']);

            $this->auditUpdate($verrouillee, ['statut' => 'en_attente']);

            return response()->json([
                'message' => 'Commande validée avec succès',
                'data' => $verrouillee,
            ]);
        });
    }

    /**
     * Enregistre un règlement sur une commande fournisseur.
     * Accumule dans montant_paye sans jamais dépasser montant_total.
     */
    public function payer(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'montant' => 'required|numeric|min:1',
        ]);

        $montantPaiement = (float) $validated['montant'];

        return DB::transaction(function () use ($commande, $montantPaiement) {
            // Verrou sur la commande + relecture du solde SOUS VERROU.
            //
            // Les contrôles (statut, reste à payer) portaient sur l'instance
            // liée à la route, lue avant la transaction, et l'écriture était un
            // « += » sur cette même instance périmée. Deux règlements
            // simultanés lisaient donc le même montant_paye, passaient tous
            // deux le contrôle du reste à payer, puis chacun sauvegardait sa
            // propre valeur : un des deux règlements disparaissait purement et
            // simplement. Sur une facture fournisseur de 10 000 payée en deux
            // fois de 6 000 en parallèle, la commande restait affichée à 6 000
            // alors que 12 000 ont été encaissés — et le fournisseur était
            // payé 12 000 pour une commande de 10 000.
            $verrouillee = CommandeFournisseur::where('id', $commande->id)
                ->where('boutique_id', $commande->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouillee) {
                throw new OperationRefusee('Commande introuvable.', 404);
            }

            if (in_array($verrouillee->statut, ['annule', 'livre'], true)) {
                return response()->json([
                    'message' => 'Cette commande ne peut plus recevoir de paiement',
                ], 409);
            }

            $montantTotal = (float) $verrouillee->montant_total;
            $montantPaye = (float) $verrouillee->montant_paye;

            if ($montantPaye >= $montantTotal) {
                return response()->json([
                    'message' => 'Cette commande est déjà entièrement payée',
                ], 409);
            }

            $reste = round($montantTotal - $montantPaye, 2);
            if ($montantPaiement > $reste) {
                return response()->json([
                    'message' => "Le règlement dépasse le reste à payer ({$reste} XOF)",
                ], 422);
            }

            $verrouillee->montant_paye = round($montantPaye + $montantPaiement, 2);
            $verrouillee->save();

            $this->auditUpdate($verrouillee, ['montant_paye' => $montantPaye]);

            return response()->json([
                'message' => 'Règlement enregistré',
                'data' => $verrouillee->fresh(),
            ]);
        });
    }

    /**
     * Réceptionne tout ou partie des lignes d'une commande fournisseur validée.
     * Chaque quantité reçue est tracée via un mouvement de stock « arrivage » validé
     * (le stock de la boutique est incrémenté) et reportée sur quantite_recue.
     * La commande passe en « livre » lorsque toutes les lignes sont entièrement reçues.
     */
    public function receptionner(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'lignes' => 'required|array|min:1',
            'lignes.*.ligne_id' => 'required|exists:ligne_commande_fournisseurs,id',
            'lignes.*.quantite_recue' => 'required|integer|min:1',
        ]);

        $boutiqueId = $commande->boutique_id;

        DB::beginTransaction();
        try {
            // La commande est reverrouillee avant tout controle de statut :
            // verifier « en_cours » hors transaction laissait deux receptions
            // simultanees passer, et le stock etait credite deux fois.
            $verrouillee = CommandeFournisseur::where('id', $commande->id)
                ->where('boutique_id', $boutiqueId)
                ->lockForUpdate()
                ->first();

            if (! $verrouillee) {
                throw new OperationRefusee('Commande introuvable.', 404);
            }

            if ($verrouillee->statut !== 'en_cours') {
                throw new OperationRefusee(
                    'Seules les commandes en cours peuvent être réceptionnées',
                    409
                );
            }

            $reccu = [];
            $lignes = $verrouillee->lignes()->get()->keyBy('id');

            foreach ($validated['lignes'] as $receptionLigne) {
                $ligne = $lignes->get($receptionLigne['ligne_id']);

                if (! $ligne || $ligne->commande_fournisseur_id !== $commande->id) {
                    throw new \InvalidArgumentException("Ligne invalide pour cette commande : {$receptionLigne['ligne_id']}");
                }

                $quantiteRecue = (int) $receptionLigne['quantite_recue'];
                $restant = $ligne->quantite_restante;

                if ($quantiteRecue > $restant) {
                    throw new \InvalidArgumentException(
                        "La quantité reçue dépasse le restant attendu (produit {$ligne->produit_id})"
                    );
                }

                // Verrou + scope boutique. Sans lockForUpdate, deux réceptions
                // simultanées lisaient la même quantite_avant et la seconde
                // ecraseait l increment de la premiere (lost update).
                // Le scope protege aussi les lignes creees avant la correction :
                // un produit etranger ne doit jamais voir son stock augmente.
                $produit = Produit::where('id', $ligne->produit_id)
                    ->where('boutique_id', $commande->boutique_id)
                    ->lockForUpdate()
                    ->first();

                if (! $produit) {
                    throw new OperationRefusee(
                        "Le produit {$ligne->produit_id} n'appartient pas à la boutique de la commande.",
                        422
                    );
                }

                // quantite_avant est relue sous le verrou : c'est la valeur
                // réellement persistée au moment de l'écriture.
                $quantiteAvant = (int) $produit->quantite_stock;
                $quantiteApres = $quantiteAvant + $quantiteRecue;

                // Mouvement de stock tracé et directement validé (arrivage)
                $mouvement = MouvementStock::create([
                    'produit_id' => $produit->id,
                    'type' => 'entree',
                    'quantite' => $quantiteRecue,
                    'raison' => 'arrivage',
                    'reference_bon' => $commande->numero_commande,
                    'user_id' => $request->user()->id,
                    'statut' => 'accepte',
                    'notes' => "Réception commande fournisseur #{$commande->numero_commande}",
                    'quantite_avant' => $quantiteAvant,
                    'quantite_apres' => $quantiteApres,
                    'boutique_id' => $commande->boutique_id,
                ]);

                $produit->update(['quantite_stock' => $quantiteApres]);

                $ligne->quantite_recue += $quantiteRecue;
                $ligne->statut = $ligne->estEntierementRecue() ? 'recu' : 'partiel';
                $ligne->save();

                $reccu[] = [
                    'ligne_id' => $ligne->id,
                    'produit_id' => $produit->id,
                    'quantite_recue' => $quantiteRecue,
                    'quantite_restante' => $ligne->quantite_restante,
                    'mouvement_id' => $mouvement->id,
                    'stock_apres' => $produit->quantite_stock,
                ];

                $this->auditCreate($mouvement);
            }

            // Toutes les lignes reçues en intégralité => commande livrée.
            // La relation doit être relue : $commande->lignes était chargée avant
            // la transaction et portait les quantite_recue d'origine, ce qui
            // pouvait laisser une commande intégralement reçue en « en_cours ».
            $toutesRecues = LigneCommandeFournisseur::where('commande_fournisseur_id', $commande->id)
                ->get()
                ->every->estEntierementRecue();

            if ($toutesRecues) {
                $verrouillee->update([
                    'statut' => 'livre',
                    'date_livraison_reelle' => now(),
                ]);
            }

            $commande->refresh();

            DB::commit();

            return response()->json([
                'message' => 'Réception enregistrée, stock mis à jour',
                'data' => [
                    'commande' => $commande->load('lignes.produit', 'fournisseur'),
                    'receptions' => $reccu,
                ],
            ]);
        } catch (OperationRefusee $e) {
            DB::rollBack();

            return response()->json(
                ['message' => $e->getMessage()],
                $e->statutHttp()
            );
        } catch (\InvalidArgumentException $e) {
            DB::rollBack();

            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json(['message' => 'Erreur lors de la réception'], 500);
        }
    }

    /**
     * Annule une commande fournisseur
     */
    public function annuler(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($commande) {
            // Relecture SOUS VERROU. Sans elle, annuler() lancé en même temps
            // qu'une réception pouvait annuler une commande dont le stock venait
            // d'être crédité, ou laisser une commande annulée passer « livre ».
            // Le statut relu est l'unique autorité.
            $verrouillee = CommandeFournisseur::where('id', $commande->id)
                ->where('boutique_id', $commande->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable.'], 404);
            }

            $ancienStatut = $verrouillee->statut;

            if (! in_array($ancienStatut, ['en_attente', 'en_cours'], true)) {
                return response()->json([
                    'message' => 'Seules les commandes en attente ou en cours peuvent être annulées',
                ], 409);
            }

            $verrouillee->update(['statut' => 'annule']);

            $this->auditUpdate($verrouillee, ['statut' => $ancienStatut]);

            return response()->json([
                'message' => 'Commande annulée avec succès',
                'data' => $verrouillee,
            ]);
        });
    }

    /**
     * Supprime (soft delete) une commande fournisseur
     */
    public function destroy(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return DB::transaction(function () use ($commande) {
            // Relecture SOUS VERROU. Sans elle, une suppression lancée en même
            // temps qu'une validation lisait « en_attente », la validation
            // passait la commande « en_cours », puis la suppression s'appliquait :
            // la commande disparaissait alors que le gérant venait de la lancer,
            // et toute réception ultérieure échouait en 404 sur une commande
            // qu'il croyait active.
            $verrouillee = CommandeFournisseur::where('id', $commande->id)
                ->where('boutique_id', $commande->boutique_id)
                ->lockForUpdate()
                ->first();

            if (! $verrouillee) {
                return response()->json(['message' => 'Commande introuvable.'], 404);
            }

            if ($verrouillee->statut !== 'en_attente') {
                // 409 et non 400 : la commande existe mais n'est plus dans un
                // état compatible (elle a été validée/annulée entre-temps).
                return response()->json([
                    'message' => 'Seules les commandes en attente peuvent être supprimées',
                ], 409);
            }

            $this->auditDelete($verrouillee);
            $verrouillee->delete();

            return response()->json(['message' => 'Commande supprimée avec succès']);
        });
    }

    /**
     * Liste les produits dont le stock est sous le seuil, avec quantité suggérée à commander.
     * Ordonnance d'achat automatique pour le gérant.
     */
    public function suggestions(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $produits = Produit::where('boutique_id', $boutiqueId)
            ->enAlerte()
            ->with('categorie')
            ->get()
            ->map(function ($produit) {
                // Commander 2× le seuil d'alerte pour avoir une marge
                $quantiteSuggeree = max(1, ($produit->seuil_alerte * 2) - $produit->quantite_stock);

                return [
                    'produit_id' => $produit->id,
                    'nom' => $produit->nom,
                    'categorie' => $produit->categorie?->nom ?? 'Sans catégorie',
                    'stock_actuel' => $produit->quantite_stock,
                    'seuil_alerte' => $produit->seuil_alerte,
                    'quantite_suggeree' => $quantiteSuggeree,
                    'rupture' => $produit->estEnRupture(),
                ];
            });

        return response()->json([
            'data' => $produits,
            'total' => $produits->count(),
        ]);
    }
}
