<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Facture {{ $vente->numero_vente ?? 'VTE-'.$vente->id }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        .header { border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: bold; color: #16a34a; }
        .muted { color: #64748b; font-size: 11px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; color: #fff; }
        .badge-attente { background: #f59e0b; }
        .badge-paye { background: #22c55e; }
        .badge-termine { background: #22c55e; }
        .badge-annulee { background: #ef4444; }
        .badge-annule { background: #ef4444; }
        .badge-partiel { background: #3b82f6; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0fdf4; }
        .totals { margin-top: 16px; text-align: right; }
        .totals div { margin: 4px 0; }
        .totals .grand-total { font-size: 14px; font-weight: bold; color: #16a34a; }
        .notes { margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div class="title">{{ $boutique->nom }}</div>
                <div class="muted">{{ $boutique->adresse }} @if($boutique->telephone) &middot; {{ $boutique->telephone }} @endif @if($boutique->email) &middot; {{ $boutique->email }} @endif</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 18px; font-weight: bold; color: #16a34a;">FACTURE</div>
                <div class="muted">{{ $vente->numero_vente ?? 'VTE-'.$vente->id }}</div>
            </div>
        </div>
    </div>

    <table style="border: none; margin-top: 0;">
        <tr style="border: none;">
            <td style="border: none; width: 50%; vertical-align: top;">
                <strong>Date :</strong> {{ $vente->created_at->format('d/m/Y') }}<br>
                @if(!empty($vente->date_echeance))
                    <strong>Echeance :</strong> {{ \Carbon\Carbon::parse($vente->date_echeance)->format('d/m/Y') }}<br>
                @endif
                <strong>Statut :</strong>
                @php
                    $statutClass = match($vente->statut) {
                        'en_attente' => 'badge-attente',
                        'termine' => 'badge-termine',
                        'paye', 'payee' => 'badge-paye',
                        'annule', 'annulee' => 'badge-annulee',
                        default => 'badge-partiel',
                    };
                @endphp
                <span class="badge {{ $statutClass }}">{{ ucfirst(str_replace('_', ' ', $vente->statut)) }}</span>
            </td>
            <td style="border: none; width: 50%; vertical-align: top; text-align: right;">
                @if($client ?? null)
                    <strong>Client :</strong> {{ $client->nom }}<br>
                    @if($client->telephone)<span class="muted">Tel : {{ $client->telephone }}</span><br>@endif
                    @if($client->email)<span class="muted">Email : {{ $client->email }}</span><br>@endif
                    @if($client->adresse)<span class="muted">{{ $client->adresse }}</span>@endif
                @else
                    <span class="muted">Client de passage</span>
                @endif
            </td>
        </tr>
    </table>

    <table>
        <thead>
            <tr>
                <th>Produit</th>
                <th style="text-align: right;">Quantite</th>
                <th style="text-align: right;">Prix unitaire</th>
                <th style="text-align: right;">Sous-total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($vente->ligneVentes as $ligne)
                <tr>
                    <td>{{ $ligne->produit?->nom ?? '-' }}</td>
                    <td style="text-align: right;">{{ $ligne->quantite }}</td>
                    <td style="text-align: right;">{{ number_format($ligne->prix_unitaire, 0, ',', ' ') }} {{ $boutique->devise }}</td>
                    <td style="text-align: right;">{{ number_format($ligne->sous_total ?? $ligne->montant_total ?? ($ligne->quantite * $ligne->prix_unitaire), 0, ',', ' ') }} {{ $boutique->devise }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        @php
            $montantHT = $vente->montant_total - ($vente->tva ?? 0);
        @endphp
        @if(($vente->tva ?? 0) > 0)
            <div>HT : {{ number_format($montantHT, 0, ',', ' ') }} {{ $boutique->devise }}</div>
            <div>TVA : {{ number_format($vente->tva, 0, ',', ' ') }} {{ $boutique->devise }}</div>
        @endif
        <div class="grand-total">TTC : {{ number_format($vente->montant_total, 0, ',', ' ') }} {{ $boutique->devise }}</div>
    </div>

    @if(!empty($vente->notes))
        <div class="notes">
            <strong>Notes :</strong><br>
            {!! nl2br(e($vente->notes)) !!}
        </div>
    @endif

    <div class="footer">
        {{ $boutique->nom }} &middot; {{ $boutique->adresse }} @if($boutique->telephone) &middot; {{ $boutique->telephone }} @endif<br>
        Merci pour votre confiance.
    </div>
</body>
</html>
