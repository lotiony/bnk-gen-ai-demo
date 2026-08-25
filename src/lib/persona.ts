/**
 * 현재 로그인된 페르소나 상태를 localStorage 로 관리하는 얇은 헬퍼.
 * PersonaSwitcher · LoginPage · 앱 가드에서 공용으로 사용.
 */
import { useEffect, useState } from 'react';
import { PERSONAS, findPersona, type Persona, type PersonaId } from '@/data/mockPersonas';

export const PERSONA_STORAGE_KEY = 'kbops:current-persona';

/** localStorage에서 현재 페르소나를 읽는다. 없으면 null. */
export function getStoredPersona(): Persona | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(PERSONA_STORAGE_KEY);
  if (!v) return null;
  return findPersona(v) ?? null;
}

export function setStoredPersona(id: PersonaId): void {
  try {
    window.localStorage.setItem(PERSONA_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearStoredPersona(): void {
  try {
    window.localStorage.removeItem(PERSONA_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 현재 페르소나를 리액트 상태로 반환.
 * SSR-safe: 첫 렌더 시 null로 시작하고 마운트 후 localStorage 로드.
 */
export function useCurrentPersona(): Persona | null {
  const [persona, setPersona] = useState<Persona | null>(null);
  useEffect(() => {
    setPersona(getStoredPersona());
  }, []);
  return persona;
}

export { PERSONAS };
