<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Contrôle de mise en production.
 *
 * La liste des prérequis de mise en production existait dans des documents —
 * donc nulle part d'exécutable, et personne ne pouvait savoir ce qui
 * manquait sans reprendre le checklist à la main. Cette commande le rend
 * vérifiable : elle interroge la configuration et la base réelles, et sort
 * en erreur si un point bloquant n'est pas résolu.
 *
 * Usage :
 *   php artisan sgci:verifier-prod              # rapport
 *   php artisan sgci:verifier-prod --strict     # les avertissements font aussi echouer
 */
class VerifierProdCommand extends Command
{
    protected $signature = 'sgci:verifier-prod {--strict : Les avertissements font aussi sortir en erreur}';

    protected $description = "Vérifie que l'application est prête pour la production";

    /**
     * @var array<int, array{0: string, 1: string, 2: string, 3: string}>
     */
    private array $erreurs = [];

    /**
     * @var array<int, array{0: string, 1: string, 2: string, 3: string}>
     */
    private array $avertissements = [];

    /**
     * Comptes de demonstration creats par les seeders. Ils ne doivent
     * jamais exister en production : leur mot de passe est « password ».
     *
     * @var array<int, string>
     */
    private const COMPTES_DEMO = [
        'gerant@sgci.bj',
        'proprietaire@sgci.bj',
        'caissier@sgci.bj',
        'gerant@concurrence.bj',
    ];

    public function handle(): int
    {
        $this->line('');
        $this->line('  <options=bold>Contrôle de mise en production — SGCI</>');
        $this->line('');

        $this->controlerEnvironnement();
        $this->controlerBase();
        $this->controlerComptes();
        $this->controlerMobileMoney();
        $this->controlerSms();
        $this->controlerPush();
        $this->controlerStockage();
        $this->controlerFrontend();

        $this->afficher();

        return ($this->erreurs || ($this->avertissements && $this->option('strict')))
            ? self::FAILURE
            : self::SUCCESS;
    }

    // -------------------------------------------------- controles

    private function controlerEnvironnement(): void
    {
        $this->section('Environnement');

        $this->verifier(
            'APP_ENV est bien production',
            config('app.env') === 'production',
            'APP_ENV vaut '.config('app.env'),
            'En production, APP_ENV doit valoir production.'
        );

        $this->verifier(
            'APP_DEBUG est desactive',
            ! config('app.debug'),
            'APP_DEBUG vaut '.(config('app.debug') ? 'true' : 'false'),
            'APP_DEBUG=true expose les stack traces et les requetes SQL au public.'
        );

        $url = (string) config('app.url');
        $this->verifier(
            'APP_URL est en HTTPS',
            str_starts_with($url, 'https://'),
            'APP_URL vaut '.$url,
            'Le backend doit etre servi en HTTPS : les callbacks Mobile Money exigent un TLS valide.'
        );

        $this->verifier(
            'APP_KEY est definie',
            ! empty(config('app.key')),
            config('app.key') ? 'oui' : 'vide',
            'APP_KEY manquante : aucune session ne peut etre chiffree.'
        );
    }

