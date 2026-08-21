<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alerte Stock</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{{ $boutique_name }}</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
            <h2 style="color: #e74c3c; margin-top: 0;">⚠️ Alerte Stock Critique</h2>
            
            <p>Bonjour <strong>{{ $user_name }}</strong>,</p>
            
            <p>Le produit suivant est en rupture de stock ou en dessous du seuil d'alerte :</p>
            
            <div style="background: white; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 18px;"><strong>{{ $product_name }}</strong></p>
                <p style="margin: 10px 0 0 0; color: #666;">
                    Stock actuel : <strong style="color: #e74c3c;">{{ $current_stock }} unités</strong><br>
                    Seuil d'alerte : {{ $threshold }} unités
                </p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                Nous vous recommandons de réapprovisionner ce produit dès que possible pour éviter les ruptures de vente.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ config('app.url') }}/stock" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Gérer le Stock</a>
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
