import { apiUrl } from './config';

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl('/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) return false;

      const data = await res.json();
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
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
    clearSessionAndRedirect();
  }

  return response;
}
