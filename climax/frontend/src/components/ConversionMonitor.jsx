import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

// 리소스 타입 아이콘 (라인 SVG)
const TY = (t) => {
  const p = {
    openapi: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><rect x="3" y="11" width="18" height="5" rx="1.5" /><path d="M7 6.5h.01M7 13.5h.01" /></>,
    code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
    document: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15-5-5L5 21" /></>,
    db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14a8 3 0 0 0 16 0V5" /><path d="M4 12a8 3 0 0 0 16 0" /></>,
    system: <><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" /></>,
  }[t] || <circle cx="12" cy="12" r="8" />;
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
};
const CHIP = {
  pending: ["대기", "var(--muted)", "var(--main)"], running: ["변환중…", "var(--blue)", "var(--blue-bg)"],
  done: ["완료", "var(--green)", "var(--green-bg)"], warn: ["경고", "var(--amber)", "var(--amber-bg)"],
  fail: ["실패", "var(--red)", "var(--red-bg)"],
};

// 변환이 끝나도 이 단계를 최소 이만큼은 보여준다(ms). 잡이 순식간에 끝나는 경우가 흔해서,
// 이게 없으면 진행 표시가 깜빡이고 사라져 무엇이 변환됐는지 읽을 틈이 없다.
const DONE_HOLD_MS = 2600;

// inline=true이면 고정 오버레이 없이 카드 내용만 렌더 — 온보딩 모달 내부에서 모달-in-모달을 피하기 위해

