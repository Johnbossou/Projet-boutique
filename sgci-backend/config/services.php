<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | SMS (alertes stock, notifications)
    |--------------------------------------------------------------------------
    */
    'sms' => [
        'enabled' => env('SMS_ENABLED', false),
        'simulation' => env('SMS_SIMULATION', true),
        'api_key' => env('SMS_API_KEY', ''),
        'sender_id' => env('SMS_SENDER_ID', 'SGCI'),
        'api_url' => env('SMS_API_URL', 'https://api.smsprovider.com/send'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Mobile Money (MTN MoMo, Orange Money)
    |--------------------------------------------------------------------------
    */
    'mobile_money' => [
        // Secret partagé pour signer les callbacks (HMAC SHA-256 du corps brut).
        // Si vide, la vérification est désactivée (développement uniquement).
        'callback_secret' => env('MOBILE_MONEY_CALLBACK_SECRET', ''),
    ],

    'mtn_money' => [
        'subscription_key' => env('MTN_MOMO_SUBSCRIPTION_KEY', ''),
        'api_user' => env('MTN_MOMO_API_USER', ''),
        'api_key' => env('MTN_MOMO_API_KEY', ''),
        'base_url' => env('MTN_MOMO_BASE_URL', 'https://sandbox.momodeveloper.mtn.com'),
        'target_environment' => env('MTN_MOMO_TARGET_ENV', 'sandbox'),
        'callback_url' => env('MTN_MOMO_CALLBACK_URL', ''),
    ],

    'orange_money' => [
        'client_id' => env('ORANGE_MONEY_CLIENT_ID', ''),
        'client_secret' => env('ORANGE_MONEY_CLIENT_SECRET', ''),
        'merchant_key' => env('ORANGE_MONEY_MERCHANT_KEY', ''),
        'base_url' => env('ORANGE_MONEY_BASE_URL', 'https://api.orange.com/orange-money-webpay/ben'),
        'callback_url' => env('ORANGE_MONEY_CALLBACK_URL', ''),
    ],

];
