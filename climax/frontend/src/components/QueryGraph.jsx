import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { forceSimulation, forceLink, forceCollide, forceX, forceY } from "d3-force";
import { motion } from "framer-motion";
import { shades, dispLabel, degreeMap, nodeR, useGraphSim, nodePop, edgeGeom, prefersReducedMotion, zoomView, hierarchyDepth, HIER_COLOR, CORE_COLOR, hexPath, PROP_COLOR } from "./OntologyGraph";

// Query 탐색 그래프 — 두 모드를 한 SVG 좌표계에서 morph:
//  · 기본(idle): Graph Design(Designer)과 동일한 온톨로지 전경 — 육각형 클래스 + 속성 위성 원(궤도 물리)
//  · 순회(traverse): 클래스(상위)가 좌→우로 재배치되고, 각 클래스에서 소속 인스턴스(하위·구체 값)가
//    펼침 링크로 이어져 펼쳐진다. 쿼리에 적합한(강조) 개체가 선택되고, 그 개체에서 다음 클래스로
//    진행 엣지가 이어진다 — 고객 ⤵ 김민준(선택) → 증권 ⤵ P001(선택) → … 상·하위가 한 줄기.
//    미방문 클래스·스키마 엣지·속성 위성은 배경으로 페이드. 순회 모드에서도 노드 드래그·팬·줌 가능.
// 편집 기능 없음 — Graph Design 의 시각 언어(색 2분: 청록 클래스/앰버 핵심)만 그대로 상속한다.

const PR = 12.5;   // 속성(위성 원) 반지름 — Graph Design 과 동일(클래스 25의 절반)

const TSRC_LABEL = { db: "정형DB", doc: "문서 인스턴스", concept: "개념" };
// 결정적 지터 — id 해시 기반 ±amp. 같은 데이터면 같은 그림(재현성).
const jit = (id, salt, amp) => {
  let h = 0;
  for (const ch of id + salt) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h / 997 - 0.5) * 2 * amp;
};
const RESULT_COL = "…result";   // type 없는 노드(질의 결과 등)의 의사 컬럼 키

// 순회 레이아웃 — 컬럼 = 순회한 온톨로지 클래스(강조 인스턴스의 클래스 우선, 최대 8) 좌→우.
// 각 컬럼: 클래스 노드가 위, 그 아래로 소속 개체가 스택 — 순회에 등장한 개체 + 같은 클래스의
// 다른 후보(candidates)를 함께 펼쳐 '후보들 중에서 선택됐다'를 표현한다. 상한 초과는 "+N개".
function traverseLayout(insts, tEdges, anchor, classByUri, clsColor, candidates) {
  const keyOf = (n) => (n && n.type) || RESULT_COL;
  const MAXCOLS = 8, CAP = 5;
  const DLM = 170, CTOP = 100, COLW = 290, IY0 = CTOP + 165, IROWH = 100;
  const nodeById = Object.fromEntries(insts.map((n) => [n.id, n]));
  // 방문 클래스 집계 — 강조(focus·앵커) 인스턴스가 있는 클래스 우선, 그 최소 hop 순.
  // 컬럼은 '의도(intent) 단위로 오른쪽에 이어 붙는다' — 멀티인텐트에서 의도 2 의 앵커는 자기 기준
  // depth 0 이라, 의도 없이 hop 만으로 정렬하면 나중 의도의 컬럼이 왼쪽에 끼어들어 앞 의도 컬럼을
  // 통째로 밀어낸다. 그래서 ① 컬럼의 의도 = 멤버 중 가장 이른 의도, ② hop 정렬 키는 '그 의도의
  // 멤버만'으로 계산한다. 뒤 의도가 기존 컬럼에 노드를 더해도 앞 컬럼의 정렬 키가 변하지 않아
  // 이미 그려진 자리가 그대로 유지된다.
  const intentOf = (n) => n.intent || 0;
  const per = new Map();
  insts.forEach((n, i) => {
    const k = keyOf(n);
    const c = per.get(k) || { key: k, intent: Infinity, first: i, members: [] };
    c.intent = Math.min(c.intent, intentOf(n));
    c.members.push(n);
    per.set(k, c);
  });
  for (const c of per.values()) {
    c.minDepth = Infinity; c.focDepth = Infinity;
    for (const n of c.members) {
      if (intentOf(n) !== c.intent) continue;   // 뒤 의도가 합류해도 이 컬럼의 자리는 안 흔들리게
      c.minDepth = Math.min(c.minDepth, n.depth);
      if (n.focus || n.id === anchor) c.focDepth = Math.min(c.focDepth, n.depth);
    }
  }
  const all = [...per.values()], focused = all.filter((c) => c.focDepth < Infinity);
  const ordered = (focused.length ? focused : all)
    .sort((a, b) => (a.intent - b.intent) || (a.focDepth - b.focDepth) || (a.minDepth - b.minDepth) || (a.first - b.first));
  // 컬럼 상한을 의도별로 나눠 준다 — 앞 의도가 넓으면 뒤 의도가 통째로 잘려 보이지 않기 때문.
  // 각 의도가 할당량만큼 먼저 자리를 잡고, 남는 슬롯을 정렬 순서대로 채운다(좌→우 순서는 유지).
  const nIntents = new Set(ordered.map((c) => c.intent)).size;
  let cols;
  if (nIntents > 1 && ordered.length > MAXCOLS) {
    const quota = Math.max(1, Math.floor(MAXCOLS / nIntents));
    const taken = new Map(), head = [], rest = [];
    for (const c of ordered) {
      const t = taken.get(c.intent) || 0;
      if (t < quota) { taken.set(c.intent, t + 1); head.push(c); } else rest.push(c);
    }
    const keep = new Set(head.concat(rest).slice(0, MAXCOLS));
    cols = ordered.filter((c) => keep.has(c));
  } else {
    cols = ordered.slice(0, MAXCOLS);
  }
  const pos = {}, hiddenMarks = [], shownIds = new Set();
  let maxRows = 1;
  cols.forEach((c, ci) => {
    const cls = classByUri[c.key];
    c.label = cls?.label || (c.key === RESULT_COL ? "질의 결과" : c.key.split(":").pop());
    c.color = clsColor(cls?.uri);   // 클래스(청록)/핵심(앰버 — 연결 TOP 5) — Graph Design 과 동일 체계
    c.uri = cls?.uri || null;
    c.x = DLM + ci * COLW; c.y = CTOP;
    // 앵커 → 강조 → hop 순으로 정렬해 앞에서 자르면 강조 우선 표시가 유지된다
    const ms = [...c.members].sort((a, b) =>
      a.id === anchor ? -1 : b.id === anchor ? 1 : (((b.focus ? 1 : 0) - (a.focus ? 1 : 0)) || (a.depth - b.depth)));
    c.shown = ms.slice(0, CAP);
    // 하위 후보 펼침 — 순회에 등장하지 않은 같은 클래스의 다른 개체를 흐린 후보로 함께 나열.
    // 라벨 기준 누적 dedupe — 같은 라벨의 행(예: 정션 행)이 여러 개여도 후보는 한 번만.
    const cd = candidates?.[c.key];
    const have = new Set(c.shown.flatMap((n) => [n.id, n.label]));
    const extras = [];
    for (const s0 of cd?.samples || []) {
      if (extras.length >= Math.max(0, CAP - c.shown.length)) break;
      if (have.has(s0.id) || have.has(s0.label)) continue;
      have.add(s0.id); have.add(s0.label);
      extras.push({ id: `cand:${s0.id}`, label: s0.label, type: c.key === RESULT_COL ? "" : c.key, depth: null, source: s0.source, focus: false, cand: true, attrs: {} });
    }
    c.shown = c.shown.concat(extras);
    extras.forEach((n) => { nodeById[n.id] = n; });
    const totalN = Math.max(cd?.total || 0, ms.length);
    c.hidden = totalN - c.shown.length;
    c.ids = new Set(c.shown.map((n) => n.id));
    c.shown.forEach((n, ri) => {
      pos[n.id] = { x: c.x + (ri % 2 ? 24 : -24) + jit(n.id, "x", 16), y: IY0 + ri * IROWH + jit(n.id, "y", 10), col: ci, row: ri };
      shownIds.add(n.id);
    });
    maxRows = Math.max(maxRows, c.shown.length);
    if (c.hidden > 0) hiddenMarks.push({ x: c.x, y: IY0 + c.shown.length * IROWH - 30, n: c.hidden });
  });
  const colKeys = new Set(cols.map((c) => c.key));
  const omitted = insts.filter((n) => !colKeys.has(keyOf(n))).length;   // 경로 밖(표시 컬럼에 없는 클래스) 노드 수
  // ── 순회 엣지 — 표시 노드 사이만, 같은 쌍 중복 제거(양방향 관계가 이중선이 되지 않게) ──
  const seenPair = new Set();
  const edges = (tEdges || []).filter((e) => {
    if (!shownIds.has(e.s) || !shownIds.has(e.o)) return false;
    const k = [e.s, e.o].sort().join("→");
    if (seenPair.has(k)) return false;
    seenPair.add(k);
    return true;
  });
  // ── 진행 엣지 — 각 컬럼에서 '선택된(강조)' 개체가 다음 클래스를 여는 연결.
  //    실제 순회 엣지에서 차용: 출발·도착 모두 강조 > 출발 강조 > 아무 엣지. 없으면 클래스끼리 점선 폴백.
  const advance = [];
  for (let i = 0; i + 1 < cols.length; i++) {
    const A = cols[i], B = cols[i + 1];
    const cand = (tEdges || []).filter((e) => A.ids.has(e.s) && B.ids.has(e.o));
    const best = cand.find((e) => nodeById[e.s]?.focus && nodeById[e.o]?.focus)
      || cand.find((e) => nodeById[e.s]?.focus) || cand[0];
    advance.push(best ? { from: best.s, b: B, rel: best.rel } : { fromCls: A, b: B, rel: null });
  }
  const W = DLM + (cols.length - 1) * COLW + 200, H = IY0 + (maxRows - 1) * IROWH + 160;
  return { cols, pos, edges, advance, hiddenMarks, nodeById, keyOf, omitted, vb: `0 0 ${W} ${H}` };
}

