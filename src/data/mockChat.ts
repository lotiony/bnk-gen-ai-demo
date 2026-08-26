/**
 * 사용자 포털 Chat mock — 핸드오프 §2 화면 2 · 3 · 5.
 *
 * RFP: 사용자 포털 요건 · LSM-002 (화면 2)
 *      RAG-007 Graph RAG(필수) · AGB-006① 규정/책무 (화면 3)
 *      SEC-002 · SEC-003 PII 실시간 차단 (화면 5)
 *
 * **답변 본문을 여기서 새로 쓰지 않는다.** 규정·책무 질의의 답변·근거·조항은
 * 전부 `ontologyQueries.ts` 의 `SCENARIOS` 를 그대로 읽는다. 화면 3(대화)과
 * 화면 4(근거 그래프)가 같은 데이터를 봐야 두 화면이 서로 다른 말을 하지 않는다
 * — 데모에서 보인 것이 곧 확약이 되는 구조(RFP Ⅳ.4.1)에서 이건 안전장치다.
 *
 * PII 정책도 마찬가지로 `mockAgentGovernance.getPiiItems()` 를 그대로 쓴다.
 * 화면 5(입력 차단)와 화면 13(정책·탐지 이력)이 같은 정책 목록을 봐야 한다.
 *
 * ⚠️ 전부 가상 데이터다.
 */
import { SCENARIOS, EXTRA_QUESTIONS, type QueryScenario } from '@/data/ontologyQueries';
import { INSTANCES } from '@/data/ontologyInstances';
import { CLASSES, type Axis } from '@/data/ontology';
import { getPiiItems, type PiiItem } from '@/data/mockAgentGovernance';
import type { Tenant } from '@/data/tenants';

/* ═══════════════════════ 에이전트 · 모델 선택 ═══════════════════════ */

export interface ChatAgentOption {
  id: string;
  name: string;
  desc: string;
  /** 무엇에 근거해 답하는가 — 드롭다운에 그대로 노출한다. */
  grounding: string;
  /** 온톨로지 근거 그래프를 쓰는 에이전트인지. 아니면 확정 답변을 못 낸다. */
  ontology: boolean;
  tenant: Tenant;
  /**
   * 이 에이전트의 관리자(소유자) 계정 id 목록.
   *
   * RFP 2-1 사용자 포털: "**전체 프롬프트 보기 기능(해당 AI 에이전트 관리자인 경우)**"
   * — 아무나 시스템 프롬프트를 볼 수 있으면 프롬프트가 곧 자산인 구조가 깨진다.
   * 그래서 소유자만 펼칠 수 있게 계정을 명시한다.
   */
  admins: string[];
  /** 전체 시스템 프롬프트 — 관리자에게만 노출된다. */
  systemPrompt: string;
}

