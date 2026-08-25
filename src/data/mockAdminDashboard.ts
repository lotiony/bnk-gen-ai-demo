/**
 * 플랫폼 관리자 대시보드 mock.
 *
 * 계열사(부산은행) 내 모든 프로젝트의 사용 현황을 한 레이어 위에서 합산한다.
 * 프로젝트 대시보드(모니터링 탭)가 가진 메트릭을 동일 기준으로 cross-project 집계.
 */

import { MOCK_CATALOG_AGENTS } from './mockCatalogAgents';

export interface ProjectUsageRow {
  id: string;
  name: string;
  dept: string;
  pmName: string;
  status: '운영 중' | '개발 중' | '보류';

  /** 서빙계에 배포된 에이전트 수. */
  servingAgents: number;
  /** 학습계까지 포함한 총 에이전트 수. */
  totalAgents: number;

  /** 30일 호출 총합. */
  monthCalls: number;
  /** 최근 30일 일별 호출 시계열 (스파크라인용). */
  monthCallsTrend: number[];
  /** 전월 대비 증감(%). */
  monthCallsDeltaPct: number;
  /** 어제 기준 DAU. */
  dau: number;

  /** 30일 비용 (KRW). */
  monthCost: number;
  /** 월 예산 (KRW). */
  budgetCost: number;

  /** SLO 충족률(%). */
  sloAttainment: number;
  /** P95 응답(ms). */
  p95Ms: number;
  /** SLO 목표 P95(ms). */
  sloTargetMs: number;
  /** 👍 비율(%) — 대화 분석 기반. */
  feedbackUpRate: number;
  /** 30일 Fallback 발동 횟수. */
  fallbackCount: number;

  /** 가드레일 차단 건수 (7일). */
  guardrailBlocks: number;
  /** 정책 위반 (7일). */
  policyViolations: number;
  /** PII 마스킹 건수 (7일). */
  piiMaskCount: number;

  /** 현재 Pod 수. */
  podsCurrent: number;
  /** GPU 자원 점유율(%). */
  gpuUtilPct: number;
  /** 월 토큰 쿼터 소진(%). */
  tokenQuotaPct: number;
  /** TPM 한도 도달률(%). */
  tpmUtilPct: number;

  /** 결재 대기 (전사 기준이 아닌 이 프로젝트 발생분). */
  pendingApprovals: number;
  /** 마지막 활동 시각. */
  lastActivity: string;
  /** 주력 모델. */
  primaryModel: string;

  /** 30일 입력 토큰 합계. */
  monthTokenInput: number;
  /** 30일 출력 토큰 합계. */
  monthTokenOutput: number;
}

/* 동일 시드 30일 시계열 헬퍼. */
function trend(seed: number, base: number, amp: number): number[] {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const v = base + Math.sin((i / 30) * Math.PI * 2 + seed) * amp * 0.5 + (r - 0.5) * amp;
    out.push(Math.max(0, Math.round(v)));
  }
  return out;
}

export const ADMIN_PROJECT_ROWS: ProjectUsageRow[] = [
  {
    id: 'PRJ-2025-PB-001',
    name: 'PB 에이전트 프로젝트',
    dept: 'PB 사업부',
    pmName: '김플랫',
    status: '운영 중',
    servingAgents: 1,
    totalAgents: 1,
    monthCalls: 12_000,
    monthCallsTrend: trend(101, 400, 180),
    monthCallsDeltaPct: 8.2,
    dau: 318,
    monthCost: 2_400_000,
    budgetCost: 4_000_000,
    sloAttainment: 99.42,
    p95Ms: 2100,
    sloTargetMs: 3000,
    feedbackUpRate: 92.1,
    fallbackCount: 17,
    guardrailBlocks: 7,
    policyViolations: 0,
    piiMaskCount: 218,
    podsCurrent: 5,
    gpuUtilPct: 48,
    tokenQuotaPct: 47.8,
    tpmUtilPct: 67.8,
    pendingApprovals: 2,
    lastActivity: '2026-05-24 14:23',
    primaryModel: 'azure/gpt-5.5',
    monthTokenInput: 3_840_000,
    monthTokenOutput: 1_080_000,
  },
  {
    id: 'PRJ-2024-FC-001',
    name: '금융상담 에이전트 프로젝트',
    dept: '금융상담팀',
    pmName: '한지수',
    status: '운영 중',
    servingAgents: 1,
    totalAgents: 1,
    monthCalls: 1_800_000,
    monthCallsTrend: trend(303, 60_000, 14_000),
    monthCallsDeltaPct: -3.2,
    dau: 4_120,
    monthCost: 240_000_000,
    budgetCost: 300_000_000,
    sloAttainment: 97.85,
    p95Ms: 3120,
    sloTargetMs: 3000,
    feedbackUpRate: 81.2,
    fallbackCount: 184,
    guardrailBlocks: 92,
    policyViolations: 3,
    piiMaskCount: 4_220,
    podsCurrent: 24,
    gpuUtilPct: 88,
    tokenQuotaPct: 91.6,
    tpmUtilPct: 93.1,
    pendingApprovals: 3,
    lastActivity: '2026-05-24 14:48',
    primaryModel: 'openai/gpt-oss-120b',
    monthTokenInput: 612_000_000,
    monthTokenOutput: 184_000_000,
  },
  {
    id: 'PRJ-2024-CR-002',
    name: '여신심사 에이전트 프로젝트',
    dept: '여신지원부',
    pmName: '박서연',
    status: '운영 중',
    servingAgents: 1,
    totalAgents: 2,
    monthCalls: 86_400,
    monthCallsTrend: trend(404, 2800, 720),
    monthCallsDeltaPct: 22.1,
    dau: 178,
    monthCost: 16_000_000,
    budgetCost: 20_000_000,
    sloAttainment: 99.12,
    p95Ms: 2640,
    sloTargetMs: 3000,
    feedbackUpRate: 90.5,
    fallbackCount: 28,
    guardrailBlocks: 12,
    policyViolations: 0,
    piiMaskCount: 304,
    podsCurrent: 6,
    gpuUtilPct: 54,
    tokenQuotaPct: 38.7,
    tpmUtilPct: 51.2,
    pendingApprovals: 1,
    lastActivity: '2026-05-24 11:02',
    primaryModel: 'azure/gpt-5.5',
    monthTokenInput: 28_500_000,
    monthTokenOutput: 7_900_000,
  },
  {
    id: 'PRJ-2024-CS-001',
    name: 'CS 챗봇 코파일럿 프로젝트',
    dept: '디지털채널부',
    pmName: '정수민',
    status: '운영 중',
    servingAgents: 1,
    totalAgents: 1,
    monthCalls: 920_000,
    monthCallsTrend: trend(505, 30_000, 7_400),
    monthCallsDeltaPct: 5.8,
    dau: 2_840,
    monthCost: 96_000_000,
    budgetCost: 120_000_000,
    sloAttainment: 99.08,
    p95Ms: 1840,
    sloTargetMs: 2500,
    feedbackUpRate: 86.7,
    fallbackCount: 96,
    guardrailBlocks: 41,
    policyViolations: 0,
    piiMaskCount: 2_180,
    podsCurrent: 14,
    gpuUtilPct: 62,
    tokenQuotaPct: 64.2,
    tpmUtilPct: 71.4,
    pendingApprovals: 0,
    lastActivity: '2026-05-24 14:55',
    primaryModel: 'onprem/sLLM-13b',
    monthTokenInput: 248_400_000,
    monthTokenOutput: 78_200_000,
  },
  {
    id: 'PRJ-2025-AML-001',
    name: '자금세탁 방지 에이전트',
    dept: '준법지원부',
    pmName: '강민호',
    status: '개발 중',
    servingAgents: 0,
    totalAgents: 1,
    monthCalls: 0,
    monthCallsTrend: Array(30).fill(0),
    monthCallsDeltaPct: 0,
    dau: 0,
    monthCost: 0,
    budgetCost: 2_000_000,
    sloAttainment: 0,
    p95Ms: 0,
    sloTargetMs: 3000,
    feedbackUpRate: 0,
    fallbackCount: 0,
    guardrailBlocks: 0,
    policyViolations: 0,
    piiMaskCount: 0,
    podsCurrent: 0,
    gpuUtilPct: 0,
    tokenQuotaPct: 0,
    tpmUtilPct: 0,
    pendingApprovals: 1,
    lastActivity: '2026-05-22 09:18',
    primaryModel: 'azure/gpt-5.5',
    monthTokenInput: 0,
    monthTokenOutput: 0,
  },
];

