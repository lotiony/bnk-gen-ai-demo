import { useEffect, useRef, useState } from "react";
import { api, JOB_EVENT } from "../../api";
import { useProjects } from "../../ProjectContext";
import { acknowledgeJob, finishJob, JOB_SOURCE, useEndedJobs, useJobSources, useJobs } from "../../jobStore";
import { activeDraftId, dropDraft, useDrafts } from "../../onboardingDrafts";
import { usePipelineJobs } from "../../pipelineJobStore";
import { useJobStream } from "../../lib/useJobStream";
import { STEPS as ONB_STEPS } from "../OnboardingV2";
import { CheckIco, REDUCED, Spinner, WarnIco, sx } from "./bits";

/* 진행 중 작업 표시 2종.
   - OnboardingBanner: 새 프로젝트 생성(온보딩) — 데크 최상단, 활성 프로젝트와 무관.
     입력 대기 draft(이어서/그만두기)와, 변환 시작 후 위저드를 닫은 백그라운드 잡
     (SSE 수집·변환 실시간 카운터 → 완료 → 입장)을 모두 다룬다.
   - ActivityHero: 활성 프로젝트의 변환 잡(SSE)·문서 파이프라인·온톨로지 잡. */

/* 온톨로지 3종 잡 폴링 — TaskStatus의 적응형(실행중 3s/유휴 30s) + JOB_EVENT 즉시 갱신 패턴 재사용.
   히어로는 "지금 진행"만 다루므로 running 상태만 반환(완료/실패 이력은 헤더 TaskStatus 몫). */
const ACTIVE_MS = 3000, IDLE_MS = 30000;
function useOntologyJobs(activeId) {
  const [jobs, setJobs] = useState([]);
  const timerRef = useRef(null);
  useEffect(() => {
    let alive = true;
    const tick = () => Promise.all([api.genStatus().catch(() => null), api.automapStatus().catch(() => null), api.instantiateStatus().catch(() => null)])
      .then(([g, a, i]) => {
        if (!alive) return;
        const rows = [];
        if (g?.status === "running") rows.push({ id: "gen", step: g.step, total: g.total, message: g.message });
        if (a?.status === "running") rows.push({ id: "automap", step: a.step, total: a.total, message: a.message });
        if (i?.status === "running") rows.push({ id: "instantiate", step: i.step, total: i.total, message: i.message });
        setJobs(rows);
        schedule(rows.length ? ACTIVE_MS : IDLE_MS);
      });
    const schedule = (ms) => { clearTimeout(timerRef.current); timerRef.current = setTimeout(tick, ms); };
    tick();
    window.addEventListener(JOB_EVENT, tick);
    return () => { alive = false; clearTimeout(timerRef.current); window.removeEventListener(JOB_EVENT, tick); };
  }, [activeId]);
  return jobs;
}

const ONT_TITLE = { gen: "ontGen", automap: "ontMap", instantiate: "ontIns" };

/* 일시정지 표시 — 입력 대기 단계(0~3)는 실행 중이 아니므로 스피너 대신 이 아이콘 */
const PauseIco = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
    <path d="M9 5v14M15 5v14" />
  </svg>
);

