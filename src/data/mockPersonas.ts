/**
 * 페르소나(로그인 계정) mock.
 *
 * RFP 근거
 *  · 2-1 포탈 구축 공통
 *      "포탈 사용자의 다양한 역할(**일반 사용자, 에이전트 개발자, 모델러,
 *       데이터 담당자, 운영자, 관리자** 등)별 워크스페이스(화면 구성) 제공"
 *      "로그인 후 사용자 권한에 따라 접근 가능한 워크스페이스·메뉴·기능만 노출
 *       (**계열사별 SSO** 등 통합인증기능 연동 등 권한 기반 화면 구성"
 *  · ONM-001 SSO 및 AD 연동 (필수)
 *      "전사 사용자 관리 및 접근 통제 방안을 제시하고 **자회사별 Active Directory(AD)**
 *       시스템과의 표준 연동 지원"
 *  · SEC-001 테넌트 격리 (필수·상세제안)
 *  · 인프라 나-(3) "공통 포털 웹(**각 계열사 접속 전 랜딩 웹페이지 개념**)"
 *
 * ⚠️ 그래서 계정은 **계열사에 묶인다.** 계열사는 IdP/AD 클레임으로 확정되며
 *    사용자가 임의로 바꿀 수 없다. 테넌트를 넘나들 수 있는 것은 공동존을
 *    운영·감독하는 그룹 역할뿐이다(`canSwitchTenant`). 이 구분을 흐리면
 *    SEC-001 이 화면에서 무너진다.
 *
 * 이름·부서는 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type PersonaId =
  // 그룹(공동존) 운영 — 계열사를 넘나든다
  | 'platform_admin'
  | 'business_admin'
  | 'governance_admin'
  | 'security_admin'
  | 'operator'
  // 부산은행
  | 'project_owner'
  | 'agent_dev'
  | 'modeler'
  | 'data_dev'
  | 'project_member'
  | 'service_user'
  // 경남은행
  | 'kn_agent_dev'
  | 'kn_data_dev'
  | 'kn_service_user'
  // BNK캐피탈
  | 'cp_service_user';

/** 화면 노출·권한 판정에 쓰는 큰 분류. */
export type PersonaGroup = '관리자' | '개발자' | '사용자';

/** RFP 2-1 이 명시한 역할 6종 — 제안서 조견표와 1:1 로 대응시킨다. */
export type RfpRole =
  | '일반 사용자'
  | '에이전트 개발자'
  | '모델러'
  | '데이터 담당자'
  | '운영자'
  | '관리자';

export interface Persona {
  id: PersonaId;
  /** 화면 라벨. */
  role: string;
  /** RFP 2-1 이 열거한 역할 중 무엇에 해당하는가. */
  rfpRole: RfpRole;
  /** 사용자 이름. */
  name: string;
  /** 아바타에 표시할 한글 이니셜(1자). */
  initial: string;
  /** 소속 부서. */
  dept: string;
  /** 그룹 분류 (드롭다운 섹션 분리용). */
  group: PersonaGroup;
  /** 소속 계열사 — IdP/AD 클레임으로 확정된다. */
  tenant: Tenant;
  /**
   * 다른 계열사 Namespace 로 전환할 수 있는가.
   * 공동존을 운영·감독하는 그룹 역할만 true. SEC-001 의 핵심 통제다.
   */
  canSwitchTenant: boolean;
  /** 페르소나 요약 — 드롭다운 hover/부제. */
  hint: string;
}

