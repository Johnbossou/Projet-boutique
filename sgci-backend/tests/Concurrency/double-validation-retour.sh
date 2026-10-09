#!/bin/bash
#
# Scenario : deux validations du MEME retour simultanees.
#
# Regle attendue
# --------------
# Une vente de 4 unites (stock 10 -> 6) et un retour de 2 unites en attente.
# Une seule validation doit crediter le stock de 2 (6 -> 8). La seconde doit
# relire le statut sous verrou, le voir passe a « valide », et refuser en 409.
#
#   avec correctif : A = 200, B = 409, stock 8, 1 mouvement « retour »
#   sans correctif : A = 200, B = 200, stock 10, 2 mouvements
#
# Ce que montre l'absence de verrou
# ---------------------------------
# Le stock repart de 10 alors que 4 unites seulement ont ete vendues : 6 sont
# presentes en magasin sans avoir jamais ete encaissees. L'ecart est
# exactement ce que le retour pretendait mesurer, et il est invisible a l'ecran
# puisque le client ne voit que la vente et le retour, tous deux corrects.
#
# Le verrou porte sur la VENTE avant le retour. Deux validations concurrentes
# portant sur le meme retour se disputeraient bien la ligne du retour, mais
# c'est la vente qui porte le reliquat : deux retours differents sur la meme
# vente doivent aussi se serialiser, sinon chacun valide de son cote.
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

// Vente terminee de 4 unites : le stock est passe de 10 a 6.
$vente = App\Models\Vente::create([
    "numero_vente"=>"VT-TEST-1",
    "montant_total"=>4000,
    "tva"=>0,
    "remise"=>0,
    "user_id"=>$p->id,
    "boutique_id"=>$b->id,
    "statut"=>"termine",
]);
$ligne = App\Models\LigneVente::create([
    "vente_id"=>$vente->id,
    "produit_id"=>$produit->id,
    "quantite"=>4,
    "prix_unitaire"=>1000,
    "prix_vente"=>1000,
    "montant_total"=>4000,
]);
$produit->update(["quantite_stock"=>6]);

// Retour de 2 unites, en attente.
$retour = App\Models\RetourVente::create([
    "vente_id"=>$vente->id,
    "boutique_id"=>$b->id,
    "motif"=>"defectueux",
    "statut"=>"en_attente",
    "date_retour"=>now(),
    "user_id"=>$p->id,
]);
App\Models\RetourVenteLigne::create([
    "retour_vente_id"=>$retour->id,
    "ligne_vente_id"=>$ligne->id,
    "produit_id"=>$produit->id,
    "quantite_retournee"=>2,
    "prix_unitaire"=>1000,
    "montant_retourne"=>2000,
]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  conc_arreter_serveurs
  exit 1
fi

RID=$(conc_lecture "/api/retours?per_page=50" \
      | python -c "import json,sys;d=json.load(sys.stdin);print((d.get('data') or d)[0]['id'])")

echo "== retour#$RID en attente, stock 6 apres la vente de 4 (10-4) =="
echo "== deux validations simultanes, +2 chacune => stock attendu 8 =="

# Verrou sur la VENTE, comme le fait le code : c'est elle qui porte le
# reliquat, et verrouiller le retour seul ne couvrirait pas deux retours
# differents sur la meme vente.
VERROU=$(conc_bloquer ventes 1 20)

conc_appeler_simultanes "$CONC_PORT_A" "$CONC_PORT_B" \
  "/api/retours/$RID/valider" "$CONC_TMP/ret_a.json" "$CONC_TMP/ret_b.json"

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql '
$acceptes = 0;
$refuses = 0;

foreach (["ret_a.json", "ret_b.json"] as $nom) {
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
$mouvements = DB::table("mouvements_stock")->where("raison", "retour")->count();
$statut = App\Models\RetourVente::latest("id")->first()->statut;

echo "validations acceptees : {$acceptes} (1 attendu)\n";
echo "validations refusees  : {$refuses} (1 attendu)\n";
echo "stock final           : {$stock} (8 attendu)\n";
echo "mouvements retour     : {$mouvements} (1 attendu)\n";
echo "statut retour         : {$statut}\n";

if ($acceptes === 1 && $refuses === 1 && $stock === 8 && $mouvements === 1) {
    echo "=> CONFORME : 2 unites rendues une seule fois.\n";
} else {
    echo "=> ANOMALIE : stock {$stock} pour 4 unites vendues, {$mouvements} mouvement(s).\n";
}
')

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'