import { useState, useEffect, useRef } from 'react';
import type { Problem, Solution, Architecture, Infrastructure, AppPrototype } from '../api/client';

interface PlexVisualizerProps {
  component: 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';
  data: Problem | Solution | Architecture | Infrastructure | AppPrototype;
  relatedSolutions?: Solution[];
  relatedApps?: AppPrototype[];
  onNavigate: (path: string) => void;
}

interface NodeData {
  id: string;
  label: string;
  type: 'problem' | 'solution' | 'architecture' | 'infrastructure' | 'app';
  x: number;
  y: number;
  icon: string;
  isParent?: boolean;
  isCategory?: boolean;
  items?: { id: string; title: string }[];
}

interface FloatingPanelState {
  type: 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';
  title: string;
  items: { id: string; title: string }[];
  x: number;
  y: number;
}

function PlexIcon({ type, className = '' }: { type: string; className?: string }) {
  switch (type) {
    case 'problem':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'solution':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <line x1="9" y1="18" x2="15" y2="18" />
          <line x1="10" y1="22" x2="14" y2="22" />
        </svg>
      );
    case 'architecture':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    case 'infrastructure':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case 'app':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z" />
          <path d="M6 21a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v12a3 3 0 0 0 3 3Z" />
          <path d="M15 6H9" />
          <path d="M15 18H9" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );
    case 'close':
    case 'x':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    default:
      return null;
  }
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

