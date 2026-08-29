/**
 * 마지막으로 머문 포털 — **메모리 전용** 스토어.
 *
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙). 패턴은 `tenantStore` 와 동일.
 *
 * 왜 필요한가 — `/approvals`(결재함)처럼 네 포털이 공유하는 화면은 경로만 봐서는
 * 어느 포털의 GNB 를 그려야 할지 알 수 없다. 관리자가 통합 운영 포털에서 결재함을
 * 열었는데 GNB 가 업무 포털로 튀면 포털 개념이 그 자리에서 깨진다.
 * 그래서 매인 경로에 들어갈 때마다 여기 기록해 두고, 매이지 않는 경로에서는
 * 이 값을 쓴다(`portalView.usePortal`).
 */
import { useSyncExternalStore } from 'react';
import type { PortalId } from '@/data/portals';

/** 로그인 직후의 기본값 — 전 임직원이 공통으로 여는 포털. */
const DEFAULT_PORTAL: PortalId = 'work';

let current: PortalId = DEFAULT_PORTAL;
const listeners = new Set<() => void>();

export function getLastPortal(): PortalId {
  return current;
}

export function setLastPortal(p: PortalId): void {
  if (current === p) return;
  current = p;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLastPortal(): PortalId {
  return useSyncExternalStore(subscribe, getLastPortal, getLastPortal);
}
