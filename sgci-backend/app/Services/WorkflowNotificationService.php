<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Notifications métier internes (écran cloche + push FCM).
 *
 * Complémentaire à NotificationService (qui sert les canaux e-mail/SMS/push
 * configurables par l'utilisateur) : ici on veut notifying un fait métier
 * simple et garanti, sans dépendre des préférences de canaux.
 */
class WorkflowNotificationService
{
    public function __construct(private readonly FcmService $fcmService) {}

    /**
     * Notifie les gérants/propriétaires d'une boutique.
     *
     * @param  array<int>  $excludeUserIds  utilisateurs à ne pas notifier (ex. l'auteur)
     */
    public function notifierGerants(int $boutiqueId, User $auteur, string $title, string $message, array $data = [], array $excludeUserIds = []): int
    {
        return $this->notifier(
            $this->gerantsDe($boutiqueId, $excludeUserIds),
            $auteur,
            $title,
            $message,
            $data
        );
    }

    /**
     * Notifie un ensemble d'utilisateurs précis.
     */
    public function notifier(iterable $destinataires, ?User $auteur, string $title, string $message, array $data = []): int
    {
        $envoyes = 0;

        foreach ($destinataires as $destinataire) {
            if (! $destinataire instanceof User) {
                continue;
            }

            // Ne pas notifier l'auteur de son propre acte.
            if ($auteur && $destinataire->id === $auteur->id) {
                continue;
            }

            try {
                AppNotification::create([
                    'user_id' => $destinataire->id,
                    'type' => $data['type'] ?? 'workflow',
                    'title' => $title,
                    'message' => $message,
                    'data' => $data,
                ]);

                $this->fcmService->sendToUser($destinataire, $title, $message, $data);

                $envoyes++;
            } catch (\Throwable $e) {
                // Une notification ratée ne doit jamais faire échouer l'opération métier.
                Log::warning('Notification workflow non délivrée', [
                    'user_id' => $destinataire->id,
                    'titre' => $title,
                    'erreur' => $e->getMessage(),
                ]);
            }
        }

        return $envoyes;
    }

    /**
     * Gérants et propriétaires rattachés à la boutique.
     *
     * @param  array<int>  $excludeUserIds
     * @return Collection<int, User>
     */
    private function gerantsDe(int $boutiqueId, array $excludeUserIds = [])
    {
        return User::query()
            ->where('est_actif', true)
            ->where(function ($query) use ($boutiqueId) {
                $query->where('current_boutique_id', $boutiqueId)
                    ->orWhereHas('boutiques', function ($q) use ($boutiqueId) {
                        $q->where('boutique_id', $boutiqueId);
                    });
            })
            ->whereIn('role', ['gerant', 'proprietaire'])
            ->when($excludeUserIds, fn ($q) => $q->whereNotIn('id', $excludeUserIds))
            ->get()
            ->filter(fn (User $user) => in_array($user->roleDansBoutique($boutiqueId), ['gerant', 'proprietaire'], true))
            ->values();
    }
}