export const CHAT_AGENTS: ChatAgentOption[] = [
  {
    id: 'AGT-301',
    name: '규정·책무 어시스턴트',
    desc: '여신·전결·책무구조 질의에 근거를 붙여 답한다',
    grounding: '여신 온톨로지(ONT-101) + 여신업무규정·전결규정·책무구조도',
    ontology: true,
    tenant: '그룹 공통',
    admins: ['governance_admin', 'project_owner', 'platform_admin'],
    systemPrompt: `당신은 BNK금융그룹의 규정·책무 어시스턴트입니다.

[역할]
- 내규·전결규정·책무구조도에 근거해서만 답합니다.
- 근거를 찾지 못하면 "확인되지 않습니다"라고 답하고 추측하지 않습니다.

[출력 형식]
1) 결론 한 문장
2) 근거 조항 (규정명 · 조문 위치)
3) 개정 이력이 있으면 개정 전후 비교
4) 관련 책무 보유자

[금칙]
- 조문 번호를 추정해서 쓰지 않습니다.
- 고객 개인정보를 답변에 포함하지 않습니다.
- 법률 자문으로 오인될 표현("법적으로 문제없습니다")을 쓰지 않습니다.`,
  },
  {
    id: 'AGT-204',
    name: 'PB 자산진단 어시스턴트',
    desc: '상품·시장 안내 매뉴얼 기반 상담 지원',
    grounding: 'PB_상담_지식인덱스 v4 (문서 RAG)',
    ontology: false,
    tenant: '부산은행',
    admins: ['project_owner', 'agent_dev', 'platform_admin'],
    systemPrompt: `당신은 PB 자산진단 어시스턴트입니다.

[역할]
- PB_상담_지식인덱스 v4 에 근거해 상품·시장 정보를 안내합니다.
- 투자 권유가 아니라 상담 초안 작성을 돕는 것이 목적입니다.

[출력 형식]
- 자산 위험도 / 분산도 / 유동성 점수를 JSON 으로 반환하고, 개선안을 문장으로 덧붙입니다.

[금칙]
- 특정 상품의 수익률을 단정하지 않습니다.
- 고객 식별정보를 응답에 되쓰지 않습니다.`,
  },
  {
    id: 'AGT-118',
    name: '사내 규정 안내 봇',
    desc: '복리후생·근태 등 사내 규정 안내',
    grounding: '그룹 공통 인사규정 인덱스 (문서 RAG)',
    ontology: false,
    tenant: '그룹 공통',
    admins: ['platform_admin'],
    systemPrompt: `당신은 사내 규정 안내 봇입니다.

[역할]
- 복리후생·근태·인사 규정 문의에 사내 규정집 근거로 답합니다.

[금칙]
- 개별 직원의 인사 정보를 조회하거나 언급하지 않습니다.
- 규정 해석이 갈리는 사안은 담당 부서 문의를 안내합니다.`,
  },
];

/** 사용자 포털에서 고를 수 있는 생성 모델 — 전량 On-Premise. */
export const CHAT_MODELS = [
  { id: 'mdl-001', name: 'onprem/gpt-oss-120b', hint: '기본 · 균형' },
  { id: 'mdl-003', name: 'onprem/qwen3-32b', hint: '빠름 · 경량' },
  { id: 'mdl-004', name: 'onprem/llama-3.3-70b', hint: '장문 추론' },
];

/* ═══════════════════════ 대화 이력 ═══════════════════════ */

export type HistoryGroup = '오늘' | '어제' | '지난 7일';

export interface ChatHistoryItem {
  id: string;
  title: string;
  at: string;
  agent: string;
  group: HistoryGroup;
}

export const CHAT_HISTORY: ChatHistoryItem[] = [
  { id: 'C-118', title: '대성정밀 신규 여신 전결 확인', at: '10:24', agent: '규정·책무', group: '오늘' },
  { id: 'C-117', title: '담보인정비율 규정 상한 문의', at: '09:41', agent: '규정·책무', group: '오늘' },
  { id: 'C-116', title: 'ISA 만기 후 운용 상담 정리', at: '어제 17:02', agent: 'PB 자산진단', group: '어제' },
  { id: 'C-115', title: '연차 이월 규정 확인', at: '어제 11:35', agent: '사내 규정', group: '어제' },
  { id: 'C-114', title: '여신협의회 부의 기준', at: '01-06', agent: '규정·책무', group: '지난 7일' },
  { id: 'C-113', title: '퇴직연금 IRP 이전 절차', at: '01-05', agent: 'PB 자산진단', group: '지난 7일' },
  { id: 'C-112', title: '책무구조도 개정 반영 여부', at: '01-03', agent: '규정·책무', group: '지난 7일' },
];

export const HISTORY_GROUPS: HistoryGroup[] = ['오늘', '어제', '지난 7일'];

/* ═══════════════════════ 추천 질의 ═══════════════════════ */

/** 시나리오가 붙어 있어 확정 답변이 나오는 질의. */
export const GROUNDED_QUESTIONS: string[] = SCENARIOS.map((s) => s.question);

