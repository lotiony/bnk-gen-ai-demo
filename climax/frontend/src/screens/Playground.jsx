import { useEffect, useMemo, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import GraphRagViewer from "../components/GraphRagViewer";
import Markdown from "../components/Markdown";
import { graphRagAnswerGraph, graphRagCitationEntities, graphRagContextFlow, graphRagReferenceFiles, graphRagReferenceLine, GRAPH_TYPE_COLORS, GRAPH_TYPE_LABELS } from "../lib/graphragGraph";

// Playground — 대화형 에이전트 모니터링. 질문→답변의 ReAct 라운드(SELECT→DESCRIBE→INVOKE)를
// 재구성해 보여주고, SELECT 의 tool 후보·점수와 각 호출 raw req/res 를 Inspector 로 검증한다.
// metric 은 "실제 API 호출 수"(업스트림 invoke)와 "LLM step 수"(메타툴 왕복)를 분리 표기 — 둘은 다르다.

const fmt = (o) => { try { return JSON.stringify(o ?? {}, null, 2); } catch { return String(o); } };
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

// search_apis 결과 문자열 → 후보 목록(점수 포함).
// c.picked 가 명시되면 존중(hybrid 는 판별자가 top1 이 아닌 후보를 고를 수 있음), 없으면 첫 후보.
function parseCands(content) {
  const a = parse(content);
  if (!Array.isArray(a)) return null;
  const hasFlag = a.some((c) => typeof c.picked === "boolean");
  return a.map((c, i) => ({
    nm: c.tool_id || c.op_id || c.name || `후보${i + 1}`,
    score: c.score, picked: hasFlag ? !!c.picked : i === 0,
    // 두 랭커 원순위 — hybrid selector 만 제공(일반 ReAct 의 search_apis 는 안 준다)
    vec: c.vec_rank, bm: c.bm_rank,
  }));
}

const GATE_LABEL = { direct: "게이트 직행 (LLM 스킵)", escalated: "gpt-5-mini 판별",
  escalate_failed: "판별 실패→top1", empty: "후보 없음" };

// 판정 히어로 — "LLM 을 안 부르고 확정했다" 를 눈에 보이게 올린다.
// 지배도 게이지는 [0.5,1] 구간만 그린다(지배도의 정의역). 통과선(threshold)을 눈금으로 찍어
// '규칙이 있고 이 질의가 그 규칙을 넘었다' 를 그림 하나로 전달한다.
const R = 40, C = 2 * Math.PI * R;                    // 게이지 반지름/둘레
const frac = (v) => Math.max(0, Math.min(1, (v - 0.5) / 0.5));

function Verdict({ gate, rounds, ko }) {
  const direct = gate.method === "direct";
  const tok = (gate.input_tokens || 0) + (gate.output_tokens || 0);
  const nCand = rounds?.[0]?.steps?.[0]?.insp?.cands?.length ?? 0;
  const dom = typeof gate.dominance === "number" ? gate.dominance : null;
  const thr = typeof gate.threshold === "number" ? gate.threshold : null;

  return (
    <div className={`pg2-verd ${direct ? "direct" : "judge"}`}>
      {dom != null && (
        <div className="gauge">
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
            <g transform="rotate(-90 46 46)">
              <circle cx="46" cy="46" r={R} fill="none" strokeWidth="8" className="trk" />
              <circle cx="46" cy="46" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
                className="arc" strokeDasharray={`${C * frac(dom)} ${C}`} />
              {thr != null && (
                <circle cx="46" cy="46" r={R} fill="none" strokeWidth="12" className="tick"
                  strokeDasharray={`2 ${C}`} strokeDashoffset={-C * frac(thr)} />
              )}
            </g>
          </svg>
          <div className="val"><b>{dom}</b><span>{ko ? "지배도" : "DOMINANCE"}</span></div>
        </div>
      )}
      <div className="body">
        <div className="hd">
          <span className="badge">{direct ? (ko ? "LLM 호출 없이 확정" : "decided without LLM")
                                          : (GATE_LABEL[gate.method] || gate.method)}</span>
        </div>
        {/* 근거는 판별자가 답했을 때만 있다. 없어도 통과선 비교는 항상 보여준다
            (판별 실패·직행 어느 쪽이든 '규칙이 있다'가 화면에서 사라지면 안 된다) */}
        {(gate.reason || (thr != null && dom != null)) && (
          <div className="why">
            {gate.reason && <>{gate.reason} · </>}
            {thr != null && dom != null && <>{ko ? "지배도" : "dominance"} {dom} {dom >= thr ? "≥" : "<"} {ko ? "통과선" : "gate"} {thr}</>}
          </div>
        )}
        <div className="stats">
          <div><b className={tok === 0 ? "zero" : ""}>{tok.toLocaleString()}</b><span>LLM TOKEN</span></div>
          <div><b>{gate.latency_ms}<small>ms</small></b><span>LATENCY</span></div>
          <div><b>{nCand}</b><span>{ko ? "후보 검토" : "CANDIDATES"}</span></div>
        </div>
        {gate.trace_id && <div className="tid" title={ko ? "라우팅 로그 조회 키" : "routing log key"}>{gate.trace_id}</div>}
      </div>
    </div>
  );
}

// Tool 선택 근거 뷰 — "의미 검색과 키워드 검색이 같은 답을 냈다" 를 보여준다.
// 융합 점수(RRF)는 최댓값이 ≈0.033 이라 폭에 그대로 쓰면 전 후보가 하한선에 붙는다.
// → 1등 대비 비율로 정규화하고 원점수는 숫자로 병기한다.
function CandView({ cands, gate, ko }) {
  const rank = (k) => cands.filter((c) => typeof c[k] === "number").sort((a, b) => a[k] - b[k]).slice(0, 3);
  const vec = rank("vec"), bm = rank("bm");
  const dual = vec.length > 0 && bm.length > 0;
  const agree = dual && vec[0].nm === bm[0].nm;
  const max = Math.max(...cands.map((c) => (typeof c.score === "number" ? c.score : 0)), 0);
  const dom = gate?.dominance, thr = gate?.threshold;

  return (
    <>
      {dual && (
        <>
          <p className="lbl">{ko ? "Tool 선택 근거" : "Why this tool"}</p>
          <div className="pg2-agree">
            <div className="col">
              <div className="ch">{ko ? "의미 검색 (벡터)" : "semantic (vector)"}</div>
              {vec.map((c, i) => (
                <div key={i} className={`rk ${i === 0 && agree ? "top" : ""}`}>
                  <span>{c.nm}</span><b>{i + 1}{ko ? "위" : ""}</b></div>
              ))}
            </div>
            <div className="mid">
              <div className="ch" aria-hidden="true" />
              <div className={`lock ${agree ? "on" : ""}`}>{agree ? "=" : "≠"}</div>
            </div>
            <div className="col">
              <div className="ch">{ko ? "키워드 검색 (BM25)" : "keyword (BM25)"}</div>
              {bm.map((c, i) => (
                <div key={i} className={`rk ${i === 0 && agree ? "top" : ""}`}>
                  <span>{c.nm}</span><b>{i + 1}{ko ? "위" : ""}</b></div>
              ))}
            </div>
          </div>
          <div className="pg2-verdict">
            {agree
              ? <>{ko ? "두 방식이 " : "both rankers agree on "}<b>{ko ? "독립적으로 같은 1순위" : "the same top-1"}</b></>
              : <>{ko ? "두 방식의 1순위가 " : "rankers "}<b>{ko ? "갈림" : "disagree"}</b></>}
            {dom != null && <> · {ko ? "지배도" : "dominance"} {dom}
              {thr != null && <> {dom >= thr ? "≥" : "<"} {thr}</>}</>}
            {gate?.method && <> · {GATE_LABEL[gate.method] || gate.method}</>}
          </div>
        </>
      )}

      <p className={`lbl ${dual ? "mt" : ""}`}>
        {ko ? (dual ? "융합 점수 (1등 대비)" : "Tool 후보 · 점수") : "Fused score"}</p>
      {cands.length === 0 && <div className="pg2-log-empty">{ko ? "후보 없음" : "no candidates"}</div>}
      {cands.map((c, i) => {
        const w = max > 0 && typeof c.score === "number"
          ? Math.max(8, (c.score / max) * 100) : (c.picked ? 100 : 8);
        return (
          <div key={i} className={`pg2-cand ${c.picked ? "picked" : "rej"}`}>
            <div className="bar" style={{ width: w + "%" }} />
            <div className="rowt"><span className="nm">{c.nm}</span>{c.picked && <span className="pt">PICKED</span>}
              <span className="sc">{c.score != null ? c.score : "—"}</span></div>
          </div>
        );
      })}
      <div className="pg2-log-empty" style={{ padding: "10px 0 0", fontSize: 11, textAlign: "left" }}>
        {ko ? "벡터+BM25 를 RRF 로 융합한 점수. 바 길이는 1등 대비 비율입니다."
            : "RRF (vector+BM25). Bar length is relative to top-1."}
      </div>
    </>
  );
}

// agentChat steps(tool/result 교대) → 라운드 배열. search_apis 만나면 새 라운드 시작.
function stepsToRounds(steps) {
  const rounds = [];
  let cur = null;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.type !== "tool") continue;
    const res = steps[i + 1] && steps[i + 1].type === "result" ? steps[i + 1].content : null;
    const tool = s.tool;
    if (tool === "search_apis") {
      cur = { goal: (s.args && s.args.query) || "tool 탐색", steps: [] };
      rounds.push(cur);
      cur.steps.push({ k: "select", name: "search_apis", detail: (s.args && s.args.query) || "",
        insp: { cands: parseCands(res) } });
    } else if (tool === "describe_api") {
      if (!cur) { cur = { goal: "", steps: [] }; rounds.push(cur); }
      cur.steps.push({ k: "describe", name: "describe_api", detail: (s.args && s.args.tool_id) || "",
        insp: { req: fmt(s.args), res, status: "OK" } });
    } else {
      if (!cur) { cur = { goal: tool, steps: [] }; rounds.push(cur); }
      const tid = (s.args && s.args.tool_id) || tool;
      cur.steps.push({ k: "invoke", name: tool === "invoke_api" ? "invoke_api" : tool, detail: tid,
        api: true, insp: { req: fmt(s.args), res, status: "200 OK" } });
    }
  }
  return rounds;
}

