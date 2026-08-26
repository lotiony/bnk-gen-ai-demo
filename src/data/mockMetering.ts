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
} from '@/data/mockAdminDashboard';
import { AFFILIATES } from '@/data/tenants';

/** 정산 대상 월 — 데모는 한 달만 다룬다. */
export const BILLING_MONTH = '2026-01';

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
  agents: number;
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

const USERS: Record<string, number> = {
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
