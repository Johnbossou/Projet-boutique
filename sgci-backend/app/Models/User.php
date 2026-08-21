<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'telephone', 'est_actif', 'current_boutique_id'
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'derniere_connexion' => 'datetime',
        'est_actif' => 'boolean'
    ];

    // Relations
    public function ventes()
    {
        return $this->hasMany(Vente::class);
    }

    public function fcmTokens()
    {
        return $this->hasMany(FcmToken::class);
    }

    public function boutiques()
    {
        return $this->belongsToMany(Boutique::class, 'boutique_user')->withPivot('role_dans_boutique')->withTimestamps();
    }

    public function currentBoutique()
    {
        return $this->belongsTo(Boutique::class, 'current_boutique_id');
    }

    public function boutiquesPossedees()
    {
        return $this->hasMany(Boutique::class, 'proprietaire_id');
    }

    // Méthodes utilitaires
    public function estProprietaire()
    {
        return $this->role === 'proprietaire';
    }

    public function estGerant()
    {
        return $this->role === 'gerant';
    }

    public function estCaissier()
    {
        return $this->role === 'caissier';
    }

    public function getNomCompletAttribute()
    {
        return $this->name;
    }

    public function switchBoutique($boutiqueId)
    {
        if (!$this->aAccesBoutique($boutiqueId)) {
            return false;
        }

        $this->current_boutique_id = $boutiqueId;
        $this->save();
        return true;
    }

    public function aAccesBoutique($boutiqueId)
    {
        if ($this->estProprietaire()) {
            return $this->boutiquesPossedees()->where('id', $boutiqueId)->exists();
        }

        return $this->boutiques()->where('boutique_id', $boutiqueId)->exists();
    }

    // Scopes
    public function scopeForBoutique($query, $boutiqueId)
    {
        return $query->whereHas('boutiques', function ($q) use ($boutiqueId) {
            $q->where('boutique_id', $boutiqueId);
        });
    }
}
