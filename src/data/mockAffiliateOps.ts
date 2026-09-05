/**
 * 계열사 관리자의 이상 탐지·조치 mock — 시연 3막 파트 A (3A-1 ~ 3A-6).
 *
 * RFP: AGB-009(에이전트 실행 로그·추적, 필수) · ONM-002(모니터링) ·
 *      2-1 관리자 포털 34·38 · SEC-009(감사 추적)
 *
 * 서사 —
 *   부산은행 관리자가 아침에 접속하니 이상 알림이 떠 있다. 자기 계열사의
 *   **GRP-005 고객·민원 분석 에이전트**(시연 1막에서 행원이 쓴 그 자산)가
 *   어제 대비 호출 3배다. 미터링에서 급증 시점을 찾고, 에이전트별 순위에서
 *   범인을 특정하고, 실행 로그에서 반복 호출 패턴을 보고, 시스템 진단이
 *   루프 가능성을 알려 주면 관리자가 원인을 판단해 개발팀에 넘긴다.
 *
 * ⚠️ **관리자는 에이전트를 쓰지 않는다.** 데이터를 보고 사람이 판단하는
 *    관제 역할이다. 그래서 여기 어디에도 "AI 가 조치했다" 는 말이 없다 —
 *    시스템은 패턴을 **표시**하고, 판단과 조치는 관리자 몫이다.
 *
 * 숫자 규약 — 세계관 오늘은 2026-06-03. 어제(06-02) 14:20 부터 급증했다.
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

/* ═══════════════════════ 3A-1 · 3A-2 이상 알림 ═══════════════════════ */

export type AnomalySeverity = '높음' | '보통';

export interface AnomalyAlert {
  id: string;
  tenant: Tenant;
  /** 이상이 감지된 자산. 카탈로그·미터링과 같은 ID 를 쓴다. */
  agentId: string;
  agentName: string;
  taskId: string;
  taskName: string;
  severity: AnomalySeverity;
  headline: string;
  detectedAt: string;
  /** 어떤 규칙이 이걸 잡았는가 — 근거 없는 알림은 관제가 아니다. */
  rule: string;
  ruleDetail: string;
  /** 급증이 시작된 시점. 미터링 추이 그래프의 표식과 같은 값이다. */
  surgeFrom: string;
  baselineCalls: number;
  currentCalls: number;
  /** 배수 — 화면에 "3배" 로 나온다. */
  multiple: number;
  affectedUsers: number;
}

export const ANOMALY_ALERTS: AnomalyAlert[] = [
  {
    id: 'ANM-2026-0603-01',
    tenant: '부산은행',
    agentId: 'GRP-005',
    agentName: '고객 · 민원 분석 에이전트',
    taskId: 'PRJ-BS-061',
    taskName: '고객상담 자동화 과제',
    severity: '높음',
    headline: '고객 · 민원 분석 에이전트 사용량 어제 대비 3배 증가',
    detectedAt: '2026-06-03 08:12',
    rule: '사용량 급증 감지 · 일일 호출 임계 초과',
    ruleDetail:
      '직전 14일 일평균 대비 200% 초과가 30분 이상 지속되면 알린다 · 임계 300% 도달',
    surgeFrom: '2026-06-02 14:20',
    baselineCalls: 2270,
    currentCalls: 6810,
    multiple: 3.0,
    affectedUsers: 12,
  },
];

/* ═══════════════════════ 3A-5 실행 로그 이상 패턴 ═══════════════════════ */

export interface CallLogRow {
  at: string;
  /** 마스킹 사용자 ID — 감사 목적 외 실명 노출 안 함(LSM-013 과 같은 규칙). */
  maskedUser: string;
  dept: string;
  ms: number;
  status: '정상' | '지연' | '타임아웃';
  /** 직전 호출과의 간격(초). 반복 호출 판정의 근거. */
  gapSec: number | null;
  /** 같은 입력의 몇 번째 반복인가. 1 이면 최초. */
  repeatSeq: number;
  query: string;
}

/**
 * 실행 이력 — 반복 호출 패턴이 눈에 보이게 짰다.
 * `u-***7d31` 이 같은 질의를 8초 안팎 간격으로 반복하고, 반복이 쌓일수록
 * 응답이 느려지다 타임아웃에 닿는다. 화면은 이 두 축(간격·처리시간)을 그린다.
 */
