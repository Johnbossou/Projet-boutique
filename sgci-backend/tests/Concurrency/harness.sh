#!/bin/bash
#
# Harnais de concurrence : deux processus PHP independants, une session tierce
# qui verrouille la ligne visee, puis deux appels HTTP reellement chevauchants.
#
# A sourcer, jamais execute directement :
#   source tests/Concurrency/harness.sh
#
# Pourquoi deux serveurs
# ----------------------
# Le serveur de developpement de PHP ne peut pas forker sous Windows, donc il
# traite les requetes une par une. Deux « appels paralleles » ne se chevauchent
# alors pas, et le second lit l'etat deja modifie par le premier : le test
# passe alors que le bug est actif. Deux processus distincts, eux, ont deux
# sessions base distinctes, et la contention est reelle.
#
# Pourquoi une session tierce qui verrouille
# ------------------------------------------
# Meme avec deux serveurs, deux lancements de curl ne se chevauchent pas de
# facon fiable : le second arrive souvent apres le commit du premier et evite
# la course pour une raison de timing. Verrouiller la ligne en amont oblige les
# deux appels a se bloquer, puis a repartir ensemble du meme etat.

set -uo pipefail

CONC_BASE=sgci_concurrence
CONC_PORT_A=8151
CONC_PORT_B=8152
CONC_PIDS=""

# ── Compatibilite Windows / Linux ───────────────────────────────────────────
# Le nettoyage des serveurs passe par taskkill et netstat, qui n'existent que
# sur Windows : le harnais etait donc injouable sur ubuntu-latest, ou le CI
# joue les scenarios. Ces deux fonctions sont les seules adaptations
# necessaires — le reste du harnais (bash, curl, php, python) est identique.
CONC_OS="windows"
if command -v uname >/dev/null 2>&1; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) CONC_OS="windows" ;;
    *) CONC_OS="linux" ;;
  esac
fi

# Sur les distributions Linux recentes, le binaire `python` n'existe plus :
# seuls `python3` est installe. Le harnais est SOURCE par les scenarios, donc
# une fonction Shell redefinissant `python` suffit — elle vaut aussi dans les
# sous-coquilles de pipeline, ou les scenarios extraient leurs identifiants.
if ! command -v python >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  python() {
    python3 "$@"
  }
fi

# Tue un processus et ses enfants.
conc_tuer_pid() {
  local PID="$1"

  if [ "$CONC_OS" = "windows" ]; then
    taskkill //F //T //PID "$PID" >/dev/null 2>&1 || true
  else
    # Les enfants d'abord : `artisan serve` delegue le travail a un `php -S`
    # enfant, tuer le seul parent laisserait le serveur en ecoute sur le port.
    pkill -TERM -P "$PID" >/dev/null 2>&1 || true
    kill -TERM "$PID" >/dev/null 2>&1 || true
    sleep 0.3
    pkill -KILL -P "$PID" >/dev/null 2>&1 || true
    kill -KILL "$PID" >/dev/null 2>&1 || true
  fi
}

# PID(s) qui ecoutent sur le port donne.
conc_pids_du_port() {
  local PORT="$1"

  if [ "$CONC_OS" = "windows" ]; then
    netstat -ano | grep -E ":$PORT[[:space:]].*LISTENING" \
      | awk '{print $5}' | sort -u
  elif command -v ss >/dev/null 2>&1; then
    # users:(("php",pid=1234,fd=5)) : seul le pid est utile ici.
    ss -lptnH "sport = :$PORT" 2>/dev/null \
      | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
  else
    lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null | sort -u
  fi
}

# Les reponses sont ecrites dans le projet, pas dans /tmp.
# Sous Git Bash, /tmp designe un dossier different de celui que resolvent PHP
# et Python en version Windows : les deux outils lisaient donc des fichiers
# inexistants, silencieusement. Un chemin issu du projet est vu de facon
# identique par bash, PHP et Python.
CONC_TMP="$CONC_RACINE/storage/app/concurrency"
export CONC_TMP
mkdir -p "$CONC_TMP"

conc_preparer_base() {
  export DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 \
         DB_DATABASE="$CONC_BASE" DB_USERNAME=root DB_PASSWORD=""

  php -r "\$p=new PDO('mysql:host=127.0.0.1;port=3306','root','');\$p->exec('CREATE DATABASE IF NOT EXISTS $CONC_BASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');"

  if ! php artisan migrate:fresh --force >/dev/null; then
    echo "ECHEC : migrations impossibles sur $CONC_BASE" >&2
    return 1
  fi
}

