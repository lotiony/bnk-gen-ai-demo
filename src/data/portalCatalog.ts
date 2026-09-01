/**
 * 그룹 공통 포털 런처의 4개 포털 정의.
 *
 * RFP 1.1.1 / 1.1.2: 공통 Shell에서 권한에 따라 접근 가능한 포털·메뉴만 노출한다.
 * 화면과 Topbar 전환기가 같은 레지스트리와 권한 함수를 사용해 노출 불일치를 막는다.
 */
import type { PersonaLike } from '@/lib/personaView';
import { canAccessArea, canAccessGovernance } from '@/lib/personaView';

export type PortalId = 'user' | 'studio' | 'admin' | 'governance';

export interface PortalDefinition {
  id: PortalId;
  eyebrow: string;
  title: string;
  description: string;
  entry: string;
  secondary?: { label: string; to: string }[];
  capabilities: string[];
  accent: 'red' | 'charcoal' | 'blue' | 'gold';
}

export const PORTALS: PortalDefinition[] = [
  {
    id: 'user',
    eyebrow: 'EMPLOYEE EXPERIENCE',
    title: '사용자 포털',
    description: '업무용 AI Agent, 문서·지식 검색과 개인 업무 현황을 한곳에서 이용합니다.',
    entry: '/',
    secondary: [
      { label: 'AI 어시스턴트', to: '/chat' },
      { label: 'Agent 카탈로그', to: '/catalog' },
    ],
    capabilities: ['공동 Agent 10종', '근거·출처 확인', '개인 문서·이력'],
    accent: 'red',
  },
  {
    id: 'studio',
    eyebrow: 'BUILD & DATA',
    title: 'AI Studio · 지식/데이터',
    description: 'Agent·Workflow·MCP를 설계하고 지식 파이프라인과 Ontology를 관리합니다.',
    entry: '/studio',
    secondary: [
      { label: 'Workflow Builder', to: '/studio/workflow' },
      { label: '지식·데이터', to: '/knowledge' },
    ],
    capabilities: ['No-code Workflow', 'MCP Tool', 'Graph RAG·Ontology'],
    accent: 'charcoal',
  },
  {
    id: 'admin',
    eyebrow: 'INTEGRATED OPERATIONS',
    title: '통합 운영 포털',
    description: '계열사별 사용량과 자원, 배포·보안·권한·데이터 격리를 통합 관리합니다.',
    entry: '/admin/dashboard',
    secondary: [
      { label: '데이터 분리·격리', to: '/admin/data-isolation' },
      { label: '사용자·권한', to: '/admin/members' },
    ],
    capabilities: ['11개 Namespace', 'RBAC·SoD', '미터링·감사'],
    accent: 'blue',
  },
  {
    id: 'governance',
    eyebrow: 'AI GOVERNANCE',
    title: 'AI 거버넌스 포털',
    description: 'AI 서비스 전 생애주기의 위험·정책·승인·산출물과 이행 현황을 관리합니다.',
    entry: '/governance',
    secondary: [{ label: '거버넌스 운영 설정', to: '/governance/admin' }],
    capabilities: ['AI 서비스 원장', '단계·결재 관리', '규제·정책 추적'],
    accent: 'gold',
  },
];

export function canAccessPortal(persona: PersonaLike, portal: PortalId): boolean {
  switch (portal) {
    case 'user':
      return canAccessArea(persona, 'home');
    case 'studio':
      return canAccessArea(persona, 'studio') || canAccessArea(persona, 'knowledge');
    case 'admin':
      return canAccessArea(persona, 'admin');
    case 'governance':
      return canAccessGovernance(persona);
  }
}

export function portalEntryFor(persona: PersonaLike, portal: PortalDefinition): string {
  if (portal.id !== 'studio') return portal.entry;
  if (canAccessArea(persona, 'studio')) return '/studio';
  return '/knowledge';
}

