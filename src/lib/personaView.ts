/**
 * 페르소나별 화면 콘텐츠 슬라이스 헬퍼.
 *
 * "레이아웃은 그대로, 안의 데이터만 페르소나별로 다르게" 를 실현하기 위한
 * 단일 진입점. 각 페이지는 이 파일의 함수를 통해 현재 페르소나에 맞는
 * 데이터를 받아간다.
 *
 * 각 함수는 페르소나(또는 null)를 받고, 해당 페르소나에서 보여야 할
 * 데이터 슬라이스를 반환한다. 페르소나별 룰 조정은 이 파일 한 곳에서 이뤄진다.
 */
import {
  approvals,
  PROMOTE_CATEGORY,
  currentPromotionStage,
  findPromotion,
  currentDeployStage,
  findAgentDeploy,
} from '@/data/mockApprovals';
import { getDeployApprovals } from '@/lib/deployApprovalStore';
import { projectsList } from '@/data/mockProjects';
import { FEATURED_AGENTS, type FeaturedAgent } from '@/data/mockFeaturedAgents';
import type { ApprovalItem } from '@/types';
import { AFFILIATE_APPROVER_IDS } from '@/data/mockPersonas';
import type { Persona, PersonaId } from '@/data/mockPersonas';

/** 현재 페르소나 ID (null이면 로그아웃 상태). */
export type PersonaLike = Persona | null;

/** 홈 KPI 카드에 들어갈 값. */
export interface HomeKpis {
  myProjectCount: number;
  /** 결재 대기 건수. */
  pendingApprovalCount: number;
  /** 인사말 하단 요약에 쓰이는 "진행 중 과제" 건수. */
  inProgressTaskCount: number;
}

/** 페르소나별 관심 결재 카테고리 (allowlist). 없으면 전체. */
function approvalCategoryAllowlist(persona: PersonaLike): string[] | null {
  switch (persona?.id) {
    case 'business_admin':
      // 사업 관리자는 프로젝트 라이프사이클과 정책 결재만 관심.
      return ['register', 'discard', 'policy'];
    case 'governance_admin':
      // 거버넌스 관리자는 위 항목 + 레드팀 검증 결재 담당.
      // `promote`(자산 공유범위 승격)는 결재선 마지막 단계가 「그룹 거버넌스 승인」이라
      // 이 역할이 반드시 봐야 한다 — 빠져 있으면 승격 결재가 최종 승인자에게 안 보인다.
      return ['register', 'discard', 'policy', 'redteam', 'promote'];
    case 'security_admin':
      // 정보보호 관리자는 접근통제·인증 관점의 계정 결재만 관심.
      return ['account'];
    case 'bs_admin':
    case 'kn_admin':
      // 계열사 승인권자는 그룹 결재함 전체를 보지 않는다(SEC-001 격리).
      // 빈 allowlist 로 두고, 아래 union 규칙이 **본인에게 배정된 승격 건**만 더한다.
      return [];
    default:
      return null;
  }
}

/**
 * 개발자 그룹은 결재자가 아니라 기안자다.
 * 따라서 남의 결재는 보지 못하고, 자기가 기안한 건만 추적한다.
 */
function isDrafterOnlyPersona(persona: PersonaLike): boolean {
  return persona?.group === '개발자';
}

