#!/bin/bash
#
# Scenario : comptage et validation concurrents d'un meme inventaire.
#
# Pourquoi cette paire
# -------------------
# compter() saisit la quantite physique et calcule l'ecart ; valider() applique
# cet ecart au stock. Les deux verrouillent l'inventaire EN PREMIER (ordre
# global « inventaire -> produit »). Le controle « toutes les lignes comptees »
# de valider() et la reecriture des ecarts de compter() portent sur le meme
# etat : sans verrou, un valider concurrent d'un compter lisait des ecarts a
# moitie ecrits et ajustait le stock sur une valeur qui n'etait plus celle
# affichee, puis compter reecrivait les ecarts APRÈS l'ajustement.
#
# Ce que cela produit
# -------------------
#   - compter gagne : l'ecart est enregistre, puis valider applique le delta et
#     passe l'inventaire en « valide ». Coherent.
#   - valider gagne : la ligne n'a pas encore ete comptee, valider refuse
#     (422 « produit non compte ») et laisse le stock intact ; compter aboutit.
#     Coherent.
#   - les deux passent : le stock est ajuste sur un ecart que le comptage
#     concurrent vient de réécrire — le stock ne correspond plus au relevé.
#
# Comment la course est forcee
# ----------------------------
# Une session tierce verrouille l'inventaire. Avec le correctif, compter et
# valider s'y bloquent tous deux : le harnais mesure deux appels en attente.
# Sans le correctif cote valider, seul compter se bloque (1 attente mesuree),
# et le harnais signale que la course n'a pas eu lieu.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : « => CONFORME », stock et ecart coherents avec l'ordre gagnant
#   sans correctif : pas deux appels bloques sur l'inventaire
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

REP=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/inventaires" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' -d '{}')

IID=$(printf '%s' "$REP" | python -c "import json,sys;print(json.load(sys.stdin)['data']['id'])")
LID=$(printf '%s' "$REP" | python -c "import json,sys;print(json.load(sys.stdin)['data']['lignes'][0]['id'])")
export IID LID

echo "== inventaire#$IID en cours, produit stock 10, ligne#$LID =="
echo "== comptage(7) et validation simultanes =="

VERROU=$(conc_bloquer inventaires "$IID" 20)

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/inventaires/$IID/compter" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d "{\"lignes\":[{\"inventaire_ligne_id\":$LID,\"quantite_physique\":7}]}" \
  -o "$CONC_TMP/cvi_compter.json" -w '%{http_code}' > "$CONC_TMP/cvi_compter.code" &
COMPTER=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/inventaires/$IID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/cvi_valider.json" -w '%{http_code}' > "$CONC_TMP/cvi_valider.code" &
VALIDER=$!

wait $COMPTER || true
wait $VALIDER || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$tmp = getenv("CONC_TMP");
$iid = (int) getenv("IID");
$codes = [];
foreach (["cvi_compter.code", "cvi_valider.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents($tmp."/".$f));
}
$compterOk = $codes['cvi_compter.code'] >= 200 && $codes['cvi_compter.code'] < 300;
$validerOk = $codes['cvi_valider.code'] >= 200 && $codes['cvi_valider.code'] < 300;

$inv = App\Models\Inventaire::with('lignes')->find($iid);
$statut = $inv ? (string) $inv->statut : 'introuvable';
$ecart = $inv ? (int) $inv->lignes->first()->ecart : 0;
$stock = (int) (App\Models\Produit::where('id', 1)->value('quantite_stock') ?? -1);

echo "compter : HTTP {$codes['cvi_compter.code']}, valider : HTTP {$codes['cvi_valider.code']}\n";
echo "inventaire : {$statut}, ecart : {$ecart}, stock produit : {$stock}\n";

// Ordre possible 1 : le comptage gagne -> ecart -3 enregistre, valider applique.
$casComptageGagne = $compterOk && $validerOk && $ecart === -3 && $statut === "valide" && $stock === 7;
// Ordre possible 2 : la validation gagne -> refusee faute de comptage, stock intact.
$casValidationGagne = $compterOk && ! $validerOk && $ecart === -3 && $statut === "en_cours" && $stock === 10;

if ($casComptageGagne) {
    echo "=> CONFORME : comptage puis validation, ecart applique une seule fois (stock 7).\n";
} elseif ($casValidationGagne) {
    echo "=> CONFORME : validation refusee (ligne non comptee), stock intact, comptage enregistre.\n";
} elseif ($compterOk && $validerOk) {
    echo "=> ANOMALIE : les deux transitions sont passees alors que l'etat a change sous les pieds.\n";
} else {
    echo "=> ANOMALIE : etat incoherent (compter {$codes['cvi_compter.code']}, valider {$codes['cvi_valider.code']}, statut {$statut}, stock {$stock}).\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
