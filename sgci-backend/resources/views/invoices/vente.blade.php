<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Facture {{ $vente->numero_vente ?? 'VTE-'.$vente->id }}</title>
    <style>
        @page { margin: 14mm 12mm; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #1e293b;
            margin: 0;
        }
        .muted { color: #64748b; }
        .small { font-size: 9px; }

        /* NOTE DE DESSUS */
        .top-strip {
            background: #065f46;
            color: #fff;
            text-align: center;
            padding: 6px 0;
            font-size: 9px;
            letter-spacing: 2px;
            text-transform: uppercase;
            border-radius: 6px 6px 0 0;
        }

        /* EN-TÊTE */
        .header {
            border: 1px solid #d1fae5;
            background: #f0fdf4;
            border-radius: 0 0 6px 6px;
            padding: 14px 16px;
        }
        .logo-circle {
            display: inline-block;
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #065f46, #16a34a);
            color: #fff;
            font-weight: bold;
            font-size: 18px;
            line-height: 44px;
            text-align: center;
            border-radius: 50%;
            vertical-align: middle;
        }
        .biz-name { font-size: 19px; font-weight: bold; color: #065f46; }
        .title-label {
            text-align: right;
            font-size: 20px;
            font-weight: bold;
            color: #16a34a;
            letter-spacing: 3px;
        }
        .ref-badge {
            display: inline-block;
            background: #16a34a;
            color: #fff;
            font-size: 10px;
            font-weight: bold;
            padding: 4px 10px;
            border-radius: 4px;
            letter-spacing: 1px;
        }

        /* BLOCS INFOS */
        .info-box {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }
        .info-box td {
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            vertical-align: top;
            background: #ffffff;
        }
        .info-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }

        /* TABLEAU PRODUITS */
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
        }
        table.items th {
            background: #065f46;
            color: #fff;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 8px;
            text-align: left;
        }
        table.items th.num { text-align: right; }
        table.items td {
            border-bottom: 1px solid #e2e8f0;
            padding: 8px;
        }
        table.items td.num { text-align: right; }
        table.items tr.alt td { background: #f8fafc; }
        table.items tr.last td { border-bottom: 2px solid #065f46; }

        /* TOTAUX */
        .totals-box {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
        }
        .totals-box td { padding: 5px 10px; }
        .totals-box .row-label { text-align: right; color: #475569; font-size: 11px; }
        .totals-box .row-value { text-align: right; font-weight: bold; font-size: 12px; }
        .totals-box .grand-total {
            background: #065f46;
            color: #fff;
            border-radius: 6px;
        }
        .totals-box .grand-total .row-label { color: #a7f3d0; }
        .totals-box .grand-total .row-value { font-size: 16px; color: #fff; }

        /* MODE DE PAIEMENT */
        .payment {
            margin-top: 12px;
            padding: 10px 12px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 6px;
            font-size: 10px;
        }
        .payment .left { text-align: left; }
        .payment .right { text-align: right; }

        /* NOTES */
        .notes {
            margin-top: 12px;
            padding: 10px 12px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            font-size: 10px;
        }

        /* SIGNATURES */
        .sign { width: 100%; margin-top: 22px; }
        .sign td { text-align: center; font-size: 9px; color: #64748b; padding-top: 28px; }

        /* PIED DE PAGE / FAUSSE BARRE */
        .footer {
            margin-top: 18px;
            border-top: 2px solid #065f46;
            padding-top: 8px;
            text-align: center;
            font-size: 9px;
            color: #64748b;
            line-height: 1.5;
        }
        .barcode {
            font-family: DejaVu Sans Mono, monospace;
            font-size: 15px;
            letter-spacing: 2px;
            color: #0f172a;
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <!-- Bandeau supérieur -->
    <div class="top-strip">
        {{ $boutique->nom }} &middot; Reçu officiel de vente
    </div>

    <!-- En-tête -->
    <div class="header">
        <table width="100%" style="border-collapse: collapse;">
            <tr>
                <td width="12%" style="vertical-align: middle;">
                    {{-- Placeholder logo : initiales de la boutique --}}
                    <span class="logo-circle">{{ strtoupper(\Illuminate\Support\Str::substr(preg_replace('/[^A-Za-z]/', '', $boutique->nom), 0, 1) ?: 'S') }}</span>
                </td>
                <td width="50%" style="vertical-align: middle; padding-left: 10px;">
                    <div class="biz-name">{{ $boutique->nom }}</div>
                    <div class="muted small">{{ $boutique->adresse ?? 'Boutique' }}@if($boutique->telephone) &middot; Tel: {{ $boutique->telephone }}@endif</div>
                    @if($boutique->email)<div class="muted small">{{ $boutique->email }}</div>@endif
                </td>
                <td width="38%" style="vertical-align: middle; text-align: right;">
                    <div class="title-label">FACTURE</div>
                    <div style="margin-top: 6px;">
                        <span class="ref-badge">N° {{ $vente->numero_vente ?? 'VTE-'.$vente->id }}</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Informations -->
    <table class="info-box">
        <tr>
            <td width="50%">
                <div class="info-label">Date &amp; Heure</div>
                <div style="font-weight: bold; font-size: 12px;">
                    {{ $vente->created_at->format('d/m/Y') }} à {{ $vente->created_at->format('H:i') }}
                </div>
                @if(!empty($vente->date_echeance))
                    <div class="muted small" style="margin-top: 3px;">État limite: {{ \Carbon\Carbon::parse($vente->date_echeance)->format('d/m/Y') }}</div>
                @endif
                <div style="margin-top: 5px;">
                    <span class="ref-badge" style="background: #f59e0b;">{{ ucfirst(str_replace('_', ' ', $vente->statut)) }}</span>
                </div>
            </td>
            <td width="50%">
                <div class="info-label">Vendu par</div>
                <div style="font-weight: bold; font-size: 12px;">
                    {{ $vente->user?->name ?? 'Caissier' }}
                </div>
                <div style="margin-top: 8px;">
                    @if($client ?? null)
                        <div class="info-label">Client</div>
                        <div style="font-weight: bold; font-size: 12px;">{{ $client->nom }}</div>
                        @if($client->telephone)<div class="muted small">Tel: {{ $client->telephone }}</div>@endif
                        @if($client->email)<div class="muted small">Email: {{ $client->email }}</div>@endif
                        @if($client->adresse)<div class="muted small">{{ $client->adresse }}</div>@endif
                    @else
                        <div class="info-label">Client</div>
                        <div class="muted">Client de passage</div>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    <!-- Lignes de vente -->
    <table class="items">
        <thead>
            <tr>
                <th width="8%">#</th>
                <th width="46%">Produit</th>
                <th width="13%" class="num">Qté</th>
                <th width="16%" class="num">P.U. ({{ $boutique->devise }})</th>
                <th width="17%" class="num">Total ({{ $boutique->devise }})</th>
            </tr>
        </thead>
        <tbody>
            @php $i = 0; @endphp
            @foreach($vente->ligneVentes as $ligne)
                @php $i++; @endphp
                <tr class="{{ $i % 2 === 0 ? 'alt' : '' }} {{ $loop->last ? 'last' : '' }}">
                    <td>{{ $i }}</td>
                    <td>{{ $ligne->produit?->nom ?? '-' }}</td>
                    <td class="num">{{ $ligne->quantite }}</td>
                    <td class="num">{{ number_format($ligne->prix_unitaire, 0, ',', ' ') }}</td>
                    <td class="num">{{ number_format($ligne->sous_total ?? $ligne->montant_total ?? ($ligne->quantite * $ligne->prix_unitaire), 0, ',', ' ') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <!-- Totaux -->
    @php
        $remise = (float)($vente->remise ?? 0);
        $tva = (float)($vente->tva ?? 0);
        $ttc = (float)$vente->montant_total;
        $ht = $ttc - $tva;
    @endphp
    <table class="totals-box">
        @if($remise > 0)
        <tr>
            <td class="row-label">Sous-total HT</td>
            <td width="120" class="row-value">{{ number_format($ht + $remise, 0, ',', ' ') }} FCFA</td>
        </tr>
        <tr>
            <td class="row-label">Remise</td>
            <td width="120" class="row-value" style="color: #dc2626;">- {{ number_format($remise, 0, ',', ' ') }} FCFA</td>
        </tr>
        @endif
        @if($tva > 0)
        <tr>
            <td class="row-label">Montant HT</td>
            <td width="120" class="row-value">{{ number_format($ht, 0, ',', ' ') }} FCFA</td>
        </tr>
        <tr>
            <td class="row-label">TVA ({{ $boutique->taux_tva ?? 18 }}%)</td>
            <td width="120" class="row-value">{{ number_format($tva, 0, ',', ' ') }} FCFA</td>
        </tr>
        @endif
        <tr>
            <td class="row-label">Total à payer</td>
            <td width="120" class="row-value" style="font-size: 13px;">{{ number_format($ttc, 0, ',', ' ') }} FCFA</td>
        </tr>
        <tr class="grand-total">
            <td class="row-label">TOTAL {{ \Illuminate\Support\Str::upper($boutique->devise ?? 'XOF') }}</td>
            <td width="120" class="row-value">{{ number_format($ttc, 0, ',', ' ') }} {{ $boutique->devise }}</td>
        </tr>
    </table>

    <!-- Paiement -->
    <table class="payment" width="100%">
        <tr>
            <td class="left" width="60%">
                @if(!empty($vente->mode_paiement))
                    <div class="info-label">Mode de paiement</div>
                    <div style="font-weight: bold; text-transform: capitalize;">{{ str_replace('_', ' ', $vente->mode_paiement) }}</div>
                @else
                    <div class="info-label" style="text-transform: none;">Espèces / Carte</div>
                @endif
            </td>
            <td class="right" width="40%">
                @if(isset($vente->montant_recu) && $vente->montant_recu > 0)
                    <div class="info-label">Montant reçu</div>
                    <div style="font-weight: bold;">{{ number_format($vente->montant_recu, 0, ',', ' ') }} {{ $boutique->devise }}</div>
                    @if(isset($vente->monnaie_rendue) && $vente->monnaie_rendue > 0)
                        <div class="info-label" style="margin-top: 4px;">Monnaie rendue</div>
                        <div style="font-weight: bold; color: #065f46;">{{ number_format($vente->monnaie_rendue, 0, ',', ' ') }} {{ $boutique->devise }}</div>
                    @endif
                @endif
            </td>
        </tr>
    </table>

    @if(!empty($vente->notes))
        <div class="notes">
            <strong>Notes :</strong><br>
            {!! nl2br(e($vente->notes)) !!}
        </div>
    @endif

    <!-- Signatures -->
    <table class="sign">
        <tr>
            <td width="50%">Signature du vendeur</td>
            <td width="50%">Signature du client</td>
        </tr>
    </table>

    <!-- Pied -->
    <div class="footer">
        {{ $boutique->nom }} &middot; {{ $boutique->adresse ?? '' }} @if($boutique->telephone) &middot; Tel: {{ $boutique->telephone }} @endif<br>
        <div class="barcode">| |  | ||  | | |  || | |  ||| |  | ||</div>
        Merci pour votre confiance et à très bient&ocirc;t &hearts;
    </div>
</body>
</html>