/**
 * LLM Gateway mock — 관리 콘솔 화면 「LLM Gateway」.
 *
 * RFP: ONM-002 (필수)
 *   "내부·외부의 모든 LLM API 통신을 단일 통로로 집중시키고, 게이트웨이를 통해
 *    라우팅·인증·보안 가드레일·토큰 과금 미터링을 총괄 통제해야 함"
 *   연계: LSM-008(테넌트별 토큰 Quota 설정·제어) · SEC-002(가드레일) · ONM-005(토큰 과금)
 *
 * 이 화면의 존재 이유 — 라우팅(모델 카탈로그)·가드레일(가드레일 정책)·미터링(정산)은
 * 이미 각각 화면이 있다. 그런데 **그 셋이 하나의 게이트웨이를 지난다는 서사**가
 * 어디에도 없었다. ONM-002 는 개별 기능이 아니라 "단일 통로" 자체가 요건이다.
 *
 * ⚠️ 미터링은 **실사용 토큰 계측 기반 chargeback** 이다. 클라우드 PTU/예약 용량
 *    개념은 이 사업(공동존 On-Prem)에 없다 — 화면에 그렇게 적지 말 것.
 * ⚠️ 소진량은 `mockAdminDashboard.getConglomerateTokenSeries()` 에서 그대로 읽는다.
 *    미터링·정산 화면과 같은 원장이라 두 화면이 다른 숫자를 말할 수 없다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import { getConglomerateTokenSeries } from './mockAdminDashboard';
import { BILLING_MONTH } from './mockMetering';
import { TENANTS, type Tenant } from './tenants';

/* ═══════════════════════ ① 인바운드 ═══════════════════════ */

export interface GatewayInbound {
  id: string;
  name: string;
  desc: string;
  /** 금일 요청 수. */
  callsToday: number;
  /** 인증 수단 — 통로마다 다르지만 관문은 하나다. */
  auth: string;
}

export const GATEWAY_INBOUND: GatewayInbound[] = [
  { id: 'portal', name: '사용자 포털 Chat', desc: '전 임직원 대화 · 첨부 질의', callsToday: 48210, auth: '계열사 SSO 세션 (SAML/OIDC)' },
  { id: 'agent', name: '에이전트 런타임', desc: '공통 10종 + 계열사 자체 에이전트', callsToday: 31640, auth: '워크로드 서비스계정 (mTLS)' },
  { id: 'api', name: '외부 연동 API', desc: '계열사 업무시스템이 호출하는 서빙 API', callsToday: 9870, auth: 'API Key + 소스 IP 화이트리스트' },
  { id: 'batch', name: '배치 · 워크플로우', desc: '야간 문서 요약 · 정기 리포트 생성', callsToday: 4130, auth: '워크로드 서비스계정 (mTLS)' },
];

/* ═══════════════════════ ② 게이트웨이 4단 ═══════════════════════ */

export type StageTone = 'info' | 'ok' | 'warn' | 'bad';

export interface GatewayStage {
  no: number;
  id: 'auth' | 'route' | 'guard' | 'meter';
  name: string;
  /** 한 줄 정의 — 이 단이 무엇을 결정하는가. */
  summary: string;
  /** 대응 K8s 워크로드 — 관리자 대시보드 Pod 목록과 같은 이름이다. */
  pod: string;
  /** 이 단에서 실제로 적용되는 정책. */
  policies: string[];
  /** 실시간 카운터(금일). */
  counters: { label: string; value: string; tone: StageTone }[];
  /** 대응 요건. */
  reqs: string[];
}

