<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Devis {{ $devis->numero_devis }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: bold; color: #2563eb; }
        .muted { color: #64748b; font-size: 11px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; color: #fff; }
        .badge-attente { background: #f59e0b; }
        .badge-accepte { background: #22c55e; }
        .badge-refuse { background: #ef4444; }
        .badge-expire { background: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f8fafc; }
        .totals { margin-top: 16px; text-align: right; }
        .totals div { margin: 4px 0; }
        .totals .grand-total { font-size: 14px; font-weight: bold; color: #2563eb; }
        .notes { margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div class="title">{{ $boutique->nom }}</div>
                <div class="muted">{{ $boutique->adresse }} &middot; {{ $boutique->telephone }} &middot; {{ $boutique->email }}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 18px; font-weight: bold; color: #2563eb;">DEVIS</div>
                <div class="muted">{{ $devis->numero_devis }}</div>
            </div>
        </div>
    </div>

    <table style="border: none; margin-top: 0;">
        <tr style="border: none;">
            <td style="border: none; width: 50%; vertical-align: top;">
                <strong>Date :</strong> {{ $devis->date_devis ? $devis->date_devis->format('d/m/Y') : $devis->created_at->format('d/m/Y') }}<br>
                <strong>Validité :</strong> {{ $devis->date_validite ? $devis->date_validite->format('d/m/Y') : '—' }}<br>
                <strong>Créé par :</strong> {{ $devis->user?->name ?? '—' }}
            </td>
            <td style="border: none; width: 50%; vertical-align: top; text-align: right;">
                @if($devis->client)
                    <strong>Client :</strong> {{ $devis->client->nom }}<br>
                    @if($devis->client->telephone)<span class="muted">Tél : {{ $devis->client->telephone }}</span><br>@endif
                    @if($devis->client->email)<span class="muted">Email : {{ $devis->client->email }}</span><br>@endif
                    @if($devis->client->adresse)<span class="muted">{{ $devis->client->adresse }}</span>@endif
                @else
                    <span class="muted">Client de passage</span>
                @endif
            </td>
        </tr>
    </table>

    <div style="margin: 12px 0;">
        Statut :
        @php
            $statutClass = match($devis->statut) {
                'en_attente' => 'badge-attente',
                'accepte' => 'badge-accepte',
                'refuse' => 'badge-refuse',
                default => 'badge-expire',
            };
        @endphp
        <span class="badge {{ $statutClass }}">{{ ucfirst(str_replace('_', ' ', $devis->statut)) }}</span>
    </div>

    <table>
        <thead>
            <tr>
                <th>Produit</th>
                <th style="text-align: right;">Quantité</th>
                <th style="text-align: right;">Prix unitaire</th>
                <th style="text-align: right;">Sous-total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($devis->lignes as $ligne)
                <tr>
                    <td>{{ $ligne->produit?->nom ?? '—' }}</td>
                    <td style="text-align: right;">{{ $ligne->quantite }}</td>
                    <td style="text-align: right;">{{ number_format($ligne->prix_unitaire, 0, ',', ' ') }} {{ $boutique->devise }}</td>
                    <td style="text-align: right;">{{ number_format($ligne->quantite * $ligne->prix_unitaire, 0, ',', ' ') }} {{ $boutique->devise }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <div class="grand-total">Total : {{ number_format($devis->montant_total, 0, ',', ' ') }} {{ $boutique->devise }}</div>
    </div>

    @if($devis->notes)
        <div class="notes">
            <strong>Notes :</strong><br>
            {!! nl2br(e($devis->notes)) !!}
        </div>
    @endif

    <div class="footer">
        {{ $boutique->nom }} &middot; {{ $boutique->adresse }} &middot; {{ $boutique->telephone }}<br>
        Ce devis est valable jusqu'au {{ $devis->date_validite ? $devis->date_validite->format('d/m/Y') : '—' }}.
    </div>
</body>
</html>
