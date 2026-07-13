// Token storage indirection. Uses localStorage on the web; swap the body for
// @capacitor/preferences when wrapping the app with Capacitor — callers stay
// unchanged.
const TOKEN_KEY = 'gw_token';

export const storage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};
