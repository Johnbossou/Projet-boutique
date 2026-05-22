import { apiUrl } from './config';

export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    try {
      const res = await fetch(apiUrl('/refresh'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data.expires_at) {
        localStorage.setItem('token_expires_at', data.expires_at);
      }
      if (data.user) {
        localStorage.setItem('user_data', JSON.stringify(data.user));
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearSessionAndRedirect(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token_expires_at');
  localStorage.removeItem('user_data');
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
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(apiUrl(path), { ...options, headers });

  if (
    response.status === 401 &&
    typeof window !== 'undefined' &&
    !retried &&
    path !== '/login' &&
    path !== '/refresh'
  ) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
    clearSessionAndRedirect();
  }

  return response;
}
