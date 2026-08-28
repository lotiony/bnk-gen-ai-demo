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
}

export const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'GRP-001', kind: 'Agent', name: '규정 · 책무 어시스턴트', tenant: '그룹 공통', operatingArea: '그룹 공통 운영영역', publishState: '게시 중', shareScope: '그룹 전체', deployStatus: '배포 완료', version: 'v3.0', lastActionBy: '김플랫', lastActionAt: '2026-05-17 09:20' },
  { id: 'GRP-006', kind: 'Agent', name: '광고심의 지원 에이전트', tenant: 'BNK캐피탈', operatingArea: '계열사 전용 운영영역', publishState: '게시 중', shareScope: '계열사', deployStatus: '배포 완료', version: 'v1.4', lastActionBy: '이정우', lastActionAt: '2026-05-18 11:02' },
  { id: 'GRP-007', kind: 'Agent', name: '지식 · 상품 어시스턴트', tenant: '경남은행', operatingArea: '그룹 공통 운영영역', publishState: '게시 대기', shareScope: '부서', deployStatus: '테스트 중', version: 'v0.9-rc1', lastActionBy: '남데이터', lastActionAt: '2026-06-01 14:40' },
  { id: 'MCP-011', kind: 'MCP', name: 'authority.lookup', tenant: '그룹 공통', operatingArea: '그룹 공통 운영영역', publishState: '게시 중', shareScope: '그룹 전체', deployStatus: '배포 완료', version: 'v2.0', lastActionBy: '박거버', lastActionAt: '2026-05-20 08:10' },
  { id: 'MCP-034', kind: 'MCP', name: 'crm.customer_profile', tenant: '부산은행', operatingArea: '계열사 전용 운영영역', publishState: '게시 중', shareScope: '본부', deployStatus: '배포 완료', version: 'v1.1', lastActionBy: '조디비', lastActionAt: '2026-05-15 10:33' },
  // PRJ-BS-042 여신 디지털심사 과제의 롤백 산출물 — 중지 상태라 운영 카탈로그에 없다.
  { id: 'AGT-513', kind: 'Agent', name: '여신 기표 오류 사전 점검 봇', tenant: '부산은행', operatingArea: '계열사 전용 운영영역', publishState: '중지됨', shareScope: '부서', deployStatus: '롤백됨', version: 'v0.4', lastActionBy: '박서연', lastActionAt: '2026-05-25 16:02' },
  // PRJ-SY-003 개발 생산성 향상 과제의 산출물 — 아직 학습계 테스트 중이라 게시 전이다.
  { id: 'AGT-410', kind: 'Agent', name: '코드 리뷰 · 시큐어코딩 점검', tenant: 'BNK시스템', operatingArea: '계열사 전용 운영영역', publishState: '게시 대기', shareScope: '부서', deployStatus: '테스트 중', version: 'v0.9-rc2', lastActionBy: '한지훈', lastActionAt: '2026-06-02 17:20' },
  { id: 'SVC-EMBED-2', kind: 'AI 서비스', name: '금융 특화 임베딩 서빙', tenant: '그룹 공통', operatingArea: '그룹 공통 운영영역', publishState: '게시 대기', shareScope: '그룹 전체', deployStatus: '배포 대기', version: 'v1.0', lastActionBy: '민모델', lastActionAt: '2026-06-02 09:12' },
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
