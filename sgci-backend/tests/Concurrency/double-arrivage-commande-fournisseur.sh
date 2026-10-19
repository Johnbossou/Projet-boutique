#!/bin/bash
#
# Scenario : deux arrivages directs valides en meme temps, sur deux lignes
# d'une meme commande fournisseur.
#
# Pourquoi cette paire
# -------------------
# Valider un mouvement d'arrivage (raison « arrivage » lie a une commande
# fournisseur) reporte la quantite recue sur la ligne de commande, puis passe
# la commande en « livre » quand TOUTES ses lignes sont recues. Deux lignes
# distinctes => deux produits distincts => deux verrous produit distincts : sans
# verrou sur la commande elle-meme, les deux transactions ne se disputent rien
# et lisent chacune les lignes de l'autre AVANT que l'autre n'ait committe.
# Chacune conclut « il reste une ligne non recue » et aucune ne passe la
# commande en « livre » : la commande reste bloquee en « en_cours » alors que
# tout a ete receptionne.
#
# Le correctif verrouille la commande AVANT le produit, dans l'ordre global
# « commande -> produit » deja impose par CommandeFournisseurController::
# receptionner(). Les deux transactions se serialisent alors sur la commande.
#
# Ce que cela produit
# -------------------
#   avec correctif : les deux validations passent, la commande passe en « livre »
#     (serialisation sur la commande).
#   sans correctif : les deux validations passent aussi, mais la commande reste
#     en « en_cours » (lost update sur l'etat calcule ligne par ligne).
#
# Comment la course est forcee
# ----------------------------
# Une session tierce verrouille la ligne de la commande. Si le correctif est en
# place, les DEUX validations se bloquent sur ce verrou : le harnais mesure deux
# appels en attente avant de rendre la ligne. Sans le correctif, aucun des deux
# ne touche la commande en entree et le harnais echoue a mesurer deux attentes —
# la mutation est donc attrapee par la mesure elle-meme, avant meme le verdict
# metier.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : « => CONFORME », commande « livre », deux lignes soldees
#   sans correctif : pas deux appels bloques, ou commande restee « en_cours »
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
App\Models\Produit::create(["nom"=>"Produit A","description"=>"d","prix"=>1000,"quantite_stock"=>0,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);
App\Models\Produit::create(["nom"=>"Produit B","description"=>"d","prix"=>1000,"quantite_stock"=>0,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);
App\Models\Fournisseur::create(["nom"=>"Fournisseur","telephone"=>"0197000000","boutique_id"=>$b->id]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

REP=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-fournisseurs" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"fournisseur_id":1,"lignes":[{"produit_id":1,"quantite_commandee":3,"prix_unitaire":1000},{"produit_id":2,"quantite_commandee":4,"prix_unitaire":1000}]}')

CID=$(printf '%s' "$REP" | python -c "import json,sys;print(json.load(sys.stdin)['data']['id'])")
L1=$(printf '%s' "$REP" | python -c "import json,sys;d=json.load(sys.stdin)['data']['lignes'];print([l['id'] for l in d if l['produit_id']==1][0])")
L2=$(printf '%s' "$REP" | python -c "import json,sys;d=json.load(sys.stdin)['data']['lignes'];print([l['id'] for l in d if l['produit_id']==2][0])")

# La commande doit etre « en_cours » : c'est le seul etat ou le report peut la
# faire passer en « livre ».
curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-fournisseurs/$CID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' -d '{}' >/dev/null

# Deux mouvements d'arrivage en attente, un par ligne de commande.
MA=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/mouvements-stock" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"produit_id\":1,\"quantite\":3,\"raison\":\"arrivage\",\"type\":\"entree\",\"commande_fournisseur_id\":$CID,\"ligne_commande_fournisseur_id\":$L1}" \
  | python -c "import json,sys;print(json.load(sys.stdin)['mouvement']['id'])")
MB=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/mouvements-stock" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"produit_id\":2,\"quantite\":4,\"raison\":\"arrivage\",\"type\":\"entree\",\"commande_fournisseur_id\":$CID,\"ligne_commande_fournisseur_id\":$L2}" \
  | python -c "import json,sys;print(json.load(sys.stdin)['mouvement']['id'])")

export CID L1 L2 MA MB

echo "== commande fournisseur#$CID en cours, mouvements#$MA et #$MB en attente =="
echo "== validation simultanee des deux arrivages =="

VERROU=$(conc_bloquer commande_fournisseurs "$CID" 20)

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/mouvements-stock/$MA/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/da_mva.json" -w '%{http_code}' > "$CONC_TMP/da_mva.code" &
MVA=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/mouvements-stock/$MB/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/da_mvb.json" -w '%{http_code}' > "$CONC_TMP/da_mvb.code" &
MVB=$!

wait $MVA || true
wait $MVB || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$tmp = getenv("CONC_TMP");
$cid = (int) getenv("CID");
$codes = [];
foreach (["da_mva.code", "da_mvb.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents($tmp."/".$f));
}
$aOk = $codes['da_mva.code'] >= 200 && $codes['da_mva.code'] < 300;
$bOk = $codes['da_mvb.code'] >= 200 && $codes['da_mvb.code'] < 300;

$commande = App\Models\CommandeFournisseur::with('lignes')->find($cid);
$statut = $commande ? (string) $commande->statut : 'introuvable';
$l1 = $commande ? (int) $commande->lignes->firstWhere('produit_id', 1)->quantite_recue : -1;
$l2 = $commande ? (int) $commande->lignes->firstWhere('produit_id', 2)->quantite_recue : -1;
$s1 = (int) (App\Models\Produit::where('id', 1)->value('quantite_stock') ?? -1);
$s2 = (int) (App\Models\Produit::where('id', 2)->value('quantite_stock') ?? -1);

echo "valider A : HTTP {$codes['da_mva.code']}, valider B : HTTP {$codes['da_mvb.code']}\n";
echo "commande : {$statut}, ligne1_recue : {$l1}, ligne2_recue : {$l2}, stock1 : {$s1}, stock2 : {$s2}\n";

$conforme = $aOk && $bOk && $statut === "livre" && $l1 === 3 && $l2 === 4 && $s1 === 3 && $s2 === 4;

if ($conforme) {
    echo "=> CONFORME : les deux lignes sont soldees et la commande est passee en « livre ».\n";
} elseif ($aOk && $bOk && $statut === "en_cours") {
    echo "=> ANOMALIE : les deux arrivages sont passes mais la commande est restee en « en_cours » (lost update sur l'etat de la commande).\n";
} else {
    echo "=> ANOMALIE : etat incoherent (commandes {$codes['da_mva.code']}/{$codes['da_mvb.code']}, statut {$statut}).\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