/** 모델별 PTU 단가 (월 단위, KRW). */
export const MODEL_PTU_UNIT_PRICE: Record<string, number> = {
  'openai/gpt-oss-120b': 1_000_000,
  'azure/gpt-5.5': 800_000,
  'onprem/sLLM-13b': 400_000,
};

/* ───────── 토큰 사용량 헬퍼 ───────── */

export interface TokenSeries {
  /** 일자 라벨 — 30일 (오늘에서 거꾸로). */
  days: string[];
  /** 일별 입력 토큰 합계. */
  inputDaily: number[];
  /** 일별 출력 토큰 합계. */
  outputDaily: number[];
  /** 30일 입력 토큰 합계. */
  totalInput: number;
  /** 30일 출력 토큰 합계. */
  totalOutput: number;
}

/**
 * 운영 프로젝트의 일별 토큰 사용량 시계열을 합산.
 * 각 row의 monthCallsTrend를 가중치로 사용해 monthToken*을 분배.
 */
export function getDailyTokenSeries(rows: ProjectUsageRow[]): TokenSeries {
  const N = 30;
  const inputDaily = Array(N).fill(0);
  const outputDaily = Array(N).fill(0);

  for (const r of rows) {
    if (r.monthCalls === 0 || r.monthTokenInput + r.monthTokenOutput === 0) continue;
    const trendSum = r.monthCallsTrend.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < N; i++) {
      const w = r.monthCallsTrend[i] / trendSum;
      inputDaily[i] += r.monthTokenInput * w;
      outputDaily[i] += r.monthTokenOutput * w;
    }
  }

  // 일자 라벨 (오늘에서 거꾸로 30일)
  const today = new Date('2026-05-24T00:00:00');
  const days: string[] = [];
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${mm}-${dd}`);
  }

  return {
    days,
    inputDaily: inputDaily.map(Math.round),
    outputDaily: outputDaily.map(Math.round),
    totalInput: rows.reduce((a, r) => a + r.monthTokenInput, 0),
    totalOutput: rows.reduce((a, r) => a + r.monthTokenOutput, 0),
  };
}

export interface ModelTokenSlice {
  model: string;
  input: number;
  output: number;
  total: number;
  pct: number;
}

/** primaryModel 기준으로 토큰 사용량을 그룹핑. */
export function getModelTokenBreakdown(rows: ProjectUsageRow[]): ModelTokenSlice[] {
  const map = new Map<string, { input: number; output: number }>();
  for (const r of rows) {
    if (r.monthTokenInput + r.monthTokenOutput === 0) continue;
    const cur = map.get(r.primaryModel) ?? { input: 0, output: 0 };
    cur.input += r.monthTokenInput;
    cur.output += r.monthTokenOutput;
    map.set(r.primaryModel, cur);
  }
  const arr: ModelTokenSlice[] = Array.from(map.entries()).map(([model, v]) => ({
    model,
    input: v.input,
    output: v.output,
    total: v.input + v.output,
    pct: 0,
  }));
  const totalAll = arr.reduce((a, m) => a + m.total, 0) || 1;
  arr.forEach((m) => (m.pct = (m.total / totalAll) * 100));
  arr.sort((a, b) => b.total - a.total);
  return arr;
}

/* ───────── 모델 PTU(Provisioned Throughput Unit) ───────── */

export interface ModelPtuUsage {
  /** 모델 식별자. */
  model: string;
  /** 할당된 PTU 수 (LLM 게이트웨이에서 예약된 처리 용량). */
  allocatedPtus: number;
  /** 30일 일별 PTU 사용률(%). 100%면 할당 한도 도달. */
  dailyUtilizationPct: number[];
  /** 30일 평균 사용률(%). */
  avgUtilizationPct: number;
  /** 30일 최고 사용률(%). */
  peakUtilizationPct: number;
  /** 현재 시점 사용률(%). */
  currentUtilizationPct: number;
}

/** 0~100 사이 PTU 사용률 시계열 (시드 기반). */
function ptuSeries(seed: number, base: number, amp: number, drift = 0): number[] {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const v =
      base +
      Math.sin((i / 30) * Math.PI * 2 + seed) * amp * 0.45 +
      (r - 0.5) * amp +
      drift * (i / 30);
    out.push(Math.max(2, Math.min(98, +v.toFixed(1))));
  }
  return out;
}

function summarize(series: number[]) {
  const avg = series.reduce((a, b) => a + b, 0) / series.length;
  const peak = Math.max(...series);
  return { avg: +avg.toFixed(1), peak: +peak.toFixed(1), current: series[series.length - 1] };
}

export function getModelPtuUsage(): ModelPtuUsage[] {
  // 시드를 살짝 다르게 줘서 모델별 곡선이 구분되도록.
  const a = ptuSeries(11, 62, 22, 8); // azure/gpt-5.5 — 평균 사용
  const b = ptuSeries(29, 76, 18, 6); // openai/gpt-oss-120b — 가장 압박
  const c = ptuSeries(47, 48, 14, 4); // onprem/sLLM-13b — 여유

  return [
    {
      model: 'openai/gpt-oss-120b',
      allocatedPtus: 240,
      dailyUtilizationPct: b,
      ...summarize(b),
      avgUtilizationPct: summarize(b).avg,
      peakUtilizationPct: summarize(b).peak,
      currentUtilizationPct: summarize(b).current,
    },
    {
      model: 'azure/gpt-5.5',
      allocatedPtus: 160,
      dailyUtilizationPct: a,
      ...summarize(a),
      avgUtilizationPct: summarize(a).avg,
      peakUtilizationPct: summarize(a).peak,
      currentUtilizationPct: summarize(a).current,
    },
    {
      model: 'onprem/sLLM-13b',
      allocatedPtus: 100,
      dailyUtilizationPct: c,
      ...summarize(c),
      avgUtilizationPct: summarize(c).avg,
      peakUtilizationPct: summarize(c).peak,
      currentUtilizationPct: summarize(c).current,
    },
  ];
}

/** 30일 라벨 (시계열 X축용). */
export function getDailyLabels(): string[] {
  const today = new Date('2026-05-24T00:00:00');
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${mm}-${dd}`);
  }
  return days;
}