export const SURGE_CALL_LOG: CallLogRow[] = [
  { at: '2026-06-03 08:11:47', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 9120, status: '타임아웃', gapSec: 7,  repeatSeq: 24, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:11:40', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 8340, status: '지연',   gapSec: 8,  repeatSeq: 23, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:11:32', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 7980, status: '지연',   gapSec: 8,  repeatSeq: 22, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:11:24', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 7410, status: '지연',   gapSec: 9,  repeatSeq: 21, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:11:15', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 6880, status: '지연',   gapSec: 8,  repeatSeq: 20, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:11:07', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 6220, status: '지연',   gapSec: 7,  repeatSeq: 19, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:10:12', maskedUser: 'u-***a04c', dept: '개인영업부', ms: 1840, status: '정상',   gapSec: null, repeatSeq: 1, query: '고객 상담 내용 요약' },
  { at: '2026-06-03 08:09:58', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 5960, status: '지연',   gapSec: 8,  repeatSeq: 18, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
  { at: '2026-06-03 08:08:31', maskedUser: 'u-***c2f8', dept: '고객만족부', ms: 2110, status: '정상',   gapSec: null, repeatSeq: 1, query: '민원 유형 자동 분류' },
  { at: '2026-06-03 08:07:44', maskedUser: 'u-***7d31', dept: '고객만족부', ms: 5410, status: '지연',   gapSec: 8,  repeatSeq: 17, query: '민원 유형 분류 후 회신 초안 생성 (첨부 3건)' },
];

/** 반복 호출 상위 — "특정 사용자가 짧은 간격으로" 를 수치로 뒷받침한다. */
export interface RepeatCaller {
  maskedUser: string;
  dept: string;
  calls24h: number;
  /** 평균 호출 간격(초). */
  avgGapSec: number;
  sharePct: number;
}

export const REPEAT_CALLERS: RepeatCaller[] = [
  { maskedUser: 'u-***7d31', dept: '고객만족부', calls24h: 3180, avgGapSec: 8, sharePct: 67.4 },
  { maskedUser: 'u-***c2f8', dept: '고객만족부', calls24h: 214, avgGapSec: 402, sharePct: 4.5 },
  { maskedUser: 'u-***a04c', dept: '개인영업부', calls24h: 186, avgGapSec: 465, sharePct: 3.9 },
];

/* ═══════════════════════ 3A-6 시스템 진단 ═══════════════════════ */

export interface LoopDiagnosis {
  verdict: string;
  confidence: '높음' | '보통' | '낮음';
  /** 무엇을 보고 그렇게 판정했는가 — 진단 근거를 화면에 적는다. */
  signals: { k: string; v: string }[];
  /** 원인으로 지목되는 워크플로우 — 화면에서 바로 열 수 있게 ID 로 잇는다. */
  workflowId: string;
  workflowName: string;
  workflowNode: string;
  affectedUsers: number;
  /** 관리자가 넘길 곳. 조치 자체는 자막으로 처리한다. */
  handoffTo: string;
}

export const LOOP_DIAGNOSIS: LoopDiagnosis = {
  verdict: '루프 가능성 높음 · 특정 조건 반복 호출 감지',
  confidence: '높음',
  signals: [
    { k: '반복 호출', v: '동일 입력 24회 연속 · 평균 간격 8초' },
    { k: '단일 사용자 편중', v: 'u-***7d31 이 24시간 호출의 67.4% 차지' },
    { k: '응답 시간 상승', v: '반복이 쌓일수록 5.4s → 9.1s · 타임아웃 발생' },
    { k: '종료 조건 미도달', v: '첨부 3건 분기에서 재시도 경로가 자기 자신으로 회귀' },
  ],
  workflowId: 'WKF-501',
  workflowName: '여신 상담 워크플로우',
  workflowNode: '조건 분기 — 첨부 문서 파싱 재시도',
  affectedUsers: 12,
  handoffTo: '고객상담 자동화 과제 개발팀 (PRJ-BS-061)',
};

/* ═══════════════════════ 3A-3 미터링 30일 추이 ═══════════════════════ */

/**
 * 부산은행 일별 호출 추이 — 06-02 14:20 급증이 그래프에서 보여야 한다.
 * 마지막 두 점이 튀는 이유가 위 알림이다. 두 화면이 같은 사건을 말한다.
 */
export const TENANT_CALL_TREND: Record<string, number[]> = {
  부산은행: [
    41200, 39800, 43100, 44050, 40120, 22400, 19800,
    45300, 46100, 44800, 45900, 47200, 24100, 20600,
    46800, 47500, 46200, 48100, 47800, 25300, 21400,
    48600, 49200, 48800, 50100, 49400, 26800, 22100,
    /* 06-02 급증 */ 118400, /* 06-03 */ 132900,
  ],
};

/** 그래프 X축 라벨 — 30일. */
export const TREND_DAYS = 30;

/** 급증 시작 표식 — 뒤에서 두 번째 점. */
export const SURGE_INDEX = 28;

/* ═══════════════════ 운영 대응 이력 (외환 시나리오 화면 13) ═══════════════════ */

/**
 * 처리 완료된 운영 이슈 — **문제 확인 → 담당자 조치 → 복구 확인**의 완결 기록.
 *
 * RFP: SEC-009(관리자 및 사용자 감사 추적 로그) · ONM-002(모니터링) ·
 *      AGB-009(에이전트 실행 로그·추적)
 *
 * 위쪽의 `ANOMALY_ALERTS` 와 성격이 다르다. 그쪽은 **지금 조사해야 할** 건이고,
 * 이쪽은 **이미 끝난** 건이다. 둘을 한 목록에 섞으면 "지금 무엇을 봐야 하는가" 가
 * 흐려진다. 그래서 별도 축으로 둔다.
 *
 * 왜 완결 기록을 굳이 화면에 두는가 — 운영의 가치는 무장애가 아니라 **되짚을 수
 * 있음**이다. 무엇이 문제였고 누가 어떻게 조치했는지가 남아야 그룹 공동 플랫폼의
 * 운영 책임 소재가 성립한다. 장애가 한 건도 없는 화면이 오히려 신뢰를 잃는다.
 *
 * ⚠️ 조치 주체는 항상 **사람**이다. "AI 가 스스로 복구했다" 로 읽히면 그게 그대로
 *    계약 확약이 된다(RFP Ⅳ.4.1).
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
export interface IncidentStep {
  /** 단계 라벨 — 문제 확인 · 담당자 조치 · 복구 확인 세 단계로 고정한다. */
  k: string;
  /** 무슨 일이 있었는가. */
  v: string;
  at: string;
  /** 처리한 사람. 시스템이 한 일이면 비운다. */
  by?: string;
}

