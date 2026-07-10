import { useRef, useState } from 'react';
import { useToast } from './ToastContext';

interface DeleteButtonProps {
  /** Calls the API to remove the entity. Throw/return-reject to signal failure. */
  onDelete: () => Promise<unknown>;
  /** Invoked after a successful deletion (e.g. to refresh the list). */
  onDeleted?: () => void;
  /** Label used in the success / error toast messages. */
  entityLabel: string;
  /** Accessible title for the button. */
  title?: string;
}

export function DeleteButton({
  onDelete,
  onDeleted,
  entityLabel,
  title = 'Delete',
}: DeleteButtonProps) {
  const CONFIRM_WINDOW_MS = 1500;
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const armTimer = useRef<number | null>(null);
  const armedRef = useRef(false);
  const { showToast } = useToast();

  const disarm = () => {
    armedRef.current = false;
    setArmed(false);
    if (armTimer.current) {
      window.clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;

    // Second click inside the confirmation window -> delete
    if (armedRef.current) {
      disarm();
      setDeleting(true);
      try {
        await onDelete();
        showToast(`${entityLabel} deleted successfully`, 'success');
        onDeleted?.();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Deletion failed';
        showToast(message, 'error');
      } finally {
        setDeleting(false);
      }
      return;
    }

    // First click -> arm for the confirmation window
    armedRef.current = true;
    setArmed(true);
    if (armTimer.current) window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => {
      armedRef.current = false;
      setArmed(false);
      armTimer.current = null;
    }, CONFIRM_WINDOW_MS);
  };

  return (
    <button
      type="button"
      className={`card-delete-btn${armed ? ' armed' : ''}${deleting ? ' deleting' : ''}`}
      onClick={handleClick}
      title={`${title} — click to arm, click again within the timer to confirm`}
      aria-label={`Delete ${entityLabel}`}
    >
      <span className="card-delete-fill" aria-hidden="true" />
      <svg
        className="card-delete-icon"
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