export const PERSONAS: Persona[] = [
  /* ─── 그룹 공동존 운영 (계열사 전환 가능) ─── */
  {
    id: 'platform_admin',
    role: '플랫폼 관리자',
    rfpRole: '관리자',
    name: '김플랫',
    initial: '김',
    dept: 'BNK시스템 · AI플랫폼팀',
    group: '관리자',
    tenant: '그룹 공통',
    canSwitchTenant: true,
    hint: '전체 콘솔·모델·PTU·감사 원장 접근',
  },
  {
    id: 'business_admin',
    role: '사업 관리자',
    rfpRole: '관리자',
    name: '이사업',
    initial: '이',
    dept: '지주 · IT전략부',
    group: '관리자',
    tenant: '그룹 공통',
    canSwitchTenant: true,
    hint: '비용·예산·계열사 사용 현황 총괄',
  },
  {
    id: 'governance_admin',
    role: '거버넌스 관리자',
    rfpRole: '관리자',
    name: '박거버',
    initial: '박',
    dept: '지주 · 디지털혁신부',
    group: '관리자',
    tenant: '그룹 공통',
    canSwitchTenant: true,
    hint: '정책·결재·감사 원장·SoD 검토',
  },
  {
    id: 'security_admin',
    role: '정보보호 관리자',
    rfpRole: '관리자',
    name: '임정보',
    initial: '임',
    dept: '지주 · 정보보호부',
    group: '관리자',
    tenant: '그룹 공통',
    canSwitchTenant: true,
    hint: 'PII·가드레일·접근 통제·인증',
  },
  {
    id: 'operator',
    role: '운영자',
    rfpRole: '운영자',
    name: '노운영',
    initial: '노',
    dept: 'BNK시스템 · 서비스운영팀',
    group: '관리자',
    tenant: 'BNK시스템',
    canSwitchTenant: true,
    hint: '서비스 등록·게시·중지, 장애 대응',
  },

  /* ─── 부산은행 ─── */
  {
    id: 'project_owner',
    role: '과제 오너',
    rfpRole: '관리자',
    name: '정오너',
    initial: '정',
    dept: '부산은행 · 디지털혁신부',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '소속 계열사 과제 전권 · 배포 기안',
  },
  {
    id: 'agent_dev',
    role: '에이전트 개발자',
    rfpRole: '에이전트 개발자',
    name: '강개발',
    initial: '강',
    dept: '부산은행 · IT개발부',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '에이전트 프롬프트·도구·배포 기안',
  },
  {
    id: 'modeler',
    role: '모델러',
    rfpRole: '모델러',
    name: '민모델',
    initial: '민',
    dept: '부산은행 · 데이터사이언스팀',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '모델 신청·평가·플레이그라운드',
  },
  {
    id: 'data_dev',
    role: '데이터 담당자',
    rfpRole: '데이터 담당자',
    name: '조디비',
    initial: '조',
    dept: '부산은행 · 데이터관리부',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '지식데이터·파이프라인·메타데이터 승인',
  },
  {
    id: 'project_member',
    role: '과제 참여자',
    rfpRole: '일반 사용자',
    name: '윤참여',
    initial: '윤',
    dept: '부산은행 · 여신기획부',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '지정 과제 조회·기안',
  },
  {
    id: 'service_user',
    role: '일반 사용자',
    rfpRole: '일반 사용자',
    name: '서사용',
    initial: '서',
    dept: '부산은행 · 영업그룹',
    group: '사용자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '카탈로그 에이전트 사용',
  },

  /* ─── 경남은행 ─── */
  {
    id: 'kn_agent_dev',
    role: '에이전트 개발자',
    rfpRole: '에이전트 개발자',
    name: '설개발',
    initial: '설',
    dept: '경남은행 · IT기획팀',
    group: '개발자',
    tenant: '경남은행',
    canSwitchTenant: false,
    hint: '경남은행 전용 에이전트 제작',
  },
  {
    id: 'kn_data_dev',
    role: '데이터 담당자',
    rfpRole: '데이터 담당자',
    name: '남데이터',
    initial: '남',
    dept: '경남은행 · 데이터기획팀',
    group: '개발자',
    tenant: '경남은행',
    canSwitchTenant: false,
    hint: '경남은행 인덱스·메타데이터 승인',
  },
  {
    id: 'kn_service_user',
    role: '일반 사용자',
    rfpRole: '일반 사용자',
    name: '하사용',
    initial: '하',
    dept: '경남은행 · 개인영업부',
    group: '사용자',
    tenant: '경남은행',
    canSwitchTenant: false,
    hint: '그룹 공통 + 경남은행 전용 자산 사용',
  },

  /* ─── BNK캐피탈 ─── */
  {
    id: 'cp_service_user',
    role: '일반 사용자',
    rfpRole: '일반 사용자',
    name: '표사용',
    initial: '표',
    dept: 'BNK캐피탈 · 마케팅부',
    group: '사용자',
    tenant: 'BNK캐피탈',
    canSwitchTenant: false,
    hint: '그룹 공통 + 캐피탈 전용 자산 사용',
  },
];

export const DEFAULT_PERSONA_ID: PersonaId = 'platform_admin';

export function findPersona(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

/** 로그인 화면·스위처에서 계열사별로 묶어 보여 주기 위한 정렬 순서. */
export const PERSONA_TENANT_ORDER: Tenant[] = [
  '그룹 공통',
  'BNK시스템',
  '부산은행',
  '경남은행',
  'BNK캐피탈',
];

export function personasByTenant(t: Tenant): Persona[] {
  return PERSONAS.filter((p) => p.tenant === t);
}