conc_demarrer_serveurs() {
  cd "$CONC_RACINE"

  # Un port deja occupe est un piege : le serveur lance ici echoue silencieusement
  # sur le bind, la boucle d'attente voit repondre l'ancien serveur, et le
  # scenario tourne contre une instance lancee par un AUTRE scenario — avec son
  # propre environnement. Le symptome est un 501 inexplique ou un resultat
  # conforme venue du mauvais serveur. Mieux vaut un echec franc.
  local PORT
  for PORT in $CONC_PORT_A $CONC_PORT_B; do
    if curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/up"; then
      echo "ECHEC : le port $PORT est deja occupe par un serveur lance ailleurs." >&2
      echo "Arretez-le (taskkill //F //IM php.exe) puis relancez." >&2
      return 1
    fi
  done

  for PORT in $CONC_PORT_A $CONC_PORT_B; do
    # La sortie des serveurs est conservee, pas jetee : un serveur qui meurt
    # en cours de scenario ne laisse aucune trace, et l'echec se resume alors
    # a « HTTP 000 » sur deux appels — impossible a diagnostiquer.
    php artisan serve --host=127.0.0.1 --port="$PORT" >"$CONC_TMP/serveur_$PORT.log" 2>&1 &
    CONC_PIDS="$CONC_PIDS $!"
  done

  # Le demarrage de deux serveurs PHP prend quelques secondes ; sans cette
  # attente le premier appel se heurte a un port encore en ecoute. Trente
  # secondes et non vingt : sur une machine chargee, l'initialisation de
  # Laravel depassait le delai, le scenario concluait « les deux serveurs ne
  # repondent pas » alors qu'ils demarraient encore, et ses deux processus
  # restaient en ecoute sur les ports — le scenario suivant echouait alors sur
  # « port deja occupe », en chaine.
  local i
  for i in $(seq 1 30); do
    if curl -s -o /dev/null -m 1 "http://127.0.0.1:$CONC_PORT_A/up" \
       && curl -s -o /dev/null -m 1 "http://127.0.0.1:$CONC_PORT_B/up"; then
      return 0
    fi
    sleep 1
  done

  echo "ECHEC : les deux serveurs ne repondent pas" >&2
  return 1
}

# Un scenario qui s'interrompt — `set -e` sur un verdict, une erreur de
# connexion — ne doit pas laisser ses serveurs en ecoute. Sans ce piege, le
# scenario suivant echoue sur « port deja occupe » pour une raison qui n'a rien
# a voir avec lui : le vrai rapport est alors le premier, et le second n'est
# qu'un faux echec a chasing. Le nettoyage devient donc automatique.
conc_piege_arret() {
  conc_arreter_serveurs
}

trap conc_piege_arret EXIT INT TERM

conc_arreter_serveurs() {
  local PID
  for PID in $CONC_PIDS; do
    # //F tue aussi les enfants : `artisan serve` delegue le travail a un
    # `php -S` enfant, et tuer le seul parent laisse le serveur en ecoute sur
    # le port. Le scenario suivant le reutiliserait alors par erreur.
    conc_tuer_pid "$PID"
  done
  CONC_PIDS=""

  # Filet de securite : le PID enregistre par bash n'est pas toujours celui
  # qui detient le port — `artisan serve` peut avoir delegue a un `php -S`
  # deja vivant. Identifier le detenteur reel du port est la seule maniere
  # fiable de rendre la machine propre, sans tuer les processus sans rapport
  # d'un developpeur qui travaille ailleurs.
  #
  # On boucle jusqu'a ce que le port ne reponde plus, et non trois fois : trois
  # secondes ne suffisaient pas toujours, le nettoyage rendait alors un
  # « AVERTISSEMENT : le port toujours occupe », et le scenario suivant
  # echouait sur « port deja occupe » — une panne de repetition, rapportee
  # comme si elle etait le fait du deuxieme scenario.
  local PORT RESTE i
  for PORT in $CONC_PORT_A $CONC_PORT_B; do
    for i in $(seq 1 15); do
      if ! curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/up"; then
        break
      fi
      # `|| true` indispensable : quand le port est enfin libre, `grep` ne
      # trouve rien et sort en erreur. Avec `set -o pipefail`, cette affectation
      # interromprait le scenario en cours de nettoyage — apres avoir deja
      # imprime ses resultats, ce qui masque le verdict.
      RESTE=$(conc_pids_du_port "$PORT" || true)
      for PID in $RESTE; do
        conc_tuer_pid "$PID"
      done
      sleep 1
    done
  done

  for PORT in $CONC_PORT_A $CONC_PORT_B; do
    if curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/up"; then
      echo "AVERTISSEMENT : le port $PORT est toujours occupe." >&2
    fi
  done
}

