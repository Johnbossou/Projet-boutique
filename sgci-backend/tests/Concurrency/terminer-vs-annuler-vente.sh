#!/bin/bash
#
# Scenario : terminaison et annulation concurrentes de la meme vente.
#
# Pourquoi cette paire
# -------------------
# terminer() sort le stock et encaisse ; annuler() sur une vente « en cours »
# ne touche pas au stock (aucune sortie n'a encore eu lieu). Ce sont deux
# transitions OPPOSEES du meme objet, et seule la concurrence revele le defaut :
#
#   - terminer gagne : stock decremente, statut « termine ». Correct.
#   - annuler gagne : statut « annule », stock intact. Correct.
#   - les deux passent : le stock est decremente ET le statut final peut etre
#     « annule ». La marchandise est sortie sans trace d'encaissement, et une
#     seconde annulation refusera la restitution puisque la vente est deja
#     « annule » — le stock est perdu, definitivement.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : une seule transition acceptee, stock coherent avec le statut
#   sans correctif : deux transitions acceptees, statut et stock incoherents
#
# Le controle porte sur le couple statut + stock : c est lui qui distingue le
# correct du double clic, pas un code HTTP isole.
set -euo pipefail

CONC_RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$CONC_RACINE/tests/Concurrency/harness.sh"
export PATH="/c/xampp/php:$PATH"
cd "$CONC_RACINE"

conc_preparer_base

php artisan tinker --execute='
$p = App\Models\User::create(["name"=>"Gerant","email"=>"gerant@concurrence.bj","password"=>Illuminate\Support\Facades\Hash::make("password"),"role"=>"gerant","est_actif"=>true]);
$b = App\Models\Boutique::create(["nom"=>"Boutique Concurrence","adresse"=>"Cotonou","proprietaire_id"=>$p->id]);
$p->boutiques()->attach($b->id,["role_dans_boutique"=>"gerant"]);
$p->update(["current_boutique_id"=>$b->id]);
$c = App\Models\Categorie::create(["nom"=>"Cat","description"=>"d","couleur"=>"#000","icone"=>"box"]);
App\Models\Produit::create(["nom"=>"Produit","description"=>"d","prix"=>1000,"quantite_stock"=>10,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

VID=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/ventes/checkout" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"ligne_ventes":[{"produit_id":1,"quantite":4}]}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['id'])")

echo "== vente#$VID en cours (4 unites), stock 10 =="
echo "== terminaison et annulation simultanees =="

# Verrou tiers sur la vente : les deux requetes se lisent « en_cours ».
VERROU=$(conc_bloquer ventes "$VID" 20)

# Corps differents : une terminaison attend le mode de paiement, une annulation
# n attend rien.
curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/ventes/$VID/terminer" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{"mode_paiement":"especes"}' \
  -o "$CONC_TMP/vt_terminer.json" -w '%{http_code}' > "$CONC_TMP/vt_terminer.code" &
TERMINER=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/ventes/$VID/annuler" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/vt_annulee.json" -w '%{http_code}' > "$CONC_TMP/vt_annulee.code" &
ANNULER=$!

wait $TERMINER || true
wait $ANNULER || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$codes = [];
foreach (["vt_terminer.code", "vt_annulee.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents(getenv("CONC_TMP")."/".$f));
}
$succes = count(array_filter($codes, fn ($c) => $c >= 200 && $c < 300));

$vente = App\Models\Vente::latest("id")->first();
$statut = (string) ($vente->statut ?? '');
$stock = (int) App\Models\Produit::find(1)->quantite_stock;
$sorties = App\Models\MouvementStock::where("reference_bon", (string) $vente->id)
    ->where("type", "sortie")
    ->count();

echo "terminer : HTTP {$codes['vt_terminer.code']}, annuler : HTTP {$codes['vt_annulee.code']}\n";
echo "statut final : {$statut}, stock : {$stock}, sorties : {$sorties}\n";

// Un seul ordre est coherent : « termine » avec un stock decremente d autant de
// sorties, ou « annule » avec le stock intact et aucune sortie. Tout autre
// couple signifie que les deux transitions sont passees.
$coherent = ($statut === "termine" && $stock === 6 && $sorties === 1)
    || ($statut === "annule" && $stock === 10 && $sorties === 0);

if ($statut === "") {
    echo "=> ERREUR DE SCENARIO : aucune vente trouvee.\n";
} elseif ($succes === 1 && $coherent) {
    echo "=> CONFORME : une seule transition appliquee, stock coherent.\n";
} elseif ($succes > 1) {
    echo "=> ANOMALIE : {$succes} transitions acceptees — statut {$statut}, stock {$stock}.\n";
} else {
    echo "=> ANOMALIE : {$succes} reussite, statut {$statut}, stock {$stock}, sorties {$sorties} incoherents.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
