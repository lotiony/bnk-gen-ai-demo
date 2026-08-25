// 우상단 작업 알림 — 백그라운드 변환 잡을 프로젝트별로 묶어 진행상황 표시.
// jobStore(projectId→jobId) + /api/jobs/{id} 폴링. 종료 잡은 사용자 확인 대기 스토어로 이관.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { finishJob, isTerminalJobStatus, useJobs } from "../jobStore";
import { useProjects } from "../ProjectContext";

const TYP = { openapi: "API", document: "문서", code: "코드", db: "DB", system: "SYS" };

export default function JobsBell() {
  const jobs = useJobs();                 // {pid: jobId}
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState({});       // jobId -> job.to_dict()
  const popRef = useRef(null);
  const entries = Object.entries(jobs);
  const key = JSON.stringify(jobs);

  useEffect(() => {
    if (!entries.length) { setSt({}); return; }
    let alive = true;
    const poll = async () => {
      const next = {};
      const missing = [];
      await Promise.all(entries.map(async ([pid, jid]) => {
        try { next[jid] = await api.jobStatus(jid); }
        catch (error) { if (error?.status === 404) missing.push([pid, jid]); }
      }));
      if (!alive) return;
      setSt(next);
      missing.forEach(([pid, jid]) => finishJob(pid, jid, "missing"));
      // 종료 잡은 먼저 영속 종료 스토어에 기록한 뒤 진행 매핑에서 제거한다.
      // 대시보드가 나중에 마운트돼도 완료/실패 배너를 복원할 수 있다.
      Object.entries(next).forEach(([jid, s]) => {
        if (s && isTerminalJobStatus(s.status)) {
          const pid = entries.find(([, j]) => j === jid)?.[0];
          if (pid) finishJob(pid, jid, s.status);
        }
      });
    };
    poll();
    const t = setInterval(poll, 2500);
    return () => { alive = false; clearInterval(t); };
  }, [key]);

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (!entries.length) return null;
  const running = entries.filter(([, jid]) => { const s = st[jid]; return !s || !isTerminalJobStatus(s.status); }).length;
  const projName = (pid) => projects?.find((p) => p.id === pid)?.name || pid;

  return (
    <div ref={popRef} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 11, padding: "7px 13px", fontSize: 12, fontWeight: 700, color: "var(--navy)", cursor: "pointer", fontFamily: "var(--sans)" }}>
        <span style={{ width: 11, height: 11, border: "2px solid var(--green)", borderTopColor: "transparent", borderRadius: "50%", animation: running ? "spin 1s linear infinite" : "none" }} />
        {running ? "변환 중" : "작업"}
        {running > 0 && <span style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 9, background: "var(--green)", color: "#052b1e", fontSize: 9.5, fontWeight: 800, display: "grid", placeItems: "center", fontFamily: "var(--mono)" }}>{running}</span>}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,.4)", zIndex: 40, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>
            작업 상태 <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", fontWeight: 600 }}>· 프로젝트 {entries.length}</span>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {entries.map(([pid, jid]) => {
              const s = st[jid] || {};
              const res = s.resources || [];
              const doneN = res.filter((r) => r.status === "done").length;
              return (
                <div key={pid}>
                  <div style={{ padding: "9px 16px 6px", fontSize: 11, fontWeight: 700, color: "var(--navy)", background: "var(--main)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.status === "done" ? "var(--green)" : "var(--amber)" }} />
                    {projName(pid)}
                    <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)" }}>{doneN}/{res.length || s.total || "–"} · {s.pct != null ? `${s.pct}%` : "…"}</span>
                  </div>
                  {res.length === 0 ? (
                    <div style={{ padding: "10px 16px", fontSize: 11, color: "var(--muted)" }}>변환 준비 중…</div>
                  ) : res.map((r, i) => (
                    <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "var(--main)", color: "var(--muted)", border: "1px solid var(--line2)" }}>{TYP[r.type] || r.type}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: r.status === "done" ? "var(--green)" : r.status === "error" ? "var(--red)" : "var(--amber)" }}>
                          {r.status === "done" ? "완료" : r.status === "error" ? "실패" : "진행"}
                        </span>
                      </div>
                      {r.detail && <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>{r.detail}</div>}
                      <div style={{ height: 4, borderRadius: 99, background: "var(--main)", overflow: "hidden", marginTop: 7 }}>
                        <div style={{ height: "100%", borderRadius: 99, background: r.status === "done" ? "var(--green)" : "var(--acc, #2dd4bf)", width: `${r.status === "done" ? 100 : r.pct ?? 20}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