export interface ResolvedIncident {
  id: string;
  tenant: Tenant;
  agentId: string;
  agentName: string;
  /** 화면 제목에 쓰는 업무 이름. */
  scope: string;
  /** 사용자가 처음 신고한 말 그대로. */
  report: string;
  reportedAt: string;
  reportedBy: string;
  /** 영향 받은 사용자 수. */
  affectedUsers: number;
  /** 신고부터 복구 확인까지 걸린 시간. */
  duration: string;
  steps: IncidentStep[];
  /** 현재 상태 — 처리 완료 건이므로 항상 정상이다. */
  state: '현재 정상';
  /** 감사 원장 참조 — 되짚을 수 있다는 것을 ID 로 보인다(SEC-009). */
  auditRef: string;
}

export const RESOLVED_INCIDENTS: ResolvedIncident[] = [
  {
    id: 'INC-2026-0603-01',
    tenant: '경남은행',
    agentId: 'GRP-009',
    agentName: '외환업무 어시스턴트',
    scope: '경남은행 외환업무 / 처리 이력',
    report: '첨부한 서류가 열리지 않습니다.',
    reportedAt: '2026-06-03 09:12',
    reportedBy: '경남은행 · 외환사업부',
    affectedUsers: 4,
    duration: '38분',
    steps: [
      {
        k: '문제 확인',
        v: '당행 적용 시 연결한 문서 파서 설정이 잘못돼 첨부 서류 파싱이 실패했습니다. 서류를 읽지 못해 검토가 진행되지 않았습니다.',
        at: '2026-06-03 09:20',
        by: '배관제 (경남은행 AI플랫폼운영팀)',
      },
      {
        k: '담당자 조치',
        v: '직전 정상 버전의 자료 연결 설정으로 복구했습니다. 응답 형식(개선 버전)은 그대로 유지했습니다.',
        at: '2026-06-03 09:41',
        by: '배관제 (경남은행 AI플랫폼운영팀)',
      },
      {
        k: '복구 확인',
        v: '신고 건과 같은 서류 4건을 다시 올려 파싱·검토가 정상 완료되는 것을 확인했습니다. 신고자에게 회신했습니다.',
        at: '2026-06-03 09:50',
        by: '배관제 (경남은행 AI플랫폼운영팀)',
      },
    ],
    state: '현재 정상',
    auditRef: 'AUD-2026-0603-118',
  },
];

/** 계열사 범위로 자른 운영 이력 — 그룹 조망 권한이면 전부 본다(SEC-001). */
export function resolvedIncidentsFor(tenant: string | undefined, wide: boolean): ResolvedIncident[] {
  if (wide) return RESOLVED_INCIDENTS;
  return RESOLVED_INCIDENTS.filter((i) => i.tenant === tenant);
}
