import { useEffect, useRef, useState } from "react";
import { edgeGeom } from "../../components/OntologyGraph";
import { REDUCED } from "./bits";

/* LiveWire — 관제 데크의 히어로. 호출 경로를 방사형 그래프로 그린다.
   중심 = EmberLink 게이트웨이(원), 좌 반원 = 폐쇄망 레거시 서비스, 우 반원 = 호출 액터(에이전트).
   엣지 위를 흐르는 입자 1개 = 실제 호출. 밀도·속도는 서비스별/액터별 호출 비중에서 파생된다.
   액터는 감사로그의 actor 필드(audit/stats.actors) — 누가 몇 번 불렀는지가 그대로 노드가 된다.

   왜 방사형인가: 좌→우 3단 파이프라인은 N:1:1 이라 레거시가 늘수록 좌측만 세로로 길어진다.
   방사형은 노드가 늘어도 원주 각도만 촘촘해지고, 좌(레거시 N)·우(액터 M)가 같은 규칙으로 자란다.
   허브만 원인 이유: 방사의 중심은 방향성이 없어야 한다 — 판형이면 좌우 축이 생겨 방사와 어긋난다.

   규모 대응: 한쪽이 7개를 넘으면 궤도를 2겹으로 벌려(안/바깥 교대) 카드가 서로 파고들지 않게 한다.
   그래도 부족한 규모를 위해 확대/축소(휠·버튼) · 화면 이동(빈 곳 드래그) · 노드 이동(카드 드래그)을 둔다.
   노드를 옮기면 엣지가 따라오고, 되돌리기는 툴바의 초기화 버튼이 담당한다.

   좌표는 viewBox 기준 — 입자는 SVG <animateMotion path>라 확대/이동에도 경로와 어긋나지 않는다. */

const VB_W = 1240, VB_H = 420;
const HUB = { x: 620, y: 216, r: 66 };
const ORBIT = { rx: 430, ry: 175 };
const INNER = 0.70;          // 2겹 궤도의 안쪽 반경 비율
const CARD = { w: 158, h: 42 };
const PILL = { w: 182, h: 38 };   // 액터명이 길어(playground·hybrid-selector) 이름 영역을 넓혔다
const LOGO = { w: 166, h: 42 };   // ember-logo-*.svg 원본 292×74 비율 유지
const MAX_SIDE = 12;         // 이보다 많으면 2겹으로도 안 되므로 "+N"으로 접는다
const LEFT = [115, 245];
const RIGHT = [-65, 65];
const ZOOM = { min: 0.3, max: 2.6 };   // fit 폭 대비 배율 한계
/* 로고 금지 구역 — 궤도 위쪽(≈245°/-58°)의 안쪽 링 노드가 로고와 겹친다.
   좌측 카드는 더 왼쪽으로, 우측 캡슐은 더 오른쪽으로 밀어 가로로만 비켜준다.
   세로로 밀면 뷰박스 위로 빠져나가므로 x 만 건드린다. */
const LOGO_BOX = {
  x0: HUB.x - LOGO.w / 2 - 10, x1: HUB.x + LOGO.w / 2 + 10,
  y0: HUB.y - HUB.r - 2 - LOGO.h - 8, y1: HUB.y - HUB.r + 4,
};
/* 진영 경계 — 레거시(side -1)는 허브 중심선 오른쪽으로, 액터(side +1)는 왼쪽으로 넘어갈 수 없다.
   방향이 뒤집히면 '레거시 → 게이트웨이 → 에이전트' 라는 그림의 의미 자체가 깨진다. */
function clampSide(x, side, w) {
  return side < 0 ? Math.min(x, HUB.x - w / 2) : Math.max(x, HUB.x + w / 2);
}

const GAP = 9;              // 카드 사이 최소 여백
const RELAX_ITER = 60;

/* 두 상자의 겹침을 '덜 겹친 축'으로만 밀어낸다 — 양축을 동시에 밀면 카드가 대각으로 튄다.
   고정(pinned) 상자는 움직이지 않고, 상대가 밀린 양을 전부 받는다. */
function separate(a, b) {
  if (a.pinned && b.pinned) return false;
  const dx = b.x - a.x, dy = b.y - a.y;
  const ox = (a.w + b.w) / 2 + GAP - Math.abs(dx);
  const oy = (a.h + b.h) / 2 + GAP - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return false;
  const axis = oy < ox ? "y" : "x";
  const amt = axis === "y" ? oy : ox;
  const dir = (axis === "y" ? dy : dx) >= 0 ? 1 : -1;
  const aMove = a.pinned ? 0 : (b.pinned ? amt : amt / 2);
  const bMove = b.pinned ? 0 : (a.pinned ? amt : amt / 2);
  a[axis] -= dir * aMove;
  b[axis] += dir * bMove;
  return true;
}

