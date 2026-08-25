<?php

namespace App\Events;

use App\Models\Vente;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VenteCreee implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Vente $vente,
        public ?int $boutiqueId = null,
    ) {}

    public function broadcastOn(): array
    {
        if (!$this->boutiqueId) {
            return [];
        }
        return [
            new PrivateChannel('boutique.' . $this->boutiqueId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'vente.creee';
    }

    public function broadcastWith(): array
    {
        return [
            'vente_id' => $this->vente->id,
            'numero_vente' => $this->vente->numero_vente,
            'montant_total' => $this->vente->montant_total,
            'mode_paiement' => $this->vente->mode_paiement,
            'caissier' => $this->vente->user?->name,
            'client' => $this->vente->client?->nom,
            'nombre_produits' => $this->vente->ligneVentes?->count() ?? 0,
            'created_at' => $this->vente->created_at->toISOString(),
        ];
    }
}
