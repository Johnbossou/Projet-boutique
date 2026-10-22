<?php

use App\Http\Middleware\BoutiqueScopeMiddleware;
use App\Http\Middleware\EnsureLoginAttemptsSafe;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsGerant;
use App\Http\Middleware\ProprietaireMiddleware;
use App\Http\Middleware\SanctumCookieAuth;
use App\Http\Middleware\VerifyBoutiqueManage;
use App\Http\Middleware\VerifyBoutiqueOwnership;
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
        $middleware->prepend(SanctumCookieAuth::class);
        $middleware->alias([
            'role.gerant' => EnsureUserIsGerant::class,
            'user.active' => EnsureUserIsActive::class,
            'proprietaire' => ProprietaireMiddleware::class,
            'boutique.scope' => BoutiqueScopeMiddleware::class,
            'boutique.ownership' => VerifyBoutiqueOwnership::class,
            'boutique.manage' => VerifyBoutiqueManage::class,
            'login.safe' => EnsureLoginAttemptsSafe::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