/* ───────── Aggregate 헬퍼 (KPI band 용) ───────── */

export function getAdminKpis(rows: ProjectUsageRow[]) {
  const total = rows.length;
  const operating = rows.filter((r) => r.status === '운영 중').length;
  const planning = rows.filter((r) => r.status === '개발 중').length;

  const totalServing = rows.reduce((a, r) => a + r.servingAgents, 0);
  const totalAgents = rows.reduce((a, r) => a + r.totalAgents, 0);

  const totalCalls = rows.reduce((a, r) => a + r.monthCalls, 0);

  // 가중 평균 — 호출량 가중
  const totalWeighted = rows.reduce((a, r) => a + r.monthCalls, 0) || 1;
  const sloWeighted =
    rows.reduce((a, r) => a + r.sloAttainment * r.monthCalls, 0) / totalWeighted;

  const totalCost = rows.reduce((a, r) => a + r.monthCost, 0);
  const totalBudget = rows.reduce((a, r) => a + r.budgetCost, 0);

  const totalSafety = rows.reduce(
    (a, r) => a + r.guardrailBlocks + r.policyViolations,
    0,
  );
  const totalPii = rows.reduce((a, r) => a + r.piiMaskCount, 0);

  const totalPending = rows.reduce((a, r) => a + r.pendingApprovals, 0);

  return {
    totalProjects: total,
    operatingProjects: operating,
    planningProjects: planning,
    totalServingAgents: totalServing,
    totalAgents,
    totalCalls,
    sloAvg: sloWeighted,
    totalCost,
    totalBudget,
    budgetUsedPct: (totalCost / Math.max(1, totalBudget)) * 100,
    totalSafetyEvents: totalSafety,
    totalPiiMasked: totalPii,
    totalPendingApprovals: totalPending,
  };
}

/* ───────── 추가 mock — 4탭 콘텐츠용 ───────── */

/** 전사 30일 일별 호출량 — 전체 프로젝트 합산 시계열. */
export function getDailyCallSeries(rows: ProjectUsageRow[]): number[] {
  const N = 30;
  const out = Array(N).fill(0);
  for (const r of rows) {
    for (let i = 0; i < N; i++) out[i] += r.monthCallsTrend[i] ?? 0;
  }
  return out.map(Math.round);
}

/** 모델별 월 PTU 비용 (KRW). */
export function getModelPtuCost() {
  const usage = getModelPtuUsage();
  return usage.map((m) => ({
    model: m.model,
    ptus: m.allocatedPtus,
    unitPrice: MODEL_PTU_UNIT_PRICE[m.model] ?? 0,
    monthCost: m.allocatedPtus * (MODEL_PTU_UNIT_PRICE[m.model] ?? 0),
    avgUtilizationPct: m.avgUtilizationPct,
  }));
}

/** 전체 월 PTU 비용 합산. */
export function getTotalPtuCost(): number {
  return getModelPtuCost().reduce((a, m) => a + m.monthCost, 0);
}

/* ───────── 비용 탭 전용 helper ───────── */

export interface CostCategory {
  key: 'model_ptu' | 'gpu_onprem' | 'storage' | 'network' | 'observability';
  label: string;
  color: string;
  monthCost: number;
}

/**
 * 인프라 비용 구성 — 모델 PTU 외 GPU 온프렘·스토리지·네트워크·관측을 합산.
 * PTU는 실 데이터, 나머지는 PTU 합 대비 정해진 비율로 추정한 mock 값.
 */
export function getCostBreakdownByCategory(): CostCategory[] {
  const ptu = getTotalPtuCost();
  // PTU(모델 처리량) 외 인프라 비용은 PTU 대비 비율로 추정 — mock.
  const gpuOnprem = Math.round(ptu * 0.18); // 온프렘 GPU 자체 운영비
  const storage = Math.round(ptu * 0.06); // 지식 인덱스·벡터DB·아카이브
  const network = Math.round(ptu * 0.04); // 게이트웨이 트래픽
  const obs = Math.round(ptu * 0.03); // 관측·로깅·감사
  return [
    { key: 'model_ptu', label: '모델 PTU', color: '#5FA69C', monthCost: ptu },
    { key: 'gpu_onprem', label: '온프렘 GPU', color: '#1F5BB8', monthCost: gpuOnprem },
    { key: 'storage', label: '스토리지·벡터DB', color: '#1B8A4D', monthCost: storage },
    { key: 'network', label: '게이트웨이 트래픽', color: '#6E3BBD', monthCost: network },
    { key: 'observability', label: '관측·감사', color: '#6B4F2A', monthCost: obs },
  ];
}

/**
 * 모델별 호출당 평균 비용 (KRW) — 에이전트 단위 비용 추정 시 사용.
 * 모델 PTU 단가 + 평균 토큰 길이를 1회 호출 비용으로 정규화한 mock 값.
 */
export const MODEL_COST_PER_CALL: Record<string, number> = {
  'openai/gpt-oss-120b': 280,
  'azure/gpt-5.5': 220,
  'onprem/sLLM-13b': 95,
  'aws/claude-sonnet-4.6': 450,
  'google/gemma-4-31B-it-assistant': 110,
};

/**
 * 전사 30일 일별 비용 추이.
 * PTU는 고정비라 거의 평탄, 나머지(GPU·스토리지·네트워크·관측)는 사용량에 비례.
 * 사용량 가중치는 일별 호출량 series 기반.
 */
export function getDailyCostSeries(rows: ProjectUsageRow[]): {
  days: string[];
  fixed: number[]; // PTU 고정비
  variable: number[]; // 변동비 (사용량 비례)
  total: number[];
} {
  const days = getDailyLabels();
  const ptuMonth = getTotalPtuCost();
  const fixedDaily = ptuMonth / 30;
  const calls = getDailyCallSeries(rows);
  const callSum = calls.reduce((a, b) => a + b, 0) || 1;

  // 변동비 합계 = PTU 대비 31% (위 카테고리 비율 0.18+0.06+0.04+0.03)
  const variableMonth = ptuMonth * 0.31;

  const fixed: number[] = [];
  const variable: number[] = [];
  const total: number[] = [];
  for (let i = 0; i < 30; i++) {
    const v = (calls[i] / callSum) * variableMonth;
    fixed.push(Math.round(fixedDaily));
    variable.push(Math.round(v));
    total.push(Math.round(fixedDaily + v));
  }
  return { days, fixed, variable, total };
}

