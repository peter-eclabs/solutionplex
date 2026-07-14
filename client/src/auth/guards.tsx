import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRole } from './AuthContext';
import type { UserRole } from './jwt';

const ROLE_RANK: Record<UserRole, number> = {
  reader: 0,
  admin: 1,
  superadmin: 2,
};

/**
 * Pure clearance check: true when `role` meets or exceeds `minRole`.
 */
export function hasMinRole(
  role: UserRole | null | undefined,
  minRole: UserRole
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/**
 * Returns true when the current user's role meets or exceeds `minRole`.
 * Must be called from a React component (uses `useRole`).
 */
export function canNavigate(minRole: UserRole): boolean {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- intentional role-check helper used only from components
  const { role } = useRole();
  return hasMinRole(role, minRole);
}

interface RequireRoleProps {
  minRole: UserRole;
  onDenied?: () => void;
  children: ReactNode;
}

/**
 * Renders children only when the current user meets `minRole`.
 * Invokes `onDenied` when access is denied (e.g. navigate to /unauthorized).
 */
export function RequireRole({ minRole, onDenied, children }: RequireRoleProps) {
  const allowed = canNavigate(minRole);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (!allowed && onDenied && !deniedRef.current) {
      deniedRef.current = true;
      onDenied();
    }
    if (allowed) {
      deniedRef.current = false;
    }
  }, [allowed, onDenied]);

  if (!allowed) return null;
  return <>{children}</>;
}
