/**
 * AI 거버넌스 포탈 mock — 핸드오프 §2 화면 14 (P0 ★).
 *
 * RFP: 2-3 AI거버넌스 포탈 전체
 *
 * 무엇을 근거로 썼는가 — 화면에 등장하는 의무 항목은 **AI기본법(인공지능 발전과
 * 신뢰 기반 조성 등에 관한 기본법, 2026-01-22 시행)** 이 정한 일반적 의무 구조를
 * 따른다: 고영향 인공지능 해당 여부 확인 · 안전성 확보 조치 · 영향평가 ·
 * 생성형 인공지능 산출물 표시 · 이용자 고지 · 지속적 모니터링.
 *   ⚠️ 조문 번호는 적지 않는다. 데모 화면의 문구가 곧 확약이 되는 구조(RFP Ⅳ.4.1)
 *      에서 조문을 잘못 달면 그대로 리스크가 된다. 법령 인용이 필요하면 제안서
 *      본문에서 법무 검토를 거쳐 넣을 것.
 *
 * 등급 체계가 둘인 이유 —
 *   · `highImpact` = **법상 고영향 인공지능 해당 여부** (예/아니오)
 *   · `riskGrade`  = **내부 위험등급 고/중/저** (핸드오프 화면 14 요구)
 * 둘은 다른 축이다. 고영향이면 내부등급도 대개 '고'지만, 고영향이 아닌데도
 * 내부적으로 '고'인 경우가 있다(대외 노출·평판 리스크 등). 화면에서 두 축을
 * 겹쳐 보여줘야 "우리는 법 요건과 내부 통제를 따로 관리한다"가 성립한다.
 *
 * 기준일 — `demoClock.DEMO_TODAY` 를 그대로 쓴다. 이 값이 화면에 "기준일"로
 *   노출되기 때문에, 여기만 다른 날짜를 들고 있으면 정거장 13(가드레일 이력)
 *   → 14(거버넌스)로 넘어가는 순간 기준일이 점프하는 게 그대로 보인다.
 *   D-day 도 손으로 적지 않고 `nextDueAt` 에서 계산한다 — 날짜를 옮길 때
 *   D-day 를 같이 못 고쳐서 어긋나는 사고를 구조적으로 막는다.
 *   실시간 시계(Date.now())는 쓰지 않는다. 리허설과 본 시연의 화면이 달라진다.
 *
 * 소유자 — 계열사 자산의 소유자는 **그 계열사 소속 인물**이어야 한다.
 *   `mockPersonas` 의 계열사 계정은 `canSwitchTenant: false` 라 자기 Namespace
 *   밖으로 나가지 못한다(SEC-001). 부산은행 사람이 BNK시스템 자산의 소유자로
 *   원장에 찍혀 있으면 그 화면이 곧 SEC-001 을 부정한다.
 *
 * ⚠️ 전부 가상 데이터다. 실제 BNK 서비스·담당자·평가 결과가 아니다.
 */
import type { Tenant } from '@/data/tenants';
import { DEMO_TODAY, dDayFrom } from '@/data/demoClock';

/** 데모 기준일 — 화면 곳곳의 '오늘'. 세계관 시계와 항상 같은 값이다. */
export const GOV_TODAY = DEMO_TODAY;

/* ═══════════════════════ 라이프사이클 ═══════════════════════ */

export type LifecycleStage = 'plan' | 'build' | 'assess' | 'operate' | 'retire';

export interface ApprovalLine {
  seq: number;
  role: string;
  org: string;
  note: string;
}

export interface StageMeta {
  id: LifecycleStage;
  seq: number;
  label: string;
  /** 이 단계에서 무엇을 하는가. */
  desc: string;
  /** 다음 단계로 넘어가기 위한 관문 — 통과 못 하면 진행 불가. */
  gate: string;
  approvals: ApprovalLine[];
  outputs: string[];
  /** 이 단계에서 이행하는 AI기본법 대응 의무. */
  duties: string[];
}

