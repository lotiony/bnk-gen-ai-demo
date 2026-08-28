/**
 * 계열사별 미터링 · Chargeback mock — 핸드오프 §2 화면 11.
 *
 * RFP: LSM-010 · ONM-005
 *
 * **정산액을 여기서 새로 만들지 않는다.** 계열사별 월 비용은 관리자 대시보드
 * 비용 탭이 이미 쓰고 있는 `getCostByConglomerate()` 를 그대로 읽는다.
 * 같은 수치를 두 화면이 따로 계산하면 반드시 어긋난다 — 그건 그대로
 * 제안 리스크가 된다(RFP Ⅳ.4.1).
 *
 * 이 파일이 더하는 것은 두 가지뿐이다.
 *   ① **입력/출력 분리** — 두 토큰은 단가가 다르므로 합산만으로는 정산이 안 된다.
 *      배분 규칙: 출력 토큰에 가중치 3 을 준 **가중 토큰 점유율**로 나눈다.
 *      나눈 합계는 원래 월 비용과 정확히 같다(총액 불변).
 *   ② **부서별 분해** — 계열사 정산액을 부서 사용 비율로 다시 나눈다.
 *
 * ⚠️ 전부 가상 수치다. 실제 BNK 조직·사용량·단가가 아니다.
 */
import {
  getConglomerateTokenSeries,
  getCostByConglomerate,
  getMeteringAgentBase,
  AFFILIATE_HEADCOUNT,
} from '@/data/mockAdminDashboard';
import { AFFILIATES } from '@/data/tenants';

/** 정산 대상 월 — 데모는 한 달만 다룬다. 대시보드 기준일(2026-06-03)의 직전 마감월. */
export const BILLING_MONTH = '2026-05';

/**
 * 출력 토큰 가중치. 생성이 입력 처리보다 GPU 를 더 쓴다는 사실을 반영한 값이며,
 * 정산 규칙 문서에 명시되는 종류의 상수다. 화면에도 그대로 노출한다.
 */
export const OUTPUT_WEIGHT = 3;

export interface MeteringRow {
  name: string;
  color: string;
  namespace: string;
  users: number;
  /** 이 계열사가 제작 주관한 자체 에이전트 수. */
  agents: number;
  /** 그룹 공통 운영영역에서 함께 쓰는 에이전트 수(전 계열사 공용). */
  sharedAgents: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  monthCost: number;
  /** 그룹 전체 대비 비중(%). */
  pct: number;
  /** 전월 대비 증감(%). 하드코딩 — 결정론 유지. */
  deltaPct: number;
}

const DELTA: Record<string, number> = {
  부산은행: 12.4,
  경남은행: 8.1,
  BNK투자증권: 21.7,
  BNK캐피탈: -3.2,
  BNK저축은행: 5.5,
  BNK시스템: 2.8,
  BNK자산운용: 14.9,
  BNK신용정보: -1.4,
  BNK벤처투자: 33.6,
  BNK엘앤에스: 0.9,
};

/**
 * 계열사별 이용자 수는 `mockAdminDashboard.AFFILIATE_HEADCOUNT` 가 단일 출처다 —
 * 같은 값이 그룹 공통 에이전트 사용량을 계열사에 배분하는 가중치로도 쓰이므로
 * 여기서 따로 적으면 두 화면이 다른 모수를 말하게 된다.
 */
const USERS: Record<string, number> = AFFILIATE_HEADCOUNT;

export function getMeteringRows(): MeteringRow[] {
  const series = getConglomerateTokenSeries();
  const cost = getCostByConglomerate();

  return series.map((s) => {
    const c = cost.find((x) => x.name === s.name);
    const meta = AFFILIATES.find((a) => a.name === s.name);
    const monthCost = c?.monthCost ?? 0;

    // 가중 토큰 점유율로 입력분/출력분을 나눈다. 합은 monthCost 와 같다.
    const weighted = s.inputTotal + OUTPUT_WEIGHT * s.outputTotal || 1;
    const inputCost = Math.round((monthCost * s.inputTotal) / weighted);

    return {
      name: s.name,
      color: s.color,
      namespace: meta?.namespace ?? '-',
      users: USERS[s.name] ?? 0,
      agents: c?.agentCount ?? 0,
      sharedAgents: c?.sharedAgentCount ?? 0,
      inputTokens: s.inputTotal,
      outputTokens: s.outputTotal,
      totalTokens: s.total,
      inputCost,
      outputCost: monthCost - inputCost, // 잔액으로 잡아 반올림 오차가 총액을 흔들지 않게 한다
      monthCost,
      pct: c?.pct ?? 0,
      deltaPct: DELTA[s.name] ?? 0,
    };
  });
}

