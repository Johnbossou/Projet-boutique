#!/bin/bash
#
# Scenario : deux callbacks MobileMoney « successful » simultanes.
#
# Regle attendue
# --------------
# Une commande client de 5 000 et un paiement en attente de 5 000. Le callback
# rejoue est la normalite chez les prestataires : ils rapellent tant qu'ils
# n'ont pas eu d'acquittement, en rafale ou en retry. Un seul doit incrementer
# le montant paye de la commande.
#
#   avec correctif : commande montant_paye = 5000, 1 seul paiement reussi
#   sans correctif : commande montant_paye = 10000 (paiement compté deux fois)
#
# Ce que montre l'absence de verrou
# ---------------------------------
# applyTransition() lit « en_attente », incremente, puis ecrit. Deux callbacks
# simultanes lisent tous deux « en_attente » et chacun credite la commande :
# la commande est marquee entierement payee alors que le client n'a verse que
# la moitie. C'est la pire des issues possibles sur un paiement : la boutique
# livre une commande qui n'a pas ete entierement encaissee.
#
# Les deux reponses HTTP sont 200 dans les deux cas, par conception : un
# prestataire doit toujours lire un acquittement, sinon il rappelle. Le seul
# signe fiable est donc l'etat de la commande, que ce scenario verifie.
set -euo pipefail

CONC_RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$CONC_RACINE/tests/Concurrency/harness.sh"
export PATH="/c/xampp/php:$PATH"
cd "$CONC_RACINE"

SECRET="secret-e2e-concurrence"

conc_preparer_base

php artisan tinker --execute='
$p = App\Models\User::create(["name"=>"Gerant","email"=>"gerant@concurrence.bj","password"=>Illuminate\Support\Facades\Hash::make("password"),"role"=>"gerant","est_actif"=>true]);
$b = App\Models\Boutique::create(["nom"=>"Boutique Concurrence","adresse"=>"Cotonou","proprietaire_id"=>$p->id]);
$p->boutiques()->attach($b->id,["role_dans_boutique"=>"gerant"]);
$p->update(["current_boutique_id"=>$b->id]);

$c = App\Models\Categorie::create(["nom"=>"Cat","description"=>"d","couleur"=>"#000","icone"=>"box"]);
App\Models\Produit::create(["nom"=>"Produit","description"=>"d","prix"=>1000,"quantite_stock"=>50,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);

$client = App\Models\Client::create([
    "nom"=>"Client Test",
    "email"=>"client@concurrence.bj",
    "boutique_id"=>$b->id,
]);

$commande = App\Models\CommandeClient::create([
    "numero_commande"=>"CC-TEST-1",
    "client_id"=>$client->id,
    "boutique_id"=>$b->id,
    "statut"=>"en_attente",
    "montant_total"=>5000,
    "montant_paye"=>0,
]);

App\Models\Paiement::create([
    "numero_paiement"=>"PAY-TEST-1",
    "commande_client_id"=>$commande->id,
    "boutique_id"=>$b->id,
    "montant"=>5000,
    "mode_paiement"=>"mobile_money_mtn",
    "reference_transaction"=>"TXN-E2E-1",
    "date_paiement"=>now(),
    "statut"=>"en_attente",
    "user_id"=>$p->id,
]);
' >/dev/null

# Le callback verifie une signature HMAC du corps brut : il doit recevoir le
# secret dans son environnement, exactement comme en production. Exporte avant
# le demarrage des serveurs, qui heritent de l'environnement du script.
export MOBILE_MONEY_CALLBACK_SECRET="$SECRET"

# Une config en cache ignore les variables d'environnement : le callback
# verrait un secret vide et repondrait 501, ce qui ressemble a tort a un
# scenario casse.
php artisan config:clear >/dev/null 2>&1 || true

# Une insertion qui echoue (colonne NOT NULL oubliee, contrainte) ne dit rien en
# sortie redirigee vers /dev/null. Le scenario continuerait sur une base vide et
# rapporterait un « 0 sur 0 » qui ressemble a une regression. Verifier la
# fixture avant d'engager quoi que ce soit.
if ! conc_sql '
$c = App\Models\CommandeClient::latest("id")->first();
if (! $c || (float) $c->montant_total !== 5000.0) {
    echo "FIXTURE INCOMPLETE\n";
} else {
    echo "fixture prete\n";
}
' | grep -q "fixture prete"; then
  echo "ECHEC : la fixture de commande/paiement n'a pas ete creee." >&2
  exit 1
fi

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

CORPS='{"transaction_id":"TXN-E2E-1","status":"successful"}'
SIGNATURE=$(php -r 'echo hash_hmac("sha256", $argv[1], $argv[2]);' "$CORPS" "$SECRET")

echo "== commande de 5 000, paiement en attente de 5 000 =="
echo "== deux callbacks « successful » simultanes =="

# Le verrou porte sur la ligne paiement : c'est elle qui porte le statut.
VERROU=$(conc_bloquer paiements 1 20)

conc_callback() {
  local port="$1" fichier="$2"
  curl -s -X POST "http://127.0.0.1:$port/api/mobile-money/callback" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -H "X-SGCI-Signature: $SIGNATURE" \
    -d "$CORPS" -o "$fichier" -w "port $port: HTTP %{http_code}\n" &
}

conc_callback "$CONC_PORT_A" "$CONC_TMP/cb_a.json" &
A=$!
conc_callback "$CONC_PORT_B" "$CONC_TMP/cb_b.json" &
B=$!
wait $A || true
wait $B || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

# Le code PHP passe par un heredoc et non par une chaine entre apostrophes :
# un apostrophe dans un commentaire PHP fermerait cette chaine, et bash
# verifierait alors un script tronque au milieu du verdict.
SORTIE=$(conc_sql "$(cat <<'PHP'
$commande = App\Models\CommandeClient::latest("id")->first();
$paye = (float) $commande->montant_paye;
$total = (float) $commande->montant_total;

$paiements = App\Models\Paiement::where("statut", "reussi")->count();

echo "montant paye commande : {$paye} (5000 attendu)\n";
echo "paiements reussis    : {$paiements} (1 attendu)\n";

// Comparaison stricte sur des floats : (float) "5000.00" vaut 5000.0 des deux
// cotes, l'egalite stricte tient. En revanche un montant lu comme chaine
// ("5000.00") ne serait jamais egal a 5000.0 et ferait crier a une anomalie.
// On compare donc sur des nombres, et jamais sur la chaine renvoyee par PDO.
//
// Une fixture absente produit « 0 sur 0 » : conforme en apparence, sans
// qu'aucun code n'ait jamais servi. Le confondre avec un bug de concurrence
// ferait conclure a une regression inexistante.
if ($total === 0.0) {
    echo "=> ERREUR DE SCENARIO : la commande a ete creee sans montant. La fixture est incomplete ; tester dans le vide.\n";
} elseif ($paye === $total && $paiements === 1) {
    echo "=> CONFORME : commande creditee une seule fois.\n";
} else {
    echo "=> ANOMALIE : commande payee {$paye} sur {$total}.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'