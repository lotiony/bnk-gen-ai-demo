/**
 * 관리 콘솔 — 서비스 운영·배포 mock.
 *
 * RFP 2-1 관리자 포털:
 *   "AI서비스, Agent, MCP 등 포탈 내 서비스 등록ᆞ게시ᆞ중지 등 운영관리 기능 제공" (38)
 *   "그룹 공통 AI자산과 계열사 전용 AI 자산의 공개, 공유 범위 설정 기능 제공" (40)
 *   "그룹 공통서비스 및 계열사 전용서비스의 운영영역 분리 및 관리 기능 제공" (41)
 *   "서비스 배포 관리 화면: 배포 승인·진행 상태 조회, 테스트·배포 현황 관리" (45)
 *
 * 네 항목이 결국 "이 서비스가 지금 어디서, 누구에게, 어떤 상태로 떠 있는가" 라는
 * 하나의 질문으로 묶이므로 화면 하나(탭 3개)로 처리한다.
 *
 * ⚠️ **여기 있는 ID 는 다른 mock 에도 있어야 한다.** 예전에는 `AGT-1188`·`AGT-0410`
 *   두 행이 어느 파일에도 없는 고아였고 혼자만 4자리 ID 였다. 지금은
 *     · `AGT-513` 여신 기표 오류 사전 점검 봇 — 과제 PRJ-BS-042 의 롤백·중지 산출물
 *     · `AGT-410` 코드 리뷰·시큐어코딩 점검 — 과제 PRJ-SY-003 의 게시 대기 산출물
 *   로 3자리 체계에 맞추고, 과제 원장(`mockAdminTasks`)의 `pendingAgentIds` 가
 *   이 둘을 참조한다. 둘 다 운영 카탈로그에 없는 것이 정상이다 — 하나는 중지,
 *   하나는 아직 게시 전이라 계측 대상이 아니기 때문이다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type ServiceKind = 'AI 서비스' | 'Agent' | 'MCP';
export type PublishState = '게시 중' | '중지됨' | '게시 대기';
export type OperatingArea = '그룹 공통 운영영역' | '계열사 전용 운영영역';
export type ShareScope = '개인' | '부서' | '본부' | '계열사' | '그룹 전체';
export type DeployStatus = '테스트 중' | '배포 대기' | '배포 완료' | '롤백됨';

/**
 * SLA 메트릭 — [45] 배포 현황의 "이상 서비스" 판단 근거.
 * 관리자 대시보드의 과제 SLO 와 같은 규칙(P95 / 목표)을 쓴다.
 */
export interface ServiceSla {
  p95Ms: number;
  sloTargetMs: number;
  /** P95 목표 충족률(%). 99 미만이면 주의. */
  attainmentPct: number;
  errorRatePct: number;
  calls7d: number;
}

export interface ServiceActivity {
  at: string;
  kind: '배포' | '지연' | '오류' | '조치' | '게시';
  text: string;
  by: string;
}

export interface ServiceItem {
  id: string;
  kind: ServiceKind;
  name: string;
  tenant: Tenant;
  operatingArea: OperatingArea;
  publishState: PublishState;
  shareScope: ShareScope;
  deployStatus: DeployStatus;
  version: string;
  lastActionBy: string;
  lastActionAt: string;
  /** 운영 중 서비스만 갖는다. 없으면 계측 대상이 아니다(게시 전·중지). */
  sla?: ServiceSla;
  /** 최근 활동 — 최신순. 상세 패널에서 원인 파악의 근거가 된다. */
  activity?: ServiceActivity[];
}

/** SLA 주의 기준 — P95 목표 충족률 99% 미만. 대시보드 SLO 카드와 같은 문턱이다. */
export const SLA_WARN_PCT = 99;
export function isSlaWarn(it: ServiceItem): boolean {
  return !!it.sla && it.sla.attainmentPct < SLA_WARN_PCT;
}