/** 시간(0~23) × 요일(0=일 ~ 6=토) 호출 히트맵 — 평균 RPS 기준. */
export function getHourlyHeatmap(): number[][] {
  // 24 x 7 — 그룹 운영 패턴 (평일 9~18시 피크, 주말 약함)
  const out: number[][] = [];
  for (let h = 0; h < 24; h++) {
    const row: number[] = [];
    for (let d = 0; d < 7; d++) {
      const isWeekend = d === 0 || d === 6;
      const business = h >= 9 && h <= 18;
      const lunch = h === 12;
      let v: number;
      if (isWeekend) v = h >= 10 && h <= 21 ? 8 + (h % 5) : 2;
      else if (business) v = lunch ? 38 : 55 + ((h + d) % 12);
      else if (h >= 7 && h <= 22) v = 18 + ((h * d) % 8);
      else v = 4 + ((h + d) % 3);
      row.push(v);
    }
    out.push(row);
  }
  return out;
}

/** 부서별 DAU (사용 현황 탭). */
export interface DeptUsage {
  dept: string;
  dau: number;
  newUsers: number; // 신규(7일)
  returningUsers: number; // 재방문(7일)
}
export const DEPT_USAGE: DeptUsage[] = [
  { dept: '금융상담팀', dau: 4_120, newUsers: 312, returningUsers: 3_808 },
  { dept: '디지털채널부', dau: 2_840, newUsers: 184, returningUsers: 2_656 },
  { dept: 'PB 사업부', dau: 318, newUsers: 12, returningUsers: 306 },
  { dept: '여신지원부', dau: 178, newUsers: 22, returningUsers: 156 },
  { dept: '준법지원부', dau: 0, newUsers: 0, returningUsers: 0 },
];

/** 호출량 전주 대비 급증·급감 Top. */
export interface ChangeRow {
  projectId: string;
  name: string;
  deltaPct: number;
  monthCalls: number;
}
export const TOP_SPIKES: ChangeRow[] = [
  { projectId: 'PRJ-2024-CR-002', name: '여신심사 에이전트 프로젝트', deltaPct: 22.1, monthCalls: 86_400 },
  { projectId: 'PRJ-2025-PB-001', name: 'PB 에이전트 프로젝트', deltaPct: 8.2, monthCalls: 12_000 },
];
export const TOP_DROPS: ChangeRow[] = [
  { projectId: 'PRJ-2024-FC-001', name: '금융상담 에이전트 프로젝트', deltaPct: -3.2, monthCalls: 1_800_000 },
];

/** 전사 활동 피드 (최근 N건). */
export type ActivityKind =
  | 'project_register'
  | 'serv_promotion'
  | 'train_deploy'
  | 'policy_violation'
  | 'incident'
  | 'ptu_change'
  | 'audit';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  who: string;
  at: string;
  href?: string;
}
export const ACTIVITY_FEED: ActivityItem[] = [
  {
    id: 'ACT-1024',
    kind: 'serv_promotion',
    title: 'PB 자산진단 v0.4.2 → 서빙계 프로모션 완료',
    who: '박서연',
    at: '2026-05-24 14:08',
    href: '/projects/PRJ-2025-PB-001',
  },
  {
    id: 'ACT-1023',
    kind: 'ptu_change',
    title: 'openai/gpt-oss-120b PTU 220 → 240 증설',
    who: '김플랫 · 결재 ▶ 2단계 완료',
    at: '2026-05-24 11:42',
  },
  {
    id: 'ACT-1022',
    kind: 'policy_violation',
    title: '금융상담 에이전트 — 외부 추천 발화 가드레일 차단',
    who: 'AGT-072',
    at: '2026-05-24 10:18',
    href: '/projects/PRJ-2024-FC-001',
  },
  {
    id: 'ACT-1021',
    kind: 'project_register',
    title: '자금세탁 방지 에이전트 프로젝트 등록',
    who: '강민호 · 준법지원부',
    at: '2026-05-22 09:18',
    href: '/projects/PRJ-2025-AML-001',
  },
  {
    id: 'ACT-1019',
    kind: 'incident',
    title: 'CS 챗봇 코파일럿 — P95 SLA 5분간 초과 (자동 복구)',
    who: 'AGT-072',
    at: '2026-05-20 14:08',
  },
];

/** PTU 변경 이력 (증설/감설). */
export interface PtuChangeEvent {
  id: string;
  at: string;
  model: string;
  from: number;
  to: number;
  reason: string;
  approver: string;
  costDeltaKrw: number;
}
export const PTU_CHANGE_EVENTS: PtuChangeEvent[] = [
  {
    id: 'PTU-EV-014',
    at: '2026-05-24',
    model: 'openai/gpt-oss-120b',
    from: 220,
    to: 240,
    reason: '피크 사용률 94% 도달 — 사용 현황 탭 알람 기반 증설',
    approver: '김플랫',
    costDeltaKrw: 20_000_000,
  },
  {
    id: 'PTU-EV-013',
    at: '2026-05-18',
    model: 'azure/gpt-5.5',
    from: 140,
    to: 160,
    reason: '여신심사 에이전트 트래픽 증가 대응',
    approver: '김플랫',
    costDeltaKrw: 16_000_000,
  },
  {
    id: 'PTU-EV-012',
    at: '2026-05-09',
    model: 'onprem/sLLM-13b',
    from: 80,
    to: 100,
    reason: 'CS 챗봇 코파일럿 — onprem 비중 확대 전환',
    approver: '강민호',
    costDeltaKrw: 8_000_000,
  },
  {
    id: 'PTU-EV-011',
    at: '2026-05-02',
    model: 'azure/gpt-5.5',
    from: 160,
    to: 140,
    reason: 'PB 프로젝트 호출 안정화 — 평균 효율 38% → 감설',
    approver: '김플랫',
    costDeltaKrw: -16_000_000,
  },
];

/** 안전 이벤트 30일 추이. */
export function getSafetyEventTrend(): {
  days: string[];
  guardrail: number[];
  policy: number[];
  pii: number[];
} {
  // 30일, 시드 기반
  const days = getDailyLabels();
  const guardrail: number[] = [];
  const policy: number[] = [];
  const pii: number[] = [];
  let s = 31;
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    guardrail.push(Math.max(0, Math.round(22 + Math.sin(i / 4) * 8 + (r - 0.5) * 6)));
    policy.push(r > 0.85 ? Math.round((r - 0.85) * 15) : 0);
    pii.push(Math.max(0, Math.round(1100 + Math.sin(i / 6) * 250 + (r - 0.5) * 120)));
  }
  return { days, guardrail, policy, pii };
}

/** 결재 분석 — 종류별 분포. */
export interface ApprovalAnalytics {
  category: '등록' | '학습계' | '서빙계' | '폐기' | '정책' | 'PTU';
  pending: number;
  done7d: number;
  rejected7d: number;
  avgLeadTimeHours: number;
}
export const APPROVAL_ANALYTICS: ApprovalAnalytics[] = [
  { category: '등록', pending: 1, done7d: 4, rejected7d: 0, avgLeadTimeHours: 6.2 },
  { category: '학습계', pending: 2, done7d: 12, rejected7d: 1, avgLeadTimeHours: 4.8 },
  { category: '서빙계', pending: 3, done7d: 6, rejected7d: 2, avgLeadTimeHours: 28.4 },
  { category: '폐기', pending: 0, done7d: 1, rejected7d: 0, avgLeadTimeHours: 11.0 },
  { category: '정책', pending: 2, done7d: 3, rejected7d: 0, avgLeadTimeHours: 18.2 },
  { category: 'PTU', pending: 0, done7d: 2, rejected7d: 0, avgLeadTimeHours: 9.6 },
];

