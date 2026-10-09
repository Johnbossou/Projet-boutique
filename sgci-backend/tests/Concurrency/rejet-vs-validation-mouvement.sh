#!/bin/bash
#
# Scenario : rejet et validation concurrents du meme mouvement de stock.
#
# Pourquoi cette paire
# -------------------
# valider() et rejeter() sont deux transitions OPPOSEES de la meme ligne.
# valider() credite (ou debite) le stock et passe le mouvement a « accepte » ;
# rejeter() passe a « rejete » sans toucher au stock. Aucune ne regardait ce que
# l'autre venait d'ecrire.
#
# Ce que cela produit
# -------------------
#   - valider gagne : stock incremente, statut « accepte ». Correct.
#   - rejeter gagne : stock intact, statut « rejete ». Correct.
#   - les deux passent : le stock a bouge, mais le mouvement affiche « rejete ».
#     Le ledger et produits.quantite_stock divergent, et l ecart est invisible.
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
App\Models\MouvementStock::create([
    "produit_id"=>1,
    "quantite"=>40,
    "raison"=>"arrivage",
    "type"=>"entree",
    "reference_bon"=>"BL-1",
    "user_id"=>$p->id,
    "boutique_id"=>$b->id,
    "statut"=>"en_attente",
]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

MID=$(conc_lecture "/api/mouvements-stock?per_page=1" \
  | python -c "import json,sys;d=json.load(sys.stdin);print((d.get('data') or d)[0]['id'])")

echo "== mouvement#$MID en_attente, entree de 40 sur un stock de 10 =="
echo "== validation et rejet simultanes =="

VERROU=$(conc_bloquer mouvements_stock "$MID" 20)

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/mouvements-stock/$MID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/rj_valider.json" -w '%{http_code}' > "$CONC_TMP/rj_valider.code" &
VALIDER=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/mouvements-stock/$MID/rejeter" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{"raison_rejet":"non conforme"}' \
  -o "$CONC_TMP/rj_rejeter.json" -w '%{http_code}' > "$CONC_TMP/rj_rejeter.code" &
REJETER=$!

wait $VALIDER || true
wait $REJETER || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$codes = [];
foreach (["rj_valider.code", "rj_rejeter.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents(getenv("CONC_TMP")."/".$f));
}
$succes = count(array_filter($codes, fn ($c) => $c >= 200 && $c < 300));

$mouvement = App\Models\MouvementStock::find(1);
$statut = (string) ($mouvement->statut ?? '');
$stock = (int) App\Models\Produit::find(1)->quantite_stock;

echo "valider : HTTP {$codes['rj_valider.code']}, rejeter : HTTP {$codes['rj_rejeter.code']}\n";
echo "statut final : {$statut}, stock : {$stock}\n";

$coherent = ($statut === "accepte" && $stock === 50)
    || ($statut === "rejete" && $stock === 10);

if ($statut === "") {
    echo "=> ERREUR DE SCENARIO : mouvement introuvable.\n";
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
