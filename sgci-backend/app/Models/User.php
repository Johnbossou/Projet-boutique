<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'telephone', 'est_actif'
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

    // Méthodes utilitaires
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
}
