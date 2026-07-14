interface CharCounterProps {
  value: string;
  max: number;
}

export function CharCounter({ value, max }: CharCounterProps) {
  const count = value.length;
  const atLimit = count >= max;
  return (
    <span className={`char-counter${atLimit ? ' at-limit' : ''}`} aria-live="polite">
      {count}/{max}
    </span>
  );
}
