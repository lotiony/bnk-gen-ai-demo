/**
 * 플랫폼 관리자 대시보드 mock.
 *
 * RFP 2-1 관리자 포털 [34] "플랫폼 사용 현황 대시보드 화면 제공 (Export 기능 포함)"
 * RFP 2-1 관리자 포털 [36] "GPU/CPU 자원 현황 및 자원 정책 관리"
 * RFP LSM-010 · ONM-005 (미터링·정산과 같은 원장을 쓴다)
 *
 * ════════════════════════════════════════════════════════════════════
 * 이 파일의 세 가지 원칙 — 어기면 화면끼리 다른 말을 하게 된다
 * ════════════════════════════════════════════════════════════════════
 *
 * ① **'프로젝트'라는 계층은 없다.** RFP 관리자 포털 구축범위가 쓰는 단위는
 *    `과제` 하나뿐이다("과제 관리 화면: 계열사별 과제 등록·검토·결재·이행
 *    모니터링, 과제별 자원·비용 현황"). 이 파일은 자체 과제 목록을 갖지 않고
 *    `mockAdminTasks.ADMIN_TASKS` 원장을 그대로 읽어 파생한다.
 *
 * ② **수치를 손으로 적지 않는다.** 호출·토큰·비용·에이전트 수는 전부
 *    `mockCatalogAgents`(계열사 자산 13종) + `mockGroupAgents`(AGB-006 공통 10종)
 *    = 23종에서 파생한다. 두 파일은 **읽기 전용**이다. 예전 버전은 여기에 월
 *    호출량을 직접 적어 두어 소속 에이전트 실측 합과 최대 98배까지 어긋났고,
 *    "플랫폼 전체 에이전트 수"가 화면마다 6/13/47/54 로 달랐다.
 *
 * ③ **PTU 는 이 사업에 존재하지 않는다.** PTU(Provisioned Throughput Unit)는
 *    Azure OpenAI 류 클라우드 SaaS 의 처리용량 예약 단위다. 본 사업은 공동존
 *    On-Premise BareMetal K8s 에 GPU 를 직접 조달하는 구조이므로 용량 단위는
 *    **GPU 장(card)** 이고 비용 단위는 **GPU-hour** 다. 고정비(GPU 감가상각·상면·
 *    전력·운영)를 가중 토큰 점유율로 계열사에 배분하는 방식은 미터링 화면
 *    (`mockMetering.BILLING_RULES`)과 동일하다 — 두 화면이 같은 과금 모델을
 *    말해야 한다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

import { MOCK_CATALOG_AGENTS } from './mockCatalogAgents';
import { GROUP_AGENTS } from './mockGroupAgents';
import { ADMIN_TASKS, type AdminTask } from './mockAdminTasks';
import { TENANTS, AFFILIATES } from './tenants';

/** 대시보드 기준 시각 — 통합 감사 원장(mockSecurityGovernance)의 최신 행과 맞춘다. */
export const DASHBOARD_TODAY = '2026-06-03';
const TODAY_DATE = new Date(`${DASHBOARD_TODAY}T00:00:00`);

/** 주간 호출 → 월(30일) 환산 계수. 미터링(`getAgentRows`)과 같은 값이어야 한다. */
export const WEEKS_PER_MONTH = 4.3;

/** 출력 토큰 가중치 — 생성이 입력 처리보다 GPU 를 더 쓴다. 정산 규칙과 같은 값. */
export const OUTPUT_TOKEN_WEIGHT = 3;

/* ═══════════════════════════════════════════════════════════════
 * 0) 에이전트 인덱스 — 플랫폼 전체 에이전트의 단일 출처
 * ═══════════════════════════════════════════════════════════════ */

/**
 * 모델별 1회 호출 평균 토큰. 계측 스키마상 실측치가 들어올 자리이며,
 * 데모에서는 업무 성격(조회형 vs 생성형)에 따른 고정 계수로 둔다.
 */
const MODEL_TOKENS_PER_CALL: Record<string, { input: number; output: number }> = {
  'onprem/gpt-oss-120b': { input: 2400, output: 620 },
  'onprem/qwen3-32b': { input: 1800, output: 480 },
  'onprem/llama-3.3-70b': { input: 3200, output: 700 },
  'google/gemma-4-31B-it-assistant': { input: 900, output: 320 },
  'Whisper-Large-KO + onprem/gpt-oss-120b': { input: 5200, output: 900 },
};
const DEFAULT_TOKENS_PER_CALL = { input: 1800, output: 500 };

/** 모델별 P95 기본값(ms) — 카탈로그에 p95 가 없는 그룹 공통 에이전트에 쓴다. */
const MODEL_P95_MS: Record<string, number> = {
  'onprem/gpt-oss-120b': 2100,
  'onprem/qwen3-32b': 1750,
  'onprem/llama-3.3-70b': 3800,
  'google/gemma-4-31B-it-assistant': 980,
  'Whisper-Large-KO + onprem/gpt-oss-120b': 5400,
};

/** 이 모델이 올라가는 GPU 등급의 시간당 배분 단가(원/GPU-hour). */
export const MODEL_GPU_HOUR_PRICE: Record<string, number> = {
  'onprem/gpt-oss-120b': 5_600, // H100 80GB 등급 (감가상각 + 상면 + 전력 + 운영)
  'onprem/qwen3-32b': 3_400, // L40S 등급
  'google/gemma-4-31B-it-assistant': 2_800, // L40S 등급 · 경량 서빙
};
/** 1개월 = 30일 × 24시간. */
export const GPU_HOURS_PER_MONTH = 720;

export interface PlatformAgent {
  id: string;
  name: string;
  /** 제작 주관 계열사. */
  tenant: string;
  /** 그룹 공통 운영영역에 배포되어 10개 계열사가 공용하는가. */
  groupShared: boolean;
  model: string;
  callsWeekly: number;
  monthCalls: number;
  monthTokenInput: number;
  monthTokenOutput: number;
  p95Ms: number;
  /** 운영계에 실제로 떠 있는가. */
  serving: boolean;
  /** PII 발생률 산정용 민감도 1~4. */
  sensitivity: number;
}

function tokensOf(model: string) {
  return MODEL_TOKENS_PER_CALL[model] ?? DEFAULT_TOKENS_PER_CALL;
}

/**
 * 플랫폼 전체 에이전트 = 계열사 자산(13) + AGB-006 그룹 공통 Use Case(10) = **23종**.
 * 대시보드 KPI·미터링·정산의 "에이전트 수"는 전부 이 배열에서 나온다.
 */
export const PLATFORM_AGENTS: PlatformAgent[] = [
  ...MOCK_CATALOG_AGENTS.map((a) => {
    const t = tokensOf(a.mainModel);
    const monthCalls = Math.round(a.callsWeekly * WEEKS_PER_MONTH);
    return {
      id: a.id,
      name: a.name,
      tenant: a.tenant as string,
      groupShared: a.tenant === '그룹 공통',
      model: a.mainModel,
      callsWeekly: a.callsWeekly,
      monthCalls,
      monthTokenInput: monthCalls * t.input,
      monthTokenOutput: monthCalls * t.output,
      p95Ms: a.p95Ms ?? MODEL_P95_MS[a.mainModel] ?? 2000,
      serving: a.stage === '운영계',
      sensitivity: a.sensitivity as number,
    };
  }),
  ...GROUP_AGENTS.map((g) => {
    const t = tokensOf(g.model);
    const monthCalls = Math.round(g.callsWeekly * WEEKS_PER_MONTH);
    return {
      id: g.id,
      name: g.name,
      tenant: g.ownerTenant,
      // GRP-* 은 정의상 ns-group-common 에 배포되어 10개 계열사 전 임직원이 호출한다.
      groupShared: true,
      model: g.model,
      callsWeekly: g.callsWeekly,
      monthCalls,
      monthTokenInput: monthCalls * t.input,
      monthTokenOutput: monthCalls * t.output,
      p95Ms: MODEL_P95_MS[g.model] ?? 2000,
      serving: g.status === '운영 중',
      sensitivity: 3,
    };
  }),
];

export const AGENT_BY_ID: Record<string, PlatformAgent> = PLATFORM_AGENTS.reduce(
  (acc, a) => ({ ...acc, [a.id]: a }),
  {} as Record<string, PlatformAgent>,
);

/** 계열사별 임직원 수 — 그룹 공통 에이전트 사용량을 계열사에 배분하는 가중치. */
export const AFFILIATE_HEADCOUNT: Record<string, number> = {
  부산은행: 4820,
  경남은행: 3140,
  BNK캐피탈: 780,
  BNK투자증권: 640,
  BNK저축은행: 310,
  BNK자산운용: 190,
  BNK벤처투자: 90,
  BNK시스템: 520,
  BNK신용정보: 240,
  BNK엘앤에스: 160,
};

/* ═══════════════════════════════════════════════════════════════
 * 1) 모델 서빙 GPU 할당 — On-Prem 자원 단위
 *
 * 예전 버전은 이 자리에 PTU 를 두고 "모델별 월 PTU 단가"까지 정의했다.
 * PTU 는 클라우드 SaaS 의 처리용량 예약 상품이라 공동존 On-Prem BareMetal
 * 구조에는 존재하지 않는다. 여기서는 **GPU 장 수 × GPU-hour 단가**로 바꾼다.
 * 장 수는 과제 원장(`gpuCards`)의 합이므로 자원 정책 화면·과제 관리 화면과
 * 정확히 일치한다.
 * ═══════════════════════════════════════════════════════════════ */

