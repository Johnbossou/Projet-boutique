<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationPush implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $userId,
        public string $titre,
        public string $corps,
        public string $type,
        public ?array $data = null,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.push';
    }

    public function broadcastWith(): array
    {
        return [
            'titre' => $this->titre,
            'corps' => $this->corps,
            'type' => $this->type,
            'data' => $this->data,
            'created_at' => now()->toISOString(),
        ];
    }
}