/* 궤도 기본값에서 시작해 겹침이 사라질 때까지 반복해서 민다.
   허브 원과 로고를 고정 상자로 함께 넣어 카드가 그 위를 덮지 못하게 한다.
   난수를 쓰지 않으므로 같은 입력이면 항상 같은 배치가 나온다. */
function relax(nodes) {
  const fixed = [
    { x: HUB.x, y: HUB.y, w: (HUB.r + 14) * 2, h: (HUB.r + 14) * 2, pinned: true },
    { x: (LOGO_BOX.x0 + LOGO_BOX.x1) / 2, y: (LOGO_BOX.y0 + LOGO_BOX.y1) / 2,
      w: LOGO_BOX.x1 - LOGO_BOX.x0, h: LOGO_BOX.y1 - LOGO_BOX.y0, pinned: true },
  ];
  const all = [...nodes, ...fixed];
  for (let it = 0; it < RELAX_ITER; it++) {
    let hit = false;
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        if (separate(all[a], all[b])) hit = true;
      }
    }
    for (const n of nodes) n.x = clampSide(n.x, n.side, n.w);
    if (!hit) break;
  }
  return nodes;
}


const TONE = {
  ok: "#1faf6b", running: "#00b5a6",
  warn: "#e8841e", partial: "#e8841e",
  down: "#ef5350", stopped: "#ef5350",
  unknown: "#9aa3bd",
};

const SPARK = "M0,-6 C.6,-2.1 2.1,-.6 6,0 C2.1,.6 .6,2.1 0,6 C-.6,2.1 -2.1,-.6 -6,0 C-2.1,-.6 -.6,-2.1 0,-6 Z";

/* 카드 안 텍스트 가용 폭 — 좌측 여백(21) + 우측 배지 지름·간격(36) 을 뺀 나머지 */
const TEXT_W = CARD.w - 21 - 36;
const CJK = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u3000-\u303F\u4E00-\u9FFF]/;
/* 호출수는 네 자리를 넘으면 카드를 밀어낸다 — 1.2k / 34k 로 접는다 */
function compact(n) {
  const v = Number(n) || 0;
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}
/* 한글은 1em, 라틴·숫자는 약 0.6em — 글자 수가 아니라 이 근사 폭으로 잘라야 배지와 안 겹친다 */
function fitText(t, maxPx, fs) {
  let w = 0, out = "";
  for (const ch of String(t)) {
    const cw = CJK.test(ch) ? fs : fs * 0.62;
    if (w + cw > maxPx) return (out.trimEnd() || String(t)[0]) + "\u2026";
    w += cw; out += ch;
  }
  return out;
}

function spread([a0, a1], n, i) {
  const t = n <= 1 ? 0.5 : i / (n - 1);
  return a0 + (a1 - a0) * t;
}
/* 2겹 궤도 — 홀수 인덱스를 안쪽으로 당기면 인접 카드가 각도뿐 아니라 반경으로도 벌어진다 */
function polar(deg, f = 1) {
  const a = (deg * Math.PI) / 180;
  return { x: HUB.x + ORBIT.rx * f * Math.cos(a), y: HUB.y + ORBIT.ry * f * Math.sin(a) };
}

function flowOf(share, total, dead) {
  if (dead) return { count: 1, dur: 9 };
  if (!total) return { count: 1, dur: 7.6 };
  return { count: Math.max(1, Math.min(6, Math.round(1 + share * 6))), dur: +(6.4 - share * 3.8).toFixed(1) };
}

/* 엣지는 카드의 허브쪽 변에서 출발해 원 둘레에 꽂힌다 */
function hubAnchor(p) {
  const dx = p.x - HUB.x, dy = p.y - HUB.y, d = Math.hypot(dx, dy) || 1;
  return { x: HUB.x + (dx / d) * HUB.r, y: HUB.y + (dy / d) * HUB.r };
}