export const LIFECYCLE: StageMeta[] = [
  {
    id: 'plan',
    seq: 1,
    label: '기획',
    desc:
      'AI 서비스를 거버넌스 원장에 등록하고, 법상 고영향 인공지능 해당 여부와 내부 위험등급을 1차 판단한다.',
    gate: '고영향 해당 여부 판단서 없이는 개발 단계로 넘어갈 수 없다',
    approvals: [
      { seq: 1, role: '기안', org: '사업 주관 부서', note: '서비스 등록서 작성' },
      { seq: 2, role: '검토', org: '부서장', note: '사업 타당성·범위 확인' },
      { seq: 3, role: '승인', org: 'AI거버넌스 사무국', note: '등급 분류 확정' },
    ],
    outputs: ['AI 서비스 등록서', '고영향 해당 여부 판단서', '내부 위험등급 분류표'],
    duties: ['고영향 인공지능 해당 여부 확인', '이용 목적·대상 범위 특정'],
  },
  {
    id: 'build',
    seq: 2,
    label: '개발',
    desc:
      '학습·RAG 데이터의 권원을 확인하고, 가드레일 정책과 안전성 확보 조치를 설계·적용한다.',
    gate: '데이터 권원 확인서와 가드레일 정책 승인이 모두 있어야 평가 단계로 넘어간다',
    approvals: [
      { seq: 1, role: '기안', org: '개발 담당', note: '데이터·모델 구성안' },
      { seq: 2, role: '검토', org: '정보보호 그룹', note: '개인정보·권원 확인' },
      { seq: 3, role: '승인', org: '플랫폼 관리 그룹', note: '가드레일 정책 적용' },
    ],
    outputs: ['데이터 권원 확인서', '가드레일 정책서', '안전성 확보 조치 계획'],
    duties: ['안전성 확보 조치 설계', '학습 데이터 출처·권원 관리'],
  },
  {
    id: 'assess',
    seq: 3,
    label: '평가 · 검증',
    desc:
      '성능 평가와 레드팀을 수행하고, 고영향 서비스는 영향평가를 실시해 위험관리방안을 수립한다.',
    gate: '고영향 서비스는 영향평가서가 없으면 운영 배포 결재가 반려된다',
    approvals: [
      { seq: 1, role: '기안', org: '개발 담당', note: '평가 결과 제출' },
      { seq: 2, role: '검토', org: '리스크 관리부', note: '위험관리방안 적정성' },
      { seq: 3, role: '승인', org: 'AI거버넌스 위원회', note: '운영 진입 승인' },
    ],
    outputs: ['성능평가 보고서', '레드팀 결과서', '영향평가서', '위험관리방안'],
    duties: ['영향평가 실시', '위험관리방안 수립', '편향·안전성 검증'],
  },
  {
    id: 'operate',
    seq: 4,
    label: '운영',
    desc:
      '운영계 배포 후 생성형 AI 산출물 표시와 이용자 고지를 적용하고, 지표를 상시 모니터링하며 연 1회 재평가한다.',
    gate: '연 1회 재평가 기일이 도래하면 자동으로 결재가 기안되고, 경과 시 노출이 제한된다',
    approvals: [
      { seq: 1, role: '기안', org: '운영 담당', note: '배포·재평가 신청' },
      { seq: 2, role: '검토', org: '승인권자', note: '운영 적합성' },
      { seq: 3, role: '승인', org: '플랫폼 관리 그룹', note: '서빙계 반영' },
    ],
    outputs: ['월간 모니터링 리포트', '연간 재평가서', '이용자 고지문'],
    duties: ['생성형 AI 산출물 표시', '이용자 고지', '지속적 모니터링', '연 1회 재평가'],
  },
  {
    id: 'retire',
    seq: 5,
    label: '종료',
    desc: '서비스를 폐기하고 학습·색인 데이터를 파기하되, 감사에 필요한 기록은 보존한다.',
    gate: '데이터 파기 증빙 없이는 원장에서 종료 처리되지 않는다',
    approvals: [
      { seq: 1, role: '기안', org: '운영 담당', note: '폐기 신청' },
      { seq: 2, role: '검토', org: '정보보호 그룹', note: '파기 범위 확인' },
      { seq: 3, role: '승인', org: 'AI거버넌스 사무국', note: '원장 종료 처리' },
    ],
    outputs: ['서비스 폐기 확인서', '데이터 파기 증빙', '기록 보존 목록'],
    duties: ['데이터 파기', '감사 기록 보존'],
  },
];

