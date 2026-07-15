import { EyeOff } from "lucide-react";

export function HiddenBadge() {
  return (
    <span className="hidden-badge" title="hidden" aria-label="hidden">
      <EyeOff className="w-4 h-4" />
    </span>
  );
}