export default function ConversionMonitor({ jobId, projectName, onClose, onDone, inline = false, title = "일괄 마이그레이션" }) {
  const [status, setStatus] = useState("running");
  const [pct, setPct] = useState(0);
  const startedAt = useMemo(() => Date.now(), [jobId]);
  // 화면에 그릴 진행률. 서버 pct 가 0 → 100 으로 한 번에 뛰어도 눈에는 차오르게 보인다.
  const [shownPct, setShownPct] = useState(0);
  const [resources, setResources] = useState([]);
  const [log, setLog] = useState([]);
  const logRef = useRef();

  useEffect(() => {
    let closed = false, timer = null, retryMs = 2500;
    const finish = (d, applySnapshot = true) => {
      if (closed) return;
      closed = true;
      if (applySnapshot) {
        setStatus(d.status); setPct(d.pct || 0); setResources(d.resources || []);
        if (d.log?.length) setLog(d.log);
      }
      // 완료 화면을 잠깐 붙잡아 둔다.
      //
      // API 몇 개만 변환하면 잡이 1초 안에 끝나 이 단계가 깜빡이고 지나간다. 사용자는
      // 무엇이 변환됐는지 보지 못한 채 다음 화면을 만나고, 진행 표시는 "왜 있었나" 가 된다.
      // 결과(무엇이 몇 개 변환됐는지)를 읽을 시간을 남기고 넘어간다.
      const rest = Math.max(0, DONE_HOLD_MS - (Date.now() - startedAt));
      setTimeout(() => onDone?.(d), rest);
    };
    const poll = () => {
      api.jobStatus(jobId)
        .then((d) => {
          if (closed) return;
          if (d.status !== "running") return finish(d);
          setStatus("running"); setPct(d.pct); setResources(d.resources || []);
          if (d.log?.length) setLog(d.log);
          retryMs = 2500;
          timer = setTimeout(poll, retryMs);
        })
        .catch((error) => {
          if (closed) return;
          if (error?.status === 404) {
            setLog((prev) => prev.length ? prev : [{ level: "error",
              msg: "작업을 찾을 수 없습니다. 서버가 재시작되었을 수 있어요 — 닫고 다시 변환하세요." }]);
            finish({ status: "failed", missing: true });
            return;
          }
          // 일시적인 네트워크·인증·5xx는 잡 실패가 아니므로 폴링을 백오프로 이어간다.
          setStatus("running");
          retryMs = Math.min(retryMs * 2, 20000);
          timer = setTimeout(poll, retryMs);
        });
    };
    const es = new EventSource(api.jobStreamUrl(jobId));
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setStatus(d.status); setPct(d.pct); setResources(d.resources || []);
      if (d.log?.length) setLog((prev) => [...prev, ...d.log]);
      if (d.status !== "running") { es.close(); finish(d, false); }
    };
    // SSE 끊김은 상태 판정 근거가 아니다. 서버 상태 폴링으로 인계한다.
    es.onerror = () => {
      es.close();
      if (!closed) poll();
    };
    return () => { closed = true; clearTimeout(timer); es.close(); };
  }, [jobId]);
  useEffect(() => {
    // 목표치까지 한 걸음씩. 남은 거리의 일부만 좁혀 끝에서 자연스럽게 감속한다.
    const id = setInterval(() => {
      setShownPct((cur) => (Math.abs(pct - cur) < 1 ? pct : cur + (pct - cur) * 0.25));
    }, 60);
    return () => clearInterval(id);
  }, [pct]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const done = status !== "running";

  // 카드 본문 — inline/non-inline 모두 동일한 내부 구조
  const card = (
    <div style={{ width: inline ? "100%" : 620, maxWidth: "100%", maxHeight: inline ? "none" : "90vh", background: "var(--card)", borderRadius: 22, boxShadow: inline ? "none" : "0 34px 80px rgba(28,38,90,.32)", display: "flex", flexDirection: "column", overflow: "hidden", animation: inline ? "none" : "popIn .22s ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: "var(--blue-bg)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v6l-6 11a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-11V2" /><path d="M8 2h8" /></svg>
        </span>
        <div style={{ flex: 1 }}><b style={{ fontSize: 16, fontWeight: 800 }}>{title}</b>
          <small style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 2 }}>리소스 {resources.length}개 · {done ? "완료" : "진행중"}</small></div>
        {done && <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 9, background: "var(--main)", border: "none", cursor: "pointer", color: "var(--muted)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
      </div>

      <div style={{ padding: "20px 22px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 10, borderRadius: 9, background: "var(--main)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 9, background: "linear-gradient(90deg,var(--blue),var(--amber))", width: shownPct + "%", transition: "width .25s linear" }} />
          </div>
          <span className="mono" style={{ fontWeight: 800, fontSize: 15, color: "var(--blue)" }}>{Math.round(shownPct)}%</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {resources.map((r) => {
            // DB 소스는 온보딩 등록 직후 백엔드가 warn으로 마킹하지만 실제 오류가 아닌
            // "준비중" 상태이므로 amber 경고 대신 회색 칩으로 구분 표기한다.
            const isDbPending = r.type === "db" && r.state === "warn";
            const [label, color, bg] = isDbPending
              ? ["준비중", "var(--muted)", "var(--main)"]
              : (CHIP[r.state] || CHIP.pending);
            const run = r.state === "running";
            return (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", border: "1px solid " + (run ? "var(--blue)" : "var(--line2)"), borderRadius: 13, background: run ? "var(--blue-soft)" : "var(--card)" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color, background: bg, flexShrink: 0 }}>
                  {run ? <span style={{ width: 14, height: 14, border: "2px solid var(--line2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> : TY(r.type)}
                </span>
                <div><div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div><div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{r.type} → {r.target}</div></div>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 8, color, background: bg }}>{label}{r.count ? " " + r.count : ""}</span>
              </div>
            );
          })}
        </div>

        <div ref={logRef} className="mono" style={{ background: "#0f1730", borderRadius: 13, padding: "13px 15px", fontSize: 11, lineHeight: 1.85, color: "#cdd6f4", maxHeight: 160, overflow: "auto" }}>
          {log.map((l, i) => <div key={i} style={{ color: l.level === "error" ? "#f08a8a" : l.level === "warn" ? "#f0b86e" : "#cdd6f4" }}>{l.msg}</div>)}
          {!done && <div style={{ color: "var(--blue)" }}>▍</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--line)" }}>
        {done ? (
          <button onClick={onClose} style={{ padding: "10px 17px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "var(--blue)", color: "#fff" }}>완료 · 닫기</button>
        ) : (
          <button onClick={onClose} style={{ padding: "10px 17px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid var(--line2)", background: "var(--card)", color: "var(--text)" }}>백그라운드로</button>
        )}
      </div>
    </div>
  );

  // inline=false(기본): 기존 고정 오버레이로 감싸서 전체화면 다이얼로그처럼 렌더
  if (inline) return card;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,28,60,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99, padding: 24 }}>
      {card}
    </div>
  );
}
