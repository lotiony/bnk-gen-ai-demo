/**
 * 재사용 자산 템플릿 mock + 메모리 스토어.
 *
 * RFP 2-1 마켓플레이스: "에이전트/워크플로우/프롬프트의 **템플릿화** 및 조직 내
 * 재사용 자산 관리"
 *
 * 검증된 과제를 템플릿으로 저장해 두면 다른 팀이 처음부터 만들지 않고 복제해서
 * 시작할 수 있다. 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import { useSyncExternalStore } from 'react';

export type TemplateKind = '에이전트' | '워크플로우' | '프롬프트';

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  name: string;
  desc: string;
  usedCount: number;
  savedBy: string;
}

const SEED_TEMPLATES: TemplateItem[] = [
  { id: 'TPL-01', kind: '에이전트', name: '민원 분류·회신 초안 템플릿', desc: '민원 텍스트 분류 + 표준 회신 초안 생성 구조를 그대로 복제', usedCount: 6, savedBy: '이서준' },
  { id: 'TPL-02', kind: '워크플로우', name: '승인 기반 심사 워크플로우 템플릿', desc: '접수→규정검색→조건분기→심사→전결조회 5단계 골격', usedCount: 4, savedBy: '박서연' },
  { id: 'TPL-03', kind: '프롬프트', name: '규정 요약 3줄 템플릿', desc: '조항 원문을 실무자 언어로 요약하는 표준 프롬프트', usedCount: 12, savedBy: '박거버' },
];

/* ═══════════════════════ 템플릿 스토어 (메모리 전용) ═══════════════════════ */

/**
 * "템플릿으로 저장" 이 토스트만 띄우면 요건 문장의 **템플릿화** 가 화면에서
 * 증명되지 않는다. 저장한 템플릿이 실제로 목록에 나타나야 "검증된 자산을
 * 템플릿으로 만들어 조직이 복제해 쓴다" 는 흐름이 한 화면에서 닫힌다.
 *
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙). 패턴은 deployApprovalStore·
 * contentStore 와 동일한 useSyncExternalStore 구독형이다.
 */
let templates: TemplateItem[] = [...SEED_TEMPLATES];
let tplSeq = SEED_TEMPLATES.length;

const tplListeners = new Set<() => void>();
const tplEmit = () => tplListeners.forEach((l) => l());
function tplSubscribe(l: () => void) {
  tplListeners.add(l);
  return () => tplListeners.delete(l);
}

export function getTemplates(): TemplateItem[] {
  return templates;
}

/** 컴포넌트에서 템플릿 목록 변경에 반응하도록 구독. */
export function useTemplates(): TemplateItem[] {
  return useSyncExternalStore(tplSubscribe, getTemplates, getTemplates);
}

/** 템플릿 저장 — 목록 맨 앞에 붙는다. 반환값은 새 템플릿 ID. */
export function addTemplate(input: {
  kind: TemplateKind;
  name: string;
  desc: string;
  savedBy: string;
}): string {
  const id = `TPL-${String(++tplSeq).padStart(2, '0')}`;
  templates = [{ id, usedCount: 0, ...input }, ...templates];
  tplEmit();
  return id;
}

/** 템플릿 복제 사용 — 사용 횟수를 올린다(재사용 자산 관리 지표). */
export function markTemplateUsed(id: string): void {
  templates = templates.map((t) => (t.id === id ? { ...t, usedCount: t.usedCount + 1 } : t));
  tplEmit();
}
