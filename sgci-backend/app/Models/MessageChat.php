<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MessageChat extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'user_id',
        'message',
        'type',
        'fichier_joint',
        'lu',
    ];

    protected $casts = [
        'lu' => 'boolean',
    ];

    /**
     * Indique si le message a été modifié après sa création.
     */
    public function estModifie(): bool
    {
        return $this->updated_at && $this->updated_at->gt($this->created_at);
    }

    /**
     * Relation avec la conversation
     */
    public function conversation()
    {
        return $this->belongsTo(ConversationChat::class, 'conversation_id');
    }

    /**
     * Relation avec l'utilisateur
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope pour les messages non lus
     */
    public function scopeNonLus($query)
    {
        return $query->where('lu', false);
    }

    /**
     * Marquer comme lu
     */
    public function marquerCommeLu(): void
    {
        $this->update(['lu' => true]);
    }
}
