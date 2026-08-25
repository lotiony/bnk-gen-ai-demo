/**
 * 온톨로지 그래프 — 인라인 SVG + CSS/SMIL.
 *
 * climax/frontend 의 QueryGraph.jsx 구조를 옮겼다. 원본이 쓰는
 * framer-motion · d3-force · sigma · graphology 는 가져오지 않는다 —
 * 오프라인 단일 HTML 제약(CLAUDE.md) 아래 물리 시뮬레이션은 이득이 없고,
 * 좌표를 결정론적으로 두면 리허설과 본 시연이 같은 그림을 낸다.
 *
 * 두 모드
 *  · idle      — 클래스(T-Box) 계층 배치 + 속성 위성
 *  · traversal — **컬럼 = 클래스**, 그 아래 실제 개체(A-Box)가 펼쳐지고
 *                선택되지 않은 같은 클래스 개체는 점선 후보로 남는다.
 *                이게 "이 고객의 이 약정, 이 담보를 타고 갔다"를 보여준다.
 *
 * 인터랙션: 노드 드래그 · 배경 팬 · 휠 줌 · 전체화면 · 클릭 상세.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CLASSES, RELATIONS, HUB_CLASSES, degreeOf } from '@/data/ontology';
import { INSTANCES, instById, type Instance } from '@/data/ontologyInstances';
import type { TravEdge } from '@/data/ontologyInstances';

/* 배치 상수 */
const COL_W = 168;
const ROW_H = 96;
const PAD_X = 88;
const PAD_Y = 62;

const T_COL_W = 268;
const T_CLS_Y = 74;
const T_INST_Y0 = 178;
const T_INST_H = 92;
const T_CAP = 5; // 컬럼당 표시 개체 상한

const BRAND = '#CB2C10';
const BRAND_DEEP = '#A82410';
const HUB = '#CB2C10';
const GREY = '#9AA1A9';

function hexPath(r: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
}

type Pt = { x: number; y: number };

