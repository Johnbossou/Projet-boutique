<?php

$frontendUrl = env('FRONTEND_URL', 'http://localhost:3000');

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

    'allowed_origins' => array_filter([
        $frontendUrl,
        'http://localhost:3000',
        'http://localhost:8081',
        'http://localhost:19006',
        'http://10.0.2.2:8081',
    ]),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