/* ═══════════════════════ 부서별 분해 ═══════════════════════ */

export interface DeptRow {
  dept: string;
  users: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  pct: number;
}

/** 계열사별 부서 구성과 사용 비율. 비율 합은 1 이다. */
const DEPTS: Record<string, { dept: string; ratio: number; users: number }[]> = {
  부산은행: [
    { dept: '개인영업부', ratio: 0.31, users: 1680 },
    { dept: '기업영업부', ratio: 0.24, users: 1120 },
    { dept: '여신심사부', ratio: 0.21, users: 640 },
    { dept: '디지털채널부', ratio: 0.15, users: 880 },
    { dept: 'IT본부', ratio: 0.09, users: 500 },
  ],
  경남은행: [
    { dept: '개인영업부', ratio: 0.34, users: 1210 },
    { dept: '기업영업부', ratio: 0.27, users: 840 },
    { dept: '여신심사부', ratio: 0.22, users: 520 },
    { dept: '디지털채널부', ratio: 0.17, users: 570 },
  ],
  BNK투자증권: [
    { dept: '리테일영업부', ratio: 0.42, users: 310 },
    { dept: 'IB부', ratio: 0.33, users: 180 },
    { dept: '리서치센터', ratio: 0.25, users: 150 },
  ],
  BNK캐피탈: [
    { dept: '오토금융부', ratio: 0.46, users: 380 },
    { dept: '기업금융부', ratio: 0.32, users: 230 },
    { dept: '채권관리부', ratio: 0.22, users: 170 },
  ],
  BNK저축은행: [
    { dept: '여신관리부', ratio: 0.58, users: 190 },
    { dept: '수신관리부', ratio: 0.42, users: 120 },
  ],
  BNK시스템: [
    { dept: '플랫폼운영부', ratio: 0.45, users: 210 },
    { dept: '개발1부', ratio: 0.31, users: 180 },
    { dept: '개발2부', ratio: 0.24, users: 130 },
  ],
  BNK자산운용: [
    { dept: '운용본부', ratio: 0.64, users: 120 },
    { dept: '마케팅부', ratio: 0.36, users: 70 },
  ],
  BNK신용정보: [
    { dept: '채권추심부', ratio: 0.61, users: 150 },
    { dept: '신용조사부', ratio: 0.39, users: 90 },
  ],
  BNK벤처투자: [{ dept: '투자심사부', ratio: 1, users: 90 }],
  BNK엘앤에스: [{ dept: '경영지원부', ratio: 1, users: 160 }],
};

export function getDeptRows(tenantName: string): DeptRow[] {
  const row = getMeteringRows().find((r) => r.name === tenantName);
  if (!row) return [];
  const defs = DEPTS[tenantName] ?? [];
  return defs.map((d) => ({
    dept: d.dept,
    users: d.users,
    inputTokens: Math.round(row.inputTokens * d.ratio),
    outputTokens: Math.round(row.outputTokens * d.ratio),
    cost: Math.round(row.monthCost * d.ratio),
    pct: d.ratio * 100,
  }));
}

/* ═══════════════════════ 합계 ═══════════════════════ */

export function getMeteringTotals() {
  const rows = getMeteringRows();
  const input = rows.reduce((a, r) => a + r.inputTokens, 0);
  const output = rows.reduce((a, r) => a + r.outputTokens, 0);
  const cost = rows.reduce((a, r) => a + r.monthCost, 0);
  const inputCost = rows.reduce((a, r) => a + r.inputCost, 0);
  return {
    input,
    output,
    total: input + output,
    cost,
    inputCost,
    outputCost: cost - inputCost,
    /** 1M 토큰당 환산 단가 — 배분 결과에서 역산한 값이다. */
    unitInput: input ? (inputCost / (input / 1_000_000)) : 0,
    unitOutput: output ? ((cost - inputCost) / (output / 1_000_000)) : 0,
    topTenant: [...rows].sort((a, b) => b.monthCost - a.monthCost)[0],
  };
}

