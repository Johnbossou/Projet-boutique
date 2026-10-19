#!/bin/bash
#
# Scenario : deux initiations de paiement Mobile Money simultanees sur une
# meme commande client, avec des cles d'idempotence DIFFERENTES.
#
# Pourquoi cette paire
# -------------------
# initiatePayment() controle le reste a payer puis cree une ligne Paiement
# « en_attente ». Ce qui n'est pas encore confirme n'est pas encore encaisse,
# mais c'est deja immobilise : c'est une reservation. Sans cette notion, deux
# initiations concurrentes (deux cles distinctes, donc non dedoublonnees par la
# fenetre d'idempotence) lisaient toutes deux le meme reste a payer, le
# laissaient passer, et le prestataire debitait deux fois. Les callbacks
# creditaient alors montant_paye au-dela de montant_total : la commande etait
# payee deux fois pour une dette unique.
#
# Le correctif prend un mutex par commande (Cache::lock, store « database »
# partage entre les workers) et retire du reste a payer la somme des paiements
# « en_attente ». La seconde initiation, serialisee apres la premiere, voit le
# reste tombe a zero et refuse (400) au lieu de creer une seconde ligne.
#
# Comment la course est forcee
# ----------------------------
# Le prestataire est pointe vers une adresse non routable (10.255.255.1) : le
# gagnant reste bloque dans son appel HTTP APRES avoir cree sa reservation. Le
# perdant, lui, franchit le mutex et lit la reservation tant qu'elle est
# « en_attente ». Sans ce blocage, le gagnant echouerait aussitot et libererait
# sa reservation avant que le perdant ne la voie — la course n'aurait pas lieu.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : « => CONFORME », un seul paiement cree
#   sans correctif : deux paiements crees pour la meme dette (« ANOMALIE »)
set -euo pipefail

CONC_RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$CONC_RACINE/tests/Concurrency/harness.sh"
export PATH="/c/xampp/php:$PATH"
cd "$CONC_RACINE"

# Adresse non routable : la connexion TCP reste en attente, ce qui maintient la
# reservation « en_attente » le temps que la seconde initiation la lise.
export ORANGE_MONEY_BASE_URL="http://10.255.255.1:9"

conc_preparer_base

php artisan tinker --execute='
$p = App\Models\User::create(["name"=>"Gerant","email"=>"gerant@concurrence.bj","password"=>Illuminate\Support\Facades\Hash::make("password"),"role"=>"gerant","est_actif"=>true]);
$b = App\Models\Boutique::create(["nom"=>"Boutique Concurrence","adresse"=>"Cotonou","proprietaire_id"=>$p->id]);
$p->boutiques()->attach($b->id,["role_dans_boutique"=>"gerant"]);
$p->update(["current_boutique_id"=>$b->id]);
$commande = App\Models\CommandeClient::create(["boutique_id"=>$b->id,"date_commande"=>now(),"statut"=>"en_attente","montant_total"=>10000,"montant_paye"=>0]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

CID=$(conc_sql 'echo App\Models\CommandeClient::value("id");' | tail -1)
export CID

echo "== commande client#$CID (montant_total 10000, montant_paye 0) =="
echo "== deux initiations simultanees de 10000, cles d'idempotence distinctes =="

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/mobile-money/initiate" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' --max-time 40 \
  -d "{\"amount\":10000,\"phone_number\":\"97000000\",\"provider\":\"orange\",\"commande_client_id\":$CID,\"idempotency_key\":\"cle-a\"}" \
  -o "$CONC_TMP/dip_a.json" -w '%{http_code}' > "$CONC_TMP/dip_a.code" &
INIT_A=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/mobile-money/initiate" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' --max-time 40 \
  -d "{\"amount\":10000,\"phone_number\":\"97000000\",\"provider\":\"orange\",\"commande_client_id\":$CID,\"idempotency_key\":\"cle-b\"}" \
  -o "$CONC_TMP/dip_b.json" -w '%{http_code}' > "$CONC_TMP/dip_b.code" &
INIT_B=$!

wait $INIT_A || true
wait $INIT_B || true

conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$tmp = getenv("CONC_TMP");
$cid = (int) getenv("CID");
$codeA = trim((string) @file_get_contents($tmp."/dip_a.code"));
$codeB = trim((string) @file_get_contents($tmp."/dip_b.code"));
$nb = App\Models\Paiement::where("commande_client_id", $cid)->count();
$reserves = (int) App\Models\Paiement::where("commande_client_id", $cid)->where("statut", "en_attente")->count();

echo "initiation A : HTTP {$codeA}, initiation B : HTTP {$codeB}\n";
echo "paiements crees sur la commande : {$nb}\n";

if ($nb === 1) {
    echo "=> CONFORME : une seule ligne creee, l'autre initiation a butte sur la reservation.\n";
} elseif ($nb >= 2) {
    echo "=> ANOMALIE : {$nb} paiements crees pour une dette unique — le client serait debite plusieurs fois.\n";
} else {
    echo "=> ANOMALIE : aucun paiement cree (A {$codeA}, B {$codeB}) — etat inattendu.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
