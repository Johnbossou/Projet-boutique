<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UsersTableSeeder extends Seeder
{
    public function run()
    {
        User::create([
            'name' => 'Propriétaire Principal',
            'email' => 'proprietaire@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'telephone' => '+229 01 02 03 05',
        ]);

        User::create([
            'name' => 'Gerant Principal',
            'email' => 'gerant@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'telephone' => '+229 01 02 03 04',
        ]);

        User::create([
            'name' => 'Caissier Principal',
            'email' => 'caissier@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'telephone' => '+229 05 06 07 08',
        ]);

        // Ajouter d'autres utilisateurs si nécessaire
    }
}
