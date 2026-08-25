import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import { recentQueries, pushQuery } from "./explorerSearch";

// Skill 생성/수정 — MCP 팔레트에서 드래그해 파이프라인 조립, step 사이 프롬프트 삽입.
// step 재정렬·임의 위치 삽입은 HTML5 native DnD (신규 의존성 없음). 우측 패널에서 선택 step 편집.
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

/* 빠진 단계 — 실행되는 노드가 아니라 "여기에 무언가 있어야 한다" 는 자리 표시다.
   그래서 카드가 아니라 잘린 조각처럼 생겼다. IN/OUT 도 없다 — 부를 것이 없으니까. */
const GapNode = ({ need, ko }) => (
  <div className="skl-gap" title={need}>
    <div className="gh"><span className="mk">?</span>{ko ? "빠진 단계" : "missing"}</div>
    <div className="gn">{need}</div>
    <div className="gb">{ko ? "이 프로젝트에 없음" : "not in project"}</div>
  </div>
);

const methCls = (m) => ({ GET: "get", POST: "post", PUT: "put", PATCH: "put", DELETE: "del" }[(m || "").toUpperCase()] || "get");

// MCP 탐색 히어로와 같은 아이콘 — 두 화면의 '문장으로 물어보는 칸' 이 같아 보여야 한다
const Spark = ({ s = 19 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
    <path d="M18 15.5 18.8 17.7 21 18.5l-2.2.8L18 21.5l-.8-2.2L15 18.5l2.2-.8Z" />
  </svg>
);

export default function SkillBuilder({ t, lang, go, nav }) {
  const ko = lang === "ko";
  const { activeId } = useProjects();
  const editId = nav?.editId || null;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [steps, setSteps] = useState([]);          // [{uid,type,tool_id,argsText,text,badge}]
  const [sel, setSel] = useState(null);            // 선택 step uid
  const [tools, setTools] = useState([]);
  const [palQ, setPalQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // 초안 추천 — 빈 캔버스 대신 "무엇을 만들지" 를 먼저 받는다
  const [ctx, setCtx] = useState(nav?.draft?.context || "");
  const [drafting, setDrafting] = useState("");    // "" | "draft" | "prompt"
  const [missing, setMissing] = useState([]);      // 후보에 없어 제외된 단계 안내
  const [recIds, setRecIds] = useState([]);        // 이번 초안이 고른 tool_id — 팔레트 상단 고정
  const [showJson, setShowJson] = useState(false); // args 원문(JSON) 토글
  const [palOpen, setPalOpen] = useState(false);   // 팔레트 — 늘 떠 있으면 보드를 가린다
  const [saveOpen, setSaveOpen] = useState(false); // 저장 다이얼로그 — 스킬 메타는 여기서만 묻는다
  const [specs, setSpecs] = useState({});          // tool_id -> describe 결과 캐시
  const [inputs, setInputs] = useState([]);      // 스킬이 받는 값 선언 — 스킬도 툴이다
  const [inVals, setInVals] = useState({});      // 시험 실행에 넣을 필드별 값
  const [outputs, setOutputs] = useState([]);    // 내놓는 값 선언 — 시험 실행이 본 모양에서 시작한다
  const [recentQ, setRecentQ] = useState(recentQueries());
  const [hover, setHover] = useState(null);       // 스토리 구절 ↔ 노드 연결 표시
  const [leaving, setLeaving] = useState(false);  // 히어로 퇴장 중

  const dragRef = useRef(null);                    // {type:'mcp',tool} | {type:'move',uid}
  const [overIdx, setOverIdx] = useState(null);

  // MCP 팔레트 — 활성 프로젝트 tool 목록
  useEffect(() => {
    api.search("").then((d) => setTools(d.results || [])).catch(() => setTools([]));
  }, [activeId]);

  // 편집 모드 로드
  useEffect(() => {
    if (!editId) return;
    api.getSkill(editId).then((s) => {
      setName(s.name); setSlug(s.slug); setSlugTouched(true);
      setDescription(s.description || ""); setTagsInput((s.tags || []).join(", "));
      setInputs(s.inputs || []); setOutputs(s.outputs || []);
      setInVals(Object.fromEntries((s.inputs || []).map((i) => [i.name, i.example || ""])));
      const loadedSteps = (s.steps || []).map((st) => ({
        uid: uid(), type: st.type, tool_id: st.tool_id || "",
        foreach: st.foreach || "",
        argsText: st.args_template && Object.keys(st.args_template).length
          ? JSON.stringify(st.args_template, null, 2) : "{}",
        text: st.text || "",
      }));
      setSteps(loadedSteps);
      const focusStep = Number(nav?.focusStep);
      setSel(loadedSteps[Number.isInteger(focusStep) ? focusStep : 0]?.uid || null);
    }).catch(() => setErr(ko ? "Skill 로드 실패" : "Failed to load skill"));
  }, [editId, nav?.focusStep]);

  // 초안 payload → 캔버스 step. badge 는 화면 표시 전용이라 저장 시 제외된다.
  const toSteps = (arr, badge) => (arr || []).map((st) => ({
    uid: uid(), type: st.type, tool_id: st.tool_id || "",
    foreach: st.foreach || "",
    argsText: st.args_template && Object.keys(st.args_template).length
      ? JSON.stringify(st.args_template, null, 2) : "{}",
    text: st.text || "", badge,
  }));

  const applyDraft = (d, badge) => {
    // 실행 결과는 그 레시피의 것이다. 조합이 통째로 바뀌었는데 남겨 두면 다른 스킬의
    // 호출·답변을 새 그림의 결과로 읽게 된다 — 로그는 레시피와 함께 갈린다.
    setDry(null); setLive(null); setDryInput("");
    if (d.name) { setName(d.name); setSlugTouched(false); }
    if (d.description) setDescription(d.description);
    if (d.tags?.length) setTagsInput(d.tags.join(", "));
    setInputs(d.inputs || []); setOutputs([]);   // 내놓는 값은 지어내지 않는다 — 돌려본 뒤에 채운다
    setInVals(Object.fromEntries((d.inputs || []).map((i) => [i.name, i.example || ""])));
    const next = toSteps(d.steps, badge);
    setSteps(next);
    const tail = next.length && next[next.length - 1].type === "prompt" ? next.length - 1 : next.length;
    setMissing(d.gaps?.length
      ? d.gaps.map((g) => ({ ...g, at: g.at ?? tail }))
      : (d.missing || []).map((m) => ({ need: m, at: tail })));
    setRecIds(next.filter((s) => s.type === "mcp").map((s) => s.tool_id));
    setSel(next.find((s) => s.type === "mcp")?.uid ?? next[0]?.uid ?? null);
  };

  // 중지는 진행 중인 fetch 를 실제로 끊는다 — 화면만 되돌리면 응답이 뒤늦게 캔버스를 덮어쓴다
  const draftAbort = useRef(null);
  const stopDraft = () => { draftAbort.current?.abort(); draftAbort.current = null; setDrafting(""); };

  const runDraft = async (text) => {
    const q = (typeof text === "string" ? text : ctx).trim();
    if (!q || drafting) return;
    const ac = new AbortController();
    draftAbort.current = ac;
    setDrafting("draft"); setErr("");
    pushQuery(q); setRecentQ(recentQueries());
    try {
      const d = await api.draftSkill(q, undefined, ac.signal);
      setLeaving(true);
      applyDraft(d, "rec");
      setTimeout(() => setLeaving(false), 280);
    }
    catch (e) {
      if (e.name === "AbortError") return;               // 사용자가 중지한 것은 오류가 아니다
      setErr(e.message || (ko ? "추천 실패" : "Draft failed"));
    } finally {
      if (draftAbort.current === ac) { draftAbort.current = null; setDrafting(""); }
    }
  };

  // 조합은 그대로 두고 프롬프트만 다시 받는다. 프롬프트 step 이 없으면 맨 끝에 새로 만든다.
  const draftPrompt = async (targetUid) => {
    if (drafting) return;
    setDrafting("prompt"); setErr("");
    try {
      const body = steps.filter((s) => s.type === "mcp")
        .map((s) => ({ type: "mcp", tool_id: s.tool_id, args_template: {} }));
      const { prompt } = await api.draftSkill(ctx || name || description, body);
      if (!prompt) { setErr(ko ? "프롬프트 추천에 실패했습니다. 직접 작성해 주세요." : "Prompt draft failed."); return; }
      setSteps((prev) => {
        const hit = targetUid || prev.find((s) => s.type === "prompt")?.uid;
        if (hit) return prev.map((s) => (s.uid === hit ? { ...s, text: prompt, badge: "rec" } : s));
        return [...prev, { uid: uid(), type: "prompt", tool_id: "", argsText: "{}", text: prompt, badge: "rec" }];
      });
    } catch (e) {
      setErr(e.message || (ko ? "추천 실패" : "Draft failed"));
    } finally { setDrafting(""); }
  };

  // MCP 탐색에서 조합을 들고 들어온 경우 — 조합은 '자동', 프롬프트는 이어서 추천으로 채운다
  const draftedRef = useRef(false);
  useEffect(() => {
    const d = nav?.draft;
    if (!d || editId || draftedRef.current) return;
    draftedRef.current = true;
    applyDraft(d, "auto");
    if (!(d.steps || []).some((s) => s.type === "prompt")) setTimeout(() => draftPrompt(), 0);
  }, [nav, editId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // slug 자동 제안 (사용자가 직접 건드리기 전까지)
  const autoSlug = useMemo(() => {
    const fromName = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (fromName) return fromName;
    // 한글 이름은 위 규칙에서 통째로 지워져 빈 슬러그가 된다 — 쓰는 툴 이름으로 만든다
    const ids = steps.filter((s) => s.type === "mcp" && s.tool_id).map((s) => s.tool_id);
    if (!ids.length) return "";
    const base = ids[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
    return ids.length > 1 ? `${base}-flow` : base;
  }, [name, steps]);
  const effSlug = slugTouched ? slug : autoSlug;

  const palette = tools.filter((tl) =>
    !palQ || tl.tool_id.toLowerCase().includes(palQ.toLowerCase())
    || (tl.summary || "").toLowerCase().includes(palQ.toLowerCase()));
  // 초안이 고른 MCP 를 팔레트 위로 올린다 — 지웠다가 되돌릴 때 다시 검색하지 않게
  const recPal = palette.filter((tl) => recIds.includes(tl.tool_id));
  const restPal = palette.filter((tl) => !recIds.includes(tl.tool_id));

  const mcpCard = (tl) => (
    <div key={tl.tool_id} className="skl-mcp" draggable
      onDragStart={() => { dragRef.current = { type: "mcp", tool: tl }; }}
      onDragEnd={() => { dragRef.current = null; setOverIdx(null); }}>
      <span className="grip">⠿</span>
      <div style={{ minWidth: 0 }}>
        <div className="nm">{tl.tool_id}</div>
        <div className="sub">{tl.service || tl.source || ""}</div>
      </div>
      <span className={`skl-meth ${methCls(tl.method)}`}>{tl.method}</span>
    </div>
  );

  const selStep = steps.find((s) => s.uid === sel) || null;
  const selIdx = steps.findIndex((s) => s.uid === sel);

  // 선택한 mcp step 의 파라미터 — 값 선택 UI 를 그리려면 명세가 필요하다
  useEffect(() => {
    const tid = selStep?.type === "mcp" ? selStep.tool_id : null;
    if (!tid || specs[tid]) return;
    api.describe(tid).then((d) => setSpecs((m) => ({ ...m, [tid]: d }))).catch(() => {});
  }, [selStep, specs]);
  /* 카드마다 한 줄 요약을 보여주려면 선택하지 않은 step 의 명세도 필요하다 */
  useEffect(() => {
    steps.filter((s) => s.type === "mcp" && s.tool_id && !specs[s.tool_id]).slice(0, 12).forEach((s) => {
      api.describe(s.tool_id).then((d) => setSpecs((m) => ({ ...m, [s.tool_id]: d }))).catch(() => {});
    });
  }, [steps]);   // eslint-disable-line react-hooks/exhaustive-deps

  const argsObj = () => { try { return JSON.parse(selStep?.argsText || "{}"); } catch { return {}; } };
  const setArg = (key, val) => {
    const o = argsObj();
    if (val === "") delete o[key]; else o[key] = val;
    patchSel({ argsText: JSON.stringify(o, null, 2) });
  };

  // 앞선 mcp step 결과를 값으로 고를 수 있게 한다 — {{steps[i].output}} 문법을 사용자가 몰라도 되게
  const valueOptions = () => {
    const opts = [{ v: "", label: ko ? "비워두기" : "empty" },
                  { v: "{{input}}", label: ko ? "사용자가 입력한 값" : "user input" }];
    steps.slice(0, Math.max(0, selIdx)).forEach((s, i) => {
      if (s.type !== "mcp") return;
      opts.push({ v: `{{steps[${i}].output}}`, label: `${i + 1}${ko ? "단계 결과" : " output"} · ${s.tool_id}` });
    });
    return opts;
  };
  /* 앞 단계가 실제로 돌려준 응답을 펼쳐 그 자리를 클릭하게 한다.
     드롭다운은 `{{steps[0].output}}` 통째로만 고를 수 있어서, rows[0].plcy_no 같은
     하위 경로는 사용자가 문법을 외워 손으로 쳐야 했다. 값은 트레이스에 이미 있으므로
     추측 없이 진짜 경로를 집을 수 있다. */
  const OUT_TREE_MAX = 24;
  const outTree = (val, path, depth, out) => {
    if (out.length >= OUT_TREE_MAX || depth > 3 || val == null) return out;
    if (Array.isArray(val)) {
      out.push({ path, label: `${val.length}${ko ? "건" : " items"}`, leaf: false });
      if (val.length) outTree(val[0], `${path}[0]`, depth + 1, out);
      return out;
    }
    if (typeof val === "object") {
      for (const k of Object.keys(val)) {
        if (out.length >= OUT_TREE_MAX) break;
        outTree(val[k], `${path}.${k}`, depth + 1, out);
      }
      return out;
    }
    out.push({ path, label: String(val).slice(0, 40), leaf: true });
    return out;
  };
  /* 선택 step 앞쪽 단계들의 실제 응답 — 시험 실행을 한 번이라도 돌렸을 때만 있다 */
  const priorOutputs = () => {
    const rows = (dry?.trace || []).filter((t) => t.type === "mcp" && t.i < selIdx && t.status === "ok");
    return rows.map((t) => {
      const body = t.response?.body ?? t.response;
      return { i: t.i, tool_id: t.tool_id, nodes: outTree(body, `{{steps[${t.i}].output`, 0, []) };
    }).filter((g) => g.nodes.length);
  };

  const hintFor = (v) => {
    if (v === "") return ko ? "비워두면 이 값 없이 호출합니다." : "omitted";
    if (v === "{{input}}") return ko ? "스킬을 부를 때 사람이 입력한 값이 들어갑니다." : "user input";
    const m = /^\{\{steps\[(\d+)\]\.output\}\}$/.exec(v);
    if (m) return ko ? `${Number(m[1]) + 1}단계 결과가 이 자리에 들어갑니다.` : "previous step output";
    return ko ? "적은 값이 매번 그대로 들어갑니다." : "literal value";
  };

  // ── steps 조작 ──
  const insertAt = (idx, step) => {
    setSteps((prev) => { const n = [...prev]; n.splice(idx, 0, step); return n; });
    setSel(step.uid);
  };
  const addMcp = (idx, tool) => insertAt(idx, { uid: uid(), type: "mcp", tool_id: tool.tool_id, argsText: "{}", text: "" });
  const addPrompt = (idx) => insertAt(idx, { uid: uid(), type: "prompt", tool_id: "", argsText: "{}", text: "" });
  const moveStep = (fromUid, toIdx) => {
    setSteps((prev) => {
      const from = prev.findIndex((s) => s.uid === fromUid);
      if (from < 0) return prev;
      const n = [...prev];
      const [it] = n.splice(from, 1);
      n.splice(from < toIdx ? toIdx - 1 : toIdx, 0, it);
      return n;
    });
  };
  const removeStep = (u) => {
    setSteps((prev) => prev.filter((s) => s.uid !== u));
    if (sel === u) setSel(null);
  };
  const patchSel = (patch) => setSteps((prev) => prev.map((s) => s.uid === sel ? { ...s, ...patch } : s));

  // ── DnD ──
  const onConnDrop = (idx) => {
    const d = dragRef.current; dragRef.current = null; setOverIdx(null);
    if (!d) return;
    if (d.type === "mcp") addMcp(idx, d.tool);
    else if (d.type === "move") moveStep(d.uid, idx);
  };

  // 변수 chip 삽입 — 현재 선택 step 의 활성 textarea 에
  const insertVar = (v) => {
    if (!selStep) return;
    if (selStep.type === "prompt") patchSel({ text: (selStep.text || "") + v });
    else patchSel({ argsText: (selStep.argsText || "{}") + v });
  };
  const vars = ["{{input}}", ...steps.slice(0, Math.max(0, selIdx)).flatMap((_, i) => [`{{steps[${i}].output}}`])];

  /* 캔버스 step → 서버 payload. 저장과 시험 실행이 같은 변환을 써야
     "시험은 됐는데 저장이 422" 가 안 생긴다. 실패 시 err 를 세우고 null 을 돌려준다. */
  const toPayloadSteps = () => {
    const outSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.type === "mcp") {
        let args = {};
        try { args = JSON.parse(s.argsText || "{}"); }
        catch { setErr(ko ? `step ${i + 1}: args JSON 형식 오류` : `step ${i + 1}: invalid args JSON`); return null; }
        outSteps.push({ type: "mcp", tool_id: s.tool_id, args_template: args, text: "",
                        // 반복 지정은 화면에 편집 UI 가 없다 — 저장할 때 잃지 않도록 그대로 실어 보낸다.
                        foreach: s.foreach || "" });
      } else {
        if (!s.text.trim()) { setErr(ko ? `step ${i + 1}: 프롬프트 내용이 비어있습니다.` : `step ${i + 1}: prompt is empty.`); return null; }
        outSteps.push({ type: "prompt", tool_id: null, args_template: {}, text: s.text });
      }
    }
    return outSteps;
  };

  // ── 저장 전 시험 실행 ──
  const [dry, setDry] = useState(null);      // {runnable, checks[], trace[], ok}
  const [drying, setDrying] = useState(false);
  // 실행 중인 step — {i, phase:"fill"|"call"}. 한 칸씩 채워지는 그림을 만든다.
  const [live, setLive] = useState(null);
  const runDry = async () => {
    setErr(""); setDry(null); setLive(null);
    if (steps.length === 0) { setErr(ko ? "최소 1개 step이 필요합니다." : "At least one step required."); return; }
    const outSteps = toPayloadSteps();
    if (!outSteps) return;
    setDrying(true);
    // 단계별로 받아 화면을 채운다. 한 번에 받으면 몇 초 멈춰 있다가 결과만 떨어져
    // 무엇이 어떤 순서로 불렸는지 눈으로 따라갈 수 없다.
    // 이벤트를 순서대로, 한 칸에 최소 한 박자씩 머물게 적용한다. 목 업스트림은 응답이
    // 몇 ms 라 그대로 그리면 줄이 한꺼번에 튀어나와 무엇이 돌았는지 안 보인다.
    let chain = Promise.resolve();
    const beat = (fn, ms) => { chain = chain.then(async () => { fn(); await new Promise((r) => setTimeout(r, ms)); }); };
    try {
      const runInput = inputs.length ? inVals : dryInput;
      await api.dryRunSkillStream(outSteps, runInput, dryWrite, (ev) => {
        if (ev.type === "checks") beat(() => setDry({ runnable: ev.runnable, checks: ev.checks, trace: [], ok: null }), 0);
        else if (ev.type === "phase") beat(() => setLive({ i: ev.i, phase: ev.phase, tool_id: ev.tool_id, request: ev.request }), 420);
        else if (ev.type === "step") beat(() => setDry((d) => ({ ...(d || { checks: [], trace: [] }), trace: [...(d?.trace || []), ev.row] })), 260);
        else if (ev.type === "done") beat(() => {
          setLive(null);
          setDry((d) => ({ ...(d || { checks: [], trace: [] }), ok: ev.ok, runnable: ev.runnable, final: ev.final, answer: ev.answer, degraded: ev.degraded, error: ev.error }));
          // 내놓는 값은 관측에서 시작한다. 이미 손으로 정한 선언이 있으면 덮지 않는다 —
          // 한 번 더 돌렸다고 사람이 고친 것이 되돌아가면 안 된다.
          if (ev.ok && ev.observed_outputs?.length) setOutputs((o) => (o.length ? o : ev.observed_outputs));
        }, 0);
      }, name, { inputs, outputs });
      await chain;
    } catch (e) { setErr(e.message || (ko ? "시험 실행 실패" : "Dry run failed")); }
    finally { setDrying(false); setLive(null); }
  };
  const [dryInput, setDryInput] = useState("");
  const [dryWrite, setDryWrite] = useState(false);   // 변경형(POST 등)까지 실제로 부를지

  /* 실행 중인 카드를 시야 안에 둔다.
     scrollIntoView 를 쓰다가 걷어냈다. overflow:hidden 인 보드도 프로그램으로는 스크롤되고,
     그러면 보드 안에 절대배치된 오버레이(위 흐름·실행 로그)가 통째로 같이 밀린다 —
     한 번 돌리고 나면 두 영역이 왼쪽으로 잘려 보이던 것이 이것이다.
     이동은 씬 transform 한 곳에서만 한다. 이미 보이면 움직이지 않는다. */
  useEffect(() => {
    if (!live) return;
    const board = boardRef.current;
    const node = board?.querySelector(`.skl-node[data-step="${live.i}"]`);
    if (!board || !node) return;
    board.scrollLeft = 0; board.scrollTop = 0;   // 예전 동작이 남겨 놓은 스크롤을 되돌린다
    const b = board.getBoundingClientRect(), n = node.getBoundingClientRect();
    const pad = 96;                              // 가장자리에 붙어 반쯤 잘린 채로 두지 않는다
    const dx = n.left < b.left + pad ? b.left + pad - n.left
      : n.right > b.right - pad ? b.right - pad - n.right : 0;
    if (!dx) return;
    setGlide(true);
    setView((v) => ({ ...v, x: v.x + dx }));
    const t = setTimeout(() => setGlide(false), 360);
    return () => clearTimeout(t);
  }, [live?.i]);

  /* 한 줄 요약 — 카드 칸은 좁으니 "무엇이" 가 아니라 "얼마나" 를 먼저 보여준다.
     행이 있는 응답은 건수가 가장 빨리 읽히는 사실이다. */
  const brief = (v) => {
    if (v == null) return { text: "—", dim: true };
    if (Array.isArray(v)) return { text: `${v.length}${ko ? "건" : " items"}`, big: true };
    if (typeof v === "object") {
      const rows = v.rows ?? v.value ?? v.items ?? v.data;
      if (Array.isArray(rows)) return { text: `${rows.length}${ko ? "행" : " rows"}`, big: true };
      if (typeof v.count === "number") return { text: `${v.count}${ko ? "건" : ""}`, big: true };
      const keys = Object.keys(v);
      if (!keys.length) return { text: "—", dim: true };
      return { text: `${keys.length}${ko ? "개 필드" : " fields"}` };
    }
    return { text: String(v) };
  };

  /* args_template 이 비워 둔 자리를 서버 autofill 이 채웠는지 — 채웠으면 그 값은
     사람이 정한 게 아니라 LLM 이 지어낸 것이다. 표시하지 않으면 배선이 안 걸린
     스킬도 시험 실행만 그럴듯하게 돌아 사용자가 속는다. */
  const autoFilled = (i, request) => {
    const s = steps[i];
    if (!s || s.type !== "mcp" || !request) return [];
    let tpl = {};
    try { tpl = JSON.parse(s.argsText || "{}"); } catch { tpl = {}; }
    return Object.keys(request).filter((k) => {
      const v = tpl[k];
      if (v === undefined || v === "") return true;          // 배선이 아예 없던 자리
      // {{...}} 가 있다고 자동값은 아니다. 풀렸으면 사람이 건 배선이 동작한 것이고,
      // 안 풀렸으면 요청에 원문이 그대로 남는다 — 그때만 서버가 채웠다고 본다.
      return typeof v === "string" && v.includes("{{") && request[k] === v;
    });
  };

  /* 캔버스 노드에 붙일 실행 상태. 결과를 캔버스 아래에서 찾게 하면 스크롤이 필요해
     "무엇이 도는지" 를 놓친다 — 도는 자리에 그대로 표시한다. */
  const runState = (i) => {
    if (live && live.i === i) {
      return { cls: "run", running: true, chip: ko ? "실행 중" : "running",
               inText: live.phase === "fill" ? (ko ? "값 채우는 중…" : "filling…")
                                             : brief(live.request).text,
               gen: live.phase === "fill" ? [] : autoFilled(i, live.request),
               outText: "…", outDim: true };
    }
    const t = (dry?.trace || []).find((x) => x.i === i);
    if (!t) return { cls: "" };
    if (t.status === "ok") {
      const body = t.response?.body ?? t.response;
      if (t.type !== "mcp") {
        return { cls: "done", chip: "✓", inText: ko ? "앞 결과" : "prior",
                 outText: ko ? "지시문" : "ready" };
      }
      const b = brief(body);
      return { cls: "done", chip: "✓", gen: autoFilled(i, t.request),
               inText: brief(t.request).text, outText: b.text, outBig: b.big, outDim: b.dim };
    }
    if (t.status === "blocked") {
      return { cls: "skip", chip: ko ? "건너뜀" : "skipped",
               inText: brief(t.request).text, outText: ko ? "미호출" : "not called", outDim: true,
               note: ko ? "변경형이라 호출하지 않았습니다 — '변경형 포함' 을 켜면 실제로 부릅니다"
                        : "mutating — enable write to actually call" };
    }
    return { cls: "fail", chip: "✕", inText: brief(t.request).text,
             outText: ko ? "실패" : "failed", note: t.error || "" };
  };
  const dryErrors = (dry?.checks || []).filter((c) => c.level === "error").length;

  /* 작성 중인 내용을 비운다. 화면을 떠나지 않으므로 이어서 다시 만들 수 있다.
     시험 결과·오류도 함께 지운다 — 안 지우면 사라진 step 의 결과가 유령으로 남는다. */
  const reset = () => {
    setName(""); setSlug(""); setSlugTouched(false); setDescription(""); setTagsInput("");
    setSteps([]); setSel(null); setCtx(""); setMissing([]); setRecIds([]);
    setInputs([]); setInVals({}); setOutputs([]);
    setDry(null); setDryInput(""); setErr("");
  };

  // ── 저장 ──
  const save = async () => {
    setErr("");
    if (!name.trim()) { setErr(ko ? "이름을 입력하세요." : "Name required."); return; }
    if (steps.length === 0) { setErr(ko ? "최소 1개 step이 필요합니다." : "At least one step required."); return; }
    const outSteps = toPayloadSteps();
    if (!outSteps) return;
    const body = {
      name: name.trim(), slug: effSlug, description,
      tags: tagsInput.split(",").map((x) => x.trim()).filter(Boolean),
      inputs, outputs, steps: outSteps, enabled: true,
    };
    setSaving(true);
    try {
      if (editId) await api.updateSkill(editId, body);
      else await api.createSkill(body);
      go("skillManage");
    } catch (e) {
      setErr(e.message || (ko ? "저장 실패" : "Save failed"));
    } finally { setSaving(false); }
  };

  // 커넥터 (삽입 지점) — idx 위치에 삽입
  // flow — 이 선으로 지금 데이터가 건너가는 중. 패킷이 타고 흐른다.
  const Conn = ({ idx, flow = false }) => (
    <div className={`skl-conn ${overIdx === idx ? "over" : ""} ${flow ? "flow" : ""}`}
      onDragOver={(e) => { if (dragRef.current) { e.preventDefault(); setOverIdx(idx); } }}
      onDragLeave={() => setOverIdx((v) => (v === idx ? null : v))}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onConnDrop(idx); }}>
      {/* 원형 버튼이라 라벨은 title 로만. 안에 글자를 넣으면 22px 안에서 세로로 접힌다. */}
      <button className="skl-addp" title={ko ? "여기에 프롬프트 넣기" : "insert prompt here"}
        aria-label={ko ? "여기에 프롬프트 넣기" : "insert prompt here"}
        onClick={() => addPrompt(idx)}>＋</button>
    </div>
  );
  /* ── 화면 상태 ────────────────────────────────────────────
     한 화면이 다섯 얼굴을 갖는다. 셋을 한꺼번에 렌더하면 빈 캔버스에 유령 노드만
     떠 있는 지금 화면이 된다 — 무엇을 보여줄지는 상태가 정한다. */
  const phase = drafting === "draft" ? "generating"
    : drying ? "testing"
    : steps.length === 0 ? "empty"
    : dry ? "tested" : "ready";
  const started = phase !== "empty" && phase !== "generating";

  /* 툴이 어느 리소스에서 오는지 — API·DB·RAG·문서는 성격이 달라 같은 색이면 구분이 안 된다.
     프롬프트는 호출이 아니라 판단이라 아예 다른 계열(보라)로 뗀다. */
  const toolKind = (tl) => {
    if (!tl) return "api";
    const src = `${tl.source || ""} ${tl.service || ""} ${tl.tool_id || ""}`.toLowerCase();
    if (/rag|vector|embed|약관|doc/.test(src)) return "rag";
    if (/^db|db[:_-]|postgres|pg-|mysql|oracle|legacy-|_tb_|table/.test(src)) return "db";
    return "api";
  };
  const kindOf = (s) => (s.type !== "mcp" ? "prompt" : toolKind(tools.find((tl) => tl.tool_id === s.tool_id)));
  const KIND_LB = { api: "API", db: "DB", rag: "RAG", prompt: ko ? "판단" : "REASON" };

  /* ⑫ 툴이 왜 거기 있는지 — 카드 안에 설명을 다 넣으면 정보량이 넘친다.
     한 줄 요약만 카드에 두고, 스킬 전체 서사는 캔버스 위 한 줄(스토리 스트립)로 잇는다.
     노드는 식별자, 스트립은 이야기 — 역할을 나눈다. */
  const summaryOf = (s) => {
    if (s.type !== "mcp") return ko ? "결과를 판단해 정리" : "judge and format";
    const sp = specs[s.tool_id]?.summary;
    const tl = tools.find((x) => x.tool_id === s.tool_id);
    const raw = sp || tl?.summary || "";
    return raw.split(/[—\-·|]/)[0].trim() || (ko ? "설명 없음" : "no summary");
  };

  /* 카드 하단 IN/OUT — 한 자리, 세 얼굴.
     테스트 전엔 무엇을 받을지(계약), 실행 중엔 지금 무엇으로 부르는지(실제 인자),
     실행 후엔 무엇이 나왔는지(결과). 같은 칸이 상태마다 다른 사실을 말한다. */
  const argSummary = (s) => {
    let a = {};
    try { a = JSON.parse(s.argsText || "{}"); } catch { a = {}; }
    const keys = Object.keys(a);
    if (!keys.length) return { text: ko ? "값 없음" : "no args", cls: "wait" };
    const k0 = keys[0], v0 = a[k0];
    const rest = keys.length > 1 ? ` ${ko ? "외" : "+"}${keys.length - 1}` : "";
    if (typeof v0 === "string") {
      if (v0 === "{{input}}") return { text: `${k0} ← ${ko ? "입력값" : "input"}${rest}` };
      const m = /^\{\{steps\[(\d+)\]/.exec(v0);
      if (m) return { text: `${k0} ← ${Number(m[1]) + 1}${ko ? " 결과" : ""}${rest}` };
    }
    return { text: `${k0}${rest}` };
  };
  const cardIO = (i, s) => {
    if (live && live.i === i) {
      return {
        in: { text: live.phase === "fill" ? (ko ? "인자 채우는 중…" : "filling…") : brief(live.request).text, cls: "run" },
        out: { text: ko ? "호출 중…" : "calling…", cls: "run" },
      };
    }
    const t = (dry?.trace || []).find((x) => x.i === i);
    if (!t) {
      // 아직 안 돌렸다 — 결과 칸에 숫자를 지어내지 않는다
      return {
        in: s.type === "mcp" ? argSummary(s) : { text: ko ? "앞 단계 결과" : "prior steps" },
        out: { text: ko ? "실행 전" : "not run", cls: "wait" },
      };
    }
    if (t.status !== "ok") {
      const skip = t.status === "blocked";
      return {
        in: { text: brief(t.request).text },
        out: { text: skip ? (ko ? "건너뜀" : "skipped") : (ko ? "실패" : "failed"), cls: skip ? "skip" : "fail" },
      };
    }
    const gen = autoFilled(i, t.request);
    const body = t.response?.body ?? t.response;
    return {
      in: gen.length
        ? { text: `${ko ? "자동값" : "auto"} ${gen.length}`, cls: "auto",
            title: `${ko ? "시험 실행이 지어낸 값" : "invented by test run"}: ${gen.join(", ")}` }
        : { text: brief(t.request).text },
      out: { text: s.type === "mcp" ? brief(body).text : (ko ? "답변 생성" : "answer"), cls: "ok" },
    };
  };
  const stepState = (i) => {
    if (live && live.i === i) return "run";
    const t = (dry?.trace || []).find((x) => x.i === i);
    if (!t) return "";
    return t.status === "ok" ? "ok" : t.status === "blocked" ? "skip" : "fail";
  };

  /* 팔레트 — 평면 나열 대신 서버별 묶음. 이미 트랙에 올라간 툴은 흐리게 해 중복 추가를 막는다. */
  const usedIds = new Set(steps.filter((s) => s.type === "mcp").map((s) => s.tool_id));
  const palGroups = useMemo(() => {
    const q = palQ.trim().toLowerCase();
    const hit = tools.filter((tl) => !q
      || tl.tool_id.toLowerCase().includes(q)
      || (tl.summary || "").toLowerCase().includes(q)
      || (tl.service || tl.source || "").toLowerCase().includes(q));
    const m = new Map();
    hit.forEach((tl) => {
      const k = tl.service || (ko ? "기타" : "other");
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(tl);
    });
    return [...m.entries()].map(([nm, list]) => ({ nm, list })).sort((a, b) => b.list.length - a.list.length);
  }, [tools, palQ]);

  // 팔레트와 인스펙터는 동시에 열리지 않는다 — 캔버스를 양쪽에서 깎으면 볼 게 없다
  const openPal = () => { setPalOpen(true); setSel(null); };
  const closeAll = () => { setPalOpen(false); setSel(null); };
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || "");
      if (e.key === "Escape") { closeAll(); setSaveOpen(false); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (started) setSaveOpen(true); return; }
      if (typing) return;
      if (e.key === "t" || e.key === "T") { e.preventDefault(); palOpen ? setPalOpen(false) : openPal(); }
      else if (e.key === "/") { e.preventDefault(); document.querySelector(".skl-askbar input, .skl-askthin input")?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palOpen, started]);   // eslint-disable-line react-hooks/exhaustive-deps

  const EXAMPLES = ko
    ? ["직업급수로 담보한도 조회", "계약 사고이력 요약", "약관에서 면책조항 찾기"]
    : ["Look up coverage limit by job grade", "Summarize accident history", "Find exclusions in the policy"];

  /* ── 캔버스 뷰포트 — 대시보드처럼 확대·이동한다 ──────────────
     다이어그램은 화면 가운데에서 시작한다. 위에 붙여 놓으면 아래가 통째로 비어
     "페이지 상단에 얹힌 목록" 으로 읽힌다. */
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  // 자동으로 옮길 때만 부드럽게. 손으로 끄는 동안 켜 두면 끌림이 한 박자 늦게 따라온다.
  const [glide, setGlide] = useState(false);
  const panRef = useRef(null);
  const boardRef = useRef(null);
  const Z_MIN = 0.4, Z_MAX = 2;
  const clampZ = (z) => Math.min(Z_MAX, Math.max(Z_MIN, z));
  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 2) return;
    e.preventDefault();
    // 커서를 기준으로 확대한다 — 화면 중앙 기준이면 보고 있던 노드가 달아난다
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return;
    const cx = e.clientX - r.left - r.width / 2;
    const cy = e.clientY - r.top - r.height / 2;
    setView((v) => {
      const z = clampZ(v.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      const k = z / v.z;
      return { z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  };
  const onPanDown = (e) => {
    if (e.button !== 0 || e.target.closest(".skl-node,.skl-conn,.skl-term,.skl-overlay")) return;
    setGlide(false);
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
  };
  useEffect(() => {
    const move = (e) => {
      const p = panRef.current;
      if (!p) return;
      setView((v) => ({ ...v, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }));
    };
    const up = () => { panRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  const fitView = () => setView({ z: 1, x: 0, y: 0 });

  /* 스켈레톤 → 노드.
     좌표를 재서 옮기는 FLIP 을 썼다가 걷어냈다. 초안이 오는 순간 인스펙터가 열려 보드 폭이
     줄고, 빠진 단계가 끼어들어 트랙이 다시 계산된다 — 옛 좌표로 잡은 transform 이 어긋난
     자리에 굳는다. 대신 스켈레톤과 카드를 같은 크기·같은 줄에 두고 크로스페이드로 잇는다.
     자리와 크기가 같으면 둘이 같은 것이라는 게 그것만으로 읽힌다. */

  /* 빠진 자리 — 목록으로 아래에 몰아 두면 "어느 단계에 무엇이 없는지" 를 알 수 없다.
     LLM 이 지목한 그 자리에 그대로 꽂는다. 실행되지 않는다는 사실은 형태로 말한다. */
  const gapsAt = (i) => missing.filter((g) => (g?.at ?? null) === i);
  /* 스토리 한 줄에 빠진 단계도 섞는다. 실제 도구만 이어 놓으면 "왜 답이 안 나오는지" 가
     문장에서 사라진다 — 구멍이 보여야 무엇이 더 필요한지 읽힌다. */
  const storyParts = (() => {
    const out = [];
    const push = (i) => gapsAt(i).forEach((g, k) =>
      out.push({ key: `g${i}-${k}`, gap: true, text: g.need }));
    push(0);
    steps.forEach((s2, i) => {
      out.push({ key: s2.uid, uid: s2.uid, i, kind: kindOf(s2), text: summaryOf(s2) });
      push(i + 1);
    });
    return out;
  })();

  /* 노드를 한 줄로만 늘어놓으면 개수가 늘수록 배율을 줄여야 하고, 그러면 무엇인지 안 읽힌다.
     3개씩 끊어 줄을 바꾸되 줄 사이를 선으로 이어 흐름이 끊기지 않게 한다. */
  const ROW = 3;
  const cells = (() => {
    const cells = [];
    gapsAt(0).forEach((g, k) => cells.push({ key: `g0-${k}`, gap: true, need: g.need }));
    steps.forEach((s2, i) => {
      cells.push({ key: s2.uid, step: s2, i });
      gapsAt(i + 1).forEach((g, k) => cells.push({ key: `g${i}-${k}`, gap: true, need: g.need }));
    });
    gapsAt(null).forEach((g, k) => cells.push({ key: `gn-${k}`, gap: true, need: g.need }));
    return cells;
  })();

  const runNow = () => { setPalOpen(false); setSel(null); runDry(); };

  return (
    <div className="skl-page">
      <div className="skl-head">
        <div className="skl-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.4 5.3L20 9l-4 4 1 6-5-2.8L7 19l1-6-4-4 5.6-.7Z" /></svg>
        </div>
        <div>
          <h1>{editId ? (ko ? "Skill 수정" : "Edit Skill") : t.navSkillCreate}</h1>
          <p>{ko ? "한 문장으로 적으면 필요한 MCP를 골라 이어 붙입니다" : "Describe it in a sentence — the tools get wired for you"}</p>
        </div>
        <div className="sp">
          {err && <span style={{ color: "var(--red)", fontSize: 12, fontWeight: 700 }}>{err}</span>}
        </div>
      </div>

      <div className="skl-stage">
        {/* 툴바 — 패널 토글과 실행/저장이 한 줄에. 캔버스 위에 떠서 가리지 않는다. */}
        <div className="skl-toolbar">
          <button className={`skl-tg ${palOpen ? "on" : ""}`} onClick={() => (palOpen ? setPalOpen(false) : openPal())}
            title={ko ? "MCP 팔레트 (T)" : "MCP palette (T)"} aria-label={ko ? "MCP 팔레트" : "MCP palette"}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" /></svg>
          </button>
          {started && (
            <div className="skl-ask2">
              <span className="sp">{drafting ? <i className="exp-spin" /> : <Spark s={15} />}</span>
              <input value={ctx} onChange={(e) => setCtx(e.target.value)} disabled={!!drafting}
                onKeyDown={(e) => { if (e.key === "Enter") runDraft(); }}
                placeholder={ko ? "다시 물어보기 — 예: 계약 사고이력을 요약해 주세요" : "ask again"} />
              {drafting
                ? <button className="exp-stop" onClick={stopDraft}
                    title={ko ? "중지" : "stop"} aria-label={ko ? "중지" : "stop"}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  </button>
                : <button className="exp-go" disabled={!ctx.trim()} onClick={() => runDraft()}
                    aria-label={ko ? "다시 만들기" : "rebuild"}>→</button>}
            </div>
          )}
          {started && (
            <div className="sp">
              <div className="skl-name">
                <input className="skl-nm" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={ko ? "Skill 이름" : "Skill name"} />
                <span className="skl-slug">/<input value={effSlug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} /></span>
              </div>
              <button className="skl-icbtn pri" disabled={dryErrors > 0} onClick={() => setSaveOpen(true)}
                title={dryErrors > 0
                  ? (ko ? "시험 실행에서 발견된 오류를 먼저 고치세요" : "Fix the errors found first")
                  : (ko ? "저장 (⌘S)" : "Save (⌘S)")}
                aria-label={ko ? "저장" : "Save"}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" /></svg>
              </button>
            </div>
          )}
        </div>

        <div className="skl-work">
          {/* 좌 팔레트 — 도크. 기본 닫힘. */}
          {palOpen && (
            <aside className="skl-dock left">
              <div className="skl-dock-h">{ko ? "MCP 팔레트" : "MCP palette"}
                <span className="c">{tools.length}</span>
                <button className="x" onClick={() => setPalOpen(false)} aria-label={ko ? "닫기" : "close"}>✕</button></div>
              <div className="skl-srch">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
                <input value={palQ} onChange={(e) => setPalQ(e.target.value)}
                  placeholder={ko ? "툴·설명·서버 검색" : "search tool, summary, server"} />
              </div>
              <div className="skl-dock-b">
                {palGroups.length === 0 && <div className="skl-empty">{ko ? "결과 없음" : "no match"}</div>}
                {palGroups.map((g) => (
                  <div key={g.nm} className="skl-palgrp2">
                    <div className="gh">{g.nm} · {g.list.length}</div>
                    {g.list.map((tl) => {
                      const used = usedIds.has(tl.tool_id);
                      return (
                        <div key={tl.tool_id} className={`skl-prow ${used ? "used" : ""}`}
                          draggable={!used}
                          onDragStart={() => { if (!used) dragRef.current = { type: "mcp", tool: tl }; }}
                          onDragEnd={() => { dragRef.current = null; setOverIdx(null); }}
                          title={tl.summary || tl.tool_id}>
                          <span className="g">{used ? "✓" : "⠿"}</span>
                          <span className="nm">{tl.tool_id}</span>
                          <span className={`skl-meth ${methCls(tl.method)}`}>{tl.method}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* 보드 */}
          <div ref={boardRef} className={`skl-board ${overIdx === -2 ? "dropping" : ""} ${started ? "canvas" : ""}`}
            onWheel={started ? onWheel : undefined}
            onMouseDown={started ? onPanDown : undefined}
            /* 캔버스가 된 보드는 스크롤되지 않는다 — 이동은 씬 transform 뿐이다. 그런데 안쪽
               입력칸에 포커스가 가면 브라우저가 제 마음대로 여기를 스크롤하고, 그러면 절대배치된
               오버레이(위 흐름·실행 로그)가 통째로 밀린다. 밀리는 즉시 되돌린다.
               시작 전 보드는 목록이라 진짜로 스크롤한다 — 그때는 손대지 않는다. */
            onScroll={started ? (e) => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; } : undefined}
            onDragOver={(e) => { if (dragRef.current) { e.preventDefault(); setOverIdx(-2); } }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOverIdx((v) => (v === -2 ? null : v)); }}
            onDrop={(e) => { e.preventDefault(); onConnDrop(steps.length); }}
            onClick={(e) => { if (e.currentTarget === e.target) setSel(null); }}>

            {(phase === "empty" || phase === "generating" || leaving) && (
              <div className={`skl-hero ${leaving ? "leaving" : ""}`}>
                <div className="exp-kicker">
                  <h2>{drafting
                    ? (ko ? "필요한 도구를 고르는 중" : "Picking the tools")
                    : (ko ? "어떤 스킬을 만들까요?" : "What should this skill do?")}</h2>
                  <p>{drafting
                    ? (ko ? "관련 있는 MCP만 남기고 부를 순서를 잡고 있습니다." : "Keeping only what's relevant and ordering the calls.")
                    : (ko ? "문장으로 적으면 필요한 MCP와 순서를 찾아 이어 붙입니다." : "Describe it — the tools and their order get wired for you.")}</p>
                </div>
                <div className="exp-askbar">
                  <span className="sp">{drafting ? <i className="exp-spin lg" /> : <Spark s={21} />}</span>
                  <input value={ctx} onChange={(e) => setCtx(e.target.value)} disabled={!!drafting}
                    onKeyDown={(e) => { if (e.key === "Enter") runDraft(); }}
                    placeholder={ko ? "예: 계약 사고이력을 요약해서 보여주고 싶어요" : "e.g. summarize accident history for a contract"} />
                  {drafting
                    ? <button className="exp-stop" onClick={stopDraft}
                        title={ko ? "중지" : "stop"} aria-label={ko ? "중지" : "stop"}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      </button>
                    : <button className="exp-go" disabled={!ctx.trim()} onClick={runDraft}
                        aria-label={ko ? "만들기" : "build"}>→</button>}
                </div>
                {!drafting && (
                  <div className="exp-chips">
                    <span className="lb">{recentQ.length ? (ko ? "최근 입력" : "recent") : (ko ? "예시" : "try")}</span>
                    {(recentQ.length ? recentQ.slice(0, 4) : EXAMPLES).map((x) => (
                      <button key={x} onClick={() => { setCtx(x); runDraft(x); }}>{x}</button>
                    ))}
                  </div>
                )}
                {/* 생성 중에는 자리가 잡히는 것이 보여야 한다 — 빈 화면에서 결과가 툭 떨어지면 놀란다 */}
                {drafting && (
                  <div className="skl-skel">
                    {[0, 1, 2].map((k) => <div key={k} className="c" style={{ animationDelay: `${k * 0.12}s` }} />)}
                  </div>
                )}
              </div>
            )}
            {started && (
              <>
                <div className="skl-overlay top" onWheel={(e) => e.stopPropagation()}>
                {/* 이 스킬이 무엇을 하는가 — 노드는 식별자만 갖고, 서사는 여기 한 줄로 잇는다.
                    구절에 손을 올리면 그 노드가 밝아져 어느 단계 이야기인지 짚인다. */}
                {steps.length > 0 && (
                  <div className="skl-story">
                    {storyParts.map((it, k) => (
                      <Fragment key={it.key}>
                        {k > 0 && <span className="ar">→</span>}
                        {it.gap ? (
                          <span className="p gap" title={it.text}>{it.text}</span>
                        ) : (
                          <button className={`p ${it.kind} ${sel === it.uid ? "on" : ""}`}
                            onMouseEnter={() => setHover(it.i)} onMouseLeave={() => setHover(null)}
                            onClick={() => { setPalOpen(false); setSel(it.uid); }}>
                            {it.text}
                          </button>
                        )}
                      </Fragment>
                    ))}
                  </div>
                )}

                {phase === "testing" && (
                  <div className="skl-runbar">
                    <span className="pg">{Math.min((live?.i ?? 0) + 1, steps.length)} / {steps.length}</span>
                    <span className="meter"><i style={{ width: `${Math.min(((live?.i ?? 0) + 1) / Math.max(steps.length, 1) * 100, 100)}%` }} /></span>
                    <span className="what">
                      {live
                        ? `${live.tool_id || (ko ? "프롬프트" : "prompt")} · ${live.phase === "fill"
                            ? (ko ? "인자 채우는 중" : "filling args")
                            : `${ko ? "호출 중" : "calling"} ${JSON.stringify(live.request || {})}`}`
                        : (ko ? "준비 중…" : "starting…")}
                    </span>
                  </div>
                )}
                </div>

                {/* 씬 — 확대·이동되는 층. 다이어그램만 여기 들어간다. */}
                <div className="skl-scene" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                  transition: glide ? "transform .32s cubic-bezier(.2,.8,.2,1)" : "none" }}>
                <div className="skl-track">
                  <div className="skl-term io" title={inputs.length
                    ? inputs.map((f) => `${f.name}${f.required ? "*" : ""}`).join(", ")
                    : (ko ? "선언된 입력 없음 — 문장 하나로 받습니다" : "no declared inputs")}>IN
                    {inputs.length
                      ? inputs.slice(0, 3).map((f) => <b key={f.name}>{f.name}{f.required && <i>*</i>}</b>)
                      : <b>{"{{input}}"}</b>}
                    {inputs.length > 3 && <b className="more">+{inputs.length - 3}</b>}
                  </div>
                  {cells.map((cell, n) => (
                    <Fragment key={cell.key}>
                      {cell.gap || n === 0 || cells[n - 1].gap
                        ? <div className="skl-wire" />
                        : <Conn idx={cell.i} flow={!!live && live.i === cell.i} />}
                      {cell.gap ? <GapNode need={cell.need} ko={ko} /> : (() => {
                        const s2 = cell.step, i = cell.i;
                        const io = cardIO(i, s2);
                        const st = stepState(i);
                        return (
                          <div data-step={i} className={`skl-node k-${kindOf(s2)} ${sel === s2.uid ? "sel" : ""} ${st} ${hover === i ? "hi" : ""}`}
                            draggable
                            onClick={(e) => { e.stopPropagation(); setPalOpen(false); setSel(s2.uid); }}
                            onDragStart={(e) => { e.stopPropagation(); dragRef.current = { type: "move", uid: s2.uid }; }}
                            onDragEnd={() => { dragRef.current = null; setOverIdx(null); }}>
                            <div className="hd">
                              <span className="no">{String(i + 1).padStart(2, "0")}</span>
                              <span className={`dot ${st}`} />
                              <span className="t" title={s2.tool_id}>{s2.type === "mcp" ? s2.tool_id : (ko ? "프롬프트" : "Prompt")}</span>
                              <button className="rm" title={ko ? "삭제" : "remove"}
                                onClick={(e) => { e.stopPropagation(); removeStep(s2.uid); }}>✕</button>
                            </div>
                            <div className="kd"><span className="kb">{KIND_LB[kindOf(s2)]}</span>
                              {s2.type === "mcp" && <span className="sv">{tools.find((tl) => tl.tool_id === s2.tool_id)?.service || ""}</span>}</div>
                            <div className="sm" title={summaryOf(s2)}>{summaryOf(s2)}</div>
                            <div className="io">
                              <div className="l"><span className="k">IN</span>
                                <span className={`v ${io.in.cls || ""}`} title={io.in.title}>{io.in.text}</span></div>
                              <div className="l"><span className="k">OUT</span>
                                <span className={`v ${io.out.cls || ""}`}>{io.out.text}</span></div>
                            </div>
                          </div>
                        );
                      })()}
                    </Fragment>
                  ))}
                  <Conn idx={steps.length} />
                  {/* OUT — 선언했으면 그 항목들. 안 했으면 마지막 결과 그대로다.
                      한 번 돌리면 관측한 모양이 여기 들어온다(지어내지 않는다). */}
                  <div className="skl-term io" title={outputs.length
                    ? outputs.map((f) => `${f.name}${f.type ? `: ${f.type}` : ""}`).join(", ")
                    : (ko ? "선언된 출력 없음 — 마지막 결과 그대로" : "no declared outputs")}>OUT
                    {outputs.length
                      ? outputs.slice(0, 3).map((f) => <b key={f.name}>{f.name}</b>)
                      : <b>{"{{output}}"}</b>}
                    {outputs.length > 3 && <b className="more">+{outputs.length - 3}</b>}
                  </div>
                </div>
                </div>

                <div className="skl-zoom skl-overlay">
                <button onClick={() => setView((v) => ({ ...v, z: clampZ(v.z / 1.15) }))}
                  aria-label={ko ? "축소" : "zoom out"}>−</button>
                <span>{Math.round(view.z * 100)}%</span>
                <button onClick={() => setView((v) => ({ ...v, z: clampZ(v.z * 1.15) }))}
                  aria-label={ko ? "확대" : "zoom in"}>+</button>
                <button className="fit" onClick={fitView}
                  title={ko ? "처음 위치로" : "reset view"} aria-label={ko ? "처음 위치로" : "reset view"}>⤢</button>
          </div>

                <div className="skl-overlay bottom" onWheel={(e) => e.stopPropagation()}>
                {/* 실행 로그 — 카드에서 놓친 세부를 여기서 편다 */}
                {started && (
                  <div className="skl-log">
                    <div className="lh">
                      {ko ? "실행 로그" : "Run log"}
                      {dry && (
                        <span className={`vd ${dryErrors ? "err" : dry.ok ? "ok" : "warn"}`}>
                          {dryErrors ? (ko ? `오류 ${dryErrors}` : `${dryErrors} error`)
                            : dry.ok ? (ko ? "통과" : "passed") : (ko ? "진행 중" : "running")}</span>
                      )}
                      {inputs.length ? (
                        <span className="ins">
                          {inputs.map((f) => (
                            <label key={f.name} title={f.description || f.name}>
                              <em>{f.name}</em>
                              <input value={inVals[f.name] ?? ""}
                                placeholder={f.example || f.name}
                                onChange={(e) => setInVals((v) => ({ ...v, [f.name]: e.target.value }))} />
                            </label>
                          ))}
                        </span>
                      ) : (
                        <input className="in" value={dryInput} onChange={(e) => setDryInput(e.target.value)}
                          placeholder={ko ? "{{input}} 값" : "input value"} />
                      )}
                      <button className="run" disabled={drying || !steps.length} onClick={runNow}>
                        {drying ? (ko ? "실행 중…" : "running…")
                          : dry ? (ko ? "다시 실행" : "Re-run") : (ko ? "테스트 실행" : "Test run")}
                      </button>
                      <label className="wr" title={ko ? "POST 등 변경형도 실제로 호출합니다" : "actually call mutating tools"}>
                        <input type="checkbox" checked={dryWrite} onChange={(e) => setDryWrite(e.target.checked)} />
                        {ko ? "변경형 포함" : "writes"}</label>
                      {dry && <button className="x" onClick={() => setDry(null)}
                        aria-label={ko ? "닫기" : "close"}>✕</button>}
                    </div>
                    {dry?.answer && (
                      <div className="skl-answer">
                        <div className="ah">{ko ? "이 스킬의 답변" : "Answer"}
                          {dry.degraded && <span className="dg">{ko ? "합성 실패 — 원문" : "degraded"}</span>}</div>
                        <div className="ab">{dry.answer}</div>
                      </div>
                    )}
                    {dry && <div className="lb2">
                      {dry.checks.map((c, k) => (
                        <div key={`c${k}`} className={`r lv-${c.level}`}>
                          <span className="st">{c.step != null ? String(c.step + 1).padStart(2, "0") : "—"}</span>
                          <span className="ms">{c.msg}</span>
                        </div>
                      ))}
                      {dry.trace.map((tr) => {
                        const gen = autoFilled(tr.i, tr.request);
                        const body = tr.response?.body ?? tr.response;
                        return (
                          <div key={`t${tr.i}`} className={`r lv-${tr.status === "ok" ? "ok" : tr.status === "blocked" ? "warn" : "error"}`}>
                            <span className="st">{String(tr.i + 1).padStart(2, "0")}</span>
                            <span className="ms">
                              <b>{tr.type === "mcp" ? tr.tool_id : (ko ? "프롬프트" : "prompt")}</b>
                              {tr.type === "mcp" && ` ← ${JSON.stringify(tr.request || {})}`}
                              {!!gen.length && <em className="auto"> ({ko ? "자동값" : "auto"} {gen.join(", ")})</em>}
                              {tr.status === "ok" && ` → ${brief(body).text}`}
                              {tr.status === "blocked" && ` — ${ko ? "변경형이라 건너뜀" : "mutating, skipped"}`}
                              {tr.error && ` — ${tr.error}`}
                            </span>
                          </div>
                        );
                      })}
                      {live && !dry.trace.some((x) => x.i === live.i) && (
                        <div className="r live">
                          <span className="st">{String(live.i + 1).padStart(2, "0")}</span>
                          <span className="ms"><b>{live.tool_id || (ko ? "프롬프트" : "prompt")}</b>
                            {live.phase === "fill" ? ` — ${ko ? "인자 채우는 중…" : "filling…"}`
                              : ` ← ${JSON.stringify(live.request || {})} · ${ko ? "호출 중…" : "calling…"}`}</span>
                        </div>
                      )}
                    </div>}
                  </div>
                )}
                </div>
              </>
            )}
          </div>

          {/* 우 인스펙터 — 노드를 골랐을 때만 존재한다 */}
          {selStep && (
            <aside className="skl-dock right">
              <div className="skl-dock-h">
                <span className="mono">{selStep.type === "mcp" ? selStep.tool_id : (ko ? "프롬프트" : "Prompt")}</span>
                <button className="x" onClick={() => setSel(null)} aria-label={ko ? "닫기" : "close"}>✕</button>
              </div>
              <div className="skl-dock-b">
                {selStep.type === "prompt" ? (
                  <>
                    <div className="skl-does">{ko
                      ? "앞 단계 결과를 받아 무엇을 판단하고 어떤 형식으로 답할지 지시합니다."
                      : "Tells the agent how to judge and format the result."}</div>
                    <div className="fld">
                      <label className="lbrow">{ko ? "지시문" : "Instruction"}
                        <button className="ic" disabled={!!drafting} onClick={() => draftPrompt(selStep.uid)}
                          title={ko ? "다시 추천받기" : "regenerate"} aria-label={ko ? "다시 추천받기" : "regenerate"}>
                          {drafting === "prompt" ? <i className="skl-spin" /> : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
                          )}
                        </button>
                      </label>
                      <textarea value={selStep.text} onChange={(e) => patchSel({ text: e.target.value, badge: null })}
                        placeholder={ko ? "판단 기준과 출력 형식을 적으세요" : "enter instruction"} /></div>
                    <div className="fld"><label>{ko ? "가져올 값" : "Variables"}</label>
                      <div>{vars.map((v) => <span key={v} className="skl-varchip" onClick={() => insertVar(v)}>{v}</span>)}</div></div>
                  </>
                ) : (
                  <>
                    <div className="skl-svline">
                      <span className="sv">{tools.find((tl) => tl.tool_id === selStep.tool_id)?.service || "—"}</span>
                      <span className={`skl-meth ${methCls(tools.find((tl) => tl.tool_id === selStep.tool_id)?.method)}`}>
                        {tools.find((tl) => tl.tool_id === selStep.tool_id)?.method || "GET"}</span>
                    </div>
                    {specs[selStep.tool_id]?.summary && <div className="skl-does">{specs[selStep.tool_id].summary}</div>}
                    <div className="fld">
                      <label>IN</label>
                      {(specs[selStep.tool_id]?.fields || []).length === 0 ? (
                        <div className="skl-empty" style={{ padding: "8px 0" }}>{ko ? "넣을 값 없음" : "no parameters"}</div>
                      ) : (
                        <div className="skl-vals">
                          {specs[selStep.tool_id].fields.map((f) => {
                            const cur = argsObj()[f.name] ?? "";
                            const opts = valueOptions();
                            const known = opts.some((o) => o.v === cur);
                            return (
                              <div key={f.name} className="skl-val">
                                <div className="top">
                                  <span className="nm">{f.name}</span>
                                  {f.required && <span className="must">{ko ? "필수" : "required"}</span>}
                                  <span className="raw">{f.loc} · {f.type}</span>
                                </div>
                                <select value={known ? cur : "__literal__"}
                                  onChange={(e) => setArg(f.name, e.target.value === "__literal__" ? " " : e.target.value)}>
                                  {opts.map((o) => <option key={o.v || "empty"} value={o.v}>{o.label}</option>)}
                                  <option value="__literal__">{ko ? "직접 적어 넣기" : "literal"}</option>
                                </select>
                                {!known && (
                                  <input className="skl-valfree" value={cur} placeholder={ko ? "넣을 값" : "value"}
                                    onChange={(e) => setArg(f.name, e.target.value)} />
                                )}
                                {/* 앞 단계 응답에서 바로 집기 — 문법을 몰라도 경로가 정확히 꽂힌다 */}
                                {priorOutputs().map((g) => (
                                  <div key={g.i} className="skl-pick">
                                    <div className="hd">{g.i + 1}{ko ? "단계 결과" : " output"} · <code>{g.tool_id}</code></div>
                                    <div className="paths">
                                      {g.nodes.map((n) => (
                                        <button key={n.path} type="button" title={`${n.path}}}`}
                                          className={cur === `${n.path}}}` ? "on" : ""}
                                          onClick={() => setArg(f.name, `${n.path}}}`)}>
                                          <span className="p">{n.path.replace(/^\{\{steps\[\d+\]\.output/, "") || "(전체)"}</span>
                                          <span className="ex">{n.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button className="skl-rawtoggle" onClick={() => setShowJson((v) => !v)}>
                        {showJson ? (ko ? "접기" : "hide") : (ko ? "</> 실제 저장되는 값" : "</> raw JSON")}
                      </button>
                      {showJson && (
                        <textarea className="mono" value={selStep.argsText}
                          onChange={(e) => patchSel({ argsText: e.target.value })}
                          placeholder='{ "id": "{{input}}" }' />
                      )}
                    </div>
                    {/* OUT — 돌려본 적이 있을 때만. 안 돌렸으면 스키마를 지어내지 않는다. */}
                    {(() => {
                      const tr = (dry?.trace || []).find((x) => x.i === selIdx && x.status === "ok");
                      if (!tr) return null;
                      const nodes = outTree(tr.response?.body ?? tr.response, "", 0, []);
                      return (
                        <div className="fld"><label>OUT · {brief(tr.response?.body ?? tr.response).text}</label>
                          <div className="skl-out">
                            {nodes.slice(0, 8).map((n) => (
                              <div key={n.path} className="l"><span className="p">{n.path || "(전체)"}</span>
                                <span className="ex">{n.label}</span></div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* 저장 — 스킬 메타는 노드 스코프가 아니라 여기에 모은다 */}
      {saveOpen && (
        <div className="skl-modal" onClick={(e) => { if (e.currentTarget === e.target) setSaveOpen(false); }}>
          <div className="skl-dlg" role="dialog" aria-label={ko ? "스킬 저장" : "Save skill"}>
            <h5>{ko ? "스킬 저장" : "Save skill"}</h5>
            <div className="f"><span className="l">{ko ? "이름" : "Name"}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
            <div className="f"><span className="l">{ko ? "슬러그" : "Slug"}</span>
              <input className="mono" value={effSlug}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} /></div>
            <div className="f"><span className="l">{ko ? "설명" : "Description"}</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="f"><span className="l">{ko ? "태그" : "Tags"}</span>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="고객, 담보" /></div>
            <div className="f"><span className="l">{ko ? "받는 값" : "Inputs"}</span>
              {inputs.length ? (
                <div className="skl-iolist">
                  {/* key 는 자리 번호다. 이름을 키로 쓰면 한 글자 칠 때마다 입력칸이
                      새로 만들어져 커서가 튄다 — 이름을 고칠 수 없다. */}
                  {inputs.map((f, k) => (
                    <div key={k} className="r">
                      <input className="nm" value={f.name}
                        onChange={(e) => setInputs((v) => v.map((x, j) => j === k ? { ...x, name: e.target.value } : x))} />
                      <span className="ty">{f.type}</span>
                      <button className={f.required ? "rq on" : "rq"}
                        title={ko ? "필수 여부" : "required"}
                        onClick={() => setInputs((v) => v.map((x, j) => j === k ? { ...x, required: !x.required } : x))}>
                        {f.required ? (ko ? "필수" : "req") : (ko ? "선택" : "opt")}</button>
                      <button className="x" onClick={() => setInputs((v) => v.filter((_, j) => j !== k))}
                        aria-label={ko ? "지우기" : "remove"}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ro">{ko ? "선언 없음 — 문장 하나로 받습니다" : "none — takes one sentence"}</div>
              )}
            </div>
            <div className="f"><span className="l">{ko ? "내놓는 값" : "Outputs"}</span>
              {outputs.length ? (
                <div className="skl-iolist">
                  {outputs.map((f, k) => (
                    <div key={k} className="r">
                      <input className="nm" value={f.name}
                        onChange={(e) => setOutputs((v) => v.map((x, j) => j === k ? { ...x, name: e.target.value } : x))} />
                      <span className="ty">{f.type}</span>
                      <button className="x" onClick={() => setOutputs((v) => v.filter((_, j) => j !== k))}
                        aria-label={ko ? "지우기" : "remove"}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                /* 지어내지 않는다 — 한 번 돌려 본 결과의 모양이 곧 초안이다. */
                <div className="ro">{dry?.ok
                  ? (ko ? "결과에서 읽을 값이 없습니다" : "nothing observed in the result")
                  : (ko ? "테스트 실행하면 결과 모양이 여기 채워집니다" : "run a test to fill this in")}</div>
              )}
            </div>
            <div className="f"><span className="l">{ko ? "사용 툴" : "Tools"}</span>
              <div className="ro mono">{steps.map((s) => s.type === "mcp" ? s.tool_id : (ko ? "프롬프트" : "prompt")).join(" · ") || "—"}</div></div>
            {err && <div className="e">{err}</div>}
            <div className="acts">
              <button className="skl-btn ghost" onClick={() => setSaveOpen(false)}>{ko ? "취소" : "Cancel"}</button>
              <button className="skl-btn pri" disabled={saving} onClick={save}>
                {saving ? "…" : (ko ? "저장" : "Save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
