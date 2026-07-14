interface UnauthorizedViewProps {
  onNavigate: (path: string) => void;
}

export function UnauthorizedView({ onNavigate }: UnauthorizedViewProps) {
  return (
    <div
      className="error-container"
      style={{
        padding: '2rem',
        maxWidth: '600px',
        margin: '4rem auto',
        border: '1px solid var(--accent-problem)',
        background: 'var(--bg-secondary)',
        textAlign: 'center',
      }}
    >
      <h3
        style={{
          color: 'var(--accent-problem)',
          textTransform: 'uppercase',
          marginBottom: '1rem',
        }}
      >
        Access Denied
      </h3>
      <p className="status-text" style={{ marginBottom: '1.5rem' }}>
        You do not have permission to perform this action. Contact an administrator
        if you believe this is an error.
      </p>
      <button
        type="button"
        className="submit-btn"
        style={{
          borderColor: 'var(--accent-problem)',
          color: 'var(--accent-problem)',
          background: 'transparent',
        }}
        onClick={() => onNavigate('/')}
      >
        ← Return to Dashboard
      </button>
    </div>
  );
}
