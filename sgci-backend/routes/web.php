<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\JsonResponse;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', fn () => response()->json(['message' => 'Non authentifié.'], 401))->name('login');