function Particle({ d, dur, begin, tone, stop }) {
  const mo = { dur: `${dur}s`, begin: `${begin}s`, repeatCount: "indefinite", path: d,
    ...(stop ? { keyPoints: "0;0.58", keyTimes: "0;1", calcMode: "linear" } : {}) };
  return (
    <>
      <circle r="6" fill={tone} opacity="0" style={{ filter: "blur(3px)" }}>
        <animateMotion {...mo} />
        <animate attributeName="opacity" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite"
          values="0;.2;.2;0" keyTimes="0;.06;.88;1" />
      </circle>
      <circle r="2.6" fill={tone} opacity="0">
        <animateMotion {...mo} />
        <animate attributeName="opacity" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite"
          values={stop ? "0;.95;.95;0" : "0;1;1;0"} keyTimes={stop ? "0;.12;.72;1" : "0;.06;.88;1"} />
      </circle>
    </>
  );
}

/* 소스 종류 — IR 의 source 접두사(openapi/db/image/code…)를 4종으로 묶는다.
   색만으로는 못 읽으므로 카드 본문에 종류명도 같이 적는다 */
const SRC_KIND = {
  openapi: "api", fastapi: "api", system: "api", runtime: "api", api: "api",
  db: "db",
  image: "rag", doc: "rag", document: "rag", pdf: "rag", rag: "rag",
  code: "code", github: "code",
};
const stroked = (d, w = 1.7) => (
  <g stroke="#fff" strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">{d}</g>
);
const KIND = {
  api: { tone: "#0d7fc4", label: "API", glyph: stroked(<>
    <path d="M-2.1 -6 C-4.5 -6 -3.3 -1.1 -5.5 -1.1 C-3.3 -1.1 -4.5 6 -2.1 6" />
    <path d="M2.1 -6 C4.5 -6 3.3 -1.1 5.5 -1.1 C3.3 -1.1 4.5 6 2.1 6" /></>) },
  db: { tone: "#7a5cff", label: "DB", glyph: stroked(<>
    <ellipse cx="0" cy="-4" rx="5.5" ry="2.3" />
    <path d="M-5.5 -4 V4 A5.5 2.3 0 0 0 5.5 4 V-4" />
    <path d="M-5.5 0 A5.5 2.3 0 0 0 5.5 0" /></>, 1.5) },
  rag: { tone: "#e0489b", label: "RAG", glyph: (
    <g>
      <path d="M-4.6 -6.4 H1.2 L4.8 -2.8 V6.4 H-4.6 Z" fill="#fff" />
      <rect x="-2.6" y="-1.2" width="5.4" height="1.4" rx=".7" fill="#e0489b" />
      <rect x="-2.6" y="2" width="5.4" height="1.4" rx=".7" fill="#e0489b" />
    </g>) },
  code: { tone: "#f0910d", label: "코드", glyph: stroked(<>
    <path d="M-2.1 -5.6 L-6.3 0 L-2.1 5.6" /><path d="M2.1 -5.6 L6.3 0 L2.1 5.6" /></>, 1.9) },
};
/* 서비스에 묶인 리소스들의 최빈 종류 — 한 서비스가 여러 원천에서 올 수 있다 */
function kindOf(server) {
  const c = {};
  for (const r of server.resources || []) {
    const k = SRC_KIND[String(r.source || "").split(":")[0].toLowerCase()] || "api";
    c[k] = (c[k] || 0) + 1;
  }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return KIND[top ? top[0] : "api"];
}

/* 툴바 글리프 */
const ico = (d) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/* 액터별 호출 추이 — audit/stats 는 액터 합계만 주고 시계열은 주지 않는다.
   감사 로그 원본(ts·actor)에서 5분 × 12칸 = 최근 60분으로 직접 접는다.
   시간 단위로 접으면 시연처럼 짧은 구간에 몰린 호출이 한 칸으로 뭉쳐 추이가 안 보인다. */
const SLOTS = 12;
/* 창 사다리 — 기록이 잡히는 가장 좁은 창을 고른다.
   시연 직전 호출이 없어도 예전 기록이 있으면 그 구간으로 넓혀 실제 곡선을 보여준다.
   비어 있는 60분 창에 0선을 그리는 건 데이터를 지어내는 것과 같아 하지 않는다. */