/* 온보딩 6단계 미니 스테퍼 — 완료=틸 체크, 현재=pulse 링, 미래=faint */
function OnbStepper({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      {ONB_STEPS.map((s, i) => {
        const done = i < step, cur = i === step;
        return (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700,
              color: done || cur ? "#fff" : "var(--faint)",
              background: done || cur ? "var(--blue)" : "var(--main)",
              border: done || cur ? "none" : "1px solid var(--line2)",
              animation: cur && !REDUCED ? "pulseRing 2.2s ease-out infinite" : "none",
            }}>{done ? <CheckIco size={10} /> : i + 1}</span>
            <span style={{ fontSize: 11.5, fontWeight: cur ? 700 : 500, color: cur ? "var(--navy)" : done ? "var(--text)" : "var(--faint)", whiteSpace: "nowrap" }}>{s.label}</span>
            {i < ONB_STEPS.length - 1 && <span style={{ width: 14, height: 1, background: "var(--line2)", flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── 온보딩 백그라운드 배너 — 데크 최상단 슬림 스트립 ──
   ① 입력 대기 draft(step 0~3): 일시정지 스테퍼 + 이어서 하기 / 그만두기 (최신 1건)
   ② 백그라운드 변환 잡: 변환 시작 시 draft 는 폐기되고 jobStore 로 이관된다(Onboarding.applyManifest).
      비활성 프로젝트의 잡을 여기서 이어받아 SSE 카운터 → 완료 시 입장하기까지 모달 없이 완주.
      (활성 프로젝트의 잡은 ActivityHero P1 몫 — 중복 표시 방지) */
export function OnboardingBanner({ c, go }) {
  const { projects, activeId, refresh, switchTo } = useProjects();
  const drafts = useDrafts();
  const jobs = useJobs();
  const jobSources = useJobSources();
  const endedJobs = useEndedJobs();

  // ② 활성 프로젝트가 아닌 온보딩 잡 1건 — 일반 일괄 변환은 이 배너에서 제외한다.
  const bg = Object.entries(jobs).find(([pid, jobId]) =>
    pid !== activeId
    && jobSources[pid]?.jobId === jobId
    && jobSources[pid]?.source === JOB_SOURCE.ONBOARDING
  ) || null;
  const bgPid = bg?.[0] ?? null;
  const bgJobId = bg?.[1] ?? null;
  const stream = useJobStream(bgJobId);
  const st = stream.status;
  const bgProj = projects.find((p) => p.id === bgPid) || null;

  // SSE가 종료를 먼저 관측해도 JobsBell과 같은 영속 종료 스토어로 이관한다.
  useEffect(() => {
    if (!bgPid || st == null || st === "running") return;
    finishJob(bgPid, bgJobId, st);
  }, [bgPid, bgJobId, st]);

  // 가장 최근에 끝난 비활성 프로젝트 잡을 사용자 확인 전까지 복원한다.
  const endedEntry = Object.entries(endedJobs)
    .filter(([pid, job]) => pid !== activeId && job.source === JOB_SOURCE.ONBOARDING)
    .sort((a, b) => (b[1].endedAt || 0) - (a[1].endedAt || 0))[0] || null;
  const endedPid = endedEntry?.[0] ?? null;
  const ended = endedEntry?.[1] ?? null;
  const endedFailed = !!ended && ended.status !== "done";
  const endedProj = projects.find((p) => p.id === endedPid) || null;

  // 사용자가 다른 경로로 이미 해당 프로젝트에 들어왔다면 확인된 것으로 본다.
  useEffect(() => {
    if (activeId && endedJobs[activeId]?.source === JOB_SOURCE.ONBOARDING) acknowledgeJob(activeId);
  }, [activeId, endedJobs]);

  // 방금 만든 프로젝트는 목록에 아직 없을 수 있다 — 이름 표시용 1회 갱신
  useEffect(() => {
    if ((bgPid && !bgProj) || (endedPid && !endedProj)) refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgPid, endedPid]);

  // ① 입력 대기 draft 중 최신 1건 — 이 탭의 위저드가 열고 있는 draft(activeDraftId)는 제외
  const draftEntry = Object.entries(drafts)
    .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
    .find(([id]) => id !== activeDraftId()) || null;
  const dId = draftEntry?.[0] ?? null;
  const d = draftEntry?.[1] ?? null;

  if (!bgPid && !dId && !endedPid) return null;

  const nameTag = (nm) => (nm ? <b style={{ color: "var(--navy)", fontWeight: 700 }}>“{nm}”</b> : null);
  // 종료 배너 닫기 — 사용자 확인 시점에만 영속 종료 상태를 정리한다.
  const dismissEnded = () => acknowledgeJob(endedPid);
  const enter = async () => {
    const pid = endedPid;
    dismissEnded();
    try { await refresh(); } catch { /* 목록 갱신 실패해도 진입은 진행 */ }
    switchTo(pid);
    go("dashboard");
  };
  const quitDraft = () => {
    if (window.confirm(c.onbQuitConfirm)) dropDraft(dId);
  };
  // draft 배너 블록 전체 클릭 = 그 draft 로 위저드 복귀
  const openWizard = {
    role: "button", tabIndex: 0, onClick: () => go("onboarding", dId),
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("onboarding", dId); } },
  };
  const collected = (stream.resources || []).reduce((a, r) => a + (r.collected || 0), 0);
  const converted = (stream.resources || []).reduce((a, r) => a + (r.count || 0), 0);

  return (
    <>
      {/* ── ② 백그라운드 변환 실행 중 — 라이브 진행 바 + 수집·변환 실시간 카운터. 클릭 = 프로젝트 목록 ── */}
      {bgPid && st === "running" && (
        <div role="button" tabIndex={0} className="dash-onbband" style={{ ...sx.onbBand, cursor: "pointer" }}
          onClick={() => go("projects")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("projects"); } }}>
          <Spinner size={12} color="var(--blue)" />
          <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{c.onbRunTitle}</b>
          {nameTag(bgProj?.name)}
          <span style={sx.bgBadge}>{c.bgBadge}</span>
          <div style={{ ...sx.convBarWrap, height: 7, flex: "1 1 140px", maxWidth: 240 }}>
            <span style={{ ...sx.convBarFill, width: `${stream.pct}%` }} />
          </div>
          <b className="mono" style={{ fontFamily: "var(--disp)", fontSize: 15, color: "var(--blue)", minWidth: 40 }}>{stream.pct}%</b>
          <span className="mono" style={{ fontSize: 11, color: "var(--text)" }}>
            {c.discover} <b style={{ color: "var(--blue)" }}>{collected}</b> · {c.convert} <b style={{ color: "var(--blue)" }}>{converted}</b>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--blue)" }}>{c.heroDetail} →</span>
        </div>
      )}

      {/* ── ② 실패 — 프로젝트 목록에서 확인 유도 ── */}
      {endedFailed && (
        <div style={{ ...sx.onbBand, background: "var(--amber-bg)", border: "1px solid var(--amber)", borderLeft: "3px solid var(--amber)" }}>
          <span style={{ color: "var(--amber)", display: "inline-flex" }}><WarnIco /></span>
          <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{c.onbFail}</b>
          {nameTag(endedProj?.name)}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={sx.heroBtn} onClick={() => go("projects")}>{c.heroDetail} →</button>
            <button style={sx.heroBtnGhost} onClick={dismissEnded}>{c.onbQuit}</button>
          </div>
        </div>
      )}

      {/* ── ② 완료 — 입장하기 / 나중에 ── */}
      {ended && !endedFailed && (
        <div style={{ ...sx.onbBand, background: "var(--green-bg)", border: "1px solid var(--green)", borderLeft: "3px solid var(--green)" }}>
          <span style={{ color: "var(--green)", display: "inline-flex" }}><CheckIco size={13} /></span>
          <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{c.onbDone}</b>
          {nameTag(endedProj?.name)}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={{ ...sx.heroBtn, background: "var(--green)" }} onClick={enter}>{c.onbEnter} →</button>
            <button style={sx.heroBtnGhost} onClick={dismissEnded}>{c.onbLater}</button>
          </div>
        </div>
      )}

      {/* ── ① 입력 대기 draft — 블록 전체 클릭으로 위저드에 복귀해 이어서 진행 ── */}
      {dId && (
        <div {...openWizard} className="dash-onbband" style={{ ...sx.onbBand, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%" }}>
            <span style={{ color: "var(--amber)", display: "inline-flex" }}><PauseIco /></span>
            <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{c.heroOnb}</b>
            {nameTag(d.name)}
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{c.onbWaitHint}</span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <button style={sx.heroBtnGhost}
                onClick={(e) => { e.stopPropagation(); quitDraft(); }}
                onKeyDown={(e) => e.stopPropagation()}>{c.onbQuit}</button>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--blue)" }}>{c.onbResume} →</span>
            </span>
          </div>
          <OnbStepper step={d.step ?? 0} />
        </div>
      )}
    </>
  );
}

export default function ActivityHero({ c, go, activeId, activeName, liveJob }) {
  const pipelineJobs = usePipelineJobs().filter((j) => j.projectId === activeId);
  const ontJobs = useOntologyJobs(activeId);

  const runningPipe = pipelineJobs.filter((j) => j.status === "running");

  if (!liveJob && runningPipe.length === 0 && ontJobs.length === 0) return null;

  const primary = liveJob ? "job" : runningPipe.length ? "pipe" : null;
  const lastLog = liveJob?.log?.[liveJob.log.length - 1]?.msg;
  const runningRes = liveJob?.resources?.find((r) => r.state === "running");

  return (
    <div className="dash-hero" style={sx.hero}>
      {/* ── P1 — 실행 중 변환 잡: 큰 pct + 진행 바 + 라이브 로그 ── */}
      {primary === "job" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={sx.heroTitle}>
              <Spinner size={13} color="var(--blue)" />
              {c.heroConv}{activeName ? <span style={{ fontWeight: 600, color: "var(--text)" }}>— {activeName}</span> : null}
            </div>
            <span style={sx.runBadge}>{liveJob.kind === "smoke" ? "SMOKE" : "APPLY"}</span>
            <button style={{ ...sx.heroBtnGhost, marginLeft: "auto" }}
              onClick={() => document.getElementById("dash-conv")?.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" })}>
              {c.heroDetail} ↓
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="mono" style={sx.convPct}>{liveJob.pct}<em style={{ fontSize: 13, color: "var(--muted)", fontStyle: "normal" }}>%</em></div>
            <div style={sx.convBarWrap}><span style={{ ...sx.convBarFill, width: `${liveJob.pct}%` }} /></div>
            {runningRes && <span className="mono" style={{ fontSize: 11, color: "var(--blue)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{runningRes.name}</span>}
          </div>
          {lastLog && <div className="mono" style={{ ...sx.logLine, marginTop: 0 }}>{"> "}{lastLog}</div>}
        </>
      )}

      {/* ── P2 — 문서 파이프라인(지식화) 진행 행 ── */}
      {primary === "pipe" && (
        <div style={sx.heroTitle}>
          <Spinner size={13} color="var(--blue)" />
          {c.heroPipe}{activeName ? <span style={{ fontWeight: 600, color: "var(--text)" }}>— {activeName}</span> : null}
        </div>
      )}
      {runningPipe.map((j) => (
        <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", width: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</span>
          <div style={{ ...sx.convBarWrap, height: 7 }}><span style={{ ...sx.convBarFill, width: `${j.pct}%` }} /></div>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", minWidth: 36, textAlign: "right" }}>{j.pct}%</span>
          <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.detail}</span>
        </div>
      ))}

      {/* ── 보조 칩 행 — 온톨로지 잡 + 지식화 결과 바로가기 ── */}
      {ontJobs.length > 0 && (
        <div style={sx.heroChips}>
          {ontJobs.map((j) => (
            <span key={j.id} style={sx.heroChip}>
              <Spinner size={10} color="var(--blue)" />
              {c[ONT_TITLE[j.id]]}{j.total ? <b style={{ color: "var(--blue)" }}>{j.step ?? 0}/{j.total}</b> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
