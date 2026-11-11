/**
 * Identifiants des tests de bout en bout.
 *
 * En local et en CI, la base est dotee par les seeders : les comptes
 * existent, avec le mot de passe « password ».
 *
 * En production, les comptes de demonstration n'existent pas — c'est
 * deliberé, leur mot de passe est connu de tous. Le smoke de production
 * utilise donc des comptes dedies, dont les identifiants viennent des
 * secrets du depot.
 *
 * Deux comptes sont necessaires : le parcours visite la page « Mes
 * Boutiques », reservee au proprietaire. Un gerant y recevrait un 403 —
 * un comportement correct, mais un ecran que le parcours ne peut pas
 * visiter.
 *
 * Sans ces variables, les tests retombent sur les comptes de
 * demonstration : utile en local, et sans effet sur la production, ou ils
 * n'existent pas.
 */
export const IDENTIFIANTS = {
  email: process.env.E2E_EMAIL || 'gerant@sgci.bj',
  password: process.env.E2E_PASSWORD || 'password',
};

export const IDENTIFIANTS_PROPRIETAIRE = {
  email: process.env.E2E_EMAIL_PROPRIETAIRE || 'proprietaire@sgci.bj',
  password: process.env.E2E_PASSWORD_PROPRIETAIRE || 'password',
};
