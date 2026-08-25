<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ConversationChat;
use App\Models\MessageChat;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ChatController extends Controller
{
    /**
     * Affiche la liste des conversations de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = ConversationChat::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['participants', 'dernierMessage'])
            ->whereHas('participants', function ($q) use ($request) {
                $q->where('user_id', $request->user()->id);
            });

        $conversations = $query->orderBy('updated_at', 'desc')->get();

        // Ajouter le compteur de messages non lus
        $conversations->each(function ($conversation) use ($request) {
            $conversation->messages_non_lus = $conversation->messagesNonLus($request->user());
        });

        return response()->json([
            'data' => $conversations,
        ]);
    }

    /**
     * Crée une nouvelle conversation
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'titre' => 'required|string|max:255',
            'type' => 'required|string|in:groupe,prive',
            'participant_ids' => 'required|array|min:1',
            'participant_ids.*' => 'exists:users,id',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $conversation = ConversationChat::create([
                'boutique_id' => $request->user()->current_boutique_id,
                'titre' => $validated['titre'],
                'type' => $validated['type'],
                'statut' => 'active',
            ]);

            // Ajouter le créateur comme admin
            $conversation->ajouterParticipant($request->user(), 'admin');

            // Ajouter les autres participants
            foreach ($validated['participant_ids'] as $userId) {
                if ($userId != $request->user()->id) {
                    $conversation->ajouterParticipant(\App\Models\User::find($userId), 'membre');
                }
            }

            // Envoyer le premier message de bienvenue
            MessageChat::create([
                'conversation_id' => $conversation->id,
                'user_id' => $request->user()->id,
                'message' => "Conversation créée par {$request->user()->name}",
                'type' => 'systeme',
                'lu' => true,
            ]);

            return response()->json([
                'message' => 'Conversation créée avec succès',
                'data' => $conversation->load('participants'),
            ], 201);
        });
    }

    /**
     * Affiche une conversation spécifique avec ses messages
     */
    public function show(Request $request, ConversationChat $conversation): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$conversation->estParticipant($request->user())) {
            return response()->json(['message' => 'Vous n\'êtes pas participant de cette conversation'], 403);
        }

        $conversation->load(['participants', 'messages.user']);

        // Marquer les messages comme lus
        $conversation->messages()
            ->where('user_id', '!=', $request->user()->id)
            ->where('lu', false)
            ->update(['lu' => true]);

        return response()->json($conversation);
    }

    /**
     * Envoie un message dans une conversation
     */
    public function sendMessage(Request $request, ConversationChat $conversation): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$conversation->estParticipant($request->user())) {
            return response()->json(['message' => 'Vous n\'êtes pas participant de cette conversation'], 403);
        }

        $validated = $request->validate([
            'message' => 'required|string',
            'type' => 'nullable|string|in:texte,fichier',
            'fichier_joint' => 'nullable|string',
        ]);

        $message = MessageChat::create([
            'conversation_id' => $conversation->id,
            'user_id' => $request->user()->id,
            'message' => $validated['message'],
            'type' => $validated['type'] ?? 'texte',
            'fichier_joint' => $validated['fichier_joint'] ?? null,
            'lu' => true,
        ]);

        // Mettre à jour le timestamp de la conversation
        $conversation->touch();

        // Notifier les autres participants en push (silencieux si FCM non configuré)
        $participantIds = $conversation->participants()
            ->wherePivot('user_id', '!=', $request->user()->id)
            ->pluck('users.id')
            ->all();

        if ($participantIds !== []) {
            app(\App\Services\FcmService::class)->sendToMultipleUsers(
                $participantIds,
                $conversation->titre . ' - ' . $request->user()->name,
                mb_substr($validated['message'], 0, 120),
                [
                    'type' => 'nouveau_message',
                    'conversation_id' => (string) $conversation->id,
                ]
            );
        }

        return response()->json([
            'message' => 'Message envoyé avec succès',
            'data' => $message->load('user'),
        ], 201);
    }

    /**
     * Ajoute un participant à une conversation
     */
    public function addParticipant(Request $request, ConversationChat $conversation): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Vérifier si l'utilisateur est admin
        $participant = $conversation->participants()
            ->where('user_id', $request->user()->id)
            ->where('role', 'admin')
            ->first();

        if (!$participant) {
            return response()->json(['message' => 'Seuls les administrateurs peuvent ajouter des participants'], 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'role' => 'nullable|string|in:admin,membre',
        ]);

        $user = \App\Models\User::find($validated['user_id']);

        if ($conversation->estParticipant($user)) {
            return response()->json(['message' => 'Cet utilisateur est déjà participant'], 400);
        }

        $conversation->ajouterParticipant($user, $validated['role'] ?? 'membre');

        return response()->json([
            'message' => 'Participant ajouté avec succès',
        ]);
    }

    /**
     * Retire un participant d'une conversation
     */
    public function removeParticipant(Request $request, ConversationChat $conversation): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = \App\Models\User::find($validated['user_id']);

        // Vérifier si l'utilisateur est admin ou si c'est lui-même
        $participant = $conversation->participants()
            ->where('user_id', $request->user()->id)
            ->where('role', 'admin')
            ->first();

        if (!$participant && $request->user()->id !== $validated['user_id']) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $conversation->retirerParticipant($user);

        return response()->json([
            'message' => 'Participant retiré avec succès',
        ]);
    }

    /**
     * Supprime une conversation
     */
    public function destroy(Request $request, ConversationChat $conversation): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Vérifier si l'utilisateur est admin
        $participant = $conversation->participants()
            ->where('user_id', $request->user()->id)
            ->where('role', 'admin')
            ->first();

        if (!$participant) {
            return response()->json(['message' => 'Seuls les administrateurs peuvent supprimer une conversation'], 403);
        }

        $conversation->delete();

        return response()->json([
            'message' => 'Conversation supprimée avec succès',
        ]);
    }

    /**
     * Modifie un message (auteur uniquement, dans les 15 minutes)
     */
    public function editMessage(Request $request, ConversationChat $conversation, MessageChat $message): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$conversation->estParticipant($request->user())) {
            return response()->json(['message' => 'Vous n\'êtes pas participant'], 403);
        }

        if ($message->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez modifier que vos propres messages'], 403);
        }

        if ($message->type === 'systeme') {
            return response()->json(['message' => 'Impossible de modifier un message système'], 400);
        }

        // Limite de 15 minutes pour éditer
        if ($message->created_at->diffInMinutes(now()) > 15) {
            return response()->json(['message' => 'Délai de 15 minutes dépassé pour l\'édition'], 400);
        }

        $validated = $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $message->update([
            'message' => $validated['message'],
        ]);

        return response()->json([
            'message' => 'Message modifié',
            'data' => $message->load('user'),
            'modifie' => true,
        ]);
    }

    /**
     * Supprime un message (auteur ou admin de la conversation)
     */
    public function deleteMessage(Request $request, ConversationChat $conversation, MessageChat $message): JsonResponse
    {
        if ($conversation->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$conversation->estParticipant($request->user())) {
            return response()->json(['message' => 'Vous n\'êtes pas participant'], 403);
        }

        $estAuteur = $message->user_id === $request->user()->id;
        $estAdmin = $conversation->participants()
            ->where('user_id', $request->user()->id)
            ->where('role', 'admin')
            ->exists();

        if (!$estAuteur && !$estAdmin) {
            return response()->json(['message' => 'Non autorisé à supprimer ce message'], 403);
        }

        if ($message->type === 'systeme') {
            return response()->json(['message' => 'Impossible de supprimer un message système'], 400);
        }

        $message->delete();

        return response()->json(['message' => 'Message supprimé']);
    }
}
