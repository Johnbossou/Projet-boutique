<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BoutiqueUser extends Model
{
    use HasFactory;

    protected $fillable = [
        'boutique_id',
        'user_id',
        'role_dans_boutique',
    ];

    protected $table = 'boutique_user';

    // Relations
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    // Scopes
    public function scopeForBoutique($query, $boutiqueId)
    {
        return $query->where('boutique_id', $boutiqueId);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeGerants($query)
    {
        return $query->where('role_dans_boutique', 'gerant');
    }

    public function scopeCaissiers($query)
    {
        return $query->where('role_dans_boutique', 'caissier');
    }
}
