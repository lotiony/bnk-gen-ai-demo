import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { motion } from "framer-motion";

// ── 그래프 시각화 공용 헬퍼 (Ontology Designer / Mapping Designer / Query 탐색 공유) ──
export const DEFAULT_GROUP = ["#eef0f8", "#5b6478"];   // 그룹 미지정(default) 노드 색 — 범례용
// 노드 색 3분 체계 — 역할 축은 모양(○●▢)이 담당, 색은 계층 정리 상태를 말한다 (Graph Design·Query 공유)
export const HIER_COLOR = "#00BEAC";    // 계층 소속(상위·하위 클래스)
export const INDEP_COLOR = "#7c8cad";   // 독립(계층 미분류) — 다크 배경에서 가라앉지 않는 밝은 회청
export const CORE_COLOR = "#ffc24b";    // 핵심 미분류 — 독립인데 연결이 상위권(분류 정리 후보)
// 그룹 색(hex) → [배경, 테두리/텍스트]. 배경은 같은 색에 알파를 얹어 파생하며,
// t(0~1, degree 정규화)가 클수록 진해진다 — 관계가 많은 노드일수록 색·글로우로 강조(크기는 균일).
// 미지정 기본색 = 앱 teal 액센트(#00BEAC) — 라이트·다크 양쪽에서 또렷.
export const shades = (color, t = 0) => {
  const c = color || "#00BEAC";
  const a = Math.round(0x1c + Math.max(0, Math.min(1, t)) * 0x7e);   // 알파 0x1c(연함) → 0x9a(진함) — 저연결 노드도 가라앉지 않는 하한
  return [c + a.toString(16).padStart(2, "0"), c];
};
export const dispLabel = (s) => (s.length > 12 ? s.slice(0, 11) + "…" : s);
// 관계(엣지) 연결 수 = degree. 많이 연결될수록 진한 색·강한 글로우.
export const degreeMap = (nodes, edges) => {
  const d = Object.fromEntries(nodes.map((nn) => [nn.uri, 0]));
  for (const e of edges) { if (e.domain in d) d[e.domain]++; if (e.range in d) d[e.range]++; }
  return d;
};
export const nodeR = () => 25;   // 노드 반지름 — 전부 동일(연결도는 색 농도·글로우·링 두께로 표현)
// 육각형 패스(포인티-탑, 중심 0,0) — 클래스 노드 공용 모양. r = 외접 반지름.
export const hexPath = (r) => {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    d += `${i ? "L" : "M"}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
};
export const PROP_COLOR = "#9aa6c3";   // 프로퍼티 위성 점 — 무채색(클래스 3색과 경합하지 않게)
// 곡선 엣지 지오메트리 — 직선 대신 진행 방향에 수직으로 살짝 휜 quadratic 곡선.
// d = 경로(흐름 애니메이션·파티클 공용), (mx,my) = 곡선 중앙(라벨 위치).
export const edgeGeom = (s, t, k = 0.08) => {
  const dx = t.x - s.x, dy = t.y - s.y;
  const cx = (s.x + t.x) / 2 - dy * k, cy = (s.y + t.y) / 2 + dx * k;
  return { d: `M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`, mx: (s.x + t.x) / 4 + cx / 2, my: (s.y + t.y) / 4 + cy / 2 };
};
// 줌 1스텝 — 커서/중심 기준, fit 폭 대비 [0.12, 2.6] 범위로 클램프해 과도한 확대/축소 방지
export const zoomView = (v, p, f, fitW) => {
  const base = fitW || v.w;
  const w = Math.max(base * 0.12, Math.min(base * 2.6, v.w * f));
  const k = w / v.w;
  return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k };
};
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 노드 등장 모션(framer-motion) — 스프링 팝 + 인덱스 스태거. reduce 시 즉시 표시.
export const nodePop = (i, reduce) => ({
  initial: reduce ? false : { scale: 0 },
  animate: { scale: 1 },
  transition: { type: "spring", stiffness: 320, damping: 24, delay: Math.min(i * 0.018, 0.45) },
});

// 계층 앵커 깊이 — 상위 클래스(subClassOf 부모)를 0열에, 직계 하위를 부모+1열에 앵커하고,
// 계층 밖 클래스는 관계(무방향) BFS 홉 수로 오른쪽에 전개. 고립 클래스는 맨 오른쪽 열.
// 계층이 하나도 없으면 null 반환 → 기본 flowDepth 로 폴백.
export function hierarchyDepth(nodes, relations, hier) {
  const present = new Set(nodes.map((n) => n.uri));
  const parentOf = {};
  for (const h of hier || []) if (present.has(h.domain) && present.has(h.range)) parentOf[h.domain] = h.range;
  const isParent = new Set(Object.values(parentOf));
  if (!isParent.size) return null;
  const depth = {};
  const dOf = (u, guard = 0) => {   // 계층 트리 깊이 — 뿌리 부모 0, 자식은 부모+1 (사이클 가드)
    if (depth[u] != null) return depth[u];
    if (guard > 30) return (depth[u] = 0);
    if (parentOf[u]) return (depth[u] = dOf(parentOf[u], guard + 1) + 1);
    return (depth[u] = 0);
  };
  for (const u of [...isParent, ...Object.keys(parentOf)]) dOf(u);
  const adj = {};
  nodes.forEach((n) => { adj[n.uri] = []; });
  for (const e of relations) {
    if (e.domain === e.range || !present.has(e.domain) || !present.has(e.range)) continue;
    adj[e.domain].push(e.range); adj[e.range].push(e.domain);
  }
  const q = nodes.filter((n) => depth[n.uri] != null).map((n) => n.uri);
  for (let h = 0; h < q.length; h++) for (const v of adj[q[h]]) if (depth[v] == null) { depth[v] = depth[q[h]] + 1; q.push(v); }
  const maxD = Math.max(0, ...nodes.map((n) => depth[n.uri]).filter((d) => d != null));
  nodes.forEach((n) => { if (depth[n.uri] == null) depth[n.uri] = maxD + 1; });
  return depth;
}

// 좌→우 흐름 깊이 — 루트(유입 0 노드)에서 관계 방향으로 BFS 한 레이어. 사이클·미도달 노드는 0층.
function flowDepth(nodes, edges) {
  const out = {}, indeg = {}, depth = {};
  nodes.forEach((nn) => { out[nn.uri] = []; indeg[nn.uri] = 0; });
  for (const e of edges) {
    if (e.domain === e.range || !(e.domain in out) || !(e.range in out)) continue;
    out[e.domain].push(e.range); indeg[e.range]++;
  }
  const q = nodes.filter((nn) => indeg[nn.uri] === 0).map((nn) => nn.uri);
  if (!q.length && nodes.length) q.push(nodes[0].uri);   // 전부 사이클이면 첫 노드를 루트로
  q.forEach((u) => { depth[u] = 0; });
  for (let h = 0; h < q.length; h++) for (const v of out[q[h]]) if (depth[v] == null) { depth[v] = depth[q[h]] + 1; q.push(v); }
  nodes.forEach((nn) => { if (depth[nn.uri] == null) depth[nn.uri] = 0; });
  return depth;
}

// d3-force 시뮬레이션 구성 — 좌→우로 흘러가는 유기적 배치:
// · forceX 목표 = 흐름 깊이(flowDepth) 열 → 관계 방향을 따라 왼쪽에서 오른쪽으로 전개
// · charge(반발)는 degree 가중 → 허브 간 간격 확대(여백 확보)
// · link 강도는 d3 기본(연결 수 반비례) → 허브는 닻, 잎이 허브로 끌려가 위성처럼 밀집
// · collide → 겹침 해소, forceY 센터링 → 세로로는 가운데 수렴
// 노드에 isProp(속성 위성)·r(개별 반지름) 플래그를 주면 속성 전용 물리가 적용된다:
// 짧고 강한 링크(호스트에 부착) + 약한 반발 — 클래스 곁에 붙되 자리는 스스로 잡는다.
function buildSim(nodes, edges, depthMap, rOf) {
  const n = nodes.length;
  const deg = degreeMap(nodes, edges);
  const depth = depthMap || flowDepth(nodes, edges);   // 계층 앵커 깊이(hierarchyDepth)를 넘기면 그것을 우선
  const maxD = Math.max(0, ...nodes.map((nn) => depth[nn.uri]));
  const LAYER = 460;                                        // 깊이 1층당 가로 간격 — 넓게 벌려 와이드 배치
  const spanY = Math.max(400, Math.sqrt(n) * 90);           // 세로 스팬 축소 — 가로로 긴 와이드 배치
  const span = Math.max(spanY, (maxD + 1) * LAYER);         // charge 거리 상한 기준
  const layerSeq = {};                                      // 층별 순번 — 층 안에서도 가로 부채꼴 전개(와이드 배치)
  const simNodes = nodes.map((nn, i) => {                   // 결정적 초기 배치(깊이 열 + 층내 오프셋) — 같은 데이터면 같은 그림
    const d0 = depth[nn.uri];
    const k = layerSeq[d0] = (layerSeq[d0] || 0) + 1;
    const fan = depthMap && d0 === 0 ? 0 : 95;              // 계층 앵커 모드의 0열(상위 클래스)은 부채꼴 없이 한 열로
    // 계층 앵커 모드에선 부채꼴을 층 간격의 45%로 제한 — 열 순서(좌→우)가 뒤섞이지 않게
    const off = Math.min(Math.floor(k / 2) * fan, depthMap ? LAYER * 0.45 : Infinity);
    const tx = d0 * LAYER + (k % 2 ? 1 : -1) * off;
    // rOf = 노드별 유효 반지름 override — 없으면 노드 자체의 r(속성 위성 등) → 기본 nodeR
    return { id: nn.uri, r: rOf ? rOf(nn.uri) : nn.r || nodeR(deg[nn.uri]), isProp: !!nn.isProp, tx, d0, x: tx + ((i * 53) % 90) - 45, y: (i * 173) % spanY };
  });
  const has = new Set(simNodes.map((s) => s.id));
  const links = edges
    .filter((e) => e.domain !== e.range && has.has(e.domain) && has.has(e.range))
    .map((e) => ({ source: e.domain, target: e.range, kind: e.kind }));
  const lcnt = {};   // d3 기본 링크 강도(1/min(count)) 재현용 — 속성 링크만 강도를 올려 부착 유지
  for (const l of links) { lcnt[l.source] = (lcnt[l.source] || 0) + 1; lcnt[l.target] = (lcnt[l.target] || 0) + 1; }
  // 궤도 힘 — 속성 위성을 호스트 둘레 균등 각도의 목표점으로 강하게 당긴다(균형 잡힌 링, 드래그 시 함께 이동).
  // forceLink 초기화가 source/target 을 노드 객체로 바꾸기 전에 id 기준 위성 목록을 확보해 둔다.
  const byId = new Map(simNodes.map((s) => [s.id, s]));
  const satsOf = {};
  for (const l of links) if (l.kind === "prop") (satsOf[l.source] = satsOf[l.source] || []).push(l.target);
  const orbit = (alpha) => {
    for (const host of Object.keys(satsOf)) {
      const h = byId.get(host), sats = satsOf[host];
      sats.forEach((sid, k) => {
        const s = byId.get(sid);
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / sats.length;
        const R = h.r + s.r + 18;
        const K = 0.55 * alpha;   // 꽤 하드한 부착 — 그래도 충돌·드래그엔 밀리는 물리
        s.vx += (h.x + R * Math.cos(a) - s.x) * K;
        s.vy += (h.y + R * Math.sin(a) - s.y) * K;
      });
    }
  };
  return forceSimulation(simNodes)
    .force("link", forceLink(links).id((d) => d.id)
      .distance((l) => l.source.r + l.target.r + (l.kind === "prop" ? 18 : 120))
      .strength((l) => (l.kind === "prop" ? 0.8 : 1 / Math.min(lcnt[l.source.id] || 1, lcnt[l.target.id] || 1))))
    .force("charge", forceManyBody().strength((d) => (d.isProp ? -60 : -220 * Math.sqrt((deg[d.id] || 0) + 1))).distanceMax(span * 0.55))
    .force("collide", forceCollide((d) => d.r + 16).iterations(2))
    .force("orbit", orbit)
    .force("x", forceX((d) => d.tx).strength((d) => (d.isProp ? 0 : depthMap && d.d0 === 0 ? 0.85 : 0.3)))   // 상위 클래스는 왼쪽 열에 강하게 앵커, 속성은 궤도 힘에 맡김
    .force("y", forceY(spanY / 2).strength((d) => (d.isProp ? 0 : 0.26)))   // 세로 수렴 강화 — 반발력이 가로 방향으로 풀리며 와이드하게 퍼진다
    .stop();
}
const simVB = (simNodes) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of simNodes) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const M = 70;
  return `${minX - M} ${minY - M} ${(maxX - minX) + 2 * M} ${(maxY - minY) + 2 * M}`;
};

// 정적 레이아웃 — 시뮬레이션을 동기 settle 후 좌표만 반환. 반환 계약(pos/idx/vb)은 기존과 동일.
export function forceLayout(nodes, edges) {
  const sim = buildSim(nodes, edges);
  sim.tick(300);
  return {
    pos: sim.nodes().map((p) => ({ x: p.x, y: p.y })),
    idx: Object.fromEntries(nodes.map((nn, i) => [nn.uri, i])),
    vb: simVB(sim.nodes()),
  };
}

// 라이브 시뮬레이션 훅 — 마운트 시 동기 settle(첫 페인트부터 안정된 배치), 드래그가 시작되면
// reheat 되어 연결 노드가 물리적으로 따라 움직인다. 드롭한 노드는 그 자리에 고정(fx/fy 유지).
export function useGraphSim(nodes, edges, depthMap, rOf) {
  const [, setTick] = useState(0);
  const built = useMemo(() => {
    if (!nodes || !nodes.length) return null;
    const sim = buildSim(nodes, edges, depthMap, rOf);
    sim.tick(300);
    return { sim, byId: new Map(sim.nodes().map((p) => [p.id, p])), vb: simVB(sim.nodes()) };
  }, [nodes, edges, depthMap, rOf]);
  useEffect(() => {
    if (!built) return;
    built.sim.on("tick", () => setTick((t) => t + 1));
    return () => { built.sim.on("tick", null); built.sim.stop(); };
  }, [built]);
  return useMemo(() => built && ({
    vb: built.vb,
    P: (uri) => built.byId.get(uri),
    dragStart: (uri) => { const p = built.byId.get(uri); if (!p) return; p.fx = p.x; p.fy = p.y; built.sim.alphaTarget(0.3).restart(); },
    dragMove: (uri, pt) => { const p = built.byId.get(uri); if (p) { p.fx = pt.x; p.fy = pt.y; } },
    dragEnd: () => built.sim.alphaTarget(0),
    // 병합 조준 — 끌던 노드를 충돌력에서 제외(유령화)하고 대상은 제자리에 고정해 밀려나지 않게 한다.
    // aim(null, null) 로 해제하면 원래 물리로 복귀(대상이 원래 사용자가 고정해 둔 노드였다면 고정 유지).
    aim: (ghostUri, pinUri) => {
      if (built.aimGhost !== (ghostUri || null)) {
        const prev = built.aimGhost && built.byId.get(built.aimGhost);
        if (prev) prev.ghost = false;
        const g = ghostUri && built.byId.get(ghostUri);
        if (g) g.ghost = true;
        built.aimGhost = ghostUri || null;
        built.sim.force("collide").radius((d) => (d.ghost ? 0 : d.r + 16));   // 반경 캐시 재계산
      }
      if (built.aimPin !== (pinUri || null)) {
        const prev = built.aimPin && built.byId.get(built.aimPin);
        if (prev && !built.aimPinKeep) { prev.fx = null; prev.fy = null; }
        const p = pinUri && built.byId.get(pinUri);
        if (p) { built.aimPinKeep = p.fx != null; p.fx = p.x; p.fy = p.y; }
        built.aimPin = pinUri || null;
      }
    },
  }), [built]);
}

/**
 * 재사용 그래프 캔버스 — 원형 노드 + 곡선 엣지(흐름 애니메이션) + 팬/줌/드래그 + 클릭 선택.
 * 레이아웃/드래그 물리는 d3-force(useGraphSim), 등장 모션은 framer-motion.
 * props:
 *  - nodes [{uri,label,group}], edges [{domain,range,label,uri}], groups [{id,label,color}]
 *  - selected (uri|null), onSelect(uri|null)
 *  - nodeStatus(uri) -> { color, tag } | { dashed: true } | null
 *    · tag: 노드 아래 소스 태그 필(예: "TB_CUST_MST · 3/6") — color 배경
 *    · dashed: 점선 테두리 + 흐린 채움(미매핑 표시)
 *  - containerStyle (그래프 박스 스타일 override)
 */
export default function OntologyGraph({ nodes, edges = [], groups = [], selected = null, onSelect, nodeStatus, containerStyle }) {
  const [drag, setDrag] = useState(null);
  const [view, setView] = useState(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const movedRef = useRef(false);
  const svgRef = useRef(null);
  const panRef = useRef(null);

  const sim = useGraphSim(nodes, edges);
  useEffect(() => {
    if (sim) { const [x, y, w, h] = sim.vb.split(" ").map(Number); setView({ x, y, w, h }); }
  }, [sim]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); if (!m) return;
      const p = pt.matrixTransform(m.inverse());
      const f = e.deltaY < 0 ? 0.85 : 1.18;
      setView((v) => (v ? { x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f, w: v.w * f, h: v.h * f } : v));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [sim]);
  useEffect(() => {
    const down = (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA/.test(e.target.tagName || "")) { e.preventDefault(); setSpaceDown(true); } };
    const up = (e) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  if (!nodes) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;
  if (!nodes.length || !sim) return <div className="og-canvas" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)", ...containerStyle }}>클래스가 없습니다.</div>;

  const { vb, P } = sim;
  const sel = selected;
  const reduce = prefersReducedMotion();
  const toSvg = (e) => {
    const s = svgRef.current; if (!s) return { x: 0, y: 0 };
    const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = s.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const startPan = (e) => { const r = svgRef.current.getBoundingClientRect(); if (view) panRef.current = { cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y, kx: view.w / r.width, ky: view.h / r.height }; };
  const deg = degreeMap(nodes, edges);
  const clip = (from, to, r) => {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1e-6;
    return { x: to.x - (dx / d) * r, y: to.y - (dy / d) * r };
  };
  const edgeOn = (e) => !sel || e.domain === sel || e.range === sel;
  const nodeDim = (uri) => sel && sel !== uri && !edges.some((e) => (e.domain === sel && e.range === uri) || (e.range === sel && e.domain === uri));
  const maxDeg = Math.max(1, ...nodes.map((nn) => deg[nn.uri] || 0));
  // 색 2분 — 클래스(청록) / 핵심(앰버 — 연결 TOP 5). Graph Design·Query 와 동일 체계.
  const top5 = new Set([...nodes].sort((a, b) => (deg[b.uri] || 0) - (deg[a.uri] || 0)).slice(0, 5).map((nn) => nn.uri));
  const nodeColor = (uri) => (top5.has(uri) ? CORE_COLOR : HIER_COLOR);
  const pick = (uri) => onSelect && onSelect(sel === uri ? null : uri);
  // 엣지 색 = 출발 노드 색 (계층은 중립 회색)
  const eColor = (e) => (e.kind === "hier" ? "#8a93ab" : nodeColor(e.domain));
  const arrColors = [...new Set(edges.map(eColor))];
  const flowOK = !reduce && edges.length <= 160;   // 대형 그래프에선 상시 흐름 애니메이션 생략(성능)

  return (
    <div className="og-canvas" style={containerStyle}>
      <svg ref={svgRef} viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : vb} width="100%" style={{ display: "block", minWidth: 560, height: "100%", cursor: spaceDown ? "grab" : (drag ? "grabbing" : "default") }}
        onClick={() => { if (spaceDown || movedRef.current) { movedRef.current = false; return; } onSelect && onSelect(null); }}
        onMouseDown={(e) => { if (spaceDown) startPan(e); }}
        onMouseMove={(e) => {
          if (panRef.current) { movedRef.current = true; const d = panRef.current; setView((v) => ({ ...v, x: d.vx - (e.clientX - d.cx) * d.kx, y: d.vy - (e.clientY - d.cy) * d.ky })); }
          else if (drag) { movedRef.current = true; sim.dragMove(drag, toSvg(e)); }
        }}
        onMouseUp={() => { if (drag) sim.dragEnd(); setDrag(null); panRef.current = null; }}
        onMouseLeave={() => { if (drag) sim.dragEnd(); setDrag(null); panRef.current = null; }}>
        <defs>
          {arrColors.map((c) => (
            <marker key={c} id={`og-arr-${c.replace("#", "")}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={c} /></marker>
          ))}
          {/* 계층(subClassOf) — 속이 빈 화살촉, 점선과 세트 (온톨로지 Designer 와 동일 표기) */}
          <marker id="og-arr-sub" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L8,4.5 L0,9" fill="none" stroke="#8a93ab" strokeWidth="1.5" /></marker>
        </defs>
        {edges.map((e, i) => {
          const s = P(e.domain), t = P(e.range);
          if (!s || !t) return null;
          const sc = clip(t, s, nodeR(deg[e.domain])), tc = clip(s, t, nodeR(deg[e.range]) + 3);
          const on = edgeOn(e), show = !!sel && on;
          const hier = e.kind === "hier";   // 계층 엣지 — 점선 + 빈 화살촉(child → parent), 흐름 애니메이션 없음
          const col = eColor(e);
          const { d, mx, my } = edgeGeom(sc, tc);
          const lw = (e.label || "").length * 11 + 14;
          const durP = 2.2 + (i % 5) * 0.4;   // 파티클 주기 — 엣지마다 달리해 유기적 흐름
          const nP = show ? 3 : 1;            // 상시 1개, 선택 시 3개
          return (
            <g key={i} className="og-edge" opacity={sel ? (on ? 1 : 0.05) : 0.9}>
              <title>{hier ? "subClassOf" : e.label}</title>
              {!hier && <path d={d} fill="none" stroke={col} strokeOpacity={show ? 0.3 : 0.12} strokeWidth={show ? 7 : 4.5} strokeLinecap="round" />}
              <path d={d} fill="none" stroke={col} strokeOpacity={show ? 0.95 : 0.45} strokeWidth={show ? 2.2 : 1.3}
                strokeDasharray={hier ? "6 5" : undefined}
                markerEnd={hier ? "url(#og-arr-sub)" : show ? `url(#og-arr-${col.replace("#", "")})` : undefined} />
              {!hier && flowOK && (
                <path className="og-flowdash" d={d} fill="none" stroke={col} strokeWidth={show ? 2.6 : 2}
                  strokeDasharray="7 45" strokeLinecap="round" strokeOpacity={show ? 1 : 0.7} />
              )}
              {!hier && flowOK && [...Array(nP)].map((_, k2) => (
                <circle key={k2} r={show ? 3 : 2.3} fill={col} opacity={show ? 1 : 0.9}
                  style={{ filter: `drop-shadow(0 0 5px ${col}) drop-shadow(0 0 10px ${col})` }}>
                  <animateMotion dur={`${durP}s`} begin={`${-(k2 * durP) / nP - (i % 7) * 0.37}s`} repeatCount="indefinite" path={d} />
                </circle>
              ))}
              {show && e.label && (
                <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                  <rect x={mx - lw / 2} y={my - 9} width={lw} height={18} rx={9} fill="#0c1222" fillOpacity="0.92" stroke={col} strokeOpacity="0.55" strokeWidth="1" />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={col}>{e.label}</text>
                </motion.g>
              )}
            </g>
          );
        })}
        {nodes.map((nn, i) => {
          const p = P(nn.uri); if (!p) return null;
          const t = Math.sqrt((deg[nn.uri] || 0) / maxDeg);   // degree 정규화(sqrt) — 농도·글로우·테두리 세기
          const [bg, fg] = shades(nodeColor(nn.uri), t);
          const r = nodeR(deg[nn.uri]), isSel = sel === nn.uri;
          const fs = Math.max(9.5, Math.round(r * 0.34 * 10) / 10);
          const st = nodeStatus ? nodeStatus(nn.uri) : null;
          const glowA = isSel ? "cc" : Math.round(0x2e + t * 0x80).toString(16).padStart(2, "0");
          return (
            <g key={nn.uri} className="og-node" transform={`translate(${p.x} ${p.y})`}
              style={{ cursor: drag === nn.uri ? "grabbing" : "grab" }}
              opacity={nodeDim(nn.uri) ? 0.16 : 1}
              onMouseDown={(ev) => { ev.stopPropagation(); if (spaceDown) { startPan(ev); return; } movedRef.current = false; setDrag(nn.uri); sim.dragStart(nn.uri); }}
              onClick={(ev) => { ev.stopPropagation(); if (spaceDown || movedRef.current) { movedRef.current = false; return; } pick(nn.uri); }}>
              <motion.g {...nodePop(i, reduce)}>
                {isSel && !reduce && (
                  <path d={hexPath(r)} fill="none" stroke={fg} strokeWidth={1.5}>
                    <animateTransform attributeName="transform" type="scale" values="1;1.55" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.55;0" dur="1.5s" repeatCount="indefinite" />
                  </path>
                )}
                <path className="og-halo" d={hexPath(r + 7)} fill="none" stroke={fg} strokeOpacity={isSel ? 0.6 : 0.08 + t * 0.5} strokeWidth={1 + t * 1.2}
                  style={{ animationDelay: `${(i % 7) * 0.45}s` }} />
                {/* 클래스 = 육각형 + 이너 코어 — 미매핑(dashed)은 점선 테두리 + 흐린 채움 유지 */}
                <path className="og-core" d={hexPath(r)} fill={bg} fillOpacity={st?.dashed ? 0.3 : 1} stroke={fg}
                  strokeOpacity={isSel ? 1 : 0.55 + t * 0.45} strokeWidth={isSel ? 2.6 : 1.2 + t * 2} strokeDasharray={st?.dashed ? "5 4" : undefined}
                  style={{ filter: `drop-shadow(0 0 ${isSel ? 16 : 4 + Math.round(t * 14)}px ${fg}${glowA})` }} />
                <path d={hexPath(r * 0.46)} fill={fg} fillOpacity={(st?.dashed ? 0.25 : 0.5) + t * 0.4} style={{ pointerEvents: "none" }} />
                <text className="og-label" y={r + fs + 8} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#e9eef9" opacity={st?.dashed ? 0.5 : 1}>{dispLabel(nn.label || nn.uri)}</text>
                {st?.tag && (() => {
                  const tw = st.tag.length * 6.2 + 14;
                  const ty = r + fs + 14;
                  return (
                    <g>
                      <rect x={-tw / 2} y={ty} width={tw} height={16} rx={8} fill={st.color} />
                      <text y={ty + 11.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{st.tag}</text>
                    </g>
                  );
                })()}
              </motion.g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
