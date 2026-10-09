<?php

namespace App\Console\Commands;

use App\Models\Facture;
use App\Services\FacturationService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * Régénère les PDF de factures manquants.
 *
 * Depuis que le PDF est rendu APRÈS le commit de la facture, un échec DomPDF
 * ou un fichier effacé du stockage laisse une facture valable sans PDF. Cette
 * commande est le rattrapage : elle retrouve les factures concernées et
 * rejoue le rendu.
 *
 * Le diagnostic porte sur le disque, pas seulement sur la colonne : un
 * chemin_pdf renseigné dont le fichier a disparu compte aussi comme manquant.
 */
class RegenererPdfFacturesCommand extends Command
{
    protected $signature = 'sgci:regenerer-pdf-factures
                            {--boutique= : Limiter à une boutique (id)}
                            {--id= : Régénérer une seule facture (id)}
                            {--dry-run : Lister les factures concernées sans rien écrire}';

    protected $description = 'Régénère le PDF des factures dont le fichier est absent du stockage';

    public function handle(FacturationService $facturation): int
    {
        $factures = $this->facturesConcernees();

        if ($factures->isEmpty()) {
            $this->info('Aucune facture sans PDF.');

            return self::SUCCESS;
        }

        $this->line(sprintf('%d facture(s) à régénérer.', $factures->count()));

        if ($this->option('dry-run')) {
            foreach ($factures as $facture) {
                $this->line(sprintf(
                    '  - %s (boutique %s) : %s',
                    $facture->numero_facture,
                    $facture->boutique_id,
                    $facture->chemin_pdf ?: 'chemin_pdf vide',
                ));
            }

            $this->comment('Dry run : rien n\'a été écrit.');

            return self::SUCCESS;
        }

        $reussies = 0;
        $echecs = 0;

        foreach ($factures as $facture) {
            try {
                if ($facturation->regenererPdf($facture)) {
                    $reussies++;
                    $this->line("  OK   {$facture->numero_facture}");
                } else {
                    $echecs++;
                    $this->warn("  ?    {$facture->numero_facture} : rendu fait, fichier toujours introuvable");
                }
            } catch (\Throwable $e) {
                // On continue : une facture illisible ne doit pas empêcher les
                // suivantes d'être réparées.
                $echecs++;
                $this->error("  FAIL {$facture->numero_facture} : {$e->getMessage()}");
            }
        }

        $this->info("PDF régénérés : {$reussies}");
        $this->newLine();

        return $echecs === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return Collection<int, Facture>
     */
    private function facturesConcernees()
    {
        if ($id = $this->option('id')) {
            return Facture::whereKey($id)->get();
        }

        // Les deux cas sont groupés : sans parenthèses, le where('boutique_id')
        // ajouté ensuite ne s'appliquerait qu'à la seconde branche du OR et
        // laisserait passer toutes les factures sans chemin_pdf de tous les
        // tenants.
        $requete = Facture::query()->where(function ($q) {
            $q->whereNull('chemin_pdf')
                ->orWhere(fn ($manquants) => $manquants->whereNotNull('chemin_pdf')->where('chemin_pdf', '!=', ''));
        });

        if ($boutique = $this->option('boutique')) {
            $requete->where('boutique_id', $boutique);
        }

        // Deux passes : d'abord les colonnes vides (défaut certain), puis un
        // contrôle disque des chemins renseignés. Filtrer en base sur
        // l'existence du fichier est impossible, et charger toutes les
        // factures d'une plateforme pour vérifier un disque local n'a pas de
        // sens. D'où le plafond, avec un avertissement quand il mord.
        $plafond = 1000;

        if ((clone $requete)->limit($plafond + 1)->count() > $plafond) {
            $this->warn("Plus de {$plafond} factures à vérifier : traitement plafonné à {$plafond} par exécution.");
        }

        return (clone $requete)
            ->orderBy('id')
            ->limit($plafond)
            ->get()
            ->reject(fn (Facture $facture) => filled($facture->chemin_pdf)
                && Storage::disk('public')->exists($facture->chemin_pdf))
            ->values();
    }
}