export interface ModelGpuAllocation {
  model: string;
  /** 이 모델 서빙에 배정된 GPU 장 수 = 해당 모델을 주력으로 쓰는 과제들의 gpuCards 합. */
  allocatedGpus: number;
  /** 월 GPU-hour = 장 수 × 720h. */
  gpuHoursMonth: number;
  /** 30일 일별 GPU 점유율(%). 100%면 배정 한도 포화. */
  dailyUtilizationPct: number[];
  avgUtilizationPct: number;
  peakUtilizationPct: number;
  currentUtilizationPct: number;
}

function gpuSeries(seed: number, base: number, amp: number, drift = 0): number[] {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const v =
      base + Math.sin((i / 30) * Math.PI * 2 + seed) * amp * 0.45 + (r - 0.5) * amp + drift * (i / 30);
    out.push(Math.max(2, Math.min(98, +v.toFixed(1))));
  }
  return out;
}

function summarize(series: number[]) {
  const avg = series.reduce((a, b) => a + b, 0) / series.length;
  const peak = Math.max(...series);
  return { avg: +avg.toFixed(1), peak: +peak.toFixed(1), current: series[series.length - 1] };
}

/** 모델별 GPU 점유 곡선 시드 — 모델마다 곡선이 구분되도록. */
const GPU_CURVE: Record<string, { seed: number; base: number; amp: number; drift: number }> = {
  'onprem/gpt-oss-120b': { seed: 29, base: 76, amp: 18, drift: 6 },
  'onprem/qwen3-32b': { seed: 11, base: 62, amp: 22, drift: 8 },
  'google/gemma-4-31B-it-assistant': { seed: 47, base: 48, amp: 14, drift: 4 },
};

export function getModelGpuAllocation(): ModelGpuAllocation[] {
  // 장 수는 과제 원장에서 나온다 — 자원 정책·과제 상세와 같은 숫자여야 한다.
  const byModel = new Map<string, number>();
  for (const t of ADMIN_TASKS) {
    if (t.gpuCards === 0) continue;
    byModel.set(t.primaryModel, (byModel.get(t.primaryModel) ?? 0) + t.gpuCards);
  }
  return Array.from(byModel.entries())
    .map(([model, gpus]) => {
      const c = GPU_CURVE[model] ?? { seed: 61, base: 55, amp: 16, drift: 3 };
      const series = gpuSeries(c.seed, c.base, c.amp, c.drift);
      const s = summarize(series);
      return {
        model,
        allocatedGpus: gpus,
        gpuHoursMonth: gpus * GPU_HOURS_PER_MONTH,
        dailyUtilizationPct: series,
        avgUtilizationPct: s.avg,
        peakUtilizationPct: s.peak,
        currentUtilizationPct: s.current,
      };
    })
    .sort((a, b) => b.allocatedGpus - a.allocatedGpus);
}

/** 모델별 월 GPU 비용 (KRW) = GPU-hour × 등급 단가. */
export function getModelGpuCost() {
  return getModelGpuAllocation().map((m) => ({
    model: m.model,
    gpus: m.allocatedGpus,
    gpuHours: m.gpuHoursMonth,
    unitPrice: MODEL_GPU_HOUR_PRICE[m.model] ?? 0,
    monthCost: m.gpuHoursMonth * (MODEL_GPU_HOUR_PRICE[m.model] ?? 0),
    avgUtilizationPct: m.avgUtilizationPct,
  }));
}

/** 모델 서빙 GPU 월 고정비 합산. */
export function getTotalGpuCost(): number {
  return getModelGpuCost().reduce((a, m) => a + m.monthCost, 0);
}

/** 전사 배정 GPU 장 수 — 과제 원장 합계. */
export function getTotalAllocatedGpus(): number {
  return ADMIN_TASKS.reduce((a, t) => a + t.gpuCards, 0);
}

/* ═══════════════════════════════════════════════════════════════
 * 2) 비용 구성
 * ═══════════════════════════════════════════════════════════════ */

export interface CostCategory {
  key: 'model_gpu' | 'gpu_platform' | 'storage' | 'network' | 'observability';
  label: string;
  color: string;
  monthCost: number;
}

/**
 * 인프라 비용 구성 — 모델 서빙 GPU 고정비 외 학습·평가 공용 GPU·스토리지·
 * 네트워크·관측. 서빙 GPU 는 과제 원장에서 파생된 값이고, 나머지는 그 대비
 * 비율 추정이다.
 */
export function getCostBreakdownByCategory(): CostCategory[] {
  const gpu = getTotalGpuCost();
  const platformGpu = Math.round(gpu * 0.18); // 개발계·평가·임베딩 등 공용 GPU
  const storage = Math.round(gpu * 0.06); // 지식 인덱스·벡터DB·아카이브
  const network = Math.round(gpu * 0.04); // 게이트웨이 트래픽
  const obs = Math.round(gpu * 0.03); // 관측·로깅·감사
  return [
    { key: 'model_gpu', label: '모델 서빙 GPU', color: '#CB2C10', monthCost: gpu },
    { key: 'gpu_platform', label: '학습·평가 공용 GPU', color: '#1F5BB8', monthCost: platformGpu },
    { key: 'storage', label: '스토리지·벡터DB', color: '#1B8A4D', monthCost: storage },
    { key: 'network', label: '게이트웨이 트래픽', color: '#6E3BBD', monthCost: network },
    { key: 'observability', label: '관측·감사', color: '#6B4F2A', monthCost: obs },
  ];
}

/** 서빙 GPU 고정비 대비 변동비 비율 (0.18+0.06+0.04+0.03). */
export const VARIABLE_COST_RATIO = 0.31;

/** 전사 인프라 월 합계 — 정산(chargeback)이 배분하는 총액. */
export function getTotalInfraCost(): number {
  return getCostBreakdownByCategory().reduce((a, c) => a + c.monthCost, 0);
}

/* ═══════════════════════════════════════════════════════════════
 * 3) 과제별 사용 현황 — ADMIN_TASKS 원장에서 파생
 * ═══════════════════════════════════════════════════════════════ */

export interface TaskUsageRow {
  id: string;
  name: string;
  tenant: string;
  dept: string;
  /** 과제 기안자 = 과제 담당. */
  pmName: string;
  /** 과제 원장의 결재 단계. */
  stage: AdminTask['stage'];
  status: '운영 중' | '개발 중' | '보류';
  namespace: string;

  /** 운영계에 떠 있는 산출 에이전트 수. */
  servingAgents: number;
  /** 게시 대기·중지 산출물까지 포함한 총 에이전트 수. */
  totalAgents: number;
  /** 소속 에이전트 ID — 화면에서 근거를 바로 보여 준다. */
  agentIds: string[];

  /** 30일 호출 총합 — 소속 에이전트 실측 합계. */
  monthCalls: number;
  /** 최근 30일 일별 호출 시계열 (스파크라인용). */
  monthCallsTrend: number[];
  monthCallsDeltaPct: number;
  dau: number;

  /** 30일 인프라 비용 (KRW) — 전사 인프라비의 가중 토큰 점유분. */
  monthCost: number;
  /** 월 예산 (KRW) — 과제 원장에서 결재로 확정된 월 플랫폼 이용 예산. */
  budgetCost: number;

  sloAttainment: number;
  p95Ms: number;
  sloTargetMs: number;
  feedbackUpRate: number;
  fallbackCount: number;

  /** 가드레일 차단 건수 (7일). */
  guardrailBlocks: number;
  /** 정책 위반 (7일). */
  policyViolations: number;
  /** PII 마스킹 건수 (7일). */
  piiMaskCount: number;

  /** 배정 GPU 장 수 — 과제 원장의 `gpuCards`. */
  gpuCards: number;
  podsCurrent: number;
  /** 배정 GPU 점유율(%). */
  gpuUtilPct: number;
  tokenQuotaPct: number;
  tpmUtilPct: number;

  pendingApprovals: number;
  lastActivity: string;
  primaryModel: string;

