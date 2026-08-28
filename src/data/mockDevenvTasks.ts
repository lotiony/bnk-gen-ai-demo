/**
 * 개발환경 과제 mock.
 *
 * 종류:
 *  · Coder    — 개발자별 개인 IDE 워크스페이스 (사람당 1개)
 *  · Jenkins  — 프로젝트 CI 빌드 파이프라인
 *  · ArgoCD   — 프로젝트 GitOps 배포 동기화
 */

export type DevenvKind = 'coder' | 'jenkins' | 'argocd';
export type DevenvState = '실행 중' | '정지' | '오류' | '동기화 대기';

export interface DevenvTask {
  id: string;
  kind: DevenvKind;
  /** 표시 이름. */
  name: string;
  /** Coder는 사용자 표시, 도구는 프로젝트 표시. */
  scope: 'user' | 'project';
  /** 소유자 / 담당자. */
  ownerName: string;
  ownerInitial: string;
  /** 현재 상태. */
  state: DevenvState;
  /** 최근 활동. */
  lastActivity: string;
  /** Coder: VSCode/JetBrains, Jenkins: 파이프라인 수, ArgoCD: 앱 수 등 도구별 보조 메타. */
  meta: string;
}

export const MOCK_DEVENV_TASKS: DevenvTask[] = [
  // 사람별 Coder × 2
  {
    id: 'DEV-CDR-204',
    kind: 'coder',
    name: 'workspace-박서연 (PB)',
    scope: 'user',
    ownerName: '박서연',
    ownerInitial: '서연',
    state: '실행 중',
    lastActivity: '2026-06-03 14:38',
    meta: 'VS Code · Python 3.12 · GPU 1× A100',
  },
  {
    id: 'DEV-CDR-205',
    kind: 'coder',
    name: 'workspace-이도현 (PB)',
    scope: 'user',
    ownerName: '이도현',
    ownerInitial: '도현',
    state: '정지',
    lastActivity: '2026-06-02 18:02',
    meta: 'JetBrains PyCharm · Python 3.11 · CPU only',
  },
  // 프로젝트 Jenkins
  {
    id: 'DEV-CI-101',
    kind: 'jenkins',
    name: 'PB Agent CI 파이프라인',
    scope: 'project',
    ownerName: '박서연',
    ownerInitial: '서연',
    state: '실행 중',
    lastActivity: '2026-06-03 14:02',
    meta: '파이프라인 4 · 오늘 빌드 12회 · 성공률 91.7%',
  },
  // 프로젝트 ArgoCD
  {
    id: 'DEV-CD-101',
    kind: 'argocd',
    name: 'PB Agent GitOps 동기화',
    scope: 'project',
    ownerName: '강민호',
    ownerInitial: '민호',
    state: '동기화 대기',
    lastActivity: '2026-06-03 13:47',
    meta: '앱 3 · 동기화 OK 2 · OutOfSync 1',
  },
];

export const DEVENV_LABEL: Record<DevenvKind, string> = {
  coder: 'Coder · IDE Workspace',
  jenkins: 'Jenkins · CI',
  argocd: 'ArgoCD · CD/GitOps',
};

export function findDevenvTask(id: string): DevenvTask | undefined {
  return MOCK_DEVENV_TASKS.find((t) => t.id === id);
}