/** 정산 규칙 — 화면에 그대로 노출한다. 규칙을 감추면 정산이 신뢰를 못 얻는다. */
export const BILLING_RULES: { k: string; v: string }[] = [
  {
    k: '과금 단위',
    v: '입력 토큰과 출력 토큰을 분리 계측한다. 스트리밍 중단 시에도 실제 생성된 출력 토큰까지 계측된다.',
  },
  {
    k: '배분 규칙',
    v: `On-Premise 고정비(GPU·상면·운영)를 가중 토큰 점유율로 배분한다. 출력 토큰 가중치 ${OUTPUT_WEIGHT}.`,
  },
  {
    k: '부서 분해',
    v: '계열사 정산액을 부서 사용 비율로 재분배한다. 부서는 SSO 조직 정보를 따른다.',
  },
  {
    k: '정산 주기',
    v: '월 1회 마감. 마감 후 조정은 차월 정산에 반영하며, 원 데이터는 감사 원장에 보존된다.',
  },
];

/* ═══════════════════════ 사용자별 분해 ═══════════════════════ */

/**
 * RFP LSM-010 은 "회사별, 부서별, **개별 사용자별** 토큰 사용량(Input/Output 및
 * 컨텍스트 구분)의 실시간 정밀 측정 및 적산" 을 요구한다. 계열사 → 부서까지만
 * 내려가면 "개별 사용자별" 이 비므로 한 단계 더 판다.
 *
 * 이름은 전부 가상 창작물이며, 실제 운영 화면에서는 사번 기반 마스킹 ID 를 쓴다.
 */
export interface UserRow {
  /** 마스킹 ID — 감사 목적 외에는 실명을 노출하지 않는다. */
  maskedId: string;
  name: string;
  dept: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  /** 이 부서 안에서의 사용 비중(%). */
  pct: number;
}

/** 부서 내 상위 사용자 분포 — 상위 5명이 부서 사용량의 대부분을 차지하는 형태. */
const USER_SHAPE: { maskedId: string; name: string; ratio: number }[] = [
  { maskedId: 'usr_3f81', name: '김OO', ratio: 0.19 },
  { maskedId: 'usr_a27c', name: '이OO', ratio: 0.15 },
  { maskedId: 'usr_9d04', name: '박OO', ratio: 0.12 },
  { maskedId: 'usr_c5b2', name: '최OO', ratio: 0.09 },
  { maskedId: 'usr_71ea', name: '정OO', ratio: 0.07 },
];

export function getUserRows(tenantName: string, dept: string): UserRow[] {
  const d = getDeptRows(tenantName).find((x) => x.dept === dept);
  if (!d) return [];
  const rows = USER_SHAPE.map((u) => ({
    maskedId: u.maskedId,
    name: u.name,
    dept,
    inputTokens: Math.round(d.inputTokens * u.ratio),
    outputTokens: Math.round(d.outputTokens * u.ratio),
    cost: Math.round(d.cost * u.ratio),
    pct: u.ratio * 100,
  }));
  // 나머지는 "그 외" 로 묶는다 — 합계가 부서 총액과 어긋나면 정산 화면의 신뢰가 깨진다.
  const restRatio = 1 - USER_SHAPE.reduce((a, u) => a + u.ratio, 0);
  rows.push({
    maskedId: '—',
    name: `그 외 ${Math.max(d.users - USER_SHAPE.length, 0).toLocaleString('ko-KR')}명`,
    dept,
    inputTokens: Math.round(d.inputTokens * restRatio),
    outputTokens: Math.round(d.outputTokens * restRatio),
    cost: Math.round(d.cost * restRatio),
    pct: restRatio * 100,
  });
  return rows;
}

/* ═══════════════════════ 월별 정산 리포트 ═══════════════════════ */

