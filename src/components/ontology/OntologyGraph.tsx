/**
 * 온톨로지 그래프 — 인라인 SVG 직접 렌더.
 *
 * 라이브러리를 쓰지 않는 이유: 오프라인 단일 HTML 제약(CLAUDE.md) 아래에서
 * 물리 시뮬레이션은 이득이 없다. 노드 좌표를 데이터에 고정해 두면
 * 시연 때마다 같은 그림이 나오고(리허설 = 본 시연), 번들도 늘지 않는다.
 *
 * 시각 규칙 (docs/design.md 톤 + 레퍼런스 패턴):
 *  · 육각형 = 클래스 / 작은 원 = 데이터 속성(클래스에 위성으로 부착)
 *  · 허브(연결 TOP 5)는 채움 강조, 나머지는 외곽선
 *  · 점등(highlight) = 질의 순회에서 선택된 경로 / 그 외는 흐리게
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CLASSES, RELATIONS, HUB_CLASSES, degreeOf, type OntologyClass } from '@/data/ontology';

const COL_W = 168;
const ROW_H = 96;
const PAD_X = 76;
const PAD_Y = 60;

/** 육각형 꼭짓점 경로. */
function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function pos(c: OntologyClass) {
  return { x: PAD_X + c.col * COL_W, y: PAD_Y + c.row * ROW_H };
}

export interface OntologyGraphProps {
  /** 점등할 클래스명. 비어 있으면 전체를 평상 상태로 그린다. */
  activeClasses?: string[];
  /** 점등할 관계 URI. */
  activeRelations?: string[];
  /** 속성 위성 표시 여부. */
  showAttrs?: boolean;
  /** 클래스 클릭 콜백. */
  onSelect?: (name: string) => void;
  /** 선택된 클래스 (상세 패널과 연동). */
  selected?: string | null;
  className?: string;
}

export default function OntologyGraph({
  activeClasses = [],
  activeRelations = [],
  showAttrs = true,
  onSelect,
  selected = null,
  className,
}: OntologyGraphProps) {
  const dimming = activeClasses.length > 0;
  const activeSet = useMemo(() => new Set(activeClasses), [activeClasses]);
  const relSet = useMemo(() => new Set(activeRelations), [activeRelations]);

  const maxCol = Math.max(...CLASSES.map((c) => c.col));
  const maxRow = Math.max(...CLASSES.map((c) => c.row));
  const w = PAD_X * 2 + maxCol * COL_W;
  const h = PAD_Y * 2 + maxRow * ROW_H;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('w-full h-full', className)}
      role="img"
      aria-label="온톨로지 그래프"
    >
      {/* ── 관계(엣지) ── */}
      <g>
        {RELATIONS.map((r) => {
          const a = CLASSES.find((c) => c.name === r.domain);
          const b = CLASSES.find((c) => c.name === r.range);
          if (!a || !b) return null;
          const p1 = pos(a);
          const p2 = pos(b);
          const on = relSet.has(r.uri);
          // 완만한 곡선 — 직선이 겹쳐 보이는 걸 피한다
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2 - Math.abs(p2.y - p1.y) * 0.18 - 14;
          return (
            <path
              key={r.uri}
              d={`M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`}
              fill="none"
              stroke={on ? '#CB2C10' : '#C9CDD2'}
              strokeWidth={on ? 2.2 : 1}
              opacity={dimming && !on ? 0.18 : on ? 1 : 0.55}
            />
          );
        })}
      </g>

      {/* ── 속성 위성 ── */}
      {showAttrs && (
        <g>
          {CLASSES.map((c) => {
            const p = pos(c);
            const on = activeSet.has(c.name);
            return c.attrs.slice(0, 6).map((a, i) => {
              const ang = (Math.PI * 2 * i) / Math.max(6, c.attrs.length) - Math.PI / 2;
              const rr = 40;
              const ax = p.x + rr * Math.cos(ang);
              const ay = p.y + rr * Math.sin(ang);
              return (
                <g key={`${c.uri}-${a}`} opacity={dimming && !on ? 0.14 : 0.85}>
                  <line x1={p.x} y1={p.y} x2={ax} y2={ay} stroke="#D9DDE2" strokeWidth={0.8} />
                  <circle cx={ax} cy={ay} r={3.4} fill="#FFFFFF" stroke="#B9BFC6" strokeWidth={0.9} />
                </g>
              );
            });
          })}
        </g>
      )}

      {/* ── 클래스(육각형) ── */}
      <g>
        {CLASSES.map((c) => {
          const p = pos(c);
          const hub = HUB_CLASSES.includes(c.name);
          const on = activeSet.has(c.name);
          const isSel = selected === c.name;
          const dim = dimming && !on;
          const deg = degreeOf(c.name);
          const r = 17 + Math.min(deg, 6) * 1.1;

          const fill = on ? '#CB2C10' : hub ? '#FBE9E6' : '#FFFFFF';
          const stroke = on ? '#A82410' : hub ? '#CB2C10' : '#9AA1A9';
          const label = on ? '#FFFFFF' : '#212121';

          return (
            <g
              key={c.uri}
              opacity={dim ? 0.2 : 1}
              onClick={() => onSelect?.(c.name)}
              className={onSelect ? 'cursor-pointer' : undefined}
            >
              {isSel && (
                <path d={hexPath(p.x, p.y, r + 6)} fill="none" stroke="#CB2C10" strokeWidth={1.4} strokeDasharray="3 3" />
              )}
              <path d={hexPath(p.x, p.y, r)} fill={fill} stroke={stroke} strokeWidth={on || hub ? 1.8 : 1.2} />
              <text
                x={p.x}
                y={p.y + 3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={800}
                fill={label}
                style={{ pointerEvents: 'none' }}
              >
                {c.name}
              </text>
              <text
                x={p.x}
                y={p.y + r + 13}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill="#666666"
                style={{ pointerEvents: 'none' }}
              >
                {c.attrs.length}속성
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
