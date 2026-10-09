#!/bin/bash
#
# Scenario : double annulation concurrente d'une commande client.
#
# Pourquoi cette cible
# -------------------
# CommandeClientController lit le statut, le compare, puis ecrit — sans verrou
# ni transaction. Le modele est partout ailleurs dans ce projet, ou l'etat est
# relu sous verrou avant d'ecrire. Ici, deux requetes qui se chevauchent lisent
# toutes deux « en_cours », passent le controle, et ecrivent « annule » deux
# fois. Personne ne voit d'erreur : les deux repondent 200.
#
# L'argent deja encaisse
# ---------------------
# Le vrai cout n'est pas le double 200. MobileMoney credite montant_paye sur la
# commande quand le paiement reussit. Une annulation ne le rapporte pas. Sans
# verrou, une annulation peut donc valider une transition pendant qu'un callback
# MobileMoneycredite la commande : le statut devient « annule » et l'argent reste
# encaisse. La boutique aannule une commande qui a ete payee.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : A = 200, B = 409, statut final = annule
#   sans correctif : A = 200, B = 200, statut final = annule
#
# Le statut final est identique dans les deux cas : c'est normal, l'ecriture
# concurrente de la meme valeur ne laisse pas de trace. Ce qui distingue les
# deux comportements est le second code de reponse, et c'est le seul point de
# controle. Un test qui ne verifierait que le statut final passerait dans les
# deux cas et ne prouverait rien.
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
App\Models\Produit::create(["nom"=>"Produit","description"=>"d","prix"=>1000,"quantite_stock"=>50,"seuil_alerte"=>2,"categorie_id"=>$c->id,"unite_mesure"=>"unite","boutique_id"=>$b->id]);

$client = App\Models\Client::create([
    "nom"=>"Client Test",
    "email"=>"client@concurrence.bj",
    "boutique_id"=>$b->id,
]);

// Une commande paynee : c est le cas qui coute cher, car une annulation
// concurrente laisserait l argent encaisse sur une commande annulee.
App\Models\CommandeClient::create([
    "numero_commande"=>"CC-CONC-1",
    "client_id"=>$client->id,
    "boutique_id"=>$b->id,
    "date_commande"=>now(),
    "statut"=>"en_cours",
    "montant_total"=>5000,
    "montant_paye"=>5000,
    "user_id"=>$p->id,
]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

CID=$(conc_lecture "/api/commandes-clients?per_page=1" \
  | python -c "import json,sys;d=json.load(sys.stdin);print((d.get('data') or d)[0]['id'])")

echo "== commande#$CID en_cours, 5000 encaisses =="
echo "== deux annulations simultanes =="

# Verrou sur la commande : les deux appels se lisent « en_cours » et se
# bloquent, exactement comme ils le feraient si la boutique cliquait deux fois.
VERROU=$(conc_bloquer commande_clients "$CID" 20)

conc_appeler_simultanes "$CONC_PORT_A" "$CONC_PORT_B" \
  "/api/commandes-clients/$CID/annuler" \
  "$CONC_TMP/cc_a.json" "$CONC_TMP/cc_b.json"

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$c = App\Models\CommandeClient::latest("id")->first();
$statut = $c->statut;

// Le code HTTP n est pas dans le corps de la reponse : curl l affiche sur
// sa propre sortie. Un refus se reconnait donc a son message, dont le marqueur
// est « traite entre-temps ».
$accepte = 0;
$refuse = 0;
foreach (["cc_a.json", "cc_b.json"] as $nom) {
    $r = json_decode(file_get_contents(getenv("CONC_TMP")."/".$nom), true);
    $message = is_array($r) ? ($r["message"] ?? "") : "";
    if (str_contains($message, "entre-temps")) {
        $refuse++;
    } else {
        $accepte++;
    }
}

echo "statut final        : {$statut} (annule attendu)\n";
echo "annulations acceptees: {$accepte} (1 attendue)\n";
echo "annulations refusees : {$refuse} (1 attendue)\n";

// Une fixture absente se lirait « annule » sans qu aucune requete n ait
// agi. Le confondre avec un conformisme serait un faux rapport.
if ($statut === "") {
    echo "=> ERREUR DE SCENARIO : aucune commande trouvee.\n";
} elseif ($accepte === 1 && $refuse === 1) {
    echo "=> CONFORME : une seule annulation acceptee.\n";
} else {
    echo "=> ANOMALIE : {$accepte} annulation(s) acceptee(s) sur 2 requetes.\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'