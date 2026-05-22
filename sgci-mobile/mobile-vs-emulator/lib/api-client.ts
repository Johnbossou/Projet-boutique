import * as SecureStore from 'expo-secure-store';
import { apiUrl } from '@/constants/api';

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch {
    return null;
  }
}

async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('auth_token', token);
}

async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const token = await getAuthToken();
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
        await setAuthToken(data.token);
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

  const token = await getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path), { ...options, headers });

  if (
    response.status === 401 &&
    !retried &&
    path !== '/login' &&
    path !== '/refresh'
  ) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
    await clearAuthToken();
  }

  return response;
}