conc_login() {
  # Le serveur repond deja sur /up, mais le tout premier appel a /api/login
  # peut encore echouer : le processus artisan serve s'est attache au port avant
  # que l'application ne soit terminee de s'initialiser. Une reponse vide sort
  # alors de ce parseur et le scenario meurt sur un JSONDecodeError qui ne
  # dit rien sur la concurrence. On reessaie quelques fois, puis on echoue
  # franchement : un token vide ne doit jamais atteindre les scenarios.
  local i brut=""
  for i in $(seq 1 10); do
    brut=$(curl -s -m 5 -X POST "http://127.0.0.1:$CONC_PORT_A/api/login" \
      -H 'Content-Type: application/json' -H 'Accept: application/json' \
      -d '{"email":"gerant@concurrence.bj","password":"password"}' || true)

    if [ -n "$brut" ]; then
      TOKEN=$(printf '%s' "$brut" | python -c "import json,sys;print(json.load(sys.stdin).get('token',''))" 2>/dev/null || true)
      if [ -n "$TOKEN" ]; then
        printf '%s' "$TOKEN"
        return 0
      fi
    fi
    sleep 1
  done

  echo "ECHEC : authentification impossible (derniere reponse : ${brut:-vide})" >&2
  return 1
}

# Le bloqueur de ligne, execute via `php -r` : voir conc_bloquer().
#
# Il tient un verrou X sur l'entite le temps d'observer. Son role n'est pas de
# dormir une duree jugee suffisante : c'est de mesurer que les appels a tester
# sont reellement en attente, puis de rendre la ligne. Sans cette mesure, un
# serveur lent fait passer les deux appels avant l'acquisition du verrou, et le
# scenario annonce un conformisme que rien n'a teste — le faux positif le plus
# cher de tout ce harnais.
#
# La mesure se fait sur performance_schema.data_lock_waits (MySQL 8, ou
# information_schema.INNODB_LOCK_WAITS a disparu), avec repli sur
# information_schema.INNODB_LOCK_WAITS (MariaDB). Ce sont les deux seules
# sources qui repondent a la question « combien d'operations sont en attente
# sur cette ligne, maintenant » sans deviner d'apres le temps ecoule.
CONC_VERROUILLER=$(cat <<'PHP'
declare(strict_types=1);

// Sortie non bufferisee. Sur un non-tty, PHP conserve le stdio en tampon
// bloquant : la ligne « bloquee » n'atteint le fichier qu'a la fin du
// processus, donc apres liberation du verrou. Le harnais, qui attend cette
// ligne pour lancer les appels, croit alors le verrou pris alors qu'il vient
// d'etre rendu — les deux appels passent en libre, et le scenario conclut
// « 0 appel bloques » sur une course qu'il n'a jamais provoquee.
stream_set_write_buffer(STDOUT, 0);
stream_set_write_buffer(STDERR, 0);

$table = $argv[1] ?? '';
$id = $argv[2] ?? '';
$max = max(1, (int) ($argv[3] ?? 15));
$attendus = max(1, (int) ($argv[4] ?? 2));

if ($table === '' || $id === '' || ! preg_match('/^[A-Za-z0-9_]+$/', $table)) {
    fwrite(STDERR, "[verrou] parametres invalides\n");
    exit(2);
}

$env = static function (string $n, string $d = ''): string {
    $v = getenv($n);

    return $v === false ? $d : (string) $v;
};

$options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $env('DB_HOST', '127.0.0.1'), $env('DB_PORT', '3306'), $env('DB_DATABASE', 'sgci_concurrence'));