/** 레드팀·산업표준 통과 현황. */
export interface CertificationRow {
  projectId: string;
  name: string;
  redteamPassed: boolean | null;
  industry3Axis: { axis1: boolean; axis2: boolean; axis3: boolean };
  innovDesignationDaysLeft: number | null;
}
export const CERTIFICATIONS: CertificationRow[] = [
  {
    projectId: 'PRJ-2025-PB-001',
    name: 'PB 에이전트 프로젝트',
    redteamPassed: true,
    industry3Axis: { axis1: true, axis2: true, axis3: true },
    innovDesignationDaysLeft: 388,
  },
  {
    projectId: 'PRJ-2024-FC-001',
    name: '금융상담 에이전트 프로젝트',
    redteamPassed: true,
    industry3Axis: { axis1: true, axis2: true, axis3: true },
    innovDesignationDaysLeft: 52, // 만료 임박
  },
  {
    projectId: 'PRJ-2024-CR-002',
    name: '여신심사 에이전트 프로젝트',
    redteamPassed: false,
    industry3Axis: { axis1: true, axis2: true, axis3: false },
    innovDesignationDaysLeft: null,
  },
  {
    projectId: 'PRJ-2024-CS-001',
    name: 'CS 챗봇 코파일럿 프로젝트',
    redteamPassed: true,
    industry3Axis: { axis1: true, axis2: true, axis3: true },
    innovDesignationDaysLeft: null,
  },
  {
    projectId: 'PRJ-2025-AML-001',
    name: '자금세탁 방지 에이전트',
    redteamPassed: null, // 아직 평가 전
    industry3Axis: { axis1: false, axis2: false, axis3: false },
    innovDesignationDaysLeft: null,
  },
];

/** 감사 원장 — 최근 N건 (immutable). */
export interface AuditLogItem {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}
export const AUDIT_LOG: AuditLogItem[] = [
  {
    id: 'AUD-2026-05-24-0042',
    at: '2026-05-24 14:08',
    actor: '김플랫',
    action: '관리 대시보드 진입 (MFA 인증)',
    target: '/admin',
  },
  {
    id: 'AUD-2026-05-24-0041',
    at: '2026-05-24 11:42',
    actor: '김플랫',
    action: 'PTU 증설 결재 승인',
    target: 'openai/gpt-oss-120b 220→240',
  },
  {
    id: 'AUD-2026-05-24-0039',
    at: '2026-05-24 10:21',
    actor: '강민호',
    action: '정책 P-014 예외 신청 반려',
    target: 'EX-2026-014',
  },
  {
    id: 'AUD-2026-05-23-0118',
    at: '2026-05-23 16:55',
    actor: '시스템',
    action: '사번 비활성 처리 (오프보딩 자동)',
    target: 'usr_8920',
  },
  {
    id: 'AUD-2026-05-23-0094',
    at: '2026-05-23 11:08',
    actor: '박서연',
    action: 'Agent 권한 묶음 변경',
    target: 'AGT-204 · 개발 → 운영',
  },
  {
    id: 'AUD-2026-05-22-0212',
    at: '2026-05-22 09:18',
    actor: '강민호',
    action: '프로젝트 신규 등록',
    target: 'PRJ-2025-AML-001',
  },
];

/* ───────── K8s 네임스페이스 단위 인프라 자원 ───────── */

export type NamespaceCategory =
  | 'project'
  | 'system'
  | 'gateway'
  | 'monitoring'
  | 'devops'
  | 'platform';

export interface NamespaceUsage {
  name: string;
  category: NamespaceCategory;
  /** 한 줄 설명. */
  description: string;
  /** Pod 상태별 수. */
  pods: { running: number; pending: number; failed: number };
  /** CPU 사용/한도 (millicores 단위 사용 — 표시 시 m 또는 cores). */
  cpuUsedM: number;
  cpuLimitM: number;
  /** Memory 사용/한도 (MiB). */
  memUsedMiB: number;
  memLimitMiB: number;
  /** 네트워크 in/out (MB/s). */
  netRxMBps: number;
  netTxMBps: number;
  /** 서비스 수. */
  services: number;
  /** 마지막 배포. */
  lastDeploy: string;
}

export const CATEGORY_LABEL: Record<NamespaceCategory, string> = {
  project: '프로젝트',
  system: '시스템',
  gateway: '게이트웨이',
  monitoring: '관제',
  devops: '개발도구',
  platform: '플랫폼',
};

export const CATEGORY_COLOR: Record<NamespaceCategory, string> = {
  project: '#1B8A4D',
  system: '#6B4F2A',
  gateway: '#1F5BB8',
  monitoring: '#C9760F',
  devops: '#5FA69C',
  platform: '#777777',
};

