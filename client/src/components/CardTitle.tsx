import { useEffect, useRef, useState } from 'react';

interface CardTitleProps {
  title: string;
}

export function CardTitle({ title }: CardTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [title]);

  return (
    <h4 ref={ref} className="card-title" title={isTruncated ? title : undefined}>
      {title}
    </h4>
  );
}