const H = 3600 * 1000;
const WINDOWS = [
  { ms: H, ko: "최근 60분", en: "last 60 min" },
  { ms: 3 * H, ko: "최근 3시간", en: "last 3h" },
  { ms: 6 * H, ko: "최근 6시간", en: "last 6h" },
  { ms: 12 * H, ko: "최근 12시간", en: "last 12h" },
  { ms: 24 * H, ko: "최근 24시간", en: "last 24h" },
];
function actorTrend(entries, actor, now) {
  const ts = [];
  for (const e of entries || []) {
    if (e.actor !== actor || !("ok" in e)) continue;
    const t = Date.parse(e.ts);
    if (!Number.isNaN(t)) ts.push(t);
  }
  if (!ts.length) return null;
  const win = WINDOWS.find((w) => ts.some((t) => now - t <= w.ms)) || WINDOWS[WINDOWS.length - 1];
  const slot = win.ms / SLOTS;
  const data = new Array(SLOTS).fill(0);
  for (const t of ts) {
    const idx = SLOTS - 1 - Math.floor((now - t) / slot);
    if (idx >= 0 && idx < SLOTS) data[idx] += 1;
  }
  return { data, win };
}
function topTools(entries, actor, n = 5) {
  const c = new Map();
  for (const e of entries || []) {
    if (e.actor !== actor || !e.tool_id) continue;
    c.set(e.tool_id, (c.get(e.tool_id) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/* 폴리라인 하나짜리 미니 차트 — 값이 전부 0이면 선을 긋지 않고 안내만 남긴다 */
function TrendChart({ data }) {
  const max = Math.max(1, ...data);
  const W = 100, H = 46;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - 3 - (v / max) * (H - 8)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg className="lw-p-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polygon points={`0,${H} ${line} ${W},${H}`} fill="var(--blue)" opacity=".12" />
      <polyline points={line} fill="none" stroke="var(--blue)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => data[i] > 0 && (
        <circle key={i} cx={x} cy={y} r="1.6" fill="var(--blue)" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/* 우측 상세 패널 — 그래프에서 고른 노드 하나를 깊게 본다.
   레거시: 그 서비스가 서빙 중인 MCP 툴 목록. 에이전트: 그 액터의 호출 추이와 많이 부른 툴. */
function SidePanel({ sel, lanes, outs, servers, audit, ko, go }) {
  if (!sel) {
    return (
      <aside className="lw-panel lw-panel--empty">
        <div className="lw-p-hint">
          {ko ? "카드를 클릭하면 상세가 열립니다" : "click a node for details"}
          <em>{ko ? "레거시 → 툴 목록 · 에이전트 → 호출 추이" : "legacy \u2192 tools \u00b7 agent \u2192 trend"}</em>
        </div>
      </aside>
    );
  }

  if (sel.kind === "svc") {
    const lane = lanes.find((l) => l.key === sel.key);
    const srv = servers.find((x) => (x.service || "") === sel.key);
    const tools = (srv?.resources || []).slice().sort((a, b) => (b.calls || 0) - (a.calls || 0));
    return (
      <aside className="lw-panel">
        <div className="lw-p-head">
          <span className="lw-p-kind" style={{ background: lane?.kind.tone }}>{lane?.kind.label}</span>
          <b>{sel.key}</b>
        </div>
        <div className="lw-p-sub">
          {ko ? "툴" : "tools"} <i>{srv?.tools ?? 0}</i> · {ko ? "호출" : "calls"} <i>{(srv?.calls ?? 0).toLocaleString()}</i>
        </div>
        <div className="lw-p-list">
          {tools.length === 0 && <div className="lw-p-empty">{ko ? "등록된 툴이 없습니다" : "no tools"}</div>}
          {tools.map((t) => (
            <div key={t.resource_id} className="lw-p-row">
              <span className={`lw-p-m lw-p-m--${(t.method || "get").toLowerCase()}`}>{t.method}</span>
              <span className="lw-p-name" title={t.summary || t.name}>{t.name}</span>
              <span className="lw-p-n">{(t.calls || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <button className="lw-p-cta" onClick={() => go?.("explorer", { service: sel.key })}>
          {ko ? "MCP 탐색에서 열기" : "Open in Explorer"} →
        </button>
      </aside>
    );
  }

  const out = outs.find((o) => o.key === sel.key);
  /* 시각은 렌더 시점 기준 — 폴링마다 갱신되므로 창이 따라 움직인다 */
  const trend = actorTrend(audit, sel.key, Date.now());
  const tops = topTools(audit, sel.key);
  return (
    <aside className="lw-panel">
      <div className="lw-p-head">
        <span className="lw-p-kind" style={{ background: "#00b5a6" }}>{ko ? "에이전트" : "AGENT"}</span>
        <b>{sel.key}</b>
      </div>
      <div className="lw-p-sub">
        {ko ? "호출 \u00b7 24h" : "calls \u00b7 24h"} <i>{(out?.calls ?? 0).toLocaleString()}</i>
      </div>
      <div className="lw-p-cap">{trend ? (ko ? trend.win.ko : trend.win.en) : ""} {ko ? "추이" : "trend"}</div>
      {trend
        ? <TrendChart data={trend.data} />
        : <div className="lw-p-empty">{ko ? "호출 기록 없음" : "no records"}</div>}
      <div className="lw-p-cap">{ko ? "많이 부른 툴" : "top tools"}</div>
      <div className="lw-p-list">
        {tops.length === 0 && <div className="lw-p-empty">{ko ? "기록 없음" : "no records"}</div>}
        {tops.map(([tool, n]) => (
          <div key={tool} className="lw-p-row">
            <span className="lw-p-name" title={tool}>{tool}</span>
            <span className="lw-p-n">{n.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function LiveWire({ servers, astats, audit, toolCount, ko, go, booted }) {
  const svgRef = useRef(null);
  const panRef = useRef(null);
  const downRef = useRef(null);          // 눌린 화면 좌표 — 클릭(선택)과 드래그(배치)를 거리로 가른다
  const [view, setView] = useState(null); // null = 기본 fit
  const [pos, setPos] = useState({});     // 사용자가 옮긴 노드 좌표
  const [drag, setDrag] = useState(null);
  const [sel, setSel] = useState(null);   // {kind:'svc'|'act', key} — 우측 상세 패널 대상
  const autoSel = useRef(false);         // 자동 선택은 최초 1회만 — 사용자가 해제하면 되살리지 않는다

  const V = view || { x: 0, y: 0, w: VB_W, h: VB_H };

  /* 데이터가 처음 도착하면 최다 호출 액터를 자동 선택한다.
     시연에서 대시보드를 열자마자 우측 패널이 채워져 있어야 설명 없이도 읽힌다. */
  useEffect(() => {
    if (autoSel.current) return;
    const top = astats?.actors?.[0];
    if (!top?.actor) return;
    autoSel.current = true;
    setSel({ kind: "act", key: top.actor });
  }, [astats]);

  const toSvg = (e) => {
    const s = svgRef.current;
    if (!s) return { x: 0, y: 0 };
    const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = s.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };

  /* 휠 확대/축소 — 커서 위치를 고정점으로 둔다. passive:false 라야 페이지 스크롤을 막을 수 있다 */
  useEffect(() => {
    const s = svgRef.current;
    if (!s) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;   // 맨휠은 페이지 스크롤 — 가로채지 않는다
      e.preventDefault();
      const p = toSvg(e);
      const f = e.deltaY < 0 ? 0.85 : 1.18;
      setView((v) => {
        const cur = v || { x: 0, y: 0, w: VB_W, h: VB_H };
        const w = Math.max(VB_W * ZOOM.min, Math.min(VB_W * ZOOM.max, cur.w * f));
        const k = w / cur.w;
        return { x: p.x - (p.x - cur.x) * k, y: p.y - (p.y - cur.y) * k, w, h: cur.h * k };
      });
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f) => setView((v) => {
    const cur = v || { x: 0, y: 0, w: VB_W, h: VB_H };
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    const w = Math.max(VB_W * ZOOM.min, Math.min(VB_W * ZOOM.max, cur.w * f));
    const h = cur.h * (w / cur.w);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  });
  const reset = () => { setView(null); setPos({}); };

  const startPan = (e) => {
    setSel(null);
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    panRef.current = { cx: e.clientX, cy: e.clientY, vx: V.x, vy: V.y, kx: V.w / r.width, ky: V.h / r.height };
    setDrag({ pan: true });
  };
  const startNode = (e, key) => {
    e.stopPropagation();
    downRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ key });
  };
  /* 누른 곳에서 5px 이내로 뗐으면 클릭(선택), 그 이상이면 배치로 본다.
     'move 이벤트가 왔는가'로 판정하면 drag state 가 비동기라 제자리 클릭도 드래그로 오인된다 */
  const isTap = (e) => {
    const d = downRef.current;
    return !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5;
  };
  const onMove = (e) => {
    if (!drag) return;
    if (drag.pan) {
      const p = panRef.current;
      if (!p) return;
      setView({ x: p.vx - (e.clientX - p.cx) * p.kx, y: p.vy - (e.clientY - p.cy) * p.ky, w: V.w, h: V.h });
    } else if (drag.key) {
      const pt = toSvg(e);
      setPos((m) => ({ ...m, [drag.key]: { x: pt.x, y: pt.y } }));
    }
  };
  const endDrag = () => { setDrag(null); panRef.current = null; };

  const all = servers || [];
  const svc = all.slice(0, MAX_SIDE);
  const svcHidden = all.length - svc.length;
  const svcTotal = svc.reduce((a, s) => a + (s.calls || 0), 0);

  const actorsRaw = astats?.actors || [];
  const actors = actorsRaw.length ? actorsRaw.slice(0, MAX_SIDE)
    : [{ actor: ko ? "에이전트" : "agent", calls: 0, idle: true }];
  const actorHidden = Math.max(0, actorsRaw.length - actors.length);
  const actTotal = actors.reduce((a, x) => a + (x.calls || 0), 0);

  const calls = astats?.calls || 0;
  const okRate = astats?.ok_rate;
  const live = calls > 0;
  const upCount = all.filter((s) => s.legacy_state === "ok").length;

  /* 배치 — 궤도 기본값에서 시작해 겹침을 푼다.
     사용자가 끌어둔 카드는 고정 앵커가 되고, 나머지가 그 주위로 비켜난다. */
  const seed = (key, span, n, i, box, side) => {
    const at = pos[key] || polar(spread(span, n, i), n > 4 && i % 2 ? INNER : 1);
    /* 끌고 있는 동안만 고정 — 커서를 그대로 따라간다.
       놓는 순간 고정이 풀려 겹침 해소에 참여하므로, 로고·허브·다른 카드 위에는 남을 수 없다.
       진영 경계는 여기서 가두므로 드래그 중에도 반대편으로 넘어가지 않고 경계를 따라 미끄러진다. */
    return { key, x: clampSide(at.x, side, box.w), y: at.y, w: box.w, h: box.h, side,
      pinned: drag?.key === key };
  };
  const seeds = relax([
    ...svc.map((s2, i) => seed(s2.service || `svc-${i}`, LEFT, svc.length, i, CARD, -1)),
    ...actors.map((a, i) => seed(a.actor || `act-${i}`, RIGHT, actors.length, i, PILL, 1)),
  ]);
  const P = new Map(seeds.map((n) => [n.key, { x: n.x, y: n.y }]));

  const lanes = svc.map((s, i) => {
    const key = s.service || `svc-${i}`;
    const p = P.get(key);
    const legacy = s.legacy_state || "unknown";
    const dead = legacy === "down" || (s.mcp_state || "stopped") === "stopped";
    const share = svcTotal ? (s.calls || 0) / svcTotal : 0;
    const from = p.x < HUB.x ? { x: p.x + CARD.w / 2, y: p.y } : { x: p.x - CARD.w / 2, y: p.y };
    return { key, name: s.service || (ko ? "미분류" : "unclassified"),
      p, tone: TONE[legacy] || TONE.unknown, kind: kindOf(s), share, dead, errRate: s.error_rate || 0,
      tools: s.tools || 0, calls: s.calls || 0,
      ...flowOf(share, svcTotal, dead),
      geom: edgeGeom(from, hubAnchor(p), 0.05) };
  });

  const outs = actors.map((a, i) => {
    const key = a.actor || `act-${i}`;
    const p = P.get(key);
    const share = actTotal ? (a.calls || 0) / actTotal : 0;
    const to = p.x > HUB.x ? { x: p.x - PILL.w / 2, y: p.y } : { x: p.x + PILL.w / 2, y: p.y };
    return { key, name: a.actor || "?", calls: a.calls || 0, p, share, idle: !!a.idle,
      ...flowOf(share, actTotal, false),
      geom: edgeGeom(hubAnchor(p), to, 0.05) };
  });

  const zoomPct = Math.round((VB_W / V.w) * 100);

  return (
    <section className="lw" aria-label={ko ? "호출 경로 관제" : "Call path monitor"}>
      <div className="lw-head">
        <span className="lw-tick" />
        <b>{ko ? "호출 경로" : "CALL PATH"}</b>
        <span className="lw-sub">
          {ko ? "레거시 · 게이트웨이 · 에이전트 · 입자 1개 = 호출 1건"
              : "legacy · gateway · agents · one particle = one call"}
        </span>
        <div className="lw-tools">
          <button onClick={() => zoomBy(1.25)} title={ko ? "축소" : "Zoom out"} aria-label={ko ? "축소" : "Zoom out"}>
            {ico(<path d="M5 12h14" />)}
          </button>
          <span className="lw-zoom">{zoomPct}%</span>
          <button onClick={() => zoomBy(0.8)} title={ko ? "확대" : "Zoom in"} aria-label={ko ? "확대" : "Zoom in"}>
            {ico(<><path d="M12 5v14" /><path d="M5 12h14" /></>)}
          </button>
          <button onClick={reset} title={ko ? "배치 초기화" : "Reset"} aria-label={ko ? "배치 초기화" : "Reset"}>
            {ico(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>)}
          </button>
        </div>
        <span className={live ? "lw-live" : "lw-live lw-live--idle"}>
          <i />{live ? "LIVE" : (ko ? "대기" : "STANDBY")}
        </span>
      </div>

      <div className="lw-body">
      <svg ref={svgRef} className={drag ? "lw-svg lw-svg--drag" : "lw-svg"}
        viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`} preserveAspectRatio="xMidYMid meet"
        onPointerDown={startPan} onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag}
        role="img">
        <defs>
          <radialGradient id="lw-halo">
            <stop offset="0%" stopColor="var(--purple)" stopOpacity=".32" />
            <stop offset="45%" stopColor="var(--purple)" stopOpacity=".12" />
            <stop offset="100%" stopColor="var(--purple)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lw-core" cx="35%" cy="28%">
            <stop offset="0%" stopColor="#25d3c2" />
            <stop offset="100%" stopColor="var(--blue-d)" />
          </radialGradient>
        </defs>

        <ellipse className="lw-halo" pointerEvents="none" cx={HUB.x} cy={HUB.y} rx="190" ry="160" fill="url(#lw-halo)" />

        {[...lanes, ...outs].map((e) => (
          <path key={`e-${e.key}`} d={e.geom.d} className="lw-path"
            style={{ strokeWidth: 1.2 + e.share * 2.4 }} />
        ))}

        {/* 드래그 중에는 입자를 멈춘다 — 경로가 매 프레임 바뀌면 SMIL이 재시작되어 깜빡인다 */}
        {!REDUCED && !drag && lanes.map((l) => (
          <g key={`f-${l.key}`}>
            {Array.from({ length: l.count }, (_, k) => (
              <Particle key={k} d={l.geom.d} dur={l.dur} begin={+((k * l.dur) / l.count).toFixed(2)} tone="#00b5a6" />
            ))}
            {l.errRate > 0 && (
              <Particle d={l.geom.d} dur={Math.max(3, l.dur * 0.9)} begin={+(l.dur * 0.45).toFixed(2)}
                tone="#ef5350" stop />
            )}
          </g>
        ))}
        {!REDUCED && !drag && outs.map((o, oi) => (
          <g key={`fo-${o.key}`}>
            {Array.from({ length: o.count }, (_, k) => (
              <Particle key={k} d={o.geom.d} dur={o.dur}
                begin={+((k * o.dur) / o.count + oi * 0.4).toFixed(2)} tone="#00b5a6" />
            ))}
          </g>
        ))}

        {/* 폐쇄망 레거시 — 각진 카드 + 우측 역할 배지 */}
        {lanes.map((l) => {
          const x = l.p.x - CARD.w / 2, y = l.p.y - CARD.h / 2;
          return (
            <g key={`n-${l.key}`} className="lw-node lw-node--tap"
              onPointerDown={(e) => startNode(e, l.key)}
              onClick={(e) => { if (isTap(e)) setSel({ kind: "svc", key: l.key }); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setSel({ kind: "svc", key: l.key }); }}>
              <rect className={sel?.kind === "svc" && sel.key === l.key ? "lw-card lw-card--sel" : "lw-card"}
                x={x} y={y} width={CARD.w} height={CARD.h} rx="10" />
              <circle cx={x + 12} cy={y + 15} r="3.4" fill={l.tone} />
              <text className="lw-cname" x={x + 21} y={y + 19}>{fitText(l.name, TEXT_W, 12.5)}</text>
              <text className="lw-cmeta" x={x + 21} y={y + 32}>
                {ko ? "\uD234" : "tools"}<tspan className="lw-cnum" dx="4">{compact(l.tools)}</tspan>
                <tspan className="lw-cdot" dx="7">·</tspan>
                <tspan dx="7">{ko ? "\uD638\uCD9C" : "calls"}</tspan>
                <tspan className="lw-cnum" dx="4">{compact(l.calls)}</tspan>
              </text>
              <circle cx={x + CARD.w - 19} cy={y + CARD.h / 2} r="12.5" fill={l.kind.tone}>
                <title>{l.kind.label}</title>
              </circle>
              <g transform={`translate(${x + CARD.w - 19} ${y + CARD.h / 2})`}>{l.kind.glyph}</g>
            </g>
          );
        })}

        {/* 호출 액터 — 캡슐 + 좌측 원형 아이콘. 라벨 색이 곧 활성 상태 */}
        {outs.map((o) => {
          const x = o.p.x - PILL.w / 2, y = o.p.y - PILL.h / 2;
          const tone = o.idle ? "#9aa3bd" : "#00b5a6";
          return (
            <g key={`a-${o.key}`} className={o.idle ? "lw-node lw-pill lw-pill--idle" : "lw-node lw-pill"}
              onPointerDown={(e) => startNode(e, o.key)}
              onClick={(e) => { if (isTap(e) && !o.idle) setSel({ kind: "act", key: o.key }); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" && !o.idle) setSel({ kind: "act", key: o.key }); }}>
              <rect x={x} y={y} width={PILL.w} height={PILL.h} rx={PILL.h / 2} />
              <circle cx={x + PILL.h / 2} cy={o.p.y} r={PILL.h / 2 - 6} fill={tone} />
              <g transform={`translate(${x + PILL.h / 2} ${o.p.y})`}><path d={SPARK} fill="#fff" /></g>
              <text className="lw-pname" x={x + PILL.h + 3} y={o.p.y + 4} fill={tone}>
                {fitText(o.name, PILL.w - PILL.h - 46, 12.5)}
              </text>
              <text className="lw-pcount" x={x + PILL.w - 13} y={o.p.y + 4}>
                {o.idle ? (ko ? "\uB300\uAE30" : "idle") : compact(o.calls)}
              </text>
            </g>
          );
        })}

        {/* 게이트웨이 — 방사의 중심이라 방향성 없는 원. 타이틀은 브랜드 로고 자산 */}
        <g className="lw-hub" pointerEvents="none">
          <image className="ember-logo-light" href="/ember-logo-light.svg"
            x={HUB.x - LOGO.w / 2} y={HUB.y - HUB.r - 2 - LOGO.h} width={LOGO.w} height={LOGO.h} />
          <image className="ember-logo-dark" href="/ember-logo-dark.svg"
            x={HUB.x - LOGO.w / 2} y={HUB.y - HUB.r - 2 - LOGO.h} width={LOGO.w} height={LOGO.h} />
          <circle cx={HUB.x} cy={HUB.y} r={HUB.r + 11} className="lw-hub-ring" />
          <circle cx={HUB.x} cy={HUB.y} r={HUB.r} fill="url(#lw-core)" />
          <text className="lw-hub-num" x={HUB.x} y={HUB.y - 1}>{toolCount ?? "—"}</text>
          <text className="lw-hub-sub" x={HUB.x} y={HUB.y + 23}>MCP TOOLS</text>
        </g>
      </svg>

      <SidePanel sel={sel} lanes={lanes} outs={outs} servers={all} audit={audit} ko={ko} go={go} />
      </div>

      <div className="lw-foot">
        <span>{ko ? "레거시 정상" : "legacy up"} <b>{upCount}/{all.length}</b>
          {svcHidden > 0 && <em className="lw-foot-more"> +{svcHidden}</em>}</span>
        <span>{ko ? "호출 에이전트" : "agents"} <b>{actorsRaw.length || 0}</b>
          {actorHidden > 0 && <em className="lw-foot-more"> +{actorHidden}</em>}</span>
        <span>{ko ? "호출 · 24h" : "calls · 24h"} <b>{calls.toLocaleString()}</b></span>
        <span>{ko ? "성공률" : "success"} <b>{okRate != null ? `${(okRate * 100).toFixed(1)}%` : "—"}</b></span>
        <span className="lw-foot-dim">
          {!booted ? (ko ? "불러오는 중…" : "loading…")
            : !all.length ? (ko ? "소스를 등록하면 그래프가 그려집니다" : "register a source to draw the graph")
            : (ko ? "⌘/Ctrl+휠 확대 · 드래그 이동 · 카드 끌어 배치" : "\u2318/Ctrl+wheel zoom · drag to pan · drag cards")}
        </span>
      </div>
    </section>
  );
}
