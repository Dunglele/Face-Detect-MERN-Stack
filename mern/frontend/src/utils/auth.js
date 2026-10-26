const TOKEN_KEY = 'face_detect_token';
const USER_KEY = 'face_detect_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken() && getUser());
}

export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  // Several portal requests can fail together. Only the first 401 for the
  // currently active session may clear it and announce the logout; otherwise
  // late responses can repeatedly wipe the chat's session-expired notice.
  if (response.status === 401 && token && getToken() === token) {
    clearSession();
    window.dispatchEvent(new CustomEvent('auth:logout', {
      detail: { reason: 'unauthorized' },
    }));
  }
  return response;
}
