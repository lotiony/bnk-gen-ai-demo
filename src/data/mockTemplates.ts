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
import {
  TPL_APPROVAL_NODES,
  TPL_APPROVAL_EDGES,
  type WfNode,
  type WfEdge,
} from './mockWorkflow';
import type { AgentBuilder } from './mockAgentTasks';

export type TemplateKind = '에이전트' | '워크플로우' | '프롬프트';

/* ═══════════════════════ 복제 프리셋 ═══════════════════════ */

/**
 * 템플릿이 실제로 **무엇을 채워 주는가**.
 *
 * 「이 템플릿 사용하기」가 토스트만 띄우면 요건 문장의 '재사용' 이 화면에서
 * 증명되지 않는다. 빌더로 이동해 **인풋이 실제로 채워져 있어야** 복제라고
 * 말할 수 있다. 그 채울 값이 여기 있다.
 *
 * 종류마다 채우는 대상이 다르다 —
 *   · 에이전트   : 등록 폼 필드 묶음
 *   · 워크플로우 : 캔버스의 노드·연결
 *   · 프롬프트   : 라이브러리에서 열어 줄 템플릿 ID
 */
export interface AgentPreset {
  name: string;
  stage: '학습계' | '서빙계';
  /** 빌더 종류는 에이전트 과제 쪽 리터럴을 그대로 쓴다 — 두 화면이 다른 말을 하면 안 된다. */
  builder: AgentBuilder;
  systemPrompt: string;
  mainModel: string;
  fallbackModel: string;
  tools: string[];
  linkedKnowledge: string[];
  pii: boolean;
  redteam: boolean;
}

export type TemplatePreset =
  | { kind: '에이전트'; agent: AgentPreset }
  | { kind: '워크플로우'; nodes: WfNode[]; edges: WfEdge[] }
  | { kind: '프롬프트'; promptId: string };

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  name: string;
  desc: string;
  usedCount: number;
  savedBy: string;
  /** 복제 시 빌더에 채워 넣을 값. 없으면 빌더 기본값으로 연다. */
  preset?: TemplatePreset;
}

/** 템플릿이 열어야 할 빌더 경로. 복제는 `?tpl=<id>` 로 이어진다. */
export const TEMPLATE_TARGET: Record<TemplateKind, string> = {
  '에이전트': '/studio/agents',
  '워크플로우': '/studio/workflow',
  '프롬프트': '/studio/prompts',
};

const SEED_TEMPLATES: TemplateItem[] = [
  {
    id: 'TPL-01',
    kind: '에이전트',
    name: '민원 분류·회신 초안 템플릿',
    desc: '민원 텍스트 분류 + 표준 회신 초안 생성 구조를 그대로 복제',
    usedCount: 6,
    savedBy: '이서준',
    preset: {
      kind: '에이전트',
      agent: {
        name: '민원 분류·회신 초안 에이전트 (복제본)',
        stage: '학습계',
        builder: 'studio',
        systemPrompt:
          '당신은 접수된 민원을 분류하고 표준 회신 초안을 작성하는 어시스턴트입니다. ' +
          '① 민원 유형을 사전 정의된 분류 체계로 분류하고 ② 근거가 된 내규 조항을 인용한 뒤 ' +
          '③ 표준 회신 문안 초안을 작성합니다. 근거를 찾지 못하면 초안을 쓰지 말고 ' +
          '"근거 없음" 으로 반려하십시오. 회신 초안에는 생성형 AI 가 작성했음을 고지합니다.',
        mainModel: 'onprem/gpt-oss-120b',
        fallbackModel: 'google/gemma-4-31B-it-assistant',
        tools: ['rag_search'],
        linkedKnowledge: ['KNW-201'],
        pii: true,
        redteam: true,
      },
    },
  },
  {
    id: 'TPL-02',
    kind: '워크플로우',
    name: '승인 기반 심사 워크플로우 템플릿',
    desc: '접수→규정검색→조건분기→심사→전결조회 5단계 골격',
    usedCount: 4,
    savedBy: '박서연',
    preset: { kind: '워크플로우', nodes: TPL_APPROVAL_NODES, edges: TPL_APPROVAL_EDGES },
  },
  {
    id: 'TPL-03',
    kind: '프롬프트',
    name: '규정 요약 3줄 템플릿',
    desc: '조항 원문을 실무자 언어로 요약하는 표준 프롬프트',
    usedCount: 12,
    savedBy: '박거버',
    // 마켓플레이스·프롬프트 라이브러리와 같은 자산을 가리킨다(PRM-* 리터럴 재사용).
    preset: { kind: '프롬프트', promptId: 'PRM-101' },
  },
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
  /** 저장 시점의 구성. 이걸 담아야 나중에 복제했을 때 그 화면이 되살아난다. */
  preset?: TemplatePreset;
}): string {
  const id = `TPL-${String(++tplSeq).padStart(2, '0')}`;
  templates = [{ id, usedCount: 0, ...input }, ...templates];
  tplEmit();
  return id;
}

/** ID 로 템플릿 조회 — 빌더가 `?tpl=` 을 해석할 때 쓴다. */
export function getTemplate(id: string | null | undefined): TemplateItem | undefined {
  if (!id) return undefined;
  return templates.find((t) => t.id === id);
}

/** 템플릿 복제 사용 — 사용 횟수를 올린다(재사용 자산 관리 지표). */
export function markTemplateUsed(id: string): void {
  templates = templates.map((t) => (t.id === id ? { ...t, usedCount: t.usedCount + 1 } : t));
  tplEmit();
}
