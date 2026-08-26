/**
 * 현재 로그인된 페르소나 — **메모리 전용** 스토어.
 * PersonaSwitcher · LoginPage · 앱 가드에서 공용으로 사용.
 *
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 * 새로고침하면 로그인 화면으로 돌아가므로 시연 시작점이 항상 동일하다.
 *
 * 패턴은 deployApprovalStore.ts 와 동일 — useSyncExternalStore 구독형.
 */
import { useSyncExternalStore } from 'react';
import { PERSONAS, findPersona, type Persona, type PersonaId } from '@/data/mockPersonas';
import { setTenant } from '@/lib/tenantStore';

let current: Persona | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getStoredPersona(): Persona | null {
  return current;
}

/**
 * 페르소나를 바꾸면 **테넌트도 함께 바뀐다.**
 *
 * 계열사는 사용자가 고르는 값이 아니라 IdP/AD 클레임으로 확정되는 값이다
 * (RFP 2-1 "계열사별 SSO 등 통합인증기능 연동" · ONM-001). 그래서 로그인·전환
 * 시점에 페르소나의 소속 계열사를 그대로 테넌트 스토어에 밀어 넣는다.
 *
 * 그룹 운영 역할(`canSwitchTenant`)만 이후 스위처로 다른 Namespace 를 열 수 있다.
 */
export function setStoredPersona(id: PersonaId): void {
  current = findPersona(id) ?? null;
  if (current) setTenant(current.tenant);
  emit();
}

export function clearStoredPersona(): void {
  current = null;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 현재 페르소나를 리액트 상태로 반환. */
export function useCurrentPersona(): Persona | null {
  return useSyncExternalStore(subscribe, getStoredPersona, getStoredPersona);
}

export { PERSONAS };