export const STAGE_LABEL: Record<LifecycleStage, string> = LIFECYCLE.reduce(
  (a, s) => ({ ...a, [s.id]: s.label }),
  {} as Record<LifecycleStage, string>,
);

/* ═══════════════════════ AI 서비스 원장 ═══════════════════════ */

export type RiskGrade = '고' | '중' | '저';

export interface AiService {
  id: string;
  name: string;
  tenant: Tenant;
  stage: LifecycleStage;
  /** 내부 위험등급. */
  riskGrade: RiskGrade;
  /** 법상 고영향 인공지능 해당 여부. */
  highImpact: boolean;
  /** 고영향으로 본 근거 — 해당하는 경우에만. */
  highImpactBasis?: string;
  /** 생성형 AI 산출물 표시 의무 적용 여부. */
  genAiNotice: boolean;
  owner: string;
  /** 최근 영향평가·재평가 실시일. */
  lastAssessedAt: string;
  /** 다음 재평가 기일 (연 1회). 종료된 서비스는 '—'. */
  nextDueAt: string;
  /**
   * 기준일(GOV_TODAY) 대비 남은 일수. 음수면 경과.
   * **`nextDueAt` 에서 파생 계산한다** — 손으로 적으면 날짜만 고치고 D-day 를
   * 못 고쳐서 "기일 2일 남음 / 2026-06-10" 같은 모순이 조용히 남는다.
   * 기일이 없는 종료 서비스는 정렬에서 맨 뒤로 밀리도록 9999.
   */
  dDay: number;
}

/** 원장 시드 — D-day 는 여기 적지 않는다(아래에서 계산). */
const AI_SERVICE_SEED: Omit<AiService, 'dDay'>[] = [
  {
    id: 'AIS-001', name: '여신심사 보조 에이전트', tenant: '부산은행', stage: 'operate',
    riskGrade: '고', highImpact: true, highImpactBasis: '신용 공여 심사에 활용',
    genAiNotice: true, owner: '정오너', lastAssessedAt: '2025-06-10', nextDueAt: '2026-06-10',
  },
  {
    id: 'AIS-002', name: '개인신용대출 한도 산정 지원', tenant: '경남은행', stage: 'operate',
    riskGrade: '고', highImpact: true, highImpactBasis: '신용 공여 심사에 활용',
    genAiNotice: false, owner: '남데이터', lastAssessedAt: '2025-05-15', nextDueAt: '2026-05-15',
  },
  {
    id: 'AIS-003', name: '채용 서류 요약 어시스턴트', tenant: 'BNK시스템', stage: 'assess',
    riskGrade: '고', highImpact: true, highImpactBasis: '채용 과정에 활용',
    genAiNotice: true, owner: '노운영', lastAssessedAt: '—', nextDueAt: '2026-07-24',
  },
  {
    id: 'AIS-004', name: 'PB 자산진단 어시스턴트', tenant: '부산은행', stage: 'operate',
    riskGrade: '중', highImpact: false,
    genAiNotice: true, owner: '박서연', lastAssessedAt: '2025-06-29', nextDueAt: '2026-06-29',
  },
  {
    id: 'AIS-005', name: '규정·책무 질의 어시스턴트', tenant: '그룹 공통', stage: 'operate',
    riskGrade: '중', highImpact: false,
    genAiNotice: true, owner: '박거버', lastAssessedAt: '2025-08-04', nextDueAt: '2026-08-04',
  },
  {
    id: 'AIS-006', name: '보험금 지급심사 보조', tenant: 'BNK캐피탈', stage: 'assess',
    riskGrade: '고', highImpact: true, highImpactBasis: '보험료·보험금 산출에 활용',
    genAiNotice: false, owner: '정우진', lastAssessedAt: '—', nextDueAt: '2026-07-26',
  },
  {
    id: 'AIS-007', name: '콜센터 상담 요약', tenant: '부산은행', stage: 'operate',
    riskGrade: '저', highImpact: false,
    genAiNotice: true, owner: '서사용', lastAssessedAt: '2025-10-12', nextDueAt: '2026-10-12',
  },
  {
    id: 'AIS-008', name: '자금세탁 이상거래 탐지 보조', tenant: '경남은행', stage: 'operate',
    riskGrade: '고', highImpact: false,
    genAiNotice: false, owner: '임정보', lastAssessedAt: '2025-06-23', nextDueAt: '2026-06-23',
  },
  {
    id: 'AIS-009', name: '내부 규정 개정 초안 작성', tenant: '그룹 공통', stage: 'build',
    riskGrade: '저', highImpact: false,
    genAiNotice: true, owner: '이사업', lastAssessedAt: '—', nextDueAt: '2026-09-23',
  },
  {
    id: 'AIS-010', name: '펀드 상품설명 요약', tenant: 'BNK투자증권', stage: 'build',
    riskGrade: '중', highImpact: false,
    genAiNotice: true, owner: '이서연', lastAssessedAt: '—', nextDueAt: '2026-10-08',
  },
  {
    id: 'AIS-011', name: '기업여신 재무분석 보조', tenant: '부산은행', stage: 'plan',
    riskGrade: '고', highImpact: true, highImpactBasis: '신용 공여 심사에 활용',
    genAiNotice: false, owner: '조디비', lastAssessedAt: '—', nextDueAt: '2026-11-23',
  },
  {
    id: 'AIS-012', name: '사내 복리후생 안내 봇', tenant: 'BNK저축은행', stage: 'plan',
    riskGrade: '저', highImpact: false,
    genAiNotice: true, owner: '김재훈', lastAssessedAt: '—', nextDueAt: '2026-12-24',
  },
  {
    id: 'AIS-013', name: '리스 자산 잔가 예측 보조', tenant: 'BNK캐피탈', stage: 'retire',
    riskGrade: '중', highImpact: false,
    genAiNotice: false, owner: '이사업', lastAssessedAt: '2025-12-28', nextDueAt: '—',
  },
];

