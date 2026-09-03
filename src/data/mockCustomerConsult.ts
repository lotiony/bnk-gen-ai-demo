/**
 * 고객 상담 워크스페이스 mock — 시나리오 1 (1-3 ~ 1-8).
 *
 * RFP: AGB-006 ⑤ 고객/민원 분석 및 마케팅 · SEC-007 동의 권원 · EDA-001 가상 뷰(zero-copy) · ONM-004 감사
 *
 * 문구 규칙 (확약 관점 — 데모에 넣은 건 계약 확약이다, RFP Ⅳ.4.1)
 *  · 화면에 그리는 잔액·거래는 **부산은행 것만**이다. 타 계열사는 "거래 있음" 플래그까지만.
 *    타 계열사 잔액을 그리면 SEC-001 격리 서사와 정면충돌한다.
 *  · 조회는 "고객 DB 가상 뷰(RLS/CLS)" 다 — 정형 = zero-copy. 복제 적재라고 쓰지 않는다.
 *  · 추천 근거는 "상품 인덱스 통계" 로 출처를 한정한다. 실데이터 추천을 무한정 약속하지 않는다.
 *  · 예상 이자는 규칙 계산이고 계산식을 노출한다 — "확률 추측이 아니라 계산" 메시지와 같은 결.
 *
 * ⚠️ 전부 가상 데이터다(CLAUDE.md 절대 규칙). 실제 고객·상품 아님.
 */
import type { Tenant } from './tenants';

export const CONSULT_AGENT = {
  id: 'GRP-005',
  name: '고객 · 민원 분석 에이전트',
  useCase: '고객/민원 분석 및 마케팅',
  tenant: '그룹 공통' as Tenant,
  model: 'onprem/qwen3-32b',
  state: '운영 중',
};

/** 6단계 — 시나리오 1-3 ~ 1-8 과 1:1 로 대응한다. */
export const CONSULT_STEPS = [
  { id: 'profile', label: '프로필 등록', scene: '1-3' },
  { id: 'consent', label: '동의 확인', scene: '1-4' },
  { id: 'lookup', label: '데이터 조회', scene: '1-5' },
  { id: 'analysis', label: '분석 결과', scene: '1-6' },
  { id: 'products', label: '상품 추천', scene: '1-7' },
  { id: 'summary', label: '상담 요약', scene: '1-8' },
] as const;

export type ConsultStepId = (typeof CONSULT_STEPS)[number]['id'];

/* ───────────── ① 프로필 등록 ───────────── */

export const CUSTOMER_DEFAULT = {
  name: '김보람',
  phone: '010-****-4821',
  background: 'VIP 고객 자산 관리 상담 요청 — 6월 만기 정기예금 재예치와 여유자금 운용 문의',
};

/** 계열사 거래 여부 체크박스 — 행원이 아는 범위에서 체크한다. 잔액은 묻지 않는다. */
export const AFFILIATE_OPTIONS: { tenant: Tenant; hint: string; defaultOn: boolean }[] = [
  { tenant: 'BNK캐피탈', hint: '오토론', defaultOn: true },
  { tenant: 'BNK투자증권', hint: 'CMA', defaultOn: true },
  { tenant: '경남은행', hint: '', defaultOn: false },
  { tenant: 'BNK저축은행', hint: '', defaultOn: false },
];

/* ───────────── ② 동의 확인 ───────────── */

export const CONSENT = {
  status: '동의 확인됨',
  purpose: '마케팅 목적 제3자 제공·이용 (그룹 계열사 간)',
  obtainedAt: '2026-03-12 14:05',
  channel: '영업점 서면 · 부산은행 서면동의 스캔',
  validUntil: '2028-03-11',
  ref: 'CONSENT-BS-2026-031204',
  /** 화면 9 「승인 기반 DB 라우팅」의 동의 권원 게이트와 같은 이름을 쓴다 — 두 화면이 같은 말을 해야 한다. */
  gate: '동의 권원 확인 · SEC-007',
};

/* ───────────── ③ 데이터 조회 ───────────── */

export interface LookupStep {
  id: string;
  label: string;
  source: string;
  ms: number;
  /** 완료 시 옆에 쌓이는 요약 — 부산은행 데이터만. */
  summary: string;
}

export const LOOKUP_SOURCE = '고객 DB 가상 뷰 (RLS/CLS) · ns-bank-bs · 데이터 복제 없음';

