import { useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface LabelItem {
  id: string;
  title: string;
}

interface LabelPreviewProps {
  architectures: LabelItem[];
  infrastructures: LabelItem[];
  className?: string;
}

type Chip = { id: string; title: string; kind: 'arch' | 'infra' };

export function LabelPreview({
  architectures,
  infrastructures,
  className = '',
}: LabelPreviewProps) {
  const chips: Chip[] = useMemo(
    () => [
      ...architectures.map((a) => ({
        id: a.id,
        title: a.title,
        kind: 'arch' as const,
      })),
      ...infrastructures.map((i) => ({
        id: i.id,
        title: i.title,
        kind: 'infra' as const,
      })),
    ],
    [architectures, infrastructures],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(chips.length);

  useLayoutEffect(() => {
    if (chips.length === 0) return;

    const measure = () => {
      const container = containerRef.current;
      const measureRow = measureRef.current;
      if (!container || !measureRow) return;

      const available = container.clientWidth;
      const children = Array.from(measureRow.children) as HTMLElement[];
      if (children.length === 0) {
        setVisibleCount(0);
        return;
      }

      const moreEl = children[children.length - 1];
      const moreWidth = moreEl.offsetWidth;
      const gap = 4;
      const chipEls = children.slice(0, -1);

      let used = 0;
      let fit = 0;
      for (let i = 0; i < chipEls.length; i++) {
        const w = chipEls[i].offsetWidth;
        const remaining = chipEls.length - (i + 1);
        const needMore = remaining > 0;
        const next = used + (fit > 0 ? gap : 0) + w;
        const withMore = needMore ? next + gap + moreWidth : next;
        if (withMore <= available) {
          used = next;
          fit = i + 1;
        } else {
          break;
        }
      }

      if (fit === 0 && chips.length > 0 && moreWidth <= available) {
        setVisibleCount(0);
        return;
      }
      setVisibleCount(fit);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [chips]);

  if (chips.length === 0) return null;

  const hidden = Math.max(0, chips.length - visibleCount);
  const shown = chips.slice(0, visibleCount);

  return (
    <div className={`label-preview ${className}`.trim()} ref={containerRef}>
      <div className="label-preview-measure" ref={measureRef} aria-hidden="true">
        {chips.map((c) => (
          <span
            key={`m-${c.kind}-${c.id}`}
            className={`solution-tag ${c.kind === 'arch' ? 'tag-arch' : 'tag-infra'}`}
          >
            {c.title}
          </span>
        ))}
        <span className="solution-tag tag-more">+{chips.length} more</span>
      </div>

      <div className="label-preview-row">
        {shown.map((c) => (
          <span
            key={`${c.kind}-${c.id}`}
            className={`solution-tag ${c.kind === 'arch' ? 'tag-arch' : 'tag-infra'}`}
          >
            {c.title}
          </span>
        ))}
        {hidden > 0 && (
          <span
            className="solution-tag tag-more"
            title={chips
              .slice(visibleCount)
              .map((c) => c.title)
              .join(', ')}
          >
            +{hidden} more
          </span>
        )}
      </div>
    </div>
  );
}
