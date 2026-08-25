/**
 * 온톨로지 그래프 — 설계 · 매핑 · Query 가 공유하는 단일 캔버스.
 *
 * climax/frontend 의 OntologyGraph.jsx + QueryGraph.jsx 이식.
 * 두 화면이 **같은 레이아웃 엔진(graphSim.ts)** 을 쓰므로 그래프 모습이 같다.
 *
 * 한 좌표계에서 두 모드가 morph:
 *  · idle     — d3-force 배치. 육각형 클래스 + 속성 위성 원(궤도력) + 전체 관계 엣지.
 *  · traverse — 방문 클래스가 좌→우 컬럼으로 재배치되고 아래로 개체가 펼쳐진다.
 *               미방문 클래스·속성은 배경으로 페이드.
 *
 * 인터랙션: 노드 드래그(물리 reheat) · 배경/Space 팬 · ⌘휠 줌 · 전체화면(Esc) ·
 *          클릭 상세 · 겹쳐 놓으면 병합.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useOntology } from '@/lib/ontologyStore';
import { INSTANCES, instById, type Instance, type TravEdge } from '@/data/ontologyInstances';
import { buildSim, simViewBox, degreeMap, shade, dispLabel, CLASS_R, PROP_R, PROP_COLOR, type SimNode } from './graphSim';

const BRAND = '#CB2C10';
const DEEP = '#A82410';
/** 허브(연결 TOP 5) — 원본의 앰버 자리. */
const CORE = '#B8791F';
const HIER = '#7C8695';

const T_COL_W = 250;
const T_INST_Y0 = 120;
const T_INST_H = 84;
const T_CAP = 5;
const INST_W = 116;
const INST_H = 38;

type Pt = { x: number; y: number };

function hexPath(r: number) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }
  return d + 'Z';
}

/** 진행 방향에 수직으로 살짝 휜 곡선 (원본 edgeGeom). */
function edgeGeom(s: Pt, t: Pt, k = 0.08) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const cx = (s.x + t.x) / 2 - dy * k;
  const cy = (s.y + t.y) / 2 + dx * k;
  return { d: `M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`, mx: (s.x + t.x) / 4 + cx / 2, my: (s.y + t.y) / 4 + cy / 2 };
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

export interface OntologyGraphProps {
  activeClasses?: string[];
  activeRelations?: string[];
  allSteps?: string[][];
  litCount?: number;
  travEdges?: TravEdge[];
  anchorInst?: string | null;
  running?: boolean;
  showAttrs?: boolean;
  onSelectClass?: (n: string) => void;
  onSelectInstance?: (i: Instance) => void;
  onMergeAsk?: (src: string, dst: string) => void;
  selectedClass?: string | null;
  selectedInstance?: string | null;
  className?: string;
}

export default function OntologyGraph(props: OntologyGraphProps) {
  const [full, setFull] = useState(false);
  const body = <Canvas {...props} full={full} onToggleFull={() => setFull((v) => !v)} />;
  return full ? createPortal(<div className="fixed inset-0 z-[100] bg-white p-4">{body}</div>, document.body) : body;
}

