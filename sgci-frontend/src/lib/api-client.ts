import { apiUrl } from './config';

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const token = localStorage.getItem('sgci_token');

      // Rien a renouveler : la requete qui a echoue etait partie sans
      // jeton. Envoyer /refresh sans jeton ne peut aboutir que par un
      // echec, et son echec serait lu comme « session morte ».
      if (!token) return false;

      const res = await fetch(apiUrl('/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return false;

      const data = await res.json();

      // /refresh SUPPRIME le token courant côté serveur : le nouveau token
      // doit impérativement remplacer l'ancien dans localStorage, sinon le
      // retry repart avec un token révoqué et l'utilisateur est déconnecté.
      if (data.token) {
        localStorage.setItem('sgci_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('user_data', JSON.stringify(data.user));
      }
      return true;
    } catch {
      // Requete avortee (la page se recharge) ou reseau indisponible : cela
      // ne prouve pas que la session est morte. `false` signifie « je n'ai
      // pas pu renouveler », pas « deconnecte l'utilisateur ».
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearSessionAndRedirect(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user_data');
  localStorage.removeItem('sgci_token');
  window.location.href = '/login?message=session_expired';
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sgci_token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  if (
    response.status === 401 &&
    typeof window !== 'undefined' &&
    !retried &&
    path !== '/login' &&
    path !== '/refresh'
  ) {
    const jeton = localStorage.getItem('sgci_token');

    // Une requete partie SANS jeton ne prouve pas que la session est
    // expiree : il n'y a rien a prolonger. Vider la session ici detruirait
    // un jeton fraichement pose (connexion en cours) et renverrait
    // l'utilisateur en boucle sur /login.
    if (!jeton) {
      return response;
    }

    const refreshed = await tryRefreshToken();

    if (refreshed) {
      return apiFetch(path, options, true);
    }

    // Le jeton a pu etre revoque par une rotation concurrente : le
    // renouvellement a alors echoue sur un jeton deja mort, alors que le
    // jeton courant est valide. On retente une fois avec le jeton
    // courant avant de conclure que la session est finie.
    if (localStorage.getItem('sgci_token') !== jeton) {
      return apiFetch(path, options, true);
    }

    clearSessionAndRedirect();
  }

  return response;
}