/** 현재 페르소나가 볼 수 있는 결재 리스트 전체 (필터 후, 아직 slice 전). */
export function getVisibleApprovals(persona: PersonaLike): ApprovalItem[] {
  // 일반 사용자는 결재 주체가 아니다. 예전에는 `service_user`(부산은행) 한 명만
  // 막아서 하사용(경남은행)·표사용(BNK캐피탈)로 전환하면 **타 계열사 결재 건까지
  // 전부 보였다** — SEC-001 격리 서사가 그 자리에서 깨진다. 그룹 단위로 막는다.
  if (persona?.group === '사용자') return [];
  // 서빙계 배포 결재(스토어)를 기존 정적 결재와 합쳐서 노출.
  let list: ApprovalItem[] = [...getDeployApprovals(), ...approvals];
  // 개발자 그룹: 본인 기안 건 + **본인이 처리해야 할 단계인 승격 건**.
  // (draftedBy에 "(SoD 자동 위임)" 같은 접미사가 붙을 수 있어 prefix 비교)
  //
  // 자산 소유자 동의는 성격상 소유자 본인만 할 수 있다 — 자기 자산을 타 계열사에
  // 열어 줄지 정하는 일이라 결재자 그룹으로 넘길 수 없다. 그래서 개발자라도
  // 이 단계의 당사자면 결재함에 보인다. 보이지 않으면 승격 결재가 2단계에서 멈춘다.
  if (isDrafterOnlyPersona(persona) && persona) {
    const me = persona.name;
    return list.filter(
      (a) =>
        a.draftedBy.startsWith(me) ||
        isMyPromotionStage(persona, a) ||
        // 과제 오너(개발자 그룹)에게 배정된 배포 결재 — 안 보이면 1단계에서 멈춘다.
        isMyDeployStage(persona, a),
    );
  }
  const allow = approvalCategoryAllowlist(persona);
  // 관심 카테고리로 좁히되, **본인에게 배정된 승격 단계**는 카테고리와 무관하게 남긴다.
  // 소유자 계정이 없어 정보보호 관리자에게 위임된 동의 단계가 여기서 걸러지면
  // 결재가 조용히 멈춘다 — 배정과 노출이 어긋나면 안 된다.
  if (allow && persona) {
    list = list.filter(
      (a) =>
        allow.includes(a.category) || isMyPromotionStage(persona, a) || isMyDeployStage(persona, a),
    );
  }
  // 사업·거버넌스 관리자는 완료·반려된 지난 이력은 홈에서 숨기고 진행 중 결재만 노출.
  if (
    persona?.id === 'business_admin' ||
    persona?.id === 'governance_admin' ||
    persona?.id === 'security_admin'
  ) {
    list = list.filter((a) => a.state === 'pending');
  }
  return list;
}

/**
 * 특정 결재 건을 현재 페르소나가 열람할 수 있는지.
 * 목록 필터와 같은 규칙을 써서, 목록에 없는 건은 상세 URL로도 못 들어오게 한다.
 */
export function canViewApproval(persona: PersonaLike, approvalId: string): boolean {
  if (getVisibleApprovals(persona).some((a) => a.id === approvalId)) return true;
  // 결재함에 뜨지 않는 그룹(일반 사용자)이라도 **본인이 상신한 건**은 추적할 수 있어야
  // 한다. 마켓플레이스 카드가 "결재 진행 중 · APV-…" 링크를 내주는데 그 링크가
  // 열람 불가로 막히면, 요청이 어디로 갔는지 화면에서 끊긴다.
  if (!persona) return false;
  return approvals.some((a) => a.id === approvalId && a.draftedBy.startsWith(persona.name));
}

/** 해당 프로젝트의 참여자인지. members[].title이 "이름 (역할)" 형식이라 이름으로 판정. */
function isProjectMember(
  persona: PersonaLike,
  project: (typeof projectsList)[number],
): boolean {
  if (!persona) return false;
  return project.members.some((m) => m.title.startsWith(persona.name));
}

/**
 * 프로젝트 목록에 보일 프로젝트.
 * 프로젝트는 개발자 그룹의 작업 공간이라 관리자·서비스 사용자에게는 노출하지 않고,
 * 개발자 중에서도 실제 참여 중인 프로젝트만 보여준다.
 * (관리자는 "관리" 콘솔에서 전사 현황을 본다.)
 */
export function getVisibleProjects(persona: PersonaLike): typeof projectsList {
  if (persona?.group !== '개발자') return [];
  return projectsList.filter((p) => isProjectMember(persona, p));
}

/** 프로젝트 상세 열람 가능 여부 — 참여자만. */
export function canViewProject(persona: PersonaLike, projectId: string): boolean {
  return getVisibleProjects(persona).some((p) => p.id === projectId);
}

/**
 * 특정 프로젝트에 속한 결재 목록.
 * 참여자는 본인 기안 건뿐 아니라 그 프로젝트의 결재 전체를 본다.
 * (전역 결재함의 "본인 기안만" 규칙은 프로젝트 안에서는 적용하지 않는다.)
 * 참여자가 아니면 빈 목록.
 */
export function getProjectApprovals(
  persona: PersonaLike,
  projectId: string,
  projectName: string,
): ApprovalItem[] {
  if (!canViewProject(persona, projectId)) return [];
  return approvals.filter((a) => a.projectName === projectName);
}

/** 상단바 결재함 배지 — 페르소나가 열람 가능한 진행 중 결재 건수. */
export function getApprovalBadgeCount(persona: PersonaLike): number {
  return getVisibleApprovals(persona).filter((a) => a.state === 'pending').length;
}

