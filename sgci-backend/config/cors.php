<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        // Frontend web existant
        'http://localhost:3000',

        // Expo development
        'http://localhost:8081',
        'http://localhost:19006',

        // Expo sur réseau local (ton IP)
        'exp://192.168.1.102:19000', // Remplace avec ton IP
        'http://192.168.1.102:8081', // Remplace avec ton IP

        // Android Emulator
        'http://10.0.2.2:8081',

        // iOS Simulator
        'http://localhost:8081',
    ],

    'allowed_origins_patterns' => [
        'http://192.168.*.*:8081',  // Toutes les IP locales
        'exp://192.168.*.*:19000', // Toutes les IP locales Expo
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
