import WorkspaceLayout, { type WorkspaceNavItem } from './WorkspaceLayout';
import AreaGuard from './AreaGuard';

/**
 * AI Studio 셸.
 *
 * RFP 기술요건 구분 4 「에이전트 및 워크플로우 빌더」(AGB-001~012)를 한 메뉴로 묶고,
 * 여기에 검증 도구(LSM-005 모델 플레이그라운드 · RAG-009 RAG 플레이그라운드)와
 * 개발 환경(ONM-008)을 붙였다.
 *
 * 프로젝트 메뉴를 대체한다 — RFP 에 사용자 포털의 프로젝트 계층은 없고,
 * `과제` 는 관리자 포털의 개념이다(2-1 「과제 관리 화면」).
 */
const NAV: WorkspaceNavItem[] = [
  { label: '과제', to: '/studio', hint: '내가 만드는 것 전부', group: '작업', end: true },
  {
    label: '에이전트 빌더',
    to: '/studio/agents',
    hint: '프롬프트·모델·도구 결합',
    group: '제작',
  },
  {
    label: '워크플로우 빌더',
    to: '/studio/workflow',
    hint: '노코드 · Trace · 보상',
    group: '제작',
  },
  { label: 'Tool · MCP', to: '/studio/tools', hint: 'OpenAPI·전문 자동 변환', group: '제작' },
  {
    label: '프롬프트 라이브러리',
    to: '/studio/prompts',
    hint: '템플릿 · 버전 · 중앙 제어',
    group: '제작',
  },
  {
    label: '플레이그라운드',
    to: '/studio/playground',
    hint: '모델 · RAG 시험',
    group: '검증',
  },
  { label: '개발환경', to: '/studio/devenv', hint: 'Coder · CI · CD', group: '운영' },
];

const GROUPS = ['작업', '제작', '검증', '운영'];

export default function StudioLayout() {
  return (
    <AreaGuard area={'studio'}>
      <WorkspaceLayout
        eyebrow="제작 워크스페이스"
        title="AI Studio"
        subtitle="에이전트 · 워크플로우 · 검증"
        nav={NAV}
        groups={GROUPS}
      />
    </AreaGuard>
  );
}
