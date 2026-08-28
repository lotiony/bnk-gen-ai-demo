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
    /** 그룹 공통 필수 Use Case ①(AGB-006) — GROUP_AGENTS·SERVICE_ITEMS 와 동일한 GRP-001. */
    id: 'GRP-001',
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
    admins: ['agent_lead', 'project_owner', 'agent_dev', 'platform_admin'],
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
    /*
     * 예전에는 여기에 `AGT-118 사내 규정 안내 봇` 이 있었다. 그런데 그 ID 는
     * 카탈로그(`mockCatalogAgents`)에도 그룹 공통 에이전트(`mockGroupAgents`)
     * 에도 없었다 — 정거장 2·3 드롭다운에는 3개가 보이는데 정거장 6
     * 마켓플레이스에는 2개만 있는 상태였다. 그래서 **실제로 등재된**
     * AGB-006② 그룹웨어 문서 어시스턴트(GRP-002)로 교체했다.
     */
    id: 'GRP-002',
    name: '그룹웨어 문서 어시스턴트',
    desc: '사내 전자문서·규정 문서를 찾아 요약한다',
    grounding: '그룹웨어 전자문서 인덱스 (문서 RAG · HWP·DOCX·PDF 파서)',
    ontology: false,
    tenant: '그룹 공통',
    admins: ['platform_admin', 'operator'],
    systemPrompt: `당신은 그룹웨어 문서 어시스턴트입니다.

[역할]
- 그룹웨어에 게시된 내부문서·규정 문서를 검색해 근거 문서를 밝히고 요약합니다.
- 문서에서 확인되지 않는 내용은 "문서에서 확인되지 않습니다"라고 답합니다.

[출력 형식]
1) 요약 답변
2) 근거 문서명 · 게시 부서 · 최종 개정일

[금칙]
- 개별 직원의 인사 정보를 조회하거나 언급하지 않습니다.
- 규정 해석이 갈리는 사안은 소관 부서 문의를 안내합니다.`,
  },
];

/**
 * 현재 계열사에서 고를 수 있는 에이전트.
 *
 * 그룹 공통 자산은 10개 계열사 전 임직원이 쓰고, 계열사 자산은 그 Namespace
 * 안에서만 보인다(SEC-001). 필터를 걸지 않으면 경남은행 일반 사용자
 * (`kn_service_user` 하사용)에게 부산은행 자산인 AGT-204 가 그대로 보인다 —
 * 시연 중 페르소나를 잘못 바꾸는 순간 격리 서사가 그 자리에서 깨진다.
 *
 * ⚠️ 화면(ChatPage)이 아직 `CHAT_AGENTS` 를 그대로 쓰고 있다. 드롭다운을
 *    `chatAgentsFor(tenant)` 로 바꿔야 이 통제가 실제로 걸린다.
 */
export function chatAgentsFor(tenant: Tenant): ChatAgentOption[] {
  return CHAT_AGENTS.filter((a) => a.tenant === '그룹 공통' || a.tenant === tenant);
}

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
  { id: 'C-117', title: '여신 8억 전결 기준 확인', at: '09:41', agent: '규정·책무', group: '오늘' },
  { id: 'C-116', title: 'ISA 만기 후 운용 상담 정리', at: '어제 17:02', agent: 'PB 자산진단', group: '어제' },
  { id: 'C-115', title: '연차 이월 규정 확인', at: '어제 11:35', agent: '그룹웨어 문서', group: '어제' },
  { id: 'C-114', title: '여신협의회 부의 기준', at: '06-01', agent: '규정·책무', group: '지난 7일' },
  { id: 'C-113', title: '퇴직연금 IRP 이전 절차', at: '05-31', agent: 'PB 자산진단', group: '지난 7일' },
  { id: 'C-112', title: '여신 심사부실 책무 소재', at: '05-29', agent: '규정·책무', group: '지난 7일' },
];

export const HISTORY_GROUPS: HistoryGroup[] = ['오늘', '어제', '지난 7일'];

/* ═══════════════════════ 이력 이어하기 ═══════════════════════ */

