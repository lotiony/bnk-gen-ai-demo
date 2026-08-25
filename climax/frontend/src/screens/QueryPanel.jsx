import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import { edgeGeom } from "../components/OntologyGraph";
import QueryGraph from "../components/QueryGraph";
import Markdown from "../components/Markdown";
import ThoughtTrace from "../components/ThoughtTrace";

// Query — 자연어/CQ → 라우팅(그래프/정형DB/하이브리드) → 실시간 진행 표시 → 최종 답변.
// 서버 잡 폴링으로 실제 진행(분석→탐색→답변)을 그대로 보여준다 (데모 시연용).
// 상태 폴링 연속 실패 허용 횟수 — 이 이하의 일시적 실패는 재시도해 긴 질의가 blip 한 번에 죽지 않게.
const _POLL_MAX_FAIL = 8;
const ROUTE_PILL = {
  graph: ["그래프 (SPARQL)", "#e0f6f3", "#009387"],
  sql: ["정형DB (SQL)", "#eaf1fb", "#2f6fd0"],
  hybrid: ["하이브리드", "#f1ecfb", "#8a63d2"],
  action: ["행위형", "#fdeee0", "#c26a12"],
};
const routePill = (r, size = 10.5) => {
  const [t, bg, fg] = ROUTE_PILL[r] || ROUTE_PILL.graph;
  return <span className="mono" style={{ fontSize: size, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99, background: bg, color: fg }}>{t}</span>;
};