/** 페르소나별 홈 KPI. */
export function getHomeKpis(persona: PersonaLike): HomeKpis {
  const visible = getVisibleApprovals(persona);
  const pending = visible.filter((a) => a.state === 'pending').length;

  switch (persona?.id) {
    case 'service_user':
      return { myProjectCount: 0, pendingApprovalCount: 0, inProgressTaskCount: 0 };
    default:
      return {
        myProjectCount: 0,
        pendingApprovalCount: pending,
        inProgressTaskCount: 3,
      };
  }
}

/** 홈 대표 에이전트 큐레이션 — 페르소나에 따라 노출 리스트 조정. */
export function getHomeFeaturedAgents(persona: PersonaLike): FeaturedAgent[] {
  // 서비스 사용자는 카탈로그 진입이 핵심이므로 그대로 3개 노출.
  // 다른 페르소나도 현재는 동일. 후속 요구사항에 따라 페르소나별 필터 추가.
  return FEATURED_AGENTS;
}

/** 홈의 "내 결재·기안" 리스트에 보일 항목. */
export function getHomeApprovals(persona: PersonaLike): ApprovalItem[] {
  return getVisibleApprovals(persona).slice(0, 6);
}

/** 우측 "내 프로젝트" 카드에 보일 항목 수. */
export function getHomeMyProjectCount(persona: PersonaLike): number {
  return getHomeKpis(persona).myProjectCount;
}

/**
 * 공유 PTU 풀 현황 열람 가능 여부.
 * 풀 용량·점유율은 플랫폼 운영 정보라 플랫폼 관리자에게만 노출.
 */
export function canViewPtuPool(persona: PersonaLike): boolean {
  return persona?.id === 'platform_admin';
}

/**
 * 관리 콘솔 접근 가능 여부.
 * 관리자 역할만 진입 허용.
 */
export function canAccessAdminConsole(persona: PersonaLike): boolean {
  if (!persona) return false;
  // 계열사 소속 승인권자는 결재 권한만 갖는다 — 그룹 공동존 운영 콘솔(전사 대시보드·
  // GPU 자원·감사 원장)은 열지 않는다. 승인권자이지 공동존 운영자가 아니다(SEC-001).
  if (AFFILIATE_APPROVER_IDS.includes(persona.id)) return false;
  return persona.group === '관리자';
}

/* ═══════════════════════ 메뉴 노출 통제 ═══════════════════════ */

/**
 * GNB 에 노출할 영역.
 *
 * RFP 2-1 포탈 구축 공통:
 *   "로그인 후 사용자 권한에 따라 **접근 가능한 워크스페이스· 메뉴·기능만 노출**
 *    (계열사별 SSO 등 통합인증기능 연동 등 권한 기반 화면 구성"
 *
 * 그래서 권한 밖 메뉴는 비활성화가 아니라 **아예 그리지 않는다.** 회색 처리는
 * "있긴 있다" 를 알려 주는 셈이라 요건의 취지에서 벗어난다.
 */
export type NavArea = 'home' | 'chat' | 'studio' | 'knowledge' | 'catalog' | 'admin';

export function canAccessArea(persona: PersonaLike, area: NavArea): boolean {
  if (!persona) return false;
  switch (area) {
    // 전 임직원 공통 — 사용자 포털의 기본 동선
    case 'home':
    case 'chat':
    case 'catalog':
      return true;
    // 제작 워크스페이스 — 에이전트 개발자·모델러·과제 오너 및 관리자
    case 'studio':
      return persona.group === '개발자' || persona.group === '관리자';
    // 데이터 워크스페이스 — 데이터 담당자·모델러·에이전트 개발자, 과제 오너, 관리자
    //
    // 과제 오너(rfpRole='관리자' · group='개발자')를 넣은 이유 —
    // 소속 계열사 과제에 전권을 갖는 역할이고, 시연 대본 화면 9 「승인 기반 DB
    // 동적 라우팅」(/knowledge/routing)을 이 페르소나가 진행한다. 데이터 접근
    // 라우팅은 기안·운영 책임이 과제 오너에게 있는 화면이라 영역을 여는 것이 맞다.
    // (승인 자체는 별개다 — 직무 분리는 화면 안에서 따로 막는다. ONM-003)
    case 'knowledge':
      return (
        persona.rfpRole === '데이터 담당자' ||
        persona.rfpRole === '모델러' ||
        persona.rfpRole === '에이전트 개발자' ||
        persona.rfpRole === '관리자' ||
        persona.group === '관리자'
      );
    case 'admin':
      return canAccessAdminConsole(persona);
  }
}

/* ═══════════════════ 영역 밖 단건 경로 예외 (읽기 전용) ═══════════════════ */

