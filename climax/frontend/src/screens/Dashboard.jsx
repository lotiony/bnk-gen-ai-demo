import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import { useJob } from "../jobStore";
import { useJobStream } from "../lib/useJobStream";
import { dashboardViewForNav, RAG_EXECUTIONS_FOCUS } from "../lib/ragIngestionNavigation";
import ActivityHero, { OnboardingBanner } from "./dashboard/ActivityHero";
import {
  CTA, CheckCircleIco, CubeIco, GaugeIco, HealthRing, METHOD_COLOR, Metric, Num, PanelHead, PulseIco,
  RailBlock, ShieldIco, WarnIco, deriveState, fmtTime, sx,
} from "./dashboard/bits";
import { DotScale, Meter, Spark, StackBar } from "./dashboard/microviz";
import LiveWire from "./dashboard/LiveWire";
import NeuralCore from "./dashboard/NeuralCore";
import RagExecutionsPanel from "./dashboard/RagExecutionsPanel";
import ServiceMatrix from "./dashboard/ServiceMatrix";
import {
  ConversionOps, HealthMatrix, LiveFeed, MethodMix, RecentRuns, SafetyMix, SourceMix, TopTools, TrendChart,
} from "./dashboard/panels";

/* EmberLink 운영 관제(Neural Command) 대시보드.
   목업 없음 — 전 위젯이 실 백엔드 4원천에서 파생된다.
     registry/stats · audit(+stats) · projects/{id}/health · projects/{id}/jobs
   폴링: 실행 잡 있으면 4s, 없으면 12s. 실행 잡 상세는 SSE(useJobStream). reduced-motion 존중.
   구조: 온보딩 배너 → ActivityHero(진행 중 작업)
        → 3컬럼 HUD 그리드: 자산(지표·구성) | 신경망 코어(라이프사이클·변환·추이) | 운영(헬스·로그).
   잡 진행은 ActivityHero·ConversionOps가, 최근 스모크 시각은 HEALTH 패널이 표시한다. */

