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
        'name', 'email', 'password', 'role', 'telephone', 'est_actif', 'current_boutique_id', 'notification_preferences'
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'derniere_connexion' => 'datetime',
        'est_actif' => 'boolean',
        'notification_preferences' => 'array',
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

    /**
     * Rôle effectif de l'utilisateur dans une boutique donnée.
     * Priorité : propriétaire (possession) > rôle du pivot >
     * sinon rôle global (dégradé) > sinon null.
     */
    public function roleDansBoutique($boutiqueId)
    {
        if (!$boutiqueId) {
            return $this->role;
        }

        // 1. Propriétaire : il possède la boutique
        if ($this->boutiquesPossedees()->where('id', $boutiqueId)->exists()) {
            return 'proprietaire';
        }

        // 2. Rôle via le pivot (gerant / caissier) — source de vérité pour les membres
        $pivot = $this->boutiques()
            ->where('boutique_user.boutique_id', $boutiqueId)
            ->first();

        if ($pivot) {
            return $pivot->pivot->role_dans_boutique ?: 'caissier';
        }

        // 3. Aucun rattachement : pas de rôle dans cette boutique
        return null;
    }

    /**
     * Vérifie si l'utilisateur a activé un type de notification donné.
     * Valeur par défaut : true (tout activé).
     */
    public function prefereNotification(string $type): bool
    {
        $prefs = $this->notification_preferences ?? [];
        return $prefs[$type] ?? true;
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

    /**
     * Recalcule le rôle global comme le rôle le plus élevé parmi ses boutiques.
     * proprietaire > gerant > caissier. Utile pour garder User.role cohérent
     * avec les rôles par boutique (multi-boutique).
     */
    public function recalculerRoleGlobal()
    {
        if ($this->boutiquesPossedees()->exists()) {
            $this->role = 'proprietaire';
            $this->save();
            return 'proprietaire';
        }

        $estGerant = $this->boutiques()
            ->wherePivot('role_dans_boutique', 'gerant')
            ->exists();
        $estRattache = $this->boutiques()->exists();

        if ($estGerant) {
            $this->role = 'gerant';
        } elseif ($estRattache) {
            $this->role = 'caissier';
        }
        $this->save();

        return $this->role;
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