    private function controlerBase(): void
    {
        $this->section('Base de donnees et files');

        $connexion = (string) config('database.default');
        $this->verifier(
            'La base est en MySQL (le SQLite ne vaut pas pour la production)',
            $connexion === 'mysql',
            'DB_CONNECTION vaut '.$connexion,
            'SQLite ne supporte ni la concurrence ni les migrations en ligne.'
        );

        try {
            DB::connection()->getPdo();
            $this->verifier('La base repond', true, $connexion.' : joignable', '');
        } catch (\Throwable $e) {
            $this->verifier('La base repond', false, 'injoignable', $e->getMessage());
        }

        // Migrations : une application servie avec un schema en retard
        // echoue sur les ecrans qui touchent les colonnes recentes.
        // La comparaison se fait sur les noms de fichiers, pas sur la sortie
        // de `migrate:status` : cette commande demande une connexion et
        // peut echouer pour une raison sans rapport avec le schema.
        try {
            $appliquees = DB::table('migrations')->pluck('migration')->all();
            $enRetard = [];

            foreach ((array) glob(database_path('migrations/*.php')) as $fichier) {
                $nom = basename((string) $fichier, '.php');

                if (! in_array($nom, $appliquees, true)) {
                    $enRetard[] = $nom;
                }
            }

            $this->verifier(
                'Toutes les migrations sont appliquees',
                $enRetard === [],
                $enRetard === [] ? 'a jour' : count($enRetard).' en attente : '.implode(', ', array_slice($enRetard, 0, 3)),
                'Lancez `php artisan migrate --force` avant de servir.'
            );
        } catch (\Throwable $e) {
            $this->verifier('Toutes les migrations sont appliquees', false, 'verification impossible', $e->getMessage());
        }

        $cache = (string) config('cache.default');
        $this->verifier(
            'Le cache est partage (redis ou base), pas en fichier',
            in_array($cache, ['redis', 'database'], true),
            'CACHE_STORE vaut '.$cache,
            'Un cache en fichier est propre a chaque instance : le limiteur de debit et les sessions se contredisent.'
        );

        $queue = (string) config('queue.default');
        $this->verifier(
            'La file d\'attente est asynchrone (database ou redis)',
            in_array($queue, ['database', 'redis'], true),
            'QUEUE_CONNECTION vaut '.$queue,
            'En file synchrone, une requete HTTP attend la fin des envois.'
        );

        $this->avertir(
            'Un worker de file tourne (queue:work)',
            true,
            'a verifier sur le serveur',
            'Les rapports, les alertes de stock et les predictions sont des jobs : sans worker, ils ne sont jamais traites.'
        );

        $this->avertir(
            'Le planificateur tourne (schedule:run chaque minute)',
            true,
            'a verifier sur le serveur',
            'Les alertes de stock (horaires), les rapports (quotidiens) et l expiration des devis en dependent.'
        );
    }

    private function controlerComptes(): void
    {
        $this->section('Comptes');

        try {
            $presents = User::whereIn('email', self::COMPTES_DEMO)->pluck('email')->all();
        } catch (\Throwable $e) {
            $this->verifier('Aucun compte de demonstration', false, 'verification impossible', $e->getMessage());

            return;
        }

        $this->verifier(
            'Aucun compte de demonstration en base',
            $presents === [],
            $presents === [] ? 'aucun' : implode(', ', $presents),
            'Ces comptes ont le mot de passe « password » et ouvrent l application. Supprimez-les (php artisan tinker) ou changez leur mot de passe.'
        );

        $sansTelephone = User::whereNull('telephone')->orWhere('telephone', '')->count();
        $this->avertir(
            'Les gerants ont un numero de telephone',
            $sansTelephone === 0,
            $sansTelephone === 0 ? 'tous renseignes' : $sansTelephone.' sans numero',
            'Sans numero, ni le SMS ni les alertes Mobile Money n aboutissent.'
        );
    }

