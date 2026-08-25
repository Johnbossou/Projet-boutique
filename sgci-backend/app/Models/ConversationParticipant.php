<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ConversationParticipant extends Model
{
    use HasFactory;

    protected $table = 'conversation_participant';

    protected $fillable = [
        'conversation_id',
        'user_id',
        'role',
    ];

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
     * Scope pour les administrateurs
     */
    public function scopeAdministrateurs($query)
    {
        return $query->where('role', 'admin');
    }

    /**
     * Scope pour les membres
     */
    public function scopeMembres($query)
    {
        return $query->where('role', 'membre');
    }
}
