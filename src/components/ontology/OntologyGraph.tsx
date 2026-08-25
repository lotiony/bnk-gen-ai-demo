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
import type { OntologyRelation } from '@/data/ontology';
import { INSTANCES, instById, type Instance, type TravEdge } from '@/data/ontologyInstances';
import { buildSim, simViewBox, degreeMap, shade, dispLabel, CLASS_R, PROP_R, PROP_COLOR, type SimNode } from './graphSim';

const BRAND = '#CB2C10';
const DEEP = '#A82410';
/** 허브(연결 TOP 5) — 원본의 앰버 자리. */
const CORE = '#B8791F';
const HIER = '#7C8695';
/** 추가·연결 진행 색 — 확정(브랜드 레드)과 구분되는 '작업 중' 파랑. */
const ADD = '#1F5BB8';

const T_COL_W = 250;
const T_INST_Y0 = 130;
const T_INST_H = 92;
const T_CAP = 5;
/** 개체 원 반지름 — 역할별(원본 instR: 앵커 22 / 강조 18 / 일반 14 / 후보 12). */
const instR = (role: 'anchor' | 'focus' | 'plain' | 'cand') =>
  role === 'anchor' ? 22 : role === 'focus' ? 18 : role === 'plain' ? 14 : 12;

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
  /** 노드 ＋ 클릭 — 그 클래스에 속성·관계를 추가한다. */
  onAddFrom?: (cls: string) => void;
  /** 노드 ＋ 를 다른 노드로 끌어다 놓음 — 관계 생성. */
  onLinkTo?: (domain: string, range: string) => void;
  /** 패널 태그 호버 강조 — 그래프에서 해당 요소만 살린다. */
  highlight?: { kind: 'attr'; cls: string; attr: string } | { kind: 'rel'; uri: string } | null;
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
  onAddFrom,
  onLinkTo,
  highlight = null,
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
  /** 클래스 색 — 개체가 그대로 물려받는다(원본 instColor = clsColor(n.type)). */
  const clsColor = useCallback((n: string) => (hubs.includes(n) ? CORE : HIER), [hubs]);
  /** 노드에 얹을 속성값 2줄 — 식별번호류는 뺀다(원본과 동일 규칙). */
  const attrLines = useCallback((inst: Instance, n: number) =>
    Object.entries(inst.props)
      .filter(([k]) => !/번호$|코드$|ID/.test(k))
      .slice(0, n)
      .map(([k, v]) => `${k} ${v}`.slice(0, 22)), []);

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
    // clsAt 은 클래스명 키라 같은 클래스가 두 hop 의 대표면 뒤쪽 컬럼이
    // 헤드를 못 가진다. 컬럼 자체는 별도 배열(colAt)로 관리한다.
    const colAt: Array<Pt & { hop: number; cls: string; repeat: boolean }> = [];
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
      if (head) {
        const first = !clsAt.has(head.cls);
        if (first) clsAt.set(head.cls, { x, y: 0, hop: ci });
        colAt.push({ x, y: 0, hop: ci, cls: head.cls, repeat: !first });
      }
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
    colAt.forEach((p) => bump(p, CLASS_R + 20, CLASS_R + 30));
    instAt.forEach((p) => bump(p, 78, 52));
    if (!Number.isFinite(minX)) {
      minX = 0; minY = 0; maxX = 600; maxY = 400;
    }
    const M = 70;
    return {
      colAt,
      clsAt,
      instAt,
      hidden,
      vb: { x: minX - M, y: minY - M - 26, w: maxX - minX + M * 2, h: maxY - minY + M * 2 + 40 },
    };
  }, [traverse, allSteps]);

  const CP = useCallback((n: string): Pt | null => (trav ? (trav.clsAt.get(n) ?? simP(n)) : simP(n)), [trav, simP]);
  /** 개체 x 좌표가 속한 컬럼. 개체는 컬럼 x 에 정확히 정렬되므로 이걸로 역인덱싱한다. */
  const colOfX = useCallback((x: number) => trav?.colAt.find((c) => Math.abs(c.x - x) < 2) ?? null, [trav]);
  /** 순회 등장 시각 — 컬럼 헤드(hop*0.1) → 개체 → 펼침선 → 순회 엣지 순. */
  const tInst = useCallback(
    (p: Pt) => {
      const row = Math.max(0, Math.round((p.y - T_INST_Y0) / T_INST_H));
      return Math.min((colOfX(p.x)?.hop ?? 0) * 0.1 + row * 0.05, 0.6);
    },
    [colOfX],
  );
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
  const [hoverCls, setHoverCls] = useState<string | null>(null);
  /** ＋ 배지 드래그로 관계를 잇는 중. moved=false 면 클릭으로 친다. */
  const [linkDrag, setLinkDrag] = useState<{ from: string; sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
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
      const pan = panFrom.current;
      if (pan) {
        // setView 업데이터는 지연 실행된다. 그 사이 mouseup 이 panFrom 을
        // 비우면 ref 를 다시 읽을 때 null 이라 크래시한다 — 지역에 잡아 쓴다.
        const p = toSvg(e);
        setView((v) => ({ ...v, x: pan.v.x - (p.x - pan.p.x), y: pan.v.y - (p.y - pan.p.y) }));
        return;
      }
      if (linkDrag) {
        const q = toSvg(e);
        setLinkDrag((ld) => ld && { ...ld, x: q.x, y: q.y, moved: ld.moved || Math.hypot(q.x - ld.sx, q.y - ld.sy) > 8 });
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
      if (linkDrag) {
        // 안 끌었으면 클릭으로 친다 — ＋ 는 클릭=추가 카드, 드래그=관계 연결.
        if (!linkDrag.moved) onAddFrom?.(linkDrag.from);
        else {
          const q = toSvg(e);
          const hit = classes.find((c) => {
            if (c.name === linkDrag.from) return null;
            const t = simP(c.name);
            return t && Math.hypot(t.x - q.x, t.y - q.y) < CLASS_R + 14;
          });
          if (hit) onLinkTo?.(linkDrag.from, hit.name);
        }
        setLinkDrag(null);
        return;
      }
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
  }, [toSvg, built, classes, simP, onMergeAsk, linkDrag, onAddFrom, onLinkTo]);

  const wheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    follow.current = false;
    const p = toSvg(e);
    const k = e.deltaY > 0 ? 1.15 : 0.87;
    setView((v) => ({ x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w: v.w * k, h: v.h * k }));
  };

  const spring = reduce ? { duration: 0 } : ({ type: 'spring', stiffness: 170, damping: 26 } as const);

  /* ── 에고 네트워크 강조 ──
     호버(없으면 선택) 클래스와 그에 직접 연결된 것만 살리고 나머지는 죽인다.
     드래그 중에는 끄는데, 노드를 끌면서 화면이 계속 명멸하면 못 본다. */
  const focus = dragId.current || linkDrag ? null : (hoverCls ?? selectedClass);
  const adj = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const r of relations) {
      if (r.domain === focus) set.add(r.range);
      if (r.range === focus) set.add(r.domain);
    }
    return set;
  }, [focus, relations]);
  const clsLive = useCallback(
    (n: string) => {
      if (highlight) return highlight.kind === 'attr' ? n === highlight.cls : relations.some((r) => r.uri === highlight.uri && (r.domain === n || r.range === n));
      return !adj || adj.has(n);
    },
    [adj, highlight, relations],
  );
  const relLive = useCallback(
    (r: OntologyRelation) => {
      if (highlight) return highlight.kind === 'rel' && r.uri === highlight.uri;
      return !focus || r.domain === focus || r.range === focus;
    },
    [focus, highlight],
  );
  /** 강조가 걸린 상태인가 — 걸리면 나머지를 죽인다. */
  const dimming = !!focus || !!highlight;
  const focusRelCount = focus ? relations.filter((r) => r.domain === focus || r.range === focus).length : 0;

  /* ── 등장 타임라인 ──
     클래스 → 그 클래스의 속성 → 양끝이 다 나온 관계선. 순서가 이렇게
     이어져야 "허공에 선만 먼저 뜬" 구간이 안 생긴다. 관계선은 원래 등장
     애니메이션이 아예 없어서 첫 프레임부터 그려지고 있었다.

     각 애니메이션의 목표값은 상수(opacity 1 / scale 1)로 고정한다.
     목표가 바뀌면 framer 가 지연을 붙인 채로 다시 재생하기 때문에,
     점등·드래그 같은 이후 상태 변화는 지연 없이 즉시 반영되어야 한다. */
  const clsIdx = useMemo(() => new Map(classes.map((c, i) => [c.name, i])), [classes]);
  const tCls = useCallback((i: number) => Math.min(i * 0.03, 0.9), []);
  const tSat = useCallback((host: string) => tCls(clsIdx.get(host) ?? 0) + 0.14, [tCls, clsIdx]);
  const tEdge = useCallback((d: string, r: string) => Math.max(tSat(d), tSat(r)) + 0.12, [tSat]);

  const pop = (i: number) => ({
    initial: reduce ? false : { scale: 0 },
    animate: { scale: 1 },
    transition: reduce ? { duration: 0 } : ({ type: 'spring', stiffness: 320, damping: 24, delay: tCls(i) } as const),
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
          <marker id="aradd" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={ADD} />
          </marker>
        </defs>

        {trav &&
          trav.colAt.map((p) => (
            <g key={`bg-${p.hop}`}>
              <rect x={p.x - T_COL_W / 2 + 12} y={trav.vb.y + 14} width={T_COL_W - 24} height={trav.vb.h - 34} rx={8} fill={BRAND} fillOpacity={0.035} stroke={BRAND} strokeOpacity={0.12} />
              <text x={p.x} y={trav.vb.y + 40} textAnchor="middle" fontSize={10} fontWeight={800} fill={BRAND}>hop {p.hop}</text>
            </g>
          ))}

        {/* 관계 엣지 — 실행 전에는 전부 연결. 순회 중에는 양끝이 모두
             컬럼에 올라온 클래스일 때만 그린다. 한쪽이 컬럼 밖이면 그 노드는
             force 좌표(화면 밖)에 있어 화살표만 허공으로 뻗는다. */}
        {relations.map((r, i) => {
          const bothIn = visible(r.domain) && visible(r.range);
          if (trav && !bothIn) return null;
          const a = CP(r.domain);
          const b = CP(r.range);
          if (!a || !b) return null;
          const on = relSet.has(r.uri);
          const g = edgeGeom(a, b, i % 2 ? 0.09 : -0.09);
          const live = trav || relLive(r);
          const op = trav ? (on ? 0.9 : 0.16) : dimming ? (live ? 1 : 0.07) : on ? 0.9 : 0.55;
          // 강조된 엣지는 브랜드색으로 끌어올리고 라벨을 필로 띄운다.
          const hot = !trav && dimming && live;
          return (
            <motion.g
              key={r.uri}
              style={{ pointerEvents: 'none' }}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : tEdge(r.domain, r.range) }}
            >
              <path d={g.d} fill="none" stroke={on || hot ? BRAND : '#C2C7CD'} strokeWidth={on || hot ? 1.8 : 1.1} opacity={op}
                strokeDasharray={trav ? '5 5' : undefined} markerEnd={on || hot ? 'url(#ar)' : 'url(#ard)'} />
              {!trav && (
                <g opacity={op}>
                  {hot && (
                    <rect x={g.mx - (r.name.length * 5.2 + 9) / 2} y={g.my - 15} width={r.name.length * 5.2 + 9} height={14} rx={7}
                      fill="#fff" stroke={BRAND} strokeWidth={1} />
                  )}
                  <text x={g.mx} y={g.my - 5} textAnchor="middle" fontSize={9.5} fontWeight={hot ? 800 : 700} fill={on || hot ? BRAND : '#98A0A8'}
                    style={hot ? undefined : { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' }}>
                    {r.name}
                  </text>
                </g>
              )}
            </motion.g>
          );
        })}

        {/* 속성 위성 — 원 + 아래 작은 텍스트.
             원본과 동일하게 개별 pop 을 주지 않는다. 선과 원이 한 그룹에서
             같이 나타나야 "밑선만 먼저 그려진" 어긋남이 없다.
             레이어 전체만 순회 진입 시 페이드아웃한다. */}
        {showAttrs && (
          <motion.g
            initial={false}
            animate={{ opacity: trav ? 0.1 : 1 }}
            transition={{ duration: reduce ? 0 : 0.5 }}
            style={{ pointerEvents: 'none' }}
          >
            {(built.sim.nodes() as SimNode[])
              .filter((n) => n.isProp)
              .map((n) => {
                if (trav && !visible(n.host!)) return null;
                const hp = CP(n.host!);
                if (!hp) return null;
                const p = trav ? hp : { x: n.x ?? 0, y: n.y ?? 0 };
                // 강조 중에는 살아 있는 클래스의 속성만 남긴다.
                const satOp = trav
                  ? 1
                  : highlight?.kind === 'attr'
                    ? highlight.cls === n.host && highlight.attr === n.label ? 1 : 0.06
                    : dimming ? (clsLive(n.host!) ? 1 : 0.06) : 1;
                return (
                  <motion.g
                    key={n.id}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduce ? 0 : 0.26, delay: reduce ? 0 : tSat(n.host!) }}
                    style={{ opacity: satOp }}
                  >
                    <line x1={hp.x} y1={hp.y} x2={p.x} y2={p.y} stroke={PROP_COLOR} strokeOpacity={0.32} strokeWidth={1.1} />
                    <circle cx={p.x} cy={p.y} r={PROP_R} fill={PROP_COLOR + '22'} stroke={PROP_COLOR} strokeOpacity={0.65} strokeWidth={1.2} />
                    <text x={p.x} y={p.y + PROP_R + 11} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#7A828B" opacity={0.9}>
                      {dispLabel(n.label)}
                    </text>
                  </motion.g>
                );
              })}
          </motion.g>
        )}

        {/* 클래스 → 개체 펼침선 */}
        {trav &&
          [...trav.instAt.keys()].map((id) => {
            const inst = instById(id)!;
            const p = IP(id);
            if (!p) return null;
            // 펼침선은 **컬럼 대표 클래스**에서 내려온다.
            // 개체의 소속 클래스로 잡으면, 그 클래스가 컬럼에 없을 때
            // CP 가 force 좌표(화면 밖)로 폴백해 선이 화면 밖에서 날아온다.
            const cp = colOfX(p.x);
            if (!cp) return null;
            const on = litSet.has(id);
            const col = clsColor(inst.cls);
            // 원본과 동일한 베지어 펼침선 — 클래스에서 아래로 내려와 개체로
            const midY = (cp.y + CLASS_R + p.y) / 2;
            const d = `M ${cp.x} ${cp.y + CLASS_R} C ${cp.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y - instR(on ? 'focus' : 'cand') - 5}`;
            // 개체보다 먼저 그리면 허공에서 선이 내려오는 게 보인다 — 개체 뒤로.
            const delay = reduce ? 0 : tInst(p) + 0.09;
            return (
              <motion.path
                key={`ci-${id}`}
                d={d}
                fill="none"
                stroke={on ? col : '#D3D7DC'}
                strokeWidth={on ? 1.4 : 0.9}
                strokeDasharray={on ? undefined : '4 4'}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: on ? 0.5 : 0.35 }}
                transition={{ duration: reduce ? 0 : 0.35, delay, ease: 'easeOut' }}
              />
            );
          })}

        {/* 개체 간 순회 엣지 */}
        {trav &&
          travEdges.map((e, i) => {
            const a = IP(e.from);
            const b = IP(e.to);
            if (!a || !b || !litSet.has(e.from) || !litSet.has(e.to)) return null;
            const same = Math.abs(a.x - b.x) < 4;
            const g = edgeGeom(a, b, same ? 0.4 : i % 2 ? 0.1 : -0.1);
            const eCol = clsColor(instById(e.from)?.cls ?? '');
            const eDelay = reduce ? 0 : Math.max(tInst(a), tInst(b)) + 0.18;
            return (
              <motion.g key={`te${i}`} style={{ pointerEvents: 'none' }}
                initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.2, delay: eDelay }}>
                <path d={g.d} fill="none" stroke={eCol} strokeOpacity={0.16} strokeWidth={6} strokeLinecap="round" />
                <motion.path d={g.d} fill="none" stroke={eCol} strokeWidth={1.9} markerEnd="url(#ar)"
                  initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.5, delay: eDelay, ease: 'easeOut' }} />
                {!reduce && (
                  <circle r={2.8} fill={eCol} style={{ filter: `drop-shadow(0 0 5px ${eCol}) drop-shadow(0 0 9px ${eCol})` }}>
                    <animateMotion dur={`${1.7 + (i % 4) * 0.3}s`} begin={`${-(i % 5) * 0.33}s`} repeatCount="indefinite" path={g.d} />
                  </circle>
                )}
                <text x={g.mx} y={g.my - 5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={DEEP}
                  style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' }}>{e.rel}</text>
              </motion.g>
            );
          })}

        {/* 클래스 노드 */}
        {classes.map((c, i) => {
          const p = CP(c.name);
          if (!p) return null;
          const shown = visible(c.name);
          if (trav && !shown) return null;
          const on = activeClasses.includes(c.name);
          const hub = hubs.includes(c.name);
          const t = Math.sqrt((deg[c.name] ?? 0) / maxDeg);
          const base = on ? BRAND : hub ? CORE : HIER;
          const sel = selectedClass === c.name;
          return (
            <motion.g key={c.uri}
              animate={{
                x: p.x,
                y: p.y,
                opacity: trav ? (shown ? 1 : 0.05) : dimming && !clsLive(c.name) ? 0.09 : 1,
                scale: trav && !shown ? 0.75 : 1,
              }}
              transition={dragId.current === c.name ? { duration: 0 } : spring}
              onMouseDown={nodeDown(c.name)}
              onMouseEnter={() => !trav && setHoverCls(c.name)}
              onMouseLeave={() => !trav && setHoverCls((h) => (h === c.name ? null : h))}
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

              {/* 호버 요약 — 관계 수와 허브 여부. 클릭 전에 판단할 근거가 된다. */}
              {!trav && hoverCls === c.name && !dragId.current && !linkDrag && (() => {
                const txt = `${c.name} · 관계 ${focusRelCount}개${hub ? ' · 핵심(연결 TOP 5)' : ''}`;
                const w = txt.length * 6.6 + 16;
                return (
                  <g transform={`translate(0 ${CLASS_R + 22})`} style={{ pointerEvents: 'none' }}>
                    <rect x={-w / 2} y={0} width={w} height={19} rx={4} fill="#212121" opacity={0.92} />
                    <text x={0} y={13.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">{txt}</text>
                  </g>
                );
              })()}

              {/* ＋ 배지 — 클릭=속성·관계 추가, 다른 노드로 드래그=관계 연결 */}
              {!trav && hoverCls === c.name && !dragId.current && !linkDrag && !spaceDown && (
                <g
                  transform={`translate(${CLASS_R * 0.95} ${-CLASS_R * 0.95})`}
                  style={{ cursor: 'crosshair' }}
                  onMouseDown={(ev) => {
                    ev.stopPropagation();
                    const q = toSvg(ev);
                    setLinkDrag({ from: c.name, sx: q.x, sy: q.y, x: q.x, y: q.y, moved: false });
                  }}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <title>클릭=속성·관계 추가 · 드래그=다른 클래스로 관계 연결</title>
                  <circle r={9.5} fill={ADD} stroke="#fff" strokeWidth={1.4} />
                  <path d="M -4.5 0 H 4.5 M 0 -4.5 V 4.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                </g>
              )}
            </motion.g>
          );
        })}

        {/* ＋ 드래그 중 — 커서(또는 스냅된 대상)까지 예상 연결선 */}
        {linkDrag && linkDrag.moved && (() => {
          const a = simP(linkDrag.from);
          if (!a) return null;
          const snap = classes.find((c) => {
            if (c.name === linkDrag.from) return false;
            const t = simP(c.name);
            return !!t && Math.hypot(t.x - linkDrag.x, t.y - linkDrag.y) < CLASS_R + 14;
          });
          const t = snap ? simP(snap.name) : null;
          const end = t ?? { x: linkDrag.x, y: linkDrag.y };
          return (
            <g style={{ pointerEvents: 'none' }}>
              <path d={`M ${a.x} ${a.y} L ${end.x} ${end.y}`} fill="none" stroke={ADD} strokeWidth={2.4} strokeDasharray="7 5" markerEnd="url(#aradd)" />
              {t && <path d={hexPath(CLASS_R + 7)} transform={`translate(${t.x} ${t.y})`} fill="none" stroke={ADD} strokeWidth={2} strokeDasharray="4 4" />}
            </g>
          );
        })()}

        {/* 재방문 컬럼 헤드 — 같은 클래스가 뒤쪽 hop 의 대표로 다시 등장할 때.
             클래스 노드는 클래스당 하나만 그려지므로(모프 애니메이션 유지) 그
             복제 헤드를 여기서 채운다. 없으면 그 컬럼만 헤드 없이 떠 보인다. */}
        {trav &&
          trav.colAt
            .filter((c) => c.repeat)
            .map((c) => {
              const on = activeClasses.includes(c.cls);
              const hub = hubs.includes(c.cls);
              const t = Math.sqrt((deg[c.cls] ?? 0) / maxDeg);
              const base = on ? BRAND : hub ? CORE : HIER;
              return (
                <motion.g
                  key={`rh-${c.hop}`}
                  animate={{ x: c.x, y: c.y }}
                  transition={spring}
                  initial={false}
                  style={{ pointerEvents: 'none' }}
                >
                  <motion.g
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 24, delay: Math.min(c.hop * 0.1, 0.55) }}
                  >
                    <path d={hexPath(CLASS_R)} fill={shade(base, t)} stroke={base} strokeWidth={1.2 + t * 1.6} strokeDasharray="5 3"
                      style={{ filter: `drop-shadow(0 0 ${4 + Math.round(t * 12)}px ${base}66)` }} />
                    <path d={hexPath(CLASS_R * 0.46)} fill={base} fillOpacity={0.5 + t * 0.4} />
                    <text y={CLASS_R + 15} textAnchor="middle" fontSize={11} fontWeight={800} fill="#212121">
                      {dispLabel(c.cls)}
                    </text>
                  </motion.g>
                </motion.g>
              );
            })}

        {/* 개체 노드 — 원본과 동일: 원형 · 클래스 색 상속 · 속성값 2줄 ·
             소속 클래스 위치에서 튀어나오는 등장 · hop 뱃지 · 앵커 '시작' 뱃지 */}
        {trav &&
          [...trav.instAt.keys()].map((id) => {
            const p = IP(id)!;
            const inst = instById(id);
            if (!inst) return null;
            const on = litSet.has(id);
            const isAnchor = anchorInst === id && on;
            const isSel = selectedInstance === id;
            const foc = on || isAnchor || isSel;
            const role = isAnchor ? 'anchor' : foc ? 'focus' : on ? 'plain' : 'cand';
            const r = instR(role);
            const col = on ? clsColor(inst.cls) : '#8E979F';
            const lines = attrLines(inst, foc ? 2 : 1);
            const cp = CP(inst.cls) ?? p;
            const hop = colOfX(p.x)?.hop;
            const fillA = isSel ? '3a' : isAnchor ? '30' : on ? '1c' : '12';
            return (
              <motion.g
                key={id}
                initial={reduce ? false : { x: cp.x, y: cp.y, scale: 0, opacity: 0 }}
                animate={{ x: p.x, y: p.y, scale: 1, opacity: foc ? 1 : 0.5 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26, delay: tInst(p) }}
                onClick={(e) => { e.stopPropagation(); onSelectInstance?.(inst); }}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${inst.label} · ${inst.origin}`}</title>
                {isAnchor && !reduce && (
                  <circle r={r} fill="none" stroke={col} strokeWidth={1.5}>
                    <animate attributeName="r" values={`${r};${r + 13}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={r + 5} fill="none" stroke={col} strokeOpacity={foc ? 0.3 : 0.12} strokeWidth={1} />
                <circle
                  r={r}
                  fill={col + fillA}
                  stroke={col}
                  strokeWidth={isSel ? 2.6 : isAnchor ? 2.2 : on ? 1.5 : 1.2}
                  strokeDasharray={on ? undefined : '4 4'}
                  style={on ? { filter: `drop-shadow(0 0 ${isSel || isAnchor ? 12 : 7}px ${col}${isSel || isAnchor ? 'aa' : '55'})` } : undefined}
                />
                <text y={r + 13} textAnchor="middle" fontSize={11} fontWeight={foc ? 800 : 500} fill={foc ? '#212121' : '#8E979F'} style={{ pointerEvents: 'none' }}>
                  {inst.label.slice(0, 14)}
                </text>
                {lines.map((t, li) => (
                  <text key={li} y={r + 25 + li * 11} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={foc ? '#6B7480' : '#B4BBC2'} style={{ pointerEvents: 'none' }}>
                    {t}
                  </text>
                ))}
                {on && hop != null && (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={-r * 0.72 - 5} cy={-r * 0.72 - 5} r={8} fill="#fff" stroke={col} strokeWidth={1.2} />
                    <text x={-r * 0.72 - 5} y={-r * 0.72 - 1.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill={col}>
                      {hop}
                    </text>
                  </g>
                )}
                {isAnchor && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={6} y={-r - 20} width={38} height={16} rx={8} fill={BRAND} />
                    <text x={25} y={-r - 8.5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">시작</text>
                  </g>
                )}
              </motion.g>
            );
          })}

        {trav &&
          trav.colAt.map((p) => {
            const n = trav.hidden.get(p.hop) ?? 0;
            return n ? (
              <text key={`h-${p.hop}`} x={p.x} y={trav.vb.y + trav.vb.h - 24} textAnchor="middle" fontSize={10} fontWeight={700} fill="#B9BFC6">+{n}개</text>
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
