<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Quotidien</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{{ $boutique_name }}</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
            <h2 style="color: #2c3e50; margin-top: 0;">📊 Rapport Quotidien</h2>
            
            <p>Bonjour <strong>{{ $user_name }}</strong>,</p>
            
            <p>Voici le résumé des ventes du <strong>{{ $date }}</strong> :</p>
            
            <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 4px; border: 1px solid #ddd;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Nombre de ventes</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #667eea;">{{ $nombre_ventes ?? 0 }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Chiffre d'affaires</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #27ae60;">{{ number_format($ca_total ?? 0, 0, ',', ' ') }} FCFA</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px;"><strong>Panier moyen</strong></td>
                        <td style="padding: 10px; text-align: right; font-weight: bold; color: #3498db;">{{ number_format($panier_moyen ?? 0, 0, ',', ' ') }} FCFA</td>
                    </tr>
                </table>
            </div>
            
            @if(isset($top_produits) && count($top_produits) > 0)
            <p style="color: #666; font-size: 14px; margin-top: 20px;"><strong>Top produits vendus :</strong></p>
            <ul style="color: #666; font-size: 14px; margin: 10px 0; padding-left: 20px;">
                @foreach($top_produits as $produit)
                <li>{{ $produit['nom'] }} ({{ $produit['quantite'] }} unités)</li>
                @endforeach
            </ul>
            @endif
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ config('app.url') }}/analytics" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Voir les Analytics Détaillés</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                Ceci est un email automatique envoyé par {{ $boutique_name }}.<br>
                {{ now()->format('d/m/Y H:i') }}
            </p>
        </div>
    </div>
</body>
</html>
