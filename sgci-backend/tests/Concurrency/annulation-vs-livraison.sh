#!/bin/bash
#
# Scenario : annulation et livraison concurrentes de la meme commande.
#
# Pourquoi cette paire, et pas une double annulation
# -------------------------------------------------
# annuler() est deja couvert. Mais annuler et livrer sont deux transitions
# OPPOSEES, et c'est ce qui les rend differentes : toutes deux admettent
# « en_cours », toutes deux lisent sur l'instance liee a la route, puis
# ecrivent. Aucune ne verifie ce que l'autre vient de faire.
#
# Ce que cela produit
# -------------------
# Les deux reussissent. La commande finit « livre » si la livraison ecrit en
# dernier, « annule » sinon. Dans le premier cas, la boutique livre une
# commande annulee par le client. Dans le second, elle recolte sur une commande
# annulee. Dans les deux cas, deux 200, aucune trace du conflit — c'est le
# double-annulation reecrit, avec l'argent et la marchandise en plus.
#
# Pourquoi la livraison est la cible de ce scénario
# ------------------------------------------------
# Une commande annulee qui passe en « livre » est le seul des deux ordres ou
# l'erreur est deja irrevocable : les marchandises sont sorties et le statut
# dit qu'elles l'ont ete regulierement. Le versant « encaisse sur commande
# annulee » est deja traite par le scenario MobileMoney.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : un 200 et un 409, le statut final correspond au 200
#   sans correctif : deux 200, un statut qui ne dit pas lequel a gagne
#
# On ne fixe pas lequel des deux doit gagner : l'ordre est decide par qui
# obtient le verrou, et les deux resultats sont defensables. Ce qu'on exige,
# c'est qu'un seul des deux reussisse — c'est le seul signal qui distingue le
# correct d'un double clic.
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

// en_cours : c est le seul statut accepte par les deux transitions, donc le
// seul depuis lequel elles peuvent se croiser.
App\Models\CommandeClient::create([
    "numero_commande"=>"CC-CONC-2",
    "client_id"=>$client->id,
    "boutique_id"=>$b->id,
    "date_commande"=>now(),
    "statut"=>"en_cours",
    "montant_total"=>5000,
    "montant_paye"=>0,
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

echo "== commande#$CID en_cours =="
echo "== annulation et livraison simultanees =="

VERROU=$(conc_bloquer commande_clients "$CID" 20)

# Le temps total est affiche : un appel bloque par le verrou prend plusieurs
# secondes, un appel qui a echappe a la course prend quelques millisecondes.
# C'est le seul element du resultat qui separe « la course a eu lieu » de
# « les deux appels sont passes avant le verrou ».
curl -s -X POST "http://127.0.0.1:$CONC_PORT_A/api/commandes-clients/$CID/annuler" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/cl_annuler.json" -w 'annulation : HTTP %{http_code} t=%{time_total}\n' &
ANNULER=$!

curl -s -X POST "http://127.0.0.1:$CONC_PORT_B/api/commandes-clients/$CID/livrer" \
  -H "Authorization: Bearer $CONC_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{}' \
  -o "$CONC_TMP/cl_livrer.json" -w 'livraison  : HTTP %{http_code} t=%{time_total}\n' &
LIVRER=$!

wait $ANNULER || true
wait $LIVRER || true

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$c = App\Models\CommandeClient::latest("id")->first();
$statut = (string) ($c->statut ?? '');

$reussites = 0;
foreach (["cl_annuler.json", "cl_livrer.json"] as $nom) {
    $brut = trim((string) @file_get_contents(getenv("CONC_TMP")."/".$nom));
    // Un refus porte le marqueur de transition deja effectuee ; une reussite
    // porte le message attendu de l operation. Le corps suffit donc a les
    // distinguer, sans avoir a relire un code HTTP qui n est pas la.
    if (str_contains($brut, "entre-temps") || str_contains($brut, "Seules les")) {
        continue;
    }
    if (str_contains($brut, "annul") || str_contains($brut, "livr")) {
        $reussites++;
    }
}

echo "statut final     : {$statut} (annule ou livre)\n";
echo "operations reussies: {$reussites} (1 attendue)\n";

// Une commande sans statut signifierait que la fixture n a pas ete creee : le
// confondre avec un conformisme ferait dire qu une course a eu lieu sur rien.
if ($statut === "") {
    echo "=> ERREUR DE SCENARIO : aucune commande trouvee.\n";
} elseif ($reussites === 1 && in_array($statut, ["annule", "livre"], true)) {
    echo "=> CONFORME : une seule des deux transitions a ete acceptee.\n";
} elseif ($reussites > 1) {
    echo "=> ANOMALIE : {$reussites} transitions acceptees — annule et livres sur la meme commande.\n";
} else {
    echo "=> ANOMALIE : statut {$statut}, {$reussites} reussite(s) incoherente(s).\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'