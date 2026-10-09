/**
 * Cycle de vie d'un devis côté interface : accepter, refuser, convertir.
 *
 * Le backend répond 409 quand l'action est refusée pour cause d'état (devis
 * déjà converti, statut incompatible). C'est un conflit métier attendu : le
 * message du serveur doit être affiché, pas un « Erreur HTTP 409 ».
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import DevisPage from '@/app/devis/page';
import { apiFetch } from '@/lib/api-client';

jest.mock('@/lib/api-client');
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const useAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

jest.mock('@/components/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty" />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

const mockFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function devis(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    numero_devis: 'DEV-20260101-0001',
    date_devis: '2026-01-01T00:00:00Z',
    date_validite: '2026-02-01T00:00:00Z',
    montant_total: 6000,
    statut: 'accepte',
    notes: null,
    client: { id: 1, nom: 'Client Test' },
    user: { id: 2, name: 'Gérant' },
    commande_client: null,
    lignes: [
      { id: 1, quantite: 2, prix_unitaire: 3000, produit: { id: 3, nom: 'Produit' } },
    ],
    ...overrides,
  };
}

function reponseJson(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

/** La page appelle /devis puis l'action : on répond selon l'URL demandée. */
function router(routes: Record<string, () => Response>) {
  mockFetch.mockImplementation(async (path: string) => {
    const cle = Object.keys(routes).find((k) => String(path).includes(k));
    if (cle) return routes[cle]();
    throw new Error(`route non mockée : ${path}`);
  });
}

const gerant = { id: 2, name: 'Gérant', email: 'g@b.bj', role: 'gerant', current_boutique_id: 1 };
const caissier = { id: 3, name: 'Caissier', email: 'c@b.bj', role: 'caissier', current_boutique_id: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: gerant });
});

describe('cycle de vie des devis', () => {
  it('affiche le bouton Convertir sur un devis accepté sans commande', async () => {
    router({ '/devis': () => reponseJson({ data: [devis()] }) });
    render(<DevisPage />);

    expect(await screen.findByTitle('Convertir en commande')).toBeInTheDocument();
  });

  it('convertit le devis et recharge la liste', async () => {
    router({
      '/convertir-commande': () => reponseJson({ message: 'ok' }, true, 201),
      '/devis': () => reponseJson({ data: [devis()] }),
    });
    render(<DevisPage />);

    await userEvent.click(await screen.findByTitle('Convertir en commande'));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/devis/7/convertir-commande', { method: 'POST' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Commande créée depuis le devis');
  });

  it('affiche le numéro de commande au lieu du bouton quand le devis est déjà converti', async () => {
    router({
      '/devis': () =>
        reponseJson({
          data: [devis({ commande_client: { id: 4, numero_commande: 'CMD-20260101-0001' } })],
        }),
    });
    render(<DevisPage />);

    expect(await screen.findByText('CMD-20260101-0001')).toBeInTheDocument();
    expect(screen.queryByTitle('Convertir en commande')).not.toBeInTheDocument();
  });

  it('refuse le double-clic sur Convertir pendant la requête', async () => {
    let repondre: (v: Response) => void = () => {};
    const enCours = new Promise<Response>((r) => { repondre = r; });

    router({
      '/convertir-commande': () => reponseJson({ message: 'ok' }, true, 201),
      '/devis': () => reponseJson({ data: [devis()] }),
    });
    mockFetch.mockImplementation(async (path: string) => {
      if (String(path).includes('convertir-commande')) return enCours;
      return reponseJson({ data: [devis()] });
    });

    render(<DevisPage />);
    const bouton = await screen.findByTitle('Convertir en commande');

    await userEvent.click(bouton);

    await waitFor(() => expect(bouton).toBeDisabled());
    // Un second clic ne doit pas déclencher une deuxième requête : c'est le
    // double-clic qui créait deux commandes avant le verrou côté serveur.
    await userEvent.click(bouton);
    const appels = mockFetch.mock.calls.filter((c) => String(c[0]).includes('convertir-commande'));
    expect(appels).toHaveLength(1);

    repondre(reponseJson({ message: 'ok' }, true, 201));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('affiche le message métier du serveur en cas de 409', async () => {
    router({
      '/convertir-commande': () => reponseJson({ message: 'Ce devis ne peut pas être converti en commande' }, false, 409),
      '/devis': () => reponseJson({ data: [devis()] }),
    });
    render(<DevisPage />);

    await userEvent.click(await screen.findByTitle('Convertir en commande'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Ce devis ne peut pas être converti en commande'),
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('Erreur HTTP 409'));
  });

  it('retombe sur un message lisible si le 409 n a pas de corps JSON', async () => {
    router({
      '/convertir-commande': () =>
        ({ ok: false, status: 409, json: async () => { throw new Error('corps vide'); } }) as unknown as Response,
      '/devis': () => reponseJson({ data: [devis()] }),
    });
    render(<DevisPage />);

    await userEvent.click(await screen.findByTitle('Convertir en commande'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur HTTP 409'));
  });

  it('propose accepter et refuser sur un devis en attente', async () => {
    router({
      '/devis': () => reponseJson({ data: [devis({ statut: 'en_attente' })] }),
    });
    render(<DevisPage />);

    expect(await screen.findByTitle('Accepter le devis')).toBeInTheDocument();
    expect(screen.getByTitle('Refuser le devis')).toBeInTheDocument();
    expect(screen.queryByTitle('Convertir en commande')).not.toBeInTheDocument();
  });

  it('accepte le devis via POST', async () => {
    router({
      '/accepter': () => reponseJson({ message: 'ok' }),
      '/devis': () => reponseJson({ data: [devis({ statut: 'en_attente' })] }),
    });
    render(<DevisPage />);

    await userEvent.click(await screen.findByTitle('Accepter le devis'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/devis/7/accepter', { method: 'POST' }));
    expect(toast.success).toHaveBeenCalledWith('Devis accepté');
  });

  it('masque les actions de gestion pour un caissier', async () => {
    useAuth.mockReturnValue({ user: caissier });
    router({ '/devis': () => reponseJson({ data: [devis()] }) });
    render(<DevisPage />);

    await screen.findByText('DEV-20260101-0001');
    expect(screen.queryByTitle('Convertir en commande')).not.toBeInTheDocument();
    // Le téléchargement de PDF reste accessible au caissier.
    expect(screen.getByTitle('Télécharger PDF')).toBeInTheDocument();
  });

  it('suit role_courant plutôt que le rôle global', async () => {
    // Le rôle global reste 'caissier' (l'utilisateur gère une autre boutique)
    // mais role_courant vaut 'gerant' : c'est ce dernier qui fait foi, sinon
    // le gérant de la boutique active perdrait les actions de gestion.
    useAuth.mockReturnValue({ user: { ...gerant, role: 'caissier', role_courant: 'gerant' } });
    router({ '/devis': () => reponseJson({ data: [devis()] }) });
    render(<DevisPage />);

    expect(await screen.findByTitle('Convertir en commande')).toBeInTheDocument();
  });
});
