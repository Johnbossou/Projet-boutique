<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nom',
        'email',
        'telephone',
        'adresse',
        'ville',
        'statut',
        'notes',
        'total_achats',
        'nombre_commandes',
        'derniere_commande'
    ];

    protected $casts = [
        'total_achats' => 'decimal:2',
        'derniere_commande' => 'datetime',
    ];

    // Relations
    public function ventes()
    {
        return $this->hasMany(Vente::class);
    }

    // Scopes
    public function scopeActifs($query)
    {
        return $query->where('statut', 'actif');
    }

    public function scopeVip($query)
    {
        return $query->where('statut', 'vip');
    }

    public function scopeInactifs($query)
    {
        return $query->where('statut', 'inactif');
    }

    // Méthodes métier
    public function mettreAJourStatistiques()
    {
        $this->nombre_commandes = $this->ventes()->count();
        $this->total_achats = $this->ventes()->sum('montant_total');
        $this->derniere_commande = $this->ventes()->latest()->first()?->created_at;
        $this->save();
    }

    public function promouvoirVip()
    {
        $this->statut = 'vip';
        $this->save();
    }

    public function desactiver()
    {
        $this->statut = 'inactif';
        $this->save();
    }
}
