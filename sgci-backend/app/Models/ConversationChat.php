<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ConversationChat extends Model
{
    use HasFactory;

    protected $fillable = [
        'boutique_id',
        'titre',
        'type',
        'statut',
    ];

    /**
     * Relation avec la boutique
     */
    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Relation avec les participants
     */
    public function participants()
    {
        return $this->belongsToMany(User::class, 'conversation_participant', 'conversation_id', 'user_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * Relation avec les messages
     */
    public function messages()
    {
        return $this->hasMany(MessageChat::class, 'conversation_id')->orderBy('created_at', 'asc');
    }

    /**
     * Vérifier si un utilisateur est participant
     */
    public function estParticipant(User $user): bool
    {
        return $this->participants()->where('user_id', $user->id)->exists();
    }

    /**
     * Ajouter un participant
     */
    public function ajouterParticipant(User $user, string $role = 'membre'): void
    {
        $this->participants()->attach($user->id, ['role' => $role]);
    }

    /**
     * Retirer un participant
     */
    public function retirerParticipant(User $user): void
    {
        $this->participants()->detach($user->id);
    }

    /**
     * Obtenir le dernier message
     */
    public function dernierMessage()
    {
        return $this->hasOne(MessageChat::class, 'conversation_id')->latest();
    }

    /**
     * Compter les messages non lus pour un utilisateur
     */
    public function messagesNonLus(User $user): int
    {
        return $this->messages()
            ->where('user_id', '!=', $user->id)
            ->where('lu', false)
            ->count();
    }
}