// Ouverture d'une connexion par sondage, jamais d'une seule reutilisee.
// Une connexion persistante a la table information_schema.INNODB_LOCK_WAITS lit
// un etat fige : les appels bloquaient bien quinze secondes, la mesure restait
// a zero, et le scenario concluait que la course n'avait pas eu lieu — alors
// que l'experimentation montre que deux appels etaient bel et bien en attente.
// Le cout d'une connexion par sondage (quelques millisecondes) est sans commune
// mesure avec une course non prouvee.
$connecter = static function () use ($dsn, $env, $options): PDO {
    return new PDO($dsn, $env('DB_USERNAME', 'root'), $env('DB_PASSWORD', ''), $options);
};

try {
    $pdo = $connecter();
} catch (Throwable $e) {
    fwrite(STDERR, '[verrou] connexion impossible : '.$e->getMessage()."\n");
    exit(2);
}

// Source de mesure choisie une fois : MySQL 8 expose data_lock_waits si
// performance_schema est actif, MariaDB et les MySQL ou il est desactive
// exposent INNODB_LOCK_WAITS. La choisir une fois evite de rapporter a chaque
// tour l'absence de la premiere comme si c'etait l'echec de la mesure.
$requeteAttentes = null;
foreach ([
    'SELECT COUNT(DISTINCT REQUESTING_ENGINE_TRANSACTION_ID) FROM performance_schema.data_lock_waits',
    'SELECT COUNT(DISTINCT requesting_trx_id) FROM information_schema.INNODB_LOCK_WAITS',
] as $candidat) {
    try {
        $connecter()->query($candidat)->fetchColumn();
        $requeteAttentes = $candidat;
        break;
    } catch (Throwable) {
        // Source absente : on essaie la suivante.
    }
}

if ($requeteAttentes === null) {
    fwrite(STDERR, "[verrou] mesure des attentes indisponible : aucune source exploitable\n");
    exit(3);
}

$pdo->beginTransaction();

// `SELECT *` et non une liste de colonnes : le bloqueur sert plusieurs tables,
// et une liste propre a commande_clients (montant_paye, montant_total) faisait
// echouer la preparation sur mouvements_stock. Le processus quittait alors sur
// une erreur fatale que la boucle d'attente ne reconnaissait pas, et le harnais
// patientait jusqu'au bout de son delai avant de conclure a tort que le verrou
// n'avait jamais ete pris.
$req = $pdo->prepare("SELECT * FROM {$table} WHERE id = :id FOR UPDATE");
$req->execute([':id' => $id]);
$ligne = $req->fetch();

if (! $ligne) {
    $pdo->rollBack();
    echo "[verrou] {$table}#{$id} introuvable, aucune course a organiser\n";
    exit(2);
}

// Nombre de transactions distinctes actuellement en attente de verrou.
// -1 si la mesure devient indisponible en cours de route : le scenario echoue
// alors, plutot que de laisser passer un succes qui n'a jamais ete mesure.
$attentes = static function () use ($connecter, $requeteAttentes): int {
    try {
        return (int) $connecter()->query($requeteAttentes)->fetchColumn();
    } catch (Throwable $e) {
        fwrite(STDERR, '[verrou] mesure des attentes indisponible : '.$e->getMessage()."\n");

        return -1;
    }
};

// Les colonnes d'argent ne sont affichees que si la table les porte : c'est un
// repere de lecture pour le scenario annulation-vs-livraison, pas une exigence,
// et les imposer casserait les tables de mouvement de stock.
echo sprintf(
    "[verrou] %s#%s statut=%s%s bloquee, attend %d appel(s) bloques (max %ds)\n",
    $table,
    $id,
    (string) ($ligne['statut'] ?? ''),
    array_key_exists('montant_paye', $ligne)
        ? sprintf(' montant_paye=%s montant_total=%s', (string) $ligne['montant_paye'], (string) ($ligne['montant_total'] ?? ''))
        : '',
    $attendus,
    $max
);

$debut = microtime(true);
$releve = 0;
$mesureOk = true;

// La ligne reste verrouillee pendant l'observation : c'est ce verrou qui force
// la contention. Le rendre avant la mesure reviendrait a laisser passer les
// deux appels et a ne rien tester du tout.
while (true) {
    $attente = $attentes();

    if ($attente < 0) {
        $mesureOk = false;
        break;
    }

    if ($attente >= $attendus) {
        $releve = $attente;
        break;
    }

    if (microtime(true) - $debut >= $max) {
        $releve = max($attente, 0);
        break;
    }

    usleep(100000);
}

