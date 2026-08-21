<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ProgrammeFidelite;
use App\Models\ClientFidelite;
use App\Models\RecompenseFidelite;
use App\Models\ReclamationRecompense;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class FideliteController extends Controller
{
    /**
     * Affiche la liste des programmes de fidélité de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $programmes = ProgrammeFidelite::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['recompenses'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'data' => $programmes,
        ]);
    }

    /**
     * Crée un nouveau programme de fidélité
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'description' => 'nullable|string',
            'points_par_achat' => 'required|integer|min:1',
            'valeur_point' => 'required|numeric|min:0',
            'niveaux' => 'required|array',
            'niveaux.*.nom' => 'required|string',
            'niveaux.*.points_min' => 'required|integer',
            'niveaux.*.remise_pourcentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $request->user()->current_boutique_id,
            'nom' => $validated['nom'],
            'description' => $validated['description'] ?? null,
            'points_par_achat' => $validated['points_par_achat'],
            'valeur_point' => $validated['valeur_point'],
            'niveaux' => $validated['niveaux'],
            'actif' => true,
        ]);

        return response()->json([
            'message' => 'Programme de fidélité créé avec succès',
            'data' => $programme,
        ], 201);
    }

    /**
     * Affiche un programme de fidélité spécifique
     */
    public function show(Request $request, ProgrammeFidelite $programme): JsonResponse
    {
        if ($programme->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $programme->load(['recompenses', 'clientsFidelites.client']);

        return response()->json($programme);
    }

    /**
     * Met à jour un programme de fidélité
     */
    public function update(Request $request, ProgrammeFidelite $programme): JsonResponse
    {
        if ($programme->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'description' => 'nullable|string',
            'points_par_achat' => 'required|integer|min:1',
            'valeur_point' => 'required|numeric|min:0',
            'niveaux' => 'required|array',
            'actif' => 'boolean',
        ]);

        $programme->update($validated);

        return response()->json([
            'message' => 'Programme de fidélité mis à jour',
            'data' => $programme,
        ]);
    }

    /**
     * Supprime un programme de fidélité
     */
    public function destroy(Request $request, ProgrammeFidelite $programme): JsonResponse
    {
        if ($programme->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $programme->delete();

        return response()->json(['message' => 'Programme de fidélité supprimé']);
    }

    /**
     * Inscrit un client au programme de fidélité
     */
    public function inscrireClient(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'programme_fidelite_id' => 'required|exists:programme_fidelites,id',
            'client_id' => 'required|exists:clients,id',
        ]);

        $programme = ProgrammeFidelite::find($validated['programme_fidelite_id']);

        if ($programme->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Vérifier si le client est déjà inscrit
        $existant = ClientFidelite::where('programme_fidelite_id', $validated['programme_fidelite_id'])
            ->where('client_id', $validated['client_id'])
            ->first();

        if ($existant) {
            return response()->json(['message' => 'Client déjà inscrit'], 400);
        }

        $clientFidelite = ClientFidelite::create([
            'programme_fidelite_id' => $validated['programme_fidelite_id'],
            'client_id' => $validated['client_id'],
            'points' => 0,
            'niveau_actuel' => 'Débutant',
            'date_inscription' => now(),
        ]);

        return response()->json([
            'message' => 'Client inscrit avec succès',
            'data' => $clientFidelite,
        ], 201);
    }

    /**
     * Affiche les points d'un client
     */
    public function pointsClient(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
        ]);

        $clientFidelite = ClientFidelite::where('client_id', $validated['client_id'])
            ->whereHas('programmeFidelite', function ($q) use ($request) {
                $q->where('boutique_id', $request->user()->current_boutique_id);
            })
            ->with(['programmeFidelite', 'transactions'])
            ->first();

        if (!$clientFidelite) {
            return response()->json(['message' => 'Client non inscrit au programme'], 404);
        }

        return response()->json($clientFidelite);
    }

    /**
     * Crée une récompense
     */
    public function storeRecompense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'programme_fidelite_id' => 'required|exists:programme_fidelites,id',
            'nom' => 'required|string|max:255',
            'description' => 'nullable|string',
            'points_requis' => 'required|integer|min:1',
            'type' => 'required|string|in:remise,produit,service',
            'valeur' => 'nullable|numeric',
        ]);

        $programme = ProgrammeFidelite::find($validated['programme_fidelite_id']);

        if ($programme->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $recompense = RecompenseFidelite::create($validated);

        return response()->json([
            'message' => 'Récompense créée avec succès',
            'data' => $recompense,
        ], 201);
    }

    /**
     * Réclame une récompense
     */
    public function reclamerRecompense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recompense_fidelite_id' => 'required|exists:recompense_fidelites,id',
            'client_id' => 'required|exists:clients,id',
        ]);

        $recompense = RecompenseFidelite::find($validated['recompense_fidelite_id']);

        if ($recompense->programmeFidelite->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $clientFidelite = ClientFidelite::where('client_id', $validated['client_id'])
            ->where('programme_fidelite_id', $recompense->programme_fidelite_id)
            ->first();

        if (!$clientFidelite) {
            return response()->json(['message' => 'Client non inscrit'], 404);
        }

        if (!$recompense->peutEtreReclamee($clientFidelite)) {
            return response()->json(['message' => 'Points insuffisants'], 400);
        }

        return DB::transaction(function () use ($clientFidelite, $recompense) {
            // Retirer les points
            $clientFidelite->retirerPoints($recompense->points_requis, 'Réclamation: ' . $recompense->nom);

            // Créer la réclamation
            $reclamation = ReclamationRecompense::create([
                'recompense_fidelite_id' => $recompense->id,
                'client_fidelite_id' => $clientFidelite->id,
                'date_reclamation' => now(),
                'statut' => 'valide',
                'utilise' => false,
            ]);

            return response()->json([
                'message' => 'Récompense réclamée avec succès',
                'data' => $reclamation,
            ]);
        });
    }

    /**
     * Statistiques du programme de fidélité
     */
    public function statistiques(Request $request): JsonResponse
    {
        $programmeId = $request->input('programme_fidelite_id');

        if ($programmeId) {
            $programme = ProgrammeFidelite::where('id', $programmeId)
                ->where('boutique_id', $request->user()->current_boutique_id)
                ->first();

            if (!$programme) {
                return response()->json(['message' => 'Programme non trouvé'], 404);
            }

            $totalClients = $programme->clientsFidelites()->count();
            $totalPointsDistribues = $programme->clientsFidelites()->sum('points');
            $totalRecompenses = $programme->recompenses()->count();
        } else {
            $totalClients = ClientFidelite::whereHas('programmeFidelite', function ($q) use ($request) {
                $q->where('boutique_id', $request->user()->current_boutique_id);
            })->count();

            $totalPointsDistribues = ClientFidelite::whereHas('programmeFidelite', function ($q) use ($request) {
                $q->where('boutique_id', $request->user()->current_boutique_id);
            })->sum('points');

            $totalRecompenses = RecompenseFidelite::whereHas('programmeFidelite', function ($q) use ($request) {
                $q->where('boutique_id', $request->user()->current_boutique_id);
            })->count();
        }

        return response()->json([
            'total_clients' => $totalClients,
            'total_points_distribues' => $totalPointsDistribues,
            'total_recompenses' => $totalRecompenses,
        ]);
    }
}
