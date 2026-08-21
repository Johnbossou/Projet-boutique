<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boutique_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boutique_id')->constrained('boutiques')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('role_dans_boutique', 20)->default('caissier'); // 'gerant', 'caissier'
            $table->timestamps();

            $table->unique(['boutique_id', 'user_id']);
            $table->index('boutique_id');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boutique_user');
    }
};
