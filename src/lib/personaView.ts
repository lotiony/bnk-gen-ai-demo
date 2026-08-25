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
import { approvals } from '@/data/mockApprovals';
import { getDeployApprovals } from '@/lib/deployApprovalStore';
import { projectsList } from '@/data/mockProjects';
import { FEATURED_AGENTS, type FeaturedAgent } from '@/data/mockFeaturedAgents';
import type { ApprovalItem } from '@/types';
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
      return ['register', 'discard', 'policy', 'redteam'];
    case 'security_admin':
      // 정보보호 관리자는 접근통제·인증 관점의 계정 결재만 관심.
      return ['account'];
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
  if (persona?.id === 'service_user') return [];
  // 서빙계 배포 결재(스토어)를 기존 정적 결재와 합쳐서 노출.
  let list: ApprovalItem[] = [...getDeployApprovals(), ...approvals];
  // 개발자 그룹: 본인 기안 건만. (draftedBy에 "(SoD 자동 위임)" 같은 접미사가 붙을 수 있어 prefix 비교)
  if (isDrafterOnlyPersona(persona) && persona) {
    const me = persona.name;
    return list.filter((a) => a.draftedBy.startsWith(me));
  }
  const allow = approvalCategoryAllowlist(persona);
  if (allow) list = list.filter((a) => allow.includes(a.category));
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
  return getVisibleApprovals(persona).some((a) => a.id === approvalId);
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
 * 관리자 4역할만 진입 허용.
 */
export function canAccessAdminConsole(persona: PersonaLike): boolean {
  if (!persona) return false;
  return persona.group === '관리자';
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
