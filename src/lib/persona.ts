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

let current: Persona | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getStoredPersona(): Persona | null {
  return current;
}

export function setStoredPersona(id: PersonaId): void {
  current = findPersona(id) ?? null;
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
