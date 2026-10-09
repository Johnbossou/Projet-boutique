#!/bin/bash
#
# Scenario : reclamation double d'une meme recompense de fidelite.
#
# Pourquoi ce script existe, et pas un test PHPUnit
# -------------------------------------------------
# La faute se mesure en solde de points, pas en code HTTP. Deux reclamations
# lancees « en parallele » depuis un seul processus de test s'executent en fait
# l'une apres l'autre : la seconde relit un solde deja diminue et le controle
# « points insuffisants » hors transaction suffit a la refuser. Le test passe,
# le bug reste. Ici les deux requetes se bloquent sur un verrou tiers, relisent
# le meme solde, et ne sont departagees que par la transaction verrouillee.
#
# Ce que cela produit
# -------------------
#   - une reclamation gagne : solde 100 -> 0, une reclamation. Correct.
#   - les deux gagnent : le solde descend deux fois, a -100. Le client a recu
#     deux remises pour un capital de points qui n'en valait qu'une.
#
# Ce que ce scenario doit afficher
# --------------------------------
#   avec correctif : une seule reclamation, solde 0
#   sans correctif : deux reclamations, solde -100
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
$prog = App\Models\ProgrammeFidelite::create(["boutique_id"=>$b->id,"nom"=>"Programme","description"=>"d","points_par_achat"=>1,"valeur_point"=>1,"actif"=>true]);
$cli = App\Models\Client::create(["nom"=>"Client","email"=>"client@concurrence.bj","telephone"=>"0197000001","boutique_id"=>$b->id]);
App\Models\ClientFidelite::create(["programme_fidelite_id"=>$prog->id,"client_id"=>$cli->id,"points"=>100,"niveau_actuel"=>"bronze","date_inscription"=>now()]);
App\Models\RecompenseFidelite::create(["programme_fidelite_id"=>$prog->id,"nom"=>"Remise","description"=>"d","points_requis"=>100,"type"=>"remise","valeur"=>10,"actif"=>true]);
' >/dev/null

conc_demarrer_serveurs
CONC_TOKEN=$(conc_login)

if [ -z "$CONC_TOKEN" ]; then
  echo "ECHEC : authentification impossible" >&2
  exit 1
fi

echo "== client fidelite a 100 points, recompense a 100 points =="
echo "== deux reclamations simultanees =="

VERROU=$(conc_bloquer client_fidelites 1 20)

CORPS='{"recompense_fidelite_id":1,"client_id":1}'
conc_appeler_simultanes "$CONC_PORT_A" "$CONC_PORT_B" \
  "/api/fidelite/reclamer-recompense" "$CONC_TMP/fid_a.json" "$CONC_TMP/fid_b.json" "$CORPS" \
  > "$CONC_TMP/fid_codes.txt"

conc_attendre_verrou "$VERROU"
conc_arreter_serveurs

echo

SORTIE=$(conc_sql "$(cat <<'PHP'
$codes = [];
$brut = (string) @file_get_contents(getenv("CONC_TMP")."/fid_codes.txt");
if (preg_match_all('/HTTP (\d{3})/', $brut, $m)) {
    $codes = array_map("intval", $m[1]);
}
$succes = count(array_filter($codes, fn ($c) => $c >= 200 && $c < 300));
$refus = count(array_filter($codes, fn ($c) => $c === 409));

$client = App\Models\ClientFidelite::find(1);
$points = (int) $client->points;
$reclamations = App\Models\ReclamationRecompense::count();

echo "codes : ".implode(", ", $codes)." (".$succes." succes, ".$refus." refus 409)\n";
echo "solde final : {$points}, reclamations : {$reclamations}\n";

if ($client === null) {
    echo "=> ERREUR DE SCENARIO : client fidelite introuvable.\n";
} elseif ($succes === 1 && $refus === 1 && $points === 0 && $reclamations === 1) {
    echo "=> CONFORME : une seule reclamation, solde a zero.\n";
} elseif ($succes > 1) {
    echo "=> ANOMALIE : {$succes} reclamations acceptees — solde {$points}.\n";
} else {
    echo "=> ANOMALIE : {$succes} succes, {$refus} refus, solde {$points}, {$reclamations} reclamation(s).\n";
}
PHP
)")

echo "$SORTIE"
echo "$SORTIE" | conc_verifier '=> CONFORME'
