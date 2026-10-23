const USER_ID_KEY = 'watchparty_user_id';
const USERNAME_KEY = 'watchparty_username';
const SESSION_TOKEN_KEY = 'watchparty_session_token';

export function getOrCreateUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function getSavedUsername(): string {
  return localStorage.getItem(USERNAME_KEY) || '';
}

export function saveUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username.trim());
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}