export const NAMESPACES: NamespaceUsage[] = [
  // ─── 프로젝트 네임스페이스 (train + serv 합쳐서 1개) ───
  {
    name: 'pb-agent',
    category: 'project',
    description: 'PB 에이전트 프로젝트 (학습계 + 서빙계) · 담당 김플랫',
    pods: { running: 5, pending: 0, failed: 0 },
    cpuUsedM: 3_200,
    cpuLimitM: 8_000,
    memUsedMiB: 14_400,
    memLimitMiB: 24_576,
    netRxMBps: 12.4,
    netTxMBps: 6.8,
    services: 4,
    lastDeploy: '2026-05-24 14:08',
  },
  {
    name: 'fc-agent',
    category: 'project',
    description: '금융상담 에이전트 프로젝트 · 담당 한지수',
    pods: { running: 24, pending: 1, failed: 0 },
    cpuUsedM: 18_400,
    cpuLimitM: 32_000,
    memUsedMiB: 62_800,
    memLimitMiB: 81_920,
    netRxMBps: 142.6,
    netTxMBps: 78.4,
    services: 10,
    lastDeploy: '2026-05-24 14:48',
  },
  {
    name: 'cr-agent',
    category: 'project',
    description: '여신심사 에이전트 프로젝트 · 담당 박서연',
    pods: { running: 8, pending: 0, failed: 0 },
    cpuUsedM: 5_400,
    cpuLimitM: 12_000,
    memUsedMiB: 18_400,
    memLimitMiB: 32_768,
    netRxMBps: 22.4,
    netTxMBps: 12.1,
    services: 5,
    lastDeploy: '2026-05-24 11:02',
  },
  {
    name: 'cs-agent',
    category: 'project',
    description: 'CS 챗봇 코파일럿 프로젝트 · 담당 정수민',
    pods: { running: 18, pending: 0, failed: 0 },
    cpuUsedM: 12_800,
    cpuLimitM: 24_000,
    memUsedMiB: 42_400,
    memLimitMiB: 65_536,
    netRxMBps: 96.4,
    netTxMBps: 48.2,
    services: 8,
    lastDeploy: '2026-05-24 14:55',
  },
  {
    name: 'aml-agent',
    category: 'project',
    description: '자금세탁 방지 에이전트 (개발 중) · 담당 강민호',
    pods: { running: 2, pending: 0, failed: 1 },
    cpuUsedM: 800,
    cpuLimitM: 4_000,
    memUsedMiB: 2_400,
    memLimitMiB: 8_192,
    netRxMBps: 1.2,
    netTxMBps: 0.4,
    services: 1,
    lastDeploy: '2026-05-22 09:18',
  },
  // ─── 플랫폼 공통 네임스페이스 ───
  {
    name: 'aip-gateway',
    category: 'gateway',
    description: 'LLM Gateway · PTU 라우터 · 가드레일',
    pods: { running: 14, pending: 0, failed: 0 },
    cpuUsedM: 12_800,
    cpuLimitM: 20_000,
    memUsedMiB: 28_400,
    memLimitMiB: 49_152,
    netRxMBps: 412.4,
    netTxMBps: 388.2,
    services: 8,
    lastDeploy: '2026-05-24 11:42',
  },
  {
    name: 'aip-mon',
    category: 'monitoring',
    description: 'Prometheus · Grafana · Loki · Alertmanager',
    pods: { running: 18, pending: 0, failed: 0 },
    cpuUsedM: 6_400,
    cpuLimitM: 12_000,
    memUsedMiB: 32_700,
    memLimitMiB: 49_152,
    netRxMBps: 28.4,
    netTxMBps: 12.1,
    services: 10,
    lastDeploy: '2026-05-20 09:18',
  },
  {
    name: 'ingress-nginx',
    category: 'platform',
    description: '외부 트래픽 진입점 (Ingress + cert-manager)',
    pods: { running: 3, pending: 0, failed: 0 },
    cpuUsedM: 800,
    cpuLimitM: 2_000,
    memUsedMiB: 1_800,
    memLimitMiB: 4_096,
    netRxMBps: 488.4,
    netTxMBps: 412.2,
    services: 2,
    lastDeploy: '2026-05-10 14:00',
  },
  {
    name: 'kube-system',
    category: 'system',
    description: 'CoreDNS · kube-proxy · CNI · CSI 등',
    pods: { running: 28, pending: 0, failed: 0 },
    cpuUsedM: 2_400,
    cpuLimitM: 8_000,
    memUsedMiB: 6_200,
    memLimitMiB: 16_384,
    netRxMBps: 4.2,
    netTxMBps: 3.1,
    services: 8,
    lastDeploy: '2026-04-22 10:00',
  },
];

/** K8s Deployment 단위 워크로드. */
export type DeploymentStatus = 'Healthy' | 'Updating' | 'Degraded' | 'Failed';

export interface Deployment {
  namespace: string;
  name: string;
  replicasReady: number;
  replicasDesired: number;
  image: string;
  imageTag: string;
  age: string;
  status: DeploymentStatus;
}