function Canvas({
  activeClasses = [],
  activeRelations = [],
  allSteps = [],
  litCount = 0,
  travEdges = [],
  anchorInst = null,
  running = false,
  showAttrs = true,
  onSelectClass,
  onSelectInstance,
  onMergeAsk,
  selectedClass = null,
  selectedInstance = null,
  className,
  full,
  onToggleFull,
}: OntologyGraphProps & { full: boolean; onToggleFull: () => void }) {
  const { classes, relations } = useOntology();
  const reduce = useReducedMotion();
  const [, force] = useState(0);

  const relSet = useMemo(() => new Set(activeRelations), [activeRelations]);
  const litSet = useMemo(() => new Set(allSteps.slice(0, litCount).flat()), [allSteps, litCount]);
  /** 순회 morph 는 점등이 시작된 뒤에만 — 그 전엔 설계 그래프와 동일. */
  const traverse = litCount > 0;

  const deg = useMemo(() => degreeMap(classes, relations), [classes, relations]);
  const maxDeg = Math.max(1, ...Object.values(deg));
  const hubs = useMemo(() => [...Object.entries(deg)].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n), [deg]);

  /* ── d3-force (설계·Query 공유) ── */
  const built = useMemo(() => buildSim(classes, relations), [classes, relations]);
  useEffect(() => {
    built.sim.on('tick', () => force((t) => t + 1));
    return () => {
      built.sim.on('tick', null);
      built.sim.stop();
    };
  }, [built]);

  const simP = useCallback(
    (id: string): Pt | null => {
      const n = built.byId.get(id);
      return n ? { x: n.x ?? 0, y: n.y ?? 0 } : null;
    },
    [built],
  );

  /* ── 순회 컬럼 목표 ── */
  const trav = useMemo(() => {
    if (!traverse) return null;
    const cols = allSteps.filter((s) => s.length);
    const clsAt = new Map<string, Pt & { hop: number }>();
    const instAt = new Map<string, Pt>();
    const hidden = new Map<number, number>();
    let maxRows = 1;
    cols.forEach((ids, ci) => {
      const x = ci * T_COL_W;
      const rows: string[] = [...ids];
      for (const id of ids) {
        const own = instById(id);
        if (!own) continue;
        for (const o of INSTANCES) if (o.cls === own.cls && !rows.includes(o.id)) rows.push(o.id);
      }
      const shown = rows.slice(0, T_CAP);
      hidden.set(ci, Math.max(0, rows.length - shown.length));
      shown.forEach((id, i) => instAt.set(id, { x, y: T_INST_Y0 + i * T_INST_H }));
      maxRows = Math.max(maxRows, shown.length);
      const head = instById(ids[0]);
      if (head && !clsAt.has(head.cls)) clsAt.set(head.cls, { x, y: 0, hop: ci });
    });
    // viewBox 는 실제 노드 좌표에서 구한다 — 공식으로 잡으면 컬럼이 적을 때
    // 빈 여백만 크게 잡혀 그래프가 구석에 몰린다.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const bump = (p: Pt, halfW: number, halfH: number) => {
      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - halfH);
      maxY = Math.max(maxY, p.y + halfH);
    };
    clsAt.forEach((p) => bump(p, CLASS_R + 20, CLASS_R + 30));
    instAt.forEach((p) => bump(p, INST_W / 2 + 16, INST_H / 2 + 16));
    if (!Number.isFinite(minX)) {
      minX = 0; minY = 0; maxX = 600; maxY = 400;
    }
    const M = 70;
    return {
      clsAt,
      instAt,
      hidden,
      vb: { x: minX - M, y: minY - M - 26, w: maxX - minX + M * 2, h: maxY - minY + M * 2 + 40 },
    };
  }, [traverse, allSteps]);

  const CP = useCallback((n: string): Pt | null => (trav ? (trav.clsAt.get(n) ?? simP(n)) : simP(n)), [trav, simP]);
  const IP = useCallback((id: string): Pt | null => trav?.instAt.get(id) ?? null, [trav]);
  const visible = useCallback((n: string) => !trav || trav.clsAt.has(n), [trav]);

  /* ── 카메라 ── */
  const fit = useMemo(() => (trav ? trav.vb : simViewBox(built.sim.nodes() as SimNode[])), [trav, built, litCount]);
  const [view, setView] = useState(fit);
  const follow = useRef(true);
  const target = useRef(fit);
  target.current = fit;
  useEffect(() => {
    follow.current = true;
  }, [trav, built]);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      if (!follow.current) return;
      setView((v) => {
        const t = target.current;
        const k = reduce ? 1 : 0.13;
        const n = { x: v.x + (t.x - v.x) * k, y: v.y + (t.y - v.y) * k, w: v.w + (t.w - v.w) * k, h: v.h + (t.h - v.h) * k };
        if (Math.abs(n.w - t.w) < 0.6 && Math.abs(n.x - t.x) < 0.6) {
          follow.current = false;
          return t;
        }
        return n;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  /* ── 드래그 · 팬 · 줌 ── */
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const panFrom = useRef<{ p: Pt; v: Pt } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const moved = useRef(false);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(true);
        if (e.target === document.body) e.preventDefault();
      }
      if (e.code === 'Escape' && full) onToggleFull();
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, [full, onToggleFull]);

  const toSvg = useCallback(
    (e: { clientX: number; clientY: number }): Pt => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: view.x + ((e.clientX - r.left) / r.width) * view.w, y: view.y + ((e.clientY - r.top) / r.height) * view.h };
    },
    [view],
  );

  const startPan = (e: React.MouseEvent) => {
    follow.current = false;
    panFrom.current = { p: toSvg(e), v: { x: view.x, y: view.y } };
    setPanning(true);
  };

  const nodeDown = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (spaceDown || trav) {
      startPan(e);
      return;
    }
    follow.current = false;
    moved.current = false;
    dragId.current = id;
    const n = built.byId.get(id);
    if (n) {
      n.fx = n.x;
      n.fy = n.y;
      built.sim.alphaTarget(0.3).restart();
    }
  };

  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (panFrom.current) {
        const p = toSvg(e);
        setView((v) => ({
          ...v,
          x: panFrom.current!.v.x - (p.x - panFrom.current!.p.x),
          y: panFrom.current!.v.y - (p.y - panFrom.current!.p.y),
        }));
        return;
      }
      const id = dragId.current;
      if (!id) return;
      moved.current = true;
      const n = built.byId.get(id);
      if (n) {
        const p = toSvg(e);
        n.fx = p.x;
        n.fy = p.y;
      }
    };
    const up = (e: MouseEvent) => {
      panFrom.current = null;
      setPanning(false);
      const id = dragId.current;
      dragId.current = null;
      if (!id) return;
      built.sim.alphaTarget(0);
      if (moved.current && onMergeAsk && !built.byId.get(id)?.isProp) {
        const p = toSvg(e);
        for (const c of classes) {
          if (c.name === id) continue;
          const q = simP(c.name);
          if (q && Math.hypot(q.x - p.x, q.y - p.y) < CLASS_R + 12) {
            onMergeAsk(id, c.name);
            break;
          }
        }
      }
    };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
    };
  }, [toSvg, built, classes, simP, onMergeAsk]);

  const wheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    follow.current = false;
    const p = toSvg(e);
    const k = e.deltaY > 0 ? 1.15 : 0.87;
    setView((v) => ({ x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w: v.w * k, h: v.h * k }));
  };

  const spring = reduce ? { duration: 0 } : ({ type: 'spring', stiffness: 170, damping: 26 } as const);
  const pop = (i: number) => ({
    initial: reduce ? false : { scale: 0 },
    animate: { scale: 1 },
    transition: reduce ? { duration: 0 } : ({ type: 'spring', stiffness: 320, damping: 24, delay: Math.min(i * 0.018, 0.45) } as const),
  });

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        {[
          { t: '＋', f: () => { follow.current = false; setView((v) => ({ ...v, w: v.w * 0.8, h: v.h * 0.8 })); }, l: '확대' },
          { t: '－', f: () => { follow.current = false; setView((v) => ({ ...v, w: v.w * 1.25, h: v.h * 1.25 })); }, l: '축소' },
          { t: '⛶', f: () => { follow.current = true; }, l: '화면 맞춤' },
          { t: full ? '✕' : '⤢', f: onToggleFull, l: full ? '닫기 (Esc)' : '전체화면' },
        ].map((b) => (
          <button key={b.l} type="button" title={b.l} onClick={b.f}
            className="w-7 h-7 bg-white/90 border border-line rounded text-[12px] font-bold text-ink-dark hover:border-brand hover:text-brand shadow-sm">
            {b.t}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
        className="w-full h-full select-none"
        style={{ cursor: panning ? 'grabbing' : spaceDown ? 'grab' : 'default' }}
        onMouseDown={startPan}
        onWheel={wheel}
      >
        <defs>
          <marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={BRAND} />
          </marker>
          <marker id="ard" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#C2C7CD" />
          </marker>
        </defs>

        {trav &&
          [...trav.clsAt.entries()].map(([name, p]) => (
            <g key={`bg-${name}`}>
              <rect x={p.x - T_COL_W / 2 + 12} y={trav.vb.y + 14} width={T_COL_W - 24} height={trav.vb.h - 34} rx={8} fill={BRAND} fillOpacity={0.035} stroke={BRAND} strokeOpacity={0.12} />
              <text x={p.x} y={trav.vb.y + 40} textAnchor="middle" fontSize={10} fontWeight={800} fill={BRAND}>hop {p.hop}</text>
            </g>
          ))}

        {/* 관계 엣지 — 실행 전에도 전부 연결 */}
        {relations.map((r, i) => {
          const a = CP(r.domain);
          const b = CP(r.range);
          if (!a || !b) return null;
          const shown = visible(r.domain) && visible(r.range);
          const on = relSet.has(r.uri);
          const g = edgeGeom(a, b, i % 2 ? 0.09 : -0.09);
          const op = on ? 1 : trav ? (shown ? 0.18 : 0.04) : 0.55;
          return (
            <g key={r.uri} style={{ pointerEvents: 'none' }}>
              {on && <path d={g.d} fill="none" stroke={BRAND} strokeOpacity={0.15} strokeWidth={8} strokeLinecap="round" />}
              <path d={g.d} fill="none" stroke={on ? BRAND : '#C2C7CD'} strokeWidth={on ? 2.2 : 1.1} opacity={op} markerEnd={on ? 'url(#ar)' : 'url(#ard)'} />
              {on && !reduce && [0, 1].map((k) => (
                <circle key={k} r={3} fill={BRAND} style={{ filter: `drop-shadow(0 0 5px ${BRAND}) drop-shadow(0 0 10px ${BRAND})` }}>
                  <animateMotion dur="1.9s" begin={`${k * 0.95 + (i % 5) * 0.28}s`} repeatCount="indefinite" path={g.d} />
                </circle>
              ))}
              {(on || !trav) && (
                <text x={g.mx} y={g.my - 5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={on ? DEEP : '#98A0A8'} opacity={op}
                  style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' }}>
                  {r.name}
                </text>
              )}
            </g>
          );
        })}

        {/* 속성 위성 — 원 + 아래 작은 텍스트 */}
        {showAttrs &&
          (built.sim.nodes() as SimNode[]).filter((n) => n.isProp).map((n, i) => {
            const hp = CP(n.host!);
            if (!hp) return null;
            const shown = visible(n.host!);
            const op = trav ? (shown ? 0.14 : 0.03) : 1;
            const p = trav ? hp : { x: n.x ?? 0, y: n.y ?? 0 };
            return (
              <motion.g key={n.id} animate={{ x: p.x, y: p.y, opacity: op }} transition={spring} style={{ pointerEvents: 'none' }}>
                {!trav && <line x1={hp.x - p.x} y1={hp.y - p.y} x2={0} y2={0} stroke="#D9DDE2" strokeWidth={1} />}
                <motion.g {...pop(i + classes.length)}>
                  <circle r={PROP_R} fill={PROP_COLOR + '22'} stroke={PROP_COLOR} strokeWidth={1.4} />
                  <text y={PROP_R + 10} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#7A828B">{dispLabel(n.label)}</text>
                </motion.g>
              </motion.g>
            );
          })}

        {/* 클래스 → 개체 펼침선 */}
        {trav &&
          [...trav.instAt.keys()].map((id) => {
            const inst = instById(id)!;
            const cp = CP(inst.cls);
            const p = IP(id);
            if (!cp || !p) return null;
            const on = litSet.has(id);
            return <line key={`ci-${id}`} x1={cp.x} y1={cp.y + CLASS_R} x2={p.x} y2={p.y - INST_H / 2}
              stroke={on ? BRAND : '#D3D7DC'} strokeWidth={on ? 1.5 : 0.9} strokeDasharray={on ? undefined : '4 4'} opacity={on ? 0.6 : 0.4} />;
          })}

        {/* 개체 간 순회 엣지 */}
        {trav &&
          travEdges.map((e, i) => {
            const a = IP(e.from);
            const b = IP(e.to);
            if (!a || !b || !litSet.has(e.from) || !litSet.has(e.to)) return null;
            const same = Math.abs(a.x - b.x) < 4;
            const g = edgeGeom(a, b, same ? 0.4 : i % 2 ? 0.1 : -0.1);
            return (
              <g key={`te${i}`} style={{ pointerEvents: 'none' }}>
                <path d={g.d} fill="none" stroke={BRAND} strokeOpacity={0.13} strokeWidth={7} strokeLinecap="round" />
                <motion.path d={g.d} fill="none" stroke={BRAND} strokeWidth={2} markerEnd="url(#ar)"
                  initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.5, ease: 'easeOut' }} />
                {!reduce && (
                  <circle r={2.8} fill={BRAND} style={{ filter: `drop-shadow(0 0 5px ${BRAND}) drop-shadow(0 0 9px ${BRAND})` }}>
                    <animateMotion dur={`${1.7 + (i % 4) * 0.3}s`} begin={`${-(i % 5) * 0.33}s`} repeatCount="indefinite" path={g.d} />
                  </circle>
                )}
                <text x={g.mx} y={g.my - 5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={DEEP}
                  style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' }}>{e.rel}</text>
              </g>
            );
          })}

        {/* 클래스 노드 */}
        {classes.map((c, i) => {
          const p = CP(c.name);
          if (!p) return null;
          const shown = visible(c.name);
          const on = activeClasses.includes(c.name);
          const hub = hubs.includes(c.name);
          const t = Math.sqrt((deg[c.name] ?? 0) / maxDeg);
          const base = on ? BRAND : hub ? CORE : HIER;
          const sel = selectedClass === c.name;
          return (
            <motion.g key={c.uri}
              animate={{ x: p.x, y: p.y, opacity: trav ? (shown ? 1 : 0.05) : 1, scale: trav && !shown ? 0.75 : 1 }}
              transition={dragId.current === c.name ? { duration: 0 } : spring}
              onMouseDown={nodeDown(c.name)}
              onClick={() => !moved.current && onSelectClass?.(c.name)}
              style={{ cursor: trav ? 'default' : 'grab' }}>
              <title>{`${c.name} · 관계 ${deg[c.name] ?? 0}개 · 속성 ${c.attrs.length}개`}</title>
              <motion.g {...pop(i)}>
                {(hub || on) && !reduce && (
                  <motion.path d={hexPath(CLASS_R + 8)} fill="none" stroke={base} strokeWidth={1 + t * 1.4}
                    animate={{ opacity: [0.12, 0.4, 0.12], scale: [1, 1.07, 1] }}
                    transition={{ duration: 3.4, repeat: Infinity, delay: (i % 7) * 0.4 }} />
                )}
                {sel && <path d={hexPath(CLASS_R + 5)} fill="none" stroke={BRAND} strokeWidth={1.4} strokeDasharray="3 3" />}
                <path d={hexPath(CLASS_R)} fill={shade(base, t)} stroke={base} strokeWidth={1.2 + t * 1.6}
                  style={{ filter: `drop-shadow(0 0 ${4 + Math.round(t * 12)}px ${base}66)` }} />
                <path d={hexPath(CLASS_R * 0.46)} fill={base} fillOpacity={0.5 + t * 0.4} style={{ pointerEvents: 'none' }} />
                <text y={CLASS_R + 15} textAnchor="middle" fontSize={11} fontWeight={800} fill="#212121" style={{ pointerEvents: 'none' }}>
                  {dispLabel(c.name)}
                </text>
              </motion.g>
            </motion.g>
          );
        })}

        {/* 개체 노드 */}
        {trav &&
          [...trav.instAt.keys()].map((id) => {
            const p = IP(id)!;
            const inst = instById(id);
            if (!inst) return null;
            const on = litSet.has(id);
            const anchor = anchorInst === id && on;
            const sel = selectedInstance === id;
            return (
              <motion.g key={id} animate={{ x: p.x, y: p.y, opacity: on ? 1 : 0.42 }} transition={spring}
                onClick={(e) => { e.stopPropagation(); onSelectInstance?.(inst); }} style={{ cursor: 'pointer' }}>
                <title>{`${inst.label} · ${inst.origin}`}</title>
                {anchor && !reduce && (
                  <motion.rect x={-INST_W / 2 - 5} y={-INST_H / 2 - 5} width={INST_W + 10} height={INST_H + 10} rx={7} fill="none" stroke={BRAND} strokeWidth={1.6}
                    animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.14, 1] }} transition={{ duration: 1.7, repeat: Infinity }} />
                )}
                {sel && <rect x={-INST_W / 2 - 4} y={-INST_H / 2 - 4} width={INST_W + 8} height={INST_H + 8} rx={6} fill="none" stroke={BRAND} strokeWidth={1.3} strokeDasharray="3 3" />}
                <rect x={-INST_W / 2} y={-INST_H / 2} width={INST_W} height={INST_H} rx={6} fill={on ? '#fff' : '#FAFBFC'}
                  stroke={on ? BRAND : '#CDD2D8'} strokeWidth={on ? 1.8 : 1} strokeDasharray={on ? undefined : '4 3'}
                  style={on ? { filter: `drop-shadow(0 1px 5px ${BRAND}33)` } : undefined} />
                {on && <rect x={-INST_W / 2} y={-INST_H / 2} width={4} height={INST_H} rx={2} fill={BRAND} />}
                <text y={-2} textAnchor="middle" fontSize={10} fontWeight={800} fill={on ? '#212121' : '#9AA1A9'} style={{ pointerEvents: 'none' }}>
                  {inst.label.length > 14 ? inst.label.slice(0, 13) + '…' : inst.label}
                </text>
                <text y={10} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={on ? DEEP : '#B9BFC6'} style={{ pointerEvents: 'none' }}>
                  {inst.cls}
                  <tspan fill="#B9BFC6" fontWeight={600}>{on ? ' · 확정' : ' · 후보'}</tspan>
                </text>
              </motion.g>
            );
          })}

        {trav &&
          [...trav.clsAt.entries()].map(([name, p]) => {
            const n = trav.hidden.get(p.hop) ?? 0;
            return n ? (
              <text key={`h-${name}`} x={p.x} y={trav.vb.y + trav.vb.h - 24} textAnchor="middle" fontSize={10} fontWeight={700} fill="#B9BFC6">+{n}개</text>
            ) : null;
          })}
      </svg>

      <div className="absolute left-2 bottom-2 flex items-center gap-2.5 text-[9.5px] text-ink-mid font-semibold bg-white/85 border border-line-soft rounded px-2 py-1">
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="-8.5 -8.5 17 17"><path d={hexPath(7)} fill={shade(HIER, 0.4)} stroke={HIER} strokeWidth="1.6" /></svg>클래스
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="-8.5 -8.5 17 17"><path d={hexPath(7)} fill={shade(CORE, 0.6)} stroke={CORE} strokeWidth="1.6" /></svg>허브 TOP5
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="w-[9px] h-[9px] rounded-full" style={{ background: PROP_COLOR + '22', border: `1.5px solid ${PROP_COLOR}` }} />속성
        </span>
        <span className="text-ink-light">드래그=이동 · Space+드래그=화면 · ⌘휠=줌</span>
        {running && <span className="text-brand font-extrabold">순회 중…</span>}
      </div>
    </div>
  );
}
