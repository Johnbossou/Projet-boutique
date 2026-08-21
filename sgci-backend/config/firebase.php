<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Firebase Project Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration pour le service Firebase Cloud Messaging (FCM)
    | Vous devez configurer les credentials Firebase dans votre fichier .env
    |
    */

    'credentials' => [
        'type' => env('FIREBASE_CREDENTIALS_TYPE', 'service_account'),
        'project_id' => env('FIREBASE_PROJECT_ID'),
        'private_key_id' => env('FIREBASE_PRIVATE_KEY_ID'),
        'private_key' => env('FIREBASE_PRIVATE_KEY'),
        'client_email' => env('FIREBASE_CLIENT_EMAIL'),
        'client_id' => env('FIREBASE_CLIENT_ID'),
        'auth_uri' => env('FIREBASE_AUTH_URI', 'https://oauth2.googleapis.com/token'),
        'token_uri' => env('FIREBASE_TOKEN_URI', 'https://oauth2.googleapis.com/token'),
        'auth_provider_x509_cert_url' => env('FIREBASE_AUTH_PROVIDER_X509_CERT_URL'),
        'client_x509_cert_url' => env('FIREBASE_CLIENT_X509_CERT_URL'),
    ],

    /*
    |--------------------------------------------------------------------------
    | FCM Settings
    |--------------------------------------------------------------------------
    |
    | Configuration spécifique pour Firebase Cloud Messaging
    |
    */

    'fcm' => [
        'default' => [
            'time_to_live' => env('FCM_TTL', 3600), // 1 heure par défaut
            'priority' => env('FCM_PRIORITY', 'high'),
            'dry_run' => env('FCM_DRY_RUN', false),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Notification Types
    |--------------------------------------------------------------------------
    |
    | Types de notifications supportés par l'application
    |
    */

    'notification_types' => [
        'stock_alert' => [
            'title' => 'Alerte Stock',
            'sound' => 'default',
            'badge' => true,
        ],
        'new_sale' => [
            'title' => 'Nouvelle Vente',
            'sound' => 'default',
            'badge' => true,
        ],
        'arrival_validated' => [
            'title' => 'Arrivage Validé',
            'sound' => 'default',
            'badge' => true,
        ],
        'test' => [
            'title' => 'Notification Test',
            'sound' => 'default',
            'badge' => false,
        ],
    ],
];
