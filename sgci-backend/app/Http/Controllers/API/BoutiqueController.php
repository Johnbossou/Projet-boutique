<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\BoutiqueSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BoutiqueController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(BoutiqueSetting::current());
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'sometimes|string|max:255',
            'adresse' => 'nullable|string|max:500',
            'telephone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'devise' => 'sometimes|string|max:10',
            'taux_tva' => 'sometimes|numeric|min:0|max:100',
            'delai_annulation_vente_minutes' => 'sometimes|integer|min:0|max:1440',
        ]);

        $settings = BoutiqueSetting::current();
        $settings->update($validated);

        return response()->json([
            'message' => 'Paramètres boutique mis à jour',
            'settings' => $settings->fresh(),
        ]);
    }
}