/** 자유 입력을 시나리오에 잇는다. 못 이으면 null — 그때는 확정 답변을 내지 않는다. */
export function matchScenario(input: string): QueryScenario | null {
  const q = input.replace(/\s/g, '');
  const exact = SCENARIOS.find((s) => s.question.replace(/\s/g, '') === q);
  if (exact) return exact;
  /*
   * 키워드는 **좁게** 잡는다. '대성정밀' 같은 넓은 키를 쓰면
   * "대성정밀 담보 재평가하면 한도 얼마나 늘어나요?"(시나리오 없음)까지
   * Q1 으로 끌려와 엉뚱한 확정 답변이 나간다. 근거 없는 확정이야말로
   * 이 화면이 하지 않겠다고 말하는 바로 그것이다.
   */
  const KEYS: Record<string, string[]> = {
    Q1: ['대성정밀5억', '신규여신신청', '승인가능한가'],
    Q2: ['8억', '지점장전결', '본부장전결'],
    Q3: ['책무', '심사부실'],
  };
  for (const s of SCENARIOS) {
    if ((KEYS[s.id] ?? []).some((k) => q.includes(k))) return s;
  }
  return null;
}

/**
 * 시나리오가 없는 질의 — 근거 없이는 확정하지 않는다는 걸 보여주는 데 쓴다.
 * 목록을 손으로 고르지 않고 **matchScenario 가 실제로 못 잇는 것만** 남긴다.
 * 손으로 고르면 나중에 키워드를 손질할 때 조용히 어긋난다.
 */
export const UNGROUNDED_QUESTIONS: string[] = EXTRA_QUESTIONS.filter(
  (q) => matchScenario(q) === null,
).slice(0, 3);

/** 근거를 잇지 못했을 때의 답변 — 억지로 지어내지 않는다는 게 메시지다. */
export const UNGROUNDED_ANSWER = {
  head: '이 질의는 근거 그래프에 연결되지 않았습니다.',
  body:
    '온톨로지에서 확정할 수 있는 개체·관계가 잡히지 않아 확정 답변을 드리지 않습니다. ' +
    '추정으로 답하면 근거를 제시할 수 없기 때문입니다.',
  next: [
    '데이터 매핑에 해당 개체가 등록되어 있는지 확인이 필요합니다',
    '아래 추천 질의는 근거가 연결되어 있어 확정 답변이 나옵니다',
  ],
};

/* ═══════════════════════ 결론 ↔ 근거 각주 ═══════════════════════ */

/**
 * 결론 각 줄이 어느 규정 조항에 걸리는지. `ruleBasis` 배열의 인덱스(0-base)다.
 * 원본 시나리오 데이터를 건드리지 않으려고 여기서 별도로 잇는다.
 */
export const CONCLUSION_REFS: Record<string, number[][]> = {
  Q1: [[0], [1], [0]],
  Q2: [[0], [0], [0]],
  Q3: [[0], [1], [0, 1]],
};

/* ═══════════════════════ 근거 경로 (그래프 순회) ═══════════════════════ */

export interface EvidenceHop {
  id: string;
  label: string;
  /** 소속 클래스명. */
  cls: string;
  axis: Axis;
  /** 직전 노드에서 이 노드로 온 관계명. 첫 노드는 없다. */
  rel?: string;
}

const AXIS_OF: Record<string, Axis> = CLASSES.reduce(
  (a, c) => ({ ...a, [c.name]: c.axis }),
  {} as Record<string, Axis>,
);

export const AXIS_TONE: Record<Axis, string> = {
  credit: 'bg-info-bg text-info border-info-border',
  rule: 'bg-brand-tint text-brand border-brand-tint',
  org: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
};

/**
 * 앵커 개체에서 시작해 **가장 긴 경로**를 뽑는다.
 * 순회 엣지는 트리라서 그리디로 첫 가지를 따라가면 한 홉 만에 끝난다 —
 * 실제로 답변을 떠받치는 가지(조항·전결권까지 이어지는 쪽)를 놓친다.
 * 그래서 DFS 로 최장 경로를 고른다. 결정론적이다(입력 순서가 고정이므로).
 */