// 순회 모드 라이브 시뮬레이션 — 평상시엔 레이아웃 좌표(tx,ty)에 정지, 드래그 시 가열되어
// 펼침 링크·순회 엣지로 연결된 노드가 물리적으로 딸려온다(기본 상태 useGraphSim 과 같은 감각).
// 앵커 힘(forceX/Y → 목표 좌표)이 컬럼 구조를 유지하고, 드롭한 노드는 그 자리에 고정(fx/fy).
function useTravSim(trav) {
  const [, setTick] = useState(0);
  const keep = useRef(new Map());   // id → {x,y,fx,fy} — 스트리밍 재구축 간 위치·고정 유지
  const built = useMemo(() => {
    if (!trav) { keep.current.clear(); return null; }
    const nodes = [];
    trav.cols.forEach((c) => {
      nodes.push({ id: "cls:" + c.key, tx: c.x, ty: c.y, r: 52 });
      c.shown.forEach((n) => { const p = trav.pos[n.id]; nodes.push({ id: n.id, tx: p.x, ty: p.y, r: 26 }); });
    });
    nodes.forEach((sn) => {
      const pp = keep.current.get(sn.id);
      sn.x = pp ? pp.x : sn.tx; sn.y = pp ? pp.y : sn.ty;
      if (pp?.fx != null) { sn.fx = pp.fx; sn.fy = pp.fy; }
    });
    const has = new Set(nodes.map((n) => n.id));
    const links = [];
    trav.cols.forEach((c) => c.shown.forEach((n) => links.push({ source: "cls:" + c.key, target: n.id })));
    trav.edges.forEach((e) => links.push({ source: e.s, target: e.o }));
    trav.advance.forEach((ad) => { if (ad.from) links.push({ source: ad.from, target: "cls:" + ad.b.key }); });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ok = links.filter((l) => has.has(l.source) && has.has(l.target));
    ok.forEach((l) => {   // 링크 안정 길이 = 목표 좌표 간 거리 — 정지 상태에서 장력 0
      const a = byId.get(l.source), b = byId.get(l.target);
      l.dist = Math.max(40, Math.hypot(a.tx - b.tx, a.ty - b.ty));
    });
    const sim = forceSimulation(nodes)
      .force("link", forceLink(ok).id((d) => d.id).distance((l) => l.dist).strength(0.28))
      .force("x", forceX((d) => d.tx).strength(0.32))
      .force("y", forceY((d) => d.ty).strength(0.32))
      .force("collide", forceCollide((d) => d.r).iterations(1))
      .stop();   // 평시 정지 — 드래그가 시작될 때만 가열
    return { sim, byId };
  }, [trav]);
  useEffect(() => {
    if (!built) return;
    built.sim.on("tick", () => {
      built.sim.nodes().forEach((n) => keep.current.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy }));
      setTick((t) => t + 1);
    });
    return () => { built.sim.on("tick", null); built.sim.stop(); };
  }, [built]);
  return useMemo(() => built && ({
    P: (id) => built.byId.get(id),
    dragStart: (id) => { const p = built.byId.get(id); if (!p) return; p.fx = p.x; p.fy = p.y; built.sim.alphaTarget(0.3).restart(); },
    dragMove: (id, pt) => { const p = built.byId.get(id); if (p) { p.fx = pt.x; p.fy = pt.y; } },
    dragEnd: () => built.sim.alphaTarget(0),
  }), [built]);
}

