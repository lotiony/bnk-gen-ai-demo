import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { methodStyle } from "../i18n";
import { useProjects } from "../ProjectContext";
import ExplorerHero from "./ExplorerHero";
import ConnectTab from "./ConnectTab";
import { detectMode, parseCond, filterChips, recentQueries, pushQuery } from "./explorerSearch";
import { detachNavigation, mergeExplorerBrowseResults, updateCapabilityEnabled } from "../lib/resourceRegistry";

/** 작은 켜짐/꺼짐 스위치 */
function MiniSwitch({ on, onClick, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={on ? "사용 중, 클릭하면 끄기" : "꺼짐, 클릭하면 켜기"}
      disabled={disabled} onClick={onClick} title={on ? "사용 중 (클릭하면 끄기)" : "꺼짐 (클릭하면 켜기)"}
      style={{ width: 30, height: 17, border: 0, padding: 0, borderRadius: 9, background: on ? "var(--green)" : "var(--line2)",
        position: "relative", cursor: disabled ? "wait" : "pointer", flexShrink: 0, transition: "background .15s", opacity: disabled ? .62 : 1 }}>
      <span aria-hidden="true" style={{ position: "absolute", top: 2, left: on ? 15 : 2, width: 13, height: 13, borderRadius: "50%",
        background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </button>
  );
}

function srcCategory(source) {
  const p = (source || "").split(":", 1)[0];
  if (p === "openapi") return "server";
  if (p === "rag-result") return "doc";
  if (p === "image") return "doc";
  if (p === "db") return "db";
  return "other";
}
const ExpIcon = (st, s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={st} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="3" width="7" height="7" rx="1.5" /><path d="M10 21V8a2 2 0 0 0-2-2H3v15h15v-5a2 2 0 0 0-2-2Z" /></svg>;
const Ink = { margin: 0, background: "var(--code)", color: "var(--code-text)", borderRadius: 14, padding: "16px 18px", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre" };

export default function Explorer({ t, lang, nav, go }) {
  const ko = lang === "ko";
  const { activeId } = useProjects();
  const [q, setQ] = useState("");
  const [chip, setChip] = useState(nav?.source && nav.source !== "all" ? nav.source : "all");
  const [methods, setMethods] = useState([]); // 선택된 HTTP method (다중)
  const [readOnly, setReadOnly] = useState(false); // 읽기전용(mutating 제외)만
  const [svc, setSvc] = useState(""); // 서비스(tags[0]) 필터, "" = 전체
  const [sort, setSort] = useState("score"); // score | name | method
  const [list, setList] = useState([]); // 표시용(쿼리+필터 반영)
  const [pool, setPool] = useState([]); // facet 옵션·카운트용(쿼리만 반영, 필터 무시)
  const [selId, setSelId] = useState(null);
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("spec");
  const [specView, setSpecView] = useState("openapi");
  const [args, setArgs] = useState({});
  const [allowMut, setAllowMut] = useState(false);
  const [inv, setInv] = useState(null);
  const [modal, setModal] = useState(false);
  const deb = useRef();
  const navigationToolRef = useRef("");
  const togglePendingRef = useRef(new Set());
  const [togglePending, setTogglePending] = useState(() => new Set());

  const [asking, setAsking] = useState(false);     // 맥락 검색(LLM) 진행 중 — 중지 버튼이 필요한 구간
  const [searching, setSearching] = useState(false); // 키워드·조건 검색 진행 중
  const [degraded, setDegraded] = useState(false); // 맥락 검색 실패 → 키워드 결과로 폴백했음
  const [autoF, setAutoF] = useState({});      // 질의에서 자동 추출된 조건 — 칩에 배지로 표시
  const [recentQ, setRecentQ] = useState(recentQueries());
  const mode = detectMode(q);
  /* 자연어 검색 중단 — LLM 왕복이라 수 초 걸린다. 잘못 물었을 때 기다리게 두면 안 된다 */
  const askAbort = useRef(null);
  const stopAsk = () => { askAbort.current?.abort(); askAbort.current = null; setAsking(false); };

  // method/service/mutating 필터를 백엔드로 전달 → top_k 잘림으로 매치가 사라지는 것 방지
  const facetParams = () => {
    const f = {};
    if (methods.length) f.method = methods;
    if (svc) f.service = svc;
    if (readOnly) f.mutating = false;
    return f;
  };
  const loadPool = (query) => api.search(query).then((d) => setPool(d.results || [])).catch(() => {});
  /* 첫 항목 포커싱은 여기서 하지 않는다 — 서버 응답 순서와 화면 순서(칩·정렬 적용)가
     다를 수 있어, "화면의 첫 줄"을 고르려면 렌더 직전 목록을 봐야 한다. 아래 useEffect 담당. */
  const loadList = (query) => api.search(query, facetParams()).then((d) => setList(d.results || [])).catch(() => {});

  /* 키워드 검색은 로컬에서 수십 ms 만에 끝나 결과가 "그냥 바뀌어" 있다. 눌렀는데 아무 일도
     안 일어난 것처럼 보이므로, 스피너를 최소 320ms 는 띄워 검색이 돌았다는 사실을 남긴다.
     (실제 응답을 늦추는 게 아니라 표시 시간만 바닥을 깐다) */
  const runSearch = (query) => {
    setSearching(true);
    return Promise.all([
      loadPool(query), loadList(query),
      new Promise((r) => setTimeout(r, 320)),
    ]).finally(() => setSearching(false));
  };

  // 최초 조회 + 활성 프로젝트 변경 시 재조회 + 첫 항목 재선택.
  // activeId 가 확정되기 전엔 아무것도 부르지 않는다 — api.js 의 _activeProjectId 는
  // ProjectProvider.refresh() 가 비동기로 채우므로, 그 전에 나간 요청은 project_id 없이
  // 나가고 백엔드가 기본 프로젝트로 폴백한다. 그 응답이 늦게 도착하면 올바른 목록을
  // 덮어써, 변환한 MCP 대신 시드 데이터가 그대로 굳어버린다.
  // ?tool=xxx 로 들어온 첫 진입은 그 tool 을 봐야 한다 — 목록 도착 후 첫 줄 자동 포커싱이
  // 이걸 덮어쓰지 않도록 한 번만 양보시킨다.
  const pinned = useRef(null);
  useEffect(() => {
    if (!activeId) return;
    const pre = nav?.tool || new URLSearchParams(location.search).get("tool");
    let cancelled = false;
    setSelId(null); setSel(null);
    if (pre) {
      pinned.current = pre;
      navigationToolRef.current = pre;
      setQ(""); setAutoF({});
      setMethods([]); setSvc(""); setReadOnly(false); setSort("score"); setChip("all");
      Promise.all([api.search(""), api.search(pre)])
        .then(([all, matching]) => {
          if (cancelled) return;
          const results = mergeExplorerBrowseResults(
            all.results || [], matching.results || [], pre,
          );
          setPool(results); setList(results);
          navigationToolRef.current = "";
        })
        .catch(() => { navigationToolRef.current = ""; });
      select(pre).catch(() => {
        if (!cancelled) { setSelId(null); setSel(null); }
      });
    } else {
      loadPool("");
      if (nav?.view === "all") {
        setChip("all"); loadList("");
      }
    }
    return () => { cancelled = true; };
  }, [activeId, nav?.tool, nav?.view]); // eslint-disable-line react-hooks/exhaustive-deps
  // facet 변경 시 표시 목록만 재조회(옵션 풀은 유지)
  useEffect(() => { if (activeId && !navigationToolRef.current) loadList(q); }, [methods, svc, readOnly]);
  const onQuery = (v) => {
    setQ(v);
    clearTimeout(deb.current);
    if (detectMode(v) !== "kw") return;   // LLM 이 나가는 모드를 타이핑마다 때리지 않는다 — Enter 로만
    deb.current = setTimeout(() => runSearch(v), 250);   // 포커싱은 목록 갱신 effect 가 처리
  };

  /** 입력 한 줄을 모드(키워드·조건·맥락)에 맞게 실행한다. 화면은 하나뿐이라 진입점도 하나다. */
  const submit = async (raw) => {
    const text = (raw ?? q).trim();
    if (!text) return;
    if (raw != null) setQ(text);
    const m = detectMode(text);
    setDegraded(false); setAutoF({});
    pushQuery(text); setRecentQ(recentQueries());

    if (m === "cond") {
      const { filters, rest } = parseCond(text);
      setMethods(filters.method || []); setSvc(filters.service || "");
      setReadOnly(filters.mutating === false); setSort(filters.sort || "score");
      setAutoF(filters);
      setSearching(true);
      const [d] = await Promise.all([api.search(rest, filters).catch(() => null),
                                     new Promise((r) => setTimeout(r, 320))]);
      if (d) { setList(d.results || []); setPool(d.results || []); }
      setSearching(false);
      return;
    }
    if (m === "ask") {
      setAsking(true);
      askAbort.current?.abort();
      const ctl = new AbortController();
      askAbort.current = ctl;
      try {
        const d = await api.ask(text, ctl.signal);
        if (ctl.signal.aborted) return;
        setDegraded(!!d.degraded);   // 의도 분해가 안 된 채 온 결과면 그대로 알린다
        setAutoF(d.filters || {});
        setList(d.results || []);
        setPool(d.results || []);
      } catch (_) {
        if (ctl.signal.aborted) return;   // 사용자가 중지한 것 — 실패로 처리하지 않는다
        // 맥락 분석이 실패해도 검색 자체는 살려둔다 — 화면의 존재 이유가 사라지면 안 된다
        setDegraded(true);
        runSearch(text);
      } finally { if (!ctl.signal.aborted) setAsking(false); }
      return;
    }
    runSearch(text);
  };

  const toggleMcp = async (e, c) => {
    e.stopPropagation();
    if (togglePendingRef.current.has(c.tool_id)) return;
    const previous = c.enabled !== false;
    const next = !previous;
    togglePendingRef.current.add(c.tool_id);
    setTogglePending(new Set(togglePendingRef.current));
    setList((items) => updateCapabilityEnabled(items, c.tool_id, next));
    setPool((items) => updateCapabilityEnabled(items, c.tool_id, next));
    try {
      const result = await api.setMcpEnabled(c.tool_id, next);
      const actual = result?.enabled == null ? next : result.enabled;
      setList((items) => updateCapabilityEnabled(items, c.tool_id, actual));
      setPool((items) => updateCapabilityEnabled(items, c.tool_id, actual));
    } catch (_) {
      setList((items) => updateCapabilityEnabled(items, c.tool_id, previous));
      setPool((items) => updateCapabilityEnabled(items, c.tool_id, previous));
    } finally {
      togglePendingRef.current.delete(c.tool_id);
      setTogglePending(new Set(togglePendingRef.current));
    }
  };
  const openSharingManagement = (e, capability) => {
    e.stopPropagation();
    go("projectSettings", detachNavigation(capability));
  };

  const select = async (id) => {
    setSelId(id); setTab("spec"); setSpecView("openapi"); setInv(null); setAllowMut(false);
    const d = await api.describe(id); setSel(d);
    const a = {}; (d.fields || []).forEach((f) => { if (f.loc !== "body") a[f.name] = ""; }); setArgs(a);
  };
  const runInvoke = async () => {
    const bodyFields = (sel.fields || []).filter((f) => f.loc === "body");
    const payload = { ...args };
    if (bodyFields.length) { payload.body = {}; bodyFields.forEach((f) => { if (args[f.name]) payload.body[f.name] = coerce(f.type, args[f.name]); }); }
    try { const r = await api.invoke(selId, payload, allowMut); setInv(r.blocked ? { blocked: true } : { status: r.status, body: r.data ?? r.body ?? r, source: r.source }); }
    catch (e) { setInv({ error: String(e.message) }); }
  };

  // facet 옵션은 pool(필터 미적용)에서 산출 → 필터를 걸어도 선택지가 사라지지 않음
  const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const verbCounts = VERBS.map((v) => [v, pool.filter((c) => c.method === v).length]).filter(([, n]) => n > 0);
  const services = [...new Set(pool.map((c) => c.service).filter(Boolean))].sort();
  const hasFacet = methods.length > 0 || !!svc || readOnly || sort !== "score";
  const toggleMethod = (v) => setMethods((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));
  const clearFacets = () => { setMethods([]); setSvc(""); setReadOnly(false); setSort("score"); };
  const sortFns = {
    // 판별자가 고른 건은 점수와 무관하게 맨 앞이다. 백엔드가 올려 보낸 걸 화면이 점수순으로
    // 다시 흩으면 "AI 추천"이 3순위에 붙는 모순이 생긴다(실제로 그렇게 보였다).
    score: (a, b) => (b.picked ? 1 : 0) - (a.picked ? 1 : 0) || (b.score ?? 0) - (a.score ?? 0),
    name: (a, b) => a.tool_id.localeCompare(b.tool_id),
    method: (a, b) => a.method.localeCompare(b.method) || a.tool_id.localeCompare(b.tool_id),
  };
  /* 검색 결과는 상위 5건까지만 보여준다. 탐색 화면에서 스무 줄을 훑는 건 검색이 아니라
     목록 읽기다 — 상위 몇 개를 볼지 정해줘야 결과가 "답"으로 읽힌다.
     검색어가 없을 때(전체 목록)는 자르지 않는다. 그건 브라우징이라 전부 보여야 한다. */
  const RESULT_LIMIT = 5;
  const hasQuery = !!q.trim();
  const matched = (chip === "all" ? list : list.filter((c) => srcCategory(c.source) === chip)).slice().sort(sortFns[sort]);
  const shown = hasQuery ? matched.slice(0, RESULT_LIMIT) : matched;
  const chips = [["all", lang === "ko" ? "전체" : "All"], ["server", "API " + (lang === "ko" ? "서버" : "server")], ["db", "DB"], ["doc", lang === "ko" ? "문서" : "Doc"]];

  /* 목록이 바뀌면 화면 첫 줄을 항상 포커싱한다. 검색·조건·정렬 어느 쪽으로 바뀌든
     오른쪽 명세가 직전 선택에 머물면 "검색했는데 화면이 그대로"로 보인다.
     의존성을 tool_id 문자열로 잡아, 카드 클릭(목록 불변)에는 반응하지 않는다. */
  const busy = asking || searching;
  /* 순위 연출은 "검색 결과의 상위"일 때만 의미가 있다 — 전체 목록이거나 이름·메서드순으로
     정렬한 상태에서 1·2·3 을 붙이면 관련도와 무관한 줄에 훈장을 다는 꼴이 된다. */
  const ranked = !!q.trim() && sort === "score";
  const qText = q.trim();
  const shownKey = shown.map((c) => c.tool_id).join("|");
  useEffect(() => {
    if (pinned.current) { pinned.current = null; return; }   // ?tool= 로 지정해 들어온 건 존중
    if (!shown.length) { setSelId(null); setSel(null); return; }
    if (shown[0].tool_id !== selId) select(shown[0].tool_id);
  }, [shownKey]);

  return (
    <div style={{ animation: "fadeUp .3s ease-out", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--blue-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>{ExpIcon("var(--blue)")}</div>
          <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>{t.expTitle}</h1><div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{t.expSub}</div></div>
        </div>
      </div>

      {/* 검색 헤더 — 결과 목록과 같은 화면 위에 붙는다. 검색은 결과를 보며 고쳐 던지는
          동작이라, 입력과 결과를 다른 화면으로 갈라두면 왕복 비용만 남는다 */}
      <ExplorerHero
        ko={ko} q={q} setQ={onQuery} mode={mode} onSubmit={submit}
        busy={busy} asking={asking} onStop={stopAsk} recentQueries={recentQ}
      />

      {degraded && (
        <div style={{ fontSize: 12, color: "var(--amber)", background: "var(--amber-bg)", borderRadius: 10, padding: "9px 12px", marginBottom: 12, flexShrink: 0 }}>
          {ko ? "맥락 분석에 실패해 일반 검색 결과를 보여줍니다." : "Context search failed — showing keyword results."}
        </div>
      )}

      {/* 적용된 조건 — 질의에서 자동으로 걸린 것은 배지를 달아 왜 결과가 적은지 보이게 한다 */}
      {filterChips(autoF, "query", ko).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "8px 11px", background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 12, marginBottom: 12, flexShrink: 0 }}>
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{ko ? "좁히기" : "filters"}</span>
          {filterChips(autoF, "query", ko).map((c) => (
            <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 9, background: "var(--blue)", color: "#fff" }}>
              {c.label}
              <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, background: "rgba(255,255,255,.24)", borderRadius: 5, padding: "1px 5px" }}>{ko ? "질의에서" : "auto"}</span>
            </span>
          ))}
          <button onClick={() => { setAutoF({}); clearFacets(); loadList(q); }}
            style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--blue-d)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
            {ko ? "조건 초기화" : "clear"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 32%) 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        {/* left */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", flexShrink: 0 }}>
            <div className="exp-srcsw">
              {chips.map(([k, labl]) => {
                const n = k === "all" ? list.length : list.filter((c) => srcCategory(c.source) === k).length;
                const on = chip === k;
                return <button key={k} onClick={() => setChip(k)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, cursor: "pointer", border: "none", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, background: on ? "var(--blue)" : "transparent", color: on ? "#fff" : "var(--muted)" }}>{labl} <span style={{ opacity: .7 }}>{n}</span></button>;
              })}
            </div>
          </div>
          {/* 구조화 필터: method(다중) · 읽기전용 · 서비스 · 정렬 */}
          <div className="exp-facets" style={{ marginBottom: 10, flexShrink: 0 }}>
            <span className="lb">{ko ? "필터" : "filter"}</span>
            {verbCounts.map(([v, n]) => {
              const on = methods.includes(v);
              return <button key={v} onClick={() => toggleMethod(v)} className="mono" style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 10px", borderRadius: 9, cursor: "pointer", border: on ? "none" : "1px solid var(--line2)", background: on ? "var(--navy)" : "var(--card)", color: on ? "#fff" : "var(--text)" }}>{v} <span style={{ opacity: .6 }}>{n}</span></button>;
            })}
            <button onClick={() => setReadOnly((b) => !b)} style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 9, cursor: "pointer", border: readOnly ? "none" : "1px solid var(--line2)", background: readOnly ? "var(--blue)" : "var(--card)", color: readOnly ? "#fff" : "var(--text)" }}>{lang === "ko" ? "읽기전용" : "Read-only"}</button>
            {services.length > 0 && (
              <select value={svc} onChange={(e) => setSvc(e.target.value)} style={selStyle}>
                <option value="">{lang === "ko" ? "전체 서비스" : "All services"}</option>
                {services.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={selStyle}>
              <option value="score">{lang === "ko" ? "관련도순" : "Relevance"}</option>
              <option value="name">{lang === "ko" ? "이름순" : "Name"}</option>
              <option value="method">{lang === "ko" ? "메서드순" : "Method"}</option>
            </select>
            {hasFacet && <button onClick={clearFacets} style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 9, cursor: "pointer", border: "none", background: "transparent", color: "var(--blue)" }}>{lang === "ko" ? "초기화" : "Clear"}</button>}
          </div>
          {/* 결과 안내 — 무엇으로 찾은 몇 건인지 한 줄로 못 박는다. 숫자만 있으면
              지금 보는 목록이 검색 결과인지 전체 목록인지 구분이 안 된다 */}
          <div className={`exp-resultbar${hasQuery ? " is-search" : ""}`}>
            {busy ? (
              <div className="ln"><i className="exp-spin" /><span>{ko ? "검색 중…" : "searching…"}</span></div>
            ) : hasQuery ? (
              /* 질의와 건수를 한 줄에 이어 붙이면 어디까지가 내가 친 말인지 흐려진다.
                 첫 줄은 질의만, 둘째 줄은 결과 요약만 — 읽는 순서를 강제한다 */
              <>
                <div className="ln q-ln">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  <span className="q" title={qText}>“{qText}”</span>
                </div>
                <div className="ln sub">
                  {ko ? <>검색 결과 <b>{matched.length}건</b></> : <>found <b>{matched.length}</b></>}
                  {matched.length > shown.length && (ko ? <> · 관련도 상위 <b>{shown.length}건</b>만 표시</>
                                                        : <> · showing top <b>{shown.length}</b></>)}
                </div>
              </>
            ) : (
              <div className="ln">{ko ? <>이 프로젝트의 전체 MCP <b>{matched.length}건</b></> : <>all <b>{matched.length}</b> tools</>}</div>
            )}
          </div>
          <div className={`exp-list${busy ? " is-busy" : ""}`} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 9, padding: "6px 6px 12px 2px" }}>
            {shown.map((c, i) => {
              const on = selId === c.tool_id;
              const rank = ranked ? i + 1 : 0;   // 0 = 순위 연출 없음
              return (
                <div key={c.tool_id} onClick={() => select(c.tool_id)}
                  className={`mcp-card${on ? " is-sel" : ""}${c.enabled === false ? " is-off" : ""}${rank && rank <= 3 ? ` rank-${rank}` : ""}`}>
                  {rank > 0 && rank <= 3 && (
                    <div className="mcp-rank">
                      <span className="n">{rank}</span>
                      <span className="tx">{c.picked ? (ko ? "AI 추천" : "AI PICK")
                        : rank === 1 ? (ko ? "최적 매치" : "BEST MATCH")
                        : (ko ? `${rank}순위 후보` : `RANK ${rank}`)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ ...methodStyle(c.method), flexShrink: 0 }}>{c.method}</span>
                    <span className="mono" title={c.tool_id} style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{highlight(c.tool_id, q)}</span>
                    {c.enabled === false && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", background: "var(--main)", border: "1px solid var(--line2)", padding: "1px 6px", borderRadius: 6 }}>OFF</span>}
                    {c.score != null && <span className="mono" style={{ fontSize: 10.5, color: "var(--blue)", flexShrink: 0 }}>{Number(c.score).toFixed(4)}</span>}
                    <MiniSwitch on={c.enabled !== false} disabled={togglePending.has(c.tool_id)} onClick={(e) => toggleMcp(e, c)} />
                    <button type="button" onClick={(e) => openSharingManagement(e, c)} aria-label={ko ? `${c.tool_id} 공유관리에서 분리 영향 확인` : `Manage ${c.tool_id} sharing and detach impact`} title={ko ? "공유관리에서 영향 확인" : "Manage sharing and impact"} style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}>↗</button>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{c.path}</div>
                  {/* 판별자가 밝힌 선택 근거 — 라벨(AI 추천)은 순위 배지가 이미 달고 있으니
                      여기서는 "왜 골랐는지"만 남긴다. 점수만 보이면 사용자가 추측해야 한다 */}
                  {c.picked && c.why && <div className="exp-pick"><span className="why">◈ {c.why}</span></div>}
                  <div style={{ fontSize: 12, color: "var(--text)", marginTop: 6, lineHeight: 1.45 }}>{highlight(c.summary, q)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 10, color: "var(--text)", background: "var(--main)", padding: "2px 8px", borderRadius: 8 }}>{c.service}</span>
                    {c.mutating && <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", color: "#9a5b00", background: "var(--amber-bg)", border: "1px solid var(--amber-bg)", padding: "2px 8px", borderRadius: 7 }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--amber)" }} />MUTATING</span>}
                    {c.source && <span title={c.source} className="mono" style={{ fontSize: 9.5, color: "var(--muted)", background: "var(--main)", padding: "2px 8px", borderRadius: 8, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.source.replace(/^[a-z]+:/, "")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* right */}
        <div style={{ background: "var(--card)", borderRadius: 20, boxShadow: "0 10px 28px rgba(54,64,120,.06)", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!sel ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--faint)" }}>{ExpIcon("currentColor", 40)}<span style={{ fontSize: 13 }}>{t.emptySel}</span></div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "22px 26px 0", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><span style={methodStyle(sel.method)}>{sel.method}</span><span className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>{sel.tool_id}</span>{sel.mutating && <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 700, color: "#9a5b00", background: "var(--amber-bg)", border: "1px solid var(--amber-bg)", padding: "2px 8px", borderRadius: 7 }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--amber)" }} />MUTATING</span>}<span style={{ flex: 1 }} />
                  <button onClick={() => go("skillCreate", { draft: { context: sel.summary || sel.tool_id, steps: [{ type: "mcp", tool_id: sel.tool_id }] } })}
                    style={{ border: "1px solid var(--line2)", background: "var(--card)", color: "var(--blue-d)", fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {ko ? "스킬로 만들기 →" : "Make a skill →"}
                  </button></div>
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 9 }}>{sel.method} {sel.path} · {sel.service}</div>
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 10, lineHeight: 1.5 }}>{sel.summary}</div>
                <div style={{ display: "flex", gap: 22, borderBottom: "1px solid var(--line)", marginTop: 16 }}>
                  {[["spec", t.tabSpec], ["invoke", t.tabInvoke], ["connect", ko ? "◆ 연결" : "◆ Connect"]].map(([k, labl]) => (
                    <div key={k} onClick={() => setTab(k)} style={{ padding: "10px 0", marginBottom: -1, fontSize: 13.5, fontWeight: tab === k ? 700 : 600, cursor: "pointer", color: tab === k ? "var(--blue)" : "var(--muted)", borderBottom: "2.5px solid " + (tab === k ? "var(--blue)" : "transparent") }}>{labl}</div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 26px 26px" }}>
                {tab === "connect" ? (
                  <ConnectTab ko={ko} toolId={sel.tool_id} projectId={activeId} />
                ) : tab === "spec" ? (
                  <div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>{t.parameters}</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 22 }}>
                      <thead><tr style={{ borderBottom: "1px solid var(--line)" }}>{["NAME", "IN", "TYPE", "REQ"].map((h) => <th key={h} className="mono" style={{ textAlign: "left", fontSize: 9, letterSpacing: ".1em", color: "var(--faint)", padding: "6px 6px", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                      <tbody>{(sel.fields || []).map((p) => (<tr key={p.name} style={{ borderBottom: "1px solid var(--line)" }}><td className="mono" style={{ padding: "10px 6px", fontSize: 12, color: "var(--navy)", fontWeight: 600 }}>{p.name}</td><td className="mono" style={{ padding: "10px 6px", fontSize: 11, color: "var(--muted)" }}>{p.loc}</td><td className="mono" style={{ padding: "10px 6px", fontSize: 11, color: "var(--muted)" }}>{p.type}</td><td className="mono" style={{ padding: "10px 6px", fontSize: 11, color: "var(--muted)" }}>{p.required ? "required" : "—"}</td></tr>))}</tbody>
                    </table>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{t.schemaT}</div>
                      <div style={{ marginLeft: "auto", display: "flex", background: "var(--main)", borderRadius: 9, padding: 3 }}>
                        {[["openapi", "OpenAPI 3.0"], ["mcp", "MCP tool"]].map(([v, labl]) => (
                          <button key={v} onClick={() => setSpecView(v)} className="mono" style={{ fontSize: 10, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: specView === v ? "var(--card)" : "transparent", color: specView === v ? "var(--blue)" : "var(--muted)", fontWeight: specView === v ? 700 : 500, boxShadow: specView === v ? "0 2px 6px rgba(54,64,120,.10)" : "none" }}>{labl}</button>
                        ))}
                      </div>
                    </div>
                    <pre style={Ink}>{JSON.stringify(specView === "openapi" ? sel.openapi : sel.mcp_tool, null, 2)}</pre>
                  </div>
                ) : (
                  <div>
                    {sel.mutating && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--amber-bg)", borderRadius: 14, padding: "13px 15px", marginBottom: 16 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h0" /></svg>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>{t.guardTitle}</div><div style={{ fontSize: 11.5, color: "var(--text)", marginTop: 3 }}>{t.guardSub}</div></div>
                        <button onClick={() => { setAllowMut(!allowMut); setInv(null); }} className="mono" style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 10, flexShrink: 0, border: allowMut ? "none" : "1px solid var(--line2)", background: allowMut ? "var(--blue)" : "var(--card)", color: allowMut ? "#fff" : "var(--text)" }}>{allowMut ? "allow ✓" : "allow_mutating"}</button>
                      </div>
                    )}
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{t.reqParams}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
                      {(sel.fields || []).map((f) => (<div key={f.name}><label className="mono" style={{ display: "block", fontSize: 11, color: "var(--text)", marginBottom: 5 }}>{f.name}{f.required ? " *" : ""} ({f.loc})</label><input value={args[f.name] ?? ""} onChange={(e) => { setArgs({ ...args, [f.name]: e.target.value }); setInv(null); }} placeholder={f.type} className="mono" style={{ width: "100%", border: "1px solid var(--line2)", borderRadius: 11, padding: "10px 13px", fontSize: 12, color: "var(--navy)", outline: "none", background: "var(--card)" }} /></div>))}
                      {(sel.fields || []).length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{lang === "ko" ? "파라미터 없음" : "no params"}</div>}
                    </div>
                    <button onClick={runInvoke} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "var(--sans)", cursor: "pointer", boxShadow: "0 8px 18px rgba(0,181,166,.28)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>{t.invokeBtn}</button>
                    {inv && (
                      <div style={{ marginTop: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <span className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{t.response}</span>
                          <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: inv.blocked || inv.error ? "var(--amber)" : "var(--green)", background: inv.blocked || inv.error ? "var(--amber-bg)" : "var(--green-bg)", padding: "2px 9px", borderRadius: 8 }}>{inv.blocked ? "BLOCKED" : inv.error ? "ERROR" : inv.status + " OK"}</span>
                          {inv.source && (
                            <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: inv.source.internal ? "var(--green)" : "var(--amber)", background: inv.source.internal ? "var(--green-bg)" : "var(--amber-bg)", border: "1px solid " + (inv.source.internal ? "#b6e8d0" : "#f0c089"), padding: "2px 10px", borderRadius: 8 }}>
                              출처: {inv.source.host || "-"} · {inv.source.label} ({inv.source.internal ? "internal" : "external"})
                            </span>
                          )}
                          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{lang === "ko" ? "감사 로그 기록됨 · actor=ui" : "audit logged"}</span>
                        </div>
                        <pre style={Ink}>{inv.blocked ? JSON.stringify({ blocked: true, reason: "쓰기/삭제 호출은 기본 차단됩니다. allow_mutating=true 필요." }, null, 2) : inv.error ? inv.error : JSON.stringify(inv.body, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && <AddMcpModal t={t} onClose={() => setModal(false)} onAdded={() => { setModal(false); loadPool(q); loadList(q); }} />}

    </div>
  );
}

function AddMcpModal({ t, onClose, onAdded }) {
  const [img, setImg] = useState(null); const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState("");
  const pick = (e) => { const f = e.target.files[0]; if (!f) return; setFile(f); setRes(null); setErr(""); const r = new FileReader(); r.onload = () => setImg(r.result); r.readAsDataURL(f); };
  const analyze = async () => { setBusy(true); setErr(""); try { setRes(await api.scanImage(file)); } catch (e) { setErr(String(e.message)); } finally { setBusy(false); } };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,28,60,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 98, padding: 24 }}>
      <div style={{ width: 560, maxWidth: "100%", maxHeight: "88vh", background: "var(--card)", borderRadius: 22, boxShadow: "0 34px 80px rgba(28,38,90,.3)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "popIn .22s ease-out" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: "var(--blue-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15-5-5L5 21" /></svg></span>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t.addMcp}</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 9, background: "var(--main)", border: "none", cursor: "pointer", color: "var(--muted)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          <label style={{ display: "block", cursor: "pointer" }}>
            <input type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
            {!img ? (
              <div style={{ border: "1.5px dashed var(--amber-bg)", borderRadius: 16, padding: "34px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", background: "var(--amber-bg)" }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0-12 4 4m-4-4-4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg><div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{t.scDrop}</div><div className="mono" style={{ fontSize: 10, color: "var(--amber)" }}>PNG · JPG · Swagger/문서 캡처</div></div>
            ) : (<div style={{ border: "1px solid var(--line2)", borderRadius: 16, padding: 12, background: "var(--main)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><img src={img} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10, objectFit: "contain" }} /><span className="mono" style={{ fontSize: 10, color: "var(--amber)" }}>다른 이미지 선택</span></div>)}
          </label>
          {img && !res && !busy && <button onClick={analyze} style={{ marginTop: 14, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 14px", fontSize: 13, fontWeight: 700, borderRadius: 12, background: "var(--blue)", color: "#fff", border: "none", cursor: "pointer" }}>AI로 명세 추출</button>}
          {busy && <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, fontSize: 13, color: "var(--text)" }}><span style={{ width: 16, height: 16, border: "2px solid var(--line2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />이미지 분석 중 (gpt-5.2 vision)…</div>}
          {err && <div style={{ marginTop: 14, padding: "10px 13px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 12, fontSize: 12 }}>⚠ {err}</div>}
          {res && <div style={{ marginTop: 16 }}><div className="mono" style={{ fontSize: 10, color: "var(--green)", marginBottom: 8 }}>✓ 추출·등록 완료 · 총 {res.total}개</div><pre style={Ink}>{JSON.stringify(res.added, null, 2)}</pre></div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 12, fontWeight: 700, borderRadius: 11, background: "var(--card)", color: "var(--text)", border: "1px solid var(--line2)", cursor: "pointer" }}>닫기</button>
          {res && <button onClick={onAdded} style={{ padding: "9px 16px", fontSize: 12, fontWeight: 700, borderRadius: 11, background: "var(--blue)", color: "#fff", border: "none", cursor: "pointer" }}>탐색에서 보기</button>}
        </div>
      </div>
    </div>
  );
}

function coerce(type, v) { if (type === "integer" || type === "number") return Number(v); if (type === "boolean") return v === "true" || v === true; return v; }

const selStyle = { fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 700, padding: "5px 9px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--card)", color: "var(--text)", cursor: "pointer", outline: "none" };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 검색어와 일치하는 구간을 <mark>로 강조 (공백 분리 다중어, 대소문자 무시)
function highlight(text, query) {
  const q = (query || "").trim();
  if (!q || !text) return text;
  const terms = q.split(/\s+/).filter(Boolean);
  const low = terms.map((s) => s.toLowerCase());
  const parts = String(text).split(new RegExp(`(${terms.map(escapeRe).join("|")})`, "ig"));
  return parts.map((p, i) =>
    low.includes(p.toLowerCase())
      ? <mark key={i} style={{ background: "var(--blue-bg)", color: "var(--navy)", borderRadius: 3, padding: "0 1px" }}>{p}</mark>
      : p
  );
}
