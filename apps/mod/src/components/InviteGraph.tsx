'use client';

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { type GraphEdge, type GraphNode, nodeName } from '~/lib/inviteGraph';

import { Button } from './ui/button';

type SimNode = SimulationNodeDatum & { id: string; r: number; level: number };
type SimLink = SimulationLinkDatum<SimNode>;
type View = { x: number; y: number; k: number };
type Drag =
  | { kind: 'pan'; startX: number; startY: number; view: View; moved: boolean }
  | { kind: 'node'; node: SimNode; startX: number; startY: number; moved: boolean };

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
/** Zoomed in this far, every name shows; further out only the focus, sources and big inviters do. */
const NAMES_AT = 1.3;
/** Graphs this small show every name. */
const SMALL = 60;

function nodeRadius(n: GraphNode): number {
  return n.type === 'person' ? 6 + Math.min(18, 3 * Math.sqrt(n.total ?? 0)) : 11;
}

function nodeFill(n: GraphNode): string {
  if (n.type === 'waitlist') return colors.ink;
  if (n.type === 'admin') return colors.appealText;
  if (n.status === 'suspended') return colors.danger;
  if (n.status === 'deleted') return colors.chevron;
  if (n.status === 'waiting') return colors.dashed;
  return colors.brand;
}

/** What a screen reader hears for a node, and the info line under the graph. */
function describe(n: GraphNode): string {
  const parts = [nodeName(n)];
  if (n.type === 'person') {
    if (n.display_name) parts.push(n.display_name);
    parts.push(t(`users.invites.status.${n.status ?? 'active'}`));
    if (n.frozen) parts.push(t('graph.paused'));
  } else if (n.note) {
    parts.push(n.note);
  }
  parts.push(t('graph.direct', { count: n.direct }));
  if (n.total !== null) parts.push(t('graph.total', { count: n.total }));
  return parts.join(' · ');
}

/**
 * A force-directed invite graph (console only): people and the waitlist or admin codes they joined with, an arrow
 * from inviter to invitee. Drag the background to pan, scroll or use the buttons to zoom, drag a person to move
 * them, click or press Enter on a person to open their page. Suspended people are red, paused invites have a
 * dashed ring, and a person grows with everyone below them. `layered` lays a tree out top to bottom by level.
 */