$pdo->commit();
$ecoule = microtime(true) - $debut;
$fixe = number_format($ecoule, 2, '.', '');

if (! $mesureOk) {
    echo "[verrou] mesure des attentes indisponible, liberation apres {$fixe}s sans controle\n";
    exit(3);
}

if ($releve < $attendus) {
    echo "[verrou] seulement {$releve} appel(s) bloques sur {$attendus} attendus : la course n'a peut-etre pas eu lieu\n";
    exit(1);
}

echo "[verrou] {$releve} appel(s) bloques, liberation apres {$fixe}s\n";
echo "[verrou] liberee, donnees inchangees\n";
exit(0);
PHP
)

conc_bloquer() {
  # conc_bloquer <table> <id> [secondes_max] [attendus]
  #
  # `attendus` est le nombre d'appels qui doivent se retrouver bloques sur la
  # ligne. La liberation attend qu'ils le soient reels plutot que de presumer
  # que le delai suffira : sans cette mesure, un serveur lent fait echouer la
  # course silencieusement, et le scenario rapportait un conformisme que rien
  # n'avait teste.
  local table="$1" id="$2" max="${3:-15}" attendus="${4:-2}"
  # La sortie du bloqueur part dans un fichier, et non sur la sortie standard :
  # cette fonction est appelee par `VERROU=$(conc_bloquer ...)`, et le processus
  # de fond heriterait de ce tube. Le PID se retrouve alors melange aux lignes
  # [verrou], et `wait` echoue sur une chaine qui n'est pas un job.
  #
  # Le code du bloqueur est inline (php -r) et non dans un fichier : un .php
  # place dans tests/Concurrency est supprime par un outil de ce poste quelques
  # secondes apres son ecriture, et le scenario suivant echoue alors sur
  # « Could not open input file » — une panne qui n'a rien a voir avec la
  # concurrence et qui ne se produit que lorsque personne ne regarde.
  # Troncage explicite AVANT le lancement. Le `>` de la redirection n'a lieu
  # qu'au moment ou l'enfant s'execute : pendant cette fenetre, la boucle
  # d'attente ci-dessous relit le verrou.txt de l'execution PRECEDENTE, y
  # trouve la ligne « bloquee » ancienne, croit le verrou pris et laisse partir
  # les deux appels en libre. Le bloqueur constate alors zero attente — un
  # faux echec intermittent, plus dur a comprendre qu'un echec permanent.
  : >"$CONC_TMP/verrou.txt"

  php -r "$CONC_VERROUILLER" -- \
    "$table" "$id" "$max" "$attendus" >"$CONC_TMP/verrou.txt" 2>&1 &
  local pid=$!

  # Attendre que le verrou soit ACQUIS, pas un delai juge suffisant. Un `sleep 1`
  # laissait partir les appels avant la connexion du bloqueur quand PHP mettait
  # plus d'une seconde a demarrer : les deux appels passaient librement, le
  # bloqueur constatait zero attente, et le scenario echouait sur la course
  # n'ayant pas eu lieu — un echec vrai, mais subi plutot que produit.
  #
  # Aucun test de vie sur le PID : `kill -0` sur un php.exe lance par Git Bash
  # echoue parfois, ce qui fermait la boucle au premier tour et laissait partir
  # les appels avant l'acquisition — exactement le defaut que cette boucle
  # devait corriger. Seule la ligne du bloqueur fait foi.
  #
  # Un delai de depart est rapporte : sans lui, une acquisition qui n'a jamais
  # eu lieu se manifeste plus tard par « 0 appel bloques », qui ressemble a une
  # course non provoquee alors qu'elle est un bloqueur jamais parti.
  local debut acquis=0
  debut=$(date +%s)
  for i in $(seq 1 300); do
    if grep -q '^\[verrou\].*bloquee' "$CONC_TMP/verrou.txt" 2>/dev/null; then
      acquis=1
      break
    fi
    # Le bloqueur a quitte sans verrou : il a signale une erreur connue. Une
    # simple recherche d'une ligne [verrou] ne convient pas — elle matche la
    # ligne « bloquee » elle-meme quand celle-ci n'est arrivee qu'en partie, ce
    # qui fermait la boucle au premier tour et laissait partir les appels en
    # libre. Seules les erreurs explicites interrompent l'attente.
    #
    # Les erreurs fatales de PHP (« Uncaught PDOException », « Fatal error »)
    # sont ajoutees : une preparation refusee n'ecrit aucune ligne [verrou], et
    # sans ce cas la boucle patientait soixante secondes pleines avant de
    # conclure que le verrou n'avait jamais ete pris, au lieu de remonter la
    # vraie cause — une colonne inconnue — tout de suite.
    if grep -qE '^\[verrou\] (connexion impossible|parametres invalides|nom de table invalide|introuvable|mesure des attentes indisponible)|^(PHP )?Fatal error|Uncaught ' \
        "$CONC_TMP/verrou.txt" 2>/dev/null; then
      break
    fi
    sleep 0.2
  done

  # Rapporte le delai d'obtention du verrou : une acquisition qui n'a jamais eu
  # lieu se manifeste sinon plus tard par « 0 appel bloques », qui ressemble a
  # une course non provoquee alors que c'est un bloqueur jamais parti.
  if [ "$acquis" -ne 1 ]; then
    echo "[harnais] verrou non confirme apres $(( $(date +%s) - debut ))s" >&2
  fi

  echo "$pid"
}