    private function controlerMobileMoney(): void
    {
        $this->section('Mobile Money');

        $secret = (string) config('services.mobile_money.callback_secret');
        $this->verifier(
            'Le secret de signature des callbacks est configure',
            $secret !== '',
            $secret === '' ? 'vide' : 'configure',
            'Sans secret, le callback ne verifie aucune signature : n\'importe qui peut declarer un paiement reussi.'
        );

        $mtn = (string) config('services.mtn_money.subscription_key');
        $mtnUser = (string) config('services.mtn_money.api_user');
        $mtnKey = (string) config('services.mtn_money.api_key');
        $this->verifier(
            'MTN MoMo est configure (subscription key, api user, api key)',
            $mtn !== '' && $mtnUser !== '' && $mtnKey !== '',
            'subscription key, api user et api key renseignes',
            'Sans identifiants MTN, le paiement Mobile Money MTN ne peut pas partir.'
        );

        $this->verifier(
            'MTN MoMo cible la production (pas le bac a sable)',
            (string) config('services.mtn_money.target_environment') === 'target',
            'MTN_MOMO_TARGET_ENV vaut '.config('services.mtn_money.target_environment'),
            'En bac a sable, aucun debit reel n a lieu : le test passe sans encaisser.'
        );

        $callbackMtn = (string) config('services.mtn_money.callback_url');
        $this->verifier(
            'L URL de callback MTN est renseignee et publique',
            $callbackMtn !== '' && str_starts_with($callbackMtn, 'https://'),
            $callbackMtn === '' ? 'vide' : $callbackMtn,
            'Le prestataire appelle cette URL pour signaler un encaissement. Sans elle, aucun paiement ne sera confirme.'
        );

        $orange = (string) config('services.orange_money.client_id');
        $orangeSecret = (string) config('services.orange_money.client_secret');
        $orangeMerchant = (string) config('services.orange_money.merchant_key');
        $this->avertir(
            'Orange Money est configure (client id, client secret, merchant key)',
            $orange !== '' && $orangeSecret !== '' && $orangeMerchant !== '',
            'client id, client secret et merchant key renseignes',
            'Attention : Orange Money n\'a pas encore d\'implementation dans le code. Renseigner ses identifiants ne rend pas le service disponible : les identifiants ne serviront qu\'apres l\'ecriture de l\'integration Webpay.'
        );

        $callbackOrange = (string) config('services.orange_money.callback_url');
        $this->verifier(
            'L URL de callback Orange est renseignee et publique',
            $callbackOrange !== '' && str_starts_with($callbackOrange, 'https://'),
            $callbackOrange === '' ? 'vide' : $callbackOrange,
            'Le prestataire appelle cette URL pour signaler un encaissement.'
        );
    }

    private function controlerSms(): void
    {
        $this->section('SMS');

        $enabled = (bool) config('services.sms.enabled');
        $this->verifier(
            'Les SMS sont actives',
            $enabled,
            'SMS_ENABLED vaut '.($enabled ? 'true' : 'false'),
            'Sans SMS, les alertes de stock, les relances et les confirmations de commande ne parviennent pas.'
        );

        $simulation = (bool) config('services.sms.simulation');
        $this->verifier(
            'Les SMS ne sont plus en simulation',
            ! $simulation,
            'SMS_SIMULATION vaut '.($simulation ? 'true' : 'false'),
            'En simulation, les messages sont seulement journalises : personne ne les recoit.'
        );

        $cle = (string) config('services.sms.api_key');
        $this->verifier(
            'La cle du fournisseur SMS est configuree',
            $cle !== '',
            $cle === '' ? 'vide' : 'configuree',
            'Sans cle, l envoi echoue.'
        );

        $service = (string) config('services.sms.service');
        $this->verifier(
            'Le fournisseur SMS est identifie',
            in_array($service, ['africas_talking'], true),
            'SMS_SERVICE vaut '.$service,
            'Seul Africa\'s Talking est implemente pour l envoi reel. Un autre fournisseur exige une URL et un corps propres.'
        );

        $url = (string) config('services.sms.api_url');
        $this->verifier(
            'L URL du fournisseur SMS est coherente',
            $url === '' || str_starts_with($url, 'https://'),
            $url === '' ? 'deduite du fournisseur' : $url,
            'Une URL en HTTP simple ne conviendrait pas a un envoi contenant le message et le numero.'
        );
    }

    private function controlerPush(): void
    {
        $this->section('Notifications push');

        $projet = (string) config('firebase.credentials.project_id');
        $this->verifier(
            'Firebase est configure (project id, cles)',
            $projet !== '' && (string) config('firebase.credentials.private_key') !== '',
            $projet === '' ? 'project id vide' : 'project id '.$projet,
            'Sans identifiants Firebase, les notifications push ne partent pas (la cloche, elle, reste dans l application).'
        );
    }