export function InviteGraph({
  nodes,
  edges,
  focus,
  layered = false,
  height = 520,
  label,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focus?: string;
  layered?: boolean;
  height?: number;
  label: string;
}) {
  const router = useRouter();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef<SVGGElement>(null);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const edgeEls = useRef(new Map<number, SVGLineElement>());
  const sim = useRef<{ simulation: Simulation<SimNode, SimLink>; byId: Map<string, SimNode>; links: SimLink[] }>(null);
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const drag = useRef<Drag>(null);
  const touched = useRef(false);
  const [lit, setLit] = useState<string | null>(null);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // Edges are matched to their lines by index, so the simulation and the drawing use this same list.
  const links = useMemo(() => edges.filter((e) => byId.has(e.source) && byId.has(e.target)), [edges, byId]);
  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of links) {
      map.set(e.source, (map.get(e.source) ?? new Set()).add(e.target));
      map.set(e.target, (map.get(e.target) ?? new Set()).add(e.source));
    }
    return map;
  }, [links]);
  // The names shown while zoomed out: the focus, sources and the 12 biggest inviters.
  const major = useMemo(() => {
    const big = nodes
      .filter((n) => n.type === 'person' && (n.total ?? 0) > 0)
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 12)
      .map((n) => n.id);
    return new Set([...big, ...nodes.filter((n) => n.type !== 'person').map((n) => n.id), ...(focus ? [focus] : [])]);
  }, [nodes, focus]);

  const isLit = (id: string) => lit === null || id === lit || (neighbours.get(lit)?.has(id) ?? false);

  // Writes node and edge positions straight to the SVG, so the simulation's ticks don't re-render React.
  function draw() {
    const s = sim.current;
    if (!s) return;
    for (const n of s.byId.values()) {
      nodeEls.current.get(n.id)?.setAttribute('transform', `translate(${n.x ?? 0},${n.y ?? 0})`);
    }
    s.links.forEach((l, i) => {
      const el = edgeEls.current.get(i);
      const a = l.source as SimNode;
      const b = l.target as SimNode;
      if (!el) return;
      const dx = (b.x ?? 0) - (a.x ?? 0);
      const dy = (b.y ?? 0) - (a.y ?? 0);
      const d = Math.hypot(dx, dy) || 1;
      el.setAttribute('x1', String(a.x ?? 0));
      el.setAttribute('y1', String(a.y ?? 0));
      el.setAttribute('x2', String((b.x ?? 0) - (dx / d) * (b.r + 3)));
      el.setAttribute('y2', String((b.y ?? 0) - (dy / d) * (b.r + 3)));
    });
  }

  function applyView(next: View) {
    view.current = next;
    viewRef.current?.setAttribute('transform', `translate(${next.x},${next.y}) scale(${next.k})`);
    svgRef.current?.setAttribute('data-near', next.k >= NAMES_AT || nodes.length <= SMALL ? '1' : '0');
  }

  function fit() {
    const s = sim.current;
    const svg = svgRef.current;
    if (!s || !svg || s.byId.size === 0) return;
    const { width, height: h } = svg.getBoundingClientRect();
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const n of s.byId.values()) {
      x0 = Math.min(x0, (n.x ?? 0) - n.r);
      y0 = Math.min(y0, (n.y ?? 0) - n.r);
      x1 = Math.max(x1, (n.x ?? 0) + n.r);
      y1 = Math.max(y1, (n.y ?? 0) + n.r);
    }
    const k = Math.min(MAX_ZOOM, 2, Math.max(MIN_ZOOM, Math.min(width / (x1 - x0 + 80), h / (y1 - y0 + 80))));
    applyView({ k, x: width / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k });
  }

  function zoomBy(factor: number, cx?: number, cy?: number) {
    const svg = svgRef.current;
    if (!svg) return;
    touched.current = true;
    const rect = svg.getBoundingClientRect();
    const px = cx ?? rect.width / 2;
    const py = cy ?? rect.height / 2;
    const v = view.current;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
    applyView({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k });
  }

  // The simulation, rebuilt when the graph changes (another person, another depth).
  useEffect(() => {
    const simNodes: SimNode[] = nodes.map((n, i) => ({
      id: n.id,
      r: nodeRadius(n),
      level: n.level ?? 0,
      // A spiral start, so the first frames are calm and the same graph lays out the same way each time.
      x: Math.cos(i * 2.4) * 12 * Math.sqrt(i),
      y: (layered ? (n.level ?? 0) * 90 : 0) + Math.sin(i * 2.4) * 12 * Math.sqrt(i),
    }));
    const ids = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = links.map((e) => ({ source: e.source, target: e.target }));
    const simulation = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((n) => n.id)
          .distance(layered ? 60 : 34),
      )
      .force(
        'charge',
        forceManyBody<SimNode>()
          .strength(layered ? -220 : -70)
          .distanceMax(layered ? 600 : 320),
      )
      // In a tree, siblings sit side by side, so leave room for their names.
      .force('collide', forceCollide<SimNode>((n) => n.r + (layered ? 34 : 5)).strength(layered ? 0.9 : 0.7))
      .force('x', forceX<SimNode>(0).strength(layered ? 0.03 : 0.06))
      .force('y', layered ? forceY<SimNode>((n) => n.level * 90).strength(0.6) : forceY<SimNode>(0).strength(0.06))
      .stop();
    sim.current = { simulation, byId: ids, links: simLinks };
    touched.current = false;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Settle most of the way before the first frame, so the graph opens already in shape; animate the rest.
    simulation.tick(reduced ? 300 : 80);
    draw();
    fit();
    if (!reduced) {
      simulation.on('tick', () => {
        draw();
        if (!touched.current && simulation.alpha() > 0.02) fit();
      });
      simulation.restart();
    }
    return () => {
      simulation.stop();
      sim.current = null;
    };
    // draw and fit only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, layered]);

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // zoomBy only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(id: string) {
    const n = byId.get(id);
    if (n?.type === 'person' && id !== focus) router.push(`/users/${id}`);
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const id = (e.target as Element).closest('[data-node]')?.getAttribute('data-node');
    const node = id ? sim.current?.byId.get(id) : undefined;
    e.currentTarget.setPointerCapture(e.pointerId);
    touched.current = true;
    drag.current = node
      ? { kind: 'node', node, startX: e.clientX, startY: e.clientY, moved: false }
      : { kind: 'pan', startX: e.clientX, startY: e.clientY, view: view.current, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    if (d.kind === 'pan') {
      applyView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const v = view.current;
    d.node.fx = (e.clientX - rect.left - v.x) / v.k;
    d.node.fy = (e.clientY - rect.top - v.y) / v.k;
    const s = sim.current?.simulation;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.node.x = d.node.fx;
      d.node.y = d.node.fy;
      draw();
    } else {
      s?.alphaTarget(0.25).restart();
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind !== 'node') return;
    d.node.fx = null;
    d.node.fy = null;
    sim.current?.simulation.alphaTarget(0);
    if (!d.moved) open(d.node.id);
  }

  const info = lit ? byId.get(lit) : undefined;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          position: 'relative',
          height,
          borderRadius: radius.card,
          overflow: 'hidden',
          background: colors.background,
          border: `1px solid ${colors.divider}`,
        }}
      >
        <svg
          ref={svgRef}
          role="group"
          aria-label={label}
          data-near="0"
          className={`graph-${uid}`}
          width="100%"
          height="100%"
          style={{ display: 'block', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <style>{`
            .graph-${uid}[data-near="0"] text[data-minor]:not([data-lit]) { display: none; }
            .graph-${uid} [data-node] { cursor: pointer; }
            .graph-${uid} [data-node]:focus { outline: none; }
            .graph-${uid} [data-node]:focus-visible .ring { stroke: ${colors.zoneText}; stroke-width: 3; }
          `}</style>
          <defs>
            {[
              ['dim', colors.dashed],
              ['lit', colors.brandLink],
            ].map(([key, fill]) => (
              <marker
                key={key}
                id={`${uid}-${key}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={fill} />
              </marker>
            ))}
          </defs>
          <g ref={viewRef}>
            <g aria-hidden>
              {links.map((e, i) => {
                const on = lit !== null && (e.source === lit || e.target === lit);
                return (
                  <line
                    key={`${e.source}>${e.target}`}
                    ref={(el) => {
                      if (el) edgeEls.current.set(i, el);
                      else edgeEls.current.delete(i);
                    }}
                    stroke={on ? colors.brandLink : colors.dashed}
                    strokeWidth={on ? 2 : 1.2}
                    strokeDasharray={e.via_link ? '4 3' : undefined}
                    opacity={lit === null || on ? 1 : 0.25}
                    markerEnd={`url(#${uid}-${on ? 'lit' : 'dim'})`}
                  />
                );
              })}
            </g>
            {nodes.map((n) => {
              const r = nodeRadius(n);
              const isFocus = n.id === focus;
              const shown = isLit(n.id);
              return (
                <g
                  key={n.id}
                  ref={(el) => {
                    if (el) nodeEls.current.set(n.id, el);
                    else nodeEls.current.delete(n.id);
                  }}
                  data-node={n.id}
                  role={n.type === 'person' && !isFocus ? 'link' : 'img'}
                  tabIndex={0}
                  aria-label={describe(n)}
                  opacity={shown ? 1 : 0.25}
                  onPointerEnter={() => setLit(n.id)}
                  onPointerLeave={() => setLit((cur) => (cur === n.id ? null : cur))}
                  onFocus={() => setLit(n.id)}
                  onBlur={() => setLit((cur) => (cur === n.id ? null : cur))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      open(n.id);
                    }
                  }}
                >
                  {isFocus ? <circle r={r + 6} fill="none" stroke={colors.ink} strokeWidth={2.5} /> : null}
                  {n.type === 'person' ? (
                    <circle
                      className="ring"
                      r={r}
                      fill={nodeFill(n)}
                      stroke={n.frozen ? colors.likeText : colors.surface}
                      strokeWidth={n.frozen ? 3 : 1.5}
                      strokeDasharray={n.frozen ? '3 2' : undefined}
                    />
                  ) : (
                    <rect
                      className="ring"
                      x={-r}
                      y={-r}
                      width={r * 2}
                      height={r * 2}
                      rx={4}
                      fill={nodeFill(n)}
                      stroke={colors.surface}
                      strokeWidth={1.5}
                    />
                  )}
                  <text
                    data-minor={major.has(n.id) ? undefined : ''}
                    data-lit={lit !== null && shown ? '' : undefined}
                    y={r + 13}
                    textAnchor="middle"
                    fontSize={isFocus ? 13 : 11}
                    fontWeight={isFocus || n.type !== 'person' ? 800 : 600}
                    fill={colors.ink}
                    stroke={colors.background}
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {nodeName(n)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div
          role="toolbar"
          aria-label={t('graph.controls')}
          className="absolute top-2.5 right-2.5 flex gap-1 rounded-full border border-border bg-card p-1 shadow-md"
        >
          <Button type="button" size="sm" variant="ghost" aria-label={t('graph.zoomIn')} onClick={() => zoomBy(1.3)}>
            <Plus aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('graph.zoomOut')}
            onClick={() => zoomBy(1 / 1.3)}
          >
            <Minus aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              touched.current = true;
              fit();
            }}
          >
            {t('graph.fit')}
          </Button>
        </div>
      </div>
      <p aria-live="polite" style={{ margin: 0, fontSize: 13, minHeight: 18, color: info ? colors.ink : colors.muted }}>
        {info ? describe(info) : t('graph.hint')}
      </p>
      <Legend />
    </div>
  );
}

function Legend() {
  const dot = (fill: string, extra: object = {}) => (
    <svg width="16" height="16" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6" fill={fill} stroke={colors.surface} strokeWidth="1.5" {...extra} />
    </svg>
  );
  const square = (fill: string) => (
    <svg width="16" height="16" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="3" fill={fill} />
    </svg>
  );
  const items: [ReactNode, string][] = [
    [dot(colors.brand), t('graph.legend.active')],
    [dot(colors.danger), t('graph.legend.suspended')],
    [
      dot(colors.brand, { stroke: colors.likeText, strokeWidth: 2.5, strokeDasharray: '3 2' }),
      t('graph.legend.paused'),
    ],
    [dot(colors.chevron), t('graph.legend.deleted')],
    [square(colors.ink), t('graph.legend.waitlist')],
    [square(colors.appealText), t('graph.legend.admin')],
  ];
  return (
    <ul
      aria-label={t('graph.legend.title')}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 16px',
        fontSize: 12,
        color: colors.muted,
      }}
    >
      {items.map(([icon, text]) => (
        <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          {text}
        </li>
      ))}
      <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="24" height="10" aria-hidden>
          <line x1="1" y1="5" x2="23" y2="5" stroke={colors.dashed} strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        {t('graph.legend.link')}
      </li>
      <li>{t('graph.legend.size')}</li>
    </ul>
  );
}
