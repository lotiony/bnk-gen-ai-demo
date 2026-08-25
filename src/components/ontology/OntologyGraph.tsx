/**
 * 온톨로지 그래프 — 인라인 SVG + CSS/SMIL 애니메이션.
 *
 * climax/frontend 의 QueryGraph.jsx 시각 언어를 옮겼다. 다만 원본이 쓰는
 * framer-motion · d3-force · sigma 는 **가져오지 않는다**. 오프라인 단일 HTML
 * 제약(CLAUDE.md) 아래에서 물리 시뮬레이션은 이득이 없고, 좌표를 데이터에
 * 고정해 두면 리허설과 본 시연이 같은 그림을 낸다. 대신 원본의 연출
 * (드로잉·파티클·헤일로·펄스·카메라 추적)은 SVG/CSS 로 그대로 재현한다.
 *
 * 두 가지 모드
 *  · idle      — 계층 배치. 허브는 헤일로가 돈다.
 *  · traversal — 앵커를 맨 왼쪽에 두고 hop 순서대로 오른쪽으로 컬럼 전개.
 *                노드가 제자리에서 컬럼으로 morph 하고, 엣지가 그려지며,
 *                확정 경로에는 글로우 파티클이 흐른다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CLASSES, RELATIONS, HUB_CLASSES, degreeOf, type OntologyClass } from '@/data/ontology';

const COL_W = 172;
const ROW_H = 100;
const PAD_X = 84;
const PAD_Y = 64;

/* 순회 모드 배치 */
const T_COL_W = 210;
const T_ROW_H = 104;

const BRAND = '#CB2C10';
const BRAND_DEEP = '#A82410';
const HUB_LINE = '#CB2C10';
const IDLE_LINE = '#9AA1A9';

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** 두 점을 잇는 완만한 곡선 + 중점(라벨 위치). */
function edgeGeom(p1: { x: number; y: number }, p2: { x: number; y: number }, bow = 0.16) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  // 법선 방향으로 bow 만큼 밀어 곡률을 만든다
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (p1.x + p2.x) / 2 + nx * len * bow;
  const my = (p1.y + p2.y) / 2 + ny * len * bow;
  return {
    d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    mx,
    my,
  };
}

/** 노드 반지름 — 연결 수에 따라 커진다. */
function radiusOf(name: string) {
  return 20 + Math.min(degreeOf(name), 6) * 1.4;
}

export interface OntologyGraphProps {
  activeClasses?: string[];
  activeRelations?: string[];
  /** 클래스별 hop 번호 — 있으면 순회 모드로 그린다. */
  hopOf?: Record<string, number>;
  /** 앵커 클래스명 (순회 시작점). */
  anchor?: string | null;
  /** 실행 중이면 마지막 컬럼이 펄스한다. */
  running?: boolean;
  showAttrs?: boolean;
  onSelect?: (name: string) => void;
  selected?: string | null;
  className?: string;
}

