/**
 * 그룹 공통 인증 세션 — 메모리 전용 mock.
 *
 * RFP 1.1.4 / ONM-001:
 * 계열사 IdP가 확정한 로그인 소속과, 로그인 뒤 관리자가 전환하는 작업 Namespace는
 * 서로 다른 컨텍스트다. 기존 persona.tenant 하나로 두 값을 겸용하지 않도록 세션에
 * 로그인 소속과 인증 방식을 별도로 보관한다.
 */
import { useSyncExternalStore } from 'react';
import type { PersonaId, RfpRole } from '@/data/mockPersonas';
import type { Tenant } from '@/data/tenants';

export type AuthMode = 'sso' | 'demo';

export interface AuthSession {
  mode: AuthMode;
  /** 실제 로그인에 사용한 계열사. 그룹 공통 Namespace와 구분한다. */
  loginCompany: Tenant;
  personaId: PersonaId;
  displayName: string;
  department: string;
  role: RfpRole;
  authenticatedAt: string;
  mfa: '계열사 정책 적용' | '시연 세션';
  claims: string[];
}

let current: AuthSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function getAuthSession(): AuthSession | null {
  return current;
}

export function setAuthSession(session: AuthSession): void {
  current = session;
  emit();
}

export function clearAuthSession(): void {
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(subscribe, getAuthSession, getAuthSession);
}

