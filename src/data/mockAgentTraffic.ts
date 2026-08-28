/**
 * 에이전트 운영 모니터링 mock 데이터.
 *
 * 노출 메트릭(요청 명세서 기준):
 *  · 트래픽 — RPS/RPM/TPS, 총 요청 수, 세션/동시 세션, Turn 수, DAU/WAU/MAU
 *  · 지연  — P50/P95/P99, TTFT, 타임아웃 발생률
 *  · 결과  — 성공률/실패율, Fallback 발동 횟수
 *  · 환경  — 학습계 vs 서빙계 트래픽 분포, SLO 충족률
 *  · 자원  — CPU/Memory 사용률, replica 수, Pod Ready/Pending
 *  · LLM   — 입출력 토큰(모델별), 토큰 쿼터 소진율, TPM 한도 도달률
 */

export interface ModelTokenUsage {
  /** 모델 식별자. */
  name: string;
  /** 24h 누계 입력 토큰. */
  inputTokens24h: number;
  /** 24h 누계 출력 토큰. */
  outputTokens24h: number;
  /** 24h 호출 비중(%). */
  callShare: number;
}

export interface AgentTrafficSnapshot {
  /** 마지막 갱신 시각(서버 기준). */
  updatedAt: string;
  /** 운영 중이 아니면 false — 화면은 비활성 안내로 대체. */
  isLive: boolean;

  // ── A1. 요청량 ────────────────────────────────────────────
  rps: number;
  rpm: number;
  /** Tokens Per Second(출력) — LLM 응답 속도. */
  tps: number;
  /** 7일 총 요청 수. */
  total7d: number;
  /** 24h 총 요청 수. */
  total24h: number;
  /** 현재 활성 세션. */
  activeSessions: number;
  /** 동시 처리 중인 세션 피크(현 시점). */
  concurrentSessions: number;
  /** 24h 누적 Turn 수. */
  turns24h: number;
  /** 세션당 평균 Turn. */
  avgTurnsPerSession: number;
  dau: number;
  wau: number;
  mau: number;

  // ── A2. 지연 ────────────────────────────────────────────
  /** 종단 지연(ms). */
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** Time To First Token(ms). */
  ttftMs: number;
  /** 타임아웃 발생률(%) — 24h. */
  timeoutRate: number;

  // ── A3. 결과 ────────────────────────────────────────────
  successRate: number;
  failureRate: number;
  /** 24h 누적 Fallback 발동 횟수. */
  fallbackCount24h: number;

  // ── A4. 환경 분배 ───────────────────────────────────────
  /** 학습계 RPS. */
  trainRps: number;
  /** 서빙계 RPS. */
  servRps: number;

  // ── SLO ────────────────────────────────────────────────
  /** SLO 충족률(%) — p95 ≤ target 기준 30일. */
  sloAttainment: number;
  /** SLO 목표 P95(ms). */
  sloTargetP95Ms: number;
  /** Error Budget 소진율(%). */
  errorBudgetBurn: number;

  // ── B1. 자원(Pod) ───────────────────────────────────────
  podsDesired: number;
  podsReady: number;
  podsPending: number;
  /** 평균 CPU(%) — 운영 중 Pod 평균. */
  cpuAvg: number;
  cpuP95: number;
  memAvg: number;
  memP95: number;

  // ── B4. 토큰·LLM ────────────────────────────────────────
  inputTokens24h: number;
  outputTokens24h: number;
  models: ModelTokenUsage[];
  /** 토큰 쿼터(과제 단위) 소진율(%). */
  tokenQuotaUsedPct: number;
  /** TPM 한도 도달률(현재 가장 압박받는 모델 기준, %). */
  tpmUtilization: number;
  /** TPM 한도 도달률이 가장 높은 모델명. */
  tpmHotModel: string;

  // ── 시계열(60분, 분 단위) ───────────────────────────────
  rpsSeries: number[];
  p95Series: number[];
  ttftSeries: number[];
  successRateSeries: number[];
  cpuSeries: number[];
  memSeries: number[];
  podSeries: number[];
  trainTrafficSeries: number[];
  servTrafficSeries: number[];
  tpmUtilSeries: number[];
}

