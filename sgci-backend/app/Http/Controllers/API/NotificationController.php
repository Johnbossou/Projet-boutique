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
    /**
     * Filtre les notifications auxquelles l'utilisateur a droit.
     *
     * Les notifications sont toujours adressées à un destinataire précis
     * (PeremptionService, StockAlertService, WorkflowNotificationService et
     * generateStockAlerts remplissent tous user_id). Aucune n'est diffusée à
     * « tout le monde » : la lecture des lignes où user_id est NULL revenait
     * donc à exposer les notifications d'autres comptes, y compris le nom de
     * produits, le stock et les seuils d'autres boutiques.
     */
    private function notificationsVisibles(Request $request)
    {
        return AppNotification::query()
            ->where('user_id', $request->user()->id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = $this->notificationsVisibles($request)
            ->orderByDesc('created_at');

        if ($request->boolean('unread_only')) {
            $query->unread();
        }

        return response()->json($query->paginate(30));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = $this->notificationsVisibles($request)->unread()->count();

        return response()->json(['count' => $count]);
    }

    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        // Sans ce contrôle, un identifiant deviné suffisait à lire et modifier
        // la notification d'un autre compte (IDOR).
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Notification introuvable'], 404);
        }

        $notification->update(['read_at' => now()]);

        return response()->json(['message' => 'Notification lue', 'notification' => $notification]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $this->notificationsVisibles($request)
            ->unread()
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

        if (! in_array($role, ['gerant', 'proprietaire'], true)) {
            return response()->json(['message' => 'Réservé au gérant'], 403);
        }

        $created = self::generateStockAlerts($user->current_boutique_id);

        return response()->json([
            'message' => 'Alertes stock synchronisées',
            'created' => $created,
        ]);
    }

    /**
     * Crée les notifications de stock bas et de rupture.
     *
     * $boutiqueId est obligatoire : croiser « tous les gérants de toutes les
     * boutiques » avec « tous les produits de toutes les boutiques » expédiait
     * à chaque gérant le nom, le stock et le seuil des produits des autres
     * tenants. La commande planifiée toutes les heures appelait précisément ce
     * cas global.
     */
    public static function generateStockAlerts(int $boutiqueId): int
    {
        $gerants = User::where('role', 'gerant')
            ->where('est_actif', true)
            ->whereHas('boutiques', function ($q) use ($boutiqueId) {
                $q->where('boutiques.id', $boutiqueId);
            })
            ->pluck('id');

        if ($gerants->isEmpty()) {
            return 0;
        }

        $alertes = Produit::enAlerte()->where('boutique_id', $boutiqueId)->with('categorie')->get();
        $ruptures = Produit::enRupture()->where('boutique_id', $boutiqueId)->get();

        $created = 0;

        foreach ($alertes as $produit) {
            foreach ($gerants as $userId) {
                $exists = AppNotification::where('user_id', $userId)
                    ->where('type', 'stock_alerte')
                    ->whereNull('read_at')
                    ->where('data->produit_id', $produit->id)
                    ->exists();

                if (! $exists) {
                    AppNotification::create([
                        'user_id' => $userId,
                        'type' => 'stock_alerte',
                        'title' => 'Stock bas : '.$produit->nom,
                        'message' => "Il reste {$produit->quantite_stock} unités (seuil {$produit->seuil_alerte}).",
                        // boutique_id est indispensable : MouvementStockController
                        // ne résout une alerte obsolète que s'il est présent.
                        'data' => ['produit_id' => $produit->id, 'boutique_id' => $boutiqueId],
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

                if (! $exists) {
                    AppNotification::create([
                        'user_id' => $userId,
                        'type' => 'stock_rupture',
                        'title' => 'Rupture : '.$produit->nom,
                        'message' => 'Produit en rupture de stock.',
                        'data' => ['produit_id' => $produit->id, 'boutique_id' => $boutiqueId],
                    ]);
                    $created++;
                }
            }
        }

        return $created;
    }
}
