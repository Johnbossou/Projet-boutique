<?php

namespace App\Mail;

use App\Models\Facture;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EnvoyerFacture extends Mailable
{
    use Queueable, SerializesModels;

    public Facture $facture;

    /**
     * Create a new message instance.
     */
    public function __construct(Facture $facture)
    {
        $this->facture = $facture;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Votre facture #' . $this->facture->numero_facture,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.facture',
            with: [
                'facture' => $this->facture,
                'client' => $this->facture->client,
                'boutique' => $this->facture->boutique,
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromStorageDisk('public', $this->facture->chemin_pdf)
                ->as('facture-' . $this->facture->numero_facture . '.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