// 그래프 탐색 경로 — 좌→우 레이어드 다이어그램 (고립 노드 제거, 큰 라벨 박스)
function TrailGraph({ trail }) {
  const data = useMemo(() => {
    const edges = (trail?.edges || []).filter((e) => e.p !== "type");
    const linked = new Set();
    edges.forEach((e) => { linked.add(e.s); linked.add(e.o); });
    const nodes = (trail?.nodes || []).filter((n) => linked.has(n.uri));
    if (!nodes.length || !edges.length) return null;
    // 레이어(깊이) = 유입 경로의 최장 길이 → 좌에서 우로 흐르는 경로 배치
    const depth = Object.fromEntries(nodes.map((n) => [n.uri, 0]));
    for (let it = 0; it < nodes.length; it++) {
      let changed = false;
      edges.forEach((e) => {
        if (depth[e.s] != null && depth[e.o] != null && depth[e.o] < depth[e.s] + 1) { depth[e.o] = depth[e.s] + 1; changed = true; }
      });
      if (!changed) break;
    }
    const layers = {};
    nodes.forEach((n) => { (layers[depth[n.uri]] = layers[depth[n.uri]] || []).push(n); });
    const cols = Object.keys(layers).map(Number).sort((a, b) => a - b);
    const NW = 240, COLW = 330, ROWH = 86, NH = 52;
    const maxRows = Math.max(...cols.map((c) => layers[c].length));
    const H = maxRows * ROWH + 24, W = cols.length * COLW + 40;
    const pos = {};
    cols.forEach((c, ci) => {
      const ls = layers[c];
      ls.forEach((n, i) => {
        pos[n.uri] = { x: ci * COLW + 20 + NW / 2, y: (i + 0.5) * ROWH + ((maxRows - ls.length) * ROWH) / 2 + 12 };
      });
    });
    return { nodes, edges, pos, W, H, NW, NH };
  }, [trail]);
  if (!data) return null;
  const { nodes, edges, pos, W, H, NW, NH } = data;
  const trunc = (s, n = 17) => (s && s.length > n ? s.slice(0, n) + "…" : s);
  return (
    <div style={{ borderBottom: "1px solid var(--line)", background: "var(--main)", padding: "10px 14px 14px" }}>
      <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#009387", marginBottom: 6 }}>
        그래프 탐색 경로 — {nodes.length} 노드 · {edges.length} 관계
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: Math.min(420, H * 1.1), background: "var(--app)", borderRadius: 12, border: "1px solid var(--line)" }}>
        <defs><marker id="tg-arr" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L8,4.5 L0,9 Z" fill="#009387" /></marker></defs>
        {edges.map((e, i) => {
          const s = pos[e.s], t = pos[e.o];
          if (!s || !t) return null;
          const sx = s.x + NW / 2, sy = s.y, tx = t.x - NW / 2 - 7, ty = t.y;
          const mx = (sx + tx) / 2, my = (sy + ty) / 2, lw = (e.p || "").length * 13.5 + 16;
          const hier = e.p === "⊑";
          return (
            <g key={i}>
              <path d={`M ${sx} ${sy} C ${sx + 55} ${sy}, ${tx - 55} ${ty}, ${tx} ${ty}`} fill="none"
                stroke={hier ? "#8a93ab" : "#009387"} strokeWidth="2.4" strokeDasharray={hier ? "7 6" : undefined}
                markerEnd="url(#tg-arr)" />
              {e.p && !hier && (
                <>
                  <rect x={mx - lw / 2} y={my - 13} width={lw} height={26} rx={7} fill="var(--app)" stroke="#009387" strokeWidth="1.2" />
                  <text x={mx} y={my + 5} textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#009387">{e.p}</text>
                </>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos[n.uri];
          if (!p) return null;
          const inst = n.kind === "instance";
          return (
            <g key={n.uri}>
              <title>{n.label}</title>
              <rect x={p.x - NW / 2} y={p.y - NH / 2} width={NW} height={NH} rx={13}
                fill={inst ? "#00BEAC22" : "var(--app)"} stroke={inst ? "#009387" : "var(--faint)"}
                strokeWidth={inst ? 2 : 1.5} strokeDasharray={inst ? undefined : "6 5"} />
              <text x={p.x} y={p.y + 5.5} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--navy)">{trunc(n.label)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// SQL 조인 경로 — FROM/JOIN 순서의 테이블 체인
function JoinChain({ tables }) {
  if (!tables?.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--main)" }}>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#2f6fd0", marginRight: 2 }}>조인 경로</span>
      {tables.map((t, i) => (
        <span key={t.table} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span style={{ color: "#2f6fd0", fontWeight: 800 }}>→</span>}
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, background: "var(--app)", border: "1px solid #2f6fd066", color: "var(--navy)", padding: "5px 12px", whiteSpace: "nowrap", borderRadius: 9 }}>
            {t.table}{t.comment && <span style={{ color: "var(--muted)", fontWeight: 500 }}> · {t.comment}</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

// 질의 서사 그래프 — 앵커 → 정형/문서 파트 → 종합 답변을 좌→우 레인으로 (POSCO ego graph 계열).
// 스트리밍되는 parts 로 프론트가 실시간 구성: 파트 완료마다 자라고, 답변 노드는 마지막에.
const NKIND = {
  anchor: ["#7FB3E8", 18], sql: ["#7FB3E8", 17], table: ["#9db8d6", 8],
  doc: ["#35D0A5", 17], clause: ["#5fd8b6", 8], out: ["#35D0A5", 18], reject: ["#8a93a6", 11],
};
const _trunc = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");

// parts(실시간 스트림) → {nodes, edges}. 백엔드 무관하게 클라이언트에서 구성.
function buildNarrative(parts, question, answer) {
  const nodes = [], edges = [], seen = new Set();
  const N = (id, label, kind, step, o = {}) => {
    if (seen.has(id)) return id;
    seen.add(id);
    nodes.push({ id, label: (label || "").slice(0, 42), kind, step, lane: !!o.lane, amb: !!o.amb, big: !!o.big });
    return id;
  };
  const E = (s, o, kind = "flow") => { if (s && o) edges.push({ s, o, kind }); };
  let anchor = null;
  for (const r of parts || []) {
    const blob = (r.query || "") + " " + (r.vsql || "");
    const m = blob.match(/LIKE '%([^%']+)%'/) || blob.match(/CONTAINS\([^,]*,\s*"([^"]+)"/);
    if (m) { anchor = m[1]; break; }
  }
  N("anchor", anchor || (question || "질문").trim().slice(0, 16), "anchor", 0, { lane: true, big: true });
  let prev = "anchor", step = 1;
  (parts || []).forEach((r, i) => {
    const cnt = r.count || 0, purpose = (r.purpose || `파트 ${i + 1}`).trim();
    const isSql = r.method === "virtual" || r.route === "sql";
    if (r.error || cnt === 0) {   // 기각/미발화 — 설명가능성 층
      E("anchor", N(`amb${i}`, purpose + (r.error ? " · 오류" : " · 0건"), "reject", step, { amb: true }), "reject");
      return;
    }
    const nid = N(`part${i}`, `${purpose} · ${cnt}건`, isSql ? "sql" : "doc", step, { lane: true, big: true });
    E(prev, nid, "flow"); prev = nid; step++;
    if (isSql) {
      let tbls = (r.tables || []).map((t) => t.table);
      if (!tbls.length) tbls = [...new Set((r.vsql || r.query || "").match(/\bTB_[A-Z_]+\b/g) || [])];
      tbls.slice(0, 4).forEach((t) => E(nid, N(`tbl:${i}:${t}`, t, "table", step - 1), "detail"));
    } else {
      ((r.trail || {}).nodes || []).slice(0, 4).forEach((dn) =>
        E(nid, N(`nd:${i}:${dn.uri}`, dn.label, dn.kind === "instance" ? "clause" : "doc", step - 1), "detail"));
    }
  });
  if (answer) E(prev, N("answer", "종합 답변", "out", step, { lane: true, big: true }), "flow");
  return { nodes, edges };
}

function QueryNarrative({ parts, question, answer, running }) {
  const reduce = typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const data = useMemo(() => {
    const { nodes, edges } = buildNarrative(parts, question, answer);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const rOf = (id) => (NKIND[byId[id]?.kind] || [, 8])[1];
    const lane = nodes.filter((n) => n.lane).sort((a, b) => a.step - b.step);
    // 결정적 지터 — id 해시 기반 ±amp. 같은 데이터면 같은 그림, 매 파트마다 살짝 다른 자리.
    const jit = (id, salt, amp) => {
      let h = 0;
      for (const ch of id + salt) h = (h * 31 + ch.charCodeAt(0)) % 997;
      return (h / 997 - 0.5) * 2 * amp;
    };
    const LM = 60, COLW = 190, spineY = 66, DY = 54, DGAP = 38;
    const W = Math.max(440, LM + (Math.max(1, lane.length) - 1) * COLW + 100);
    const pos = {};
    lane.forEach((n, i) => { pos[n.id] = { x: LM + i * COLW + jit(n.id, "x", 12), y: spineY + jit(n.id, "y", 16) }; });
    const kids = {};
    edges.filter((e) => e.kind === "detail").forEach((e) => { (kids[e.s] = kids[e.s] || []).push(e.o); });
    Object.entries(kids).forEach(([pid, ks]) => {
      const px = pos[pid]?.x ?? LM, py = pos[pid]?.y ?? spineY;
      ks.forEach((k, j) => {   // 수상돌기처럼 — 지그재그 + 지터로 부모 아래에 흩뿌림
        pos[k] = { x: px + (j % 2 ? 22 : -22) + jit(k, "x", 24), y: py + DY + j * DGAP + jit(k, "y", 9) };
      });
    });
    const amb = nodes.filter((n) => n.amb);
    const maxKidY = Math.max(spineY, ...Object.values(pos).map((p) => p.y));
    amb.forEach((n, i) => { pos[n.id] = { x: LM + 8 + i * 160 + jit(n.id, "x", 14), y: maxKidY + 52 + jit(n.id, "y", 8) }; });
    const H = Math.max(...Object.values(pos).map((p) => p.y)) + 44;
    const lastLane = lane.length ? lane[lane.length - 1].id : null;
    // 척추 곡선 — 흐름 엣지마다 교대로 휘는 quadratic. 파티클(시냅스 신호)도 같은 경로를 탄다.
    const flowD = {};
    edges.filter((e) => e.kind === "flow").forEach((e, i) => {
      const s = pos[e.s], t = pos[e.o];
      if (!s || !t) return;
      const rs = rOf(e.s), rt = rOf(e.o);
      const dx = t.x - s.x, dy = t.y - s.y, L = Math.hypot(dx, dy) || 1;
      const sp = { x: s.x + (dx / L) * rs, y: s.y + (dy / L) * rs };
      const tp = { x: t.x - (dx / L) * (rt + 3), y: t.y - (dy / L) * (rt + 3) };
      flowD[`${e.s}>${e.o}`] = edgeGeom(sp, tp, i % 2 ? 0.14 : -0.14).d;
    });
    const spine = Object.values(flowD).join(" ") || null;
    const laneIdx = Object.fromEntries(lane.map((n, i) => [n.id, i]));   // 척추 순번 — hop 배지
    return { nodes, edges, pos, W, H, rOf, spine, lastLane, laneIdx, flowD };
  }, [parts, question, answer]);
  const { nodes, edges, pos, W, H, rOf, spine, lastLane, laneIdx, flowD } = data;
  if (!nodes.length) return null;
  const halo = { paintOrder: "stroke", stroke: "#0a0e18", strokeWidth: 3, strokeLinejoin: "round" };
  return (
    <div className="og-canvas" style={{ padding: "12px 6px 4px", marginBottom: 12 }}>
      <style>{`@keyframes qnpop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
        .qn-g{transform-box:fill-box;transform-origin:center}`}</style>
      <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#8b96b4", padding: "0 12px 6px", display: "flex", gap: 8, alignItems: "center" }}>
        질의 서사 — 어디서 시작해 어떻게 답이 나왔나
        {running && <span style={{ color: "#35D0A5" }}>· 추론 진행 중…</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
        <defs>
          <marker id="qn-arr" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0,0 L8,4.5 L0,9 Z" fill="#35D0A5" /></marker>
        </defs>
        {edges.map((e, i) => {
          const s = pos[e.s], t = pos[e.o];
          if (!s || !t) return null;
          const flow = e.kind === "flow", rej = e.kind === "reject";
          const col = flow ? "#35D0A5" : rej ? "#5a6684" : "#39415c";
          if (flow) {   // 척추(곡선) — 글로우 언더레이 + 본선, 화살표는 노드 밖에
            const d = flowD[`${e.s}>${e.o}`];
            if (!d) return null;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={col} strokeOpacity={0.18} strokeWidth={7} strokeLinecap="round" />
                <path d={d} fill="none" stroke={col} strokeWidth={2.2} opacity={0.95} markerEnd="url(#qn-arr)" />
              </g>
            );
          }
          return <path key={i} d={`M ${s.x} ${s.y} C ${s.x} ${(s.y + t.y) / 2}, ${t.x} ${(s.y + t.y) / 2}, ${t.x} ${t.y - rOf(e.o)}`}
            fill="none" stroke={col} strokeWidth={1.3} strokeDasharray={rej ? "4 5" : "3 4"} opacity={0.6} />;
        })}
        {spine && !reduce && [0, 1, 2].map((k) => (
          <circle key={"p" + k} r={3.4} fill="#35D0A5" style={{ filter: "drop-shadow(0 0 5px #35D0A5) drop-shadow(0 0 10px #35D0A5)" }}>
            <animateMotion dur="2.1s" begin={`${k * 0.7}s`} repeatCount="indefinite" path={spine} />
            <animate attributeName="opacity" values="0;1;1;0" dur="2.1s" begin={`${k * 0.7}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {nodes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const [col, r] = NKIND[n.kind] || NKIND.table;
          const activePulse = running && !reduce && n.id === lastLane && n.id !== "answer";
          return (
            <g key={n.id} className="qn-g" style={reduce ? undefined : { animation: `qnpop .45s cubic-bezier(.2,.7,.3,1) both`, animationDelay: `${Math.min(n.step * 0.08, 0.4)}s` }}>
              <title>{n.label}</title>
              {activePulse && (
                <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={col} strokeWidth={1.5}>
                  <animate attributeName="r" values={`${r};${r + 11}`} dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={r} fill={n.amb ? "none" : col + "2e"} stroke={col}
                strokeWidth={n.big ? 2.4 : 1.6} strokeDasharray={n.amb ? "3 3" : undefined}
                style={n.amb ? undefined : { filter: `drop-shadow(0 0 ${n.big ? 10 : 6}px ${col}${n.big ? "aa" : "66"})` }} />
              {n.lane && (
                <g>
                  <circle cx={p.x} cy={p.y - r - 13} r={8} fill="#0c1222" stroke={col} strokeWidth="1.2" />
                  <text x={p.x} y={p.y - r - 9.5} textAnchor="middle" fontSize="9" fontWeight="800" fill={col}>{n.id === "answer" ? "✓" : laneIdx[n.id] + 1}</text>
                </g>
              )}
              <text x={p.x} y={p.y + r + 13} textAnchor="middle" fontSize={n.big ? 12 : 9.5} style={halo}
                fontWeight={n.big ? 700 : 500} fill={n.amb ? "#5a6684" : "#e9eef9"}>{_trunc(n.label, n.big ? 20 : 14)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ReAct 추론 트레이스는 components/ThoughtTrace 로 추출 — Query 와 비교(Compare) 화면이 공유.

export default function QueryPanel() {
  const { activeId } = useProjects();
  const [cqs, setCqs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);   // 서버 잡 상태 — {status, stage, message, route, notes, parts}
  const [res, setRes] = useState(null);   // 완료 결과
  const mode = "graph";   // 항상 온톨로지 모드(SPARQL 전용) — 토글 제거
  const pollRef = useRef(null);
  const [tjob, setTjob] = useState(null);   // 순회 잡 — {status, message, anchor, nodes, edges, order}
  const [tres, setTres] = useState(null);   // 순회 완료 결과
  const [tbusy, setTbusy] = useState(false);
  const tpollRef = useRef(null);
  const trunRef = useRef(0);   // 실행 세대 — 정지/재실행 시 증가. 이전 세대의 in-flight 폴링 응답을 무시한다.
  const [ont, setOnt] = useState(null);   // 온톨로지 스키마 — 기본 그래프(Graph Design 과 동일 전경)용

  useEffect(() => {
    let alive = true;
    setOnt(null);
    Promise.all([api.ontologyView("entities"), api.ontologyView("relationships"), api.ontologyGroups(),
      api.ontologyView("class-instances").catch(() => ({ classes: {} })),
      api.ontologyView("designer").catch(() => ({ properties: [] }))])
      .then(([e, r, g, ci, full]) => {
        if (!alive) return;
        const ns = e.entities || [];
        const uris = new Set(ns.map((x) => x.uri));
        setOnt({
          classes: ns,
          relations: (r.relationships || []).filter((p) => uris.has(p.domain) && uris.has(p.range)),
          hier: ns.filter((c) => c.parent && uris.has(c.parent)).map((c) => ({ domain: c.uri, range: c.parent, kind: "hier" })),
          groups: g.groups || [],
          candidates: ci.classes || {},   // 클래스별 하위 개체 후보 — 순회 시 '펼침' 표시용
          dataProps: (full.properties || []).filter((p) => p.kind === "data"),   // 속성 위성 노드 — Graph Design 과 동일 전경
        });
      })
      .catch(() => { if (alive) setOnt({ classes: [], relations: [], hier: [], groups: [], candidates: {}, dataProps: [] }); });
    return () => { alive = false; };
  }, [activeId]);

  useEffect(() => {
    let alive = true;
    setRes(null); setJob(null); setQ(""); setTjob(null); setTres(null);
    api.cqList().then((d) => { if (alive) setCqs(d.cqs || []); }).catch(() => {});
    return () => { alive = false; clearTimeout(pollRef.current); clearTimeout(tpollRef.current); };
  }, [activeId]);

  // 추론/답변 우측 패널 자동 스크롤 — 새 사고·토큰이 붙을 때마다 맨 아래(최신)로 내린다.
  // rAF 로 감싸 DOM 이 새 내용을 그린 뒤(scrollHeight 갱신 후) 스크롤한다.
  const traceRef = useRef(null);
  const qbarRef = useRef(null);   // 질문 실행 시 이 지점을 뷰포트 상단으로 스크롤 → 그래프+답변이 전체화면
  // 실행 경과 시간 — 실행 시작~답변 완료까지 초 단위로 올라간다(사용자가 '작동 중'을 인지).
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!tbusy) return;               // 실행 중일 때만 타이머 가동
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
    return () => clearInterval(id);   // 완료/정지 시 정지 — elapsed 는 최종값으로 고정(총 소요시간 표시)
  }, [tbusy]);
  const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  useEffect(() => {
    const el = traceRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    return () => cancelAnimationFrame(id);
  }, [tjob?.thoughts?.length, tjob?.message, tjob?.partial, tres?.answer, tres?.thoughts?.length]);

  // 상태 폴링 — 일시적 실패(네트워크 blip·배포 지연)로 루프를 끝내지 않는다. 예전엔 한 번만
  // 실패해도 폴링을 멈춰, 긴 질의(수십 초, 수백 폴)에서 백엔드는 답을 다 냈는데 프런트가
  // 그걸 못 가져와 '그래프만 있고 답변 없음'이 됐다. 연속 실패가 임계(_POLL_MAX_FAIL)를 넘을 때만 포기.
  const poll = (gen, fails = 0) => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => {
      api.ontologyQueryStatus().then((s) => {
        if (gen !== trunRef.current) return;   // 정지/재실행됨 — 이 세대의 응답은 버린다
        if (s.status === "running") { setJob(s); return poll(gen); }
        setBusy(false);
        if (s.status === "done") { setJob(s); setRes(s.result || {}); }
        else if (s.status === "error") { setJob(null); setRes({ error: s.error || "실행 실패" }); }
      }).catch(() => {
        if (gen !== trunRef.current) return;
        if (fails + 1 >= _POLL_MAX_FAIL) { setBusy(false); setJob(null); setRes({ error: "상태 조회 실패 — 네트워크를 확인하세요" }); }
        else poll(gen, fails + 1);   // 재시도 — 백엔드는 계속 돌고 있다
      });
    }, 450);
  };

  const run = (question) => {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    const gen = ++trunRef.current;
    setQ(text); setBusy(true); setRes(null); setTjob(null); setTres(null);
    setJob({ status: "running", stage: "plan", message: "질문 분석 · 경로 판정 중…" });
    api.ontologyQuery(text, mode)
      .then(() => poll(gen))
      .catch((e) => { if (gen !== trunRef.current) return; setBusy(false); setJob(null); setRes({ error: String(e.message || e) }); });
  };

  const pollTraverse = (gen, fails = 0) => {
    clearTimeout(tpollRef.current);
    tpollRef.current = setTimeout(() => {
      api.ontologyTraverseStatus().then((s) => {
        if (gen !== trunRef.current) return;   // 정지/재실행됨 — 이 세대의 응답은 버린다
        if (s.status === "running") { setTjob(s); return pollTraverse(gen); }
        setTbusy(false);
        if (s.status === "done") { setTjob(s); setTres(s.result || {}); }
        else if (s.status === "cancelled") { setTjob(null); setTres({ answer: "⏹ 실행이 중지되었습니다." }); }
        else if (s.status === "error") { setTjob(null); setTres({ error: s.error || "탐색 실패" }); }
      }).catch(() => {
        if (gen !== trunRef.current) return;
        // 일시적 실패는 재시도 — 백엔드는 계속 순회 중이라 곧 done 이 온다. 연속 실패 임계 초과 시만 포기.
        if (fails + 1 >= _POLL_MAX_FAIL) { setTbusy(false); setTjob(null); setTres({ error: "상태 조회 실패 — 네트워크를 확인하세요" }); }
        else pollTraverse(gen, fails + 1);
      });
    }, 350);
  };

  const runTraverse = (question) => {
    const text = (question ?? q).trim();
    if (!text || tbusy) return;
    const gen = ++trunRef.current;
    setQ(text); setTbusy(true); setTres(null); setRes(null); setJob(null);
    setTjob({ status: "running" });
    // 질문 실행 → 페이지를 질문 영역 상단으로 스크롤해 그래프+답변이 화면을 꽉 채우게 한다.
    requestAnimationFrame(() => qbarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    api.ontologyTraverse(text, "agentic").then(() => pollTraverse(gen))
      .catch((e) => { if (gen !== trunRef.current) return; setTbusy(false); setTjob(null); setTres({ error: String(e.message || e) }); });
  };

  // 실행 중 정지 — UI 는 즉시 멈춘다(폴링 중단·세대 증가로 잔여 응답 무시). 백엔드 취소 신호는 뒤따라 보내
  // 서버 잡을 정리하되, 그 완료를 기다리지 않는다.
  const cancelTraverse = () => {
    trunRef.current += 1;
    clearTimeout(tpollRef.current); clearTimeout(pollRef.current);
    setTbusy(false); setBusy(false);
    setTjob(null); setJob(null);
    setTres({ answer: "⏹ 실행이 중지되었습니다." });
    api.ontologyTraverseCancel().catch(() => {});
  };

  // CQ 선택 시 — 실행(쿼리 분해) + 온톨로지 탐색을 함께 돌린다(둘 다 표시).
  const runBoth = (question) => {
    const text = (question ?? q).trim();
    if (!text || busy || tbusy) return;
    const gen = ++trunRef.current;
    setQ(text); setBusy(true); setTbusy(true); setRes(null); setTres(null);
    setJob({ status: "running", stage: "plan", message: "질문 분석 · 경로 판정 중…" });
    setTjob({ status: "running", message: "질문 의도 분석 중…" });
    api.ontologyQuery(text, mode).then(() => poll(gen))
      .catch((e) => { if (gen !== trunRef.current) return; setBusy(false); setJob(null); setRes({ error: String(e.message || e) }); });
    api.ontologyTraverse(text).then(() => pollTraverse(gen))
      .catch((e) => { if (gen !== trunRef.current) return; setTbusy(false); setTjob(null); setTres({ error: String(e.message || e) }); });
  };

  const cell = (v) => {
    if (!v) return <span style={{ color: "var(--faint)" }}>—</span>;
    const long = (v.value || "").length > 90;
    return (
      <div title={v.source || (long ? v.value : undefined)} style={{ maxWidth: 420 }}>
        <span style={{ color: "var(--navy)", fontWeight: v.uri ? 700 : 500 }}>{long ? v.value.slice(0, 90) + "…" : v.value}</span>
        {v.uri && <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>{v.uri}</div>}
        {v.source && <div className="mono" style={{ fontSize: 10.5, color: "#8a63d2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 380 }}>{v.source}</div>}
      </div>
    );
  };

  // 표시 데이터 — 실행 중엔 잡의 partial(route·완료된 파트), 완료 후엔 최종 결과
  const running = job?.status === "running";
  const view = res || (running ? { route: job.route, notes: job.notes, parts: job.parts || [] } : null);
  const parts = view?.parts || [];
  const isAction = view?.route === "action";
  const stage = res ? 3 : !running ? -1 : job.stage === "plan" ? 0 : job.stage === "synthesize" ? 2 : 1;
  const STEPS = ["질문 분석 · 경로 판정",
    `데이터 탐색${parts.length ? ` (${parts.map((p) => (p.route === "sql" ? "정형DB" : "그래프")).join(" + ")})` : ""}`,
    "답변 생성"];

  const stepDot = (i) => {
    const done = stage > i, active = stage === i;
    return (
      <span key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {i > 0 && <span style={{ width: 26, height: 2, background: done || active ? "var(--blue)" : "var(--line2)", borderRadius: 2 }} />}
        <span style={{ width: 21, height: 21, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: done ? "var(--blue)" : "var(--app)", border: `2px solid ${done || active ? "var(--blue)" : "var(--line2)"}`, color: done ? "#fff" : "var(--muted)", fontSize: 11, fontWeight: 800 }}>
          {done ? "✓" : active ? <span style={{ width: 9, height: 9, border: "2px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> : i + 1}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: done || active ? 700 : 500, color: done || active ? "var(--navy)" : "var(--muted)", whiteSpace: "nowrap" }}>{STEPS[i]}</span>
      </span>
    );
  };

  return (
    <div>

      <style>{`
        .qbar{position:relative;display:flex;align-items:center;gap:0;margin-bottom:14px;
          background:var(--app);border:1.5px solid var(--line2);border-radius:14px;
          padding:5px 5px 5px 15px;box-shadow:0 1px 2px rgba(16,24,40,.04);
          transition:border-color .15s, box-shadow .15s;overflow:hidden}
        .qbar:focus-within{border-color:#35D0A5;box-shadow:0 0 0 3.5px rgba(53,208,165,.16)}
        .qbar.running{border-color:rgba(53,208,165,.55)}
        .qbar-lead{flex:none;display:inline-flex;color:#2bb894;margin-right:10px}
        .qbar.running .qbar-lead{animation:qpulse 1.4s ease-in-out infinite}
        @keyframes qpulse{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.08)}}
        .qbar-input{flex:1;min-width:0;border:none;outline:none;background:transparent;
          font-family:var(--sans);font-size:14px;color:var(--text);padding:9px 8px 9px 0;letter-spacing:-.01em}
        .qbar-input::placeholder{color:var(--muted);opacity:.72}
        .qbar-cq{position:relative;flex:none;display:inline-flex;align-items:center;
          margin-right:6px;padding-left:12px;border-left:1px solid var(--line2)}
        .qbar-cq select{appearance:none;-webkit-appearance:none;border:none;outline:none;cursor:pointer;
          background:transparent;font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--muted);
          padding:7px 24px 7px 8px;border-radius:8px;max-width:180px;text-overflow:ellipsis}
        .qbar-cq:hover select{color:var(--text);background:var(--main)}
        .qbar-cq .chev{position:absolute;right:7px;pointer-events:none;color:var(--muted)}
        .qbar-go{flex:none;display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 17px;
          border-radius:10px;border:1.5px solid transparent;font-family:var(--sans);font-size:13.5px;font-weight:700;
          letter-spacing:-.01em;cursor:pointer;transition:background .14s, border-color .14s, color .14s, opacity .14s}
        .qbar-go.go-idle{background:#35D0A5;color:#04231f}
        .qbar-go.go-idle:hover{background:#28c199}
        .qbar-go.go-idle:disabled{opacity:.5;cursor:default;background:#35D0A5}
        .qbar-go.go-stop{background:transparent;color:#0e9b8b;border-color:rgba(53,208,165,.6)}
        .qbar-go.go-stop:hover{background:rgba(53,208,165,.1)}
        .qbar-go:focus-visible{outline:2px solid #0e9b8b;outline-offset:2px}
        .qbar-prog{position:absolute;left:0;right:0;bottom:0;height:2.5px;overflow:hidden}
        .qbar-prog::before{content:"";position:absolute;top:0;bottom:0;width:38%;border-radius:2px;
          background:linear-gradient(90deg,transparent,#35D0A5,transparent);animation:qslide 1.15s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){
          .qbar.running .qbar-lead{animation:none}
          .qbar-prog::before{animation:none;width:100%;opacity:.4}
        }
        @keyframes qslide{0%{left:-38%}100%{left:100%}}
      `}</style>

      <div ref={qbarRef} style={{ scrollMarginTop: 12 }} className={`qbar${tbusy ? " running" : ""}`}>
        <span className="qbar-lead" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input className="qbar-input" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !tbusy && runTraverse()}
          placeholder="예: 김민준의 음주운전 사고 청구에서 실제 지급된 보험금은? 약관상 본인 부담금은?" />
        {cqs.length > 0 && !tbusy && (
          <div className="qbar-cq">
            <select value="" onChange={(e) => e.target.value && runTraverse(e.target.value)} aria-label="예상질문에서 선택">
              <option value="">예시 질문</option>
              {[["hybrid", "하이브리드 질문"], ["aggregate", "집계성 질문"]].map(([cat, label]) => {
                const items = cqs.filter((c) => (c.category || "hybrid") === cat);
                return items.length === 0 ? null : (
                  <optgroup key={cat} label={label}>
                    {items.map((c) => <option key={c.id} value={c.question}>{c.question}</option>)}
                  </optgroup>
                );
              })}
            </select>
            <svg className="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        )}
        {/* 경과 시간 — 실행 중 계속 올라가 '작동 중'임을 보인다. */}
        {tbusy && (
          <span className="mono" title="실행 경과 시간" aria-live="off" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 5, marginRight: 8, padding: "0 4px", fontSize: 12.5, fontWeight: 700, color: "#0e9b8b", fontVariantNumeric: "tabular-nums" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {fmtSec(elapsed)}
          </span>
        )}
        {/* 실행/정지 — 같은 버튼이 상태에 따라 모핑(별도 정지 버튼 없음). run/runBoth 로직은 보존. */}
        <button className={`qbar-go ${tbusy ? "go-stop" : "go-idle"}`}
          onClick={() => (tbusy ? cancelTraverse() : runTraverse())}
          disabled={!tbusy && !q.trim()}
          title={tbusy ? "실행 중 — 클릭하면 즉시 중지합니다" : "질문의 개체에서 온톨로지 관계를 타고 답을 찾습니다"}>
          {tbusy
            ? <><span style={{ width: 11, height: 11, borderRadius: 2.5, background: "#0e9b8b", flex: "none" }} />정지</>
            : <><svg width="15" height="15" viewBox="0 0 24 24" fill="#04231f" aria-hidden="true"><path d="M8 5v14l11-7Z" /></svg>실행</>}
        </button>
        {tbusy && <span className="qbar-prog" aria-hidden="true" />}
      </div>

      {res?.error && (
        <div style={{ padding: "13px 18px", background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: 12, marginBottom: 14, color: "var(--red)", fontSize: 13.5 }}>
          <b>실행 실패</b> — {res.error}
        </div>
      )}

      {/* ── 온톨로지 순회 모드 ── */}
      {tres?.error && (
        <div style={{ padding: "13px 18px", background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: 12, marginBottom: 14, color: "var(--red)", fontSize: 13.5 }}>
          <b>탐색 실패</b> — {tres.error}
        </div>
      )}
      {(() => {
        const tv = tres || tjob;
        const trunning = tjob?.status === "running" && !tres;
        const hasTrav = !tres?.error && !!tv?.nodes?.length;
        const hasThoughts = Array.isArray(tv?.thoughts) && tv.thoughts.length > 0;
        const styleTag = (
          <style>{`
            @keyframes tvbounce{0%,75%,100%{transform:translateY(0);opacity:.35}38%{transform:translateY(-5px);opacity:1}}
            .tv-dots{display:inline-flex;gap:3px;flex:none}
            .tv-dots i{width:5px;height:5px;border-radius:50%;background:#35D0A5;display:block;animation:tvbounce 1.1s ease-in-out infinite}
            .tv-dots i:nth-child(2){animation-delay:.15s}
            .tv-dots i:nth-child(3){animation-delay:.3s}
            @keyframes qspin{0%,100%{opacity:.5;transform:scale(.9)}50%{opacity:1;transform:scale(1.14)}}
            @keyframes qshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
            .qskel{background:linear-gradient(90deg,rgba(120,140,180,.10) 25%,rgba(120,140,180,.24) 50%,rgba(120,140,180,.10) 75%);
              background-size:200% 100%;animation:qshimmer 1.3s ease-in-out infinite}
          `}</style>
        );
        // 그래프는 항상 fill(세로 꽉 채움) — 처음부터 70:30 유지
        const graphEl = (
          <QueryGraph classes={ont?.classes} relations={ont?.relations || []} hier={ont?.hier || []} groups={ont?.groups || []}
            dataProps={ont?.dataProps || []} fill
            candidates={ont?.candidates || {}} traversal={hasTrav ? tv : null} anchor={hasTrav ? tv.anchor : null} running={trunning} />
        );
        const traceEl = hasThoughts && <ThoughtTrace thoughts={tv.thoughts} running={trunning} goal={tv.goal} />;
        // 스트리밍 답변(partial) → 최종 답변. 좁은 우측 열에서도 읽히도록 그대로 마크다운 렌더.
        const answerEl = (
          <>
            {trunning && tjob?.partial && (
              <div style={{ background: "var(--ans-bg)", border: "1.5px solid var(--ans-line)", borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span>✦</span><b style={{ fontSize: 14, color: "var(--ans-title)" }}>종합 답변</b>
                  <span className="tv-dots" style={{ marginLeft: 2 }}><i /><i /><i /></span>
                </div>
                <Markdown text={tjob.partial} style={{ fontSize: 14, color: "var(--navy)" }} />
              </div>
            )}
            {tres?.answer && (
              <div style={{ background: "var(--ans-bg)", border: "1.5px solid var(--ans-line)", borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span>✦</span><b style={{ fontSize: 14, color: "var(--ans-title)" }}>종합 답변</b>
                  {elapsed > 0 && <span className="mono" title="총 소요 시간" style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>· {fmtSec(elapsed)}</span>}
                  {tres.determinism && (
                    <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 999,
                      background: tres.determinism === "exact" ? "rgba(14,155,107,.14)" : "rgba(183,121,31,.16)",
                      color: tres.determinism === "exact" ? "#0e9b6b" : "#b7791f",
                      border: `1px solid ${tres.determinism === "exact" ? "rgba(14,155,107,.4)" : "rgba(183,121,31,.4)"}` }}>
                      {tres.determinism === "exact" ? "✅ 확정" : "🔶 일부 추정"}
                    </span>
                  )}
                </div>
                <Markdown text={tres.answer} style={{ fontSize: 14, color: "var(--navy)" }} />
              </div>
            )}
          </>
        );
        const empty = !hasThoughts && !tres?.answer && !(trunning && tjob?.partial);
        // 처음부터 고정 70:30 — 좌 그래프(세로 꽉 채움) / 우 추론·답변(둘 다 같은 높이, 우측만 스크롤).
        // 아직 실행 전이면 우측은 옅은 플레이스홀더(진행 배너 없음).
        const panelH = "calc(100vh - 210px)";
        return (
          <div style={{ marginBottom: 12 }}>
            {styleTag}
            <div style={{ display: "flex", gap: 14, height: panelH, minHeight: 460 }}>
              <div style={{ flex: "7 1 0", minWidth: 0, height: "100%" }}>{graphEl}</div>
              <div ref={traceRef} style={{ flex: "3 1 0", minWidth: 290, height: "100%", overflowY: "auto",
                background: "var(--app)", border: "1.5px solid var(--line2)", borderRadius: 16,
                padding: "12px 12px", scrollBehavior: "smooth" }}>
                {empty ? (
                  trunning ? (
                    /* 첫 사고가 오기 전 — 정적이면 멈춘 듯 보이므로 '분석 중' 애니메이션 + 스켈레톤 */
                    <div style={{ padding: "4px 4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 14, animation: "qspin 1.2s ease-in-out infinite", display: "inline-block" }}>✦</span>
                        <b style={{ fontSize: 12.5, color: "var(--navy)" }}>질문을 분석하고 있어요</b>
                        <span className="tv-dots"><i /><i /><i /></span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 14, lineHeight: 1.5 }}>
                        목표를 세우고 그래프에서 관련 개체를 찾는 중이에요…
                      </div>
                      {[94, 78, 88, 70].map((w, i) => (
                        <div key={i} className="qskel" style={{ width: w + "%", height: 11, borderRadius: 6, marginBottom: 10 }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 18px" }}>
                      <span style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                        {"질문을 실행하면\n추론 과정과 답변이\n여기에 표시됩니다"}
                      </span>
                    </div>
                  )
                ) : (<>{traceEl}{answerEl}</>)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 진행 스테퍼 — 서버 잡 상태를 실시간 반영 */}
      {view && !res?.error && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", padding: "13px 18px", background: "var(--app)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 12 }}>
          {[0, 1, 2].map(stepDot)}
          {running && job.message && <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{job.message}</span>}
        </div>
      )}

      {/* ① 라우팅 판정 — 판정 즉시 표시 */}
      {view && !res?.error && view.route && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, padding: "0 4px" }}>
          {routePill(view.route)}
          {view.notes && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{view.notes}</span>}
          {res?.triples != null && (
            <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
              그래프 {res.triples} triples{res.inferred > 0 ? <span style={{ color: "#8a63d2" }}> · 추론 +{res.inferred}</span> : null}
            </span>
          )}
        </div>
      )}

      {/* ② 파트별 실행 — 완료되는 대로 실시간 추가 */}
      {view && !res?.error && isAction && res && (
        <div style={{ padding: "16px 20px", background: "#fdeee0", border: "1px solid #e8c9a0", borderRadius: 12, marginBottom: 12, color: "#8a6116", fontSize: 13.5 }}>
          <b>행위형 요청</b> — {res.message}
        </div>
      )}
      {/* 질의 서사 그래프 — 스트리밍 parts 로 실시간 구성(파트 완료마다 자람) */}
      {view && !res?.error && !isAction && (parts.length > 0 || running) && (
        <QueryNarrative parts={parts} question={res?.question || q} answer={res?.answer} running={running} />
      )}

      {view && !res?.error && !isAction && parts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          {parts.map((p, i) => (
            <div key={i} style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
                <b style={{ fontSize: 13.5, color: "var(--navy)" }}>{p.purpose || `하위 질의 ${i + 1}`}</b>
                {routePill(p.route, 10)}
                {p.method === "virtual" && <span className="mono" title="SPARQL 을 R2RML 로 SQL 로 번역해 DB 에서 직접 실행 (복제 없음)" style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99, background: "#f1ecfb", color: "#8a63d2" }}>가상 OBDA · SPARQL→SQL</span>}
                {/* 폴백 자체는 문서 질의의 정상 경로 — 결과가 있으면 조용한 배지, 0건일 때만 경고 */}
                {p.vskip && p.count === 0 && <span className="mono" title={`SQL 번역 실패 사유: ${p.vskip}`} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99, background: "#fdf3e0", color: "#c26a12" }}>⚠ 번역 불가 → 그래프 폴백</span>}
                {p.vskip && p.count > 0 && <span className="mono" title={`행 질의가 아니라 문서 그래프에서 답한 파트입니다 (SQL 번역 미대상: ${p.vskip})`} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99, background: "var(--main)", color: "var(--muted)" }}>📄 문서 그래프</span>}
                <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.count}건</span>
              </div>
              {p.route === "sql" && <JoinChain tables={p.tables} />}
              {p.error ? (
                <div style={{ padding: "16px 18px", color: "var(--red)", fontSize: 12.5 }}>실행 실패 — {p.error}</div>
              ) : p.count === 0 ? (
                <div style={{ padding: "20px 18px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
                  {p.route === "sql" ? "결과 0건 — 정형DB에 해당 조건의 행이 없습니다."
                    : p.vskip ? <>결과 0건 — 가상 SPARQL→SQL 번역 실패 후 그래프 폴백. <span style={{ color: "#c26a12" }}>사유: {p.vskip}</span></>
                    : "결과 0건 — A-Box 미실체화 또는 온톨로지 공백 신호입니다."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  {(() => {
                    // LLM 이 SELECT 한 변수 중 전 행이 비어 있는 컬럼(언바운드 OPTIONAL)은 숨긴다
                    const cols = p.columns.filter((c) => p.rows.some((r2) => r2[c] && (r2[c].value ?? "") !== ""));
                    return (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead><tr>{cols.map((c) => <th key={c} className="mono" style={{ textAlign: "left", padding: "10px 18px", fontSize: 11, color: "var(--muted)", background: "var(--main)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{c}</th>)}</tr></thead>
                        <tbody>
                          {p.rows.map((r2, j) => (
                            <tr key={j}>
                              {cols.map((c) => <td key={c} style={{ padding: "10px 18px", borderBottom: j < p.rows.length - 1 ? "1px solid var(--line)" : "none", verticalAlign: "top", minWidth: 110 }}>{cell(r2[c])}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}
              <details>
                <summary className="mono" style={{ padding: "9px 18px", fontSize: 11, color: "var(--muted)", cursor: "pointer", borderTop: "1px solid var(--line)" }}>
                  {p.method === "virtual" ? "SPARQL + 번역된 SQL 보기" : p.route === "sql" ? "SQL 보기" : "SPARQL 보기"}
                </summary>
                <pre className="mono" style={{ margin: 0, padding: "12px 18px", background: "var(--main)", fontSize: 11, color: "var(--navy)", overflowX: "auto", whiteSpace: "pre-wrap" }}>{p.query}{p.vsql ? `\n\n-- R2RML 번역 (실행된 SQL) --\n${p.vsql}` : ""}</pre>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* 답변 생성 중 표시 */}
      {running && job.stage === "synthesize" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ans-bg)", border: "1.5px dashed var(--ans-line)", borderRadius: 16, padding: "16px 22px", marginBottom: 12, color: "var(--ans-title)", fontSize: 13.5, fontWeight: 600 }}>
          <span style={{ width: 13, height: 13, border: "2px solid var(--ans-line)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          조회 결과를 종합해 최종 답변을 생성하고 있습니다…
        </div>
      )}

      {/* ③ 최종 답변 */}
      {res && !res.error && !isAction && (
        <div style={{ background: "var(--ans-bg)", border: "1.5px solid var(--ans-line)", borderRadius: 16, padding: "18px 22px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 15 }}>✦</span>
            <b style={{ fontSize: 14.5, color: "var(--ans-title)" }}>최종 답변</b>
          </div>
          <Markdown text={res.answer || "결과에서 답변을 합성하지 못했습니다 — 위 파트별 결과를 직접 확인하세요."}
            style={{ fontSize: 14, color: "var(--navy)" }} />
        </div>
      )}

    </div>
  );
}