export const LOOKUP_STEPS: LookupStep[] = [
  {
    id: 'deposit',
    label: '수신 — 예·적금 잔액·만기',
    source: 'DEPOSIT_V (가상 뷰)',
    ms: 750,
    summary: '정기예금 2건 1억 2,000만 · 입출금 3,400만 · 6월 만기 1건(1억)',
  },
  {
    id: 'loan',
    label: '여신 — 대출 잔액·상환 이력',
    source: 'LOAN_V (가상 뷰)',
    ms: 650,
    summary: '주택담보대출 잔액 8,600만 · 연체 이력 없음 · 약정 상환률 100%',
  },
  {
    id: 'tx',
    label: '거래 이력 — 최근 24개월',
    source: 'TX_HIST_V (가상 뷰)',
    ms: 850,
    summary: '월평균 41건 · 급여성 입금 정기 · 자동이체 7건 · 해외송금 0건',
  },
];

/* ───────────── ④ 분석 결과 ───────────── */

export const PROFILE = {
  name: '김보람',
  age: 52,
  job: '자영업 (요식업)',
  mainBank: '부산은행',
  since: '2018-04',
  years: 8,
  grade: 'VIP',
};

export const ASSETS = [
  { k: '수신', v: '1억 5,400만', sub: '정기예금 1억 2,000만 · 입출금 3,400만' },
  { k: '여신', v: '8,600만', sub: '주택담보대출 · 연체 없음' },
  { k: '총 자산 (부산은행 기준)', v: '1억 5,400만', sub: '타 계열사 자산은 집계하지 않음' },
];

export const TENDENCY = {
  fixedPct: 20,
  liquidPct: 80,
  type: '안정형',
  loyalty: '높음',
  years: 8,
  lines: ['정기성 20% · 유동성 80%', '안정형 (원금 보전 선호)', '이용 기간 8년 · 충성도 높음'],
  evidence: [
    { label: '수신 구성 비율', ref: 'DEPOSIT_V · 2026-06' },
    { label: '거래 패턴 24개월', ref: 'TX_HIST_V · 2024-07 ~ 2026-06' },
    { label: '여신 상환 이력', ref: 'LOAN_V · 연체 0건' },
  ],
};

/* ───────────── ⑤ 상품 추천 ───────────── */

export interface Product {
  id: string;
  name: string;
  rate: string;
  term: string;
  /** 추천 근거 — 상품 인덱스 통계. */
  evidence: string;
  fit: string;
  recommended: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: 'DP-2026-07',
    name: 'BNK 든든 정기예금',
    rate: '연 3.45%',
    term: '12개월',
    evidence: '유사 프로필 고객 해지율 1.8% (최저) · 만족도 4.7/5',
    fit: '안정형 · 만기 재예치 목적에 부합',
    recommended: true,
  },
  {
    id: 'SV-2026-03',
    name: 'BNK 플러스 자유적금',
    rate: '연 3.10%',
    term: '24개월',
    evidence: '유사 프로필 고객 해지율 4.2% · 만족도 4.4/5',
    fit: '여유자금 분할 적립 시',
    recommended: false,
  },
  {
    id: 'PK-2026-01',
    name: 'BNK 파킹통장',
    rate: '연 2.80%',
    term: '수시',
    evidence: '유동성 선호 고객 만족도 4.5/5',
    fit: '유동성 80% 성향 · 대기자금',
    recommended: false,
  },
];

export const EVIDENCE_SOURCE = '상품 인덱스 통계 · 최근 12개월 · 유사 프로필 = 50대 · 안정형 · VIP';

/** 예상 이자 — 규칙 계산. 계산식을 화면에 그대로 보여 준다. */
export const INTEREST = {
  principal: '1억원 (6월 만기 정기예금 재예치 가정)',
  formula: '100,000,000 × 3.45% × 12/12',
  gross: '3,450,000원',
  tax: '531,300원 (15.4%)',
  net: '2,918,700원',
};

/* ───────────── ⑥ 상담 요약 ───────────── */

export const SUMMARY = {
  needs: ['6월 만기 정기예금 1억 재예치', '여유자금 3,000만 운용처', '원금 보전 우선'],
  tendency: '안정형 · 유동성 선호 · 충성도 높음',
  recommended: 'BNK 든든 정기예금 12개월 (연 3.45%) — 세후 예상 이자 2,918,700원',
  alt: '대기자금은 BNK 파킹통장',
  /** 후속 조치 — 여기서 시나리오 1-9(마켓플레이스 검색)로 이어진다. */
  followUp: {
    title: '추천 상품 가입 전 고객 신용평가 확인이 필요합니다',
    body: '신용평가 조회는 BNK신용정보 소유 에이전트가 담당합니다. 마켓플레이스에서 찾아 연결하세요.',
    query: '신용평가',
    cta: '신용평가 에이전트 찾기',
  },
};