/**
 * 이력 「이어하기」 시드 — RFP 2-1 "사용자별 대화 이력 관리(최근 대화 확인, 이어하기)".
 *
 * 이력 항목을 클릭하면 그 대화가 복원되고 이어서 질문할 수 있다.
 * 규정·책무 대화는 **SCENARIOS 를 원천으로 복원**한다 — 화면 3(대화)·화면 4(근거 그래프)와
 * 같은 데이터라 복원된 답변이 라이브 답변과 어긋나지 않는다.
 * 문서 RAG 대화(PB·사내규정)는 근거 그래프가 없으므로 plain 답변으로 복원한다.
 */
interface HistorySeedMsg {
  role: 'user' | 'assistant';
  text: string;
  /** 확정 답변이면 원천 시나리오 id — text 는 시나리오 verdict 로 대체된다. */
  scId?: string;
  /** 문서 RAG 계열 일반 답변(근거 그래프 없음). */
  plain?: boolean;
}

const HISTORY_SEED: Record<string, { agentId: string; msgs: HistorySeedMsg[] }> = {
  'C-118': {
    agentId: 'GRP-001',
    msgs: [{ role: 'user', text: '' }, { role: 'assistant', text: '', scId: 'Q1' }],
  },
  'C-117': {
    agentId: 'GRP-001',
    msgs: [{ role: 'user', text: '' }, { role: 'assistant', text: '', scId: 'Q2' }],
  },
  'C-116': {
    agentId: 'AGT-204',
    msgs: [
      { role: 'user', text: '고객 ISA 계좌가 다음 달 만기인데, 만기 후 운용 방안 상담 초안을 정리해줘.' },
      {
        role: 'assistant', plain: true,
        text: 'PB_상담_지식인덱스 v4 기준으로 ISA 만기 후 선택지는 ① 계약 연장(비과세 한도 유지) ② 연금계좌(IRP·연금저축) 전환 ③ 해지 후 일반 운용 세 갈래입니다. 고객 위험성향이 「중립」이면 전환 시 세액공제 한도(900만 원)를 함께 안내하는 초안을 권장합니다. 상세 수익률·세율은 상담 화면의 상품 고시 정보를 따르십시오.',
      },
    ],
  },
  'C-115': {
    agentId: 'GRP-002',
    msgs: [
      { role: 'user', text: '연차 이월은 며칠까지 가능한가요?' },
      {
        role: 'assistant', plain: true,
        text: '그룹웨어 전자문서 인덱스에서 「인사규정 시행세칙」(인사부 · 최종 개정 2026-04-17)을 찾았습니다. 미사용 연차는 최대 5일까지 다음 해로 이월할 수 있으며 이월분은 다음 해 6월 말까지 사용해야 합니다. 부서별 운영 기준이 다를 수 있으니 확정 판단은 인사 담당 부서 안내를 따르십시오.',
      },
    ],
  },
  // 재질의 — 같은 질문을 다른 날 다시 물은 이력. 답은 항상 같은 시나리오에서 나온다.
  'C-114': {
    agentId: 'GRP-001',
    msgs: [{ role: 'user', text: '' }, { role: 'assistant', text: '', scId: 'Q1' }],
  },
  'C-113': {
    agentId: 'AGT-204',
    msgs: [
      { role: 'user', text: 'IRP 계좌를 타행에서 우리 은행으로 이전하는 절차를 정리해줘.' },
      {
        role: 'assistant', plain: true,
        text: '실물 이전 신청 → 기존 금융기관 해지·이전 동의 → 이전 완료(영업일 3~5일) 순서입니다. 이전 중에는 매매가 제한되며 디폴트옵션 재지정이 필요합니다. 고객 안내 시 수수료·상품 라인업 차이를 함께 안내하는 초안을 권장합니다.',
      },
    ],
  },
  'C-112': {
    agentId: 'GRP-001',
    msgs: [{ role: 'user', text: '' }, { role: 'assistant', text: '', scId: 'Q3' }],
  },
};

export interface SeededMsg {
  role: 'user' | 'assistant';
  text: string;
  sc?: QueryScenario;
  plain?: boolean;
}

