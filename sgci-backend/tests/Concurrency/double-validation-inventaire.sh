#!/bin/bash
#
# Scenario : deux validations d'inventaire simultanees.
#
# Regle attendue
# --------------
# Un produit au stock systeme de 10, compte a 14 (ecart +4). Une seule
# validation doit appliquer l'ajustement de +4. La seconde doit relire le
# statut sous verrou, le voir passe a « valide », et refuser en 409.
#
#   avec correctif : A = 200, B = 409, stock 14, 1 mouvement d'ajustement
#   sans correctif : A = 200, B = 200, stock 18, 2 mouvements
#
# Ce que montre l'absence de verrou
# ---------------------------------
# Les deux validations lisent « en_cours », appliquent chacune le meme delta
# de +4, et le stock finit a 18 au lieu de 14. L'ecart d'inventaire est
# double : c'est precisement l'ecart que l'inventaire sert a mesurer, donc
# l'outil de controle detruit lui-meme la fiabilite du controle. Le journal
# porte deux mouvements d'ajustement pour un seul comptage.
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

$inventaire = App\Models\Inventaire::create([
    "reference"=>"INV-TEST-1",
    "boutique_id"=>$b->id,
    "user_id"=>$p->id,
    "statut"=>"termine",
    "total_produits"=>1,
    "ecarts_detectes"=>1,
]);

// Compte 14 contre un systeme a 10 : ecart de +4.
App\Models\InventaireLigne::create([
    "inventaire_id"=>$inventaire->id,
    "produit_id"=>$produit->id,
    "quantite_systeme"=>10,
    "quantite_physique"=>14,
    "ecart"=>4,
]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  conc_arreter_serveurs
  exit 1
fi

IID=$(conc_lecture "/api/inventaires?per_page=50" \
      | python -c "import json,sys;d=json.load(sys.stdin);print((d.get('data') or d)[0]['id'])")

echo "== inventaire#$IID termine, stock 10, ecart +4 => stock attendu 14 =="
echo "== deux validations simultanees =="

# Le verrou doit porter sur l'inventaire : c'est cette ligne dont le statut
# decide si un ajustement a deja ete applique.
VERROU=$(conc_bloquer inventaires "$IID" 20)

conc_appeler_simultanes "$CONC_PORT_A" "$CONC_PORT_B" \
  "/api/inventaires/$IID/valider" "$CONC_TMP/inv_a.json" "$CONC_TMP/inv_b.json"

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql '
$acceptes = 0;
$refuses = 0;

foreach (["inv_a.json", "inv_b.json"] as $nom) {
    $r = json_decode(file_get_contents(getenv("CONC_TMP")."/".$nom), true);

    if (! is_array($r)) {
        echo "=> ANOMALIE : reponse illisible ({$nom}).\n";
        continue;
    }

    if (array_key_exists("data", $r)) {
        $acceptes++;
        echo "accepte : ".$r["message"]."\n";
    } else {
        $refuses++;
        echo "refuse  : ".$r["message"]."\n";
    }
}

$stock = (int) App\Models\Produit::find(1)->quantite_stock;
$ajustements = DB::table("mouvements_stock")->where("raison", "ajustement")->count();
$statut = App\Models\Inventaire::latest("id")->first()->statut;

echo "validations acceptees : {$acceptes} (1 attendu)\n";
echo "validations refusees  : {$refuses} (1 attendu)\n";
echo "stock final           : {$stock} (14 attendu)\n";
echo "mouvements ajustement : {$ajustements} (1 attendu)\n";
echo "statut inventaire     : {$statut}\n";

if ($acceptes === 1 && $refuses === 1 && $stock === 14 && $ajustements === 1) {
    echo "=> CONFORME : un seul ajustement de +4 applique.\n";
} else {
    echo "=> ANOMALIE : stock {$stock} pour un ecart reel de +4, {$ajustements} mouvement(s).\n";
}
')

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'