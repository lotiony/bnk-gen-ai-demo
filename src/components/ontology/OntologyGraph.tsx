/**
 * 온톨로지 그래프 — SVG + framer-motion.
 *
 * climax/frontend 의 QueryGraph.jsx 구조를 옮겼다. 2026-08-25 에 오프라인
 * 완결형 제약이 해제되어 원본과 같은 라이브러리(framer-motion)를 쓴다.
 *
 * 핵심 동작 — **질의 실행 전에도 최종 레이아웃이 그대로 서 있다.**
 * 컬럼·개체·후보가 미리 배치된 상태에서 시작하고, 실행하면 그 위로
 * 경로가 점등된다. 레이아웃이 튀지 않아 "무엇을 고를지 지켜보는" 화면이 된다.
 *
 * 인터랙션: 노드 드래그 · 배경 팬 · ⌘/Ctrl+휠 줌 · 화면 맞춤 · 전체화면 · 클릭 상세.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useOntology, mergeClasses } from '@/lib/ontologyStore';
import { INSTANCES, instById, type Instance, type TravEdge } from '@/data/ontologyInstances';

/* 배치 */
const COL_W = 168;
const ROW_H = 96;
const PAD_X = 88;
const PAD_Y = 62;

const T_COL_W = 252;
const T_CLS_Y = 86;
const T_INST_Y0 = 196;
const T_INST_H = 86;
const T_CAP = 5;
const INST_W = 116;
const INST_H = 38;

const BRAND = '#CB2C10';
const DEEP = '#A82410';
const GREY = '#9AA1A9';

type Pt = { x: number; y: number };

function hexPath(r: number) {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
}

