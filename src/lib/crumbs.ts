/**
 * 과제 화면의 브레드크럼 조립기.
 *
 * 같은 과제 화면이 두 경로에서 열린다 —
 *   · `/studio/…`, `/knowledge/…`  : AI Studio · 지식 데이터 메뉴에서 진입한 경우
 *   · `/projects/:projectId/tasks/…` : 프로젝트 상세에서 진입한 경우(딥링크 보존)
 *
 * 프로젝트 단위는 GNB 에서 내렸지만 기존 딥링크는 살아 있어야 하므로,
 * **경로를 보고 상위 계층을 바꾼다.** 화면마다 if 문을 흩뿌리지 않으려고 여기 모았다.
 */
import { useLocation } from 'react-router-dom';

export interface CrumbItem {
  label: string;
  to?: string;
}

/** 프로젝트 경로에서 진입했을 때 상위에 끼울 프로젝트명. */
const PROJECT_LABEL = 'PB 에이전트 프로젝트';

export function useWorkCrumb(leaf: string, pid: string): CrumbItem[] {
  const { pathname } = useLocation();
  const home: CrumbItem = { label: '홈', to: '/' };

  if (pathname.startsWith('/studio')) {
    return [home, { label: 'AI Studio', to: '/studio' }, { label: leaf }];
  }
  if (pathname.startsWith('/knowledge')) {
    return [home, { label: '지식 · 데이터', to: '/knowledge' }, { label: leaf }];
  }
  return [
    home,
    { label: '프로젝트', to: '/projects' },
    { label: PROJECT_LABEL, to: `/projects/${pid}` },
    { label: leaf },
  ];
}

/**
 * 저장·취소 후 돌아갈 곳.
 * Studio·지식 메뉴에서 들어왔으면 프로젝트 상세로 튕기면 안 된다.
 */
export function useWorkReturnPath(pid: string): string {
  const { pathname } = useLocation();
  if (pathname.startsWith('/studio')) return '/studio';
  if (pathname.startsWith('/knowledge')) return '/knowledge';
  return `/projects/${pid}`;
}

/** 돌아가기 버튼 라벨 — 진입 경로에 맞춰 목적지를 그대로 말한다. */
export function useWorkReturnLabel(): string {
  const { pathname } = useLocation();
  if (pathname.startsWith('/studio')) return '← AI Studio로';
  if (pathname.startsWith('/knowledge')) return '← 지식·데이터로';
  return '← 과제 목록으로';
}

/**
 * 워크스페이스 셸(좌측 사이드바) 안에서 열렸는지.
 *
 * 과제 화면들은 원래 전폭 페이지라 자기 컨테이너(`max-w-… mx-auto px-…`)를 갖고 있다.
 * 셸 안에서는 바깥 컨테이너가 이미 폭·여백을 잡으므로 그대로 두면 이중으로 좁아진다.
 * 그래서 셸 안에서는 `w-full` 로 바꿔 준다.
 */
export function useInWorkspace(): boolean {
  const { pathname } = useLocation();
  return pathname.startsWith('/studio') || pathname.startsWith('/knowledge');
}

/** 셸 안이면 전폭 클래스, 밖이면 원래 컨테이너 클래스를 돌려준다. */
export function useWorkContainer(standalone: string, shell = 'w-full'): string {
  return useInWorkspace() ? shell : standalone;
}