export const DEPLOYMENTS: Deployment[] = [
  // === 시스템 네임스페이스 ===
  // aip-gateway
  { namespace: 'aip-gateway', name: 'gateway-router', replicasReady: 4, replicasDesired: 4, image: 'aip/gateway-router', imageTag: 'v2.4.1', age: '12d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'guardrail-engine', replicasReady: 3, replicasDesired: 3, image: 'aip/guardrail', imageTag: 'v1.8.2', age: '8d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'ptu-balancer', replicasReady: 3, replicasDesired: 3, image: 'aip/ptu-balancer', imageTag: 'v0.9.4', age: '5d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'rate-limiter', replicasReady: 2, replicasDesired: 2, image: 'aip/rate-limiter', imageTag: 'v1.2.0', age: '21d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'pii-mask-sidecar', replicasReady: 2, replicasDesired: 2, image: 'aip/pii-mask', imageTag: 'v0.6.1', age: '5d', status: 'Healthy' },
  // aip-mon
  { namespace: 'aip-mon', name: 'prometheus', replicasReady: 1, replicasDesired: 1, image: 'prom/prometheus', imageTag: 'v2.51', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'grafana', replicasReady: 1, replicasDesired: 1, image: 'grafana/grafana', imageTag: '10.4.2', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'loki', replicasReady: 1, replicasDesired: 1, image: 'grafana/loki', imageTag: '3.0.0', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'alertmanager', replicasReady: 1, replicasDesired: 1, image: 'prom/alertmanager', imageTag: 'v0.27', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'node-exporter', replicasReady: 14, replicasDesired: 14, image: 'prom/node-exporter', imageTag: 'v1.8.1', age: '45d', status: 'Healthy' },
  // ingress-nginx
  { namespace: 'ingress-nginx', name: 'ingress-nginx-controller', replicasReady: 3, replicasDesired: 3, image: 'ingress-nginx', imageTag: 'v1.10.1', age: '62d', status: 'Healthy' },
  // kube-system
  { namespace: 'kube-system', name: 'coredns', replicasReady: 2, replicasDesired: 2, image: 'k8s/coredns', imageTag: '1.11.1', age: '180d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'kube-proxy', replicasReady: 14, replicasDesired: 14, image: 'k8s/kube-proxy', imageTag: 'v1.29.4', age: '180d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'calico-node', replicasReady: 14, replicasDesired: 14, image: 'calico/node', imageTag: 'v3.27.3', age: '180d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'csi-nfs-driver', replicasReady: 14, replicasDesired: 14, image: 'k8s/csi-nfs', imageTag: 'v4.6.0', age: '120d', status: 'Healthy' },
  // === 프로젝트 네임스페이스 ===
  // pb-agent
  { namespace: 'pb-agent', name: 'pb-agent-serv', replicasReady: 3, replicasDesired: 3, image: 'aip/pb-agent', imageTag: 'v0.4.2-serv', age: '4d', status: 'Healthy' },
  { namespace: 'pb-agent', name: 'pb-agent-train', replicasReady: 2, replicasDesired: 2, image: 'aip/pb-agent', imageTag: 'v0.4.2-train', age: '4d', status: 'Healthy' },
  // fc-agent
  { namespace: 'fc-agent', name: 'fc-agent-serv', replicasReady: 12, replicasDesired: 12, image: 'aip/fc-agent', imageTag: 'v3.2.1-serv', age: '6d', status: 'Healthy' },
  { namespace: 'fc-agent', name: 'fc-agent-train', replicasReady: 5, replicasDesired: 6, image: 'aip/fc-agent', imageTag: 'v3.3.0-train', age: '1d', status: 'Updating' },
  { namespace: 'fc-agent', name: 'fc-rag-builder', replicasReady: 4, replicasDesired: 4, image: 'aip/rag-builder', imageTag: 'v2.1.0', age: '14d', status: 'Healthy' },
  { namespace: 'fc-agent', name: 'fc-eval-runner', replicasReady: 2, replicasDesired: 2, image: 'aip/eval-runner', imageTag: 'v1.4.0', age: '6d', status: 'Healthy' },
  // cr-agent
  { namespace: 'cr-agent', name: 'cr-agent-serv', replicasReady: 4, replicasDesired: 4, image: 'aip/cr-agent', imageTag: 'v0.8.3-serv', age: '7d', status: 'Healthy' },
  { namespace: 'cr-agent', name: 'cr-agent-train', replicasReady: 2, replicasDesired: 2, image: 'aip/cr-agent', imageTag: 'v0.8.3-train', age: '7d', status: 'Healthy' },
  { namespace: 'cr-agent', name: 'cr-doc-extract', replicasReady: 2, replicasDesired: 2, image: 'aip/doc-extract', imageTag: 'v1.0.0', age: '14d', status: 'Healthy' },
  // cs-agent
  { namespace: 'cs-agent', name: 'cs-agent-serv', replicasReady: 8, replicasDesired: 8, image: 'aip/cs-agent', imageTag: 'v2.1.4-serv', age: '3d', status: 'Healthy' },
  { namespace: 'cs-agent', name: 'cs-agent-train', replicasReady: 4, replicasDesired: 4, image: 'aip/cs-agent', imageTag: 'v2.1.4-train', age: '3d', status: 'Healthy' },
  { namespace: 'cs-agent', name: 'cs-eval-runner', replicasReady: 4, replicasDesired: 4, image: 'aip/eval-runner', imageTag: 'v1.4.0', age: '6d', status: 'Healthy' },
  { namespace: 'cs-agent', name: 'cs-feedback-loop', replicasReady: 2, replicasDesired: 2, image: 'aip/feedback-loop', imageTag: 'v0.3.1', age: '12d', status: 'Healthy' },
  // aml-agent (개발 중)
  { namespace: 'aml-agent', name: 'aml-agent-train', replicasReady: 2, replicasDesired: 3, image: 'aip/aml-agent', imageTag: 'v0.1.0-dev', age: '2d', status: 'Updating' },
  { namespace: 'aml-agent', name: 'aml-eval-runner', replicasReady: 0, replicasDesired: 1, image: 'aip/eval-runner', imageTag: 'v1.4.0', age: '2d', status: 'Failed' },
];

/** 클러스터 24h CPU·Memory 사용률 시계열. */
export function getClusterUtilSeries(): { cpu: number[]; memory: number[]; hours: string[] } {
  const cpu: number[] = [];
  const memory: number[] = [];
  const hours: string[] = [];
  let s = 137;
  for (let h = 0; h < 24; h++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    s = (s * 9301 + 49297) % 233280;
    const r2 = s / 233280;
    const businessHr = h >= 9 && h <= 18;
    const base = businessHr ? 62 : 38;
    cpu.push(Math.max(15, Math.min(92, Math.round(base + Math.sin(h / 4) * 8 + (r - 0.5) * 14))));
    memory.push(Math.max(35, Math.min(88, Math.round(base + 12 + Math.sin(h / 5) * 6 + (r2 - 0.5) * 10))));
    hours.push(`${String(h).padStart(2, '0')}시`);
  }
  return { cpu, memory, hours };
}

/** 프로젝트별 안전 이벤트(PII + 가드레일 차단) 30일 시계열. */
export interface ProjectSafetySeries {
  projectId: string;
  name: string;
  /** 30일 일별 PII 마스킹 건수. */
  piiDaily: number[];
  /** 30일 일별 가드레일 차단 건수. */
  guardrailDaily: number[];
  /** 합산 (시각화에 사용). */
  totalDaily: number[];
  color: string;
}
export function getProjectSafetySeries(rows: ProjectUsageRow[]): ProjectSafetySeries[] {
  const palette = ['#5FA69C', '#1F5BB8', '#1B8A4D', '#6E3BBD', '#C9760F', '#6B4F2A'];
  return rows
    .filter((r) => r.guardrailBlocks + r.piiMaskCount > 0)
    .map((r, i) => {
      let s = (r.id.charCodeAt(0) + r.id.charCodeAt(r.id.length - 1)) * 23 + i * 11 + 1;
      const piiDaily: number[] = [];
      const guardrailDaily: number[] = [];
      const totalDaily: number[] = [];
      // 7일 누적값을 30일에 분포
      const piiBase = r.piiMaskCount / 7;
      const grBase = r.guardrailBlocks / 7;
      const piiAmp = Math.max(piiBase * 0.25, 5);
      const grAmp = Math.max(grBase * 0.3, 1);
      for (let d = 0; d < 30; d++) {
        s = (s * 9301 + 49297) % 233280;
        const r2 = s / 233280;
        s = (s * 9301 + 49297) % 233280;
        const r3 = s / 233280;
        const pii = Math.max(0, Math.round(piiBase + Math.sin(d / 5 + i) * piiAmp * 0.5 + (r2 - 0.5) * piiAmp));
        const gr = Math.max(0, Math.round(grBase + Math.sin(d / 4 + i + 1) * grAmp * 0.5 + (r3 - 0.5) * grAmp));
        piiDaily.push(pii);
        guardrailDaily.push(gr);
        totalDaily.push(pii + gr);
      }
      return {
        projectId: r.id,
        name: r.name,
        piiDaily,
        guardrailDaily,
        totalDaily,
        color: palette[i % palette.length],
      };
    })
    .sort((a, b) => b.totalDaily[b.totalDaily.length - 1] - a.totalDaily[a.totalDaily.length - 1]);
}

/** 에이전트별 PII 적용 정책. */
export type PiiAction = 'mask' | 'block' | 'off';
export interface AgentPiiPolicy {
  agentId: string;
  agentName: string;
  projectId: string;
  projectName: string;
  items: Record<string, PiiAction>;
  /** 7일 누계 발생 건수. */
  count7d: number;
}

export const PII_CATEGORIES: { code: string; label: string }[] = [
  { code: 'RRN', label: '주민등록번호' },
  { code: 'ACCT', label: '계좌번호' },
  { code: 'CARD', label: '카드번호' },
  { code: 'PHONE', label: '휴대폰' },
  { code: 'EMAIL', label: '이메일' },
  { code: 'ADDR', label: '주소' },
  { code: 'PASS', label: '여권번호' },
  { code: 'DRV', label: '운전면허' },
];

export const AGENT_PII_POLICIES: AgentPiiPolicy[] = [
  {
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    projectId: 'PRJ-2025-PB-001',
    projectName: 'PB 에이전트 프로젝트',
    count7d: 218,
    items: { RRN: 'block', ACCT: 'mask', CARD: 'off', PHONE: 'mask', EMAIL: 'off', ADDR: 'mask', PASS: 'off', DRV: 'off' },
  },
  {
    agentId: 'AGT-411',
    agentName: '금융상담 챗봇',
    projectId: 'PRJ-2024-FC-001',
    projectName: '금융상담 에이전트 프로젝트',
    count7d: 4220,
    items: { RRN: 'block', ACCT: 'mask', CARD: 'mask', PHONE: 'mask', EMAIL: 'mask', ADDR: 'mask', PASS: 'mask', DRV: 'mask' },
  },
  {
    agentId: 'AGT-512',
    agentName: '여신심사 보조 에이전트',
    projectId: 'PRJ-2024-CR-002',
    projectName: '여신심사 에이전트 프로젝트',
    count7d: 304,
    items: { RRN: 'block', ACCT: 'mask', CARD: 'off', PHONE: 'mask', EMAIL: 'off', ADDR: 'mask', PASS: 'off', DRV: 'mask' },
  },
  {
    agentId: 'AGT-621',
    agentName: 'CS 챗봇 코파일럿',
    projectId: 'PRJ-2024-CS-001',
    projectName: 'CS 챗봇 코파일럿 프로젝트',
    count7d: 2180,
    items: { RRN: 'block', ACCT: 'mask', CARD: 'mask', PHONE: 'mask', EMAIL: 'mask', ADDR: 'mask', PASS: 'off', DRV: 'off' },
  },
  {
    agentId: 'AGT-701',
    agentName: '자금세탁 방지 에이전트',
    projectId: 'PRJ-2025-AML-001',
    projectName: '자금세탁 방지 에이전트',
    count7d: 0,
    items: { RRN: 'block', ACCT: 'block', CARD: 'mask', PHONE: 'mask', EMAIL: 'off', ADDR: 'off', PASS: 'block', DRV: 'off' },
  },
];

/** 프로젝트별 일별 DAU 30일 시계열. */
export interface ProjectDauSeries {
  projectId: string;
  name: string;
  daily: number[];
  color: string;
}
export function getProjectDauSeries(rows: ProjectUsageRow[]): ProjectDauSeries[] {
  const palette = ['#5FA69C', '#1F5BB8', '#1B8A4D', '#6E3BBD', '#C9760F', '#6B4F2A'];
  return rows
    .filter((r) => r.dau > 0)
    .map((r, i) => {
      let s = (r.id.charCodeAt(0) + r.id.charCodeAt(r.id.length - 1)) * 17 + i * 7 + 1;
      const daily: number[] = [];
      const base = r.dau;
      const amp = Math.max(base * 0.22, 8);
      const drift = base * 0.08; // 30일 동안 약간 증가 추세
      for (let d = 0; d < 30; d++) {
        s = (s * 9301 + 49297) % 233280;
        const r2 = s / 233280;
        const v =
          base * 0.9 +
          Math.sin((d / 30) * Math.PI * 2 + i) * amp * 0.45 +
          (r2 - 0.5) * amp +
          drift * (d / 30);
        daily.push(Math.max(0, Math.round(v)));
      }
      return { projectId: r.id, name: r.name, daily, color: palette[i % palette.length] };
    })
    .sort((a, b) => b.daily[b.daily.length - 1] - a.daily[a.daily.length - 1]);
}

/** 계열사별 토큰 사용량 30일 시계열 (입력+출력 합산, M 단위). */
export interface ConglomerateTokenSeries {
  name: string;
  /** 30일 일별 토큰 사용량 (단위: tokens). */
  daily: number[];
  /** 30일 합산. */
  total: number;
  color: string;
}

export function getConglomerateTokenSeries(): ConglomerateTokenSeries[] {
  const N = 30;
  const config = [
    { name: '부산은행', base: 42_000_000, amp: 8_000_000, drift: 3_000_000, color: '#5FA69C', seed: 11 },
    { name: '경남은행', base: 24_000_000, amp: 5_000_000, drift: 1_500_000, color: '#1F5BB8', seed: 23 },
    { name: 'BNK투자증권', base: 12_000_000, amp: 3_000_000, drift: 800_000, color: '#1B8A4D', seed: 31 },
    { name: 'BNK캐피탈', base: 6_000_000, amp: 1_400_000, drift: 400_000, color: '#6E3BBD', seed: 43 },
    { name: 'BNK저축은행', base: 2_400_000, amp: 600_000, drift: 200_000, color: '#C9760F', seed: 53 },
  ];
  return config.map((c) => {
    let s = c.seed;
    const daily: number[] = [];
    for (let i = 0; i < N; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      const v =
        c.base +
        Math.sin((i / N) * Math.PI * 2 + c.seed) * c.amp * 0.45 +
        (r - 0.5) * c.amp +
        c.drift * (i / N);
      daily.push(Math.max(0, Math.round(v)));
    }
    return {
      name: c.name,
      daily,
      total: daily.reduce((a, b) => a + b, 0),
      color: c.color,
    };
  });
}

/** on-prem GPU 자원 점유율 시계열 (30일). */
export function getOnpremGpuUtilSeries(): number[] {
  let s = 91;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    out.push(Math.max(20, Math.min(95, +(62 + Math.sin(i / 5) * 14 + (r - 0.5) * 10).toFixed(1))));
  }
  return out;
}

