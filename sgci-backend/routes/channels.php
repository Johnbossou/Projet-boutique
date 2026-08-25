<?php

use Illuminate\Support\Facades\Broadcast;

// Canal privé par boutique : tous les membres de la boutique reçoivent les événements
Broadcast::channel('boutique.{boutiqueId}', function ($user, $boutiqueId) {
    if ($user->aAccesBoutique((int) $boutiqueId)) {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->role,
        ];
    }
    return false;
});

// Canal privé pour notifications personnelles d'un utilisateur
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Canal de chat : les membres d'une conversation
Broadcast::channel('chat.conversation.{conversationId}', function ($user, $conversationId) {
    $conversation = \App\Models\ConversationChat::find($conversationId);

    if (!$conversation) {
        return false;
    }

    return $conversation->participants()->where('user_id', $user->id)->exists();
});