function edgeGeom(p1: Pt, p2: Pt, bow: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (p1.x + p2.x) / 2 + (-dy / len) * len * bow;
  const my = (p1.y + p2.y) / 2 + (dx / len) * len * bow;
  return { d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`, mx, my };
}

/** 선분을 노드 반지름만큼 잘라 화살표가 도형에 닿게. */
function clipped(a: Pt, b: Pt, ra: number, rb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  return [
    { x: a.x + (dx / L) * ra, y: a.y + (dy / L) * ra },
    { x: b.x - (dx / L) * rb, y: b.y - (dy / L) * rb },
  ] as const;
}

const classR = (n: string) => 20 + Math.min(degreeOf(n), 6) * 1.4;

export interface OntologyGraphProps {
  activeClasses?: string[];
  activeRelations?: string[];
  /** 스텝별 점등 개체 — 바깥 배열 index 가 hop 컬럼이 된다. */
  instanceSteps?: string[][];
  /** 개체 간 순회 경로. */
  travEdges?: TravEdge[];
  anchorInst?: string | null;
  running?: boolean;
  showAttrs?: boolean;
  /** 미선택 후보를 함께 그릴지. */
  showCandidates?: boolean;
  onSelectClass?: (name: string) => void;
  onSelectInstance?: (inst: Instance) => void;
  selectedClass?: string | null;
  selectedInstance?: string | null;
  className?: string;
}

export default function OntologyGraph(props: OntologyGraphProps) {
  const [full, setFull] = useState(false);
  const body = <GraphCanvas {...props} full={full} onToggleFull={() => setFull((v) => !v)} />;
  if (!full) return body;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-white p-4 flex flex-col">{body}</div>,
    document.body,
  );
}

function GraphCanvas({
  activeClasses = [],
  activeRelations = [],
  instanceSteps = [],
  travEdges = [],
  anchorInst = null,
  running = false,
  showAttrs = true,
  showCandidates = true,
  onSelectClass,
  onSelectInstance,
  selectedClass = null,
  selectedInstance = null,
  className,
  full,
  onToggleFull,
}: OntologyGraphProps & { full: boolean; onToggleFull: () => void }) {
  const activeCls = useMemo(() => new Set(activeClasses), [activeClasses]);
  const relSet = useMemo(() => new Set(activeRelations), [activeRelations]);
  const flatInst = useMemo(() => instanceSteps.flat(), [instanceSteps]);
  const instSet = useMemo(() => new Set(flatInst), [flatInst]);
  const traversing = instSet.size > 0;

  /* ── 레이아웃 ── */
  const layout = useMemo(() => {
    const cls = new Map<string, Pt & { hop: number | null }>();
    const inst = new Map<string, Pt & { candidate: boolean }>();

    if (!traversing) {
      CLASSES.forEach((c) => cls.set(c.name, { x: PAD_X + c.col * COL_W, y: PAD_Y + c.row * ROW_H, hop: null }));
      const mc = Math.max(...CLASSES.map((c) => c.col));
      const mr = Math.max(...CLASSES.map((c) => c.row));
      return { cls, inst, vb: { x: 0, y: 0, w: PAD_X * 2 + mc * COL_W, h: PAD_Y * 2 + mr * ROW_H } };
    }

    // 컬럼 = hop(스텝). 한 컬럼에 여러 클래스의 개체가 함께 설 수 있다.
    // 원본은 컬럼=클래스이지만, 여기선 한 질의가 12개 클래스를 건드려
    // 클래스마다 컬럼을 주면 12열이 되어 판독이 무너진다. hop 단위가
    // 의미상으로도 "몇 단계 타고 갔나"라 시연 설명과 맞는다.
    let maxRows = 1;
    instanceSteps.forEach((ids, ci) => {
      if (!ids.length) return;
      const x = PAD_X + ci * T_COL_W;
      // 이 컬럼 개체 + 같은 클래스의 미선택 후보
      const rows: { id: string; cand: boolean }[] = [];
      for (const id of ids) {
        rows.push({ id, cand: false });
        if (showCandidates) {
          const inst = instById(id);
          if (inst) {
            for (const other of INSTANCES) {
              if (other.cls === inst.cls && !instSet.has(other.id) && !rows.some((r) => r.id === other.id)) {
                rows.push({ id: other.id, cand: true });
              }
            }
          }
        }
      }
      const list = rows.slice(0, T_CAP);
      list.forEach((r, i) => inst.set(r.id, { x, y: T_INST_Y0 + i * T_INST_H, candidate: r.cand }));
      maxRows = Math.max(maxRows, list.length);
      // 컬럼 대표 클래스 노드 — 첫 확정 개체의 클래스
      const head = instById(ids[0]);
      if (head && !cls.has(head.cls)) cls.set(head.cls, { x, y: T_CLS_Y, hop: ci });
    });
    const nCols = instanceSteps.filter((s) => s.length).length;
    return {
      cls,
      inst,
      vb: {
        x: 0,
        y: 0,
        w: Math.max(PAD_X * 2 + Math.max(nCols - 1, 0) * T_COL_W, 560),
        h: Math.max(T_INST_Y0 + (maxRows - 1) * T_INST_H + 90, 400),
      },
    };
  }, [traversing, instanceSteps, instSet, showCandidates]);

  /* ── 카메라: 목표 viewBox 로 매 프레임 수렴 + 사용자 팬/줌 ── */
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
        if (Math.abs(n.w - t.w) < 0.6 && Math.abs(n.x - t.x) < 0.6 && Math.abs(n.y - t.y) < 0.6) {
          follow.current = false;
          return t;
        }
        return n;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── 드래그(노드) / 팬(배경) ── */
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [offset, setOffset] = useState<Record<string, Pt>>({});
  const dragRef = useRef<{ id: string | null; start: Pt; orig: Pt; pan: boolean } | null>(null);

  const toSvg = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: view.x + ((e.clientX - r.left) / r.width) * view.w, y: view.y + ((e.clientY - r.top) / r.height) * view.h };
  }, [view]);

  const onDown = (id: string | null) => (e: React.MouseEvent) => {
    e.stopPropagation();
    follow.current = false;
    const p = toSvg(e);
    dragRef.current = { id, start: p, orig: id ? (offset[id] ?? { x: 0, y: 0 }) : { x: view.x, y: view.y }, pan: !id };
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = toSvg(e);
      if (d.pan) {
        setView((v) => ({ ...v, x: d.orig.x - (p.x - d.start.x), y: d.orig.y - (p.y - d.start.y) }));
      } else if (d.id) {
        setOffset((o) => ({ ...o, [d.id!]: { x: d.orig.x + (p.x - d.start.x), y: d.orig.y + (p.y - d.start.y) } }));
      }
    };
    const up = () => (dragRef.current = null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [toSvg]);

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    follow.current = false;
    const p = toSvg(e);
    const k = e.deltaY > 0 ? 1.12 : 0.89;
    setView((v) => ({ x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w: v.w * k, h: v.h * k }));
  };

  const reset = () => {
    setOffset({});
    follow.current = true;
  };

  /* ── 좌표 헬퍼 (드래그 오프셋 반영) ── */
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

  const INST_W = 108;
  const INST_H = 34;

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* 툴바 */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        {[
          { t: '＋', f: () => { follow.current = false; setView((v) => ({ ...v, w: v.w * 0.85, h: v.h * 0.85 })); }, label: '확대' },
          { t: '－', f: () => { follow.current = false; setView((v) => ({ ...v, w: v.w * 1.18, h: v.h * 1.18 })); }, label: '축소' },
          { t: '⛶', f: reset, label: '화면 맞춤' },
          { t: full ? '✕' : '⤢', f: onToggleFull, label: full ? '닫기' : '전체화면' },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.label}
            onClick={b.f}
            className="w-7 h-7 bg-white border border-line rounded text-[12px] font-bold text-ink-dark hover:border-brand hover:text-brand"
          >
            {b.t}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
        className="w-full h-full select-none"
        style={{ cursor: dragRef.current?.pan ? 'grabbing' : 'grab' }}
        onMouseDown={onDown(null)}
        onWheel={onWheel}
        role="img"
        aria-label="온톨로지 그래프"
      >
        <defs>
          <marker id="oa" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={BRAND} />
          </marker>
          <marker id="oa-d" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#B9BFC6" />
          </marker>
          <style>{`
            .n { transition: transform .6s cubic-bezier(.22,.9,.28,1), opacity .35s ease; }
            .pop { animation: nPop .45s cubic-bezier(.2,1.2,.3,1) both }
            @keyframes nPop { from{opacity:0;transform:scale(.5)} to{opacity:1;transform:scale(1)} }
            .draw { stroke-dasharray:600; stroke-dashoffset:600; animation: nDraw .6s ease-out forwards }
            @keyframes nDraw { to { stroke-dashoffset:0 } }
            .halo { animation: nHalo 3.4s ease-in-out infinite; transform-box:fill-box; transform-origin:center }
            @keyframes nHalo { 0%,100%{opacity:.15;transform:scale(1)} 50%{opacity:.4;transform:scale(1.07)} }
            .fade { animation: nFade .4s ease-out .25s both }
            @keyframes nFade { from{opacity:0} to{opacity:1} }
          `}</style>
        </defs>

        {/* ══ 컬럼 배경 (순회) ══ */}
        {traversing &&
          [...layout.cls.entries()].map(([name, p]) => (
            <g key={`bg-${name}`}>
              <rect
                x={p.x - T_COL_W / 2 + 18}
                y={T_CLS_Y - 44}
                width={T_COL_W - 36}
                height={layout.vb.h - T_CLS_Y + 20}
                rx={6}
                fill={BRAND}
                fillOpacity={0.028}
                stroke={BRAND}
                strokeOpacity={0.1}
              />
              <text x={p.x} y={T_CLS_Y - 52} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#999999">
                hop {p.hop}
              </text>
            </g>
          ))}

        {/* ══ 클래스 간 관계 (idle) ══ */}
        {!traversing && (
          <g>
            {RELATIONS.map((r, i) => {
              const a = CP(r.domain);
              const b = CP(r.range);
              if (!a || !b) return null;
              const on = relSet.has(r.uri);
              const [p1, p2] = clipped(a, b, classR(r.domain), classR(r.range) + 7);
              const g = edgeGeom(p1, p2, i % 2 ? 0.15 : -0.15);
              return (
                <g key={r.uri}>
                  {on && <path d={g.d} fill="none" stroke={BRAND} strokeOpacity={0.15} strokeWidth={8} strokeLinecap="round" />}
                  <path
                    d={g.d}
                    fill="none"
                    stroke={on ? BRAND : GREY}
                    strokeWidth={on ? 2.2 : 1}
                    markerEnd={on ? 'url(#oa)' : undefined}
                    opacity={on ? 1 : activeCls.size ? 0.18 : 0.45}
                    className={on ? 'draw' : undefined}
                  />
                  {on &&
                    [0, 1].map((k) => (
                      <circle key={k} r={3} fill={BRAND} style={{ filter: `drop-shadow(0 0 5px ${BRAND})` }}>
                        <animateMotion dur="1.9s" begin={`${k * 0.95}s`} repeatCount="indefinite" path={g.d} />
                      </circle>
                    ))}
                </g>
              );
            })}
          </g>
        )}

        {/* ══ 클래스 → 자기 개체 (순회) ══ */}
        {traversing &&
          [...layout.inst.entries()].map(([id, ip]) => {
            const inst = instById(id)!;
            const cp = CP(inst.cls);
            const p = IP(id);
            if (!cp || !p) return null;
            const on = instSet.has(id);
            return (
              <line
                key={`ci-${id}`}
                x1={cp.x}
                y1={cp.y + classR(inst.cls)}
                x2={p.x}
                y2={p.y - INST_H / 2}
                stroke={on ? BRAND : '#C9CDD2'}
                strokeWidth={on ? 1.4 : 0.9}
                strokeDasharray={on ? undefined : '4 4'}
                opacity={on ? 0.55 : 0.4}
              />
            );
          })}

        {/* ══ 개체 간 순회 엣지 ══ */}
        {traversing &&
          travEdges.map((e, i) => {
            const a = IP(e.from);
            const b = IP(e.to);
            if (!a || !b) return null;
            const live = instSet.has(e.from) && instSet.has(e.to);
            if (!live) return null;
            const sameCol = Math.abs(a.x - b.x) < 4;
            const [p1, p2] = clipped(a, b, sameCol ? INST_H / 2 : INST_W / 2, sameCol ? INST_H / 2 + 4 : INST_W / 2 + 8);
            const g = edgeGeom(p1, p2, sameCol ? 0.42 : i % 2 ? 0.1 : -0.1);
            return (
              <g key={`te-${e.from}-${e.to}-${i}`}>
                <path d={g.d} fill="none" stroke={BRAND} strokeOpacity={0.14} strokeWidth={7} strokeLinecap="round" />
                <path d={g.d} fill="none" stroke={BRAND} strokeWidth={1.9} markerEnd="url(#oa)" className="draw" />
                <circle r={2.8} fill={BRAND} style={{ filter: `drop-shadow(0 0 5px ${BRAND}) drop-shadow(0 0 9px ${BRAND})` }}>
                  <animateMotion dur={`${1.7 + (i % 4) * 0.3}s`} begin={`${-(i % 5) * 0.33}s`} repeatCount="indefinite" path={g.d} />
                </circle>
                <g className="fade">
                  <rect x={g.mx - (e.rel.length * 6 + 12) / 2} y={g.my - 9} width={e.rel.length * 6 + 12} height={18} rx={9} fill="#FFFFFF" stroke={BRAND} strokeOpacity={0.5} />
                  <text x={g.mx} y={g.my + 3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={BRAND_DEEP}>
                    {e.rel}
                  </text>
                </g>
              </g>
            );
          })}

        {/* ══ 속성 위성 (idle) ══ */}
        {showAttrs && !traversing && (
          <g>
            {CLASSES.map((c) => {
              const p = CP(c.name);
              if (!p) return null;
              const on = activeCls.has(c.name);
              return c.attrs.slice(0, 6).map((a, i) => {
                const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                const rr = classR(c.name) + 21;
                return (
                  <g key={`${c.uri}-${a}`} opacity={activeCls.size && !on ? 0.1 : 0.85}>
                    <line x1={p.x} y1={p.y} x2={p.x + rr * Math.cos(ang)} y2={p.y + rr * Math.sin(ang)} stroke="#D9DDE2" strokeWidth={0.8} />
                    <circle cx={p.x + rr * Math.cos(ang)} cy={p.y + rr * Math.sin(ang)} r={3.5} fill="#fff" stroke="#B9BFC6" strokeWidth={0.9} />
                  </g>
                );
              });
            })}
          </g>
        )}

        {/* ══ 클래스 노드 ══ */}
        <g>
          {CLASSES.map((c, i) => {
            const p = CP(c.name);
            if (!p) return null;
            const shown = !traversing || layout.cls.has(c.name);
            const hub = HUB_CLASSES.includes(c.name);
            const on = activeCls.has(c.name);
            const r = classR(c.name);
            const sel = selectedClass === c.name;
            const opacity = traversing ? (shown ? 1 : 0) : activeCls.size && !on ? 0.16 : 1;
            if (traversing && !shown) return null;
            const fill = traversing ? '#FFFFFF' : on ? BRAND : hub ? '#FBE9E6' : '#FFFFFF';
            const stroke = traversing || on ? BRAND : hub ? HUB : GREY;
            const label = !traversing && on ? '#FFFFFF' : '#212121';

            return (
              <g
                key={c.uri}
                className="n"
                style={{ transform: `translate(${p.x}px,${p.y}px)`, opacity }}
                onMouseDown={onDown('c:' + c.name)}
                onClick={() => onSelectClass?.(c.name)}
                cursor="grab"
              >
                <title>{`${c.name} · 관계 ${degreeOf(c.name)}개`}</title>
                <g className={on ? 'pop' : undefined}>
                  {(hub || on) && (
                    <path className="halo" d={hexPath(r + 8)} fill="none" stroke={on || traversing ? BRAND : HUB} strokeWidth={1.3} style={{ animationDelay: `${(i % 7) * 0.45}s` }} />
                  )}
                  {sel && <path d={hexPath(r + 6)} fill="none" stroke={BRAND} strokeWidth={1.4} strokeDasharray="3 3" />}
                  <path d={hexPath(r)} fill={fill} stroke={stroke} strokeWidth={on || hub || traversing ? 1.9 : 1.2} style={on ? { filter: `drop-shadow(0 0 8px ${BRAND}88)` } : undefined} />
                  <path d={hexPath(r * 0.44)} fill={traversing ? BRAND : on ? '#FFFFFF' : hub ? HUB : '#C9CDD2'} fillOpacity={0.3} />
                  <text y={3.6} textAnchor="middle" fontSize={11} fontWeight={800} fill={label} style={{ pointerEvents: 'none' }}>
                    {c.name}
                  </text>
                  {!traversing && (
                    <text y={r + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#666" style={{ pointerEvents: 'none' }}>
                      {c.attrs.length}속성
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </g>

        {/* ══ 개체 노드 (순회) ══ */}
        {traversing &&
          [...layout.inst.entries()].map(([id, base]) => {
            const p = IP(id);
            const inst = instById(id);
            if (!p || !inst) return null;
            const on = instSet.has(id);
            const isAnchor = anchorInst === id;
            const sel = selectedInstance === id;
            return (
              <g
                key={id}
                className="n"
                style={{ transform: `translate(${p.x}px,${p.y}px)`, opacity: on ? 1 : 0.42 }}
                onMouseDown={onDown('i:' + id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectInstance?.(inst);
                }}
                cursor="pointer"
              >
                <title>{`${inst.label} · ${inst.origin}`}</title>
                <g className={on ? 'pop' : undefined}>
                  {isAnchor && (
                    <rect x={-INST_W / 2 - 5} y={-INST_H / 2 - 5} width={INST_W + 10} height={INST_H + 10} rx={7} fill="none" stroke={BRAND} strokeWidth={1.6}>
                      <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
                      <animateTransform attributeName="transform" type="scale" values="1;1.12" dur="1.6s" repeatCount="indefinite" additive="sum" />
                    </rect>
                  )}
                  {sel && <rect x={-INST_W / 2 - 4} y={-INST_H / 2 - 4} width={INST_W + 8} height={INST_H + 8} rx={6} fill="none" stroke={BRAND} strokeWidth={1.3} strokeDasharray="3 3" />}
                  <rect
                    x={-INST_W / 2}
                    y={-INST_H / 2}
                    width={INST_W}
                    height={INST_H}
                    rx={5}
                    fill={on ? '#FFFFFF' : '#FBFBFC'}
                    stroke={on ? BRAND : '#C9CDD2'}
                    strokeWidth={on ? 1.7 : 1}
                    strokeDasharray={on ? undefined : '4 3'}
                    style={on ? { filter: `drop-shadow(0 1px 5px ${BRAND}33)` } : undefined}
                  />
                  {on && <rect x={-INST_W / 2} y={-INST_H / 2} width={3.5} height={INST_H} rx={2} fill={BRAND} />}
                  <text y={-1} textAnchor="middle" fontSize={10} fontWeight={800} fill={on ? '#212121' : '#999999'} style={{ pointerEvents: 'none' }}>
                    {inst.label.length > 13 ? inst.label.slice(0, 12) + '…' : inst.label}
                  </text>
                  <text y={10.5} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={on ? BRAND_DEEP : '#999'} style={{ pointerEvents: 'none' }}>
                    {inst.cls}
                    <tspan fill="#999" fontWeight={600}>{on ? ' · 확정' : ' · 후보'}</tspan>
                  </text>
                </g>
              </g>
            );
          })}
      </svg>

      {/* 범례 */}
      <div className="absolute left-2 bottom-2 text-[9.5px] text-ink-mid font-semibold bg-white/85 border border-line-soft rounded px-2 py-1">
        {traversing ? (
          <>컬럼=클래스 · 카드=개체 · 실선/굵게=확정 · 점선=미선택 후보 · 드래그·⌘휠 줌</>
        ) : (
          <>육각형=클래스 · 원=속성 · 채움=허브 · 드래그·⌘휠 줌</>
        )}
        {running && <span className="ml-1.5 text-brand font-extrabold">순회 중…</span>}
      </div>
    </div>
  );
}
