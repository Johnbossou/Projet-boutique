<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Vente;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log; // ✅ AJOUT DE L'IMPORT
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ClientController extends Controller
{
    /**
     * Liste des clients avec pagination, filtres et relations
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Client::query();

            // Filtre par recherche
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('nom', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('telephone', 'like', "%{$search}%");
                });
            }

            // Filtre par statut
            if ($request->has('statut') && $request->statut !== 'tous') {
                $query->where('statut', $request->statut);
            }

            // Charger la dernière commande pour chaque client
            $query->with(['ventes' => function ($query) {
                $query->latest()->limit(1);
            }]);

            // Tri
            $sortField = $request->get('sort_field', 'created_at');
            $sortDirection = strtolower($request->get('sort_direction', 'desc'));

            $allowedSortFields = ['created_at', 'nom', 'email', 'telephone', 'statut', 'nombre_commandes', 'total_achats'];
            if (!in_array($sortField, $allowedSortFields)) {
                $sortField = 'created_at';
            }

            if (!in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'desc';
            }

            $query->orderBy($sortField, $sortDirection);

            $clients = $query->paginate($request->get('per_page', 20));

            // Formater la réponse avec les données calculées
            $formattedClients = $clients->getCollection()->map(function ($client) {
                return $this->formatClientData($client);
            });

            return response()->json([
                'data' => $formattedClients,
                'meta' => [
                    'current_page' => $clients->currentPage(),
                    'last_page' => $clients->lastPage(),
                    'per_page' => $clients->perPage(),
                    'total' => $clients->total(),
                    'from' => $clients->firstItem(),
                    'to' => $clients->lastItem(),
                ],
                'links' => [
                    'first' => $clients->url(1),
                    'last' => $clients->url($clients->lastPage()),
                    'prev' => $clients->previousPageUrl(),
                    'next' => $clients->nextPageUrl(),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors du chargement des clients',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Création d'un nouveau client
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'nom' => 'required|string|max:255',
                'email' => 'required|email|unique:clients,email',
                'telephone' => 'nullable|string|max:20',
                'adresse' => 'nullable|string|max:500',
                'ville' => 'nullable|string|max:100',
                'statut' => 'sometimes|in:actif,inactif,vip',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Données invalides',
                    'errors' => $validator->errors()
                ], 422);
            }

            $validated = $validator->validated();

            // Valeurs par défaut
            $validated['statut'] = $validated['statut'] ?? 'actif';
            $validated['total_achats'] = 0;
            $validated['nombre_commandes'] = 0;

            $client = Client::create($validated);

            return response()->json([
                'message' => 'Client créé avec succès',
                'client' => $this->formatClientData($client)
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la création du client',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Détails d'un client spécifique avec relations complètes
     */
    /**
 * Détails d'un client spécifique avec relations sécurisées
 */
    public function show(Client $client): JsonResponse
    {
        try {
            // Vérifier d'abord si le client existe
            if (!$client) {
                return response()->json([
                    'message' => 'Client non trouvé'
                ], 404);
            }

            // Charger les relations de manière sécurisée avec vérifications
            $clientData = [
                'id' => $client->id,
                'nom' => $client->nom,
                'email' => $client->email,
                'telephone' => $client->telephone,
                'adresse' => $client->adresse,
                'ville' => $client->ville,
                'created_at' => $client->created_at,
                'total_achats' => (float) $client->total_achats,
                'nombre_commandes' => $client->nombre_commandes,
                'statut' => $client->statut,
                'notes' => $client->notes,
            ];

            // Charger les ventes uniquement si la relation existe
            if (method_exists($client, 'ventes')) {
                $client->load(['ventes' => function ($query) {
                    $query->orderBy('created_at', 'desc')->take(10);
                }]);

                // Formater les ventes de manière sécurisée
                $clientData['ventes'] = $client->ventes->map(function ($vente) {
                    $venteData = [
                        'id' => $vente->id,
                        'numero_commande' => $vente->numero_vente,
                        'date_commande' => $vente->created_at,
                        'montant_total' => (float) $vente->montant_total,
                        'statut' => $vente->statut,
                        'produits_count' => 0,
                    ];

                    // Compter les produits si la relation existe
                    if (method_exists($vente, 'produits')) {
                        $venteData['produits_count'] = $vente->produits->count();
                    }

                    return $venteData;
                });
            } else {
                $clientData['ventes'] = [];
            }

            return response()->json($clientData);

        } catch (\Exception $e) {
            Log::error('Erreur détail client ID ' . ($client->id ?? 'inconnu') . ': ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());

            return response()->json([
                'message' => 'Erreur lors du chargement des détails du client',
                'error' => env('APP_DEBUG') ? $e->getMessage() : 'Erreur interne du serveur'
            ], 500);
        }
    }

    /**
     * Mise à jour d'un client
     */
    public function update(Request $request, Client $client): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'nom' => 'sometimes|string|max:255',
                'email' => 'sometimes|email|unique:clients,email,' . $client->id,
                'telephone' => 'nullable|string|max:20',
                'adresse' => 'nullable|string|max:500',
                'ville' => 'nullable|string|max:100',
                'statut' => 'sometimes|in:actif,inactif,vip',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Données invalides',
                    'errors' => $validator->errors()
                ], 422);
            }

            $validated = $validator->validated();
            $client->update($validated);

            // Recharger le client avec les relations
            $client->load(['ventes' => function ($query) {
                $query->latest()->limit(1);
            }]);

            return response()->json([
                'message' => 'Client modifié avec succès',
                'client' => $this->formatClientData($client)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la modification du client',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Suppression d'un client (soft delete)
     */
    public function destroy(Client $client): JsonResponse
    {
        try {
            // Vérifier si le client a des commandes en cours
            $commandesEnCours = $client->ventes()
                ->whereIn('statut', ['en_attente', 'confirmee', 'expediee'])
                ->exists();

            if ($commandesEnCours) {
                return response()->json([
                    'message' => 'Impossible de supprimer ce client : il a des commandes en cours'
                ], 422);
            }

            $client->delete();

            return response()->json([
                'message' => 'Client supprimé avec succès'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la suppression du client',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Statistiques globales des clients avec données détaillées
     */
    public function statistiques(): JsonResponse
    {
        try {
            $totalClients = Client::count();
            $clientsActifs = Client::actifs()->count();
            $clientsVip = Client::vip()->count();
            $clientsInactifs = Client::inactifs()->count();

            $chiffreAffairesTotal = Client::sum('total_achats');
            $commandesTotal = Client::sum('nombre_commandes');
            $panierMoyen = $commandesTotal > 0 ? $chiffreAffairesTotal / $commandesTotal : 0;

            // Statistiques mensuelles
            $chiffreAffairesMensuel = Client::whereYear('created_at', now()->year)
                ->whereMonth('created_at', now()->month)
                ->sum('total_achats');

            $nouveauxClientsMois = Client::whereYear('created_at', now()->year)
                ->whereMonth('created_at', now()->month)
                ->count();

            // Top 5 clients VIP
            $topClients = Client::vip()
                ->orderBy('total_achats', 'desc')
                ->take(5)
                ->get(['id', 'nom', 'total_achats', 'nombre_commandes']);

            return response()->json([
                'total_clients' => $totalClients,
                'clients_actifs' => $clientsActifs,
                'clients_vip' => $clientsVip,
                'clients_inactifs' => $clientsInactifs,
                'chiffre_affaires_total' => $chiffreAffairesTotal,
                'commandes_total' => $commandesTotal,
                'panier_moyen' => round($panierMoyen, 2),
                'chiffre_affaires_mensuel' => $chiffreAffairesMensuel,
                'nouveaux_clients_mois' => $nouveauxClientsMois,
                'top_clients_vip' => $topClients,
                'taux_conversion_vip' => $totalClients > 0 ? round(($clientsVip / $totalClients) * 100, 2) : 0,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors du chargement des statistiques',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Promotion d'un client en VIP
     */
    public function promouvoirVip(Client $client): JsonResponse
    {
        try {
            // Vérifier si le client peut être promu VIP
            if ($client->statut === 'vip') {
                return response()->json([
                    'message' => 'Ce client est déjà VIP'
                ], 422);
            }

            if ($client->nombre_commandes < 1) {
                return response()->json([
                    'message' => 'Le client doit avoir au moins une commande pour être promu VIP'
                ], 422);
            }

            $client->update(['statut' => 'vip']);

            return response()->json([
                'message' => 'Client promu VIP avec succès',
                'client' => $this->formatClientData($client)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la promotion du client',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Rétrograder un client VIP
     */
    public function retrograderVip(Client $client): JsonResponse
    {
        try {
            if ($client->statut !== 'vip') {
                return response()->json([
                    'message' => 'Ce client n\'est pas VIP'
                ], 422);
            }

            $client->update(['statut' => 'actif']);

            return response()->json([
                'message' => 'Client rétrogradé avec succès',
                'client' => $this->formatClientData($client)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la rétrogradation du client',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Recherche avancée des clients avec suggestions
     */
    public function search(Request $request): JsonResponse
    {
        try {
            $query = $request->get('q');

            if (!$query || strlen($query) < 2) {
                return response()->json([]);
            }

            $clients = Client::where('nom', 'like', "%{$query}%")
                ->orWhere('email', 'like', "%{$query}%")
                ->orWhere('telephone', 'like', "%{$query}%")
                ->limit(10)
                ->get(['id', 'nom', 'email', 'telephone', 'statut', 'ville']);

            return response()->json($clients);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la recherche',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export des clients
     */
    public function export(Request $request): JsonResponse
    {
        try {
            $query = Client::query();

            // Appliquer les mêmes filtres que l'index
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('nom', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('telephone', 'like', "%{$search}%");
                });
            }

            if ($request->has('statut') && $request->statut !== 'tous') {
                $query->where('statut', $request->statut);
            }

            $clients = $query->get();

            $exportData = $clients->map(function ($client) {
                return [
                    'ID' => $client->id,
                    'Nom' => $client->nom,
                    'Email' => $client->email,
                    'Téléphone' => $client->telephone,
                    'Adresse' => $client->adresse,
                    'Ville' => $client->ville,
                    'Statut' => $client->statut,
                    'Total Achats' => $client->total_achats,
                    'Nombre Commandes' => $client->nombre_commandes,
                    'Date Inscription' => $client->created_at->format('d/m/Y'),
                    'Notes' => $client->notes,
                ];
            });

            return response()->json([
                'message' => 'Export généré avec succès',
                'data' => $exportData,
                'filename' => 'clients_' . now()->format('Y-m-d_H-i-s') . '.json',
                'count' => $exportData->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de l\'export',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupérer les commandes d'un client spécifique
     */
    public function commandes(Client $client, Request $request): JsonResponse
    {
        try {
            $query = $client->ventes();

            // Filtre par statut de commande
            if ($request->has('statut')) {
                $query->where('statut', $request->statut);
            }

            // Filtre par date
            if ($request->has('date_debut')) {
                $query->whereDate('created_at', '>=', $request->date_debut);
            }

            if ($request->has('date_fin')) {
                $query->whereDate('created_at', '<=', $request->date_fin);
            }

            $commandes = $query->with(['ligneVentes.produit', 'user'])
                ->orderBy('created_at', 'desc')
                ->paginate($request->get('per_page', 10));

            $data = $commandes->getCollection()->map(function ($vente) {
                return [
                    'id' => $vente->id,
                    'numero_commande' => $vente->numero_vente,
                    'date_commande' => $vente->created_at,
                    'montant_total' => (float) $vente->montant_total,
                    'statut' => $vente->statut,
                    'caissier' => $vente->user?->name,
                    'lignes' => $vente->ligneVentes->map(fn ($l) => [
                        'produit' => $l->produit?->nom,
                        'quantite' => $l->quantite,
                        'prix_unitaire' => (float) $l->prix_unitaire,
                    ]),
                ];
            });

            return response()->json([
                'data' => $data,
                'meta' => [
                    'current_page' => $commandes->currentPage(),
                    'total' => $commandes->total(),
                    'per_page' => $commandes->perPage(),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors du chargement des commandes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Formater les données client pour la liste
     */
    private function formatClientData(Client $client): array
    {
        $derniereCommande = $client->ventes->first();

        return [
            'id' => $client->id,
            'nom' => $client->nom,
            'email' => $client->email,
            'telephone' => $client->telephone,
            'adresse' => $client->adresse,
            'ville' => $client->ville,
            'created_at' => $client->created_at,
            'total_achats' => (float) $client->total_achats,
            'nombre_commandes' => $client->nombre_commandes,
            'derniere_commande' => $derniereCommande ? [
                'id' => $derniereCommande->id,
                'numero_commande' => $derniereCommande->numero_vente,
                'date' => $derniereCommande->created_at,
                'montant' => $derniereCommande->montant_total,
                'statut' => $derniereCommande->statut,
            ] : null,
            'statut' => $client->statut,
            'notes' => $client->notes,
        ];
    }

    /**
     * Formater les données détaillées d'un client
     */
    private function formatClientDetailData(Client $client): array
    {
        $formattedClient = $this->formatClientData($client);

        // Ajouter les ventes formatées
        $formattedClient['ventes'] = $client->ventes->map(function ($vente) {
            $vente->loadMissing('ligneVentes.produit');

            return [
                'id' => $vente->id,
                'numero_commande' => $vente->numero_vente,
                'date_commande' => $vente->created_at,
                'montant_total' => (float) $vente->montant_total,
                'statut' => $vente->statut,
                'produits_count' => $vente->ligneVentes->count(),
                'produits' => $vente->ligneVentes->map(function ($ligne) {
                    return [
                        'id' => $ligne->produit_id,
                        'nom' => $ligne->produit?->nom,
                        'prix' => (float) $ligne->prix_unitaire,
                        'quantite' => $ligne->quantite,
                    ];
                }),
            ];
        });

        return $formattedClient;
    }
}