function edgeGeom(p1: Pt, p2: Pt, bow: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const L = Math.hypot(dx, dy) || 1;
  const mx = (p1.x + p2.x) / 2 + (-dy / L) * L * bow;
  const my = (p1.y + p2.y) / 2 + (dx / L) * L * bow;
  return { d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`, mx, my };
}

function clipped(a: Pt, b: Pt, ra: number, rb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  return [
    { x: a.x + (dx / L) * ra, y: a.y + (dy / L) * ra },
    { x: b.x - (dx / L) * rb, y: b.y - (dy / L) * rb },
  ] as const;
}

/** prefers-reduced-motion 이면 애니메이션을 끈다. */
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
  /** 시나리오 전체 스텝 — 실행 전에도 이 레이아웃으로 미리 선다. */
  allSteps?: string[][];
  /** 지금까지 점등된 스텝 수. */
  litCount?: number;
  travEdges?: TravEdge[];
  anchorInst?: string | null;
  running?: boolean;
  showAttrs?: boolean;
  onSelectClass?: (n: string) => void;
  onSelectInstance?: (i: Instance) => void;
  /** 클래스 노드를 다른 노드에 겹쳐 놓았을 때. */
  onMergeAsk?: (src: string, dst: string) => void;
  selectedClass?: string | null;
  selectedInstance?: string | null;
  className?: string;
}

export default function OntologyGraph(props: OntologyGraphProps) {
  const [full, setFull] = useState(false);
  const body = <Canvas {...props} full={full} onToggleFull={() => setFull((v) => !v)} />;
  return full
    ? createPortal(<div className="fixed inset-0 z-[100] bg-white p-4">{body}</div>, document.body)
    : body;
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
  const { classes: CLASSES, relations: RELATIONS } = useOntology();
  const reduce = useReducedMotion();
  const degreeOf = useCallback(
    (n: string) => RELATIONS.filter((r) => r.domain === n || r.range === n).length,
    [RELATIONS],
  );
  const classR = useCallback((n: string) => 21 + Math.min(degreeOf(n), 6) * 1.4, [degreeOf]);
  const HUB_CLASSES = useMemo(() => {
    const d = new Map<string, number>();
    for (const r of RELATIONS) {
      d.set(r.domain, (d.get(r.domain) ?? 0) + 1);
      d.set(r.range, (d.get(r.range) ?? 0) + 1);
    }
    return [...d.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  }, [RELATIONS]);
  const relSet = useMemo(() => new Set(activeRelations), [activeRelations]);
  const clsSet = useMemo(() => new Set(activeClasses), [activeClasses]);
  /** 점등된 개체 — litCount 스텝까지. */
  const litSet = useMemo(() => new Set(allSteps.slice(0, litCount).flat()), [allSteps, litCount]);
  /** 시나리오가 있으면 항상 컬럼 모드 (실행 전에도). */
  const colMode = allSteps.some((s) => s.length);

  /* ── 레이아웃 ── */
  const layout = useMemo(() => {
    const cls = new Map<string, Pt & { hop: number | null }>();
    const inst = new Map<string, Pt>();
    const hidden = new Map<number, number>();

    if (!colMode) {
      CLASSES.forEach((c) => cls.set(c.name, { x: PAD_X + c.col * COL_W, y: PAD_Y + c.row * ROW_H, hop: null }));
      const mc = Math.max(...CLASSES.map((c) => c.col));
      const mr = Math.max(...CLASSES.map((c) => c.row));
      return { cls, inst, hidden, vb: { x: 0, y: 0, w: PAD_X * 2 + mc * COL_W, h: PAD_Y * 2 + mr * ROW_H } };
    }

    const cols = allSteps.filter((s) => s.length);
    let maxRows = 1;
    cols.forEach((ids, ci) => {
      const x = PAD_X + ci * T_COL_W;
      const rows: string[] = [...ids];
      // 같은 클래스의 다른 개체 = 미선택 후보
      for (const id of ids) {
        const own = instById(id);
        if (!own) continue;
        for (const o of INSTANCES) {
          if (o.cls === own.cls && !ids.includes(o.id) && !rows.includes(o.id)) rows.push(o.id);
        }
      }
      const shown = rows.slice(0, T_CAP);
      hidden.set(ci, Math.max(0, rows.length - shown.length));
      shown.forEach((id, i) => inst.set(id, { x, y: T_INST_Y0 + i * T_INST_H }));
      maxRows = Math.max(maxRows, shown.length);
      const head = instById(ids[0]);
      if (head && !cls.has(head.cls)) cls.set(head.cls, { x, y: T_CLS_Y, hop: ci });
    });
    return {
      cls,
      inst,
      hidden,
      vb: {
        x: 0,
        y: 0,
        w: Math.max(PAD_X * 2 + Math.max(cols.length - 1, 0) * T_COL_W, 600),
        h: Math.max(T_INST_Y0 + (maxRows - 1) * T_INST_H + 108, 420),
      },
    };
  }, [colMode, allSteps, CLASSES]);

  /* ── 카메라 ── */
  const [view, setView] = useState(layout.vb);
  const follow = useRef(true);
  const target = useRef(layout.vb);
  target.current = layout.vb;
  useEffect(() => {
    follow.current = true;
  }, [layout.vb.w, layout.vb.h]);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      if (!follow.current) return;
      setView((v) => {
        const t = target.current;
        const k = 0.14;
        const n = { x: v.x + (t.x - v.x) * k, y: v.y + (t.y - v.y) * k, w: v.w + (t.w - v.w) * k, h: v.h + (t.h - v.h) * k };
        if (Math.abs(n.w - t.w) < 0.5 && Math.abs(n.x - t.x) < 0.5 && Math.abs(n.y - t.y) < 0.5) {
          follow.current = false;
          return t;
        }
        return n;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── 드래그 / 팬 / 줌 ── */
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [offset, setOffset] = useState<Record<string, Pt>>({});
  const drag = useRef<{ id: string | null; s: Pt; o: Pt } | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(true);
        if (e.target === document.body) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toSvg = useCallback(
    (e: { clientX: number; clientY: number }): Pt => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: view.x + ((e.clientX - r.left) / r.width) * view.w, y: view.y + ((e.clientY - r.top) / r.height) * view.h };
    },
    [view],
  );

  const down = (id: string | null) => (e: React.MouseEvent) => {
    e.stopPropagation();
    follow.current = false;
    const pan = !id || spaceDown; // 스페이스 누르면 노드 위에서도 화면이 끌린다(원본 동작)
    drag.current = { id: pan ? null : id, s: toSvg(e), o: pan ? { x: view.x, y: view.y } : (offset[id!] ?? { x: 0, y: 0 }) };
    if (pan) setPanning(true);
  };
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = toSvg(e);
      if (!d.id) setView((v) => ({ ...v, x: d.o.x - (p.x - d.s.x), y: d.o.y - (p.y - d.s.y) }));
      else setOffset((o) => ({ ...o, [d.id!]: { x: d.o.x + (p.x - d.s.x), y: d.o.y + (p.y - d.s.y) } }));
    };
    const up = (e: MouseEvent) => {
      const d = drag.current;
      drag.current = null;
      setPanning(false);
      // 클래스 노드를 다른 클래스 노드 위에 놓으면 병합 (원본 동작)
      if (d?.id?.startsWith('c:') && onMergeAsk) {
        const srcName = d.id.slice(2);
        const p = toSvg(e);
        for (const c of CLASSES) {
          if (c.name === srcName) continue;
          const b = layout.cls.get(c.name);
          if (!b) continue;
          const o = offset['c:' + c.name];
          const q = o ? { x: b.x + o.x, y: b.y + o.y } : b;
          if (Math.hypot(q.x - p.x, q.y - p.y) < classR(c.name) + 10) {
            onMergeAsk(srcName, c.name);
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
  }, [toSvg, CLASSES, layout, offset, classR, onMergeAsk]);

  const wheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    follow.current = false;
    const p = toSvg(e);
    const k = e.deltaY > 0 ? 1.12 : 0.89;
    setView((v) => ({ x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w: v.w * k, h: v.h * k }));
  };

  const CP = (n: string): Pt | null => {
    const b = layout.cls.get(n);
    if (!b) return null;
    const o = offset['c:' + n];
    return o ? { x: b.x + o.x, y: b.y + o.y } : b;
  };
  const IP = (id: string): Pt | null => {
    const b = layout.inst.get(id);
    if (!b) return null;
    const o = offset['i:' + id];
    return o ? { x: b.x + o.x, y: b.y + o.y } : b;
  };

  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 180, damping: 24 };

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        {[
          { t: '＋', f: () => { follow.current = false; setView((v) => ({ ...v, w: v.w * 0.85, h: v.h * 0.85 })); }, l: '확대' },
          { t: '－', f: () => { follow.current = false; setView((v) => ({ ...v, w: v.w * 1.18, h: v.h * 1.18 })); }, l: '축소' },
          { t: '⛶', f: () => { setOffset({}); follow.current = true; }, l: '화면 맞춤' },
          { t: full ? '✕' : '⤢', f: onToggleFull, l: full ? '닫기' : '전체화면' },
        ].map((b) => (
          <button
            key={b.l}
            type="button"
            title={b.l}
            onClick={b.f}
            className="w-7 h-7 bg-white/90 border border-line rounded text-[12px] font-bold text-ink-dark hover:border-brand hover:text-brand shadow-sm"
          >
            {b.t}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
        className="w-full h-full select-none"
        style={{ cursor: panning ? 'grabbing' : spaceDown ? 'grab' : 'default' }}
        onMouseDown={down(null)}
        onWheel={wheel}
      >
        <defs>
          <marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={BRAND} />
          </marker>
          <linearGradient id="hexOn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E4552F" />
            <stop offset="100%" stopColor={DEEP} />
          </linearGradient>
          <linearGradient id="hexIdle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F4F5F6" />
          </linearGradient>
          <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={BRAND} floodOpacity="0.28" />
          </filter>
        </defs>

        {/* ══ 컬럼 배경 ══ */}
        {colMode &&
          [...layout.cls.entries()].map(([name, p]) => {
            const active = clsSet.has(name);
            return (
              <g key={`bg-${name}`}>
                <motion.rect
                  x={p.x - T_COL_W / 2 + 14}
                  y={T_CLS_Y - 52}
                  width={T_COL_W - 28}
                  height={layout.vb.h - T_CLS_Y + 24}
                  rx={8}
                  fill={BRAND}
                  animate={{ fillOpacity: active ? 0.045 : 0.015 }}
                  stroke={BRAND}
                  strokeOpacity={active ? 0.16 : 0.07}
                />
                <text x={p.x} y={T_CLS_Y - 60} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={active ? BRAND : '#B9BFC6'}>
                  hop {p.hop}
                </text>
              </g>
            );
          })}

        {/* ══ idle: 클래스 관계 ══ */}
        {!colMode &&
          RELATIONS.map((r, i) => {
            const a = CP(r.domain);
            const b = CP(r.range);
            if (!a || !b) return null;
            const on = relSet.has(r.uri);
            const [p1, p2] = clipped(a, b, classR(r.domain), classR(r.range) + 7);
            const g = edgeGeom(p1, p2, i % 2 ? 0.15 : -0.15);
            return (
              <g key={r.uri}>
                <path d={g.d} fill="none" stroke={on ? BRAND : GREY} strokeWidth={on ? 2.2 : 1} opacity={on ? 1 : clsSet.size ? 0.16 : 0.42} markerEnd={on ? 'url(#ar)' : undefined} />
              </g>
            );
          })}

        {/* ══ 클래스 → 개체 연결선 ══ */}
        {colMode &&
          [...layout.inst.keys()].map((id) => {
            const inst = instById(id)!;
            const cp = CP(inst.cls);
            const p = IP(id);
            if (!cp || !p) return null;
            const on = litSet.has(id);
            return (
              <motion.line
                key={`ci-${id}`}
                x1={cp.x}
                y1={cp.y + classR(inst.cls)}
                x2={p.x}
                y2={p.y - INST_H / 2}
                stroke={on ? BRAND : '#D3D7DC'}
                strokeWidth={on ? 1.5 : 0.9}
                strokeDasharray={on ? undefined : '4 4'}
                animate={{ opacity: on ? 0.6 : 0.42 }}
              />
            );
          })}

        {/* ══ 개체 간 순회 엣지 ══ */}
        {colMode &&
          travEdges.map((e, i) => {
            const a = IP(e.from);
            const b = IP(e.to);
            if (!a || !b) return null;
            const on = litSet.has(e.from) && litSet.has(e.to);
            if (!on) return null;
            const same = Math.abs(a.x - b.x) < 4;
            const [p1, p2] = clipped(a, b, same ? INST_H / 2 : INST_W / 2, same ? INST_H / 2 + 5 : INST_W / 2 + 9);
            const g = edgeGeom(p1, p2, same ? 0.44 : i % 2 ? 0.11 : -0.11);
            return (
              <g key={`te${i}`}>
                <path d={g.d} fill="none" stroke={BRAND} strokeOpacity={0.13} strokeWidth={7} strokeLinecap="round" />
                <motion.path
                  d={g.d}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth={2}
                  markerEnd="url(#ar)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
                <circle r={3} fill={BRAND} style={{ filter: `drop-shadow(0 0 5px ${BRAND}) drop-shadow(0 0 10px ${BRAND})` }}>
                  <animateMotion dur={`${1.7 + (i % 4) * 0.3}s`} begin={`${-(i % 5) * 0.33}s`} repeatCount="indefinite" path={g.d} />
                </circle>
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <rect x={g.mx - (e.rel.length * 6 + 13) / 2} y={g.my - 9} width={e.rel.length * 6 + 13} height={18} rx={9} fill="#fff" stroke={BRAND} strokeOpacity={0.55} />
                  <text x={g.mx} y={g.my + 3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={DEEP}>
                    {e.rel}
                  </text>
                </motion.g>
              </g>
            );
          })}

        {/* ══ 속성 위성 (idle) ══ */}
        {showAttrs && !colMode &&
          CLASSES.map((c) => {
            const p = CP(c.name);
            if (!p) return null;
            return c.attrs.slice(0, 6).map((a, i) => {
              const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
              const rr = classR(c.name) + 21;
              return (
                <g key={`${c.uri}-${a}`} opacity={clsSet.size && !clsSet.has(c.name) ? 0.1 : 0.8}>
                  <line x1={p.x} y1={p.y} x2={p.x + rr * Math.cos(ang)} y2={p.y + rr * Math.sin(ang)} stroke="#D9DDE2" strokeWidth={0.8} />
                  <circle cx={p.x + rr * Math.cos(ang)} cy={p.y + rr * Math.sin(ang)} r={3.5} fill="#fff" stroke="#B9BFC6" strokeWidth={0.9} />
                </g>
              );
            });
          })}

        {/* ══ 클래스 노드 ══ */}
        {CLASSES.map((c, i) => {
          const p = CP(c.name);
          if (!p) return null;
          if (colMode && !layout.cls.has(c.name)) return null;
          const hub = HUB_CLASSES.includes(c.name);
          const on = clsSet.has(c.name);
          const r = classR(c.name);
          const sel = selectedClass === c.name;
          return (
            <motion.g
              key={c.uri}
              animate={{ x: p.x, y: p.y, opacity: colMode ? 1 : clsSet.size && !on ? 0.16 : 1 }}
              transition={drag.current ? { duration: 0 } : spring}
              onMouseDown={down('c:' + c.name)}
              onClick={() => onSelectClass?.(c.name)}
              style={{ cursor: 'grab' }}
            >
              <title>{`${c.name} · 관계 ${degreeOf(c.name)}개`}</title>
              {(hub || on) && (
                <motion.path
                  d={hexPath(r + 9)}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth={1.3}
                  animate={{ opacity: [0.14, 0.4, 0.14], scale: [1, 1.06, 1] }}
                  transition={{ duration: 3.4, repeat: Infinity, delay: (i % 7) * 0.4 }}
                />
              )}
              {sel && <path d={hexPath(r + 6)} fill="none" stroke={BRAND} strokeWidth={1.4} strokeDasharray="3 3" />}
              <motion.path
                d={hexPath(r)}
                animate={{ opacity: 1 }}
                fill={on ? 'url(#hexOn)' : 'url(#hexIdle)'}
                stroke={on || colMode ? BRAND : hub ? BRAND : GREY}
                strokeWidth={on || hub ? 2 : 1.2}
                style={on ? { filter: 'url(#soft)' } : undefined}
              />
              <path d={hexPath(r * 0.44)} fill={on ? '#fff' : BRAND} fillOpacity={on ? 0.34 : 0.22} />
              <text y={3.6} textAnchor="middle" fontSize={11} fontWeight={800} fill={on ? '#fff' : '#212121'} style={{ pointerEvents: 'none' }}>
                {c.name}
              </text>
              {!colMode && (
                <text y={r + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#666" style={{ pointerEvents: 'none' }}>
                  {c.attrs.length}속성
                </text>
              )}
            </motion.g>
          );
        })}

        {/* ══ 개체 노드 ══ */}
        {colMode &&
          [...layout.inst.keys()].map((id) => {
            const p = IP(id);
            const inst = instById(id);
            if (!p || !inst) return null;
            const on = litSet.has(id);
            const anchor = anchorInst === id && on;
            const sel = selectedInstance === id;
            return (
              <motion.g
                key={id}
                animate={{ x: p.x, y: p.y, opacity: on ? 1 : 0.4 }}
                transition={drag.current ? { duration: 0 } : spring}
                onMouseDown={down('i:' + id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectInstance?.(inst);
                }}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${inst.label} · ${inst.origin}`}</title>
                {anchor && (
                  <motion.rect
                    x={-INST_W / 2 - 5}
                    y={-INST_H / 2 - 5}
                    width={INST_W + 10}
                    height={INST_H + 10}
                    rx={7}
                    fill="none"
                    stroke={BRAND}
                    strokeWidth={1.6}
                    animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.14, 1] }}
                    transition={{ duration: 1.7, repeat: Infinity }}
                  />
                )}
                {sel && <rect x={-INST_W / 2 - 4} y={-INST_H / 2 - 4} width={INST_W + 8} height={INST_H + 8} rx={6} fill="none" stroke={BRAND} strokeWidth={1.3} strokeDasharray="3 3" />}
                <motion.rect
                  x={-INST_W / 2}
                  y={-INST_H / 2}
                  width={INST_W}
                  height={INST_H}
                  rx={6}
                  animate={{ fill: on ? '#FFFFFF' : '#FAFBFC' }}
                  stroke={on ? BRAND : '#CDD2D8'}
                  strokeWidth={on ? 1.8 : 1}
                  strokeDasharray={on ? undefined : '4 3'}
                  style={on ? { filter: 'url(#soft)' } : undefined}
                />
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

        {/* ══ 컬럼별 생략 개수 ══ */}
        {colMode &&
          [...layout.cls.entries()].map(([name, p]) => {
            const n = layout.hidden.get(p.hop ?? -1) ?? 0;
            if (!n) return null;
            return (
              <text key={`h-${name}`} x={p.x} y={layout.vb.h - 32} textAnchor="middle" fontSize={10} fontWeight={700} fill="#B9BFC6">
                +{n}개
              </text>
            );
          })}
      </svg>

      <div className="absolute left-2 bottom-2 text-[9.5px] text-ink-mid font-semibold bg-white/85 border border-line-soft rounded px-2 py-1">
        {colMode ? <>컬럼=hop · 카드=개체 · 실선=확정 · 점선=미선택 후보 · 드래그·⌘휠 줌</> : <>육각형=클래스 · 원=속성 · 드래그·⌘휠 줌</>}
        {running && <span className="ml-1.5 text-brand font-extrabold">순회 중…</span>}
      </div>
    </div>
  );
}