/**
 * RFP ONM-005 는 "월별 사내 과금(Internal Billing) 및 비용 정산 리포트를
 * **자동 생성**하는 정산 기능" 을 요구한다. 화면에 숫자만 있고 산출물이 없으면
 * 요건의 뒤쪽 절반이 빈다.
 */
export interface SettlementReport {
  id: string;
  month: string;
  /** 산출 상태. */
  state: 'issued' | 'scheduled';
  /** 자동 산출 시각(예정 포함). */
  runAt: string;
  /** 포함 계열사 수. */
  tenants: number;
  totalCost: number;
  formats: string[];
}

export const SETTLEMENT_REPORTS: SettlementReport[] = [
  {
    id: 'STL-2026-05',
    month: '2026-05',
    state: 'scheduled',
    runAt: '2026-06-01 06:00 자동 산출 예정',
    tenants: 10,
    totalCost: 0, // 화면에서 현재 합계로 채운다
    formats: ['XLSX', 'PDF'],
  },
  {
    id: 'STL-2026-04',
    month: '2026-04',
    state: 'issued',
    runAt: '2026-05-01 06:00',
    tenants: 10,
    totalCost: 189_400_000,
    formats: ['XLSX', 'PDF'],
  },
  {
    id: 'STL-2026-03',
    month: '2026-03',
    state: 'issued',
    runAt: '2026-04-01 06:00',
    tenants: 10,
    totalCost: 176_800_000,
    formats: ['XLSX', 'PDF'],
  },
];

/* ═══════════════════════ 에이전트별 미터링 (AGB-010) ═══════════════════════ */

/**
 * RFP AGB-010 에이전트별 미터링 (권고)
 *   "생성된 **에이전트별**, 사용자/회사 단위별 **호출 빈도 및 발생 토큰 사용량**에 대한
 *    실시간 미터링 및 통계 제공"
 *
 * 계열사·부서·사용자 축(LSM-010)과 별개로 **에이전트 축**이 필요하다.
 * "어느 조직이 썼나" 와 "무엇이 비용을 먹나" 는 다른 질문이고,
 * 후자가 있어야 비싼 에이전트를 골라 최적화할 수 있다.
 *
 * ⚠️ **전수 표다.** 예전에는 손으로 적은 9행만 있어서, 바로 위 계열사 표가
 * 47개 에이전트를 말하는데 아래 표는 9행뿐인 상태가 한 화면에 같이 떠 있었다.
 * 지금은 `mockAdminDashboard.getMeteringAgentBase()` 가 카탈로그 13종 +
 * 그룹 공통 10종에서 **호출이 발생한 에이전트 전부**를 넘겨 준다.
 */
export interface AgentMeteringRow {
  agentId: string;
  name: string;
  /** 제작 주관 계열사. */
  tenant: string;
  /** 그룹 공통 운영영역 자산인가 — 10개 계열사가 함께 쓴다. */
  groupShared: boolean;
  /** 소속 과제. */
  taskId: string;
  /** 이번 달 호출 수. */
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  /** 호출 1건당 평균 비용(원). */
  costPerCall: number;
  /** 전월 대비 호출 증감(%). */
  deltaPct: number;
}

export function getAgentRows(): AgentMeteringRow[] {
  const totals = getMeteringTotals();
  const base = getMeteringAgentBase();
  // 토큰 비중대로 총 정산액을 나눈다 — 조직 축 합계와 어긋나면 화면이 서로 다른 말을 한다.
  const weighted = base.map((a) => a.inputTokens + a.outputTokens * OUTPUT_WEIGHT);
  const sum = weighted.reduce((x, y) => x + y, 0) || 1;
  return base
    .map((a, i) => {
      const cost = Math.round((totals.cost * weighted[i]) / sum);
      return {
        agentId: a.agentId,
        name: a.name,
        tenant: a.tenant,
        groupShared: a.groupShared,
        taskId: a.taskId,
        calls: a.calls,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        cost,
        costPerCall: Math.round(cost / Math.max(1, a.calls)),
        deltaPct: a.deltaPct,
      };
    })
    .sort((x, y) => y.cost - x.cost);
}
