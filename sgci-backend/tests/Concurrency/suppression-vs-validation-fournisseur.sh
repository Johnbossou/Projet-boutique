#!/bin/bash
#
# Scenario : suppression et validation concurrentes d'une meme commande fournisseur.
#
# Pourquoi cette paire
# -------------------
# Toutes deux s'appliquent a une commande « en_attente » : valider() la passe a
# « en_cours », destroy() la supprime (soft delete). Aucune ne verrouillait la
# ligne ni ne relisait le statut avant d'agir.
#
# Ce que cela produit
# -------------------
#   - valider gagne : statut « en_cours », jamais supprimee. Correct.
#   - destroy gagne : commande supprimee ; valider ne la voit plus (404). Correct.
#   - les deux passent : la commande est « en_cours » ET supprimee. Le gerant
#     croit avoir lance l'achat, mais la commande a disparu : toute reception
#     ulterieure echoue en 404 sur une commande qu'il croyait active.
#
# Pourquoi on decale valider de 100 ms
# ------------------------------------
# Le defaut n'apparait que si valider commite AVANT le soft delete. Sans ce
# decalage, l'ordre est aleatoire et le mutant ne serait pas toujours attrape.
# Avec le correctif, le verrou rend l'ordre indifférent : valider pose le verrou
# en premier et destroy lit « en_cours ». Le decalage ne sert donc qu'a rendre
# l'anomalie reproductible cote mutant.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : exactement une transition acceptee, jamais « supprimee + en_cours »
#   sans correctif : deux transitions acceptees, commande supprimee alors qu'elle est en cours
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
  -d '{"fournisseur_id":1,"lignes":[{"produit_id":1,"quantite_commandee":2,"prix_unitaire":1000}]}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['data']['id'])")

echo "== commande fournisseur#$CID en attente =="
echo "== validation puis suppression simultanees =="

VERROU=$(conc_bloquer commande_fournisseurs "$CID" 20)

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-fournisseurs/$CID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/cfd_valider.json" -w '%{http_code}' > "$CONC_TMP/cfd_valider.code" &
VALIDER=$!

sleep 0.1

curl -s -X DELETE "http://127.0.0.1:$CONC_PORT_B/api/commandes-fournisseurs/$CID" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -o "$CONC_TMP/cfd_destroy.json" -w '%{http_code}' > "$CONC_TMP/cfd_destroy.code" &
DESTROY=$!

wait $VALIDER || true
wait $DESTROY || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$codes = [];
foreach (["cfd_valider.code", "cfd_destroy.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents(getenv("CONC_TMP")."/".$f));
}
$validerOk = $codes['cfd_valider.code'] >= 200 && $codes['cfd_valider.code'] < 300;
$destroyOk = $codes['cfd_destroy.code'] >= 200 && $codes['cfd_destroy.code'] < 300;

$commande = App\Models\CommandeFournisseur::withTrashed()->find(1);
$supprimee = $commande ? $commande->trashed() : null;
$statut = $commande ? (string) $commande->statut : '';

echo "valider : HTTP {$codes['cfd_valider.code']}, destroy : HTTP {$codes['cfd_destroy.code']}\n";
echo "supprimee : ".($supprimee === null ? 'introuvable' : ($supprimee ? 'oui' : 'non')).", statut : {$statut}\n";

$conforme = ($validerOk && ! $destroyOk && $supprimee === false && $statut === "en_cours")
    || ($destroyOk && ! $validerOk && $supprimee === true && $statut === "en_attente");

if ($commande === null) {
    echo "=> ERREUR DE SCENARIO : commande introuvable (meme avec trashed).\n";
} elseif ($validerOk && $destroyOk) {
    echo "=> ANOMALIE : commande supprimee ET en cours (deux transitions acceptees).\n";
} elseif ($conforme) {
    echo "=> CONFORME : une seule transition appliquee, etat coherent.\n";
} else {
    echo "=> ANOMALIE : valider={$codes['cfd_valider.code']}, destroy={$codes['cfd_destroy.code']}, supprimee=".($supprimee ? 'oui' : 'non').", statut={$statut}.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