export function evidencePath(sc: QueryScenario, max = 6): EvidenceHop[] {
  const out = new Map<string, { to: string; rel: string }[]>();
  for (const e of sc.travEdges) {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from)!.push({ to: e.to, rel: e.rel });
  }

  let best: { id: string; rel?: string }[] = [];
  const walk = (node: string, path: { id: string; rel?: string }[], seen: Set<string>) => {
    if (path.length > best.length) best = [...path];
    for (const nx of out.get(node) ?? []) {
      if (seen.has(nx.to)) continue;
      seen.add(nx.to);
      walk(nx.to, [...path, { id: nx.to, rel: nx.rel }], seen);
      seen.delete(nx.to);
    }
  };
  walk(sc.anchorInst, [{ id: sc.anchorInst }], new Set([sc.anchorInst]));

  return best.slice(0, max).map((h) => {
    const inst = INSTANCES.find((i) => i.id === h.id);
    const cls = inst?.cls ?? '개체';
    return {
      id: h.id,
      label: inst?.label ?? h.id,
      cls,
      axis: AXIS_OF[cls] ?? 'credit',
      rel: h.rel,
    };
  });
}

/* ═══════════════════════ PII 실시간 차단 (화면 5) ═══════════════════════ */

/** 화면 13(가드레일 정책)과 **같은 정책 목록**을 본다. */
export const CHAT_PII_ITEMS: PiiItem[] = getPiiItems('AGT-204').filter((p) => p.active);

export interface PiiHit {
  item: PiiItem;
  matched: string;
  masked: string;
  index: number;
}

/**
 * 입력 문자열에서 활성 PII 패턴을 찾는다. 전송 전에 **입력 단계에서** 돈다.
 * 서버로 나가고 나서 마스킹하면 이미 늦다 — 그게 SEC-002·003 의 요지다.
 */
export function detectPii(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const item of CHAT_PII_ITEMS) {
    let re: RegExp;
    try {
      re = new RegExp(item.pattern, 'g');
    } catch {
      continue; // 잘못된 패턴은 조용히 건너뛴다 — 입력창이 죽으면 안 된다
    }
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ item, matched: m[0], masked: item.maskTemplate, index: m.index });
      if (m[0] === '') break;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** 탐지 구간을 마스크 템플릿으로 바꾼 문자열. */
export function maskPii(text: string, hits: PiiHit[]): string {
  let out = '';
  let cur = 0;
  for (const h of [...hits].sort((a, b) => a.index - b.index)) {
    if (h.index < cur) continue;
    out += text.slice(cur, h.index) + h.masked;
    cur = h.index + h.matched.length;
  }
  return out + text.slice(cur);
}

/** 시연용 — 주민등록번호와 계좌번호가 함께 들어간 프롬프트. */
export const PII_DEMO_PROMPT =
  '고객 홍서준(910523-1094821) 님 계좌 097-13-0284517 잔액과 여신 한도 알려줘';

/* ═══════════════════════ 재생 연출 ═══════════════════════ */

/** 답변 생성 단계 — 좌측 대화창에 순서대로 뜬다. 화면 4 의 스텝과 같은 축이다. */
export const RUN_STEPS: { kind: string; label: string; ms: number }[] = [
  { kind: 'plan', label: '질의 해석 · 실행 계획 수립', ms: 520 },
  { kind: 'anchor', label: '온톨로지 개체 앵커링', ms: 480 },
  { kind: 'traverse', label: '관계 순회 · 근거 경로 확정', ms: 620 },
  { kind: 'doc', label: '규정 조항 원문 조회', ms: 520 },
  { kind: 'compute', label: '규칙 계산 · 판정', ms: 560 },
];

export const RUN_STEP_TONE: Record<string, string> = {
  plan: 'bg-surface text-ink-mid border-line-soft',
  anchor: 'bg-brand-tint text-brand border-brand-tint',
  traverse: 'bg-info-bg text-info border-info-border',
  doc: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
  compute: 'bg-warn-bg text-warn border-warn-border',
};
