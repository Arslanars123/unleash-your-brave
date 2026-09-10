export type AuthPortal = 'admin' | 'team';

const LEGACY_ACCESS = 'uyb.accessToken';
const LEGACY_REFRESH = 'uyb.refreshToken';
const LEGACY_USER = 'uyb.user';

function keysFor(portal: AuthPortal) {
  return {
    access: `uyb.${portal}.accessToken`,
    refresh: `uyb.${portal}.refreshToken`,
    user: `uyb.${portal}.user`,
  };
}

/** Desk team routes use an isolated session from admin/speaker/sponsor. */
export function portalFromPath(pathname = window.location.pathname): AuthPortal {
  // Only `/team` and `/team/...` — not admin pages like `/team-members`.
  return pathname === '/team' || pathname.startsWith('/team/') ? 'team' : 'admin';
}

function migrateLegacyAdminTokens(): void {
  const admin = keysFor('admin');
  if (localStorage.getItem(admin.access)) return;
  const access = localStorage.getItem(LEGACY_ACCESS);
  const refresh = localStorage.getItem(LEGACY_REFRESH);
  const user = localStorage.getItem(LEGACY_USER);
  if (!access || !refresh) return;
  localStorage.setItem(admin.access, access);
  localStorage.setItem(admin.refresh, refresh);
  if (user) localStorage.setItem(admin.user, user);
  localStorage.removeItem(LEGACY_ACCESS);
  localStorage.removeItem(LEGACY_REFRESH);
  localStorage.removeItem(LEGACY_USER);
}

migrateLegacyAdminTokens();

export const tokenStorage = {
  getAccess(portal: AuthPortal = portalFromPath()): string | null {
    return localStorage.getItem(keysFor(portal).access);
  },
  getRefresh(portal: AuthPortal = portalFromPath()): string | null {
    return localStorage.getItem(keysFor(portal).refresh);
  },
  setTokens(
    accessToken: string,
    refreshToken: string,
    portal: AuthPortal = portalFromPath(),
  ): void {
    const keys = keysFor(portal);
    localStorage.setItem(keys.access, accessToken);
    localStorage.setItem(keys.refresh, refreshToken);
  },
  /** Clears only one portal — team logout must not wipe admin. */
  clear(portal: AuthPortal = portalFromPath()): void {
    const keys = keysFor(portal);
    localStorage.removeItem(keys.access);
    localStorage.removeItem(keys.refresh);
    localStorage.removeItem(keys.user);
  },
  setUser(userJson: string, portal: AuthPortal = portalFromPath()): void {
    localStorage.setItem(keysFor(portal).user, userJson);
  },
  getUser<T>(portal: AuthPortal = portalFromPath()): T | null {
    const raw = localStorage.getItem(keysFor(portal).user);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
};