  monthTokenInput: number;
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

/** 문자열 → 안정 시드. 같은 과제는 새로고침해도 같은 곡선을 그린다. */
function seedOf(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h + 1;
}

/** PII 발생률 — 민감도 등급별. 7일 누계 산정에 쓴다. */
const PII_RATE_BY_SENSITIVITY: Record<number, number> = { 1: 0.002, 2: 0.006, 3: 0.012, 4: 0.02 };

function buildRow(t: AdminTask): TaskUsageRow {
  const agents = t.agentIds.map((id) => AGENT_BY_ID[id]).filter(Boolean);
  const monthCalls = agents.reduce((a, x) => a + x.monthCalls, 0);
  const monthTokenInput = agents.reduce((a, x) => a + x.monthTokenInput, 0);
  const monthTokenOutput = agents.reduce((a, x) => a + x.monthTokenOutput, 0);
  const callsWeekly = agents.reduce((a, x) => a + x.callsWeekly, 0);

  // P95 는 호출량 가중 평균 — 호출이 없으면 주력 모델 기본값.
  const p95Ms =
    monthCalls > 0
      ? Math.round(agents.reduce((a, x) => a + x.p95Ms * x.monthCalls, 0) / monthCalls)
      : MODEL_P95_MS[t.primaryModel] ?? 0;
  /*
   * SLO 목표는 에이전트 성격에 따라 다르게 잡는다 — 배치성(일일 브리프·회의 녹취
   * 요약)을 대화형 3초 기준으로 재면 항상 미달로 보인다.
   *   경량 대화형(gemma) 2.5s / 일반 대화형 3s / 배치·STT 파이프라인 8s
   */
  const slowest = agents.reduce((a, x) => Math.max(a, x.p95Ms), 0);
  const sloTargetMs =
    slowest > 5000 ? 8000 : t.primaryModel === 'google/gemma-4-31B-it-assistant' ? 2500 : 3000;
  const sloAttainment =
    monthCalls === 0
      ? 0
      : Math.min(99.95, Math.max(95, 99.9 - Math.max(0, p95Ms / sloTargetMs - 0.6) * 6));

  const seed = seedOf(t.id);
  const dailyBase = monthCalls / 30;
  const monthCallsTrend = monthCalls > 0 ? trend(seed, dailyBase, dailyBase * 0.34) : Array(30).fill(0);

  // 안전 이벤트 — 7일 누계. 민감도가 높을수록 PII 탐지가 잦다.
  const piiMaskCount = Math.round(
    agents.reduce(
      (a, x) => a + x.callsWeekly * (PII_RATE_BY_SENSITIVITY[x.sensitivity] ?? 0.008),
      0,
    ),
  );
  const guardrailBlocks = Math.round(callsWeekly * 0.0004);
  const policyViolations = Math.round(callsWeekly * 0.000015);

  const status: TaskUsageRow['status'] =
    t.stage === '반려' ? '보류' : monthCalls > 0 ? '운영 중' : '개발 중';

  const pendingApprovals = t.approvals.filter((a) => a.status !== '완료').length;

  const hh = String(9 + (seed % 8)).padStart(2, '0');
  const mm = String(seed % 60).padStart(2, '0');
  const lastActivity =
    status === '운영 중' ? `${DASHBOARD_TODAY} ${hh}:${mm}` : `${t.requestedAt} ${hh}:${mm}`;

  return {
    id: t.id,
    name: t.name,
    tenant: t.tenant,
    dept: t.dept,
    pmName: t.requestedBy,
    stage: t.stage,
    status,
    namespace: t.namespace,

    servingAgents: agents.filter((a) => a.serving).length,
    totalAgents: t.agentIds.length + t.pendingAgentIds.length,
    agentIds: [...t.agentIds, ...t.pendingAgentIds],

    monthCalls,
    monthCallsTrend,
    monthCallsDeltaPct: +(((seed % 47) - 14) * 0.9).toFixed(1),
    dau: Math.round(monthCalls / 30 / 6),

    monthCost: 0, // assignCosts() 에서 전사 인프라비를 가중 토큰 점유율로 배분해 채운다
    budgetCost: t.monthlyInfraBudget,

    sloAttainment,
    p95Ms,
    sloTargetMs,
    feedbackUpRate: monthCalls === 0 ? 0 : +(82 + (seed % 130) / 10).toFixed(1),
    fallbackCount: Math.round(monthCalls * 0.0002),

    guardrailBlocks,
    policyViolations,
    piiMaskCount,

    gpuCards: t.gpuCards,
    podsCurrent: t.gpuCards === 0 ? 0 : t.gpuCards * 2 + agents.length,
    gpuUtilPct: t.gpuCards === 0 ? 0 : Math.min(96, Math.round(34 + (seed % 55))),
    tokenQuotaPct: 0,
    tpmUtilPct: 0,

    pendingApprovals,
    lastActivity,
    primaryModel: t.primaryModel,

    monthTokenInput,
    monthTokenOutput,
  };
}

/**
 * 전사 인프라 월 비용을 **가중 토큰 점유율**(출력 토큰 가중치 3)로 과제에 배분한다.
 * 배분 규칙은 미터링 화면(`mockMetering.BILLING_RULES`)과 같은 규칙이다 —
 * 관리자 대시보드와 정산 화면이 서로 다른 과금 모델을 말하면 그대로 리스크가 된다.
 */
function assignCosts(rows: TaskUsageRow[]): TaskUsageRow[] {
  const totalInfra = getTotalInfraCost();
  const weightOf = (r: TaskUsageRow) => r.monthTokenInput + OUTPUT_TOKEN_WEIGHT * r.monthTokenOutput;
  const weightSum = rows.reduce((a, r) => a + weightOf(r), 0) || 1;
  const peak = Math.max(...rows.map((r) => r.monthCalls), 1);

  for (const r of rows) {
    r.monthCost = Math.round((weightOf(r) / weightSum) * totalInfra);
    // 쿼터·TPM 은 "전사에서 이 과제가 차지하는 비중"을 한도 대비로 환산한 값이다.
    r.tokenQuotaPct = +Math.min(99, (weightOf(r) / weightSum) * 100 * 2.6).toFixed(1);
    r.tpmUtilPct = r.monthCalls === 0 ? 0 : +((r.monthCalls / peak) * 88 + 6).toFixed(1);
  }
  return rows;
}

/** 과제별 사용 현황 — 관리자 대시보드의 기본 행 집합. */
export const ADMIN_TASK_ROWS: TaskUsageRow[] = assignCosts(ADMIN_TASKS.map(buildRow));

/* ═══════════════════════════════════════════════════════════════
 * 4) 시계열·토큰 헬퍼
 * ═══════════════════════════════════════════════════════════════ */

export interface TokenSeries {
  days: string[];
  inputDaily: number[];
  outputDaily: number[];
  totalInput: number;
  totalOutput: number;
}

/** 30일 라벨 (시계열 X축용). */
export function getDailyLabels(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(TODAY_DATE);
    d.setDate(TODAY_DATE.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${mm}-${dd}`);
  }
  return days;
}

/** 운영 과제의 일별 토큰 사용량 시계열을 합산. */
export function getDailyTokenSeries(rows: TaskUsageRow[]): TokenSeries {
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

  return {
    days: getDailyLabels(),
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

/** 주력 모델 기준 토큰 사용량 그룹핑. */
export function getModelTokenBreakdown(rows: TaskUsageRow[]): ModelTokenSlice[] {
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

/** 전사 30일 일별 호출량 — 전체 과제 합산 시계열. */
export function getDailyCallSeries(rows: TaskUsageRow[]): number[] {
  const N = 30;
  const out = Array(N).fill(0);
  for (const r of rows) {
    for (let i = 0; i < N; i++) out[i] += r.monthCallsTrend[i] ?? 0;
  }
  return out.map(Math.round);
}

/**
 * 전사 30일 일별 비용 추이.
 * GPU 고정비는 평탄, 나머지는 사용량(일별 호출량)에 비례.
 */
export function getDailyCostSeries(rows: TaskUsageRow[]): {
  days: string[];
  fixed: number[];
  variable: number[];
  total: number[];
} {
  const days = getDailyLabels();
  const gpuMonth = getTotalGpuCost();
  const fixedDaily = gpuMonth / 30;
  const calls = getDailyCallSeries(rows);
  const callSum = calls.reduce((a, b) => a + b, 0) || 1;
  const variableMonth = gpuMonth * VARIABLE_COST_RATIO;

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

/* ═══════════════════════════════════════════════════════════════
 * 5) Aggregate 헬퍼 (KPI band 용)
 * ═══════════════════════════════════════════════════════════════ */

export function getAdminKpis(rows: TaskUsageRow[]) {
  const total = rows.length;
  const operating = rows.filter((r) => r.status === '운영 중').length;
  const planning = rows.filter((r) => r.status === '개발 중').length;

  /*
   * 에이전트 수는 **자산 단위로 중복 제거**해서 센다. 과제별 합으로 세면 한 자산이
   * 두 과제에 걸릴 때 두 번 잡혀, 헤더의 "에이전트 23종"과 KPI 의 "총 25"가
   * 한 화면에서 어긋난다. 같은 화면이 같은 대상을 다른 수로 말하면 안 된다.
   */
  const allIds = new Set<string>();
  for (const r of rows) r.agentIds.forEach((id) => allIds.add(id));
  const totalAgents = allIds.size;
  const totalServing = rows.reduce((a, r) => a + r.servingAgents, 0);
  // 카탈로그 등재분과 아직 등재 전(개발 중)을 나눠 둔다 — 화면이 23 과 25 를
  // 나란히 보여 주므로 각각이 무엇을 센 수인지 밝힐 수 있어야 한다.
  const pendingAgents = new Set(ADMIN_TASKS.flatMap((t) => t.pendingAgentIds)).size;
  const catalogAgents = totalAgents - pendingAgents;

  const totalCalls = rows.reduce((a, r) => a + r.monthCalls, 0);

  const totalWeighted = totalCalls || 1;
  const sloWeighted = rows.reduce((a, r) => a + r.sloAttainment * r.monthCalls, 0) / totalWeighted;

  const totalCost = rows.reduce((a, r) => a + r.monthCost, 0);
  const totalBudget = rows.reduce((a, r) => a + r.budgetCost, 0);

  const totalSafety = rows.reduce((a, r) => a + r.guardrailBlocks + r.policyViolations, 0);
  const totalPii = rows.reduce((a, r) => a + r.piiMaskCount, 0);
  const totalPending = rows.reduce((a, r) => a + r.pendingApprovals, 0);

  return {
    /** 과제 수 — RFP 가 쓰는 단위는 '과제'다. */
    totalTasks: total,
    operatingTasks: operating,
    planningTasks: planning,
    totalServingAgents: totalServing,
    /** 플랫폼 전체 에이전트 수 — 과제가 참조하는 자산을 중복 없이 센다. */
    totalAgents,
    /** 그중 카탈로그 등재분(= 상단 부제의 "에이전트 N종"). */
    catalogAgents,
    /** 아직 등재 전인 개발 중 산출물. */
    pendingAgents,
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

/* ═══════════════════════════════════════════════════════════════
 * 6) 부서·변화·활동 — 전부 과제 원장에서 파생
 * ═══════════════════════════════════════════════════════════════ */

export interface DeptUsage {
  dept: string;
  tenant: string;
  dau: number;
  newUsers: number;
  returningUsers: number;
}

/** 부서별 DAU — 과제 행의 dau 를 부서 단위로 합산한다. */
export function getDeptUsage(): DeptUsage[] {
  const map = new Map<string, DeptUsage>();
  for (const r of ADMIN_TASK_ROWS) {
    const key = `${r.tenant}·${r.dept}`;
    const cur =
      map.get(key) ?? { dept: r.dept, tenant: r.tenant, dau: 0, newUsers: 0, returningUsers: 0 };
    cur.dau += r.dau;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((d) => {
      const seed = seedOf(d.tenant + d.dept);
      const newUsers = Math.round(d.dau * (0.03 + (seed % 40) / 1000));
      return { ...d, newUsers, returningUsers: d.dau - newUsers };
    })
    .sort((a, b) => b.dau - a.dau);
}

export const DEPT_USAGE: DeptUsage[] = getDeptUsage();

/** 호출량 전주 대비 급증·급감 Top. */
export interface ChangeRow {
  taskId: string;
  name: string;
  deltaPct: number;
  monthCalls: number;
}

export const TOP_SPIKES: ChangeRow[] = [...ADMIN_TASK_ROWS]
  .filter((r) => r.monthCalls > 0 && r.monthCallsDeltaPct > 0)
  .sort((a, b) => b.monthCallsDeltaPct - a.monthCallsDeltaPct)
  .slice(0, 3)
  .map((r) => ({
    taskId: r.id,
    name: r.name,
    deltaPct: r.monthCallsDeltaPct,
    monthCalls: r.monthCalls,
  }));

export const TOP_DROPS: ChangeRow[] = [...ADMIN_TASK_ROWS]
  .filter((r) => r.monthCalls > 0 && r.monthCallsDeltaPct < 0)
  .sort((a, b) => a.monthCallsDeltaPct - b.monthCallsDeltaPct)
  .slice(0, 3)
  .map((r) => ({
    taskId: r.id,
    name: r.name,
    deltaPct: r.monthCallsDeltaPct,
    monthCalls: r.monthCalls,
  }));

/** 전사 활동 피드 (최근 N건). */
export type ActivityKind =
  | 'task_register'
  | 'serv_promotion'
  | 'train_deploy'
  | 'policy_violation'
  | 'incident'
  | 'gpu_change'
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
    id: 'ACT-1031',
    kind: 'serv_promotion',
    title: 'GRP-007 지식·상품 어시스턴트 v0.9-rc1 검증 통과 · 운영계 프로모션 결재 상신',
    who: '남데이터 · 경남은행 (PRJ-KN-031)',
    at: '2026-06-03 14:08',
    href: '/admin/tasks',
  },
  {
    id: 'ACT-1030',
    kind: 'gpu_change',
    title: 'onprem/gpt-oss-120b 서빙 GPU 30장 → 33장 증설',
    who: '김플랫 · 결재 ▶ 2단계 완료',
    at: '2026-06-03 11:42',
  },
  {
    id: 'ACT-1029',
    kind: 'policy_violation',
    title: 'AGT-072 외환 에이전트 — 외부 상품 추천 발화 가드레일 차단',
    who: 'PRJ-BS-061 고객상담 자동화 과제',
    at: '2026-06-03 10:18',
    href: '/admin/guardrails',
  },
  {
    id: 'ACT-1028',
    kind: 'train_deploy',
    title: 'AGT-410 코드 리뷰·시큐어코딩 점검 v0.9-rc2 개발계 배포',
    who: '한지훈 · BNK시스템 (PRJ-SY-003)',
    at: '2026-06-02 17:20',
    href: '/admin/services',
  },
  {
    id: 'ACT-1027',
    kind: 'task_register',
    title: '자금세탁 방지 에이전트 과제(PRJ-GC-001) 등록 · 검토 착수',
    who: '이도현 · 준법지원부',
    at: '2026-05-22 09:18',
    href: '/admin/tasks',
  },
  {
    id: 'ACT-1026',
    kind: 'incident',
    title: 'AGT-621 상담 코파일럿 — P95 SLA 5분간 초과 (자동 복구)',
    who: 'PRJ-SY-018 상담 코파일럿 과제',
    at: '2026-05-20 14:08',
  },
];

/** GPU 할당 변경 이력 (증설/감설). */
export interface GpuChangeEvent {
  id: string;
  at: string;
  model: string;
  /** 변경 전 GPU 장 수. */
  from: number;
  /** 변경 후 GPU 장 수. */
  to: number;
  reason: string;
  approver: string;
  costDeltaKrw: number;
}

/** 장당 월 비용 = 720h × 등급 단가. 이력의 비용 영향도 같은 식에서 나온다. */
function gpuDelta(model: string, from: number, to: number): number {
  return (to - from) * GPU_HOURS_PER_MONTH * (MODEL_GPU_HOUR_PRICE[model] ?? 0);
}

export const GPU_CHANGE_EVENTS: GpuChangeEvent[] = [
  {
    id: 'GPU-EV-014',
    at: '2026-06-03',
    model: 'onprem/gpt-oss-120b',
    from: 30,
    to: 33,
    reason: '피크 점유율 94% 도달 — 사용 현황 탭 알람 기반 증설',
    approver: '김플랫',
    costDeltaKrw: gpuDelta('onprem/gpt-oss-120b', 30, 33),
  },
  {
    id: 'GPU-EV-013',
    at: '2026-05-18',
    model: 'onprem/qwen3-32b',
    from: 3,
    to: 4,
    reason: '리스크 데일리 자동화 과제(PRJ-SC-014) 배정',
    approver: '김플랫',
    costDeltaKrw: gpuDelta('onprem/qwen3-32b', 3, 4),
  },
  {
    id: 'GPU-EV-012',
    at: '2026-05-09',
    model: 'google/gemma-4-31B-it-assistant',
    from: 3,
    to: 4,
    reason: '연금 상담 디지털화 과제(PRJ-SV-007) 개발계 PoC 1장 배정',
    approver: '노운영',
    costDeltaKrw: gpuDelta('google/gemma-4-31B-it-assistant', 3, 4),
  },
  {
    id: 'GPU-EV-011',
    at: '2026-05-02',
    model: 'onprem/qwen3-32b',
    from: 4,
    to: 3,
    reason: 'PB 자산관리 과제 호출 안정화 — 평균 점유 38% → 1장 회수',
    approver: '김플랫',
    costDeltaKrw: gpuDelta('onprem/qwen3-32b', 4, 3),
  },
];

/** 안전 이벤트 30일 추이. */
export function getSafetyEventTrend(): {
  days: string[];
  guardrail: number[];
  policy: number[];
  pii: number[];
} {
  const days = getDailyLabels();
  const guardrail: number[] = [];
  const policy: number[] = [];
  const pii: number[] = [];
  // 7일 누계를 일 단위로 환산한 값을 중심으로 흔든다.
  const grBase = ADMIN_TASK_ROWS.reduce((a, r) => a + r.guardrailBlocks, 0) / 7;
  const piiBase = ADMIN_TASK_ROWS.reduce((a, r) => a + r.piiMaskCount, 0) / 7;
  let s = 31;
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    guardrail.push(
      Math.max(0, Math.round(grBase + Math.sin(i / 4) * grBase * 0.3 + (r - 0.5) * grBase * 0.25)),
    );
    policy.push(r > 0.85 ? Math.round((r - 0.85) * 15) : 0);
    pii.push(
      Math.max(0, Math.round(piiBase + Math.sin(i / 6) * piiBase * 0.22 + (r - 0.5) * piiBase * 0.12)),
    );
  }
  return { days, guardrail, policy, pii };
}

/** 결재 분석 — 종류별 분포. */
export interface ApprovalAnalytics {
  category: '과제 등록' | '개발계' | '운영계' | '폐기' | '정책' | 'GPU 증설';
  pending: number;
  done7d: number;
  rejected7d: number;
  avgLeadTimeHours: number;
}
export const APPROVAL_ANALYTICS: ApprovalAnalytics[] = [
  { category: '과제 등록', pending: 1, done7d: 4, rejected7d: 0, avgLeadTimeHours: 6.2 },
  { category: '개발계', pending: 2, done7d: 12, rejected7d: 1, avgLeadTimeHours: 4.8 },
  { category: '운영계', pending: 3, done7d: 6, rejected7d: 2, avgLeadTimeHours: 28.4 },
  { category: '폐기', pending: 0, done7d: 1, rejected7d: 0, avgLeadTimeHours: 11.0 },
  { category: '정책', pending: 2, done7d: 3, rejected7d: 0, avgLeadTimeHours: 18.2 },
  { category: 'GPU 증설', pending: 0, done7d: 2, rejected7d: 0, avgLeadTimeHours: 9.6 },
];

/** 레드팀·산업표준 통과 현황 — 과제 단위. */
export interface CertificationRow {
  taskId: string;
  name: string;
  redteamPassed: boolean | null;
  industry3Axis: { axis1: boolean; axis2: boolean; axis3: boolean };
  innovDesignationDaysLeft: number | null;
}
export const CERTIFICATIONS: CertificationRow[] = [
  {
    taskId: 'PRJ-BS-077',
    name: 'PB 자산관리 고도화 과제',
    redteamPassed: true,
    industry3Axis: { axis1: true, axis2: true, axis3: true },
    innovDesignationDaysLeft: 388,
  },
  {
    taskId: 'PRJ-BS-061',
    name: '고객상담 자동화 과제',
    redteamPassed: true,
    industry3Axis: { axis1: true, axis2: true, axis3: true },
    innovDesignationDaysLeft: 52, // 만료 임박
  },
  {
    taskId: 'PRJ-BS-042',
    name: '여신 디지털심사 과제',
    redteamPassed: false,
    industry3Axis: { axis1: true, axis2: true, axis3: false },
    innovDesignationDaysLeft: null,
  },
  {
    taskId: 'PRJ-SY-018',
    name: '상담 코파일럿 과제',
    redteamPassed: true,
    industry3Axis: { axis1: true, axis2: true, axis3: true },
    innovDesignationDaysLeft: null,
  },
  {
    taskId: 'PRJ-GC-001',
    name: '자금세탁 방지 에이전트 과제',
    redteamPassed: null, // 아직 평가 전
    industry3Axis: { axis1: false, axis2: false, axis3: false },
    innovDesignationDaysLeft: null,
  },
];

/** 감사 원장 — 최근 N건. 상세 원장은 mockSecurityGovernance 가 갖는다. */
export interface AuditLogItem {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}
export const AUDIT_LOG: AuditLogItem[] = [
  {
    id: 'AUD-2026-06-03-0042',
    at: '2026-06-03 14:08',
    actor: '김플랫',
    action: '관리 대시보드 진입 (MFA 인증)',
    target: '/admin',
  },
  {
    id: 'AUD-2026-06-03-0041',
    at: '2026-06-03 11:42',
    actor: '김플랫',
    action: 'GPU 할당 증설 결재 승인',
    target: 'onprem/gpt-oss-120b 30장 → 33장',
  },
  {
    id: 'AUD-2026-06-03-0039',
    at: '2026-06-03 10:21',
    actor: '박거버',
    action: '정책 P-014 예외 신청 반려',
    target: 'EX-2026-014',
  },
  {
    id: 'AUD-2026-06-02-0118',
    at: '2026-06-02 16:55',
    actor: '시스템',
    action: '사번 비활성 처리 (오프보딩 자동)',
    target: 'usr_8920',
  },
  {
    id: 'AUD-2026-06-02-0094',
    at: '2026-06-02 11:08',
    actor: '박서연',
    action: 'Agent 권한 묶음 변경',
    target: 'AGT-204 · 개발 → 운영',
  },
  {
    id: 'AUD-2026-05-22-0212',
    at: '2026-05-22 09:18',
    actor: '이도현',
    action: '과제 신규 등록',
    target: 'PRJ-GC-001',
  },
];

/* ═══════════════════════════════════════════════════════════════
 * 7) Namespace — tenants.ts 의 11개가 정본
 *
 * 예전 버전은 `pb-agent` / `fc-agent` 처럼 **과제 이름을 그대로 딴 9개**를
 * 나열해 계열사 Namespace 가 하나도 드러나지 않았다. 1막 랜딩이 각인시키는
 * "계열사 10 + 그룹 공통 1 = 11 Namespace" 서사와 테넌트 격리(SEC-001)가
 * 그 지점에서 무너진다. 여기서는 tenants.ts 의 11개를 그대로 쓰고, 과제
 * 워크로드는 **계열사 Namespace 안의 Deployment** 로 내려 놓는다.
 * ═══════════════════════════════════════════════════════════════ */

export type NamespaceCategory =
  | 'affiliate'
  | 'group'
  | 'gateway'
  | 'monitoring'
  | 'platform'
  | 'system';

export interface NamespaceUsage {
  name: string;
  category: NamespaceCategory;
  /** 계열사 Namespace 면 계열사명. 플랫폼 공통이면 undefined. */
  tenant?: string;
  description: string;
  pods: { running: number; pending: number; failed: number };
  cpuUsedM: number;
  cpuLimitM: number;
  memUsedMiB: number;
  memLimitMiB: number;
  netRxMBps: number;
  netTxMBps: number;
  services: number;
  lastDeploy: string;
  /** 이 Namespace 에서 수행 중인 과제 수. */
  taskCount: number;
  /** 배정 GPU 장 수. */
  gpuCards: number;
}

export const CATEGORY_LABEL: Record<NamespaceCategory, string> = {
  affiliate: '계열사',
  group: '그룹 공통',
  gateway: '게이트웨이',
  monitoring: '관제',
  platform: '플랫폼',
  system: '시스템',
};

export const CATEGORY_COLOR: Record<NamespaceCategory, string> = {
  affiliate: '#1B8A4D',
  group: '#CB2C10',
  gateway: '#1F5BB8',
  monitoring: '#C9760F',
  platform: '#777777',
  system: '#6B4F2A',
};

/** 계열사·그룹 공통 Namespace 11개 — tenants.ts 에서 파생, 자원은 과제 원장에서 합산. */
const TENANT_NAMESPACES: NamespaceUsage[] = TENANTS.map((t) => {
  const rows = ADMIN_TASK_ROWS.filter((r) => r.namespace === t.namespace);
  const gpuCards = rows.reduce((a, r) => a + r.gpuCards, 0);
  const seed = seedOf(t.namespace);
  // 자체 과제가 없는 계열사도 Namespace 는 존재한다 — 포털 프록시·SSO 브로커가 뜬다.
  const running = 2 + rows.reduce((a, r) => a + r.podsCurrent, 0);
  const calls = rows.reduce((a, r) => a + r.monthCalls, 0);
  return {
    name: t.namespace,
    category: (t.kind === 'group' ? 'group' : 'affiliate') as NamespaceCategory,
    tenant: t.name,
    description:
      rows.length > 0
        ? `${t.name} · 과제 ${rows.length}건 (개발계 + 운영계) · GPU ${gpuCards}장`
        : `${t.name} · 자체 과제 없음 — 그룹 공통 자산 이용 (포털 프록시 · ${t.idp})`,
    pods: {
      running,
      pending: rows.some((r) => r.status === '개발 중') ? 1 : 0,
      failed: t.namespace === 'ns-group-common' ? 1 : 0,
    },
    cpuUsedM: 400 + running * 620 + (seed % 400),
    cpuLimitM: 2_000 + running * 1_400,
    memUsedMiB: 1_200 + running * 1_850 + (seed % 900),
    memLimitMiB: 4_096 + running * 3_600,
    netRxMBps: +(2 + calls / 40_000).toFixed(1),
    netTxMBps: +(1 + calls / 78_000).toFixed(1),
    services: Math.max(1, rows.reduce((a, r) => a + r.totalAgents, 0) + 1),
    lastDeploy:
      rows.length > 0
        ? `${DASHBOARD_TODAY} ${String(9 + (seed % 9)).padStart(2, '0')}:${String(seed % 60).padStart(2, '0')}`
        : '2026-04-22 10:00',
    taskCount: rows.length,
    gpuCards,
  };
});

/** 플랫폼 공통 Namespace — 11개 테넌트 Namespace 위에 깔리는 공용 계층. */
const PLATFORM_NAMESPACES: NamespaceUsage[] = [
  {
    name: 'aip-gateway',
    category: 'gateway',
    description: 'LLM Gateway · 모델 라우터 · 가드레일 · PII 마스킹 (전 테넌트 공용)',
    pods: { running: 14, pending: 0, failed: 0 },
    cpuUsedM: 12_800,
    cpuLimitM: 20_000,
    memUsedMiB: 28_400,
    memLimitMiB: 49_152,
    netRxMBps: 412.4,
    netTxMBps: 388.2,
    services: 8,
    lastDeploy: '2026-06-03 11:42',
    taskCount: 0,
    gpuCards: 0,
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
    taskCount: 0,
    gpuCards: 0,
  },
  {
    name: 'ingress-nginx',
    category: 'platform',
    description: '공동존 진입점 (Ingress + cert-manager) · 계열사 내부망과 격리',
    pods: { running: 3, pending: 0, failed: 0 },
    cpuUsedM: 800,
    cpuLimitM: 2_000,
    memUsedMiB: 1_800,
    memLimitMiB: 4_096,
    netRxMBps: 488.4,
    netTxMBps: 412.2,
    services: 2,
    lastDeploy: '2026-05-10 14:00',
    taskCount: 0,
    gpuCards: 0,
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
    taskCount: 0,
    gpuCards: 0,
  },
];

export const NAMESPACES: NamespaceUsage[] = [...TENANT_NAMESPACES, ...PLATFORM_NAMESPACES];

/** 테넌트 Namespace 만 — 11개(계열사 10 + 그룹 공통 1). */
export const TENANT_NAMESPACE_LIST: NamespaceUsage[] = TENANT_NAMESPACES;

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
  /** 어느 과제의 워크로드인가. 플랫폼 공용이면 undefined. */
  taskId?: string;
}

export const DEPLOYMENTS: Deployment[] = [
  /* ── 플랫폼 공통 ── */
  { namespace: 'aip-gateway', name: 'gateway-router', replicasReady: 4, replicasDesired: 4, image: 'aip/gateway-router', imageTag: 'v2.4.1', age: '12d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'guardrail-engine', replicasReady: 3, replicasDesired: 3, image: 'aip/guardrail', imageTag: 'v1.8.2', age: '8d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'gpu-slot-scheduler', replicasReady: 3, replicasDesired: 3, image: 'aip/gpu-slot-scheduler', imageTag: 'v0.9.4', age: '5d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'rate-limiter', replicasReady: 2, replicasDesired: 2, image: 'aip/rate-limiter', imageTag: 'v1.2.0', age: '21d', status: 'Healthy' },
  { namespace: 'aip-gateway', name: 'pii-mask-sidecar', replicasReady: 2, replicasDesired: 2, image: 'aip/pii-mask', imageTag: 'v0.6.1', age: '5d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'prometheus', replicasReady: 1, replicasDesired: 1, image: 'prom/prometheus', imageTag: 'v2.51', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'grafana', replicasReady: 1, replicasDesired: 1, image: 'grafana/grafana', imageTag: '10.4.2', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'loki', replicasReady: 1, replicasDesired: 1, image: 'grafana/loki', imageTag: '3.0.0', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'alertmanager', replicasReady: 1, replicasDesired: 1, image: 'prom/alertmanager', imageTag: 'v0.27', age: '45d', status: 'Healthy' },
  { namespace: 'aip-mon', name: 'node-exporter', replicasReady: 14, replicasDesired: 14, image: 'prom/node-exporter', imageTag: 'v1.8.1', age: '45d', status: 'Healthy' },
  { namespace: 'ingress-nginx', name: 'ingress-nginx-controller', replicasReady: 3, replicasDesired: 3, image: 'ingress-nginx', imageTag: 'v1.10.1', age: '62d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'coredns', replicasReady: 2, replicasDesired: 2, image: 'k8s/coredns', imageTag: '1.11.1', age: '180d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'kube-proxy', replicasReady: 14, replicasDesired: 14, image: 'k8s/kube-proxy', imageTag: 'v1.29.4', age: '180d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'calico-node', replicasReady: 14, replicasDesired: 14, image: 'calico/node', imageTag: 'v3.27.3', age: '180d', status: 'Healthy' },
  { namespace: 'kube-system', name: 'csi-nfs-driver', replicasReady: 14, replicasDesired: 14, image: 'k8s/csi-nfs', imageTag: 'v4.6.0', age: '120d', status: 'Healthy' },

  /* ── 부산은행 (ns-bank-bs) ── */
  { namespace: 'ns-bank-bs', name: 'bs-credit-agent-serv', replicasReady: 4, replicasDesired: 4, image: 'aip/credit-agent', imageTag: 'v2.1.3-serv', age: '7d', status: 'Healthy', taskId: 'PRJ-BS-042' },
  { namespace: 'ns-bank-bs', name: 'bs-credit-doc-extract', replicasReady: 2, replicasDesired: 2, image: 'aip/doc-extract', imageTag: 'v1.0.0', age: '14d', status: 'Healthy', taskId: 'PRJ-BS-042' },
  { namespace: 'ns-bank-bs', name: 'bs-consult-agent-serv', replicasReady: 12, replicasDesired: 12, image: 'aip/consult-agent', imageTag: 'v3.2.1-serv', age: '6d', status: 'Healthy', taskId: 'PRJ-BS-061' },
  { namespace: 'ns-bank-bs', name: 'bs-consult-agent-train', replicasReady: 5, replicasDesired: 6, image: 'aip/consult-agent', imageTag: 'v3.3.0-train', age: '1d', status: 'Updating', taskId: 'PRJ-BS-061' },
  { namespace: 'ns-bank-bs', name: 'bs-pb-agent-serv', replicasReady: 3, replicasDesired: 3, image: 'aip/pb-agent', imageTag: 'v0.4.2-serv', age: '4d', status: 'Healthy', taskId: 'PRJ-BS-077' },
  { namespace: 'ns-bank-bs', name: 'bs-policy-agent-serv', replicasReady: 6, replicasDesired: 6, image: 'aip/policy-agent', imageTag: 'v3.0.0-serv', age: '9d', status: 'Healthy', taskId: 'PRJ-BS-088' },
  { namespace: 'ns-bank-bs', name: 'bs-rag-builder', replicasReady: 4, replicasDesired: 4, image: 'aip/rag-builder', imageTag: 'v2.1.0', age: '14d', status: 'Healthy', taskId: 'PRJ-BS-088' },

  /* ── 경남은행 (ns-bank-kn) ── */
  { namespace: 'ns-bank-kn', name: 'kn-fx-agent-serv', replicasReady: 3, replicasDesired: 3, image: 'aip/fx-agent', imageTag: 'v1.6.0-serv', age: '31d', status: 'Healthy', taskId: 'PRJ-KN-009' },
  { namespace: 'ns-bank-kn', name: 'kn-card-agent-serv', replicasReady: 4, replicasDesired: 4, image: 'aip/card-agent', imageTag: 'v1.2.4-serv', age: '11d', status: 'Healthy', taskId: 'PRJ-KN-022' },
  { namespace: 'ns-bank-kn', name: 'kn-knowledge-agent-train', replicasReady: 2, replicasDesired: 3, image: 'aip/knowledge-agent', imageTag: 'v0.9-rc1-train', age: '2d', status: 'Updating', taskId: 'PRJ-KN-031' },

  /* ── BNK캐피탈 (ns-capital) ── */
  { namespace: 'ns-capital', name: 'cp-adreview-agent-serv', replicasReady: 2, replicasDesired: 2, image: 'aip/adreview-agent', imageTag: 'v1.4.0-serv', age: '16d', status: 'Healthy', taskId: 'PRJ-CP-007' },
  { namespace: 'ns-capital', name: 'cp-claim-agent-train', replicasReady: 2, replicasDesired: 2, image: 'aip/claim-agent', imageTag: 'v0.7.1-train', age: '5d', status: 'Healthy', taskId: 'PRJ-CP-012' },

  /* ── BNK투자증권 · BNK저축은행 ── */
  { namespace: 'ns-securities', name: 'sc-risk-agent-serv', replicasReady: 2, replicasDesired: 2, image: 'aip/risk-agent', imageTag: 'v1.1.0-serv', age: '19d', status: 'Healthy', taskId: 'PRJ-SC-014' },
  { namespace: 'ns-savings', name: 'sv-pension-agent-train', replicasReady: 1, replicasDesired: 2, image: 'aip/pension-agent', imageTag: 'v0.3.0-train', age: '3d', status: 'Updating', taskId: 'PRJ-SV-007' },

  /* ── BNK시스템 (ns-system) ── */
  { namespace: 'ns-system', name: 'sy-groupware-agent-serv', replicasReady: 6, replicasDesired: 6, image: 'aip/groupware-agent', imageTag: 'v2.2.0-serv', age: '22d', status: 'Healthy', taskId: 'PRJ-SY-021' },
  { namespace: 'ns-system', name: 'sy-meeting-agent-serv', replicasReady: 8, replicasDesired: 8, image: 'aip/meeting-agent', imageTag: 'v2.5.1-serv', age: '8d', status: 'Healthy', taskId: 'PRJ-SY-021' },
  { namespace: 'ns-system', name: 'sy-navigator-agent-train', replicasReady: 2, replicasDesired: 2, image: 'aip/navigator-agent', imageTag: 'v0.2.0-train', age: '4d', status: 'Healthy', taskId: 'PRJ-SY-021' },
  { namespace: 'ns-system', name: 'sy-copilot-agent-serv', replicasReady: 4, replicasDesired: 4, image: 'aip/copilot-agent', imageTag: 'v2.1.4-serv', age: '3d', status: 'Healthy', taskId: 'PRJ-SY-018' },
  { namespace: 'ns-system', name: 'sy-codereview-agent-test', replicasReady: 1, replicasDesired: 2, image: 'aip/codereview-agent', imageTag: 'v0.9-rc2', age: '1d', status: 'Updating', taskId: 'PRJ-SY-003' },

  /* ── 그룹 공통 (ns-group-common) ── */
  { namespace: 'ns-group-common', name: 'gc-aml-agent-train', replicasReady: 2, replicasDesired: 3, image: 'aip/aml-agent', imageTag: 'v0.1.0-dev', age: '2d', status: 'Updating', taskId: 'PRJ-GC-001' },
  { namespace: 'ns-group-common', name: 'gc-eval-runner', replicasReady: 0, replicasDesired: 1, image: 'aip/eval-runner', imageTag: 'v1.4.0', age: '2d', status: 'Failed', taskId: 'PRJ-GC-001' },
  { namespace: 'ns-group-common', name: 'gc-portal-gateway', replicasReady: 2, replicasDesired: 2, image: 'aip/portal-gateway', imageTag: 'v1.9.0', age: '30d', status: 'Healthy' },

  /* ── 자체 과제가 없는 계열사 — Namespace 는 존재한다(SEC-001 테넌트 격리) ── */
  { namespace: 'ns-am', name: 'am-portal-proxy', replicasReady: 2, replicasDesired: 2, image: 'aip/portal-proxy', imageTag: 'v1.9.0', age: '30d', status: 'Healthy' },
  { namespace: 'ns-vc', name: 'vc-portal-proxy', replicasReady: 2, replicasDesired: 2, image: 'aip/portal-proxy', imageTag: 'v1.9.0', age: '30d', status: 'Healthy' },
  { namespace: 'ns-ci', name: 'ci-portal-proxy', replicasReady: 2, replicasDesired: 2, image: 'aip/portal-proxy', imageTag: 'v1.9.0', age: '30d', status: 'Healthy' },
  { namespace: 'ns-lns', name: 'lns-portal-proxy', replicasReady: 2, replicasDesired: 2, image: 'aip/portal-proxy', imageTag: 'v1.9.0', age: '30d', status: 'Healthy' },
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
    memory.push(
      Math.max(35, Math.min(88, Math.round(base + 12 + Math.sin(h / 5) * 6 + (r2 - 0.5) * 10))),
    );
    hours.push(`${String(h).padStart(2, '0')}시`);
  }
  return { cpu, memory, hours };
}

/** 과제별 안전 이벤트(PII + 가드레일 차단) 30일 시계열. */
export interface TaskSafetySeries {
  taskId: string;
  name: string;
  piiDaily: number[];
  guardrailDaily: number[];
  totalDaily: number[];
  color: string;
}
export function getTaskSafetySeries(rows: TaskUsageRow[]): TaskSafetySeries[] {
  const palette = ['#CB2C10', '#1F5BB8', '#1B8A4D', '#6E3BBD', '#C9760F', '#6B4F2A', '#0E7C8A', '#8A1C6B'];
  return rows
    .filter((r) => r.guardrailBlocks + r.piiMaskCount > 0)
    .map((r, i) => {
      let s = seedOf(r.id) + i * 11;
      const piiDaily: number[] = [];
      const guardrailDaily: number[] = [];
      const totalDaily: number[] = [];
      const piiBase = r.piiMaskCount / 7;
      const grBase = r.guardrailBlocks / 7;
      const piiAmp = Math.max(piiBase * 0.25, 5);
      const grAmp = Math.max(grBase * 0.3, 1);
      for (let d = 0; d < 30; d++) {
        s = (s * 9301 + 49297) % 233280;
        const r2 = s / 233280;
        s = (s * 9301 + 49297) % 233280;
        const r3 = s / 233280;
        const pii = Math.max(
          0,
          Math.round(piiBase + Math.sin(d / 5 + i) * piiAmp * 0.5 + (r2 - 0.5) * piiAmp),
        );
        const gr = Math.max(
          0,
          Math.round(grBase + Math.sin(d / 4 + i + 1) * grAmp * 0.5 + (r3 - 0.5) * grAmp),
        );
        piiDaily.push(pii);
        guardrailDaily.push(gr);
        totalDaily.push(pii + gr);
      }
      return {
        taskId: r.id,
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
  /** 소속 과제 — 과제 원장 ID. */
  taskId: string;
  taskName: string;
  items: Record<string, PiiAction>;
  /** 7일 누계 발생 건수 — 에이전트 실측 호출 × 민감도 발생률. */
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

/** 정책 세트 — 발생 건수는 에이전트 실측에서 파생하고, 정책만 손으로 정의한다. */
const PII_POLICY_ITEMS: { agentId: string; taskId: string; items: Record<string, PiiAction> }[] = [
  { agentId: 'AGT-204', taskId: 'PRJ-BS-077', items: { RRN: 'block', ACCT: 'mask', CARD: 'off', PHONE: 'mask', EMAIL: 'off', ADDR: 'mask', PASS: 'off', DRV: 'off' } },
  { agentId: 'AGT-411', taskId: 'PRJ-BS-042', items: { RRN: 'block', ACCT: 'mask', CARD: 'mask', PHONE: 'mask', EMAIL: 'mask', ADDR: 'mask', PASS: 'mask', DRV: 'mask' } },
  { agentId: 'AGT-512', taskId: 'PRJ-BS-042', items: { RRN: 'block', ACCT: 'mask', CARD: 'off', PHONE: 'mask', EMAIL: 'off', ADDR: 'mask', PASS: 'off', DRV: 'mask' } },
  { agentId: 'AGT-301', taskId: 'PRJ-BS-061', items: { RRN: 'block', ACCT: 'mask', CARD: 'mask', PHONE: 'mask', EMAIL: 'off', ADDR: 'mask', PASS: 'off', DRV: 'off' } },
  { agentId: 'GRP-005', taskId: 'PRJ-BS-061', items: { RRN: 'block', ACCT: 'mask', CARD: 'mask', PHONE: 'mask', EMAIL: 'mask', ADDR: 'mask', PASS: 'off', DRV: 'off' } },
  { agentId: 'AGT-621', taskId: 'PRJ-SY-018', items: { RRN: 'block', ACCT: 'mask', CARD: 'mask', PHONE: 'mask', EMAIL: 'mask', ADDR: 'mask', PASS: 'off', DRV: 'off' } },
  { agentId: 'AGT-701', taskId: 'PRJ-GC-001', items: { RRN: 'block', ACCT: 'block', CARD: 'mask', PHONE: 'mask', EMAIL: 'off', ADDR: 'off', PASS: 'block', DRV: 'off' } },
];

const TASK_NAME_BY_ID: Record<string, string> = ADMIN_TASKS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t.name }),
  {} as Record<string, string>,
);

export const AGENT_PII_POLICIES: AgentPiiPolicy[] = PII_POLICY_ITEMS.map((p) => {
  const agent = AGENT_BY_ID[p.agentId];
  return {
    agentId: p.agentId,
    agentName: agent?.name ?? p.agentId,
    taskId: p.taskId,
    taskName: TASK_NAME_BY_ID[p.taskId] ?? p.taskId,
    items: p.items,
    count7d: agent
      ? Math.round(agent.callsWeekly * (PII_RATE_BY_SENSITIVITY[agent.sensitivity] ?? 0.008))
      : 0,
  };
});

/** 과제별 일별 DAU 30일 시계열. */
export interface TaskDauSeries {
  taskId: string;
  name: string;
  daily: number[];
  color: string;
}
export function getTaskDauSeries(rows: TaskUsageRow[]): TaskDauSeries[] {
  const palette = ['#CB2C10', '#1F5BB8', '#1B8A4D', '#6E3BBD', '#C9760F', '#6B4F2A', '#0E7C8A', '#8A1C6B'];
  return rows
    .filter((r) => r.dau > 0)
    .map((r, i) => {
      let s = seedOf(r.id) + i * 7;
      const daily: number[] = [];
      const base = r.dau;
      const amp = Math.max(base * 0.22, 8);
      const drift = base * 0.08;
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
      return { taskId: r.id, name: r.name, daily, color: palette[i % palette.length] };
    })
    .sort((a, b) => b.daily[b.daily.length - 1] - a.daily[a.daily.length - 1]);
}

/* ═══════════════════════════════════════════════════════════════
 * 8) 계열사 축 — 그룹 공통 자산 사용량까지 배분한 뒤 집계
 *
 * 계열사 전용 에이전트는 그 계열사에 100% 귀속되고, **그룹 공통 운영영역**에
 * 배포된 자산(GRP-* 10종 + 그룹 공통 소속 AGT-701)은 10개 계열사가 함께 쓰므로
 * **임직원 수 비율**로 나눈다. 이렇게 해야 자체 과제가 없는 계열사
 * (자산운용·벤처투자·신용정보·엘앤에스)도 사용량과 정산액을 갖는다 —
 * 실제로 그들은 그룹 공통 어시스턴트를 쓴다.
 * ═══════════════════════════════════════════════════════════════ */

const HEADCOUNT_TOTAL = AFFILIATES.reduce((a, t) => a + (AFFILIATE_HEADCOUNT[t.name] ?? 0), 0);

export interface ConglomerateTokenSeries {
  name: string;
  /** 30일 일별 토큰 사용량 (입력+출력). */
  daily: number[];
  total: number;
  inputTotal: number;
  outputTotal: number;
  color: string;
  /** 자체 제작 주관 에이전트 수. */
  ownedAgents: number;
  /** 그룹 공통 운영영역에서 함께 쓰는 에이전트 수. */
  sharedAgents: number;
}

const TENANT_COLOR: Record<string, string> = {
  부산은행: '#CB2C10',
  경남은행: '#1F5BB8',
  BNK투자증권: '#1B8A4D',
  BNK캐피탈: '#6E3BBD',
  BNK저축은행: '#C9760F',
  BNK시스템: '#6B4F2A',
  BNK자산운용: '#0E7C8A',
  BNK신용정보: '#8A1C6B',
  BNK벤처투자: '#3F6212',
  BNK엘앤에스: '#7A5C1E',
};

export function getConglomerateTokenSeries(): ConglomerateTokenSeries[] {
  const N = 30;
  const shared = PLATFORM_AGENTS.filter((a) => a.groupShared);
  const sharedInput = shared.reduce((a, x) => a + x.monthTokenInput, 0);
  const sharedOutput = shared.reduce((a, x) => a + x.monthTokenOutput, 0);

  return AFFILIATES.map((t) => {
    const own = PLATFORM_AGENTS.filter((a) => !a.groupShared && a.tenant === t.name);
    const share = (AFFILIATE_HEADCOUNT[t.name] ?? 0) / (HEADCOUNT_TOTAL || 1);

    const inputTotal = Math.round(
      own.reduce((a, x) => a + x.monthTokenInput, 0) + sharedInput * share,
    );
    const outputTotal = Math.round(
      own.reduce((a, x) => a + x.monthTokenOutput, 0) + sharedOutput * share,
    );
    const total = inputTotal + outputTotal;

    // 월 합계를 30일에 뿌린다 — 합은 total 과 정확히 같게 맞춘다(정산 총액 불변).
    let s = seedOf(t.name);
    const raw: number[] = [];
    for (let i = 0; i < N; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      raw.push(
        Math.max(0.1, 1 + Math.sin((i / N) * Math.PI * 2 + (s % 7)) * 0.16 + (r - 0.5) * 0.22 + (i / N) * 0.12),
      );
    }
    const rawSum = raw.reduce((a, b) => a + b, 0) || 1;
    const daily = raw.map((v) => Math.round((v / rawSum) * total));

    return {
      name: t.name,
      daily,
      total,
      inputTotal,
      outputTotal,
      color: TENANT_COLOR[t.name] ?? '#777777',
      ownedAgents: own.length,
      sharedAgents: shared.length,
    };
  }).sort((a, b) => b.total - a.total);
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

export interface ConglomerateCostRow {
  name: string;
  color: string;
  monthTokens: number;
  monthCost: number;
  pct: number;
  /** 자체 제작 주관 에이전트 수. */
  agentCount: number;
  /** 그룹 공통 운영영역 공용 에이전트 수. */
  sharedAgentCount: number;
}

/**
 * 계열사별 월 비용 — 가중 토큰 점유율 기반 분배(출력 토큰 가중치 3).
 * 배분 대상 총액은 `getTotalInfraCost()` 이며, 미터링 화면이 이 함수를 단일
 * 출처로 그대로 읽는다.
 */
export function getCostByConglomerate(): ConglomerateCostRow[] {
  const series = getConglomerateTokenSeries();
  const weightOf = (s: ConglomerateTokenSeries) => s.inputTotal + OUTPUT_TOKEN_WEIGHT * s.outputTotal;
  const weightSum = series.reduce((a, s) => a + weightOf(s), 0) || 1;
  const totalTokens = series.reduce((a, s) => a + s.total, 0) || 1;
  const totalCost = getTotalInfraCost();

  return series.map((s) => ({
    name: s.name,
    color: s.color,
    monthTokens: s.total,
    monthCost: Math.round((weightOf(s) / weightSum) * totalCost),
    pct: (s.total / totalTokens) * 100,
    agentCount: s.ownedAgents,
    sharedAgentCount: s.sharedAgents,
  }));
}

export interface AgentCostRow {
  id: string;
  name: string;
  tenant: string;
  /** 소속 과제. */
  taskId: string;
  taskName: string;
  mainModel: string;
  state: '운영 중' | '검증 중';
  monthCalls: number;
  monthCost: number;
  costPerCall: number;
}

/**
 * 에이전트별 월 비용 — 계열사 축과 **같은 총액**을 가중 토큰 점유율로 나눈다.
 * (예전에는 '호출당 단가 × 호출 수'라는 다른 식을 써서 계열사 합계와 어긋났다)
 */
export function getCostByAgent(): AgentCostRow[] {
  const live = PLATFORM_AGENTS.filter((a) => a.monthCalls > 0);
  const weightOf = (a: PlatformAgent) => a.monthTokenInput + OUTPUT_TOKEN_WEIGHT * a.monthTokenOutput;
  const weightSum = live.reduce((x, a) => x + weightOf(a), 0) || 1;
  const totalCost = getTotalInfraCost();

  return live
    .map((a) => {
      const task = ADMIN_TASKS.find((t) => t.agentIds.includes(a.id));
      const monthCost = Math.round((weightOf(a) / weightSum) * totalCost);
      return {
        id: a.id,
        name: a.name,
        tenant: a.tenant,
        taskId: task?.id ?? '—',
        taskName: task?.name ?? '미배정',
        mainModel: a.model,
        state: (a.serving ? '운영 중' : '검증 중') as '운영 중' | '검증 중',
        monthCalls: a.monthCalls,
        monthCost,
        costPerCall: Math.round(monthCost / a.monthCalls),
      };
    })
    .sort((a, b) => b.monthCost - a.monthCost);
}

/**
 * 미터링 화면(AGB-010 에이전트별 미터링)이 쓰는 **전수 기준선**.
 * 호출이 발생한 모든 에이전트를 넘긴다 — 미터링 표가 "Top N" 없이 9행만
 * 보여 주면 바로 위 계열사 표의 합계와 어긋난 것처럼 읽힌다.
 */
export function getMeteringAgentBase() {
  return PLATFORM_AGENTS.filter((a) => a.monthCalls > 0)
    .map((a) => {
      const task = ADMIN_TASKS.find((t) => t.agentIds.includes(a.id));
      const seed = seedOf(a.id);
      return {
        agentId: a.id,
        name: a.name,
        tenant: a.tenant,
        groupShared: a.groupShared,
        taskId: task?.id ?? '—',
        calls: a.monthCalls,
        inputTokens: a.monthTokenInput,
        outputTokens: a.monthTokenOutput,
        // 전일 대비 증감. 이상 알림이 걸린 자산은 알림과 **같은 배수**를 쓴다 —
        // 관제 화면과 미터링이 다른 증감률을 말하면 관리자가 두 번 확인해야 한다.
        deltaPct: AGENT_DELTA_OVERRIDE[a.id] ?? +(((seed % 51) - 16) * 0.85).toFixed(1),
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

/**
 * 전일비 고정값 — 시연 3막 파트 A 의 이상 알림(GRP-005 ×3.0)과 맞춘다.
 * `mockAffiliateOps.ANOMALY_ALERTS` 의 multiple(어제 대비 3배)을 퍼센트로 옮긴 값이다.
 */
const AGENT_DELTA_OVERRIDE: Record<string, number> = {
  'GRP-005': 200.0,
};

/* ═══════════════════════════════════════════════════════════════
 * 10) 대시보드 Export — RFP 2-1 [34] "(Export 기능 포함)"
 *
 * 시연 환경에서 실제 브라우저 다운로드를 트리거하는 것은 위험하므로
 * **화면 안에서** 형식·대상 범위·생성 결과를 보여 주는 방식으로 요건을
 * 드러낸다. 행 수·용량은 실제 데이터에서 계산한다.
 * ═══════════════════════════════════════════════════════════════ */

export type ExportFormat = 'XLSX' | 'CSV' | 'PDF';
export const EXPORT_FORMATS: ExportFormat[] = ['XLSX', 'CSV', 'PDF'];

export interface ExportScopeDef {
  key: string;
  label: string;
  /** 이 범위가 담는 행 수. */
  rowCount: number;
  sheet: string;
}

export function getExportScopes(): ExportScopeDef[] {
  return [
    { key: 'tasks', label: '과제별 사용 현황', rowCount: ADMIN_TASK_ROWS.length, sheet: '01_과제사용현황' },
    { key: 'agents', label: '에이전트별 호출·비용', rowCount: getCostByAgent().length, sheet: '02_에이전트비용' },
    { key: 'conglomerate', label: '계열사별 토큰·정산액', rowCount: getCostByConglomerate().length, sheet: '03_계열사정산' },
    { key: 'gpu', label: '모델별 GPU 할당·점유', rowCount: getModelGpuAllocation().length, sheet: '04_GPU할당' },
    { key: 'namespace', label: 'Namespace 자원 현황', rowCount: NAMESPACES.length, sheet: '05_네임스페이스' },
    { key: 'daily', label: '30일 일별 호출·비용', rowCount: 30, sheet: '06_일별추이' },
  ];
}

export interface ExportResult {
  fileName: string;
  format: ExportFormat;
  rowCount: number;
  sheets: string[];
  /** 추정 용량(KB) — 행 수 기반. */
  sizeKb: number;
  generatedAt: string;
  /** 감사 원장에 남는 항목 ID. */
  auditId: string;
}

/** 선택한 범위로 내보내기 결과를 구성한다(파일 생성 없이 결과만 계산). */
export function buildExportResult(format: ExportFormat, scopeKeys: string[]): ExportResult {
  const scopes = getExportScopes().filter((s) => scopeKeys.includes(s.key));
  const rowCount = scopes.reduce((a, s) => a + s.rowCount, 0);
  const perRowKb = format === 'PDF' ? 1.8 : format === 'XLSX' ? 0.9 : 0.4;
  return {
    fileName: `BNK_AI플랫폼_사용현황_${DASHBOARD_TODAY.replace(/-/g, '')}.${format.toLowerCase()}`,
    format,
    rowCount,
    sheets: scopes.map((s) => s.sheet),
    sizeKb: Math.max(12, Math.round(rowCount * perRowKb + (format === 'PDF' ? 240 : 18))),
    generatedAt: `${DASHBOARD_TODAY} 14:12:0${scopes.length % 10}`,
    auditId: `AUD-${DASHBOARD_TODAY}-EXP${String(rowCount % 1000).padStart(3, '0')}`,
  };
}
