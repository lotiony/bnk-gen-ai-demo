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
  // 지주 (그룹 공통 Namespace 에서 개발한다 — 계열사는 넘나들지 않는다)
  | 'group_dev'
  // 부산은행
  | 'bs_admin'
  | 'bs_loan_dev'
  | 'project_owner'
  | 'agent_lead'
  | 'agent_dev'
  | 'modeler'
  | 'data_dev'
  | 'project_member'
  | 'service_user'
  // 경남은행
  | 'kn_admin'
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

  /* ─── 지주 (그룹 공통 Namespace) ─── */
  /**
   * 지주 개발자 — **그룹 공동 배포용 자산을 만드는 개발자**.
   *
   * 그룹 공통에 소속된 유일한 비관리자다. 여기가 필요한 이유는 ONM-003 이다 —
   * 그룹 공동 자산의 배포를 지주 관리자(김플랫·박거버)가 승인하는데, 그 자산을
   * 만드는 사람까지 관리자면 기안자와 승인권자가 같아진다.
   *
   * `canSwitchTenant` 는 **false** 다. 테넌트를 넘나드는 권한은 공동존을
   * 운영·감독하는 역할의 것이지 개발자의 것이 아니다(SEC-001). 그래서 이 계정은
   * 그룹 공통 Namespace 에 고정되고, 과제 목록에서도 그룹 공통 자산만 본다
   * (`scopeTasks` 의 wide=false 경로).
   */
  {
    id: 'group_dev',
    role: '지주 개발자',
    rfpRole: '에이전트 개발자',
    name: '주개발',
    initial: '주',
    dept: '지주 · IT개발부',
    group: '개발자',
    tenant: '그룹 공통',
    canSwitchTenant: false,
    hint: '그룹 공동 배포용 에이전트·워크플로우 제작',
  },

  /* ─── 부산은행 ─── */
  /**
   * 계열사 AI서비스 관리자 — **소유 계열사의 승인권자**.
   *
   * RFP 관리자 포털: "그룹 공통 AI자산과 계열사 전용 AI 자산의 **공개, 공유 범위
   * 설정** 기능 제공". 즉 자기 계열사 자산을 그룹에 여는 결정은 그 계열사의
   * 관리자 몫이다. 자산을 만든 개발자가 아니다 — ONM-003 이 "에이전트 개발자와
   * 승인권자 간 직무 분리" 를 필수로 못박는다.
   *
   * 계열사 소속이므로 `canSwitchTenant` 는 false 다(SEC-001). 그룹 공동존 운영
   * 콘솔도 열지 않는다 — 승인권자이지 공동존 운영자가 아니다.
   */
  {
    id: 'bs_admin',
    role: '계열사 AI서비스 관리자',
    rfpRole: '관리자',
    name: '고승인',
    initial: '고',
    dept: '부산은행 · AI서비스운영부',
    group: '관리자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '부산은행 AI자산의 공개·공유 범위 승인',
  },
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
    /*
     * 박서연은 이 저장소에서 **가장 많이 등장하는 인물**이다 — AGT-204·205·411 의
     * 소유자이고, 배포 기안·평가 실행·레드팀 신청·PII 정책 변경 신청이 전부
     * 이 이름으로 남아 있다(31개 파일 · 79회). 그런데 정작 인물 정본인 이 파일에
     * 정의가 없어서, "인물은 mockPersonas 가 정본" 이라는 규칙이 스스로 깨져
     * 있었다. 그래서 편입한다.
     *
     * 소속은 부산은행 디지털혁신부다 — 그가 만든 자산이 전부 부산은행 Namespace
     * 이고(`mockCatalogAgents`), 부산은행의 AI 주관 부서가 디지털혁신부이기
     * 때문이다(`mockGovernanceAdmin.STAGE_OWNERS`). 계열사 계정이므로
     * `canSwitchTenant: false` 다.
     */
    id: 'agent_lead',
    role: '에이전트 개발자',
    rfpRole: '에이전트 개발자',
    name: '박서연',
    initial: '박',
    dept: '부산은행 · 디지털혁신부',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: 'PB 에이전트 소유자 · 배포/평가/레드팀 기안',
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
  /**
   * 부서 개발 담당 — **현업 부서에 속한 개발자**.
   *
   * IT개발부(강개발)와 다른 자리다. 여신 업무를 아는 사람이 자기 부서 업무용
   * 에이전트를 검증된 템플릿에서 만들어 쓴다. 만드는 범위도 거기까지다 —
   * 사용 범위는 개인·부서까지만 고를 수 있고, 계열사부터는 별도 승격 결재로
   * 넘어간다(에이전트 등록 폼의 「사용 범위」).
   */
  {
    id: 'bs_loan_dev',
    role: '부서 개발 담당',
    rfpRole: '에이전트 개발자',
    name: '차여신',
    initial: '차',
    dept: '부산은행 · 여신기획부',
    group: '개발자',
    tenant: '부산은행',
    canSwitchTenant: false,
    hint: '여신팀 부서 업무 에이전트 제작 (템플릿 기반)',
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
    id: 'kn_admin',
    role: '계열사 AI서비스 관리자',
    rfpRole: '관리자',
    name: '유승인',
    initial: '유',
    dept: '경남은행 · 디지털기획부',
    group: '관리자',
    tenant: '경남은행',
    canSwitchTenant: false,
    hint: '경남은행 AI자산의 공개·공유 범위 승인',
  },
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

/**
 * 계열사 소속 승인권자 — 그룹 공동존 운영 역할과 구분한다.
 * 결재 권한은 갖되 공동존 운영 콘솔·타 계열사 Namespace 는 열지 않는다.
 */
export const AFFILIATE_APPROVER_IDS: PersonaId[] = ['bs_admin', 'kn_admin'];

/** 해당 계열사의 승인권자(관리자 그룹). 없으면 undefined. */
export function affiliateApprover(t: Tenant): Persona | undefined {
  return PERSONAS.find((p) => p.tenant === t && p.group === '관리자');
}

/**
 * 해당 계열사의 **과제 오너** — 배포 결재 1단계의 기본 처리자.
 *
 * 과제를 만든 개발자가 아니라 그 과제를 책임지는 사람이 먼저 본다(ONM-003).
 * 계열사에 과제 오너 계정이 없으면 그 계열사 승인권자로 내려간다.
 */
export function taskOwnerOf(t: Tenant): Persona | undefined {
  return PERSONAS.find((p) => p.tenant === t && p.role === '과제 오너') ?? affiliateApprover(t);
}
