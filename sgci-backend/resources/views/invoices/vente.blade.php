<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Facture {{ $vente->numero_vente }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        .header { border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: bold; color: #f97316; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f8fafc; }
        .totals { margin-top: 16px; text-align: right; }
        .totals div { margin: 4px 0; }
        .muted { color: #64748b; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">{{ $boutique->nom }}</div>
        <div class="muted">{{ $boutique->adresse }} · {{ $boutique->telephone }} · {{ $boutique->email }}</div>
    </div>

    <h2>Facture {{ $vente->numero_vente }}</h2>
    <p class="muted">
        Date : {{ $vente->created_at->format('d/m/Y H:i') }} ·
        Caissier : {{ $vente->user?->name }} ·
        Statut : {{ $vente->statut }}
    </p>
    @if($vente->client)
        <p><strong>Client :</strong> {{ $vente->client->nom }} @if($vente->client->telephone) · {{ $vente->client->telephone }} @endif</p>
    @endif

    <table>
        <thead>
            <tr>
                <th>Produit</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($vente->ligneVentes as $ligne)
                <tr>
                    <td>{{ $ligne->produit?->nom ?? '—' }}</td>
                    <td>{{ $ligne->quantite }}</td>
                    <td>{{ number_format($ligne->prix_unitaire, 0, ',', ' ') }} {{ $boutique->devise }}</td>
                    <td>{{ number_format($ligne->sous_total, 0, ',', ' ') }} {{ $boutique->devise }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <div>Remise : {{ number_format($vente->remise, 0, ',', ' ') }} {{ $boutique->devise }}</div>
        <div>TVA : {{ number_format($vente->tva, 0, ',', ' ') }} {{ $boutique->devise }}</div>
        <div><strong>Total TTC : {{ number_format($vente->montant_total, 0, ',', ' ') }} {{ $boutique->devise }}</strong></div>
        @if($vente->mode_paiement)
            <div class="muted">Paiement : {{ strtoupper($vente->mode_paiement) }}</div>
        @endif
    </div>

    @if($vente->notes)
        <p style="margin-top:20px;"><strong>Notes :</strong> {{ $vente->notes }}</p>
    @endif
</body>
</html>
