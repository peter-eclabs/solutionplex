import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { decodeJwt, isExpired, TOKEN_KEY } from './jwt';
import type { UserRole } from './jwt';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  /** The current user, or null if not logged in. */
  user: AuthUser | null;
  /** The raw JWT string, or null. */
  token: string | null;
  /** True while hydrating from localStorage on mount. */
  isLoading: boolean;
  /** True when a valid (non-expired) token is present. */
  isAuthenticated: boolean;
  /** Persist a new token (after login). */
  login: (token: string) => void;
  /** Clear token and user state. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromToken(token: string): AuthUser | null {
  const payload = decodeJwt(token);
  if (!payload || isExpired(payload)) return null;
  return { id: payload.sub, email: payload.email, role: payload.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const authUser = userFromToken(stored);
      if (authUser) {
        setToken(stored);
        setUser(authUser);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string) => {
    const authUser = userFromToken(newToken);
    if (!authUser) {
      // Still try decode for clearer error when only expiry/format fails
      const payload = decodeJwt(newToken);
      if (!payload) throw new Error('Invalid token');
      throw new Error('Token expired');
    }
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: user !== null && token !== null,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the auth context. Must be used within {@link AuthProvider}.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

const ROLE_RANK: Record<UserRole, number> = {
  reader: 0,
  admin: 1,
  superadmin: 2,
};

export interface RoleInfo {
  /** The user's current role, or null if unauthenticated. */
  role: UserRole | null;
  /** True if the user can perform write operations (Admin+). */
  canWrite: boolean;
  /** True if the user can manage users/config (SuperAdmin+). */
  canManage: boolean;
  /** True if the user is a Reader (or unauthenticated). */
  isReader: boolean;
}

/**
 * Provides role-aware helpers derived from the current auth state.
 */
export function useRole(): RoleInfo {
  const { user } = useAuth();

  return useMemo(() => {
    const role = user?.role ?? null;
    const rank = role ? ROLE_RANK[role] : -1;

    return {
      role,
      canWrite: rank >= ROLE_RANK.admin,
      canManage: rank >= ROLE_RANK.superadmin,
      isReader: role === 'reader' || role === null,
    };
  }, [user]);
}