export default function OntologyGraph({
  activeClasses = [],
  activeRelations = [],
  hopOf,
  anchor = null,
  running = false,
  showAttrs = true,
  onSelect,
  selected = null,
  className,
}: OntologyGraphProps) {
  const activeSet = useMemo(() => new Set(activeClasses), [activeClasses]);
  const relSet = useMemo(() => new Set(activeRelations), [activeRelations]);
  const traversing = !!hopOf && Object.keys(hopOf).length > 0;
  const dimming = activeSet.size > 0;

  /* ── 노드 좌표 ── */
  const layout = useMemo(() => {
    const map = new Map<string, { x: number; y: number; hop: number | null }>();
    if (traversing) {
      // hop 별로 묶어 컬럼 배치. 세로는 컬럼 안에서 균등 분배.
      const byHop = new Map<number, OntologyClass[]>();
      for (const c of CLASSES) {
        const h = hopOf![c.name];
        if (h == null) continue;
        if (!byHop.has(h)) byHop.set(h, []);
        byHop.get(h)!.push(c);
      }
      const hops = [...byHop.keys()].sort((a, b) => a - b);
      const maxIn = Math.max(...[...byHop.values()].map((v) => v.length), 1);
      hops.forEach((h, ci) => {
        const list = byHop.get(h)!;
        list.forEach((c, i) => {
          const span = (list.length - 1) * T_ROW_H;
          const top = ((maxIn - 1) * T_ROW_H - span) / 2;
          map.set(c.name, { x: PAD_X + ci * T_COL_W, y: PAD_Y + top + i * T_ROW_H, hop: h });
        });
      });
      // 순회에 포함되지 않은 클래스 — 화면 밖으로 밀어 흐리게
      CLASSES.forEach((c) => {
        if (!map.has(c.name)) {
          map.set(c.name, { x: PAD_X + c.col * COL_W, y: PAD_Y + c.row * ROW_H, hop: null });
        }
      });
      const w = PAD_X * 2 + Math.max(hops.length - 1, 0) * T_COL_W;
      const h = PAD_Y * 2 + (maxIn - 1) * T_ROW_H;
      return { map, vb: { x: 0, y: 0, w: Math.max(w, 520), h: Math.max(h, 360) } };
    }
    CLASSES.forEach((c) => map.set(c.name, { x: PAD_X + c.col * COL_W, y: PAD_Y + c.row * ROW_H, hop: null }));
    const maxCol = Math.max(...CLASSES.map((c) => c.col));
    const maxRow = Math.max(...CLASSES.map((c) => c.row));
    return { map, vb: { x: 0, y: 0, w: PAD_X * 2 + maxCol * COL_W, h: PAD_Y * 2 + maxRow * ROW_H } };
  }, [traversing, hopOf]);

  /* ── 카메라 추적 — 목표 viewBox 로 매 프레임 수렴 (원본의 followRef 루프) ── */
  const [view, setView] = useState(layout.vb);
  const target = useRef(layout.vb);
  target.current = layout.vb;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      setView((v) => {
        const t = target.current;
        const k = 0.14;
        const nx = v.x + (t.x - v.x) * k;
        const ny = v.y + (t.y - v.y) * k;
        const nw = v.w + (t.w - v.w) * k;
        const nh = v.h + (t.h - v.h) * k;
        if (Math.abs(nw - t.w) < 0.6 && Math.abs(nh - t.h) < 0.6 && Math.abs(nx - t.x) < 0.6) return t;
        return { x: nx, y: ny, w: nw, h: nh };
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const P = (n: string) => layout.map.get(n)!;
  const maxHop = traversing ? Math.max(...Object.values(hopOf!)) : 0;

  return (
    <svg
      viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
      className={cn('w-full h-full', className)}
      role="img"
      aria-label="온톨로지 그래프"
    >
      <defs>
        <marker id="og-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={BRAND} />
        </marker>
        <marker id="og-arrow-dim" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#B9BFC6" />
        </marker>
        <style>{`
          .og-node { transition: transform .62s cubic-bezier(.22,.9,.28,1), opacity .4s ease; }
          .og-pop { animation: ogPop .5s cubic-bezier(.2,1.2,.3,1) both; }
          @keyframes ogPop { from { opacity:0; transform:scale(.55) } to { opacity:1; transform:scale(1) } }
          .og-draw { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: ogDraw .55s ease-out forwards; }
          @keyframes ogDraw { to { stroke-dashoffset: 0 } }
          .og-halo { animation: ogHalo 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes ogHalo { 0%,100% { opacity:.16; transform:scale(1) } 50% { opacity:.42; transform:scale(1.06) } }
          .og-label-fade { animation: ogFade .4s ease-out .25s both; }
          @keyframes ogFade { from { opacity:0 } to { opacity:1 } }
        `}</style>
      </defs>

      {/* ══ 엣지 ══ */}
      <g>
        {RELATIONS.map((r, i) => {
          const a = layout.map.get(r.domain);
          const b = layout.map.get(r.range);
          if (!a || !b) return null;
          const on = relSet.has(r.uri);
          const inPath = traversing && a.hop != null && b.hop != null;
          if (traversing && !inPath && !on) return null; // 순회 중엔 경로 밖 엣지를 감춘다

          const ra = radiusOf(r.domain);
          const rb = radiusOf(r.range);
          const raw = edgeGeom(a, b, traversing ? (i % 2 ? 0.1 : -0.1) : 0.16);
          // 노드 반지름만큼 양끝을 잘라 화살표가 육각형에 닿게
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const L = Math.hypot(dx, dy) || 1;
          const p1 = { x: a.x + (dx / L) * ra, y: a.y + (dy / L) * ra };
          const p2 = { x: b.x - (dx / L) * (rb + 7), y: b.y - (dy / L) * (rb + 7) };
          const g = edgeGeom(p1, p2, traversing ? (i % 2 ? 0.1 : -0.1) : 0.16);

          return (
            <g key={r.uri}>
              {/* 광폭 언더레이 — 확정 경로에 두께감 */}
              {on && <path d={g.d} fill="none" stroke={BRAND} strokeOpacity={0.16} strokeWidth={8} strokeLinecap="round" />}
              <path
                d={g.d}
                fill="none"
                stroke={on ? BRAND : IDLE_LINE}
                strokeWidth={on ? 2.2 : 1}
                strokeDasharray={traversing && !on ? '5 5' : undefined}
                markerEnd={on ? 'url(#og-arrow)' : traversing ? 'url(#og-arrow-dim)' : undefined}
                opacity={on ? 1 : dimming ? 0.22 : 0.5}
                className={on ? 'og-draw' : undefined}
                style={on ? ({ ['--len' as string]: 400 } as React.CSSProperties) : undefined}
              />
              {/* 글로우 파티클 — 확정 경로에만 */}
              {on &&
                [0, 1].map((k) => (
                  <circle key={k} r={3.1} fill={BRAND} style={{ filter: `drop-shadow(0 0 5px ${BRAND}) drop-shadow(0 0 10px ${BRAND})` }}>
                    <animateMotion dur="1.9s" begin={`${k * 0.95 + (i % 5) * 0.28}s`} repeatCount="indefinite" path={g.d} />
                  </circle>
                ))}
              {/* 관계 라벨 알약 */}
              {on && (
                <g className="og-label-fade">
                  <rect
                    x={g.mx - (r.name.length * 6 + 12) / 2}
                    y={g.my - 9}
                    width={r.name.length * 6 + 12}
                    height={18}
                    rx={9}
                    fill="#FFFFFF"
                    stroke={BRAND}
                    strokeOpacity={0.5}
                  />
                  <text x={g.mx} y={g.my + 3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={BRAND_DEEP}>
                    {r.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* ══ 속성 위성 ══ */}
      {showAttrs && !traversing && (
        <g>
          {CLASSES.map((c) => {
            const p = P(c.name);
            const on = activeSet.has(c.name);
            return c.attrs.slice(0, 6).map((a, i) => {
              const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
              const rr = radiusOf(c.name) + 22;
              const ax = p.x + rr * Math.cos(ang);
              const ay = p.y + rr * Math.sin(ang);
              return (
                <g key={`${c.uri}-${a}`} opacity={dimming && !on ? 0.12 : 0.9}>
                  <line x1={p.x} y1={p.y} x2={ax} y2={ay} stroke="#D9DDE2" strokeWidth={0.8} />
                  <circle cx={ax} cy={ay} r={3.6} fill="#FFFFFF" stroke="#B9BFC6" strokeWidth={0.9} />
                </g>
              );
            });
          })}
        </g>
      )}

      {/* ══ 클래스 노드 ══ */}
      <g>
        {CLASSES.map((c, i) => {
          const p = P(c.name);
          const hub = HUB_CLASSES.includes(c.name);
          const on = activeSet.has(c.name);
          const inPath = traversing && p.hop != null;
          const isAnchor = anchor === c.name;
          const isSel = selected === c.name;
          const r = radiusOf(c.name);
          const t = Math.min(degreeOf(c.name), 7) / 7;

          const opacity = traversing ? (inPath ? 1 : 0.06) : dimming && !on ? 0.18 : 1;
          const fill = on ? BRAND : hub ? '#FBE9E6' : '#FFFFFF';
          const stroke = on ? BRAND_DEEP : hub ? HUB_LINE : '#9AA1A9';
          const labelColor = on ? '#FFFFFF' : '#212121';
          // 실행 중 마지막 컬럼 · 앵커는 펄스
          const pulse = on && (isAnchor || (running && p.hop === maxHop));

          return (
            <g
              key={c.uri}
              className="og-node"
              style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity }}
              onClick={() => onSelect?.(c.name)}
              cursor={onSelect ? 'pointer' : undefined}
            >
              <title>{`${c.name} · 관계 ${degreeOf(c.name)}개${p.hop != null ? ` · hop ${p.hop}` : ''}`}</title>

              <g className={on ? 'og-pop' : undefined}>
                {/* 펄스 링 */}
                {pulse && (
                  <path d={hexPath(0, 0, r)} fill="none" stroke={BRAND} strokeWidth={1.6}>
                    <animateTransform attributeName="transform" type="scale" values="1;1.6" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0" dur="1.5s" repeatCount="indefinite" />
                  </path>
                )}
                {/* 헤일로 — 허브·확정 노드가 은은하게 숨쉰다 */}
                {(hub || on) && (
                  <path
                    className="og-halo"
                    d={hexPath(0, 0, r + 8)}
                    fill="none"
                    stroke={on ? BRAND : HUB_LINE}
                    strokeWidth={1 + t * 1.4}
                    style={{ animationDelay: `${(i % 7) * 0.45}s` }}
                  />
                )}
                {isSel && (
                  <path d={hexPath(0, 0, r + 6)} fill="none" stroke={BRAND} strokeWidth={1.4} strokeDasharray="3 3" />
                )}
                {/* 본체 */}
                <path
                  d={hexPath(0, 0, r)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={on || hub ? 1.9 : 1.2}
                  style={on ? { filter: `drop-shadow(0 0 ${5 + Math.round(t * 12)}px ${BRAND}88)` } : undefined}
                />
                {/* 이너 코어 */}
                <path d={hexPath(0, 0, r * 0.44)} fill={on ? '#FFFFFF' : hub ? HUB_LINE : '#C9CDD2'} fillOpacity={on ? 0.34 : 0.28} />
                {/* hop 배지 */}
                {inPath && (
                  <g transform={`translate(${r - 3}, ${-r + 3})`}>
                    <circle r={8} fill={BRAND} stroke="#FFFFFF" strokeWidth={1.4} />
                    <text y={3} textAnchor="middle" fontSize={9} fontWeight={800} fill="#FFFFFF">
                      {p.hop}
                    </text>
                  </g>
                )}
                <text y={3.6} textAnchor="middle" fontSize={11} fontWeight={800} fill={labelColor} style={{ pointerEvents: 'none' }}>
                  {c.name}
                </text>
                <text y={r + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#666666" style={{ pointerEvents: 'none' }}>
                  {c.attrs.length}속성
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
