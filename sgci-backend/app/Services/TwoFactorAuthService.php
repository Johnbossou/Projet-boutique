<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use RuntimeException;

/**
 * TOTP conforme RFC 6238 (HMAC-SHA1, pas de 30 s, 6 chiffres).
 * Le secret est stocké chiffré au repos (Crypt) et décodé Base32
 * conformément à la spécification des applications authenticator.
 */
class TwoFactorAuthService
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    private const PERIOD = 30;

    private const DIGITS = 6;

    private const WINDOW = 1; // fenêtre de tolérance : ±1 période

    /**
     * Génère un nouveau secret pour l'utilisateur.
     * Retourne le secret EN CLAIR (à afficher une seule fois pour le QR code) ;
     * seule sa version chiffrée est persistée.
     */
    public function generateSecret(User $user): string
    {
        $secret = $this->generateBase32Secret();
        $this->saveEncryptedSecret($user, $secret);

        return $secret;
    }

    /**
     * Active le 2FA si le code fourni est valide
     */
    public function enableTwoFactor(User $user, string $code): bool
    {
        if (!$this->verifyCode($user, $code)) {
            return false;
        }

        $user->forceFill([
            'two_factor_enabled' => true,
            'two_factor_confirmed_at' => now(),
        ])->save();

        return true;
    }

    /**
     * Désactive le 2FA pour l'utilisateur
     */
    public function disableTwoFactor(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_enabled' => false,
            'two_factor_confirmed_at' => null,
        ])->save();
    }

    /**
     * Vérifie un code TOTP (fenêtre de tolérance ±1 période,
     * comparaison en temps constant). Aucune exception, aucun code magique :
     * un code invalide est TOUJOURS rejeté.
     */
    public function verifyCode(User $user, string $code): bool
    {
        $plainSecret = $this->getPlainSecret($user);

        if ($plainSecret === null || !preg_match('/^\d{' . self::DIGITS . '}$/', $code)) {
            return false;
        }

        $currentTime = floor(time() / self::PERIOD);

        for ($i = -self::WINDOW; $i <= self::WINDOW; $i++) {
            if (hash_equals($this->generateTOTP($plainSecret, (int) ($currentTime + $i)), $code)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Secret en clair pour l'affichage QR. Null si aucun secret n'existe.
     */
    public function getPlainSecret(User $user): ?string
    {
        if (!$user->two_factor_secret) {
            return null;
        }

        try {
            return Crypt::decryptString($user->two_factor_secret);
        } catch (\Throwable) {
            // Valeur corrompue ou héritée non chiffrée : considérer comme absente.
            return null;
        }
    }

    /**
     * Code courant d'un secret en clair — utilisé pour les tests
     * et l'affichage de secours côté support.
     */
    public function getCurrentCode(string $plainSecret): string
    {
        return $this->generateTOTP($plainSecret, (int) floor(time() / self::PERIOD));
    }

    private function saveEncryptedSecret(User $user, string $plainSecret): void
    {
        // two_factor_* sont volontairement hors $fillable : forceFill obligatoire.
        $user->forceFill([
            'two_factor_secret' => Crypt::encryptString($plainSecret),
            'two_factor_enabled' => false,
            'two_factor_confirmed_at' => null,
        ])->save();
    }

    /**
     * Génère un secret Base32 aléatoire (RFC 4648)
     */
    private function generateBase32Secret(): string
    {
        $secret = '';

        for ($i = 0; $i < 32; $i++) {
            $secret .= self::ALPHABET[random_int(0, 31)];
        }

        return $secret;
    }

    /**
     * Génère un code TOTP RFC 6238 :
     * clé HMAC = octets bruts du secret décodé en Base32,
     * message = compteur 64 bits big-endian.
     */
    private function generateTOTP(string $base32Secret, int $counter): string
    {
        $key = $this->base32Decode($base32Secret);

        if ($key === '') {
            throw new RuntimeException('Secret 2FA Base32 invalide.');
        }

        // Compteur 64 bits big-endian (RFC 4226 §5.1)
        $message = pack('N2', ($counter >> 32) & 0xFFFFFFFF, $counter & 0xFFFFFFFF);

        $hash = hash_hmac('sha1', $message, $key, true);

        // Troncature dynamique (RFC 4226 §5.3)
        $offset = ord($hash[19]) & 0x0F;
        $binary =
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF);

        $otp = $binary % (10 ** self::DIGITS);

        return str_pad((string) $otp, self::DIGITS, '0', STR_PAD_LEFT);
    }

    /**
     * Décodage Base32 strict (RFC 4648, sans padding)
     */
    private function base32Decode(string $value): string
    {
        $bits = '';
        $output = '';

        foreach (str_split(strtoupper($value)) as $char) {
            $pos = strpos(self::ALPHABET, $char);

            if ($pos === false) {
                continue; // ignore les espaces/séparateurs éventuels
            }

            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }

        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $output .= chr(bindec($byte));
            }
        }

        return $output;
    }

    /**
     * URI otpauth pour QR Code Google Authenticator
     */
    public function getQRCodeUri(User $user): string
    {
        $secret = $this->getPlainSecret($user);

        if ($secret === null) {
            throw new RuntimeException('Aucun secret 2FA généré pour cet utilisateur.');
        }

        $name = urlencode($user->email);
        $issuer = urlencode('SGCI Bénin');

        return "otpauth://totp/{$issuer}:{$name}?secret={$secret}&issuer={$issuer}";
    }
}
