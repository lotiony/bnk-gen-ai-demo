import { REDUCED } from "./bits";

/* 마이크로 시각화 — KPI 타일·표 셀에 들어가는 소형 차트 모음.
   큰 숫자는 "지금 값"만 말한다. 그 옆에 추세(스파크)·여유(게이지)·구성(스택)을 붙여야
   "좋아지는 중인지 / 한계에 얼마나 가까운지 / 무엇으로 이루어졌는지"까지 한 번에 읽힌다.
   전부 실데이터에서 파생되며, 값이 없으면 렌더하지 않고 자리만 비운다(가짜 0선 금지). */

/* 시간대별 호출량 등 시계열 — 면적 채운 스파크라인. 마지막 점만 강조해 '현재'를 표시 */
export function Spark({ data, color = "var(--blue)", h = 22, showLast = true }) {
  const vals = (data || []).filter((v) => typeof v === "number");
  if (!vals.length) return <div style={{ height: h }} />;
  /* 구간이 하나뿐이면 꺾은선을 못 그린다 — 0선을 지어내지 말고 그 구간 막대 하나로 보여준다 */
  if (vals.length === 1) {
    return (
      <div style={{ height: h, display: "flex", alignItems: "flex-end" }}>
        <span style={{ width: "100%", height: Math.max(3, h - 6), borderRadius: 3,
          background: color, opacity: .22, borderBottom: `2px solid ${color}` }} />
      </div>
    );
  }
  const max = Math.max(1, ...vals);
  const W = 100;
  const pt = (v, i) => [(i / (vals.length - 1)) * W, h - 2 - (v / max) * (h - 5)];
  const pts = vals.map(pt);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${W},${h}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
      <polygon points={area} fill={color} opacity=".12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {showLast && <circle cx={lx} cy={ly} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/* 목표 대비 게이지 — 값이 목표를 넘으면 색이 경고로 바뀌고 눈금이 남는다.
   P95 지연처럼 '낮을수록 좋은' 지표에 쓴다(over=true) */
export function Meter({ value, target, over = false, color = "var(--blue)", h = 8 }) {
  if (value == null) return <div style={{ height: h }} />;
  const pct = Math.max(0, Math.min(100, (value / target) * 100));
  const bad = over ? value > target : value < target;
  return (
    <div style={{ position: "relative", height: h, borderRadius: h / 2, background: "var(--main)", overflow: "hidden" }}>
      <span style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: h / 2,
        background: bad ? "var(--amber)" : color, transition: REDUCED ? "none" : "width .9s ease" }} />
      <span style={{ position: "absolute", top: -1, bottom: -1, left: "100%", width: 1.5,
        background: "var(--faint)", transform: "translateX(-1.5px)" }} />
    </div>
  );
}

/* 구성비 스택바 — 메서드 분포처럼 '무엇으로 이루어졌는가'를 한 줄에 */
export function StackBar({ parts, h = 8 }) {
  const list = (parts || []).filter((p) => p.value > 0);
  const total = list.reduce((a, p) => a + p.value, 0);
  if (!total) return <div style={{ height: h }} />;
  return (
    <div style={{ display: "flex", gap: 2, height: h, borderRadius: h / 2, overflow: "hidden" }}>
      {list.map((p) => (
        <span key={p.key} title={`${p.key} ${p.value}`}
          style={{ width: `${(p.value / total) * 100}%`, background: p.color, display: "block" }} />
      ))}
    </div>
  );
}

/* 개수 눈금 — "7개 중 7개 정상"처럼 셀 수 있는 소량 집합. 막대보다 개수가 즉시 읽힌다 */
export function DotScale({ total, filled, color = "var(--green)", h = 8 }) {
  if (!total) return <div style={{ height: h }} />;
  const n = Math.min(total, 12);
  return (
    <div style={{ display: "flex", gap: 3, height: h }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ flex: 1, borderRadius: 2, minWidth: 3,
          background: i < filled ? color : "var(--line2)" }} />
      ))}
    </div>
  );
}

/* 표 셀용 인라인 바 — 숫자 뒤에 깔려 행 간 크기 비교를 눈으로 시킨다 */
export function CellBar({ value, max, color = "var(--blue)" }) {
  if (!max || !value) return null;
  return (
    <span aria-hidden="true" style={{ position: "absolute", left: 6, right: 6, bottom: 4, height: 3,
      borderRadius: 2, background: "var(--line2)", overflow: "hidden" }}>
      <span style={{ display: "block", height: "100%", width: `${(value / max) * 100}%`, background: color, opacity: .55 }} />
    </span>
  );
}