const T = {
  ko: {
    title: "운영 관제", sub: "MCP 자산 라이프사이클 · 실시간 호출 현황",
    health: "HEALTH",
    vacantCalls: "호출 대기", vacantSmoke: "스모크 대기",
    tools: "MCP 툴", calls: "호출 · 24h", success: "성공률", p95: "P95 지연", smoke: "스모크 통과",
    resources: "리소스", agents: "액터", lastSmoke: "최근 스모크",
    lifecycle: "자산 라이프사이클", discover: "수집", convert: "변환", qualify: "검증", serve: "서빙", improve: "개선",
    convOps: "변환 현황", running: "실행 중", recent: "최근 실행", noHistory: "실행 이력 없음",
    matrix: "리소스 헬스", feed: "실시간 호출 로그", noFeed: "호출 기록 없음",
    trend: "호출량 추이 · 24h", topTools: "툴별 호출 Top", noData: "데이터 없음",
    healthy: "정상", degraded: "주의", broken: "실패", unverified: "미검증", loading: "불러오는 중…",
    peak: "피크", errors: "에러", pass: "통과", srcCollected: "수집", toolsUnit: "툴",
    composition: "툴 구성", byMethod: "메서드 분포", bySource: "소스 구성", safety: "안전성 · Mutating",
    mutating: "변경형", safe: "조회형", inventory: "서비스 인벤토리", svcTools: "서비스별 툴",
    awaitCalls: "첫 호출 대기 중", toolsReady: "툴 준비됨", deployed: "배포", noSvc: "서비스 미분류",
    waitConvert: "변환 대기 중", waitConvertHint: "소스를 연결하면 변환이 여기서 진행됩니다", ctaWizard: "변환 마법사에서 시작",
    feedWait: "호출 수신 대기", feedHint: "에이전트가 툴을 호출하면 실시간 스트리밍됩니다", ctaExplore: "MCP 탐색에서 호출",
    histHint: "실행 이력이 쌓이면 여기 표시됩니다",
    /* 컬럼 캡션 — 각 컬럼이 어떤 질문에 답하는지 */
    grpNow: "핵심 지표", grpNowSub: "이 프로젝트의 지금 상태 요약",
    grpAsset: "자산 현황", grpCore: "코어 관제", grpOps: "운영 현황",
    subScore: "성공률·스모크·실패 리소스를 종합한 0~100 점수",
    /* 패널 부제 — 이 패널이 주는 정보 한 줄 */
    subLifecycle: "소스 수집부터 서빙까지, 단계별 자산 개수",
    subByMethod: "등록된 툴의 HTTP 메서드 구성",
    subBySource: "어떤 원천(API·문서·DB)에서 툴이 만들어졌는지",
    subSafety: "데이터를 변경하는 툴의 비율 — 낮을수록 안전",
    subConvOps: "리소스 → MCP 툴 변환 작업의 진행 상황",
    subRecent: "완료된 변환·검증 작업 이력",
    subMatrix: "리소스별 변환·스모크 테스트 결과 (클릭 시 상세)",
    subInventory: "서비스별 등록 툴 현황 (클릭 시 탐색)",
    subFeed: "에이전트의 툴 호출이 실시간으로 흐르는 곳",
    subTrend: "최근 24시간 시간대별 호출량",
    subTop: "가장 많이 불린 툴과 성공률", subSvcTools: "서비스별 등록 툴 수",
    /* 로딩·에러·미선택·empty */
    errBanner: "일부 데이터를 불러오지 못했습니다", lastSync: "마지막 갱신", secAgo: "초 전", retry: "다시 시도",
    npTitle: "프로젝트를 선택하면 관제가 시작됩니다",
    npHint: "레거시 자산을 MCP 툴로 바꾸고, 호출 현황을 실시간으로 지켜보세요",
    npPick: "프로젝트 선택", npNew: "새 프로젝트 만들기",
    needProject: "프로젝트 선택 후 표시됩니다",
    emptyComp: "소스를 등록하면 구성이 표시됩니다", ctaOnb: "온보딩 시작",
    emptyMatrix: "변환을 실행하면 리소스 헬스가 여기 채워집니다",
    emptyTrend: "호출이 쌓이면 추이가 그려집니다",
    /* 첫 진입 체크리스트 */
    startTitle: "지금 시작해 보세요",
    start1: "레거시 소스 등록", start1Sub: "API 명세·문서·DB를 연결", start1Cta: "온보딩 시작",
    start2: "MCP 툴로 변환", start2Sub: "등록하면 자동으로 진행됩니다",
    start3: "첫 호출 확인", start3Sub: "Explorer에서 툴을 호출해 보세요",
    /* ActivityHero */
    heroOnb: "새 프로젝트 생성 일시중지", onbResume: "이어서 하기", onbQuit: "그만두기",
    onbQuitConfirm: "진행 중인 온보딩을 그만둘까요? 입력한 내용이 사라집니다.",
    onbRunTitle: "새 프로젝트 생성 중", bgBadge: "BACKGROUND",
    onbWaitHint: "다음 입력이 필요합니다 — 클릭해 이어서 진행",
    onbDone: "생성 완료 — 환경이 준비되었습니다",
    onbEnter: "입장하기", onbLater: "나중에",
    onbFail: "생성 작업이 실패했습니다",
    heroConv: "리소스 일괄 변환 진행 중", heroDetail: "상세 보기",
    heroPipe: "문서 지식화 진행 중", heroResult: "백그라운드 지식화 결과",
    ragGo: "RAG 확인하러 가기", graphRagGo: "GraphRAG 확인하러 가기",
    ontGen: "온톨로지 생성", ontMap: "자동 매핑", ontIns: "인스턴스 추출",
    /* 관제(데모) 뷰 — KPI 스트립 + LiveWire + 하단 2열 */
    vDeck: "관제", vDetail: "상세",
    kSuccess: "성공률", kCalls: "호출 · 24h", kP95: "P95 지연", kTools: "MCP 툴", kUp: "서비스 정상",
    kIdle: "대기",
    kSuccessSub: "실패 없음", kCallsSub: "호출 대기", kP95Sub: "목표", kToolsSub: "변환 대기",
    kUpAll: "전부 도달 가능", kUpBad: "개 응답 없음", kUpSub: "프로브 대기",
  },
  en: {
    title: "Command View", sub: "MCP asset lifecycle · live call operations",
    health: "HEALTH",
    vacantCalls: "awaiting calls", vacantSmoke: "awaiting smoke",
    tools: "MCP Tools", calls: "Calls · 24h", success: "Success", p95: "P95 Latency", smoke: "Smoke Pass",
    resources: "resources", agents: "actors", lastSmoke: "last smoke",
    lifecycle: "Asset Lifecycle", discover: "Discover", convert: "Convert", qualify: "Qualify", serve: "Serve", improve: "Improve",
    convOps: "Conversion Ops", running: "Running", recent: "Recent Runs", noHistory: "no run history",
    matrix: "Resource Health", feed: "Live Ops Feed", noFeed: "no calls yet",
    trend: "Call Volume · 24h", topTools: "Top Tools", noData: "no data",
    healthy: "HEALTHY", degraded: "DEGRADED", broken: "BROKEN", unverified: "UNVERIFIED", loading: "loading…",
    peak: "peak", errors: "errors", pass: "pass", srcCollected: "collected", toolsUnit: "tools",
    composition: "Tool Composition", byMethod: "Method Distribution", bySource: "Source Composition", safety: "Safety · Mutating",
    mutating: "mutating", safe: "read-only", inventory: "Service Inventory", svcTools: "Tools by Service",
    awaitCalls: "awaiting first call", toolsReady: "tools ready", deployed: "deployed", noSvc: "unclassified",
    waitConvert: "awaiting conversion", waitConvertHint: "connect a source to run conversion here", ctaWizard: "start in wizard",
    feedWait: "awaiting calls", feedHint: "streams live once agents call tools", ctaExplore: "call from Explorer",
    histHint: "run history will appear here",
    grpNow: "Key Metrics", grpNowSub: "current state of this project at a glance",
    grpAsset: "Assets", grpCore: "Command Core", grpOps: "Operations",
    subScore: "0–100 composite of success rate, smoke and broken resources",
    subLifecycle: "asset counts per stage, from discovery to serving",
    subByMethod: "HTTP method mix of registered tools",
    subBySource: "which origins (API · docs · DB) tools came from",
    subSafety: "share of tools that mutate data — lower is safer",
    subConvOps: "progress of resource → MCP tool conversion",
    subRecent: "history of finished conversion & smoke runs",
    subMatrix: "conversion & smoke results per resource (click for detail)",
    subInventory: "registered tools per service (click to explore)",
    subFeed: "live stream of agent tool calls",
    subTrend: "hourly call volume over the last 24h",
    subTop: "most-called tools and their success rate", subSvcTools: "registered tool count per service",
    errBanner: "some data failed to load", lastSync: "last sync", secAgo: "s ago", retry: "Retry",
    npTitle: "Select a project to start monitoring",
    npHint: "convert legacy assets into MCP tools and watch calls in real time",
    npPick: "Select project", npNew: "New project",
    needProject: "shown once a project is selected",
    emptyComp: "register sources to see the composition", ctaOnb: "Start onboarding",
    emptyMatrix: "run a conversion to fill resource health",
    emptyTrend: "the trend draws as calls accumulate",
    startTitle: "Get started",
    start1: "Register legacy sources", start1Sub: "connect API specs, docs and DBs", start1Cta: "Start onboarding",
    start2: "Convert to MCP tools", start2Sub: "runs automatically after registration",
    start3: "Make the first call", start3Sub: "try a tool from the Explorer",
    heroOnb: "New project setup paused", onbResume: "Resume", onbQuit: "Discard",
    onbQuitConfirm: "Discard the onboarding in progress? Your inputs will be lost.",
    onbRunTitle: "Creating new project", bgBadge: "BACKGROUND",
    onbWaitHint: "your input is needed — click to continue",
    onbDone: "created — the environment is ready",
    onbEnter: "Enter", onbLater: "Later",
    onbFail: "creation job failed",
    heroConv: "Batch conversion running", heroDetail: "Details",
    heroPipe: "Document pipelines running", heroResult: "Background pipeline results",
    ragGo: "Open RAG", graphRagGo: "Open GraphRAG",
    ontGen: "Ontology generation", ontMap: "Auto mapping", ontIns: "Instance extraction",
    vDeck: "Command", vDetail: "Detail",
    kSuccess: "Success", kCalls: "Calls · 24h", kP95: "P95 Latency", kTools: "MCP Tools", kUp: "Services up",
    kIdle: "standby",
    kSuccessSub: "no failures", kCallsSub: "awaiting calls", kP95Sub: "target", kToolsSub: "awaiting conversion",
    kUpAll: "all reachable", kUpBad: "unreachable", kUpSub: "awaiting probe",
  },
};

