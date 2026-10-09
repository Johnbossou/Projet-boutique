#!/bin/bash
#
# Scenario : suppression d'un mouvement de stock pendant sa validation.
#
# Pourquoi cette cible
# -------------------
# destroy() et valider() sont deux transitions concurrentes sur la MEME ligne
# de mouvement, et chacune lit le statut avant d'ecrire :
#
#   - valider() teste « en_attente », puis incremente le stock du produit ;
#   - destroy() teste « en_attente », puis supprime la ligne.
#
# Elles ne se verrouillent pas l'une l'autre : valider verrouille le mouvement
# et le produit, destroy ne verrouille rien. Ce n'est donc pas deux validations
# concurrentes ( deja couvert par le scenario existant, et deja corrige), mais
# deux operations opposees sur le meme objet.
#
# Ce que cela produit
# -------------------
# Deux ordres sont possibles, et les deux sont mauvais :
#
#   - destroy gagne : le mouvement disparait, le stock n est jamais modifie.
#     La reception est perdue. Une entree de 40 unites saisie puis supprimee
#     laisse le stock a l ancien, sans aucune trace — le stock physique et le
#     stock informatique divergent sans qu'aucun rapport ne le dise.
#   - valider gagne : le stock est incremente et le mouvement passe « accepte »,
#     puis destroy le supprime quand meme. Le stock a ete bouge sans ligne de
#     ledger. L ecart est invisible et definitif.
#
# Le second est le pire, et c est celui qu on cherche aattraper : il faut que
# les deux requetes se lisent « en_attente » avant que l une des deux n ecrive.
# Le verrou tiers impose exactement cela.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : validation 200 + suppression refusee 409, stock modifie
#   sans correctif : validation 200 + suppression acceptee, aucun ledger
#
# Sur le statut HTTP de destroy : la reponse est 404 sur une ligne deja
# supprimee, ce qui est correct. Ce n est donc pas le code qui distingue les
# deux comportements — le stock et le ledger le font.
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
echo "== validation et suppression simultanees =="

# Verrou sur le mouvement : les deux requetes se lisent « en_attente ».
VERROU=$(conc_bloquer mouvements_stock "$MID" 20)

# Les deux requetes n emportent pas le meme corps : une validation attend un
# champ, une suppression n attend rien. Un helper unique envoyait le meme corps
# aux deux, ce qui aurait faussé la comparaison.
curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/mouvements-stock/$MID/valider" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/mv_valider.json" -w 'validation : HTTP %{http_code}\n' &
VALIDER=$!

curl -s -X DELETE "http://127.0.0.1:$CONC_PORT_B/api/mouvements-stock/$MID" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -o "$CONC_TMP/mv_destroy.json" -w 'suppression : HTTP %{http_code}\n' &
DESTROY=$!

wait $VALIDER || true
wait $DESTROY || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$stock = App\Models\Produit::find(1)->quantite_stock;

// MouvementStock n utilise pas SoftDeletes : la suppression est reelle, la
// ligne disparait du coup de la table.
$mouvement = App\Models\MouvementStock::find(1);
$supprime = $mouvement === null;

$ledgers = App\Models\MouvementStock::where("produit_id", 1)
    ->where("statut", "accepte")
    ->count();

echo "stock final      : {$stock} (50 attendu : 10 + 40)\n";
echo "mouvement supprime: ".($supprime ? "oui" : "non")." (non attendu)\n";
echo "mouvements acceptes: {$ledgers} (1 attendu)\n";

// Le point de controle est le couple stock + ledger. Si la validation a passe
// et que le mouvement a disparu, le stock a bouge sans trace : c est
// exactement l etat qui rend le stock non reconciliable.
if ($stock === 10 && $ledgers === 0) {
    echo "=> ERREUR DE SCENARIO : la validation n a pas eu lieu.\n";
} elseif ($supprime && $stock !== 50) {
    echo "=> ANOMALIE : mouvement supprime, stock {$stock} — la reception est perdue.\n";
} elseif ($supprime && $ledgers === 0) {
    echo "=> ANOMALIE : stock {$stock} modifie sans ligne de ledger ; ecart invisible.\n";
} else {
    echo "=> CONFORME : la validation a trace le mouvement et la suppression a ete refusee.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'