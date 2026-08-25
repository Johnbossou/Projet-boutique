<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaiementMisAJour implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $boutiqueId,
        public string $paymentId,
        public string $statut,
        public ?float $montant = null,
        public ?string $devise = null,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('boutique.' . $this->boutiqueId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'paiement.mis_a_jour';
    }

    public function broadcastWith(): array
    {
        return [
            'payment_id' => $this->paymentId,
            'statut' => $this->statut,
            'montant' => $this->montant,
            'devise' => $this->devise,
            'created_at' => now()->toISOString(),
        ];
    }
}
