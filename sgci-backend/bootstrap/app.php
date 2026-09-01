<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(\App\Http\Middleware\SanctumCookieAuth::class);
        $middleware->alias([
            'role.gerant' => \App\Http\Middleware\EnsureUserIsGerant::class,
            'user.active' => \App\Http\Middleware\EnsureUserIsActive::class,
            'proprietaire' => \App\Http\Middleware\ProprietaireMiddleware::class,
            'boutique.scope' => \App\Http\Middleware\BoutiqueScopeMiddleware::class,
            'boutique.ownership' => \App\Http\Middleware\VerifyBoutiqueOwnership::class,
            'login.safe' => \App\Http\Middleware\EnsureLoginAttemptsSafe::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