/** 기일 없는 종료 서비스는 D-day 정렬에서 맨 뒤로 보낸다. */
const NO_DUE = 9999;

export const AI_SERVICES: AiService[] = AI_SERVICE_SEED.map((s) => ({
  ...s,
  dDay: s.nextDueAt === '—' ? NO_DUE : dDayFrom(s.nextDueAt),
}));

/* ═══════════════════════ 집계 ═══════════════════════ */

export const RISK_META: Record<RiskGrade, { cls: string; bar: string }> = {
  고: { cls: 'bg-bad-bg text-bad border-bad-border', bar: 'bg-bad' },
  중: { cls: 'bg-warn-bg text-warn border-warn-border', bar: 'bg-warn' },
  저: { cls: 'bg-ok-bg text-ok border-ok-border', bar: 'bg-ok' },
};

/** 종료된 서비스는 현황 집계에서 뺀다 — 원장에는 남지만 '운영 중인 위험'이 아니다. */
export const ACTIVE_SERVICES = AI_SERVICES.filter((s) => s.stage !== 'retire');

export function countByStage(stage: LifecycleStage): number {
  return AI_SERVICES.filter((s) => s.stage === stage).length;
}

export function countByRisk(grade: RiskGrade): { total: number; highImpact: number } {
  const list = ACTIVE_SERVICES.filter((s) => s.riskGrade === grade);
  return { total: list.length, highImpact: list.filter((s) => s.highImpact).length };
}

/** 기일이 도래했거나 임박한 서비스 — D-day 오름차순. */
export function dueServices(withinDays: number): AiService[] {
  return ACTIVE_SERVICES.filter((s) => s.dDay <= withinDays).sort((a, b) => a.dDay - b.dDay);
}

export const GOV_STATS = {
  total: ACTIVE_SERVICES.length,
  highImpact: ACTIVE_SERVICES.filter((s) => s.highImpact).length,
  operating: AI_SERVICES.filter((s) => s.stage === 'operate').length,
  /** 기일 경과 — 즉시 조치 대상. */
  overdue: ACTIVE_SERVICES.filter((s) => s.dDay < 0).length,
  /** 30일 내 도래. */
  dueSoon: ACTIVE_SERVICES.filter((s) => s.dDay >= 0 && s.dDay <= 30).length,
  /** 영향평가 미실시 (고영향인데 최근 평가일이 없는 것). */
  assessPending: ACTIVE_SERVICES.filter((s) => s.highImpact && s.lastAssessedAt === '—').length,
  genAiNotice: ACTIVE_SERVICES.filter((s) => s.genAiNotice).length,
};
