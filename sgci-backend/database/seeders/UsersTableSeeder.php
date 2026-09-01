<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UsersTableSeeder extends Seeder
{
    public function run()
    {
        User::firstOrCreate(
            ['email' => 'proprietaire@sgci.bj'],
            [
                'name' => 'Propriétaire Principal',
                'password' => Hash::make('password'),
                'role' => 'proprietaire',
                'telephone' => '+229 01 02 03 05',
            ]
        );

        User::firstOrCreate(
            ['email' => 'gerant@sgci.bj'],
            [
                'name' => 'Gerant Principal',
                'password' => Hash::make('password'),
                'role' => 'gerant',
                'telephone' => '+229 01 02 03 04',
            ]
        );

        User::firstOrCreate(
            ['email' => 'caissier@sgci.bj'],
            [
                'name' => 'Caissier Principal',
                'password' => Hash::make('password'),
                'role' => 'caissier',
                'telephone' => '+229 05 06 07 08',
            ]
        );

        User::firstOrCreate(
            ['email' => 'josuebossou95@gmail.com'],
            [
                'name' => 'Josue Bossou',
                'password' => Hash::make('Maygodbless'),
                'role' => 'proprietaire',
                'telephone' => '+229 97 00 00 00',
            ]
        );
    }
}
