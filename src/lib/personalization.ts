/**
 * 개인화 설정 · 즐겨찾기 — 메모리 전용 스토어.
 *
 * RFP 2-1 사용자 포털:
 *   "즐겨찾기, 개인화 설정(기본 모델, 기본 에이전트 등), 알림 기능"
 *   "사용자별 My Agent, 즐겨찾기, 최근 이용서비스 등 개인화 기능 제공"
 *
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙) — 새로고침하면 초기 상태로
 * 돌아가므로 리허설과 본 시연이 어긋나지 않는다. 패턴은 tenantStore·toast 와 동일.
 */
import { useSyncExternalStore } from 'react';

export interface FavoriteItem {
  id: string;
  kind: '에이전트' | '프롬프트' | 'MCP';
  name: string;
  href: string;
}

let favorites: FavoriteItem[] = [
  { id: 'AGT-301', kind: '에이전트', name: '보이스피싱 1차 분류 에이전트', href: '/catalog' },
  { id: 'MCP-011', kind: 'MCP', name: 'authority.lookup', href: '/catalog' },
];

export interface PersonalizationSettings {
  defaultModel: string;
  defaultAgent: string;
  notifyEmail: boolean;
  notifyPush: boolean;
}

/*
 * useSyncExternalStore 는 getSnapshot 이 매번 새 참조를 반환하면 리렌더가 끝없이
 * 돈다("Maximum update depth exceeded"). 그래서 settings 는 객체 하나를 캐시해
 * 두고, 값이 바뀔 때만 새 객체로 교체한다 — favorites 배열과 같은 원칙이다.
 */
let settings: PersonalizationSettings = {
  defaultModel: 'onprem/gpt-oss-120b',
  defaultAgent: '규정·책무 어시스턴트',
  notifyEmail: true,
  notifyPush: false,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isFavorite(id: string): boolean {
  return favorites.some((f) => f.id === id);
}

export function toggleFavorite(item: FavoriteItem): void {
  favorites = isFavorite(item.id) ? favorites.filter((f) => f.id !== item.id) : [item, ...favorites];
  emit();
}

export function getFavorites(): FavoriteItem[] {
  return favorites;
}

export function useFavorites(): FavoriteItem[] {
  return useSyncExternalStore(subscribe, getFavorites, getFavorites);
}

function getSettings(): PersonalizationSettings {
  return settings;
}

export function setPersonalization(next: Partial<PersonalizationSettings>): void {
  settings = { ...settings, ...next };
  emit();
}

export function usePersonalization(): PersonalizationSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
