<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture {{ $facture->numero_facture }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{{ $boutique->nom ?? 'SGCI Bénin' }}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Facture</p>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
            <h2 style="color: #f97316; margin-top: 0;">Votre facture</h2>

            <div style="background: white; padding: 20px; border-left: 4px solid #f97316; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 18px;"><strong>Facture #{{ $facture->numero_facture }}</strong></p>
                @if ($client)
                    <p style="margin: 10px 0 0 0; color: #666;">
                        Client : <strong>{{ $client->nom }}</strong>
                    </p>
                @endif
                <p style="margin: 10px 0 0 0; color: #666;">
                    Date : <strong>{{ $facture->date_facture ? $facture->date_facture->format('d/m/Y') : now()->format('d/m/Y') }}</strong>
                </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: white; margin: 20px 0; border-radius: 4px; overflow: hidden;">
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Montant HT</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">{{ number_format((float) $facture->montant_ht, 0, ',', ' ') }} FCFA</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">TVA</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">{{ number_format((float) $facture->montant_tva, 0, ',', ' ') }} FCFA</td>
                </tr>
                <tr>
                    <td style="padding: 12px; color: #333; font-weight: bold;">Total TTC</td>
                    <td style="padding: 12px; text-align: right; color: #f97316; font-size: 18px; font-weight: bold;">{{ number_format((float) $facture->montant_ttc, 0, ',', ' ') }} FCFA</td>
                </tr>
            </table>

            @if ($facture->notes)
                <div style="background: #fff7ed; padding: 16px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 13px; color: #9a3412;">{{ $facture->notes }}</p>
                </div>
            @endif

            <p style="color: #666; font-size: 14px;">
                Une copie PDF de votre facture est jointe à cet email.
            </p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ config('app.url') }}" style="background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accéder à la boutique</a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                Ceci est un email automatique envoyé par {{ $boutique->nom ?? 'SGCI Bénin' }}.<br>
                {{ now()->format('d/m/Y H:i') }}
            </p>
        </div>
    </div>
</body>
</html>