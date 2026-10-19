#!/bin/bash
#
# Scenario : validation et refus concurrents d'un meme retour de vente.
#
# Pourquoi cette paire
# -------------------
# valider() reintegre le stock des articles rendus et passe le retour en
# « valide » ; refuser() le passe en « refuse » sans toucher au stock. Les deux
# relisent le retour SOUS VERROU (valider verrouille la vente puis le retour ;
# refuser verrouille le retour). Le controle « en_attente » de valider() et de
# refuser() porte sur le meme etat : sans verrou, un refus concurrent d'une
# validation ecrasait le statut APRES que le stock a ete credite — un retour
# « refuse » dont les articles sont en stock et revendables, la pire des deux
# issues puisque le client et le vendeur croient a des etats opposes.
#
# Ce que cela produit
# -------------------
#   - valider gagne : statut « valide », stock credite, refuser lit « valide » (409).
#   - refuser gagne : statut « refuse », stock intact, valider lit « refuse » (409).
#   - les deux passent : stock credite ET retour marque « refuse ».
#
# Comment la course est forcee
# ----------------------------
# Une session tierce verrouille le retour. Avec le correctif, valider et refuser
# s'y bloquent tous deux : le harnais mesure deux appels en attente. Sans le
# verrou cote refuser, seule la validation se bloque (1 attente mesuree), et le
# harnais signale que la course n'a pas eu lieu.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : « => CONFORME », un seul etat terminal, stock coherent
#   sans correctif : pas deux appels bloques sur le retour
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
$produit = App\Models\Produit::create(["nom"=>"Produit","description"=>"d","prix"=>1000,"quantite_stock"=>10,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);
$vente = App\Models\Vente::create(["montant_total"=>3000,"remise"=>0,"statut"=>"termine","mode_paiement"=>"especes","boutique_id"=>$b->id,"user_id"=>$p->id]);
$vente->ligneVentes()->create(["produit_id"=>$produit->id,"quantite"=>3,"prix_unitaire"=>1000,"sous_total"=>3000]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

VID=$(conc_sql 'echo App\Models\Vente::value("id");' | tail -1)
LVID=$(conc_sql 'echo App\Models\LigneVente::value("id");' | tail -1)
export VID LVID

REP=$(curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/retours" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d "{\"vente_id\":$VID,\"type\":\"partiel\",\"motif\":\"defectueux\",\"lignes\":[{\"ligne_vente_id\":$LVID,\"quantite_retournee\":3}]}")

RID=$(printf '%s' "$REP" | python -c "import json,sys;print(json.load(sys.stdin)['data']['id'])")
export RID

echo "== retour#$RID en attente (vente#$VID, 3 unites, stock produit 10) =="
echo "== validation et refus simultanes =="

VERROU=$(conc_bloquer retours_vente "$RID" 20)

curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/retours/$RID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/vvr_valider.json" -w '%{http_code}' > "$CONC_TMP/vvr_valider.code" &
VALIDER=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/retours/$RID/refuser" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/vvr_refuser.json" -w '%{http_code}' > "$CONC_TMP/vvr_refuser.code" &
REFUSER=$!

wait $VALIDER || true
wait $REFUSER || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$tmp = getenv("CONC_TMP");
$rid = (int) getenv("RID");
$codes = [];
foreach (["vvr_valider.code", "vvr_refuser.code"] as $f) {
    $codes[$f] = (int) trim((string) @file_get_contents($tmp."/".$f));
}
$validerOk = $codes['vvr_valider.code'] >= 200 && $codes['vvr_valider.code'] < 300;
$refuserOk = $codes['vvr_refuser.code'] >= 200 && $codes['vvr_refuser.code'] < 300;

$retour = App\Models\RetourVente::find($rid);
$statut = $retour ? (string) $retour->statut : 'introuvable';
$stock = (int) (App\Models\Produit::where('id', 1)->value('quantite_stock') ?? -1);

echo "valider : HTTP {$codes['vvr_valider.code']}, refuser : HTTP {$codes['vvr_refuser.code']}\n";
echo "retour : {$statut}, stock produit : {$stock}\n";

$casValide = $validerOk && ! $refuserOk && $statut === "valide" && $stock === 13;
$casRefuse = $refuserOk && ! $validerOk && $statut === "refuse" && $stock === 10;

if ($casValide) {
    echo "=> CONFORME : retour valide, stock reintegre une seule fois (13).\n";
} elseif ($casRefuse) {
    echo "=> CONFORME : retour refuse, stock intact (10).\n";
} elseif ($validerOk && $refuserOk) {
    echo "=> ANOMALIE : validation ET refus acceptes (stock credite sur un retour refuse).\n";
} else {
    echo "=> ANOMALIE : etat incoherent (valider {$codes['vvr_valider.code']}, refuser {$codes['vvr_refuser.code']}, statut {$statut}, stock {$stock}).\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