conc_attendre_verrou() {
  local pid="$1"
  wait "$pid" 2>/dev/null || true

  # La sortie du bloqueur est son protocole : il y annonce le nombre d'appels
  # reellement bloques. L'ignorer reviendrait a accepter un scenario dont la
  # course n'a pas eu lieu.
  grep '^\[verrou\]' "$CONC_TMP/verrou.txt" 2>/dev/null || true

  if grep -q 'seulement' "$CONC_TMP/verrou.txt" 2>/dev/null; then
    echo "AVERTISSEMENT : la course n'a probablement pas eu lieu." >&2
    return 1
  fi
  return 0
}

conc_lecture() {
  # conc_lecture <chemin> : GET authentifie, reponse sur stdout.
  curl -s -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
    "http://127.0.0.1:$CONC_PORT_A$1"
}

conc_appeler_simultanes() {
  # conc_appeler_simultanes <port_a> <port_b> <chemin> <fichier_a> <fichier_b>
  # Un corps POST identique, deux serveurs distincts, les deux requetes lancees
  # avant tout `wait` : c'est ce qui rend la contention reelle plutot que
  # sequentielle.
  # Un 6e parametre facultatif fournit le corps. Il ne peut pas valoir la
  # valeur par defaut de bash (« {} ») : un corps vide est un cas metier
  # legitime — une validation de retour n'en attend aucun — et il doit rester
  # distinguable d'un corps non fourni.
  local port_a="$1" port_b="$2" chemin="$3" fa="$4" fb="$5" corps="${6-__CONC_CORPS_PAR_DEFAUT__}"
  local TOKEN="$CONC_TOKEN"

  if [ "$corps" = "__CONC_CORPS_PAR_DEFAUT__" ]; then
    corps='{}'
  fi

  curl -s -X POST "http://127.0.0.1:$port_a$chemin" \
    -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
    -H 'Content-Type: application/json' -d "$corps" \
    -o "$fa" -w "A: HTTP %{http_code}\n" &
  local A=$!

  curl -s -X POST "http://127.0.0.1:$port_b$chemin" \
    -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
    -H 'Content-Type: application/json' -d "$corps" \
    -o "$fb" -w "B: HTTP %{http_code}\n" &
  local B=$!

  wait $A || true
  wait $B || true
}

conc_sql() {
  # Evalue un script PHP dans le contexte applicatif et affiche sa sortie.
  #
  # Pas de exit() dans ces scripts : `php artisan tinker` transforme exit en
  # BreakException, ce qui remplit la sortie d'une trace de pile illisible et
  # laisse un code de retour trompeur. Le verdict est donc Decide par
  # conc_verifier, qui lit ce qui est affiche.
  # `|| true` : avec `set -o pipefail`, un code de sortie non nul de tinker
  # interromprait le scenario alors que sa sortie est correcte. Le code de
  # retour de tinker ne dit rien du resultat metier ; seul le contenu compte.
  php artisan tinker --execute="$1" 2>&1 | grep -vE '^\s*$|<warning>|WARNING' || true
}

conc_verifier() {
  # conc_verifier « motif attendu » : echoue si le motif n'apparait pas.
  if grep -qF "$1"; then
    return 0
  fi
  echo "=> ECHEC : « $1 » absent du resultat." >&2
  return 1
}