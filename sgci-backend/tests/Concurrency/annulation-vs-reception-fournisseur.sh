#!/bin/bash
#
# Scenario : annulation et reception concurrentes d'une meme commande fournisseur.
#
# Pourquoi cette paire
# -------------------
# Sur une commande « en cours », receptionner() credite le stock et peut passer
# la commande a « livre » ; annuler() la passe a « annule » sans toucher au
# stock. Les deux controle leurs statuts respectifs, mais aucune ne regardait ce
# que l'autre venait d'ecrire.
#
# Ce que cela produit
# -------------------
#   - receptionner gagne : stock credite, commande « livre ». Correct.
#   - annuler gagne : statut « annule », stock intact. Correct.
#   - les deux passent : le stock est credite ET la commande finit « annule ».
#     La marchandise est entree en stock pour une commande reputee annulee :
#     le fournisseur ne sera jamais paye pour ce qui a ete receptionne.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : une seule transition acceptee, stock coherent
#   sans correctif : deux transitions acceptees, statut et stock incoherents
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
App\Models\Fournisseur::create(["nom"=>"Fournisseur","telephone"=>"0197000000","boutique_id"=>$b->id]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

CID=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-fournisseurs" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"fournisseur_id":1,"lignes":[{"produit_id":1,"quantite_commandee":5,"prix_unitaire":1000}]}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['data']['id'])")

curl -s -o /dev/null -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-fournisseurs/$CID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}'

LIGNE_ID=$(conc_lecture "/api/commandes-fournisseurs/$CID" \
  | python -c "import json,sys;print(json.load(sys.stdin)['lignes'][0]['id'])")

echo "== commande fournisseur#$CID en cours, ligne#$LIGNE_ID de 5 =="
echo "== annulation et reception simultanees =="

VERROU=$(conc_bloquer commande_fournisseurs "$CID" 20)

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-fournisseurs/$CID/annuler" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/cf_annuler.json" -w '%{http_code}' > "$CONC_TMP/cf_annuler.code" &
ANNULER=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/commandes-fournisseurs/$CID/receptionner" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d "{\"lignes\":[{\"ligne_id\":$LIGNE_ID,\"quantite_recue\":5}]}" \
  -o "$CONC_TMP/cf_receptionner.json" -w '%{http_code}' > "$CONC_TMP/cf_receptionner.code" &
RECEPTIONNER=$!

wait $ANNULER || true
wait $RECEPTIONNER || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$codes = [];
foreach (["cf_annuler.code", "cf_receptionner.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents(getenv("CONC_TMP")."/".$f));
}
$succes = count(array_filter($codes, fn ($c) => $c >= 200 && $c < 300));

$commande = App\Models\CommandeFournisseur::find(1);
$statut = (string) ($commande->statut ?? '');
$stock = (int) App\Models\Produit::find(1)->quantite_stock;

echo "annuler : HTTP {$codes['cf_annuler.code']}, receptionner : HTTP {$codes['cf_receptionner.code']}\n";
echo "statut final : {$statut}, stock : {$stock}\n";

$coherent = ($statut === "livre" && $stock === 15)
    || ($statut === "annule" && $stock === 10);

if ($statut === "") {
    echo "=> ERREUR DE SCENARIO : commande introuvable.\n";
} elseif ($succes === 1 && $coherent) {
    echo "=> CONFORME : une seule transition appliquee, stock coherent.\n";
} elseif ($succes > 1) {
    echo "=> ANOMALIE : {$succes} transitions acceptees — statut {$statut}, stock {$stock}.\n";
} else {
    echo "=> ANOMALIE : {$succes} reussite, statut {$statut}, stock {$stock} incoherents.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
