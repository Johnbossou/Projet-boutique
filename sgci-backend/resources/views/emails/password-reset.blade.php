<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation de mot de passe</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{{ $boutique_name }}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
            <h2 style="color: #667eea; margin-top: 0;">🔐 Réinitialisation de mot de passe</h2>

            <p>Bonjour <strong>{{ $user_name }}</strong>,</p>

            <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ $reset_url }}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Réinitialiser mon mot de passe</a>
            </div>

            <p style="color: #666; font-size: 14px;">
                Ce lien est valable <strong>1 heure</strong>. S'il expire, vous pourrez en demander un nouveau.
            </p>

            <p style="color: #e74c3c; font-size: 14px;">
                ⚠️ Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste inchangé.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                Ceci est un email automatique envoyé par {{ $boutique_name }}.<br>
                {{ now()->format('d/m/Y H:i') }}
            </p>
        </div>
    </div>
</body>
</html>