export const GATEWAY_STAGES: GatewayStage[] = [
  {
    no: 1,
    id: 'auth',
    name: '인증 · 인가',
    summary: '누가 부르는지 확인하고, 그 계정이 속한 Namespace 를 요청에 강제로 새긴다',
    pod: 'gateway-router',
    policies: [
      '계열사 AD/SSO 클레임 검증 — 10개 계열사 IdP 어댑터',
      '워크로드 mTLS · API Key 만료 검사',
      'Namespace 클레임 주입 — 호출자가 다른 계열사를 지정할 수 없다',
      '역할 기반 모델·에이전트 허용 목록 대조',
    ],
    counters: [
      { label: '금일 인증 통과', value: '93,850', tone: 'ok' },
      { label: '인증 거절', value: '204', tone: 'warn' },
      { label: '교차 Namespace 시도 차단', value: '3', tone: 'bad' },
    ],
    reqs: ['ONM-001', 'SEC-001'],
  },
  {
    no: 2,
    id: 'route',
    name: '라우팅',
    summary: '요청 성격·테넌트 정책에 따라 어느 서빙 모델로 보낼지 정하고, 장애 시 대체 모델로 돌린다',
    pod: 'gateway-router',
    policies: [
      '용도별 기본 모델 매핑 (대고객 / 내부 / 장문 / 경량)',
      '모델 화이트리스트 밖 호출은 거절 — 카탈로그 등재 모델만',
      '헬스체크 실패 · TPM 한도 초과 시 Fallback 모델로 자동 전환',
      '가중치 기반 A/B 라우팅 (신규 모델 검증 트래픽 5%)',
    ],
    counters: [
      { label: '라우팅 처리', value: '93,646', tone: 'ok' },
      { label: 'Fallback 전환', value: '412', tone: 'warn' },
      { label: '미등재 모델 거절', value: '17', tone: 'bad' },
    ],
    reqs: ['ONM-002', 'LSM-003'],
  },
  {
    no: 3,
    id: 'guard',
    name: '보안 가드레일',
    summary: '입력과 출력을 모두 검사한다 — 통과하지 못한 요청은 모델에 닿지 않는다',
    pod: 'pii-mask-sidecar',
    policies: [
      '그룹 베이스라인 정책 4종 + 계열사 강화 정책 (완화는 불가)',
      '입력 단계 PII 탐지 → 차단 · 마스킹 (SEC-002 · SEC-008)',
      '프롬프트 인젝션 · 금칙어 패턴 검사',
      '출력 단계 재검사 — 응답에 유입된 민감정보 마스킹',
      '승인된 서비스별 예외는 만료일까지만 유효',
    ],
    counters: [
      { label: '입력 차단', value: '186', tone: 'bad' },
      { label: '마스킹 적용', value: '1,342', tone: 'warn' },
      { label: '출력 재검사 차단', value: '29', tone: 'bad' },
    ],
    reqs: ['SEC-002', 'SEC-003', 'SEC-008'],
  },
  {
    no: 4,
    id: 'meter',
    name: '미터링 · 쿼터',
    summary: '입력·출력 토큰을 분리 계측해 원장에 적고, 테넌트 상한을 넘으면 그 자리에서 제어한다',
    pod: 'rate-limiter',
    policies: [
      '입력 / 출력 토큰 분리 계측 — 단가가 다르므로 합산하지 않는다',
      '테넌트별 일일 · 월간 토큰 상한 대조 (LSM-008)',
      '상한 초과 시 정책대로 차단 · 모델 강등 · 경고',
      '계측 원장은 미터링 · 정산 화면과 동일 (ONM-005)',
      '실사용 토큰 기반 chargeback — 예약 용량(PTU) 개념 없음',
    ],
    counters: [
      { label: '금일 계측 토큰', value: '412.6M', tone: 'info' },
      { label: '쿼터 경고 발생', value: '2', tone: 'warn' },
      { label: '쿼터 초과 차단', value: '0', tone: 'ok' },
    ],
    reqs: ['ONM-005', 'LSM-008', 'LSM-010'],
  },
];

/* ═══════════════════════ ③ 모델 풀 ═══════════════════════ */

export interface ModelPoolEntry {
  name: string;
  serving: string;
  role: string;
  /** 금일 라우팅 점유율(%). */
  sharePct: number;
  status: '운영 중' | '대기(Fallback)' | '검증 트래픽' | '미개통';
}

export const MODEL_POOL: ModelPoolEntry[] = [
  { name: 'onprem/gpt-oss-120b', serving: 'vLLM · A100×8', role: '대고객·범용 기본', sharePct: 58, status: '운영 중' },
  { name: 'onprem/llama-3.3-70b', serving: 'vLLM · 공동존', role: '장문 분석 · 도구 사용', sharePct: 21, status: '운영 중' },
  { name: 'onprem/qwen3-32b', serving: 'vLLM · 공동존', role: '경량 · 저지연', sharePct: 16, status: '운영 중' },
  { name: 'google/gemma-4-31B-it-assistant', serving: 'vLLM · A100×4', role: 'Fallback · 비용 절감', sharePct: 5, status: '대기(Fallback)' },
];

/**
 * 외부 LLM 슬롯 — RFP ONM-002 는 "내부·외부의 모든 LLM API" 를 요건으로 적었다.
 * 이 사업의 초기 구축 범위는 **전량 내부 서빙**이므로 외부 통로는 개통하지 않는다.
 * 다만 게이트웨이가 외부 통로를 **동일 4단으로 수용할 수 있다**는 것이 요건의 요지라
 * 화면에는 미개통 슬롯으로 남겨 둔다. 개통 자체는 별도 승인 절차를 전제한다.
 */
