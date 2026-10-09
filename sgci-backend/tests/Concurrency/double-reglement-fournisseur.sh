#!/bin/bash
#
# Scenario : deux reglements fournisseur simultanes sur la meme commande.
#
# Regle attendue
# --------------
# Commande de 10 000, deux appels de 6 000 en parallele. Un seul peut aboutir :
# le second doit relire le reste a payer sous verrou, trouver 4 000, et refuser
# car 6 000 le depasse. Total encaisse = 6 000.
#
#   avec correctif : A = 200, B = 422, montant_paye = 6000
#   sans correctif : A = 200, B = 200, montant_paye = 6000 pour 12 000 encaisses
#
# Ce que montre l'absence de verrou
# ---------------------------------
# Les deux appels lisent montant_paye = 0, passent tous deux le controle du
# reste a payer, puis chacun ecrivent 0 + 6 000. Le montant enregistre reste
# 6 000 alors que 12 000 sont entres en caisse : le fournisseur est paye plus que
# la commande, et l'ecart est invisible dans l'ecran.
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

$fournisseur = App\Models\Fournisseur::firstOrCreate(
    ["nom"=>"Grossiste Test"],
    ["boutique_id"=>$b->id]
);

$c = App\Models\Categorie::create(["nom"=>"Cat","description"=>"d","couleur"=>"#000","icone"=>"box"]);
$produit = App\Models\Produit::create(["nom"=>"Produit","description"=>"d","prix"=>1000,"quantite_stock"=>0,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);

$commande = App\Models\CommandeFournisseur::create([
    "numero_commande"=>"CF-TEST-1",
    "fournisseur_id"=>$fournisseur->id,
    "boutique_id"=>$b->id,
    "statut"=>"valide",
    "montant_total"=>10000,
    "montant_paye"=>0,
    "user_id"=>$p->id,
]);
App\Models\LigneCommandeFournisseur::create([
    "commande_fournisseur_id"=>$commande->id,
    "produit_id"=>$produit->id,
    "quantite_commandee"=>10,
    "quantite_recue"=>0,
    "prix_unitaire"=>1000,
    "montant_total"=>10000,
]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  conc_arreter_serveurs
  exit 1
fi

CID=$(conc_lecture "/api/commandes-fournisseurs?per_page=50" \
      | python -c "import json,sys;d=json.load(sys.stdin);print((d.get('data') or d)[0]['id'])")

echo "== commande#$CID : total 10 000, paye 0 =="
echo "== deux reglements de 6 000 simultanes =="

VERROU=$(conc_bloquer commande_fournisseurs "$CID" 20)

conc_appeler_simultanes "$CONC_PORT_A" "$CONC_PORT_B" \
  "/api/commandes-fournisseurs/$CID/payer" "$CONC_TMP/regl_a.json" "$CONC_TMP/regl_b.json" \
  '{"montant":6000}'

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

# Sur quoi on juge, et pourquoi pas seulement montant_paye
# -------------------------------------------------------
# montant_paye vaut 6 000 meme sans verrou : chaque appel ecrit « 0 + 6 000 »
# sur l'instance perimee qu'il a lue. Le montant affiche ne trahit donc rien,
# et c'est bien pour cela que la perte d'information reelle passe inapercue a
# l'ecran. Verifier ce seul nombre donnerait un faux conforme.
#
# Ce qui distingue vraiment les deux comportements, c'est le second appel :
# refuse (422) quand le verrou tient, accepte (200) quand il manque.
#
# La sortie est capturee puis relue : un tube place apres la fermeture d'un
# guillemet sur une ligne suivante est une erreur de syntaxe bash, et
# conc_verifier lirait de toute facon stdin, pas la commande precedente.
SORTIE=$(conc_sql '
$refuses = 0;
$acceptes = 0;

foreach (["regl_a.json", "regl_b.json"] as $nom) {
    $chemin = getenv("CONC_TMP")."/".$nom;
    $r = json_decode(file_get_contents($chemin), true);

    if (! is_array($r)) {
        echo "=> ANOMALIE : reponse illisible ({$nom}).\n";
        continue;
    }

    // Un succes porte les donnees de la commande ; un refus porte un message
    // d erreur sans champ data.
    if (array_key_exists("data", $r)) {
        $acceptes++;
        echo "accepte : ".$r["message"]."\n";
    } else {
        $refuses++;
        echo "refuse  : ".$r["message"]."\n";
    }
}

$c = App\Models\CommandeFournisseur::latest("id")->first();
$paye = (float) $c->montant_paye;

echo "appels acceptes : {$acceptes} (1 attendu)\n";
echo "appels refuses  : {$refuses} (1 attendu)\n";
echo "montant_paye    : {$paye} (6000 attendu)\n";

if ($acceptes === 1 && $refuses === 1) {
    echo "=> CONFORME : un seul reglement accepte, le second refuse sous verrou.\n";
} else {
    echo "=> ANOMALIE : {$acceptes} reglement(s) accepte(s) pour 12 000 encaisses.\n";
}
')

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'