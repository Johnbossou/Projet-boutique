<?php

namespace App\Events;

use App\Models\Produit;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StockAlerte implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Produit $produit,
        public ?int $boutiqueId = null,
        public string $niveau = 'alerte',
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
        return 'stock.alerte';
    }

    public function broadcastWith(): array
    {
        return [
            'produit_id' => $this->produit->id,
            'nom' => $this->produit->nom,
            'quantite_stock' => $this->produit->quantite_stock,
            'seuil_alerte' => $this->produit->seuil_alerte,
            'niveau' => $this->niveau,
            'created_at' => now()->toISOString(),
        ];
    }
}
