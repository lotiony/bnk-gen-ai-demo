import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { methodStyle } from "../i18n";
import { brandName } from "../brand";

const GRAD = "linear-gradient(140deg,#00A5FF 0%,#13b9d6 46%,#00BEAC 100%)";
const Spark = ({ s = 19, st = "#fff", sw = 1.9 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={st} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z" /></svg>
);

// simulate trace → 디자인 챗 스텝(thought + tool 카드)
function buildSteps(trace, ko) {
  const out = [];
  const search = trace.find((p) => p.phase === "search");
  const desc = trace.find((p) => p.phase === "describe");
  const inv = trace.find((p) => p.phase === "invoke");
  if (search) {
    out.push({ type: "thought", text: ko ? "질의에 맞는 MCP를 찾습니다. search_apis로 후보를 탐색합니다." : "Searching candidates with search_apis." });
    out.push({ type: "tool", tool: "search_apis", args: `query="${search.query}", top_k=5`,
      candidates: (search.candidates || []).slice(0, 3).map((c) => ({ id: c.tool_id, method: c.method, score: Number(c.score).toFixed(4) })) });
  }
  if (desc) {
    out.push({ type: "thought", text: ko ? `${desc.tool_id}가 가장 적합합니다. 명세를 확인합니다.` : `${desc.tool_id} fits best. Checking spec.` });
    const f = (desc.fields || [])[0];
    out.push({ type: "tool", tool: "describe_api", args: `tool_id="${desc.tool_id}"`,
      specText: f ? `param · ${f.name} (${f.loc}, ${f.type}${f.required ? ", required" : ""})` : (desc.summary || "") });
  }
  if (inv) {
    out.push({ type: "thought", text: ko ? "예시 인자로 호출합니다." : "Invoking with sample arguments." });
    out.push({ type: "tool", tool: "invoke_api", args: `tool_id="${inv.tool_id}", arguments=${JSON.stringify(inv.request)}`,
      result: inv.response?.body ?? inv.response });
  }
  return out;
}

// 온톨로지 모드 예시 질문 — 처음 여는 사람이 "뭘 시킬 수 있는지" 바로 알도록.
const ONT_PRESETS = [
  "지금 온톨로지에 클래스 몇 개야?",
  "아직 매핑 안 된 테이블 알려줘",
  "SHACL 돌려서 위반 알려줘",
  "가입특약 클래스 만들고 상위는 특약으로",
];

// chat steps(tool/result) → 화면 카드. ontology tool 은 인자·결과를 그대로 보여준다.
function chatSteps(steps) {
  const out = [];
  for (const s of steps || []) {
    if (s.type === "tool") {
      out.push({ type: "tool", tool: s.tool, args: JSON.stringify(s.args ?? {}) });
    } else if (s.type === "result") {
      const last = out[out.length - 1];
      let v = s.content;
      try { v = JSON.parse(s.content); } catch { /* 문자열 그대로 */ }
      if (last && last.type === "tool" && last.result === undefined) last.result = v;
    }
  }
  return out;
}

// brand="kt"(온톨로지 플랫폼)에서만 온톨로지 기능이 열린다. brand="ember"(EmberLink)에서는
// 모드 토글·프리셋·문구까지 전부 감춰 '온톨로지'라는 단어가 화면에 한 번도 나오지 않는다.
export default function Chat({ t, lang, open, setOpen, brand = "ember" }) {
  const ko = lang === "ko";
  const ontAllowed = brand === "kt";
  const [input, setInput] = useState(t.exampleQuery);
  const [msgs, setMsgs] = useState([]);
  const [steps, setSteps] = useState([]);
  const [running, setRunning] = useState(false);
  const [ontMode, setOnt] = useState(brand === "kt");   // 온톨로지 모드 — 계약·매핑·실체화 tool 활성
  const [fab, setFab] = useState({ x: null, y: null });
  const moved = useRef(false);
  const bodyRef = useRef();

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [steps, msgs, running, open]);
  useEffect(() => { setInput(t.exampleQuery); }, [lang]); // eslint-disable-line
  // 브랜드 전환(로고 더블클릭) — 모드를 그 브랜드의 기본값으로 되돌리고 대화를 비운다.
  // 안 비우면 EmberLink 로 넘어온 화면에 ontology_* tool 카드가 그대로 남는다.
  useEffect(() => { setOnt(ontAllowed); setMsgs([]); setSteps([]); }, [brand]); // eslint-disable-line
  // ESC → 채팅 패널 닫기 (열렸을 때만)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const run = async (preset) => {
    const q = (preset ?? input ?? "").trim(); if (!q || running) return;
    const ont = ontAllowed && ontMode;   // ember 브랜드에서는 어떤 경로로도 온톨로지 tool 이 켜지지 않는다
    // 온톨로지 모드는 대화를 이어간다 — "삭제할까요?" → "네" 확인 게이트가 성립해야 하므로.
    // MCP 시뮬레이션 모드는 기존대로 한 턴씩 초기화.
    const prior = ont ? msgs : [];
    setMsgs(ont ? [...msgs, { role: "user", text: q }] : [{ role: "user", text: q }]);
    setSteps([]); setRunning(true); setInput("");
    try {
      if (ont) {
        const history = prior.map((m) => ({ role: m.role, content: m.text }));
        const d = await api.agentChat(q, { ontology: true, history });
        setSteps(chatSteps(d.steps || []));
        setMsgs((m) => [...m, { role: "assistant", text: d.reply || "(빈 응답)" }]);
      } else {
        const d = await api.agentSimulate(q);
        setSteps(buildSteps(d.trace || [], ko));
        setMsgs((m) => [...m, { role: "assistant", text: d.answer || "(빈 응답)" }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: (ko ? "실행 실패: " : "Failed: ") + e.message }]);
    } finally { setRunning(false); }
  };
  const switchMode = (v) => {
    if (running || v === ontMode || (v && !ontAllowed)) return;   // ember 에서는 온톨로지 모드로 못 넘어간다
    setOnt(v); setMsgs([]); setSteps([]);
  };

  // FAB 드래그
  const fabDown = (e) => {
    moved.current = false;
    const sx = e.clientX, sy = e.clientY;
    const ix = fab.x == null ? window.innerWidth - 86 : fab.x;
    const iy = fab.y == null ? window.innerHeight - 94 : fab.y;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      setFab({ x: Math.max(8, Math.min(window.innerWidth - 66, ix + dx)), y: Math.max(8, Math.min(window.innerHeight - 66, iy + dy)) });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const fabClick = () => { if (!moved.current) setOpen(true); };

  // 화면에 온톨로지 문구·프리셋을 낼지 — 상태가 어떻든 ember 브랜드면 무조건 false.
  const showOnt = ontAllowed && ontMode;

  const fabPos = fab.x == null ? { right: 26, bottom: 26 } : { left: fab.x, top: fab.y };

  // tool 스텝은 '이번 턴'의 것 — 마지막 답변 바로 앞에 끼운다(아직 답이 없으면 맨 끝).
  let stepsAt = msgs.length;
  for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === "assistant") { stepsAt = i; break; } }
  const stepsBlock = steps.length > 0 ? (
    <div style={{ alignSelf: "flex-start", width: "92%", display: "flex", flexDirection: "column", gap: 7 }}>
      {steps.map((s, i) => s.type === "thought" ? (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "stepIn .25s ease-out" }}>
          <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 7, background: "var(--card)", border: "1px solid var(--line2)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3Z" /><path d="M9 21h6" /></svg></span>
          <div style={{ flex: 1, fontSize: 12, color: "var(--text)", lineHeight: 1.5, paddingTop: 1 }}>{s.text}</div>
        </div>
      ) : (
        <div key={i} style={{ background: "var(--card)", border: "1px solid var(--blue-bg)", borderRadius: 13, overflow: "hidden", animation: "stepIn .25s ease-out" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "var(--blue-soft)", borderBottom: "1px solid var(--line)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 1-5.6 5.6l-5.4 5.4a2 2 0 1 0 2.8 2.8l5.4-5.4a4 4 0 0 1 5.6-5.6l-2.6 2.6-1.4-1.4Z" /></svg>
            <span className="mono" style={{ fontSize: 8.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--blue)", fontWeight: 700 }}>{t.agTool}</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>{s.tool}</span>
            {s.result?.confirm_required && <span className="mono" style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", padding: "2px 7px", borderRadius: 7 }}>확인 필요</span>}
          </div>
          <div className="mono" style={{ padding: "10px 12px", fontSize: 10.5, color: "var(--text)" }}>
            <div style={{ color: "var(--muted)", wordBreak: "break-all" }}>{s.args}</div>
            {s.candidates && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>{s.candidates.map((cd, j) => (
              <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "var(--main)", borderRadius: 9 }}>
                <span style={methodStyle(cd.method)}>{cd.method}</span><span style={{ flex: 1, color: "var(--navy)" }}>{cd.id}</span><span style={{ color: "var(--blue)" }}>{cd.score}</span>
              </div>))}</div>}
            {s.specText && <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--main)", borderRadius: 9, color: "var(--text)", lineHeight: 1.6 }}>{s.specText}</div>}
            {s.result !== undefined && <div style={{ marginTop: 8 }}>
              <span className="mono" style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", padding: "2px 7px", borderRadius: 7, marginBottom: 6 }}>200 OK</span>
              <pre style={{ margin: 0, background: "var(--code)", color: "var(--code-text)", borderRadius: 10, padding: "11px 12px", fontSize: 10, lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre" }}>{JSON.stringify(s.result, null, 2)}</pre>
            </div>}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  // 생성 중 표시 — steps 와 분리한다. /api/agent/chat 은 tool 스텝이 '응답이 끝난 뒤' 한꺼번에
  // 오므로, steps 안에만 두면 기다리는 내내(가장 긴 구간) 아무 표시도 없이 멈춘 것처럼 보인다.
  const thinking = running ? (
    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 9, background: "var(--card)",
      border: "1px solid var(--line2)", borderRadius: "15px 15px 15px 4px", padding: "11px 14px",
      boxShadow: "0 6px 16px rgba(54,64,120,.06)", animation: "stepIn .25s ease-out" }}>
      <span style={{ width: 15, height: 15, flexShrink: 0, borderRadius: "50%", border: "2px solid var(--blue)",
        borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
      <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{t.agThinking}</span>
      <span className="mono" style={{ display: "inline-flex", gap: 3, fontSize: 11, color: "var(--blue)" }}>
        <span style={{ animation: "dots 1.2s infinite" }}>●</span>
        <span style={{ animation: "dots 1.2s infinite .2s" }}>●</span>
        <span style={{ animation: "dots 1.2s infinite .4s" }}>●</span>
      </span>
    </div>
  ) : null;

  return (
    <>
      {open && (
        <div style={{ position: "fixed", right: 24, bottom: 24, width: 392, height: 582, maxHeight: "calc(100vh - 48px)", background: "var(--card)", borderRadius: 24, boxShadow: "0 34px 80px rgba(28,38,90,.32)", display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 95, animation: "popIn .22s ease-out" }}>
          {/* header */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", background: GRAD, color: "#fff" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Spark /></div>
            <div style={{ flex: 1, lineHeight: 1.25 }}><div style={{ fontSize: 14.5, fontWeight: 800 }}>{ontAllowed ? "온톨로지 에이전트" : `${brandName(brand)} 에이전트`}</div><div className="mono" style={{ fontSize: 10, opacity: .85 }}>{showOnt ? "온톨로지 · 계약 · 매핑 · 실체화" : "search → describe → invoke"}</div></div>
            <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 9, border: "none", cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          {/* 모드 — 온톨로지 플랫폼(kt)에서만 노출. EmberLink 에서는 토글 자체가 없다. */}
          {ontAllowed && (
            <div style={{ flexShrink: 0, display: "flex", gap: 6, padding: "9px 14px", borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
              {[[true, "온톨로지"], [false, "MCP 탐색"]].map(([v, label]) => (
                <button key={label} onClick={() => switchMode(v)} disabled={running}
                  style={{ border: `1px solid ${ontMode === v ? "var(--blue)" : "var(--line2)"}`, background: ontMode === v ? "var(--blue-bg)" : "var(--app)",
                    color: ontMode === v ? "var(--blue-d)" : "var(--muted)", fontWeight: 700, fontSize: 11.5, padding: "5px 12px",
                    borderRadius: 9, cursor: running ? "default" : "pointer", opacity: running ? 0.6 : 1 }}>{label}</button>
              ))}
            </div>
          )}
          {/* body */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 11, background: "var(--main)" }}>
            {msgs.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", padding: "0 14px" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--blue-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Spark s={26} st="var(--blue)" sw={1.6} /></div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                  {showOnt ? "온톨로지 계약·매핑·실체화를 대화로 처리합니다. 삭제·병합은 먼저 확인을 받습니다." : t.agEmpty}
                </div>
                {showOnt ? (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    {ONT_PRESETS.map((p) => (
                      <button key={p} onClick={() => run(p)} disabled={running}
                        style={{ border: "1px solid var(--line2)", background: "var(--card)", color: "var(--navy)", cursor: "pointer",
                          fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, padding: "9px 12px", borderRadius: 11, textAlign: "left" }}>{p}</button>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => run()} disabled={running} style={{ marginTop: 16, border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, padding: "10px 16px", borderRadius: 12, background: GRAD, color: "#fff", boxShadow: "0 8px 18px rgba(0,160,210,.32)" }}>{t.agRun}</button>
                )}
              </div>
            )}
            {/* 대화는 시간 순으로 — 온톨로지 모드는 여러 턴이 쌓이므로 user/assistant 를 나눠 찍으면
                순서가 뒤엉킨다. tool 스텝은 '이번 턴'의 것이라 마지막 답변 바로 앞에 끼운다. */}
            {msgs.map((m, i) => (
              <Fragment key={i}>
                {i === stepsAt && stepsBlock}
                {m.role === "user" ? (
                  <div style={{ alignSelf: "flex-end", maxWidth: "82%", background: "var(--blue)", color: "#fff", padding: "10px 14px", borderRadius: "15px 15px 4px 15px", fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>{m.text}</div>
                ) : (
                  <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "var(--card)", border: "1px solid var(--line2)", color: "var(--navy)", padding: "12px 14px", borderRadius: "15px 15px 15px 4px", fontSize: 13, lineHeight: 1.6, boxShadow: "0 6px 16px rgba(54,64,120,.06)" }}>
                    <span className="mono" style={{ display: "block", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--blue)", fontWeight: 700, marginBottom: 5 }}>{t.agAnswer}</span>
                    {renderAnswer(m.text)}
                  </div>
                )}
              </Fragment>
            ))}
            {stepsAt >= msgs.length && stepsBlock}
            {thinking}
          </div>
          {/* composer */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderTop: "1px solid var(--line)", background: "var(--card)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} disabled={running} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }} placeholder={running ? t.agThinking : t.agPh}
              style={{ flex: 1, border: "1px solid var(--line2)", borderRadius: 13, padding: "11px 14px", fontFamily: "var(--sans)", fontSize: 13, color: "var(--navy)", outline: "none", background: "var(--main)" }} />
            {/* onClick={run} 로 두면 MouseEvent 가 preset 인자로 들어가 run 이 터진다 — 반드시 감싼다 */}
            <button onClick={() => run()} disabled={running} title={running ? t.agThinking : undefined}
              style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 13, border: "none", cursor: running ? "default" : "pointer", background: GRAD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px rgba(0,160,210,.36)", opacity: running ? 0.7 : 1 }}>
              {running
                ? <span style={{ width: 17, height: 17, borderRadius: "50%", border: "2px solid rgba(255,255,255,.55)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} />
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>}
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button onPointerDown={fabDown} onClick={fabClick}
          style={{ position: "fixed", ...fabPos, width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer", background: GRAD, boxShadow: "0 16px 36px rgba(0,160,210,.52),inset 0 1px 2px rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, animation: "pulseRing 2.6s infinite", touchAction: "none" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z" /><path d="M18 15l.9 2.2 2.1.9-2.1.9L18 21l-.9-2-2.1-.9 2.1-.9Z" /></svg>
        </button>
      )}
    </>
  );
}

function renderAnswer(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i} style={{ color: "var(--blue)" }}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
}
