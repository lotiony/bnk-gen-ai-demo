/**
 * 현재 선택된 테넌트(계열사/그룹 공통) — **메모리 전용** 스토어.
 *
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 * 부수 효과로 새로고침 시 항상 초기 상태로 돌아가므로,
 * 리허설과 본 시연의 화면이 어긋나지 않는다.
 *
 * 패턴은 deployApprovalStore.ts 와 동일 — useSyncExternalStore 구독형.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_TENANT, type Tenant } from '@/data/tenants';

let current: Tenant = DEFAULT_TENANT;
const listeners = new Set<() => void>();

export function getTenant(): Tenant {
  return current;
}

export function setTenant(t: Tenant): void {
  current = t;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTenant(): Tenant {
  return useSyncExternalStore(subscribe, getTenant, getTenant);
}