export function PlexVisualizer({
  component,
  data,
  relatedSolutions = [],
  relatedApps = [],
  onNavigate,
}: PlexVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });
  const [floatingPanel, setFloatingPanel] = useState<FloatingPanelState | null>(null);

  // Monitor container resizing dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 600,
          height: entry.contentRect.height || 350,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Close floating panel on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (floatingPanel && containerRef.current) {
        const panelElement = containerRef.current.querySelector('.plex-floating-panel');
        if (panelElement && !panelElement.contains(e.target as Node)) {
          setFloatingPanel(null);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [floatingPanel]);

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;

  // Build the local graph nodes and links depending on the active component
  const nodes: NodeData[] = [];
  const links: { sourceId: string; targetId: string; gradId: string }[] = [];

  if (component === 'problems') {
    const problem = data as Problem;
    // Center: Problem
    nodes.push({
      id: problem.id,
      label: problem.title,
      type: 'problem',
      x: cx - NODE_WIDTH / 2,
      y: cy - NODE_HEIGHT / 2,
      icon: 'problem',
      isParent: true,
    });

    const outerItems: { id: string; label: string; type: 'solution' | 'app'; icon: string; grad: string; isCategory?: boolean; items?: { id: string; title: string }[] }[] = [];

    // Solutions: 1 direct, >1 category node
    const sols = problem.solutions || [];
    if (sols.length === 1) {
      outerItems.push({
        id: sols[0].id,
        label: sols[0].title,
        type: 'solution',
        icon: 'solution',
        grad: 'grad-prob-sol',
      });
    } else if (sols.length > 1) {
      outerItems.push({
        id: 'cat-solutions',
        label: 'Solutions',
        type: 'solution',
        icon: 'solution',
        grad: 'grad-prob-sol',
        isCategory: true,
        items: sols.map((s) => ({ id: s.id, title: s.title })),
      });
    }

    // Apps: 1 direct, >1 category node
    const apps = relatedApps || [];
    if (apps.length === 1) {
      outerItems.push({
        id: apps[0].id,
        label: apps[0].title,
        type: 'app',
        icon: 'app',
        grad: 'grad-prob-app',
      });
    } else if (apps.length > 1) {
      outerItems.push({
        id: 'cat-apps',
        label: 'Apps',
        type: 'app',
        icon: 'app',
        grad: 'grad-prob-app',
        isCategory: true,
        items: apps.map((a) => ({ id: a.id, title: a.title })),
      });
    }

    const rx = Math.max(120, Math.min(cx * 0.55, 220));
    const ry = Math.max(70, Math.min(cy * 0.55, 100));

    outerItems.forEach((item, index) => {
      const angle = outerItems.length === 1 
        ? Math.PI / 2 
        : (index * 2 * Math.PI) / outerItems.length + Math.PI / 2;
      const x = cx + rx * Math.cos(angle) - NODE_WIDTH / 2;
      const y = cy + ry * Math.sin(angle) - NODE_HEIGHT / 2;

      nodes.push({
        id: item.id,
        label: item.label,
        type: item.type,
        x,
        y,
        icon: item.icon,
        isCategory: item.isCategory,
        items: item.items,
      });

      links.push({
        sourceId: problem.id,
        targetId: item.id,
        gradId: item.grad,
      });
    });
  } else if (component === 'solutions') {
    const solution = data as Solution;
    // Center: Solution
    nodes.push({
      id: solution.id,
      label: solution.title,
      type: 'solution',
      x: cx - NODE_WIDTH / 2,
      y: cy - NODE_HEIGHT / 2,
      icon: 'solution',
      isParent: true,
    });

    const outerItems: { id: string; label: string; type: 'problem' | 'architecture' | 'infrastructure' | 'app'; icon: string; grad: string; isCategory?: boolean; items?: { id: string; title: string }[] }[] = [];
    
    if (solution.problem) {
      outerItems.push({
        id: solution.problem.id,
        label: solution.problem.title,
        type: 'problem',
        icon: 'problem',
        grad: 'grad-prob-sol',
      });
    }

    // Architectures: 1 direct, >1 category node
    const archs = solution.architectures || [];
    if (archs.length === 1) {
      outerItems.push({
        id: archs[0].id,
        label: archs[0].title,
        type: 'architecture',
        icon: 'architecture',
        grad: 'grad-sol-arch',
      });
    } else if (archs.length > 1) {
      outerItems.push({
        id: 'cat-architecture',
        label: 'Architecture',
        type: 'architecture',
        icon: 'architecture',
        grad: 'grad-sol-arch',
        isCategory: true,
        items: archs.map((a) => ({ id: a.id, title: a.title })),
      });
    }

    // Infrastructures: 1 direct, >1 category node
    const infras = solution.infrastructures || [];
    if (infras.length === 1) {
      outerItems.push({
        id: infras[0].id,
        label: infras[0].title,
        type: 'infrastructure',
        icon: 'infrastructure',
        grad: 'grad-sol-infra',
      });
    } else if (infras.length > 1) {
      outerItems.push({
        id: 'cat-infrastructure',
        label: 'Infrastructure',
        type: 'infrastructure',
        icon: 'infrastructure',
        grad: 'grad-sol-infra',
        isCategory: true,
        items: infras.map((i) => ({ id: i.id, title: i.title })),
      });
    }

    // Apps: 1 direct, >1 category node
    const apps = solution.apps || [];
    if (apps.length === 1) {
      outerItems.push({
        id: apps[0].id,
        label: apps[0].title,
        type: 'app',
        icon: 'app',
        grad: 'grad-sol-app',
      });
    } else if (apps.length > 1) {
      outerItems.push({
        id: 'cat-apps',
        label: 'Apps',
        type: 'app',
        icon: 'app',
        grad: 'grad-sol-app',
        isCategory: true,
        items: apps.map((a) => ({ id: a.id, title: a.title })),
      });
    }

    const rx = Math.max(120, Math.min(cx * 0.55, 220));
    const ry = Math.max(70, Math.min(cy * 0.55, 100));

    outerItems.forEach((item, index) => {
      const angle = outerItems.length === 1 
        ? Math.PI / 2 
        : (index * 2 * Math.PI) / outerItems.length + Math.PI / 2;
      const x = cx + rx * Math.cos(angle) - NODE_WIDTH / 2;
      const y = cy + ry * Math.sin(angle) - NODE_HEIGHT / 2;

      nodes.push({
        id: item.id,
        label: item.label,
        type: item.type,
        x,
        y,
        icon: item.icon,
        isCategory: item.isCategory,
        items: item.items,
      });

      links.push({
        sourceId: solution.id,
        targetId: item.id,
        gradId: item.grad,
      });
    });
  } else if (component === 'architecture') {
    const arch = data as Architecture;
    // Center: Architecture
    nodes.push({
      id: arch.id,
      label: arch.title,
      type: 'architecture',
      x: cx - NODE_WIDTH / 2,
      y: cy - NODE_HEIGHT / 2,
      icon: 'architecture',
      isParent: true,
    });

    const outerItems: { id: string; label: string; type: 'solution'; icon: string; grad: string; isCategory?: boolean; items?: { id: string; title: string }[] }[] = [];

    // Solutions: 1 direct, >1 category node
    const sols = relatedSolutions || [];
    if (sols.length === 1) {
      outerItems.push({
        id: sols[0].id,
        label: sols[0].title,
        type: 'solution',
        icon: 'solution',
        grad: 'grad-sol-arch',
      });
    } else if (sols.length > 1) {
      outerItems.push({
        id: 'cat-solutions',
        label: 'Solutions',
        type: 'solution',
        icon: 'solution',
        grad: 'grad-sol-arch',
        isCategory: true,
        items: sols.map((s) => ({ id: s.id, title: s.title })),
      });
    }

    const rx = Math.max(120, Math.min(cx * 0.55, 220));
    const ry = Math.max(70, Math.min(cy * 0.55, 100));

    outerItems.forEach((item, index) => {
      const angle = outerItems.length === 1 
        ? Math.PI / 2 
        : (index * 2 * Math.PI) / outerItems.length + Math.PI / 2;
      const x = cx + rx * Math.cos(angle) - NODE_WIDTH / 2;
      const y = cy + ry * Math.sin(angle) - NODE_HEIGHT / 2;

      nodes.push({
        id: item.id,
        label: item.label,
        type: item.type,
        x,
        y,
        icon: item.icon,
        isCategory: item.isCategory,
        items: item.items,
      });

      links.push({
        sourceId: arch.id,
        targetId: item.id,
        gradId: item.grad,
      });
    });
  } else if (component === 'infrastructure') {
    const infra = data as Infrastructure;
    // Center: Infrastructure
    nodes.push({
      id: infra.id,
      label: infra.title,
      type: 'infrastructure',
      x: cx - NODE_WIDTH / 2,
      y: cy - NODE_HEIGHT / 2,
      icon: 'infrastructure',
      isParent: true,
    });

    const outerItems: { id: string; label: string; type: 'solution'; icon: string; grad: string; isCategory?: boolean; items?: { id: string; title: string }[] }[] = [];

    // Solutions: 1 direct, >1 category node
    const sols = relatedSolutions || [];
    if (sols.length === 1) {
      outerItems.push({
        id: sols[0].id,
        label: sols[0].title,
        type: 'solution',
        icon: 'solution',
        grad: 'grad-sol-infra',
      });
    } else if (sols.length > 1) {
      outerItems.push({
        id: 'cat-solutions',
        label: 'Solutions',
        type: 'solution',
        icon: 'solution',
        grad: 'grad-sol-infra',
        isCategory: true,
        items: sols.map((s) => ({ id: s.id, title: s.title })),
      });
    }

    const rx = Math.max(120, Math.min(cx * 0.55, 220));
    const ry = Math.max(70, Math.min(cy * 0.55, 100));

    outerItems.forEach((item, index) => {
      const angle = outerItems.length === 1 
        ? Math.PI / 2 
        : (index * 2 * Math.PI) / outerItems.length + Math.PI / 2;
      const x = cx + rx * Math.cos(angle) - NODE_WIDTH / 2;
      const y = cy + ry * Math.sin(angle) - NODE_HEIGHT / 2;

      nodes.push({
        id: item.id,
        label: item.label,
        type: item.type,
        x,
        y,
        icon: item.icon,
        isCategory: item.isCategory,
        items: item.items,
      });

      links.push({
        sourceId: infra.id,
        targetId: item.id,
        gradId: item.grad,
      });
    });
  } else if (component === 'apps') {
    const app = data as AppPrototype;
    // Center: App
    nodes.push({
      id: app.id,
      label: app.title,
      type: 'app',
      x: cx - NODE_WIDTH / 2,
      y: cy - NODE_HEIGHT / 2,
      icon: 'app',
      isParent: true,
    });

    const outerItems: { id: string; label: string; type: 'problem' | 'solution'; icon: string; grad: string; isCategory?: boolean; items?: { id: string; title: string }[] }[] = [];
    if (app.problem) {
      outerItems.push({
        id: app.problem.id,
        label: app.problem.title,
        type: 'problem',
        icon: 'problem',
        grad: 'grad-prob-app',
      });
    }

    // Solutions: 1 direct, >1 category node
    const sols = app.solutions || [];
    if (sols.length === 1) {
      outerItems.push({
        id: sols[0].id,
        label: sols[0].title,
        type: 'solution',
        icon: 'solution',
        grad: 'grad-sol-app',
      });
    } else if (sols.length > 1) {
      outerItems.push({
        id: 'cat-solutions',
        label: 'Solutions',
        type: 'solution',
        icon: 'solution',
        grad: 'grad-sol-app',
        isCategory: true,
        items: sols.map((s) => ({ id: s.id, title: s.title })),
      });
    }

    const rx = Math.max(120, Math.min(cx * 0.55, 220));
    const ry = Math.max(70, Math.min(cy * 0.55, 100));

    outerItems.forEach((item, index) => {
      const angle = outerItems.length === 1 
        ? Math.PI / 2 
        : (index * 2 * Math.PI) / outerItems.length + Math.PI / 2;
      const x = cx + rx * Math.cos(angle) - NODE_WIDTH / 2;
      const y = cy + ry * Math.sin(angle) - NODE_HEIGHT / 2;

      nodes.push({
        id: item.id,
        label: item.label,
        type: item.type,
        x,
        y,
        icon: item.icon,
        isCategory: item.isCategory,
        items: item.items,
      });

      links.push({
        sourceId: app.id,
        targetId: item.id,
        gradId: item.grad,
      });
    });
  }

  // Draw smooth Bezier connector line
  const makeBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    // Avoid perfectly vertical or horizontal lines to ensure SVG linear gradients render correctly
    // due to the bounding box zero-dimension bug.
    const targetX = Math.abs(x2 - x1) < 0.1 ? x2 + 0.1 : x2;
    const targetY = Math.abs(y2 - y1) < 0.1 ? y2 + 0.1 : y2;

    const dx = Math.abs(targetX - x1) * 0.5;
    const ctrl1X = x1 + (targetX > x1 ? dx : -dx);
    const ctrl1Y = y1;
    const ctrl2X = targetX + (targetX > x1 ? -dx : dx);
    const ctrl2Y = targetY;
    return `M ${x1} ${y1} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${targetX} ${targetY}`;
  };

  const handleNodeClick = (node: NodeData) => {
    if (node.isParent) return;

    if (node.isCategory && node.items) {
      // Toggle floating category list
      const title = 
        node.type === 'problem' ? 'Related Problems' :
        node.type === 'solution' ? 'Related Solutions' :
        node.type === 'architecture' ? 'Architecture Pattern Stacks' :
        node.type === 'infrastructure' ? 'Infrastructure Deployments' :
        node.type === 'app' ? 'Linked Prototypes' : 'Entities';

      const targetType = 
        node.type === 'problem' ? 'problems' :
        node.type === 'solution' ? 'solutions' :
        node.type === 'architecture' ? 'architecture' :
        node.type === 'infrastructure' ? 'infrastructure' :
        node.type === 'app' ? 'apps' : 'solutions';

      let left = node.x + NODE_WIDTH + 12;
      let top = node.y - 15;
      if (left + 260 > dimensions.width) {
        left = node.x - 260 - 12;
      }
      if (top + 180 > dimensions.height) {
        top = dimensions.height - 195;
      }
      if (top < 10) top = 10;

      setFloatingPanel({
        type: targetType as any,
        title,
        items: node.items,
        x: left,
        y: top,
      });
      return;
    }

    if (node.type === 'problem') {
      onNavigate(`/problems/${node.id}`);
    } else if (node.type === 'solution') {
      onNavigate(`/solutions/${node.id}`);
    } else if (node.type === 'app') {
      onNavigate(`/apps/${node.id}`);
    } else if (node.type === 'architecture') {
      onNavigate(`/architecture/${node.id}`);
    } else if (node.type === 'infrastructure') {
      onNavigate(`/infrastructure/${node.id}`);
    }
  };

  return (
    <div className="plex-visualizer-container" ref={containerRef}>
      <div className="plex-graph-viewport">
        {/* SVG connection paths */}
        <svg className="plex-graph-svg" width="100%" height="100%">
          <defs>
            <filter id="plex-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="grad-prob-sol" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-problem)" />
              <stop offset="100%" stopColor="var(--accent-solution)" />
            </linearGradient>
            <linearGradient id="grad-sol-arch" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-solution)" />
              <stop offset="100%" stopColor="var(--accent-arch)" />
            </linearGradient>
            <linearGradient id="grad-sol-infra" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-solution)" />
              <stop offset="100%" stopColor="var(--accent-infra)" />
            </linearGradient>
            <linearGradient id="grad-prob-app" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-problem)" />
              <stop offset="100%" stopColor="var(--accent-cyan)" />
            </linearGradient>
            <linearGradient id="grad-sol-app" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-solution)" />
              <stop offset="100%" stopColor="var(--accent-cyan)" />
            </linearGradient>
          </defs>

          <g>
            {links.map((link, idx) => {
              const src = nodes.find((n) => n.id === link.sourceId);
              const tgt = nodes.find((n) => n.id === link.targetId);
              if (!src || !tgt) return null;

              const pathStr = makeBezierPath(
                src.x + NODE_WIDTH / 2,
                src.y + NODE_HEIGHT / 2,
                tgt.x + NODE_WIDTH / 2,
                tgt.y + NODE_HEIGHT / 2
              );

              return (
                <path
                  key={idx}
                  d={pathStr}
                  stroke={`url(#${link.gradId})`}
                  className={`plex-link-path link-${link.gradId}`}
                />
              );
            })}
          </g>
        </svg>

        {/* Nodes layout layers */}
        {nodes.map((node) => {
          const typeClass = `plex-node-${node.type}`;
          const parentClass = node.isParent ? 'plex-node-parent' : '';

          return (
            <div
              key={node.id}
              className={`plex-node-card ${typeClass} ${parentClass}`}
              style={{
                position: 'absolute',
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
              }}
              onClick={() => handleNodeClick(node)}
            >
              <div className={`plex-node-icon-wrapper bg-${node.type}`}>
                <PlexIcon type={node.icon} className="node-icon" />
              </div>
              <div className="plex-node-details">
                <span className="plex-node-label">{node.type}</span>
                <span className="plex-node-title" title={node.label}>
                  {node.label}
                </span>
              </div>
            </div>
          );
        })}

        {/* Dynamic floating category stacks */}
        {floatingPanel && (
          <div
            className="plex-floating-panel"
            style={{
              left: `${floatingPanel.x}px`,
              top: `${floatingPanel.y}px`,
            }}
          >
            <div className="plex-floating-header">
              <span>{floatingPanel.title}</span>
              <button
                type="button"
                onClick={() => setFloatingPanel(null)}
                aria-label="Close details panel"
              >
                <PlexIcon type="close" />
              </button>
            </div>
            <ul className="plex-floating-list">
              {floatingPanel.items.length === 0 ? (
                <li className="plex-floating-empty">No components registered</li>
              ) : (
                floatingPanel.items.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => {
                      onNavigate(`/${floatingPanel.type}/${item.id}`);
                      setFloatingPanel(null);
                    }}
                  >
                    <div className="list-bullet"></div>
                    <span className="list-item-text">{item.title}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
