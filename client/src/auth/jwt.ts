/** Shared localStorage key for the JWT access token. */
export const TOKEN_KEY = 'solutionplex_token';

export type UserRole = 'reader' | 'admin' | 'superadmin';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
  iat: number;
}

/**
 * Decode a JWT payload without signature verification.
 * Safe for UI display / gating; the server validates on every request.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    const json = decodeURIComponent(
      window
        .atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const parsed: unknown = JSON.parse(json);
    if (!isJwtPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check whether a decoded token's `exp` claim is in the past.
 */
export function isExpired(payload: JwtPayload): boolean {
  return Date.now() >= payload.exp * 1000;
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sub === 'string' &&
    typeof obj.email === 'string' &&
    (obj.role === 'reader' || obj.role === 'admin' || obj.role === 'superadmin') &&
    typeof obj.exp === 'number' &&
    typeof obj.iat === 'number'
  );
}