/** 이력 id → 복원된 대화. 시나리오 참조는 여기서 풀어 화면은 결과만 쓴다. */
export function seedHistory(historyId: string): { agent: ChatAgentOption; msgs: SeededMsg[] } | null {
  const seed = HISTORY_SEED[historyId];
  if (!seed) return null;
  const agent = CHAT_AGENTS.find((a) => a.id === seed.agentId) ?? CHAT_AGENTS[0];
  return {
    agent,
    msgs: seed.msgs.map((m) => {
      const sc = m.scId ? SCENARIOS.find((s) => s.id === m.scId) : undefined;
      // 유저 질문이 비어 있으면 시나리오 질문으로 채운다(질문·답이 같은 원천).
      const pairSc = seed.msgs.find((x) => x.scId)?.scId;
      const pairScenario = pairSc ? SCENARIOS.find((s) => s.id === pairSc) : undefined;
      const text = sc ? sc.verdict : m.text || (m.role === 'user' ? pairScenario?.question ?? '' : '');
      return { role: m.role, text, sc, plain: m.plain };
    }),
  };
}

/* ═══════════════════════ 추천 질의 ═══════════════════════ */

/** 시나리오가 붙어 있어 확정 답변이 나오는 질의. */
export const GROUNDED_QUESTIONS: string[] = SCENARIOS.map((s) => s.question);

/* ─────────── 문서 RAG 에이전트의 답변 뱅크 ─────────── */

/**
 * 온톨로지를 쓰지 않는 에이전트(문서 RAG)의 질의·답변.
 *
 * 왜 필요한가 — 근거 그래프를 쓰는 것은 GRP-001 하나뿐이라, 나머지 에이전트는
 * 무엇을 물어도 "근거를 잇지 못했다"만 냈다. AGB-006 은 필수 Use Case **10종**을
 * 요구하는데 실제로 답하는 게 1종이면 상세제안 항목에서 바로 지적된다.
 * 그래서 **문서 RAG 계열도 실제로 답하게** 시나리오를 붙인다.
 *
 * 다만 답변에 근거 그래프를 붙이지는 않는다 — 그건 GRP-001 만의 것이고,
 * 두 계열의 차이(확정 판정 vs 문서 인용 요약)가 화면에서 구분돼야 정거장 4의
 * "확률적 추측이 아니라 규칙과 계산으로 확정" 이 힘을 갖는다.
 *
 * 이력 복원(HISTORY_SEED)의 plain 답변과 같은 톤·같은 인덱스를 쓴다.
 */
export interface DocAnswer {
  q: string;
  a: string;
}

