<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AppNotification::query()
            ->where(function ($q) use ($request) {
                $q->whereNull('user_id')
                    ->orWhere('user_id', $request->user()->id);
            })
            ->orderByDesc('created_at');

        if ($request->boolean('unread_only')) {
            $query->unread();
        }

        return response()->json($query->paginate(30));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = AppNotification::query()
            ->unread()
            ->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            })
            ->count();

        return response()->json(['count' => $count]);
    }

    public function markRead(AppNotification $notification): JsonResponse
    {
        $notification->update(['read_at' => now()]);

        return response()->json(['message' => 'Notification lue', 'notification' => $notification]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::query()
            ->unread()
            ->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            })
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'Toutes les notifications sont lues']);
    }

    /**
     * Vérifie les stocks et crée des notifications (gérants).
     */
    public function syncStockAlerts(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->roleDansBoutique($user->current_boutique_id);

        if (!in_array($role, ['gerant', 'proprietaire'], true)) {
            return response()->json(['message' => 'Réservé au gérant'], 403);
        }

        $created = self::generateStockAlerts($user->current_boutique_id);

        return response()->json([
            'message' => 'Alertes stock synchronisées',
            'created' => $created,
        ]);
    }

    public static function generateStockAlerts(?int $boutiqueId = null): int
    {
        $created = 0;

        if ($boutiqueId) {
            $gerants = User::where('role', 'gerant')
                ->where('est_actif', true)
                ->whereHas('boutiques', function ($q) use ($boutiqueId) {
                    $q->where('boutiques.id', $boutiqueId);
                })
                ->pluck('id');

            $alertes = Produit::enAlerte()->where('boutique_id', $boutiqueId)->with('categorie')->get();
            $ruptures = Produit::enRupture()->where('boutique_id', $boutiqueId)->get();
        } else {
            $gerants = User::where('role', 'gerant')->where('est_actif', true)->pluck('id');
            $alertes = Produit::enAlerte()->with('categorie')->get();
            $ruptures = Produit::enRupture()->get();
        }
        foreach ($alertes as $produit) {
            foreach ($gerants as $userId) {
                $exists = AppNotification::where('user_id', $userId)
                    ->where('type', 'stock_alerte')
                    ->whereNull('read_at')
                    ->where('data->produit_id', $produit->id)
                    ->exists();

                if (!$exists) {
                    AppNotification::create([
                        'user_id' => $userId,
                        'type' => 'stock_alerte',
                        'title' => 'Stock bas : ' . $produit->nom,
                        'message' => "Il reste {$produit->quantite_stock} unités (seuil {$produit->seuil_alerte}).",
                        'data' => ['produit_id' => $produit->id],
                    ]);
                    $created++;
                }
            }
        }

        foreach ($ruptures as $produit) {
            foreach ($gerants as $userId) {
                $exists = AppNotification::where('user_id', $userId)
                    ->where('type', 'stock_rupture')
                    ->whereNull('read_at')
                    ->where('data->produit_id', $produit->id)
                    ->exists();

                if (!$exists) {
                    AppNotification::create([
                        'user_id' => $userId,
                        'type' => 'stock_rupture',
                        'title' => 'Rupture : ' . $produit->nom,
                        'message' => 'Produit en rupture de stock.',
                        'data' => ['produit_id' => $produit->id],
                    ]);
                    $created++;
                }
            }
        }

        return $created;
    }
}