/* ───────── 계열사·에이전트 단위 비용 ───────── */

export interface ConglomerateCostRow {
  name: string;
  color: string;
  monthTokens: number;
  monthCost: number;
  pct: number;
  agentCount: number;
}

/**
 * 계열사별 월 비용 — 토큰 점유율 기반 분배.
 * 전사 인프라 합계(= PTU 고정비 × 1.31) × 토큰 점유율.
 */
export function getCostByConglomerate(): ConglomerateCostRow[] {
  const series = getConglomerateTokenSeries();
  const totalTokens = series.reduce((a, s) => a + s.total, 0) || 1;
  const totalCost = getTotalPtuCost() * 1.31; // PTU + 변동비

  // 카탈로그에서 계열사별 운영·실행 중 에이전트 수 계산은 mockCatalogAgents 의존이라
  // 여기선 시드 기반 추정치로만 채움 (소비처에서 더 정확히 덮어쓸 수 있음).
  const agentCountByTenant: Record<string, number> = {
    부산은행: 5,
    경남은행: 2,
    BNK투자증권: 1,
    BNK캐피탈: 1,
    BNK저축은행: 0,
  };

  return series.map((s) => ({
    name: s.name,
    color: s.color,
    monthTokens: s.total,
    monthCost: Math.round((s.total / totalTokens) * totalCost),
    pct: (s.total / totalTokens) * 100,
    agentCount: agentCountByTenant[s.name] ?? 0,
  }));
}

export interface AgentCostRow {
  id: string;
  name: string;
  tenant: string;
  projectId: string;
  projectName: string;
  mainModel: string;
  state: '운영 중' | '실행 중' | '계획' | '보류';
  monthCalls: number;
  monthCost: number;
  costPerCall: number;
}

/**
 * 에이전트별 월 비용 — `callsWeekly × 4.3 × 모델별 호출 단가`.
 * 계획 상태(0 호출)는 제외. 비용 내림차순.
 */
export function getCostByAgent(): AgentCostRow[] {
  return MOCK_CATALOG_AGENTS
    .filter((a) => a.callsWeekly > 0)
    .map((a) => {
      const unit = MODEL_COST_PER_CALL[a.mainModel] ?? 200;
      const monthCalls = Math.round(a.callsWeekly * 4.3);
      const monthCost = Math.round(monthCalls * unit);
      return {
        id: a.id,
        name: a.name,
        tenant: a.tenant,
        projectId: a.projectId,
        projectName: a.projectName,
        mainModel: a.mainModel,
        state: a.state,
        monthCalls,
        monthCost,
        costPerCall: unit,
      };
    })
    .sort((a, b) => b.monthCost - a.monthCost);
}