export default function QueryGraph({ classes, relations = [], hier = [], dataProps = [], candidates = {}, traversal = null, anchor = null, running = false, fill = false }) {
  const [sel, setSel] = useState(null);      // 클릭한 인스턴스(상세 카드)
  const [drag, setDrag] = useState(null);    // 드래그 중 id — idle: 클래스 uri(sim), traverse: 인스턴스 id | "cls:키"
  const [view, setView] = useState(null);    // 현재 viewBox — 팬/줌/모드 전환 tween 공용
  const [spaceDown, setSpaceDown] = useState(false);
  const [full, setFull] = useState(false);   // 전체화면 — body 로 포털해 화면 전체를 캔버스로 사용
  const movedRef = useRef(false);
  const svgRef = useRef(null);
  const panRef = useRef(null);
  const viewRef = useRef(null);
  viewRef.current = view;
  const fitRef = useRef(null);
  const followRef = useRef(true);   // true = viewBox 가 목표(fit)를 추적 — 사용자 팬/줌 시 해제
  const reduce = prefersReducedMotion();

  const allEdges = useMemo(() => relations.concat(hier), [relations, hier]);
  // 계층 앵커 깊이 — 상위 클래스가 0열(맨 왼쪽), 하위가 그 옆, 나머지는 관계 홉 수로 오른쪽 전개.
  // 속성은 호스트 클래스와 같은 열을 목표로 (Graph Design 동일)
  const depthMap = useMemo(() => {
    const base = classes && classes.length ? hierarchyDepth(classes, relations, hier) : null;
    if (!base) return null;
    const d = { ...base };
    for (const p of dataProps) if (d[p.domain] != null) d[p.uri] = d[p.domain];
    return d;
  }, [classes, relations, hier, dataProps]);
  // 클래스 색 2분 — 클래스(청록) / 핵심(앰버 — 연결 TOP 5) (Graph Design 동일)
  const clsColor = useMemo(() => {
    if (!classes || !classes.length) return () => HIER_COLOR;
    const deg0 = degreeMap(classes, allEdges);
    const top = new Set([...classes].sort((a, b) => (deg0[b.uri] || 0) - (deg0[a.uri] || 0)).slice(0, 5).map((c) => c.uri));
    return (uri) => (top.has(uri) ? CORE_COLOR : HIER_COLOR);
  }, [classes, allEdges]);
  // 속성도 시뮬 노드로 편입 — 클래스에 짧은 링크(kind:"prop")로 부착, 궤도 힘으로 둘레 균등 배치 (Graph Design 동일)
  const simNodes = useMemo(() => {
    if (!classes || !classes.length) return null;
    const present = new Set(classes.map((c) => c.uri));
    return classes.concat(dataProps.filter((p) => present.has(p.domain)).map((p) => ({ uri: p.uri, label: p.label, isProp: true, r: PR })));
  }, [classes, dataProps]);
  const simEdges = useMemo(() => {
    const present = new Set((classes || []).map((c) => c.uri));
    return allEdges.concat(dataProps.filter((p) => present.has(p.domain)).map((p) => ({ domain: p.domain, range: p.uri, kind: "prop" })));
  }, [classes, allEdges, dataProps]);
  const sim = useGraphSim(simNodes, simEdges, depthMap);

  const classByUri = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.uri, c])), [classes]);
  const trav = useMemo(
    () => (traversal?.nodes?.length ? traverseLayout(traversal.nodes, traversal.edges, anchor, classByUri, clsColor, candidates) : null),
    [traversal, anchor, classByUri, clsColor, candidates]
  );
  const tsim = useTravSim(trav);   // 순회 모드 라이브 물리 — 드래그 시 연결 노드가 함께 딸려온다
  useEffect(() => { if (!trav) setSel(null); }, [trav]);

  // viewBox 추적 — 목표(fit)가 바뀌면(모드 전환·컬럼 증가) 추적을 켜고, 상시 rAF 루프가 매 프레임
  // 목표로 수렴한다. 일회성 tween 과 달리 스트리밍 중 취소돼도 다음 프레임에 이어져 중간에 멈추지 않는다.
  const targetVB = trav ? trav.vb : sim?.vb;
  fitRef.current = targetVB ? targetVB.split(" ").map(Number) : null;   // [x, y, w, h] — 추적 목표·줌 클램프·화면 맞춤 기준
  useEffect(() => {
    followRef.current = true;
    // 탭이 백그라운드면 rAF 가 정지되므로 즉시 목표로 — 돌아왔을 때 그래프가 엉뚱한 배율에 있지 않게
    if (typeof document !== "undefined" && document.hidden && fitRef.current) {
      const t = fitRef.current;
      setView({ x: t[0], y: t[1], w: t[2], h: t[3] });
      followRef.current = false;
    }
  }, [targetVB]);
  useEffect(() => {
    let raf;
    const step = () => {
      raf = requestAnimationFrame(step);
      const t = fitRef.current;
      if (!followRef.current || !t) return;
      setView((v) => {
        if (!v || prefersReducedMotion() || document.hidden) { followRef.current = false; return { x: t[0], y: t[1], w: t[2], h: t[3] }; }
        const k = 0.16;
        const nx = v.x + (t[0] - v.x) * k, ny = v.y + (t[1] - v.y) * k, nw = v.w + (t[2] - v.w) * k, nh = v.h + (t[3] - v.h) * k;
        if (Math.abs(nw - t[2]) < 1 && Math.abs(nx - t[0]) < 1 && Math.abs(ny - t[1]) < 1) { followRef.current = false; return { x: t[0], y: t[1], w: t[2], h: t[3] }; }
        return { x: nx, y: ny, w: nw, h: nh };
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {   // ⌘/Ctrl+휠·핀치 = 연속 줌(커서 기준, deltaY 비례) — 일반 휠은 페이지 스크롤 유지
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); if (!m) return;
      const p = pt.matrixTransform(m.inverse());
      const f = Math.exp(Math.max(-24, Math.min(24, e.deltaY)) * 0.006);   // 노치당 ≈±15%, 트랙패드는 미세 연속
      followRef.current = false;
      setView((v) => (v ? zoomView(v, p, f, fitRef.current?.[2]) : v));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [sim, trav, full]);   // full 전환 시 SVG 노드가 새로 마운트되므로 리스너 재부착
  useEffect(() => {   // 전체화면 — Esc 로 닫기, 뒤 페이지 스크롤 잠금
    if (!full) return;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [full]);
  useEffect(() => { followRef.current = true; }, [full]);   // 넓어진/좁아진 영역에 맞춰 다시 화면 맞춤
  useEffect(() => {   // 스페이스바 홀드 = 노드 위에서도 팬
    const down = (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA/.test(e.target.tagName || "")) { e.preventDefault(); setSpaceDown(true); } };
    const up = (e) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  if (!classes) {
    // 그래프 로딩 — shimmer 스켈레톤 바 + '불러오는 중' 애니메이션(흩어진 노드 없음)
    return (
      <div className="og-canvas" style={{ position: "relative", overflow: "hidden", height: fill ? "100%" : 470, minHeight: 300,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <style>{`
          @keyframes gshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
          @keyframes gdot{0%,80%,100%{opacity:.3}40%{opacity:1}}
          .gskel{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(53,208,165,.16) 50%,rgba(255,255,255,.04) 75%);
            background-size:200% 100%;animation:gshimmer 1.4s ease-in-out infinite;border-radius:8px}
        `}</style>
        <div style={{ width: "58%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 13 }}>
          {[100, 82, 92, 68, 88].map((w, i) => (
            <div key={i} className="gskel" style={{ width: w + "%", height: 13, animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#8b96b4", fontSize: 13, fontWeight: 600 }}>
          <span>온톨로지 그래프를 불러오는 중</span>
          <span style={{ display: "inline-flex", gap: 3 }}>
            {[0, 1, 2].map((i) => <i key={i} style={{ width: 5, height: 5, borderRadius: 99, background: "#35D0A5", display: "block", animation: `gdot 1.1s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }} />)}
          </span>
        </div>
      </div>
    );
  }
  if (!classes.length && !trav)
    return <div className="og-canvas" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>온톨로지 클래스가 없습니다 — Design 단계에서 먼저 생성하세요.</div>;

  const P = sim?.P || (() => null);
  const deg = degreeMap(classes, allEdges);
  const maxDeg = Math.max(1, ...classes.map((c) => deg[c.uri] || 0));
  const clip = (from, to, r) => {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1e-6;
    return { x: to.x - (dx / d) * r, y: to.y - (dy / d) * r };
  };
  const eColor = (e) => clsColor(e.domain);   // 엣지 색 = 출발 클래스의 색(청록/앰버 핵심)
  const arrColors = [...new Set(relations.map(eColor).concat((trav?.cols || []).map((c) => c.color)))];
  const flowOK = !reduce && relations.length <= 160;
  const morph = reduce ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 26 };
  const toSvg = (e) => {
    const s = svgRef.current; if (!s) return { x: 0, y: 0 };
    const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = s.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const startPan = (e) => { followRef.current = false; const r = svgRef.current.getBoundingClientRect(); if (view) panRef.current = { cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y, kx: view.w / r.width, ky: view.h / r.height }; };
  const zoomStep = (f) => { followRef.current = false; setView((v) => (v ? zoomView(v, { x: v.x + v.w / 2, y: v.y + v.h / 2 }, f, fitRef.current?.[2]) : v)); };
  const fitScreen = () => { followRef.current = true; };   // 상시 루프가 fit 목표로 부드럽게 복귀

  // 순회 모드 위치 — 라이브 시뮬레이션 좌표 우선(드래그·물리 반영). tp=인스턴스, cpos=클래스 컬럼.
  const tp = (id) => { const p = trav?.pos[id]; if (!p) return null; const s = tsim?.P(id); return s ? { ...p, x: s.x, y: s.y } : p; };
  const cpos = (c) => { const s = tsim?.P("cls:" + c.key); return s ? { x: s.x, y: s.y } : { x: c.x, y: c.y }; };
  const instR = (n) => (n?.id === anchor ? 22 : n?.focus ? 18 : n?.cand ? 12 : 14);
  // 클래스 노드의 현재 목표 위치 — 순회 중 방문 클래스는 컬럼(+드래그), 나머지는 제자리에서 페이드
  const visited = new Map((trav?.cols || []).filter((c) => c.uri).map((c) => [c.uri, c]));
  const clsTarget = (uri) => {
    const v = visited.get(uri);
    if (v) { const p = cpos(v); return { x: p.x, y: p.y, on: true, key: v.key }; }
    const p = P(uri);
    return { x: p?.x ?? 0, y: p?.y ?? 0, on: !trav, key: null };
  };
  // 인스턴스 색 = 소속 클래스의 색(청록/앰버 핵심) — Graph Design 과 동일한 색 체계 상속
  const instColor = (n) => clsColor(n?.type);
  const anchorCol = trav?.cols?.[0];
  const lastCol = trav?.cols?.[trav.cols.length - 1];
  const selNode = sel && trav?.nodeById?.[sel];
  const selCls = selNode && (classByUri[selNode.type]?.label || (selNode.type || "").split(":").pop() || "질의 결과");
  const selColor = selNode && instColor(selNode);
  // 순회 노드 공통 드래그 시작 — 클래스는 "cls:키", 인스턴스는 id. 시뮬레이션을 가열해 물리 시작.
  const travDragStart = (ev, id) => {
    ev.stopPropagation();
    if (spaceDown) { startPan(ev); return; }
    movedRef.current = false;
    setDrag(id);
    tsim?.dragStart(id);
  };
  const ctrlBtn = { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #232b41", borderRadius: 8, background: "#0c1222d9", color: "#8b96b4", fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: 1 };
  const tall = fill || full;   // 남는 높이를 SVG 가 모두 차지 — 컨테이너 채움 또는 전체화면

  const canvas = (
    <div className="og-canvas" style={{ padding: "10px 8px 6px", marginBottom: tall ? 0 : 12, position: full ? "fixed" : "relative",
      ...(full ? { inset: 0, zIndex: 200, width: "100%", borderRadius: 0, border: "none" } : {}),
      ...(tall ? { height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" } : {}) }}>
      <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#8b96b4", padding: "0 10px 8px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {trav ? (
          <span>온톨로지 순회 — 클래스의 하위 개체들이 펼쳐지고 그중 선택된 개체가 다음 클래스로 진행 · 점선=미선택 후보 · 클릭=상세 · 배지=hop{trav.omitted > 0 && <span style={{ color: "#5a6684" }}> · 경로 밖 {trav.omitted}개 생략</span>}{running && <span style={{ color: "#35D0A5" }}> · 진행 중…</span>}</span>
        ) : (
          <span>온톨로지 그래프 — <b style={{ color: "#e9eef9" }}>{classes.length}</b> classes · <b style={{ color: "#e9eef9" }}>{relations.length}</b> relationships · 질문을 실행하면 앵커부터 순회 경로가 펼쳐집니다</span>
        )}
        <span style={{ fontWeight: 500, color: "#5a6684" }}>배경 드래그=이동 · ⌘/Ctrl+휠=줌</span>
        {/* 범례 — Graph Design 과 동일 체계 (⬡ 육각형 클래스 · 앰버 핵심 · 속성 위성 원) */}
        <span title="온톨로지 클래스 — 육각형 노드" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
          <svg width="12" height="12" viewBox="-8.5 -8.5 17 17" style={{ display: "block" }}><path d={hexPath(7)} fill={HIER_COLOR + "55"} stroke={HIER_COLOR} strokeWidth="2" /></svg>클래스
        </span>
        <span title="관계(엣지) 수 상위 5개 클래스 — 앰버 강조" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
          <svg width="12" height="12" viewBox="-8.5 -8.5 17 17" style={{ display: "block" }}><path d={hexPath(7)} fill={CORE_COLOR + "33"} stroke={CORE_COLOR} strokeWidth="2" /></svg>핵심 (연결 TOP 5)
        </span>
        <span title="클래스의 data 속성 — 클래스 주위 위성 원" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
          <i style={{ width: 9, height: 9, borderRadius: 99, background: PROP_COLOR + "24", border: `1.5px solid ${PROP_COLOR}` }} />속성
        </span>
      </div>
      {/* 줌 컨트롤 — 확대/축소/화면 맞춤 (중심 기준 25% 스텝) + 전체화면 토글 */}
      <div style={{ position: "absolute", top: 40, right: 16, display: "flex", flexDirection: "column", gap: 6, zIndex: 2 }}>
        <button style={ctrlBtn} title="확대" onClick={() => zoomStep(0.8)}>＋</button>
        <button style={ctrlBtn} title="축소" onClick={() => zoomStep(1.25)}>−</button>
        <button style={{ ...ctrlBtn, fontSize: 12 }} title="화면 맞춤" onClick={fitScreen}>⛶</button>
        <button style={{ ...ctrlBtn, fontSize: 13, ...(full ? { color: "#35D0A5", borderColor: "#35D0A566" } : {}) }}
          title={full ? "전체화면 닫기 (Esc)" : "전체화면으로 크게 보기"}
          onClick={() => setFull((f) => !f)}>{full ? "⤡" : "⤢"}</button>
      </div>
      <svg ref={svgRef} viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : (targetVB || "0 0 800 400")} width="100%"
        style={{ display: "block", minWidth: tall ? 0 : 560, cursor: drag ? "grabbing" : "grab",
          ...(tall ? { flex: 1, minHeight: 0, height: "auto" } : { height: 470 }) }}
        onMouseDown={(e) => startPan(e)}
        onMouseMove={(e) => {
          if (panRef.current) { movedRef.current = true; const d = panRef.current; setView((v) => ({ ...v, x: d.vx - (e.clientX - d.cx) * d.kx, y: d.vy - (e.clientY - d.cy) * d.ky })); }
          else if (drag) {
            movedRef.current = true;
            if (trav) tsim?.dragMove(drag, toSvg(e));
            else sim?.dragMove(drag, toSvg(e));
          }
        }}
        onMouseUp={() => { if (drag) (trav ? tsim : sim)?.dragEnd(); setDrag(null); panRef.current = null; }}
        onMouseLeave={() => { if (drag) (trav ? tsim : sim)?.dragEnd(); setDrag(null); panRef.current = null; }}>
        <defs>
          {arrColors.map((c) => (
            <marker key={c} id={`qg-arr-${c.replace("#", "")}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={c} /></marker>
          ))}
        </defs>

        {/* ── 기본 스키마 엣지 — Designer 와 동일(곡선 + 흐름 파티클), 순회 중엔 페이드아웃 ── */}
        <motion.g animate={{ opacity: trav ? 0 : 1 }} transition={{ duration: reduce ? 0 : 0.4 }} style={{ pointerEvents: "none" }}>
          {sim && relations.map((e, i) => {
            const s = P(e.domain), t = P(e.range);
            if (!s || !t) return null;
            const sc = clip(t, s, nodeR(deg[e.domain])), tc = clip(s, t, nodeR(deg[e.range]) + 3);
            const col = eColor(e);
            const { d } = edgeGeom(sc, tc);
            const durP = 2.2 + (i % 5) * 0.4;
            return (
              <g key={i} className="og-edge" opacity={0.9}>
                <title>{e.label}</title>
                <path d={d} fill="none" stroke={col} strokeOpacity={0.12} strokeWidth={4.5} strokeLinecap="round" />
                <path d={d} fill="none" stroke={col} strokeOpacity={0.45} strokeWidth={1.3} />
                {flowOK && !trav && (
                  <path className="og-flowdash" d={d} fill="none" stroke={col} strokeWidth={2} strokeDasharray="7 45" strokeLinecap="round" strokeOpacity={0.7} />
                )}
                {flowOK && !trav && (
                  <circle r={2.3} fill={col} opacity={0.9} style={{ filter: `drop-shadow(0 0 5px ${col}) drop-shadow(0 0 10px ${col})` }}>
                    <animateMotion dur={`${durP}s`} begin={`${-(i % 7) * 0.37}s`} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            );
          })}
        </motion.g>

        {/* ── 속성 위성 — 클래스 둘레 궤도 원(Graph Design 동일), 순회 중엔 페이드아웃 ── */}
        <motion.g animate={{ opacity: trav ? 0 : 1 }} transition={{ duration: reduce ? 0 : 0.4 }} style={{ pointerEvents: trav ? "none" : "auto" }}>
          {sim && dataProps.map((pp) => {
            const p = sim.P(pp.uri), hp = sim.P(pp.domain);
            if (!p || !hp) return null;
            return (
              <g key={pp.uri} className="og-node" style={{ cursor: drag === pp.uri ? "grabbing" : "grab" }}
                onMouseDown={(ev) => { if (trav) return; ev.stopPropagation(); if (spaceDown) { startPan(ev); return; } movedRef.current = false; setDrag(pp.uri); sim.dragStart(pp.uri); }}>
                <title>{`${pp.label}${pp.range ? ` : ${String(pp.range).split(":").pop()}` : ""} — data 속성`}</title>
                <line x1={hp.x} y1={hp.y} x2={p.x} y2={p.y} stroke={PROP_COLOR} strokeOpacity={0.3} strokeWidth={1.1} />
                <circle cx={p.x} cy={p.y} r={PR} fill={PROP_COLOR + "24"} stroke={PROP_COLOR} strokeOpacity={0.6} strokeWidth={1.2} />
                <text x={p.x} y={p.y + PR + 11} textAnchor="middle" fontSize="9" fontWeight="700" fill="#c6d0e8" opacity={0.85} style={{ pointerEvents: "none" }}>{dispLabel(pp.label)}</text>
              </g>
            );
          })}
        </motion.g>

        {/* ── 펼침 링크 — 클래스(상위) → 소속 개체(하위): 강조 개체는 선명, 나머지는 점선 ── */}
        {trav && trav.cols.flatMap((c) => c.shown.map((n) => {
          const p = tp(n.id), cp0 = cpos(c);
          if (!p) return null;
          const foc = n.focus || n.id === anchor;
          const midY = (cp0.y + p.y) / 2;
          const d = `M ${cp0.x} ${cp0.y} C ${cp0.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y - instR(n) - 5}`;
          const delay = reduce ? 0 : Math.min(p.col * 0.1 + p.row * 0.04, 0.55);
          return (
            <motion.path key={`f${n.id}`} d={d} fill="none" stroke={c.color}
              strokeWidth={foc ? 1.5 : 1} strokeDasharray={foc ? undefined : "2 5"} strokeOpacity={foc ? 0.55 : 0.22}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay, ease: "easeOut" }} />
          );
        }))}

        {/* ── 진행 엣지 — 선택된 개체 → 다음 클래스 (rel 라벨 + 파티클): 하위에서 고른 개체가 다음 순회를 연다 ── */}
        {trav && trav.advance.map((ad, i) => {
          const pb = cpos(ad.b);
          const rb = ad.b.uri ? nodeR(deg[ad.b.uri] || 0) : 34;
          const fromN = ad.from ? trav.nodeById[ad.from] : null;
          const src = ad.from ? tp(ad.from) : cpos(ad.fromCls);
          if (!src) return null;
          const sr = ad.from ? instR(fromN) : (ad.fromCls?.uri ? nodeR(deg[ad.fromCls.uri] || 0) : 34);
          const sc = clip(pb, src, sr + 4), tc = clip(src, pb, rb + 10);
          const { d, mx, my } = edgeGeom(sc, tc, 0.12);
          const col = ad.b.color;
          const lw = (ad.rel || "").length * 11 + 14;
          const fallback = !ad.from;   // 두 컬럼을 잇는 실제 엣지가 없을 때 — 클래스끼리 약한 점선
          return (
            <g key={`ad${i}`}>
              {!fallback && <path d={d} fill="none" stroke={col} strokeOpacity={0.25} strokeWidth={7} strokeLinecap="round" />}
              <motion.path d={d} fill="none" stroke={col} strokeOpacity={fallback ? 0.4 : 0.95} strokeWidth={fallback ? 1.4 : 2.2}
                strokeDasharray={fallback ? "6 5" : undefined} markerEnd={`url(#qg-arr-${col.replace("#", "")})`}
                initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: reduce ? 0 : 0.3, ease: "easeOut" }} />
              {!fallback && !reduce && [0, 1].map((k) => (
                <circle key={k} r={3} fill={col} style={{ filter: `drop-shadow(0 0 5px ${col}) drop-shadow(0 0 10px ${col})` }}>
                  <animateMotion dur="1.9s" begin={`${k * 0.95 + i * 0.3}s`} repeatCount="indefinite" path={d} />
                </circle>
              ))}
              {ad.rel && (
                <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reduce ? 0 : 0.5 }}>
                  <rect x={mx - lw / 2} y={my - 9} width={lw} height={18} rx={9} fill="#0c1222" fillOpacity="0.92" stroke={col} strokeOpacity="0.55" strokeWidth="1" />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={col}>{ad.rel}</text>
                </motion.g>
              )}
            </g>
          );
        })}

        {/* ── 순회 인스턴스 엣지 — 곡선 + 관계 라벨 + 강조 경로 파티클 ── */}
        {trav && trav.edges.map((e, i) => {
          const s = tp(e.s), t = tp(e.o);
          if (!s || !t) return null;
          const sN = trav.nodeById[e.s], tN = trav.nodeById[e.o];
          const sc = clip(t, s, instR(sN)), tc = clip(s, t, instR(tN) + 3);
          const col = instColor(sN);
          const tFoc = tN?.focus || e.o === anchor;
          const sameCol = s.col === t.col;
          const { d, mx, my } = edgeGeom(sc, tc, sameCol ? 0.42 : (i % 2 ? 0.12 : -0.12));
          const delay = reduce ? 0 : Math.min((t.col || 0) * 0.1 + 0.15, 0.6);
          return (
            <g key={`e${e.s}>${e.o}`}>
              <path d={d} fill="none" stroke={col} strokeOpacity={tFoc ? 0.16 : 0.05} strokeWidth={5} strokeLinecap="round" />
              <motion.path d={d} fill="none" stroke={col} strokeOpacity={tFoc ? 0.75 : 0.25} strokeWidth={1.6} markerEnd={`url(#qg-arr-${col.replace("#", "")})`}
                initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} />
              {!reduce && tFoc && (
                <circle r={2.6} fill={col} style={{ filter: `drop-shadow(0 0 5px ${col}) drop-shadow(0 0 9px ${col})` }}>
                  <animateMotion dur={`${1.6 + (i % 4) * 0.3}s`} begin={`${-(i % 5) * 0.33}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
              {e.rel && (
                <motion.text x={mx} y={my - 6} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#8b96b4" fillOpacity={tFoc ? 1 : 0.45}
                  style={{ paintOrder: "stroke", stroke: "#0a0e18", strokeWidth: 3, strokeLinejoin: "round" }}
                  initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: delay + 0.2 }}>{e.rel}</motion.text>
              )}
            </g>
          );
        })}

        {/* ── 클래스 노드 — Graph Design 과 동일 시각(⬡ 육각형 + 이너 코어 + 2분 색 + 농도·글로우 램프).
             순회 시 방문 클래스만 컬럼으로 morph, 드래그 가능 ── */}
        {classes.map((c, i) => {
          const tg = clsTarget(c.uri);
          const t = Math.sqrt((deg[c.uri] || 0) / maxDeg);   // degree 정규화 — 농도·글로우·테두리 세기
          const [bg, fg] = shades(clsColor(c.uri), t);
          const r = nodeR();
          const fs = Math.max(9.5, Math.round(r * 0.34 * 10) / 10);
          const glowA = Math.round(0x2e + t * 0x80).toString(16).padStart(2, "0");
          const coreProps = { className: "og-core", stroke: fg, strokeOpacity: 0.55 + t * 0.45, strokeWidth: 1.2 + t * 2,
            style: { filter: `drop-shadow(0 0 ${4 + Math.round(t * 14)}px ${fg}${glowA})` } };
          const dragId = trav ? (tg.key ? "cls:" + tg.key : null) : c.uri;
          const pulse = trav && !reduce && ((running && visited.get(c.uri) === lastCol) || visited.get(c.uri) === anchorCol);
          return (
            <motion.g key={c.uri} className="og-node" initial={false} animate={{ x: tg.x, y: tg.y, opacity: tg.on ? 1 : 0.05, scale: tg.on ? 1 : 0.75 }}
              transition={drag ? { duration: 0 } : morph}
              style={{ cursor: tg.on ? (drag === dragId ? "grabbing" : "grab") : "default" }}
              onMouseDown={(ev) => {
                if (trav) { if (tg.key) travDragStart(ev, "cls:" + tg.key); return; }
                if (!sim) return;
                ev.stopPropagation();
                if (spaceDown) { startPan(ev); return; }
                movedRef.current = false; setDrag(c.uri); sim.dragStart(c.uri);
              }}>
              <title>{`${c.label || c.uri} · 관계 ${deg[c.uri] || 0}개`}</title>
              <motion.g {...nodePop(i, reduce)}>
                {pulse && (
                  <path d={hexPath(r)} fill="none" stroke={fg} strokeWidth={1.5}>
                    <animateTransform attributeName="transform" type="scale" values="1;1.55" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.55;0" dur="1.5s" repeatCount="indefinite" />
                  </path>
                )}
                <path className="og-halo" d={hexPath(r + 7)} fill="none" stroke={fg}
                  strokeOpacity={0.08 + t * 0.5} strokeWidth={1 + t * 1.2} style={{ animationDelay: `${(i % 7) * 0.45}s` }} />
                <path {...coreProps} d={hexPath(r)} fill={bg} />
                <path d={hexPath(r * 0.46)} fill={fg} fillOpacity={0.5 + t * 0.4} style={{ pointerEvents: "none" }} />
                <text className="og-label" y={r + fs + 8} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#e9eef9">{dispLabel(c.label || c.uri)}</text>
              </motion.g>
            </motion.g>
          );
        })}
        {/* 클래스 목록에 없는 의사 컬럼(질의 결과 등) — 순회 시에만 등장 */}
        {trav && trav.cols.filter((c) => !c.uri).map((c) => {
          const p = cpos(c);
          const [bg, fg] = shades(c.color, 0.4);
          const r = nodeR();
          return (
            <motion.g key={`pc${c.key}`} initial={reduce ? false : { x: c.x, y: c.y, scale: 0 }} animate={{ x: p.x, y: p.y, scale: 1 }}
              transition={drag ? { duration: 0 } : morph}
              style={{ cursor: drag === "cls:" + c.key ? "grabbing" : "grab" }}
              onMouseDown={(ev) => travDragStart(ev, "cls:" + c.key)}>
              <path className="og-halo" d={hexPath(r + 7)} fill="none" stroke={fg} strokeOpacity={0.28} strokeWidth={1.2} />
              <path d={hexPath(r)} fill={bg} stroke={fg} strokeWidth={1.8} style={{ filter: `drop-shadow(0 0 9px ${fg}66)` }} />
              <path d={hexPath(r * 0.46)} fill={fg} fillOpacity={0.6} style={{ pointerEvents: "none" }} />
              <text className="og-label" y={r + 19} textAnchor="middle" fontSize={11} fontWeight="800" fill="#e9eef9">{dispLabel(c.label)}</text>
            </motion.g>
          );
        })}

        {/* ── 인스턴스(구체 값) 노드 — 소속 클래스에서 펼쳐지며 좌→우 전파, 클릭=상세, 드래그=이동 ── */}
        {trav && trav.cols.flatMap((c) => c.shown.map((n) => {
          const p = tp(n.id);
          if (!p) return null;
          const isAnchor = n.id === anchor, isSel = n.id === sel;
          const foc = n.focus || isAnchor || isSel;
          // 후보(cand)는 클래스 색을 흐리게 유지 — '같은 클래스의 다른 개체들' 로 읽히게.
          // 순회는 했지만 강조가 아닌 개체는 회색.
          const col = foc ? c.color : n.cand ? c.color : "#4a5578";
          const r = instR(n);
          // 구체 값 — 강조 노드는 속성 2줄까지(선택된 개체의 정보를 펼쳐 보여준다)
          const attrs = Object.entries(n.attrs || {}).filter(([k]) => !/ID|번호$/.test(k))
            .slice(0, foc ? 2 : 1).map(([k, v]) => `${k} ${v}`.slice(0, 22));
          if (!attrs.length && n.type && !n.cand) attrs.push(n.type.split(":").pop());
          const delay = reduce ? 0 : Math.min(p.col * 0.1 + p.row * 0.05, 0.6);
          const cp0 = cpos(c);   // 펼침 출발점 = 소속 클래스 노드
          return (
            <motion.g key={n.id} initial={reduce ? false : { x: cp0.x, y: cp0.y, scale: 0, opacity: 0 }}
              animate={{ x: p.x, y: p.y, scale: 1, opacity: foc ? 1 : n.cand ? 0.48 : 0.55 }}
              transition={drag ? { duration: 0 } : (reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26, delay })}
              style={{ cursor: drag === n.id ? "grabbing" : "pointer" }}
              onMouseDown={(ev) => travDragStart(ev, n.id)}
              onClick={(ev) => { ev.stopPropagation(); if (movedRef.current) { movedRef.current = false; return; } setSel(isSel ? null : n.id); }}>
              <title>클릭하면 상세 정보</title>
              {isAnchor && !reduce && (
                <circle r={r} fill="none" stroke={col} strokeWidth={1.5}>
                  <animate attributeName="r" values={`${r};${r + 13}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={r + 5} fill="none" stroke={col} strokeOpacity={foc ? 0.3 : 0.12} strokeWidth={1} />
              <circle r={r} fill={col + (isSel ? "3a" : isAnchor ? "30" : n.cand ? "14" : "1c")} stroke={col} strokeWidth={isSel ? 2.6 : isAnchor ? 2.2 : n.cand ? 1.2 : 1.5}
                strokeDasharray={n.cand ? "4 4" : n.source === "concept" && !isAnchor ? "4 3" : undefined}
                style={n.cand ? undefined : { filter: `drop-shadow(0 0 ${isSel || isAnchor ? 12 : 7}px ${col}${isSel || isAnchor ? "aa" : "55"})` }} />
              <text className="og-label" y={r + 13} textAnchor="middle" fontSize="11" fontWeight={foc ? 700 : 500} fill={foc ? "#e9eef9" : "#5a6684"}>{(n.label || "").slice(0, 14)}</text>
              {attrs.map((a, ai) => (
                <text key={ai} className="og-label" y={r + 25 + ai * 11} textAnchor="middle" fontSize="8.5" fontWeight="500" fill={foc ? "#8b96b4" : "#414b66"}>{a}</text>
              ))}
              {n.depth != null && (
                <g>
                  <circle cx={-r * 0.72 - 5} cy={-r * 0.72 - 5} r={8} fill="#0c1222" stroke={col} strokeWidth="1.2" />
                  <text x={-r * 0.72 - 5} y={-r * 0.72 - 1.5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={col}>{n.depth}</text>
                </g>
              )}
              {isAnchor && (
                <g>
                  <rect x={6} y={-r - 20} width={38} height={16} rx={8} fill="#35D0A5" />
                  <text x={25} y={-r - 8.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#04231f">시작</text>
                </g>
              )}
            </motion.g>
          );
        }))}
        {trav && trav.hiddenMarks.map((m, i) => (
          <text key={`hm${i}`} className="og-label" x={m.x} y={m.y} textAnchor="middle" fontSize="11" fontWeight="700" fill="#7b86a8">+{m.n}개</text>
        ))}
      </svg>

      {/* 상세 카드 — 클릭한 인스턴스의 속성 */}
      {selNode && (
        <div style={{ margin: "8px 6px 4px", border: `1px solid ${selColor || "#232b41"}`, borderRadius: 12, background: "#0c1222", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #232b41", flexWrap: "wrap" }}>
            <b style={{ fontSize: 14, color: "#e9eef9" }}>{selNode.label}</b>
            <span className="mono" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: (selColor || "#9db8d6") + "22", color: selColor || "#8b96b4" }}>
              {selCls}{TSRC_LABEL[selNode.source] ? ` · ${TSRC_LABEL[selNode.source]}` : ""}
            </span>
            {selNode.depth != null && <span className="mono" style={{ fontSize: 11, color: "#5a6684" }}>hop {selNode.depth}</span>}
            {selNode.cand && <span className="mono" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#232b41", color: "#8b96b4" }}>이번 순회에 선택되지 않은 후보</span>}
            <button onClick={() => setSel(null)} title="닫기" style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#5a6684", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
          </div>
          {Object.keys(selNode.attrs || {}).length > 0 ? (
            <div style={{ padding: "9px 14px 12px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
              {Object.entries(selNode.attrs).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12 }}>
                  <span className="mono" style={{ color: "#8b96b4", minWidth: 96, flex: "none" }}>{k}</span>
                  <span style={{ color: "#e9eef9", wordBreak: "break-word" }}>{v}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ padding: "10px 14px", fontSize: 12, color: "#5a6684" }}>표시할 속성이 없습니다.</div>}
        </div>
      )}
    </div>
  );

  // 전체화면은 body 로 포털 — 같은 컴포넌트 인스턴스라 순회 상태·물리 시뮬레이션·선택이 그대로 유지되고,
  // 그래프가 잘려 보이던 부모(고정 높이·overflow:hidden 열)의 제약에서 벗어난다.
  return full ? createPortal(canvas, document.body) : canvas;
}
