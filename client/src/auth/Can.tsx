import type { ReactNode } from 'react';
import { useRole } from './AuthContext';

export type CanAction = 'read' | 'write' | 'manage';

interface CanProps {
  action: CanAction;
  children: ReactNode;
}

/**
 * Renders children only when the current role is permitted for `action`.
 * - read: any authenticated user (or always when role present — readers can read)
 * - write: Admin+
 * - manage: SuperAdmin+
 */
export function Can({ action, children }: CanProps) {
  const { role, canWrite, canManage } = useRole();

  let allowed = false;
  if (action === 'read') {
    allowed = role !== null;
  } else if (action === 'write') {
    allowed = canWrite;
  } else {
    allowed = canManage;
  }

  if (!allowed) return null;
  return <>{children}</>;
}