export default function Dashboard({ lang, go, nav }) {
  const ko = lang === "ko";
  const c = T[ko ? "ko" : "en"];
  const { activeId, active } = useProjects();
  const focusRagExecutions = nav?.focus === RAG_EXECUTIONS_FOCUS;
  const focusedExecutionId = focusRagExecutions ? nav?.executionId : null;
  const ragExecutionsRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [astats, setAstats] = useState(null);
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [feed, setFeed] = useState([]);
  const [mon, setMon] = useState(null);          // monitor/status — 서비스별 레거시↔MCP 이원 상태
  const [view, setView] = useState(() => dashboardViewForNav(nav)); // deck(관제·시연 기본) | detail(운영 상세)
  const [clock, setClock] = useState("");
  const [booted, setBooted] = useState(false);       // 첫 load 완료 전 = 스켈레톤 (empty 연출 번쩍임 방지)
  const [errAt, setErrAt] = useState(null);          // 일부 소스 실패 시점 — 앰버 배너, stale 데이터는 유지
  const [lastOkAt, setLastOkAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 실시간 시계 (에러 배너의 "N초 전"도 이 1초 리렌더에 편승)
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date(), p = (n) => String(n).padStart(2, "0");
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setView(dashboardViewForNav(nav));
  }, [focusRagExecutions, focusedExecutionId]);

  useEffect(() => {
    if (!focusRagExecutions || view !== "detail") return undefined;
    const frame = requestAnimationFrame(() => {
      ragExecutionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRagExecutions, focusedExecutionId, view]);

  // 데이터 폴링 — 실행 잡 있으면 짧게, 없으면 길게. 실패한 소스는 조용히 삼키지 않고 errAt으로 표면화.
  const runningCount = jobs?.running?.length || 0;
  useEffect(() => {
    let alive = true, timer;
    async function load() {
      const settled = [];
      const [s, a, f] = await Promise.allSettled([api.stats(), api.auditStats(), api.audit(200)]);
      if (!alive) return;
      settled.push(s, a, f);
      if (s.status === "fulfilled") setStats(s.value);
      if (a.status === "fulfilled") setAstats(a.value);
      if (f.status === "fulfilled") setFeed(f.value.entries || []);
      if (activeId) {
        const [h, j, m] = await Promise.allSettled([
          api.projectHealth(activeId), api.projectJobs(activeId), api.monitorStatus(activeId)]);
        if (!alive) return;
        settled.push(h, j, m);
        if (h.status === "fulfilled") setHealth(h.value);
        if (j.status === "fulfilled") setJobs(j.value);
        if (m.status === "fulfilled") setMon(m.value);
      }
      const anyErr = settled.some((r) => r.status === "rejected");
      if (anyErr) setErrAt((prev) => prev || Date.now());
      else { setErrAt(null); setLastOkAt(Date.now()); }
      setBooted(true);
    }
    load();
    timer = setInterval(load, runningCount > 0 ? 4000 : 12000);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, runningCount, reloadKey]);

  // ── 실행 중 변환 잡 — jobStore(시작 즉시) + projectJobs(권위)로 jobId 확정, 상세는 SSE ──
  const storeJobId = useJob(activeId);
  const runJob = jobs?.running?.[0];
  const jobId = runJob?.job_id || storeJobId || null;
  const stream = useJobStream(jobId);
  // SSE가 끊겨도(프록시 타임아웃 등) 폴링이 running을 보고하는 한 잡 표시를 유지한다
  const liveJob = jobId && stream.status === "running"
    ? { jobId, kind: runJob?.kind || "apply", pct: stream.pct, resources: stream.resources, log: stream.log }
    : runJob
      ? { jobId, kind: runJob.kind || "apply", pct: runJob.pct || 0, resources: [], log: [] }
      : null;

  // ── 파생 지표 ──
  const R = health?.resources || [];
  const sum = (fn) => R.reduce((acc, r) => acc + (fn(r) || 0), 0);
  const smokePassed = sum((r) => r.smoke?.passed);
  const smokeTotal = sum((r) => r.smoke?.total);
  const smokePct = smokeTotal ? Math.round((100 * smokePassed) / smokeTotal) : null;
  const life = {
    discover: R.length,
    convert: sum((r) => (r.classify?.success || 0) + (r.classify?.warning || 0) + (r.classify?.failed || 0)),
    qualify: smokePassed,
    serve: sum((r) => r.enabled),
    improve: sum((r) => (r.classify?.failed || 0) + (r.smoke?.failed || 0)),
  };
  const peakBucket = Math.max(0, ...(astats?.buckets || []).map((b) => b.calls));

  // ── 구조(인벤토리) 지표 — registry/stats. 호출/헬스 이력이 없어도 항상 채워진다 ──
  const services = stats?.services || [];
  const byMethod = stats?.by_method || {};
  const sources = stats?.sources || [];
  const toolCount = stats?.count || 0;
  const mutating = stats?.mutating || 0;
  // 헬스가 비면 라이프사이클 하한을 구조 데이터로 파생(실데이터): 수집=소스종류, 변환=툴수, 서빙=배포수
  const lifeView = {
    discover: life.discover || sources.length,
    convert: life.convert || toolCount,
    qualify: life.qualify,
    serve: life.serve || (stats?.deployed || 0),
    improve: life.improve,
  };

  const starter = booted && !!activeId && toolCount === 0 && R.length === 0 && !liveJob;
  const errAgo = errAt && lastOkAt ? Math.max(0, Math.round((Date.now() - lastOkAt) / 1000)) : null;

  // ── HEALTH 스코어 — 성공률·스모크 평균에서 실패 리소스만큼 감점. 신호가 없으면 standby ──
  const brokenCount = R.filter((r) => deriveState(r) === "broken").length;
  const scoreParts = [];
  if (astats?.ok_rate != null) scoreParts.push(astats.ok_rate * 100);
  if (smokePct != null) scoreParts.push(smokePct);
  const score = scoreParts.length
    ? Math.max(0, Math.min(100, Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) - brokenCount * 15))
    : null;

  // P95 게이지의 기준선 — 이 값을 넘으면 KPI 미터가 앰버로 넘어간다
  const P95_TARGET = 200;

  // ── 관제 뷰 파생 — monitor/status의 서비스 목록. 프로브 이력이 없으면 legacy_state="unknown"(정상 아님, 모름) ──
  const servers = mon?.servers || [];
  const svcUp = servers.filter((s) => s.legacy_state === "ok").length;

  return (
    <div className="dashv2 dash-anim" style={{ animation: "fadeUp .3s ease-out", display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>

      {/* 시계 배지 — 데크 상단 테두리 우측에 항상 고정 (레이아웃 흐름 밖) */}
      <span className="hud-clock">LOCAL<b style={sx.clock}>{clock}</b></span>

      {/* ── 온보딩 백그라운드 배너 — 활성 프로젝트와 무관하게 항상 최상단 ── */}
      <OnboardingBanner c={c} go={go} />

      {/* ── 프로젝트 미선택 안내 — 관제 진입 CTA만 남긴 콤팩트 밴드 (평상시엔 렌더되지 않음) ── */}
      {booted && !activeId && (
        <section className="hud-panel" style={{ ...sx.panel, textAlign: "center", padding: "18px 20px 20px" }}>
          <div style={{ fontFamily: "var(--disp)", fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>{c.npTitle}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 5 }}>{c.npHint}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
            <CTA onClick={() => go("projects")}>{c.npPick}</CTA>
            <CTA onClick={() => go("onboarding")}>{c.npNew}</CTA>
          </div>
        </section>
      )}

      {/* 데이터 로드 실패 배너 — 패널은 마지막 성공 데이터(stale)를 유지 */}
      {errAt && (
        <div style={sx.errBanner}>
          <WarnIco />
          <span>{c.errBanner}{errAgo != null ? ` · ${c.lastSync} ${errAgo}${c.secAgo}` : ""}</span>
          <button style={sx.errRetry} onClick={() => setReloadKey((k) => k + 1)}>{c.retry}</button>
        </div>
      )}

      {focusRagExecutions && nav?.ingestionWarning && (
        <div style={sx.errBanner} role="alert">
          <WarnIco />
          <span>{nav.ingestionWarning}</span>
        </div>
      )}

      {/* 진행 중 작업 히어로 — 온보딩 일시중지 · 변환 잡 · 파이프라인 · 온톨로지 */}
      {activeId && <ActivityHero c={c} go={go} activeId={activeId} activeName={active?.name} liveJob={liveJob} />}

      {/* 뷰 전환 — 관제(한 화면, 시연 기본) ↔ 상세(운영용 전체 지표) */}
      <div className="dash-viewsw" style={{ alignSelf: "flex-start" }}>
        <button aria-pressed={view === "deck"} onClick={() => setView("deck")}>{c.vDeck}</button>
        <button aria-pressed={view === "detail"} onClick={() => setView("detail")}>{c.vDetail}</button>
      </div>

      {view === "deck" ? (
        <div className="dash-deck">
          {/* KPI 스트립 — 큰 숫자 + 그 숫자를 설명하는 마이크로 차트.
              숫자는 '지금 값'만 말하므로, 추세(스파크)·여유(게이지)·구성(스택)을 함께 둔다. */}
          <div className="dash-kpi">
            <div className={astats?.ok_rate == null ? "kpi-idle" : astats.ok_rate < 0.95 ? "kpi-alert" : undefined}>
              <span className="klabel">{c.kSuccess}</span>
              <b>{astats?.ok_rate != null ? <><Num value={astats.ok_rate * 100} dec={1} /><em>%</em></> : "—"}</b>
              <div className="kviz">
                {/* 성공/실패 구성 — 100%면 한 색으로 꽉 차고, 실패가 생기면 붉은 조각이 보인다 */}
                <StackBar parts={[
                  { key: "ok", value: astats?.ok || 0, color: "var(--green)" },
                  { key: "err", value: astats?.errors || 0, color: "var(--red)" },
                ]} />
              </div>
              <span className="ksub">{astats?.errors ? `${astats.errors} ${c.errors}` : c.kSuccessSub}</span>
            </div>
            <div className={!astats?.calls ? "kpi-idle" : undefined}>
              <span className="klabel">{c.kCalls}</span>
              <b><Num value={astats?.calls ?? 0} comma /></b>
              <div className="kviz">
                <Spark data={(astats?.buckets || []).map((b) => b.calls)} color="var(--purple)" h={20} />
              </div>
              <span className="ksub">{peakBucket ? `${c.peak} ${peakBucket}/h` : c.kCallsSub}</span>
            </div>
            <div className={!astats?.latency_p95 ? "kpi-idle" : undefined}>
              <span className="klabel">{c.kP95}</span>
              <b>{astats?.latency_p95 ? <><Num value={astats.latency_p95} /><em>ms</em></> : "—"}</b>
              <div className="kviz kviz--mid">
                {/* 목표 200ms 대비 여유. 넘으면 앰버로 바뀐다 */}
                <Meter value={astats?.latency_p95} target={P95_TARGET} over color="var(--blue)" />
              </div>
              <span className="ksub">
                {astats?.latency_p50 ? `p50 ${astats.latency_p50}ms · ` : ""}{c.kP95Sub} {P95_TARGET}ms
              </span>
            </div>
            <div className={!toolCount ? "kpi-idle" : undefined}>
              <span className="klabel">{c.kTools}</span>
              <b><Num value={toolCount} /></b>
              <div className="kviz kviz--mid">
                <StackBar parts={Object.entries(byMethod).map(([m, v]) => (
                  { key: m, value: v, color: METHOD_COLOR[m] || "var(--faint)" }))} />
              </div>
              <span className="ksub">
                {Object.entries(byMethod).slice(0, 3).map(([m, v]) => `${m} ${v}`).join(" · ") || c.kToolsSub}
              </span>
            </div>
            <div className={!servers.length ? "kpi-idle" : svcUp < servers.length ? "kpi-alert" : undefined}>
              <span className="klabel">{c.kUp}</span>
              <b>{servers.length ? <><Num value={svcUp} /><em>/{servers.length}</em></> : "—"}</b>
              <div className="kviz kviz--mid">
                <DotScale total={servers.length} filled={svcUp} />
              </div>
              <span className="ksub">
                {servers.length ? (svcUp === servers.length ? c.kUpAll : `${servers.length - svcUp} ${c.kUpBad}`) : c.kUpSub}
              </span>
            </div>
          </div>

          <LiveWire servers={servers} astats={astats} audit={feed} toolCount={toolCount} ko={ko} go={go} booted={booted} />

          <div className="dash-deckrow">
            <ServiceMatrix servers={servers} ko={ko} go={go} booted={booted} activeId={activeId}
              onProbed={() => setReloadKey((k) => k + 1)} />
            <LiveFeed c={c} entries={feed} toolCount={toolCount} go={go} booted={booted} />
          </div>
        </div>
      ) : (
      <>
      {/* ── 3컬럼 HUD 그리드 — 자산 | 신경망 코어 | 운영 ── */}
      <div className="dash-hudgrid">
        <div className="dash-side">
          <div className="hud-colcap">{c.grpAsset}</div>
          <section className="hud-panel" style={sx.panelCol}>
            <PanelHead title={c.grpNow} sub={c.grpNowSub} />
            <div className="dash-instr">
              <Metric label={c.tools} accent="var(--blue)" icon={<CubeIco />} onClick={() => go("explorer")}
                value={<Num value={stats?.count} />}
                sub={(stats?.sources || []).slice(0, 3).map((s) => `${s.type} ${s.count}`).join(" · ") || null} />
              <Metric label={c.calls} accent="var(--purple)" icon={<PulseIco />} idle={!astats?.calls} vacantLabel={c.vacantCalls}
                value={<Num value={astats?.calls} comma />} sub={peakBucket ? `${c.peak} ${peakBucket}/h` : null}
                spark={(astats?.buckets || []).map((b) => b.calls)} />
              <Metric label={c.success} accent="var(--green)" icon={<CheckCircleIco />} idle={astats?.ok_rate == null} vacantLabel={c.vacantCalls}
                alert={astats?.ok_rate != null && astats.ok_rate < 0.95}
                value={astats?.ok_rate != null ? <><Num value={astats.ok_rate * 100} dec={1} /><em style={sx.unit}>%</em></> : null}
                sub={astats?.errors ? `${astats.errors} ${c.errors}` : null} />
              <Metric label={c.p95} accent="var(--amber)" icon={<GaugeIco />} idle={!astats?.latency_p95} vacantLabel={c.vacantCalls}
                value={astats?.latency_p95 ? <><Num value={astats.latency_p95} /><em style={sx.unit}>ms</em></> : null}
                sub={astats?.latency_p50 ? `p50 ${astats.latency_p50}ms` : null} />
              <Metric label={c.smoke} accent="var(--blue)" icon={<ShieldIco />} idle={smokePct == null} vacantLabel={c.vacantSmoke}
                alert={smokePct != null && smokePct < 100}
                value={smokePct != null ? <><Num value={smokePct} /><em style={sx.unit}>%</em></> : null}
                sub={smokeTotal ? `${smokePassed}/${smokeTotal} ${c.pass}` : null} />
            </div>
          </section>
          {/* 행 배치 순서 = 렌더 순서: 메서드 분포(3) → 서비스별 툴(4, 큰 행) → 안전성(5) → 소스 구성(6) */}
          <MethodMix c={c} byMethod={byMethod} go={go} booted={booted} />
          <TopTools c={c} tools={astats?.top_tools || []} services={services} go={go} booted={booted} />
          <SafetyMix c={c} mutating={mutating} toolCount={toolCount} />
          <SourceMix c={c} sources={sources} go={go} booted={booted} />
        </div>

        <div className="dash-core">
          <div className="hud-colcap">{c.grpCore}</div>
          <NeuralCore c={c} life={lifeView} go={go} calls={astats?.calls || 0} />
          <ConversionOps c={c} live={liveJob} go={go} booted={booted} hasProject={!!activeId} starter={starter} />
          <TrendChart c={c} buckets={astats?.buckets || []} byMethod={byMethod} booted={booted} />
        </div>

        <div className="dash-side">
          <div className="hud-colcap">{c.grpOps}</div>
          <RailBlock title={c.health} sub={c.subScore}>
            <div>
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
                <HealthRing score={score} standby={score == null} label={c.health} size={176} />
              </div>
              {/* 최근 스모크 시각 — HUD 헤더 제거로 여기 흡수 */}
              <div className="mono" style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)", paddingBottom: 4 }}>
                {c.lastSmoke} {fmtTime(health?.smoke_at)}
              </div>
            </div>
          </RailBlock>
          <HealthMatrix c={c} rows={R} services={services} go={go} booted={booted} hasProject={!!activeId} />
          <LiveFeed c={c} entries={feed} toolCount={toolCount} go={go} booted={booted} />
          <RecentRuns c={c} history={jobs?.history || []} booted={booted} hasProject={!!activeId} className="hud-row2" />
        </div>
      </div>

      {/* 3열 HUD 아래 전체 폭을 사용하는 문서 지식화 실행 이력 */}
      {activeId && (
        <div ref={ragExecutionsRef}>
          <RagExecutionsPanel activeId={activeId} lang={lang} focusedExecutionId={focusedExecutionId}
            onOpen={(execution) => go("ragExecution", { executionId: execution.id })} />
        </div>
      )}
      </>
      )}
    </div>
  );
}