// skill run trace → 단일 라운드(steps: mcp/prompt)
function skillToRounds(slug, trace) {
  return [{ goal: `/${slug}`, steps: (trace || []).map((p) => p.type === "mcp"
    ? { k: "invoke", name: p.tool_id, detail: "mcp step", api: true,
        insp: { req: fmt(p.request), res: p.status === "ok" ? fmt(p.response) : String(p.error || ""), status: p.status === "ok" ? "200 OK" : "error" } }
    : { k: "skill", name: "prompt", detail: p.text, insp: { obs: p.text } }) }];
}

const KIND = { select: "tool 선택", describe: "명세 확인", invoke: "API 호출", skill: "프롬프트" };

const segBtn = (on) => ({
  padding: "5px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
  background: on ? "var(--purple,#7a5cff)" : "transparent",
  color: on ? "#fff" : "var(--muted,#8b93a7)",
});
function ContextFlow({ steps, ko }) {
  return (
    <div className="pg2-context-flow">
      {steps.map((step) => {
        const type = String(step.entity_type || "unknown").toLowerCase().replace(/[\s_-]+/g, "");
        const path = step.pathToNext;
        const via = path?.nodes.slice(1, -1) || [];
        const relation = path?.relations.map((item) => item.keywords || String(item.description || "").split("<SEP>")[0]).filter(Boolean).join(" → ");
        return (
          <div className="pg2-context-step" key={`${step.order}-${step.entity_name}`}>
            <div className="pg2-context-node" style={{ "--node-color": GRAPH_TYPE_COLORS[type] || GRAPH_TYPE_COLORS.unknown }} title={String(step.description || "").replaceAll("<SEP>", "\n")}>
              <span className="order">{step.order}</span><i />
              <div><em>{GRAPH_TYPE_LABELS[type] || "Unknown"}</em><b>{step.entity_name}</b>
                <p>{String(step.description || "").split("<SEP>")[0]}</p></div>
            </div>
            {step.order < steps.length && (
              <div className={`pg2-context-link${path ? "" : " disconnected"}`}>
                <span>↓</span>
                <div><b>{path ? (via.length ? `${ko ? "경유" : "via"} ${via.join(" → ")}` : (ko ? "직접 연결" : "direct link")) : (ko ? "다음 컨텍스트 엔티티" : "next context entity")}</b>
                  {relation && <small>{relation}</small>}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReferenceList({ entry, ko, onReference }) {
  const references = Array.isArray(entry?.references) ? entry.references : [];
  if (!references.length) return <div className="pg2-context-empty"><IllustInspect /><div>{ko ? "검색 Reference가 없습니다." : "No search references."}</div></div>;
  return <div className="pg2-reference-list">{references.map((reference, index) => {
    const value = typeof reference === "string" ? { file_path: reference } : reference;
    const name = value.file_path || value.file_name || value.document_name || entry.documentName || "document";
    const page = value.page_number || value.page;
    return <button type="button" className="pg2-reference-card" key={`${value.reference_id || index}-${name}`} onClick={() => onReference(value)}>
      <span>[{value.reference_id ?? index + 1}]</span><div><b>{name}{page ? ` · p.${page}` : ""}</b>
        {value.content && <p>{value.content}</p>}</div>
    </button>;
  })}</div>;
}

const THINKING_COPY = {
  graphrag: {
    ko: ["그래프를 탐색하고 있어요", "관련 엔티티를 확인하고 있어요", "연결 관계를 분석하고 있어요", "근거를 바탕으로 답변을 작성하고 있어요"],
    en: ["Exploring the graph", "Checking related entities", "Analyzing relationships", "Writing an evidence-based answer"],
  },
  aisearch: {
    ko: ["AI Search에서 문서를 검색하고 있어요", "검색 근거를 확인하고 있어요", "근거를 바탕으로 답변을 작성하고 있어요"],
    en: ["Searching documents with AI Search", "Reviewing the search evidence", "Writing an evidence-based answer"],
  },
  default: {
    ko: ["요청을 살펴보고 있어요", "필요한 도구를 확인하고 있어요", "결과를 정리하고 있어요"],
    en: ["Reviewing your request", "Checking the required tools", "Organizing the result"],
  },
};

function ThinkingMessage({ mode, ko }) {
  const [index, setIndex] = useState(0);
  const copy = THINKING_COPY[mode][ko ? "ko" : "en"];
  const orb = mode === "graphrag" || mode === "aisearch";
  useEffect(() => {
    setIndex(0);
    const timer = window.setInterval(() => setIndex((value) => orb ? (value + 1) % copy.length : Math.min(value + 1, copy.length - 1)), 3200);
    return () => window.clearInterval(timer);
  }, [copy, orb]);
  return <div className={`pg2-msg a pg2-thinking${orb ? " orb" : ""}`}>
    {orb ? <ThinkingOrb state="connecting" size={64} speed={3} aria-label={ko ? "검색 연결 중" : "Connecting search"} /> : <i />}
    <span key={copy[index]}>{copy[index]}</span>
  </div>;
}

function ChatAnswer({ entry, onReference }) {
  const lines = String(entry.text || "").split("\n");
  const fileReferences = graphRagReferenceFiles(entry.text, entry.references);
  const blocks = [];
  let markdown = [];
  const flush = () => {
    if (!markdown.length) return;
    const text = markdown.join("\n");
    blocks.push(<Markdown key={`md-${blocks.length}`} text={text}
      renderText={({ text: value, source, offset, key }) => {
        const marker = [...source.matchAll(/\[(\d+)\]/g)].find((match) => match.index >= offset + value.length);
        if (!marker) return value;
        const fileName = fileReferences.get(marker[1]) || "";
        const entities = fileName && entry.graphEvidence ? graphRagCitationEntities(entry.graphEvidence, source, marker.index, fileName) : [];
        const matches = entities.flatMap((entity) => {
          const found = [];
          const lower = value.toLocaleLowerCase();
          const needle = entity.toLocaleLowerCase();
          for (let start = lower.indexOf(needle); start >= 0; start = lower.indexOf(needle, start + needle.length)) found.push({ start, end: start + entity.length, entity });
          return found;
        }).sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
        if (!matches.length) return value;
        const rendered = [];
        let cursor = 0;
        matches.forEach((match, index) => {
          if (match.start < cursor) return;
          if (match.start > cursor) rendered.push(value.slice(cursor, match.start));
          rendered.push(<button key={`${key}-${index}`} type="button" className="pg2-entity-link" title={`${match.entity} 그래프 보기`} onClick={(event) => { event.stopPropagation(); onReference(fileName, match.entity); }}>{value.slice(match.start, match.end)}</button>);
          cursor = match.end;
        });
        if (cursor < value.length) rendered.push(value.slice(cursor));
        return rendered;
      }}
      renderReference={({ number }) => {
        const fileName = fileReferences.get(number) || "";
        if (!fileName) return "";
        return <button type="button" className="pg2-citation-link" title={`${fileName} 원문 근거 보기`} onClick={(event) => { event.stopPropagation(); onReference(fileName, null, number); }}>[{number}]</button>;
      }} />);
    markdown = [];
  };

  lines.forEach((line) => {
    const reference = graphRagReferenceLine(line);
    if (!reference) { markdown.push(line); return; }
    flush();
    blocks.push(<div key={`ref-${reference.number}`} className="pg2-reference-item">
      <button type="button" className="pg2-reference-link" onClick={(event) => { event.stopPropagation(); onReference(reference.fileName); }}>[{reference.number}] : 검색 근거 그래프</button>
      <span>, 출처: {reference.fileName}</span>
    </div>);
  });
  flush();
  return blocks;
}

// 세련된 인라인 일러스트 (아이콘/이모지 대신) — 노드 탐색 + 대화 컨셉, 브랜드 그라디언트
function IllustExplore() {
  return (
    <svg className="illu-float" width="132" height="112" viewBox="0 0 132 112" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pgG1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00b5a6" /><stop offset="1" stopColor="#7a5cff" />
        </linearGradient>
        <linearGradient id="pgG2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00b5a6" stopOpacity=".18" /><stop offset="1" stopColor="#7a5cff" stopOpacity=".14" />
        </linearGradient>
      </defs>
      <rect x="18" y="20" width="96" height="60" rx="16" fill="url(#pgG2)" />
      <path d="M40 96c0-6 5-10 11-10h30c6 0 11 4 11 10v0c0 2-2 3-4 2l-8-4H52l-8 4c-2 1-4 0-4-2Z" fill="url(#pgG2)" />
      <circle cx="42" cy="42" r="9" fill="url(#pgG1)" />
      <circle cx="90" cy="36" r="7" fill="#fff" stroke="url(#pgG1)" strokeWidth="2.5" />
      <circle cx="82" cy="62" r="6" fill="#fff" stroke="url(#pgG1)" strokeWidth="2.5" />
      <path d="M50 44 82 60M49 39 84 37" stroke="url(#pgG1)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="42" cy="42" r="3" fill="#fff" />
    </svg>
  );
}
function IllustInspect() {
  return (
    <svg className="illu-float" width="108" height="96" viewBox="0 0 108 96" fill="none" aria-hidden="true">
      <defs><linearGradient id="pgG3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00b5a6" /><stop offset="1" stopColor="#7a5cff" /></linearGradient></defs>
      <rect x="22" y="16" width="64" height="14" rx="7" fill="#00b5a6" opacity=".16" />
      <rect x="22" y="40" width="52" height="14" rx="7" fill="#7a5cff" opacity=".16" />
      <rect x="22" y="64" width="40" height="14" rx="7" fill="#00b5a6" opacity=".16" />
      <circle cx="76" cy="70" r="18" fill="#fff" stroke="url(#pgG3)" strokeWidth="3" />
      <path d="M88 82l10 10" stroke="url(#pgG3)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* 슬래시 커맨드의 뒷부분 → 스킬이 선언한 필드.
   스킬도 툴이라 자기 파라미터를 갖는데, 채팅 한 줄은 문장 하나다. `이름=값` 으로 받는다:
   추측이 없고, MCP 클라이언트가 필드별로 묻는 모양과도 같다.
   선언이 없으면 예전처럼 문장 하나 그대로. 필드가 하나뿐이면 문장이 곧 그 값이다. */
function skillArgs(skill, rest) {
  const fields = skill.inputs || [];
  const text = (rest || "").trim();
  if (!fields.length) return text;
  const names = fields.map((f) => f.name);
  const out = {};
  // 값에 공백이 들어갈 수 있다("암 진단비") — 다음 `이름=` 이 나오기 전까지가 한 값이다.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${names.map(esc).join("|")})\\s*=\\s*`, "g");
  const hits = [...text.matchAll(re)];
  hits.forEach((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    out[m[1]] = text.slice(m.index + m[0].length, end).trim();
  });
  if (hits.length) return out;
  const need = fields.filter((f) => f.required);
  return need.length === 1 ? { [need[0].name]: text } : out;   // 자리가 여럿이면 서버가 무엇이 빈지 말한다
}

export default function Playground({ t, lang }) {
  const ko = lang === "ko";
  const { activeId } = useProjects();
  const [msgs, setMsgs] = useState([]);          // {role:'u'|'a'|'err', text, rounds?, apiCalls?, llmSteps?, gate?}
  const [input, setInput] = useState("");
  const [sel, setSel] = useState("llm");         // tool selector: 'llm'(ReAct) | 'hybrid'(임베딩+mini)
  const [sending, setSending] = useState(false);
  const [thinkingMode, setThinkingMode] = useState("default");
  const [skills, setSkills] = useState([]);
  const [ragTargets, setRagTargets] = useState([]);
  const [ragWorkspaces, setRagWorkspaces] = useState({});
  const [appMode, setAppMode] = useState(null);
  const [selMsg, setSelMsg] = useState(null);    // 선택 답변 index
  const [selStep, setSelStep] = useState({ r: 0, s: 0 });
  const [graphModal, setGraphModal] = useState(null);
  const [referenceModal, setReferenceModal] = useState(null);
  const bodyRef = useRef(null);
  const requestAbort = useRef(null);

  useEffect(() => { api.listSkills().then((d) => setSkills(d.results || [])).catch(() => setSkills([])); }, [activeId]);
  useEffect(() => { api.runtime().then((value) => setAppMode(value.app_mode)).catch(() => {}); }, []);
  useEffect(() => () => requestAbort.current?.abort(), []);
  useEffect(() => {
    let cancelled = false;
    if (!activeId) { setRagTargets([]); setRagWorkspaces({}); return undefined; }
    api.ragPipelineResultDocuments({ projectId: activeId, limit: 100 })
      .then((d) => {
        if (!cancelled) {
          const items = d.items || [];
          setRagTargets([...new Set(items.map((item) => item.target))]);
          setRagWorkspaces(Object.fromEntries(items.map((item) => [item.target, item.workspace])));
        }
      })
      .catch(() => { if (!cancelled) { setRagTargets([]); setRagWorkspaces({}); } });
    return () => { cancelled = true; };
  }, [activeId]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, sending]);

  const slashOpen = input.startsWith("/") && !input.includes(" ");
  const ragCommands = [
    { id: "graphrag", slug: "graphrag", name: "완료 문서 GraphRAG MCP 검색" },
    { id: "aisearch", slug: "aisearch", name: "완료 문서 AI Search MCP 검색" },
  ].filter((command) => ragTargets.includes(command.id === "aisearch" ? "ai_search" : command.id));
  const slashHits = slashOpen ? [...ragCommands, ...skills].filter((s) => ("/" + s.slug).startsWith(input.toLowerCase())).slice(0, 6) : [];

  const answer = selMsg != null ? msgs[selMsg] : null;
  const rounds = answer?.rounds || [];
  const curStep = rounds[selStep.r]?.steps[selStep.s] || null;
  const modalGraph = useMemo(() => graphModal
    ? graphRagAnswerGraph(graphModal.entry.graphEvidence, graphModal.entry.text, graphModal.fileName)
    : null, [graphModal]);

  useEffect(() => {
    if (!graphModal && !referenceModal) return undefined;
    const close = (event) => {
      if (event.key === "Escape") { setGraphModal(null); setReferenceModal(null); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [graphModal, referenceModal]);

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;
    let controller = null;
    setInput("");
    setMsgs((m) => [...m, { role: "u", text: q }]);
    setThinkingMode(q.match(/^\/(graphrag|aisearch)(?:\s|$)/i)?.[1].toLowerCase() || "default");
    setSending(true);
    try {
      const sl = q.match(/^\/(\S+)\s*([\s\S]*)$/);
      const skill = sl ? skills.find((s) => s.slug === sl[1]) : null;
      let entry;
      if (["graphrag", "aisearch"].includes(sl?.[1].toLowerCase())) {
        const command = sl[1].toLowerCase();
        const query = sl[2].trim();
        if (!query) throw new Error(ko ? `/${command} 뒤에 질의를 입력하세요.` : `Enter a query after /${command}.`);
        if (command === "graphrag") {
          const mode = appMode || (await api.runtime()).app_mode;
          if (mode !== "preview") {
            controller = new AbortController();
            requestAbort.current = controller;
          }
          const result = await api.playgroundGraphRagQuery({
            query, workspace: ragWorkspaces.graphrag, projectId: activeId,
            appMode: mode, signal: controller?.signal,
          });
          const { answer, evidence } = result;
          const data = evidence || {};
          entry = {
            role: "a", text: answer || "(응답 없음)", kind: "graphrag",
            contextFlow: graphRagContextFlow(data), graphEvidence: data,
            entityCount: data.entities?.length || 0, relationCount: data.relationships?.length || 0,
            references: result.references || data.references || [], documentName: result.documentName,
            rounds: [{ goal: query, steps: [] }], apiCalls: result.apiCalls, llmSteps: 1, toolId: result.toolId,
          };
        } else {
          const invoked = await api.projectRagQuery("ai_search", query, activeId);
          const body = invoked.response?.body || {};
          const hits = Array.isArray(body.value) ? body.value : [];
          entry = {
            role: "a", kind: "aisearch", documentName: invoked.document.filename,
            text: invoked.answer || "검색 결과가 없습니다.",
            references: hits.map((hit, index) => ({ reference_id: index + 1, file_path: invoked.document.filename, page_number: hit.page_number || hit.page_end, content: hit.content })),
            rounds: [{ goal: query, steps: [] }], apiCalls: 1, llmSteps: 1, toolId: invoked.tool_id,
          };
        }
      } else if (skill) {
        const d = await api.runSkill(skill.id, skillArgs(skill, sl[2]));
        const rr = skillToRounds(skill.slug, d.trace);
        // 답변은 합성된 문장이 우선. 합성이 죽었을 때만 마지막 step 원문으로 떨어진다(degraded).
        const done = ko ? `/${skill.slug} 실행 완료.` : `/${skill.slug} done.`;
        const fallback = done + (d.final != null ? "\n\n```json\n" + fmt(d.final) + "\n```" : "");
        entry = { role: "a", text: d.ok ? (d.answer || fallback) : `실행 중단: ${d.error}`,
          rounds: rr, kind: "skill", apiCalls: rr[0].steps.filter((s) => s.api).length,
          // 합성 LLM 1콜 — MCP step 재생은 LLM 을 쓰지 않는다.
          llmSteps: d.answer ? 1 : 0, degraded: !!d.degraded };
      } else {
        const d = sel === "hybrid" ? await api.agentHybrid(q) : await api.agentChat(q);
        const rr = stepsToRounds(d.steps || []);
        const all = rr.flatMap((r) => r.steps);
        entry = { role: "a", text: d.reply || "(응답 없음)", rounds: rr, kind: sel,
          apiCalls: all.filter((s) => s.api).length, llmSteps: all.length, gate: d.gate || null };
      }
      setMsgs((m) => { const next = [...m, entry]; setSelMsg(next.length - 1); setSelStep({ r: 0, s: 0 }); return next; });
    } catch (e) {
      if (e.name === "AbortError") return;
      setMsgs((m) => [...m, { role: "err", text: `${ko ? "에이전트 실행 실패" : "agent failed"}: ${e.message}` }]);
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
      setSending(false);
    }
  };

  const pickMsg = (i) => { setSelMsg(i); setSelStep({ r: 0, s: 0 }); };

  return (
    <div className="skl-page">
      <div className="skl-head">
        <div className="skl-mark" style={{ background: "var(--purple-bg)", color: "var(--purple)", overflow: "hidden" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="pgm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00b5a6" /><stop offset="1" stopColor="#7a5cff" /></linearGradient></defs>
            <path d="M9 4h6a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-3l-4 3v-3a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="url(#pgm)" opacity=".9" /></svg>
        </div>
        <div>
          <h1>{t.navPlayground}</h1>
          <p>{ko ? "대화형 에이전트 모니터링 — 라운드별 tool 선택·API 호출·/skill 검증" : "Conversational agent monitoring — per-round tool selection, API calls, /skill"}</p>
        </div>
      </div>

      <div className="pg2">
        {/* 좌: 대화 */}
        <div className="pg2-chat">
          <div className="hd">{ko ? "대화" : "Conversation"}<span className="sess">agent · session</span></div>
          <div className="pg2-body" ref={bodyRef}>
            {msgs.length === 0 ? (
              <div className="pg2-empty">
                <IllustExplore />
                <div className="cap">{ko ? <>질문을 입력하면 에이전트가 <b>tool 을 탐색·호출</b>하는 과정을 라운드별로 보여줍니다.<br /><span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>/skill</span> 로 Skill 도 테스트하세요.</> : <>Ask a question to watch the agent <b>explore and call tools</b> round by round.</>}</div>
              </div>
            ) : msgs.map((m, i) => {
              if (m.role === "u") return <div key={i} className="pg2-msg u">{m.text}</div>;
              if (m.role === "err") return <div key={i} className="pg2-msg err">{m.text}</div>;
              return (
                <div key={i} className={`pg2-msg a ${selMsg === i ? "on" : ""}`} onClick={() => pickMsg(i)}>
                  <ChatAnswer entry={m} onReference={(fileName, entityName = null, referenceNumber = null) => {
                    pickMsg(i);
                    if (m.kind === "graphrag" && m.graphEvidence) setGraphModal({ entry: m, fileName, entityName });
                    if (m.kind === "aisearch") {
                      const reference = (m.references || []).find((item) => String(item.reference_id) === String(referenceNumber));
                      if (reference) setReferenceModal(reference);
                    }
                  }} />
                  <div className="rowmeta">
                    <span className={`pg2-tag ${m.kind === "skill" ? "skill" : "api"}`}>{m.rounds.length} {ko ? "라운드" : "rounds"}</span>
                    <span className="pg2-tag api">API {m.apiCalls}</span>
                    <span className="pg2-tag step">LLM step {m.llmSteps}</span>
                    {m.degraded && <span className="pg2-tag warn">{ko ? "요약 생성 실패" : "summary failed"}</span>}
                  </div>
                </div>
              );
            })}
            {sending && <ThinkingMessage mode={thinkingMode} ko={ko} />}
          </div>
          <div className="pg2-in">
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--muted,#8b93a7)", fontWeight: 600 }}>Tool Selector</span>
              <div style={{ display: "inline-flex", border: "1px solid var(--line,#2a2f3d)", borderRadius: 8, overflow: "hidden" }}>
                <button onClick={() => setSel("llm")} style={segBtn(sel === "llm")}>{ko ? "일반 · LLM (ReAct)" : "General · LLM"}</button>
                <button onClick={() => setSel("hybrid")} style={segBtn(sel === "hybrid")}>Hybrid · 임베딩+mini</button>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted,#8b93a7)" }}>
                {sel === "hybrid"
                  ? (ko ? "임베딩 게이트 + gpt-5-mini 판별" : "embedding gate + gpt-5-mini judge")
                  : (ko ? "LLM 이 search→pick 주도 (gpt-5.2)" : "LLM-driven ReAct")}
              </span>
            </div>
            <div className="pg2-quick">
                {ragCommands.map((command) => (
                  <button key={command.id} className="pg2-qchip" onClick={() => setInput(`/${command.slug} `)}>/{command.slug}</button>
                ))}
                {skills.slice(0, 2).map((s) => (
                  <button key={s.id} className="pg2-qchip" onClick={() => setInput("/" + s.slug + " ")}>/{s.slug}</button>
                ))}
            </div>
            <div className="pg2-inrow">
              {slashOpen && slashHits.length > 0 && (
                <div className="pg2-slash">
                  {slashHits.map((s) => (
                    <div key={s.id} className="it" onClick={() => setInput("/" + s.slug + " ")}>
                      <span className="mono">/{s.slug}</span><span>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder={ko ? '질문 입력 — /graphrag 보험상품가입' : 'Ask — /graphrag insurance enrollment'} />
              {sending && thinkingMode === "graphrag" && appMode !== "preview" &&
                <button className="pg2-stop" onClick={() => requestAbort.current?.abort()}>{ko ? "중지" : "Stop"}</button>}
              <button className="pg2-send" disabled={sending} onClick={send}>{ko ? "전송" : "Send"}</button>
            </div>
          </div>
        </div>

        {/* 우: GraphRAG context 또는 일반 tool 실행 상세 */}
        <div className="pg2-log">
          {(!answer || ["graphrag", "aisearch"].includes(answer.kind)) ? (
            <div className="pg2-card pg2-graphrag-card">
              <div className="hd">Reference
                {answer && <span className="sub">{answer.toolId}</span>}
              </div>
              {answer
                ? <><ReferenceList entry={answer} ko={ko} onReference={(reference) => {
                      if (answer.kind === "aisearch") setReferenceModal(reference);
                      else if (answer.graphEvidence) setGraphModal({ entry: answer, fileName: reference.file_path || reference.file_name || answer.documentName, entityName: null });
                    }} />
                    {answer.kind === "graphrag" && answer.contextFlow?.length > 0 && <ContextFlow steps={answer.contextFlow} ko={ko} />}</>
                : <div className="pg2-context-empty"><IllustInspect /><div>{ko ? "질문을 수행하면 검색 Reference가 표시됩니다." : "Run a query to display search references."}</div></div>}
            </div>
          ) : (
            <>
              {/* 게이트 판정 — hybrid selector 로 실행했을 때만. 라운드보다 위에 둔다
                  ('LLM 을 안 부르고 확정' 이 이 화면에서 가장 먼저 읽혀야 하는 사실) */}
              {answer.gate && (
                <div className="pg2-card">
                  <div className="hd">{ko ? "게이트 판정" : "Gate verdict"}<span className="sub">hybrid selector</span></div>
                  <Verdict gate={answer.gate} rounds={rounds} ko={ko} />
                </div>
              )}

              <div className="pg2-card">
                <div className="hd">{ko ? "라운드 타임라인" : "Round timeline"}<span className="sub">{rounds.length} {ko ? "라운드" : "rounds"}</span></div>
                <div className="pg2-rounds">
                  {rounds.length === 0 && <div className="pg2-log-empty">{ko ? "tool 호출 없이 바로 응답했습니다." : "answered without tool calls."}</div>}
                  {rounds.map((rd, ri) => (
                    <div key={ri} className="pg2-round">
                      <div className="pg2-rh"><span className="n">{ri + 1}</span><span>Round {ri + 1}</span><span className="goal">· {rd.goal}</span></div>
                      {rd.steps.map((st, si) => (
                        <div key={si} className={`pg2-step ${selStep.r === ri && selStep.s === si ? "on" : ""}`} onClick={() => setSelStep({ r: ri, s: si })}>
                          <span className={`k ${st.k}`} />
                          <div className="b"><div className="t">{st.name}<span className="kind">{KIND[st.k]}</span></div><div className="d">{st.detail}</div></div>
                          {st.lat && <span className="lat">{st.lat}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pg2-card">
                <div className="hd">{ko ? "Inspector" : "Inspector"}<span className="sub">{curStep ? `R${selStep.r + 1} · ${curStep.name}` : "—"}</span></div>
                <div className="pg2-ib">
                  {!curStep ? <div className="pg2-log-empty">{ko ? "step 을 선택하세요" : "select a step"}</div>
                    : curStep.insp.cands ? (
                      <CandView cands={curStep.insp.cands} gate={answer.gate} ko={ko} />
                    ) : curStep.insp.req !== undefined ? (
                      <>
                        <div style={{ marginBottom: 10 }}><span className="pg2-pill">{curStep.insp.status}</span></div>
                        <p className="lbl">Request</p><pre>{curStep.insp.req}</pre>
                        <p className="lbl mt">Response</p><pre>{curStep.insp.res || "—"}</pre>
                      </>
                    ) : (
                      <><p className="lbl">{ko ? "프롬프트 / 관측" : "Prompt / observation"}</p>
                        <div className="pg2-log-empty" style={{ textAlign: "left", padding: 0, color: "var(--text)" }}>{curStep.insp.obs}</div></>
                    )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {graphModal && (
        <div className="pg2-graph-modal" role="presentation" onMouseDown={() => setGraphModal(null)}>
          <section className="pg2-graph-dialog" role="dialog" aria-modal="true" aria-label={`${graphModal.fileName} 답변 엔티티 그래프`} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>REFERENCE PDF</span><b>{graphModal.fileName}</b></div><small>답변에 사용된 엔티티 {modalGraph.nodes.length} · 관계 {modalGraph.edges.length}</small>
              <button type="button" aria-label="그래프 모달 닫기" onClick={() => setGraphModal(null)}>×</button></header>
            <GraphRagViewer data={modalGraph} embedded initialSelected={graphModal.entityName} />
          </section>
        </div>
      )}
      {referenceModal && (
        <div className="pg2-graph-modal" role="presentation" onMouseDown={() => setReferenceModal(null)}>
          <section className="pg2-graph-dialog pg2-reference-dialog" role="dialog" aria-modal="true" aria-label="AI Search 청크 전문" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>AI SEARCH CHUNK</span><b>{referenceModal.file_path || referenceModal.file_name || "document"}</b></div>
              <small>{referenceModal.page_number || referenceModal.page ? `p.${referenceModal.page_number || referenceModal.page}` : ""}</small>
              <button type="button" aria-label="청크 모달 닫기" onClick={() => setReferenceModal(null)}>×</button></header>
            <article className="pg2-reference-content">{referenceModal.content || "표시할 청크 내용이 없습니다."}</article>
          </section>
        </div>
      )}
    </div>
  );
}
