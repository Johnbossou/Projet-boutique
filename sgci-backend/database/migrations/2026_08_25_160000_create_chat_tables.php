<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_chats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boutique_id')->nullable()->constrained('boutiques')->nullOnDelete();
            $table->string('titre')->nullable();
            $table->string('type', 30)->default('groupe');
            $table->string('statut', 30)->default('active');
            $table->timestamps();
        });

        Schema::create('conversation_participant', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversation_chats')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 30)->default('membre');
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
        });

        Schema::create('messages_chat', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversation_chats')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('message');
            $table->string('type', 30)->default('texte');
            $table->string('fichier_joint')->nullable();
            $table->boolean('lu')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages_chat');
        Schema::dropIfExists('conversation_participant');
        Schema::dropIfExists('conversation_chats');
    }
};