export const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'GRP-001', kind: 'Agent', name: '규정 · 책무 어시스턴트', tenant: '그룹 공통', operatingArea: '그룹 공통 운영영역', publishState: '게시 중', shareScope: '그룹 전체', deployStatus: '배포 완료', version: 'v3.0', lastActionBy: '김지주', lastActionAt: '2026-05-17 09:20' },
  { id: 'GRP-006', kind: 'Agent', name: '광고심의 지원 에이전트', tenant: 'BNK캐피탈', operatingArea: '계열사 전용 운영영역', publishState: '게시 중', shareScope: '계열사', deployStatus: '배포 완료', version: 'v1.4', lastActionBy: '이정우', lastActionAt: '2026-05-18 11:02' },
  { id: 'GRP-007', kind: 'Agent', name: '지식 · 상품 어시스턴트', tenant: '경남은행', operatingArea: '그룹 공통 운영영역', publishState: '게시 대기', shareScope: '부서', deployStatus: '테스트 중', version: 'v0.9-rc1', lastActionBy: '남데이터', lastActionAt: '2026-06-01 14:40' },
  { id: 'MCP-011', kind: 'MCP', name: 'authority.lookup', tenant: '그룹 공통', operatingArea: '그룹 공통 운영영역', publishState: '게시 중', shareScope: '그룹 전체', deployStatus: '배포 완료', version: 'v2.0', lastActionBy: '박거버', lastActionAt: '2026-05-20 08:10' },
  { id: 'MCP-034', kind: 'MCP', name: 'crm.customer_profile', tenant: '부산은행', operatingArea: '계열사 전용 운영영역', publishState: '게시 중', shareScope: '본부', deployStatus: '배포 완료', version: 'v1.1', lastActionBy: '조디비', lastActionAt: '2026-05-15 10:33' },
  // PRJ-BS-042 여신 디지털심사 과제의 롤백 산출물 — 중지 상태라 운영 카탈로그에 없다.
  { id: 'AGT-513', kind: 'Agent', name: '여신 기표 오류 사전 점검 봇', tenant: '부산은행', operatingArea: '계열사 전용 운영영역', publishState: '중지됨', shareScope: '부서', deployStatus: '롤백됨', version: 'v0.4', lastActionBy: '박서연', lastActionAt: '2026-05-25 16:02' },
  // PRJ-SY-003 개발 생산성 향상 과제의 산출물 — 아직 개발계 테스트 중이라 게시 전이다.
  { id: 'AGT-410', kind: 'Agent', name: '코드 리뷰 · 시큐어코딩 점검', tenant: 'BNK시스템', operatingArea: '계열사 전용 운영영역', publishState: '게시 대기', shareScope: '부서', deployStatus: '테스트 중', version: 'v0.9-rc2', lastActionBy: '한지훈', lastActionAt: '2026-06-02 17:20' },
  { id: 'SVC-EMBED-2', kind: 'AI 서비스', name: '금융 특화 임베딩 서빙', tenant: '그룹 공통', operatingArea: '그룹 공통 운영영역', publishState: '게시 대기', shareScope: '그룹 전체', deployStatus: '배포 대기', version: 'v1.0', lastActionBy: '민모델', lastActionAt: '2026-06-02 09:12' },
  /*
   * BNK신용정보 — 시연 3막 파트 B 의 무대. 계열사 관리자(문관제)가 여기서 이상
   * 서비스를 찾아 원인을 본다. AGT-731 은 카탈로그(mockCatalogAgents)의 실재
   * 자산이며 P95 3.4s 도 그쪽 값과 같다 — 두 화면이 다른 숫자를 말하면 안 된다.
   */
  {
    id: 'AGT-731', kind: 'Agent', name: '신용평가 조회 에이전트', tenant: 'BNK신용정보', operatingArea: '계열사 전용 운영영역', publishState: '게시 중', shareScope: '계열사', deployStatus: '배포 완료', version: 'v1.2', lastActionBy: '서신용', lastActionAt: '2026-05-30 15:10',
    sla: { p95Ms: 3400, sloTargetMs: 3000, attainmentPct: 96.7, errorRatePct: 1.8, calls7d: 7400 },
    activity: [
      { at: '2026-06-03 08:52', kind: '지연', text: '외부 신용조회 API(NICE 연동 Tool) 응답 P95 2.1s → 지연 구간이 전체 P95 의 62%', by: '자동 계측' },
      { at: '2026-06-03 08:40', kind: '오류', text: 'Tool 타임아웃 4건 — 재시도 후 3건 복구, 1건 사용자 재질의', by: '자동 계측' },
      { at: '2026-06-02 17:05', kind: '지연', text: 'P95 목표(3.0s) 초과 시작 — 17:00 이후 외부 API 응답 시간 상승', by: '자동 계측' },
      { at: '2026-05-30 15:10', kind: '배포', text: 'v1.2 운영계 배포 — 신용조회 결과 요약 프롬프트 개선', by: '서신용' },
      { at: '2026-05-30 14:40', kind: '조치', text: 'v1.2 레드팀 재검 통과 (RT-C 보완)', by: '박거버' },
    ],
  },
  {
    id: 'AGT-745', kind: 'Agent', name: '채권추심 상담 요약', tenant: 'BNK신용정보', operatingArea: '계열사 전용 운영영역', publishState: '게시 중', shareScope: '부서', deployStatus: '배포 완료', version: 'v2.0', lastActionBy: '서신용', lastActionAt: '2026-05-21 10:30',
    sla: { p95Ms: 1900, sloTargetMs: 3000, attainmentPct: 99.8, errorRatePct: 0.3, calls7d: 4100 },
    activity: [
      { at: '2026-06-02 09:15', kind: '게시', text: '채권관리부 → 채권추심부 공개 범위 확장 (부서)', by: '문관제' },
      { at: '2026-05-21 10:30', kind: '배포', text: 'v2.0 운영계 배포 — 상담 유형 분류 12종으로 확대', by: '서신용' },
    ],
  },
];

export const PUBLISH_TONE: Record<PublishState, 'ok' | 'neutral' | 'warn'> = {
  '게시 중': 'ok',
  중지됨: 'neutral',
  '게시 대기': 'warn',
};

export const DEPLOY_TONE: Record<DeployStatus, 'ok' | 'warn' | 'bad' | 'info'> = {
  '테스트 중': 'info',
  '배포 대기': 'warn',
  '배포 완료': 'ok',
  롤백됨: 'bad',
};

export const SHARE_SCOPES: ShareScope[] = ['개인', '부서', '본부', '계열사', '그룹 전체'];

/** 운영영역 2종 — [41] 분리·관리 select 의 옵션 출처. */
export const OPERATING_AREAS: OperatingArea[] = ['그룹 공통 운영영역', '계열사 전용 운영영역'];
