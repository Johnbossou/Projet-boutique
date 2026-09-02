import { User } from '@/types';

export type EffectiveRole = 'proprietaire' | 'gerant' | 'caissier' | undefined;

/**
 * Rôle "effectif" de l'utilisateur dans la boutique courante.
 * Privilégie role_courant (rôle dans la boutique active) sinon le rôle global.
 */
export function getEffectiveRole(user: User | null | undefined): EffectiveRole {
  if (!user) return undefined;
  return (user.role_courant || user.role) as EffectiveRole;
}

/**
 * Peut-il gérer (gérant ou propriétaire) dans la boutique courante ?
 */
export function canGerer(user: User | null | undefined, role: EffectiveRole): boolean {
  return role === 'proprietaire' || role === 'gerant';
}