/**
 * 온톨로지 근거 그래프(`/knowledge/ontology`) **읽기 전용** 진입 허용 여부.
 *
 * 시연 대본 화면 4 는 일반 사용자(`service_user`)가 챗 답변의
 * "근거 그래프 자세히 보기 →" 를 눌러 이 화면으로 들어간다. 답변의 근거를
 * 사용자가 직접 확인하는 동선이라 막으면 RAG-007 의 설명력이 사라진다.
 *
 * 그렇다고 **지식·데이터 영역 전체를 열어서는 안 된다.** 그 안에는 지식 데이터
 * 적재·DB 스키마·데이터 라우팅처럼 일반 사용자 권한 밖 화면이 함께 있고,
 * 데모에 그려 둔 것은 그대로 계약 확약이 된다(RFP Ⅳ.4.1 · Ⅳ.6.7).
 *
 * 그래서 `canAccessArea('knowledge')` 는 건드리지 않고 **이 화면 하나만**,
 * 그것도 **조회(Query) 뷰만** 연다. 편집 하위 탭(그래프 설계 · 데이터 매핑 ·
 * Auto-Map · Materialize · 진단)은 읽기 전용 셸에서 렌더되지 않으므로
 * 클래스 병합·삭제 같은 편집 컨트롤에 손이 닿지 않는다.
 *
 * RFP 2-1 "접근 가능한 워크스페이스·메뉴·기능만 노출" 을 지키면서
 * RAG-007 근거 제시를 살리는 절충이다.
 */
export function canViewOntologyReadOnly(persona: PersonaLike): boolean {
  if (!persona) return false;
  // 정식 권한자는 편집 가능한 워크스페이스 화면으로 들어간다.
  if (canAccessArea(persona, 'knowledge')) return false;
  return persona.rfpRole === '일반 사용자';
}

/* ═══════════════════════ 직무 분리 (SoD) ═══════════════════════ */

/** 데이터 접근 라우팅 화면의 승인 관문. */
export type ApprovalGate = 'deploy' | 'consent';

/**
 * 관문별 승인 자격 — ONM-003(필수·상세제안) 직무 분리.
 *
 * 화면 9 의 기안자는 과제 오너(정오너)다. **기안자 그룹(개발자)은 자기 기안을
 * 스스로 승인할 수 없다.** 결재함 필터가 이미 같은 규칙을 쓰고 있다
 * (`isDrafterOnlyPersona` — 개발자 그룹은 결재자가 아니라 기안자).
 * 화면에서도 같은 말을 해야 조견표와 어긋나지 않는다.
 *
 *   · 배포 승인(SEC-006)      → 승인권자, 즉 관리자 그룹
 *   · 동의 권원 확인(SEC-007) → 정보보호·거버넌스 관리자
 */
export function canApproveGate(persona: PersonaLike, gate: ApprovalGate): boolean {
  if (!persona) return false;
  if (gate === 'deploy') return persona.group === '관리자';
  return persona.id === 'security_admin' || persona.id === 'governance_admin';
}

/**
 * 결재 건 하나를 지금 이 페르소나가 **처리할 수 있는가**.
 *
 * 열람(`canViewApproval`)과 처리를 분리하는 것이 이 함수의 존재 이유다.
 * 전에는 결재 상세가 `state === 'pending'` 만 보고 승인 버튼을 열어서,
 * 열람만 가능한 사람도 승인할 수 있었다 — 기안자 본인 포함이다.
 * 마켓플레이스에서 그룹 공개 요청을 낸 거버넌스 관리자가 그 건을 스스로
 * 최종 승인할 수 있었고, 그건 RBAC·직무 분리(ONM-003) 가 화면에서 깨진 상태다.
 * 화면 9(`canApproveGate`)는 이미 같은 규칙을 지키고 있었으므로 두 화면이
 * 서로 다른 말을 하고 있기도 했다.
 *
 * 반환값의 `hint` 는 **어느 계정으로 전환해야 하는지**까지 적는다.
 * 시연 중 막혔을 때 다음 동작이 화면에 쓰여 있어야 한다.
 */
export interface DecisionRight {
  ok: boolean;
  hint: string;
}

const ALLOW: DecisionRight = { ok: true, hint: '' };