export const EXTERNAL_SLOT = {
  name: '외부 LLM API 슬롯',
  status: '미개통' as const,
  note: '초기 구축은 전량 내부 서빙이다. 외부 모델은 망 연동·정보보호 심의·전용 회선 승인을 거쳐야 개통되며, 개통되더라도 인증→라우팅→가드레일→미터링 4단을 동일하게 통과한다.',
};

/* ═══════════════════════ ④ 라우팅 규칙 ═══════════════════════ */

export interface RoutingRule {
  priority: number;
  condition: string;
  target: string;
  fallback: string;
  scope: string;
}

export const ROUTING_RULES: RoutingRule[] = [
  { priority: 1, condition: '대고객 서비스 등급 = 대고객', target: 'onprem/gpt-oss-120b', fallback: 'google/gemma-4-31B-it-assistant', scope: '전 계열사' },
  { priority: 2, condition: '입력 토큰 > 100K (장문 문서 분석)', target: 'onprem/llama-3.3-70b', fallback: 'onprem/gpt-oss-120b', scope: '전 계열사' },
  { priority: 3, condition: '에이전트 유형 = 도구 호출(MCP)', target: 'onprem/llama-3.3-70b', fallback: 'onprem/gpt-oss-120b', scope: '전 계열사' },
  { priority: 4, condition: '응답 지연 민감 (자동완성 · 단말 네비게이터)', target: 'onprem/qwen3-32b', fallback: 'onprem/gpt-oss-120b', scope: '전 계열사' },
  { priority: 5, condition: '쿼터 초과 · 초과 시 동작 = 모델 강등', target: 'onprem/qwen3-32b', fallback: '— (차단)', scope: '해당 테넌트' },
  { priority: 6, condition: '그 외 전부', target: 'onprem/gpt-oss-120b', fallback: 'onprem/qwen3-32b', scope: '전 계열사' },
];

/* ═══════════════════════ ⑤ 토큰 Quota (LSM-008) ═══════════════════════ */

/**
 * RFP LSM-008 (필수 · 상세제안필요)
 *   "테넌트별 일일/월간 토큰 사용 상한선(Quota) 설정 및 제어 기능을 제공해야 함"
 *
 * 요건의 동사는 **설정 및 제어**다. 읽기 전용 소진율만 보여 주면 요건을 절반만
 * 채운다. 그래서 화면에서 값을 바꾸고 저장할 수 있게 하고(메모리 state),
 * 상한을 넘겼을 때 무엇을 할지(초과 시 동작)까지 테넌트별로 고르게 한다.
 */
export type QuotaAction = '차단' | '모델 강등' | '경고만';

export const QUOTA_ACTIONS: QuotaAction[] = ['차단', '모델 강등', '경고만'];

/** 초과 시 동작의 실제 의미 — 화면에 그대로 노출한다. */
export const QUOTA_ACTION_DESC: Record<QuotaAction, string> = {
  차단: '상한 도달 시 신규 요청을 429 로 거절한다. 진행 중 응답은 완료시킨다.',
  '모델 강등': '상한 도달 시 경량 모델(onprem/qwen3-32b)로 강제 라우팅해 서비스는 유지한다.',
  경고만: '상한을 넘겨도 처리하되 운영자·테넌트 관리자에게 알림을 보낸다.',
};

export interface QuotaRow {
  tenant: Tenant;
  namespace: string;
  /** 일일 상한 (백만 토큰). */
  dailyCapM: number;
  /** 월간 상한 (백만 토큰). */
  monthlyCapM: number;
  /** 정산월 최종일 소진 (백만 토큰) — 원장에서 읽는다. */
  dailyUsedM: number;
  /** 정산월 누계 소진 (백만 토큰) — 미터링 화면 총량과 같다. */
  monthlyUsedM: number;
  onExceed: QuotaAction;
  /** 그룹 공통은 정산 배분 대상이 아니라 별도 설명이 필요하다. */
  note?: string;
}

const M = 1_000_000;

/**
 * 초과 시 동작만 운영 협의값으로 명시한다. **상한 자체는 하드코딩하지 않는다.**
 *
 * 처음에는 상한을 숫자로 박아 뒀는데, 정산 원장의 실제 소진량과 맞지 않아
 * 부산은행이 상한 1,500M 에 소진 2,889M — 즉 **상한을 2배 넘겼는데도 차단되지 않은
 * 상태**로 화면에 떴다. 쿼터 화면이 쿼터가 동작하지 않는다고 말하는 셈이라
 * 원장에서 파생시키는 쪽으로 바꿨다(이 저장소의 단일 출처 방침과도 같다).
 */
