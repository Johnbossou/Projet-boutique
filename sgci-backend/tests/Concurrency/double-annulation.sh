#!/bin/bash
#
# Preuve de non-regression de l'annulation en double, en VRAIE concurrence.
#
# Pourquoi ce script existe, et pas un test PHPUnit
# -------------------------------------------------
# Les tests de feature tournent dans UN processus. Deux requetes HTTP lancees
# en parallele y sont en fait traitees l'une apres l'autre par le serveur, ou
# meme par le serveur de test : la seconde lit alors la vente deja annulee et
# evite la double restitution par un hasard de timing, pas parce que le code
# est correct. C'est ce qui est arrive : avec le correctif retire, deux appels
# « paralleles » renvoyaient 200... et le stock restait bon. Faux positif.
#
# Pour que les deux requetes se lisent vraiment « termine », on verrouille la
# ligne vente depuis un tiers processus AVANT de les lancer. Les deux se
# bloquent alors sur ce verrou, le liberent ensemble, et consignent le meme
# etat initial.
#
# Ce que le script doit afficher
# ------------------------------
#   avec correctif : P1 = 200, P2 = 409, stock final = 10, 1 seul mouvement
#   sans correctif : P1 = 200, P2 = 200, stock final = 18, 2 mouvements
#
# Le second cas double la restitution : 4 unites vendues, 8 rendues.
#
# Prerequis : MariaDB/MySQL local, la base de test existe et les migrations sont
# a jour. Le script cree lui-meme son jeu de donnees.
set -euo pipefail

CONC_RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$CONC_RACINE/tests/Concurrency/harness.sh"
export PATH="/c/xampp/php:$PATH"
cd "$CONC_RACINE"

PORT_A=$CONC_PORT_A
PORT_B=$CONC_PORT_B

conc_preparer_base

php artisan tinker --execute='
$p = App\Models\User::create(["name"=>"Gerant","email"=>"gerant@concurrence.bj","password"=>Illuminate\Support\Facades\Hash::make("password"),"role"=>"gerant","est_actif"=>true]);
$b = App\Models\Boutique::create(["nom"=>"Boutique Concurrence","adresse"=>"Cotonou","proprietaire_id"=>$p->id]);
$p->boutiques()->attach($b->id,["role_dans_boutique"=>"gerant"]);
$p->update(["current_boutique_id"=>$b->id]);
$c = App\Models\Categorie::create(["nom"=>"Cat","description"=>"d","couleur"=>"#000","icone"=>"box"]);
App\Models\Produit::create(["nom"=>"Produit","description"=>"d","prix"=>1000,"quantite_stock"=>10,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);
' >/dev/null 2>&1

# Deux processus PHP distincts : c'est la seule facon d'obtenir deux sessions
# base de reelles sur cette plateforme, le serveur de developpement de PHP
# refusant de forker sous Windows. Le harnais gere le demarrage, l'attente que
# les deux repondent, et l'arret complet — y compris en cas d'interruption.
echo "== demarrage de deux serveurs independants =="
conc_demarrer_serveurs
TOKEN=$(conc_login)
# Le harnais lit CONC_TOKEN dans ses propres appels concurrents ; sans ce
# report, `set -u` le signale comme ind defini avant meme la requete.
CONC_TOKEN="$TOKEN"

if [ -z "$TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

VID=$(curl -s -X POST "http://127.0.0.1:$PORT_A/api/ventes/checkout" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"ligne_ventes":[{"produit_id":1,"quantite":4}]}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['id'])")

curl -s -o /dev/null -X POST "http://127.0.0.1:$PORT_A/api/ventes/$VID/terminer" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json' -d '{"mode_paiement":"especes"}'

echo "== vente#$VID terminee, stock attendu 6 =="

# Tiers processus : verrouille la ligne vente. Les deux requetes d'annulation
# se bloquent dessus et repartent du meme etat « termine ». La liberation a lieu
# lorsque le bloqueur constate que les deux appels sont reellement bloques —
# une duree fixe suffirait souvent, mais pas toujours, et l occasion ou le
# second appel arrive apres le commit du premier est exactement celle ou le
# scenario annoncerait un conformisme non prouve.
VERROU=$(conc_bloquer ventes "$VID" 20)

conc_appeler_simultanes "$PORT_A" "$PORT_B" \
  "/api/ventes/$VID/annuler" "$CONC_TMP/ann_a.json" "$CONC_TMP/ann_b.json"

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo
SORTIE=$(conc_sql "$(cat <<PHP
\$reference = $VID;
\$mouvements = DB::table("mouvements_stock")->where("reference_bon", \$reference)->get();
\$compensateurs = \$mouvements->where("raison", "annulation_vente")->count();
\$stock = App\Models\Produit::find(1)->quantite_stock;

echo "mouvements compensateurs : {\$compensateurs} (1 attendu)\n";
echo "stock final : {\$stock} (10 attendu)\n";

if (\$compensateurs === 1 && (int) \$stock === 10) {
    echo "=> CONFORME : une seule restitution.\n";
} else {
    echo "=> ANOMALIE : stock {\$stock}, {\$compensateurs} mouvement(s).\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
