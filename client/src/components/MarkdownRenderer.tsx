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
      return marked.parse(content || '') as string;
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
