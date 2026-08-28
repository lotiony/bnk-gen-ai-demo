/**
 * 프롬프트 템플릿 스토어 — RFP: RAG-001 (버전 관리 · 중앙 제어).
 *
 * 메모리 전용(useSyncExternalStore) — localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 * 새로고침하면 초기 상태로 돌아가므로 리허설과 본 시연이 어긋나지 않는다.
 * 패턴은 tenantStore · personalization 과 동일하다.
 */
import { useSyncExternalStore } from 'react';
import { DEMO_TODAY } from '@/data/demoClock';
import {
  PROMPT_TEMPLATES_SEED,
  type PromptTemplate,
  type PromptVersion,
} from '@/data/mockPrompts';

let templates: PromptTemplate[] = PROMPT_TEMPLATES_SEED;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getTemplates = () => templates;

export function usePromptTemplates(): PromptTemplate[] {
  return useSyncExternalStore(subscribe, getTemplates, getTemplates);
}

/** 시연 세계관 시각으로 고정한다 — `new Date()` 는 시연 당일만 다른 날짜를 찍는다. */
const nowLabel = () => `${DEMO_TODAY} 09:40`;

/** 다음 버전 번호 — versions[0] 이 최신이라는 규약을 따른다. */
const nextVer = (t: PromptTemplate) => `v${t.versions.length + 1}`;

/**
 * 새 버전 배포 — 기존 서빙 버전은 archived 로 내리고 새 버전이 serving 이 된다.
 * centralControl 템플릿이면 전 Namespace 의 RAG 호출에 즉시 반영된다는 것이 시연 서사다.
 */
export function publishVersion(id: string, body: string, changeNote: string, by: string): void {
  templates = templates.map((t) => {
    if (t.id !== id) return t;
    const fresh: PromptVersion = {
      ver: nextVer(t), at: nowLabel(), by, body,
      changeNote: changeNote || '변경 메모 없음', status: 'serving',
    };
    return {
      ...t,
      versions: [fresh, ...t.versions.map((v) => ({ ...v, status: 'archived' as const }))],
    };
  });
  emit();
}

/**
 * 롤백 — 과거 버전의 본문을 **새 버전으로 복제**해 서빙에 올린다.
 * 이력을 지우고 되돌리는 것이 아니라 이력 위에 쌓는다(감사 추적 유지).
 */
export function rollbackTo(id: string, ver: string, by: string): void {
  templates = templates.map((t) => {
    if (t.id !== id) return t;
    const src = t.versions.find((v) => v.ver === ver);
    if (!src) return t;
    const fresh: PromptVersion = {
      ver: nextVer(t), at: nowLabel(), by, body: src.body,
      changeNote: `${ver} 로 롤백`, status: 'serving',
    };
    return {
      ...t,
      versions: [fresh, ...t.versions.map((v) => ({ ...v, status: 'archived' as const }))],
    };
  });
  emit();
}
