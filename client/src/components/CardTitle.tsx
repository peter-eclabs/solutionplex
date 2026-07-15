import { useEffect, useRef, useState } from 'react';

interface CardTitleProps {
  title: string;
  maxChars?: number;
}

export function CardTitle({ title, maxChars = 30 }: CardTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const truncated = title.length > maxChars;
  const display = truncated ? `${title.slice(0, maxChars)}…` : title;

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth || truncated);
    }
  }, [title, truncated]);

  return (
    <h4 ref={ref} className="card-title" title={isTruncated ? title : undefined}>
      {display}
    </h4>
  );
}