/**
 * 0~1 사이 시드 기반 의사난수. 동일 agentId에 대해 매번 같은 곡선이 그려지도록.
 * 새로고침해도 차트가 점프하지 않게 한다.
 */
function seededWalk(seed: number, count: number, base: number, amp: number, drift = 0): number[] {
  let s = seed;
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    v = base + Math.sin((i / count) * Math.PI * 2 + seed) * amp * 0.45 + (r - 0.5) * amp + drift * (i / count);
    out.push(Math.max(0, v));
  }
  return out;
}

function sumSeries(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

/** 운영 중 agent — 풀 데이터. */
function buildLiveSnapshot(agentId: string): AgentTrafficSnapshot {
  const seedNum = agentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // 시계열 60분
  const rpsSeries = seededWalk(seedNum, 60, 9.4, 3.2, 0.4).map((v) => +v.toFixed(2));
  const p95Series = seededWalk(seedNum + 11, 60, 2050, 380).map((v) => Math.round(v));
  const ttftSeries = seededWalk(seedNum + 23, 60, 540, 110).map((v) => Math.round(v));
  const successRateSeries = seededWalk(seedNum + 31, 60, 98.6, 0.8).map((v) =>
    Math.min(100, +v.toFixed(2)),
  );
  const cpuSeries = seededWalk(seedNum + 7, 60, 42, 18, 5).map((v) => Math.min(95, +v.toFixed(1)));
  const memSeries = seededWalk(seedNum + 17, 60, 58, 9, 3).map((v) => Math.min(95, +v.toFixed(1)));
  const podSeries = seededWalk(seedNum + 29, 60, 6, 2).map((v) => Math.max(3, Math.round(v)));
  const trainTrafficSeries = seededWalk(seedNum + 41, 60, 2.1, 0.9).map((v) => +v.toFixed(2));
  const servTrafficSeries = seededWalk(seedNum + 47, 60, 7.3, 2.6, 0.3).map((v) => +v.toFixed(2));
  const tpmUtilSeries = seededWalk(seedNum + 53, 60, 64, 14, 5).map((v) =>
    Math.min(98, +v.toFixed(1)),
  );

  const rpsNow = rpsSeries[rpsSeries.length - 1];
  const p95Now = p95Series[p95Series.length - 1];
  const ttftNow = ttftSeries[ttftSeries.length - 1];
  const successNow = successRateSeries[successRateSeries.length - 1];
  const cpuNow = cpuSeries[cpuSeries.length - 1];
  const memNow = memSeries[memSeries.length - 1];
  const podsNow = podSeries[podSeries.length - 1];
  const trainNow = trainTrafficSeries[trainTrafficSeries.length - 1];
  const servNow = servTrafficSeries[servTrafficSeries.length - 1];
  const tpmNow = tpmUtilSeries[tpmUtilSeries.length - 1];

  // 24h 합산 (단순 60min 합 * 24 보정)
  const total24h = Math.round(rpsSeries.reduce((a, b) => a + b, 0) * 60 * 24);
  const total7d = Math.round(total24h * 7 * 0.92);

  const models: ModelTokenUsage[] = [
    {
      name: 'onprem/qwen3-32b',
      inputTokens24h: 4_820_000,
      outputTokens24h: 1_315_000,
      callShare: 68.2,
    },
    {
      name: 'onprem/gpt-oss-120b',
      inputTokens24h: 1_960_000,
      outputTokens24h: 540_000,
      callShare: 27.4,
    },
    {
      name: 'onprem/sLLM-13b',
      inputTokens24h: 312_000,
      outputTokens24h: 88_000,
      callShare: 4.4,
    },
  ];

  const inputTokens24h = models.reduce((a, m) => a + m.inputTokens24h, 0);
  const outputTokens24h = models.reduce((a, m) => a + m.outputTokens24h, 0);

  return {
    updatedAt: '2026-06-03 14:08',
    isLive: true,

    rps: +rpsNow.toFixed(2),
    rpm: Math.round(rpsNow * 60),
    tps: 38.4,
    total7d,
    total24h,
    activeSessions: 142,
    concurrentSessions: 38,
    turns24h: Math.round(total24h * 2.3),
    avgTurnsPerSession: 2.3,
    dau: 318,
    wau: 1_842,
    mau: 5_106,

    p50Ms: Math.round(p95Now * 0.46),
    p95Ms: p95Now,
    p99Ms: Math.round(p95Now * 1.32),
    ttftMs: ttftNow,
    timeoutRate: 0.18,

    successRate: successNow,
    failureRate: +(100 - successNow).toFixed(2),
    fallbackCount24h: 17,

    trainRps: +trainNow.toFixed(2),
    servRps: +servNow.toFixed(2),

    sloAttainment: 99.42,
    sloTargetP95Ms: 3000,
    errorBudgetBurn: 12.4,

    podsDesired: podsNow,
    podsReady: Math.max(0, podsNow - 1),
    podsPending: 1,
    cpuAvg: cpuNow,
    cpuP95: Math.min(95, +(cpuNow + 22).toFixed(1)),
    memAvg: memNow,
    memP95: Math.min(95, +(memNow + 12).toFixed(1)),

    inputTokens24h,
    outputTokens24h,
    models,
    tokenQuotaUsedPct: 47.8,
    tpmUtilization: tpmNow,
    tpmHotModel: 'onprem/qwen3-32b',

    rpsSeries,
    p95Series,
    ttftSeries,
    successRateSeries,
    cpuSeries,
    memSeries,
    podSeries,
    trainTrafficSeries,
    servTrafficSeries,
    tpmUtilSeries,
  };
}

/** Idle agent — 모든 메트릭 0/빈 상태. */
function buildIdleSnapshot(): AgentTrafficSnapshot {
  const zero60 = Array(60).fill(0);
  return {
    updatedAt: '-',
    isLive: false,
    rps: 0,
    rpm: 0,
    tps: 0,
    total7d: 0,
    total24h: 0,
    activeSessions: 0,
    concurrentSessions: 0,
    turns24h: 0,
    avgTurnsPerSession: 0,
    dau: 0,
    wau: 0,
    mau: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    ttftMs: 0,
    timeoutRate: 0,
    successRate: 0,
    failureRate: 0,
    fallbackCount24h: 0,
    trainRps: 0,
    servRps: 0,
    sloAttainment: 0,
    sloTargetP95Ms: 3000,
    errorBudgetBurn: 0,
    podsDesired: 0,
    podsReady: 0,
    podsPending: 0,
    cpuAvg: 0,
    cpuP95: 0,
    memAvg: 0,
    memP95: 0,
    inputTokens24h: 0,
    outputTokens24h: 0,
    models: [],
    tokenQuotaUsedPct: 0,
    tpmUtilization: 0,
    tpmHotModel: '-',
    rpsSeries: zero60,
    p95Series: zero60,
    ttftSeries: zero60,
    successRateSeries: zero60,
    cpuSeries: zero60,
    memSeries: zero60,
    podSeries: zero60,
    trainTrafficSeries: zero60,
    servTrafficSeries: zero60,
    tpmUtilSeries: zero60,
  };
}

/**
 * agentId 기준 트래픽 스냅샷.
 * `isLive`가 false면 화면에서 안내 메시지로 대체.
 */
export function getAgentTrafficSnapshot(
  agentId: string,
  isLive: boolean,
): AgentTrafficSnapshot {
  return isLive ? buildLiveSnapshot(agentId) : buildIdleSnapshot();
}

/** 환경별 합산 시계열(스택용)을 만든다. */
export function getStackedTrafficSeries(snap: AgentTrafficSnapshot): {
  train: number[];
  total: number[];
} {
  return {
    train: snap.trainTrafficSeries,
    total: sumSeries(snap.trainTrafficSeries, snap.servTrafficSeries),
  };
}
