interface HiddenToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function HiddenToggle({ checked, onChange, disabled }: HiddenToggleProps) {
  return (
    <div className="form-field hidden-toggle-field">
      <label className="hidden-toggle-label">
        <span>Hide from readers?</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </label>
      <p className="field-hint">
        Hidden cards are visible only to Admin/SuperAdmin. Linked solutions and apps
        are hidden automatically.
      </p>
    </div>
  );
}
