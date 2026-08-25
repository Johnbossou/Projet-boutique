<?php

use Illuminate\Support\ServiceProvider;

return [

    'default' => env('BROADCAST_CONNECTION', 'log'),

    'connections' => [

        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'host' => env('PUSHER_HOST', 'api-mt1.pusher.com'),
                'port' => (int) env('PUSHER_PORT', 443),
                'scheme' => env('PUSHER_SCHEME', 'https'),
                'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
            ],
            'client_options' => [
                'curl' => [
                    CURLOPT_TIMEOUT => 60,
                ],
            ],
        ],

        'reverb' => [
            'driver' => 'reverb',
            'app_id' => env('REVERB_APP_ID'),
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'host' => env('REVERB_HOST', 'localhost'),
            'port' => (int) env('REVERB_PORT', 8080),
            'scheme' => env('REVERB_SCHEME', 'http'),
            'use_tls' => env('REVERB_SCHEME', 'http') === 'https',
        ],

    ],

];
