import { useMemo } from 'react';
import { marked } from 'marked';
import './MarkdownRenderer.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const parsedHtml = useMemo(() => {
    try {
      // marked.parse runs synchronously in modern versions unless async: true is passed
      const html = marked.parse(content || '') as string;
      // Wrap tables so overflow-wide tables become horizontally scrollable
      return html.replace(
        /<table[\s\S]*?<\/table>/g,
        (match) => `<div class="md-scroll-x">${match}</div>`,
      );
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return content || '';
    }
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
}
