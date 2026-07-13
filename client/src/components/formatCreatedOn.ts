/** Format API ISO timestamps as "Created on: 13 July 2026". */
export function formatCreatedOn(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  return `Created on: ${formatted}`;
}