export function canDecideApproval(persona: PersonaLike, item: ApprovalItem): DecisionRight {
  if (!persona) return { ok: false, hint: '로그인이 필요합니다' };
  if (persona.group === '사용자') {
    return { ok: false, hint: '일반 사용자는 결재 권한이 없습니다' };
  }
  // ① 자기결재 차단 — 직무 분리의 핵심. 역할과 무관하게 먼저 막는다.
  if (item.draftedBy.startsWith(persona.name)) {
    return {
      ok: false,
      hint: '직무 분리(SoD) — 본인이 상신한 결재는 본인이 승인할 수 없습니다',
    };
  }
  // ② 승격 결재는 단계마다 승인 주체가 다르다.
  if (item.category === PROMOTE_CATEGORY) {
    const promo = findPromotion(item.id);
    const stage = promo && currentPromotionStage(promo);
    if (!stage) return { ok: false, hint: '처리할 단계가 남아 있지 않습니다' };
    if (stage.kind === 'affiliate-admin') {
      // 승인 주체는 **관리자**여야 한다. 개발자가 승인 행위를 하면 ONM-003 위반이다.
      return persona.group === '관리자' && persona.name === stage.approverName
        ? ALLOW
        : {
            ok: false,
            hint: `소유 계열사 승인권자 ${stage.approverName} (${stage.approverTenant}) 계정으로 전환해야 합니다`,
          };
    }
    // 최종 통제는 그룹 공동존 운영 역할의 몫이다. 두 명을 두는 이유는 한 명이
    // 기안자가 되면 자기결재 차단에 걸려 아무도 승인할 수 없게 되기 때문이다.
    return persona.id === 'governance_admin' || persona.id === 'platform_admin'
      ? ALLOW
      : {
          ok: false,
          hint: '그룹 거버넌스 관리자(박거버) 또는 플랫폼 관리자(김플랫) 계정으로 전환해야 합니다',
        };
  }
  // ③ 에이전트 배포 결재도 단계마다 승인 주체가 다르다(LSM-009 · ONM-003).
  const dep = findAgentDeploy(item.id);
  if (dep) {
    const stage = currentDeployStage(dep);
    if (!stage) return { ok: false, hint: '처리할 단계가 남아 있지 않습니다' };
    return persona.name === stage.approverName
      ? ALLOW
      : {
          ok: false,
          hint: `${stage.label} 담당 ${stage.approverName} (${stage.approverTenant}) 계정으로 전환해야 합니다`,
        };
  }
  // ④ 그 밖의 결재는 승인권자(관리자 그룹) 몫이다 — 개발자는 기안자다.
  return persona.group === '관리자'
    ? ALLOW
    : { ok: false, hint: '승인권자(관리자 그룹) 계정으로 전환해야 합니다' };
}

/** 지금 이 페르소나에게 배정된 배포 결재 단계인지. */
function isMyDeployStage(persona: Persona, a: ApprovalItem): boolean {
  if (a.state !== 'pending') return false;
  const dep = findAgentDeploy(a.id);
  const stage = dep && currentDeployStage(dep);
  return !!stage && stage.approverName === persona.name;
}

/** 지금 이 페르소나에게 배정된 승격 단계인지 — 결재함 노출의 근거. */
function isMyPromotionStage(persona: Persona, a: ApprovalItem): boolean {
  if (a.category !== PROMOTE_CATEGORY || a.state !== 'pending') return false;
  const promo = findPromotion(a.id);
  const stage = promo && currentPromotionStage(promo);
  return !!stage && stage.approverName === persona.name;
}

/** 승인 자격이 없을 때 화면에 띄울 안내 — 어느 계정으로 바꿔야 하는지까지 적는다. */
export function gateDenialHint(gate: ApprovalGate): string {
  return gate === 'deploy'
    ? '승인권자 계정으로 전환해야 합니다 (플랫폼 관리 그룹)'
    : '정보보호 그룹 계정으로 전환해야 합니다';
}

/**
 * AI 거버넌스 포탈 진입 가능 여부.
 * 원장·결재 화면이므로 거버넌스/준법 성격의 관리자와 과제 오너까지만 연다.
 */
export function canAccessGovernance(persona: PersonaLike): boolean {
  if (!persona) return false;
  return persona.group === '관리자' || persona.rfpRole === '관리자';
}

/** 페르소나별 홈 헤더 인사말에 붙는 요약 문구 조립용 헬퍼. */
export function getHomeGreetingSummary(persona: PersonaLike): string {
  const k = getHomeKpis(persona);
  const parts: string[] = [];
  if (k.pendingApprovalCount > 0) parts.push(`결재 대기 ${k.pendingApprovalCount}건`);
  if (k.inProgressTaskCount > 0) parts.push(`진행 중 과제 ${k.inProgressTaskCount}건`);
  if (parts.length === 0) return '오늘은 특별한 알림이 없습니다';
  return `오늘은 ${parts.join(' · ')}`;
}

/** persona id 타입 재-export (다른 파일 편의) */
export type { PersonaId };