export const DOC_ANSWERS: Record<string, DocAnswer[]> = {
  'AGT-204': [
    {
      q: 'ISA 만기 후 운용 방안 상담 초안을 정리해줘.',
      a:
        'PB_상담_지식인덱스 v4(KNW-198) 기준으로 ISA 만기 후 선택지는 ① 계약 연장(비과세 한도 유지) ' +
        '② 연금계좌(IRP·연금저축) 전환 ③ 해지 후 일반 운용 세 갈래입니다. 고객 위험성향이 「중립」이면 ' +
        '전환 시 세액공제 한도를 함께 안내하는 초안을 권장합니다. 상세 수익률·세율은 상담 화면의 상품 고시 ' +
        '정보를 따르십시오. (근거: 상품매뉴얼 2026 개정판 · 절세상품 안내서 v3)',
    },
    {
      q: '보유 자산 위험도·분산도 진단 결과를 어떻게 읽나요?',
      a:
        '위험도·분산도·유동성 세 축을 0~100 으로 산출하고 종합 점수를 냅니다. 분산도 60 미만이면 ' +
        '단일 자산군 집중, 유동성 50 미만이면 단기 자금 소요 대응 곤란으로 봅니다. 진단 결과는 ' +
        'JSON 으로 반환되며 개선안은 문장으로 덧붙습니다. 투자 권유가 아니라 상담 초안 작성 보조입니다. ' +
        '(근거: 그룹 PB 자산진단 가이드 v3.2)',
    },
    {
      q: 'IRP 계좌를 타행에서 이전하는 절차를 알려줘.',
      a:
        '실물 이전 신청 → 기존 금융기관 해지·이전 동의 → 이전 완료(영업일 3~5일) 순서입니다. ' +
        '이전 중에는 매매가 제한되며 디폴트옵션 재지정이 필요합니다. 고객 안내 시 수수료·상품 라인업 ' +
        '차이를 함께 안내하는 초안을 권장합니다. (근거: 퇴직연금 업무매뉴얼 2026 · 이전 절차편)',
    },
  ],
  'GRP-002': [
    {
      q: '연차 이월은 며칠까지 가능한가요?',
      a:
        '그룹웨어 전자문서 인덱스에서 「인사규정 시행세칙」(인사부 · 최종 개정 2026-04-17)을 찾았습니다. ' +
        '미사용 연차는 최대 5일까지 다음 해로 이월할 수 있으며 이월분은 다음 해 6월 말까지 사용해야 합니다. ' +
        '부서별 운영 기준이 다를 수 있으니 확정 판단은 인사 담당 부서 안내를 따르십시오.',
    },
    {
      q: '품의서 서식 최신본이 어디 있나요?',
      a:
        '「품의·보고 표준서식 v5」(경영관리부 · 최종 개정 2026-05-11)가 그룹웨어 서식함 > 공통서식에 ' +
        '게시돼 있습니다. v4 대비 예산 근거란과 근거규정 인용란이 필수로 바뀌었습니다. 계열사별 부속 ' +
        '서식은 각 사 서식함을 함께 확인하십시오.',
    },
    {
      q: '재택근무 신청 절차를 정리해줘.',
      a:
        '「유연근무 운영지침」(인사부 · 최종 개정 2026-03-02) 기준, 신청은 전주 목요일까지 그룹웨어 ' +
        '근태 메뉴에서 하고 부서장 승인으로 확정됩니다. 주 2일까지 신청 가능하며 대고객 창구 직무는 ' +
        '지침상 제외 직무로 분류돼 있습니다. 예외 운영은 소관 부서 협의가 필요합니다.',
    },
  ],
};

/** 이 에이전트로 확정(또는 문서 인용) 답변이 나오는 추천 질의. */
export function suggestedQuestions(agentId: string): string[] {
  const agent = CHAT_AGENTS.find((a) => a.id === agentId);
  if (agent?.ontology) return GROUNDED_QUESTIONS;
  return (DOC_ANSWERS[agentId] ?? []).map((d) => d.q);
}

/**
 * 문서 RAG 답변 매칭. 못 이으면 null — 그때는 GRP-001 과 똑같이
 * "근거를 잇지 못했다"로 간다. 근거 없는 확정을 내지 않는다는 원칙은
 * 문서 RAG 쪽도 같다.
 */
export function matchDocAnswer(agentId: string, input: string): DocAnswer | null {
  const bank = DOC_ANSWERS[agentId] ?? [];
  const q = input.replace(/\s/g, '');
  const exact = bank.find((d) => d.q.replace(/\s/g, '') === q);
  if (exact) return exact;
  /* 키워드는 좁게 — 넓게 잡으면 엉뚱한 문서 답변이 확정처럼 나간다. */
  const KEYS: Record<string, string[]> = {
    'ISA 만기 후 운용 방안 상담 초안을 정리해줘.': ['ISA', '아이에스에이'],
    '보유 자산 위험도·분산도 진단 결과를 어떻게 읽나요?': ['위험도', '분산도', '진단결과'],
    'IRP 계좌를 타행에서 이전하는 절차를 알려줘.': ['IRP', '퇴직연금이전'],
    '연차 이월은 며칠까지 가능한가요?': ['연차', '이월'],
    '품의서 서식 최신본이 어디 있나요?': ['품의서', '서식'],
    '재택근무 신청 절차를 정리해줘.': ['재택', '유연근무'],
  };
  for (const d of bank) {
    if ((KEYS[d.q] ?? []).some((k) => q.includes(k))) return d;
  }
  return null;
}

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