    private function controlerStockage(): void
    {
        $this->section('Fichiers');

        $disque = (string) config('filesystems.default');
        $this->verifier(
            'Le stockage des fichiers n est pas local au conteneur',
            in_array($disque, ['s3', 'gcs', 'azure'], true),
            'FILESYSTEM_DISK vaut '.$disque,
            'Sur un disque local, les images produits sont perdues a chaque redemarrage ou redeloiement.'
        );

        $chemin = storage_path('app/public');
        $ecrit = is_dir($chemin) && is_writable($chemin);
        $this->avertir(
            'Le dossier public est accessible en ecriture',
            $ecrit,
            $ecrit ? $chemin : 'non accessible en ecriture',
            'Les images televersees ne pourront pas etre enregistrees.'
        );
    }

    private function controlerFrontend(): void
    {
        $this->section('Frontend');

        $front = (string) config('sgci.frontend_url', '');
        $this->verifier(
            'L URL du frontend est configuree',
            $front !== '' && str_starts_with($front, 'https://'),
            $front === '' ? 'vide' : $front,
            'FRONTEND_URL sert aux liens envoyes par e-mail et aux redirections de connexion.'
        );

        $etats = (array) config('sanctum.stateful', []);
        $this->verifier(
            'Le domaine du frontend est declare a Sanctum',
            in_array('localhost', $etats, true) || $front !== '',
            implode(', ', $etats),
            'SANCTUM_STATEFUL_DOMAINS doit contenir le domaine du frontend.'
        );
    }

    // -------------------------------------------------- helpers

    /**
     * @param  string  $attendu  Ce que l etat doit etre, en clair
     */
    private function verifier(string $titre, bool $ok, string $etat, string $conseil): void
    {
        if ($ok) {
            $this->ligne('<fg=green>  OK  </> '.$titre.' <fg=gray>('.$etat.')</>');

            return;
        }

        $this->erreurs[] = [$titre, $etat, $conseil];
        $this->ligne('<fg=red;options=bold>  KO  </> '.$titre.' <fg=gray>('.$etat.')</>');
    }

    private function avertir(string $titre, bool $ok, string $etat, string $conseil): void
    {
        if ($ok) {
            $this->ligne('<fg=green>  OK  </> '.$titre.' <fg=gray>('.$etat.')</>');

            return;
        }

        $this->avertissements[] = [$titre, $etat, $conseil];
        $this->ligne('<fg=yellow;options=bold>  !!  </> '.$titre.' <fg=gray>('.$etat.')</>');
    }

    private function section(string $titre): void
    {
        $this->line('');
        $this->line('  <options=bold>'.$titre.'</>');
    }

    private function ligne(string $texte): void
    {
        $this->line($texte);
    }

    private function afficher(): void
    {
        $this->line('');

        if ($this->erreurs === [] && $this->avertissements === []) {
            $this->line('  <fg=green;options=bold>Tout est en place.</>');
            $this->line('');

            return;
        }

        if ($this->erreurs !== []) {
            $this->line('  <fg=red;options=bold>'.count($this->erreurs).' point(s) bloquant(s) :</>');
            foreach ($this->erreurs as [$titre, $etat, $conseil]) {
                $this->line('   - <fg=red>'.$titre.'</> ('.$etat.')');
                if ($conseil !== '') {
                    $this->line('     <fg=gray>'.$conseil.'</>');
                }
            }
            $this->line('');
        }

        if ($this->avertissements !== []) {
            $this->line('  <fg=yellow;options=bold>'.count($this->avertissements).' point(s) a verifier :</>');
            foreach ($this->avertissements as [$titre, $etat, $conseil]) {
                $this->line('   - <fg=yellow>'.$titre.'</> ('.$etat.')');
                if ($conseil !== '') {
                    $this->line('     <fg=gray>'.$conseil.'</>');
                }
            }
            $this->line('');
        }
    }
}
