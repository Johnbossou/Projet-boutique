<?php

namespace App\Services;

use App\Models\BoutiqueSetting;
use App\Models\Vente;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

class FacturePdfService
{
    public function buildViewData(Vente $vente): array
    {
        $vente->load(['user', 'ligneVentes.produit', 'client']);
        $boutique = BoutiqueSetting::current();

        return [
            'vente' => $vente,
            'facture' => $vente,
            'boutique' => $boutique,
            'client' => $vente->client,
            'lignes' => $vente->ligneVentes,
        ];
    }

    public function html(Vente $vente): string
    {
        return view('invoices.vente', $this->buildViewData($vente))->render();
    }

    public function download(Vente $vente): Response
    {
        $pdf = Pdf::loadView('invoices.vente', $this->buildViewData($vente))
            ->setPaper('a4');

        $filename = 'facture-' . ($vente->numero_vente ?? $vente->id) . '.pdf';

        return $pdf->download($filename);
    }

    public function stream(Vente $vente): Response
    {
        $pdf = Pdf::loadView('invoices.vente', $this->buildViewData($vente))
            ->setPaper('a4');

        return $pdf->stream('facture.pdf');
    }
}