const EXCEED_ACTION: Record<string, QuotaAction> = {
  부산은행: '모델 강등',
  경남은행: '모델 강등',
  BNK캐피탈: '차단',
  BNK투자증권: '차단',
  BNK저축은행: '차단',
  BNK자산운용: '차단',
  BNK벤처투자: '경고만',
  BNK시스템: '차단',
  BNK신용정보: '차단',
  BNK엘앤에스: '경고만',
  '그룹 공통': '경고만',
};

/**
 * 월 상한 배정 여유율 — 실제 소진 대비 얼마를 상한으로 주는가.
 * 대부분 넉넉히 잡되, 사용량이 급증한 두 곳은 여유가 얼마 남지 않은 상태로 둔다.
 * 쿼터 화면에서 "지금 조정이 필요한 테넌트"가 실제로 보여야 설정 기능이 의미를 갖는다.
 */
const HEADROOM: Record<string, number> = {
  부산은행: 1.12, // 여유 12% — 상한 상향 검토 대상
  경남은행: 1.18, // 여유 18% — 경고 구간
};
const DEFAULT_HEADROOM = 1.45;

/** 월 상한은 100M, 일 상한은 5M 단위로 올림해 운영값처럼 보이게 만든다. */
const ceilTo = (n: number, unit: number) => Math.ceil(n / unit) * unit;

/** 그룹 공통 Namespace 의 플랫폼 운영·검증 트래픽 (가상 수치, 정산 배분 대상 아님). */
const GROUP_COMMON_USAGE = { dailyM: 12.4, monthlyM: 318.6 };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 초기 쿼터 표. 계열사 소진량은 정산 원장(`getConglomerateTokenSeries`)에서
 * 그대로 읽으므로 미터링 화면과 어긋날 수 없다.
 *   · 월 누계 = 해당 계열사 정산월 총 토큰
 *   · 일 소진 = 그 월 최종일(30일차) 토큰
 */
export function buildQuotaRows(): QuotaRow[] {
  const series = getConglomerateTokenSeries();
  return TENANTS.map((t) => {
    const onExceed = EXCEED_ACTION[t.name] ?? '차단';
    const headroom = HEADROOM[t.name] ?? DEFAULT_HEADROOM;

    if (t.kind === 'group') {
      return {
        tenant: t.name,
        namespace: t.namespace,
        monthlyUsedM: GROUP_COMMON_USAGE.monthlyM,
        dailyUsedM: GROUP_COMMON_USAGE.dailyM,
        monthlyCapM: ceilTo(GROUP_COMMON_USAGE.monthlyM * headroom, 100),
        dailyCapM: ceilTo(GROUP_COMMON_USAGE.dailyM * headroom, 5),
        onExceed,
        note: '그룹 공통 에이전트 사용분은 계열사로 배분 계상된다. 여기 소진량은 플랫폼 운영·검증 트래픽만이다.',
      };
    }

    const s = series.find((x) => x.name === t.name);
    const daily = s?.daily ?? [];
    const monthlyUsedM = round1((s?.total ?? 0) / M);
    // 일 상한은 그 달 최대 사용일을 기준으로 잡는다 — 평균으로 잡으면 성수기에 매일 걸린다.
    const peakDailyM = daily.length ? Math.max(...daily) / M : 0;
    return {
      tenant: t.name,
      namespace: t.namespace,
      monthlyUsedM,
      dailyUsedM: round1((daily[daily.length - 1] ?? 0) / M),
      monthlyCapM: ceilTo(monthlyUsedM * headroom, 100),
      dailyCapM: ceilTo(peakDailyM * headroom, 5),
      onExceed,
    };
  });
}

/** 쿼터 표 기준 시점 — 미터링·정산과 같은 마감월을 쓴다. */
export const QUOTA_AS_OF = `${BILLING_MONTH} 마감 기준 · 일 소진은 해당 월 최종일`;

/** 화면 하단 고지. */
export const GATEWAY_SCOPE_NOTE =
  '게이트웨이는 사내 자산 AX Suite Gateway 모듈로 구축하며, 공동존 K8s 의 aip-gateway Namespace 에 배포된다. ' +
  '모든 LLM 호출은 이 통로 밖으로 나갈 수 없도록 서빙 모델 Pod 의 인그레스를 게이트웨이 서비스계정으로만 제한한다.';
