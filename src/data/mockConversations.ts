/**
 * 서빙계 운영 대화 이력 mock.
 *
 * 노출되는 필드(요건):
 *  · 사용자 마스킹 ID + 부서
 *  · 에이전트 + 버전 (환경은 서빙계 고정)
 *  · 사용자 피드백 (👍/👎/미평가 + 코멘트)
 *  · 대화 이력 + 토큰
 *  · 사용자 메시지 — PII 마스킹 표시
 *  · Langfuse 트레이스 ID
 *
 * 마스킹 표기 규칙:
 *  본문 안의 [고객명] / [계좌번호] / [주민번호] / [금액] / [전화번호] / [주소]
 *  토큰은 렌더링 시 PiiMaskChip 으로 시각화한다.
 */

export type FeedbackKind = 'up' | 'down' | 'none';

export interface ConversationTurn {
  role: 'user' | 'agent';
  /** 본문 — 사용자 발화는 마스킹된 상태로 저장. */
  text: string;
  /** 시각 (HH:mm:ss). */
  time: string;
  /** 입력 토큰(user) 또는 출력 토큰(agent). */
  tokens?: number;
  /** agent 응답 지연(ms). user turn에는 없음. */
  latencyMs?: number;
}

export interface ConversationSession {
  id: string;
  /** 사용자 마스킹 ID (예: usr_8f3a). */
  userMaskedId: string;
  /** 사용자 소속 부서. */
  userDept: string;
  /** 에이전트 식별자. */
  agentId: string;
  /** 에이전트 표시명. */
  agentName: string;
  /** 에이전트 버전. */
  agentVersion: string;
  /** 시작 시각 (YYYY-MM-DD HH:mm:ss). */
  startedAt: string;
  /** 지속 시간(초). */
  durationSec: number;
  /** Turn 배열 — 사용자/에이전트 번갈아. */
  turns: ConversationTurn[];
  feedback: FeedbackKind;
  /** 사용자 피드백 코멘트(선택). */
  feedbackComment?: string;
  /** Langfuse trace ID (mock). */
  langfuseTraceId: string;
}

/** Aggregate 헬퍼 — 세션 총 입력/출력 토큰. */
export function getSessionTokens(s: ConversationSession): {
  input: number;
  output: number;
  total: number;
} {
  let input = 0;
  let output = 0;
  for (const t of s.turns) {
    if (!t.tokens) continue;
    if (t.role === 'user') input += t.tokens;
    else output += t.tokens;
  }
  return { input, output, total: input + output };
}

/** 첫 사용자 발화 — 카드 미리보기용. */
export function getFirstUserText(s: ConversationSession): string {
  const t = s.turns.find((x) => x.role === 'user');
  return t?.text ?? '';
}

/* ─────────────────────────────────────────────────────────────
 * 시드 데이터 — PB 자산진단 어시스턴트 (AGT-204)
 * ───────────────────────────────────────────────────────────── */

export const MOCK_CONVERSATIONS: ConversationSession[] = [
  {
    id: 'cnv-9d12a7',
    userMaskedId: 'usr_8f3a',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-24 14:23:08',
    durationSec: 252,
    feedback: 'up',
    feedbackComment: '리포트 근거가 명확해서 그대로 고객 미팅에 활용했습니다.',
    langfuseTraceId: 'lf_trace_9d12a7e0b3',
    turns: [
      {
        role: 'user',
        time: '14:23:08',
        text: '분기 리포트에서 [고객명] 고객의 자산 분산도가 0.42인데, 이게 위험 수준인가요?',
        tokens: 132,
      },
      {
        role: 'agent',
        time: '14:23:11',
        text: '자산 분산도 0.42는 그룹 PB 가이드 기준 "중간 분산"에 해당합니다. 일반적으로 0.5 이상을 권장 수준으로 봅니다. 다만 위험 수준 여부는 분산도 단독으로 판단하지 않고, 변동성·유동성 점수와 함께 봐야 합니다. 현재 보유 자산 구성을 알려주시면 종합 진단을 드릴 수 있습니다.',
        tokens: 287,
        latencyMs: 2410,
      },
      {
        role: 'user',
        time: '14:24:01',
        text: '[계좌번호] 계좌 기준으로 채권 38% / 주식 47% / 현금 15% 구성입니다. 변동성은 0.31이에요.',
        tokens: 96,
      },
      {
        role: 'agent',
        time: '14:24:05',
        text: '진단 결과: 분산도 0.42 (중간) · 변동성 0.31 (안정) · 유동성 점수 추정 0.58 (양호). 종합적으로 안정 지향형에 가까우나, 주식 비중이 47%로 평균보다 다소 높습니다. 만약 [고객명] 고객의 위험 성향이 "안정 추구"라면 주식 비중을 40% 이하로 조정하는 것을 검토해볼 수 있습니다. 위험 성향 등급을 확인해드릴까요?',
        tokens: 354,
        latencyMs: 3120,
      },
      {
        role: 'user',
        time: '14:25:14',
        text: '위험 성향은 "적극 투자형"입니다. 그러면 현재 구성이 적합한가요?',
        tokens: 71,
      },
      {
        role: 'agent',
        time: '14:25:17',
        text: '적극 투자형 기준에서는 주식 47%가 오히려 보수적인 편입니다. 채권 비중을 25~30%로 축소하고 주식·대체투자 비중을 60~65%까지 확대하는 것이 성향과 부합합니다. 단, 시장 변동성이 큰 시기에는 단계적 리밸런싱을 권장드립니다.',
        tokens: 244,
        latencyMs: 2680,
      },
    ],
  },
  {
    id: 'cnv-4a8e21',
    userMaskedId: 'usr_4a91',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-24 13:51:42',
    durationSec: 124,
    feedback: 'down',
    feedbackComment: '같은 답변만 반복함. 구체 수치 요청에 대응 못 함.',
    langfuseTraceId: 'lf_trace_4a8e2104f6',
    turns: [
      {
        role: 'user',
        time: '13:51:42',
        text: '[고객명] 고객 자산 [금액] 중 채권 ETF 비중을 늘리고 싶은데, 어떤 종목이 좋을까요?',
        tokens: 88,
      },
      {
        role: 'agent',
        time: '13:51:45',
        text: '죄송합니다. 저는 개별 종목 추천은 제공하지 않습니다. 자산 진단·리밸런싱 가이드는 도와드릴 수 있습니다.',
        tokens: 112,
        latencyMs: 1880,
      },
      {
        role: 'user',
        time: '13:52:30',
        text: '추천 말고요, 그룹 자체 채권 ETF 라인업이 어떤 게 있는지만 알려주세요.',
        tokens: 64,
      },
      {
        role: 'agent',
        time: '13:52:32',
        text: '죄송합니다. 저는 개별 종목·상품 정보는 제공하지 않습니다.',
        tokens: 78,
        latencyMs: 1640,
      },
      {
        role: 'user',
        time: '13:53:25',
        text: '그럼 채권 비중 늘릴 때 일반적으로 고려할 점은 뭔가요?',
        tokens: 56,
      },
      {
        role: 'agent',
        time: '13:53:27',
        text: '채권 비중 확대 시 고려 사항: ① 듀레이션 — 금리 사이클 단계에 따라 단기/중장기 비중 조정 ② 신용등급 — 안정형은 AA 이상 권장 ③ 통화 노출 — 환위험 헤지 여부 ④ 유동성 — 환매 제약 확인. 종합 리밸런싱 시나리오를 생성해드릴까요?',
        tokens: 268,
        latencyMs: 2540,
      },
    ],
  },
  {
    id: 'cnv-71b3c0',
    userMaskedId: 'usr_71b3',
    userDept: '자산관리부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-24 11:08:15',
    durationSec: 198,
    feedback: 'up',
    langfuseTraceId: 'lf_trace_71b3c0a922',
    turns: [
      {
        role: 'user',
        time: '11:08:15',
        text: '[고객명] 고객이 [주소] 부동산 처분 예정인데, [금액] 자금 운용 계획을 세우고 싶습니다.',
        tokens: 102,
      },
      {
        role: 'agent',
        time: '11:08:18',
        text: '대규모 일시 자금 운용은 시점 분산 + 자산군 분산 두 축이 핵심입니다. ① 시점 분산 — 3~6개월에 걸쳐 단계적 진입 권장 (lump-sum 리스크 회피) ② 자산군 분산 — 위험 성향에 따라 30/50/20 (채권/주식/대체) 또는 50/30/20 구성 검토. [고객명] 고객의 위험 성향과 자금 사용 시점(단기/중장기)을 알려주시면 상세 시나리오를 만들어드립니다.',
        tokens: 412,
        latencyMs: 3210,
      },
      {
        role: 'user',
        time: '11:09:40',
        text: '위험 성향 "위험중립형", 5년 이상 운용 계획입니다.',
        tokens: 48,
      },
      {
        role: 'agent',
        time: '11:09:43',
        text: '위험중립형 + 5년 운용 기준 시나리오: ① 1단계(0~3개월) — 채권 60% / 머니마켓 40% 진입 ② 2단계(3~6개월) — 주식 비중 25%까지 점진 확대, 채권 비중 50%로 조정 ③ 3단계(6개월 이후) — 채권 45% / 주식 35% / 대체 15% / 현금 5% 안착. 시뮬레이션 기준 예상 변동성 0.28, 5년 누적 수익률 중앙값 24~32% 범위.',
        tokens: 388,
        latencyMs: 3450,
      },
      {
        role: 'user',
        time: '11:10:55',
        text: '이대로 [고객명] 고객에게 제안서 만들어주세요.',
        tokens: 38,
      },
      {
        role: 'agent',
        time: '11:10:58',
        text: '제안서는 별도 시스템에서 작성하셔야 하지만, 핵심 근거는 다음과 같이 정리해드립니다: (요약 본문 생성)…',
        tokens: 312,
        latencyMs: 2820,
      },
    ],
  },
  {
    id: 'cnv-2e44b8',
    userMaskedId: 'usr_2e44',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.1',
    startedAt: '2026-05-24 09:42:03',
    durationSec: 76,
    feedback: 'none',
    langfuseTraceId: 'lf_trace_2e44b801de',
    turns: [
      {
        role: 'user',
        time: '09:42:03',
        text: '[고객명] 고객 자산 진단 한번 돌려주세요. [계좌번호] 기준.',
        tokens: 54,
      },
      {
        role: 'agent',
        time: '09:42:05',
        text: '계좌 [계좌번호] 진단 결과 — 분산도 0.61 (양호) · 변동성 0.22 (안정) · 유동성 0.71 (양호). 종합 점수 78점 / 100점. 안정 지향형 포트폴리오로 잘 구성되어 있습니다. 개선 포인트: 해외 자산 비중이 8%로 낮아, 분산 효과를 강화하려면 15~20%까지 확대 검토 권장.',
        tokens: 296,
        latencyMs: 2480,
      },
    ],
  },
  {
    id: 'cnv-c918fa',
    userMaskedId: 'usr_c918',
    userDept: '디지털금융본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-24 16:11:28',
    durationSec: 312,
    feedback: 'up',
    feedbackComment: '다른 시나리오도 비교해서 보여줘서 좋았어요.',
    langfuseTraceId: 'lf_trace_c918fa6e4d',
    turns: [
      {
        role: 'user',
        time: '16:11:28',
        text: '[고객명] 고객 ISA 만기 도래해서 [금액] 재투자 검토 중입니다. ISA 연장 vs 일반 계좌 분산, 어느 쪽이 유리한가요?',
        tokens: 116,
      },
      {
        role: 'agent',
        time: '16:11:32',
        text: 'ISA 연장 vs 일반 계좌 분산 비교: ① 세제 혜택 — ISA 연장 시 비과세 한도(만기 후 추가 200만원) 유지. 일반 계좌는 배당/이자 15.4% 과세. ② 자산군 자유도 — 일반 계좌는 해외 직투자/대체투자 등 폭넓음. ③ 환매 유연성 — ISA는 의무 보유 기간 있음. 종합적으로 단기 환매 가능성이 낮고 세제 혜택 우선이면 ISA 연장 유리.',
        tokens: 384,
        latencyMs: 3640,
      },
      {
        role: 'user',
        time: '16:13:02',
        text: '연 수익률 시뮬레이션도 비교 가능한가요?',
        tokens: 42,
      },
      {
        role: 'agent',
        time: '16:13:06',
        text: '동일 포트폴리오(채권 50/주식 40/대체 10) 기준 5년 시뮬레이션: ISA 연장 — 세후 누적 수익률 중앙값 21.4% / 일반 계좌 — 세후 누적 수익률 중앙값 18.1%. 차이의 핵심은 배당·분배금 비과세 효과. 단, 시장 시나리오에 따라 변동 범위 ±8%p.',
        tokens: 322,
        latencyMs: 3210,
      },
      {
        role: 'user',
        time: '16:14:48',
        text: '리스크 있는 케이스도 보여줄 수 있나요?',
        tokens: 38,
      },
      {
        role: 'agent',
        time: '16:14:52',
        text: '하방 시나리오(하위 10% 분위): ISA 연장 — 세후 누적 수익률 -4.2% / 일반 계좌 — 세후 누적 수익률 -6.8%. 손실 구간에서도 ISA가 세금 손익 통산 효과로 상대적으로 유리.',
        tokens: 218,
        latencyMs: 2740,
      },
    ],
  },
  {
    id: 'cnv-58d201',
    userMaskedId: 'usr_58d2',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-23 17:33:11',
    durationSec: 88,
    feedback: 'down',
    feedbackComment: 'JSON 응답이 잘리는 현상 — 표 데이터 깨짐.',
    langfuseTraceId: 'lf_trace_58d20188ab',
    turns: [
      {
        role: 'user',
        time: '17:33:11',
        text: '[고객명] 고객 포트폴리오 JSON 형식으로 출력해주세요. 분산도·변동성·유동성·총점 4개 필드만.',
        tokens: 78,
      },
      {
        role: 'agent',
        time: '17:33:14',
        text: '```json\n{"분산도": 0.54, "변동성": 0.29, "유동성": 0.62, "총점": 73, "권장": "현재 구성은 안정 지향',
        tokens: 142,
        latencyMs: 2210,
      },
      {
        role: 'user',
        time: '17:34:01',
        text: 'JSON이 잘렸어요. 다시 출력해주세요.',
        tokens: 28,
      },
      {
        role: 'agent',
        time: '17:34:04',
        text: '```json\n{"분산도": 0.54, "변동성": 0.29, "유동성": 0.62, "총점": 73}\n```',
        tokens: 86,
        latencyMs: 1980,
      },
    ],
  },
  {
    id: 'cnv-13bf95',
    userMaskedId: 'usr_13bf',
    userDept: '자산관리부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-23 15:08:50',
    durationSec: 156,
    feedback: 'up',
    langfuseTraceId: 'lf_trace_13bf95c021',
    turns: [
      {
        role: 'user',
        time: '15:08:50',
        text: '[고객명] 고객 [주민번호] · 자녀 [고객명] 명의 증여 계획 중입니다. 자산 진단상 분산에 영향을 얼마나 줄까요?',
        tokens: 124,
      },
      {
        role: 'agent',
        time: '15:08:54',
        text: '증여 규모와 자산 종류를 알려주시면 정량적으로 답변 가능합니다. 일반적으로 동일 자산군에서 증여가 이루어지면 분산도에는 영향이 없고, 다른 자산군(예: 부동산 → 현금)으로 전환되며 증여될 경우에만 분산도가 변화합니다.',
        tokens: 232,
        latencyMs: 2880,
      },
      {
        role: 'user',
        time: '15:10:12',
        text: '주식 [금액] 증여, 현금화 없이 그대로 명의 이전입니다.',
        tokens: 52,
      },
      {
        role: 'agent',
        time: '15:10:15',
        text: '동일 자산군 내 명의 이전이므로 [고객명] 고객의 자산 분산도 자체에는 변화 없습니다. 다만 총 자산 규모가 줄어 절대 분산 효과(자산 크기 기반 변동성 흡수력)는 감소합니다. 진단 점수 시뮬레이션: 현재 78점 → 증여 후 75점. 증여 후 잔여 자산 기준으로 재진단 권장.',
        tokens: 286,
        latencyMs: 2920,
      },
    ],
  },
  {
    id: 'cnv-8a02ee',
    userMaskedId: 'usr_8a02',
    userDept: '디지털금융본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.1',
    startedAt: '2026-05-23 10:22:04',
    durationSec: 64,
    feedback: 'none',
    langfuseTraceId: 'lf_trace_8a02ee31bc',
    turns: [
      {
        role: 'user',
        time: '10:22:04',
        text: '자산 분산도 계산 공식이 어떻게 되나요?',
        tokens: 42,
      },
      {
        role: 'agent',
        time: '10:22:06',
        text: '그룹 PB 가이드의 자산 분산도(Herfindahl 변형)는 1 - Σ(자산군 비중)²로 계산됩니다. 값이 0에 가까울수록 집중도가 높고, 1에 가까울수록 분산이 잘 되어 있다는 의미입니다. 자산군은 채권·주식·대체투자·현금·부동산 5개로 분류합니다.',
        tokens: 256,
        latencyMs: 2120,
      },
    ],
  },
  {
    id: 'cnv-d0e7c4',
    userMaskedId: 'usr_d0e7',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-23 14:48:36',
    durationSec: 142,
    feedback: 'up',
    langfuseTraceId: 'lf_trace_d0e7c44f08',
    turns: [
      {
        role: 'user',
        time: '14:48:36',
        text: '[고객명] 고객 변동성 점수가 0.45로 높게 나왔는데 원인 분석 가능한가요?',
        tokens: 68,
      },
      {
        role: 'agent',
        time: '14:48:39',
        text: '변동성 0.45는 평균 대비 다소 높은 편입니다. 주요 원인 후보: ① 주식 비중 과다 (60% 이상) ② 단일 섹터·국가 집중 ③ 환노출 자산 비중 ④ 고변동 채권(하이일드 등) 포함. 보유 자산 구성을 알려주시면 정확한 원인 분석 가능합니다.',
        tokens: 268,
        latencyMs: 2580,
      },
      {
        role: 'user',
        time: '14:49:55',
        text: '주식 58%인데 그중 미국 단일 섹터(테크) 비중이 40%입니다.',
        tokens: 62,
      },
      {
        role: 'agent',
        time: '14:49:58',
        text: '원인 확인: 변동성 0.45의 주된 기여는 미국 테크 섹터 단일 집중(주식 내 40% = 전체의 23.2%)입니다. 동 섹터 내 변동성이 시장 평균의 1.6배 수준. 완화 방안: ① 테크 비중을 주식 내 25% 이하로 축소 ② 방어 섹터(헬스케어·필수소비재)로 분산 ③ 미국 외 지역 비중 확대. 시뮬레이션 결과 변동성을 0.45 → 0.31까지 낮출 수 있습니다.',
        tokens: 412,
        latencyMs: 3380,
      },
    ],
  },
  {
    id: 'cnv-6f9a30',
    userMaskedId: 'usr_6f9a',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-22 16:55:19',
    durationSec: 92,
    feedback: 'none',
    langfuseTraceId: 'lf_trace_6f9a30b117',
    turns: [
      {
        role: 'user',
        time: '16:55:19',
        text: '[고객명] 고객 유동성 점수만 빠르게 확인 부탁드립니다. [계좌번호] 기준.',
        tokens: 56,
      },
      {
        role: 'agent',
        time: '16:55:21',
        text: '계좌 [계좌번호] 유동성 점수 — 0.68 (양호). 30일 내 환매 가능 자산 비중 72%, 부동산·장기 펀드 등 환매 제약 자산 비중 28%.',
        tokens: 168,
        latencyMs: 1840,
      },
    ],
  },
  {
    id: 'cnv-44e1bc',
    userMaskedId: 'usr_44e1',
    userDept: '자산관리부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.2',
    startedAt: '2026-05-22 11:14:02',
    durationSec: 184,
    feedback: 'up',
    feedbackComment: '근거 출처 표기가 명확해서 신뢰감 있음.',
    langfuseTraceId: 'lf_trace_44e1bc9020',
    turns: [
      {
        role: 'user',
        time: '11:14:02',
        text: '[고객명] 고객이 [전화번호]으로 문의하셨는데, 자산 진단 보고서를 모바일로 발송 가능한가요?',
        tokens: 84,
      },
      {
        role: 'agent',
        time: '11:14:05',
        text: '자산 진단 보고서 모바일 발송은 별도 시스템(PB 디지털 채널)에서 처리합니다. 저는 보고서 본문 초안 작성과 진단 데이터 생성을 도와드릴 수 있습니다. 진단 데이터 기준 보고서 초안을 만들어드릴까요?',
        tokens: 214,
        latencyMs: 2480,
      },
      {
        role: 'user',
        time: '11:15:32',
        text: '네, 초안 부탁드립니다. [고객명] 고객 자산 진단 결과 기준으로요.',
        tokens: 58,
      },
      {
        role: 'agent',
        time: '11:15:36',
        text: '[고객명] 고객 자산 진단 보고서 초안: ① 진단 개요 — 분산도 0.54 / 변동성 0.29 / 유동성 0.62 / 종합 73점 ② 강점 — 안정 지향 구성, 채권 비중 적정 ③ 보완점 — 해외 자산 비중 8%로 낮음, 단일 섹터 집중도 점검 필요 ④ 권장 — 단계적 해외 분산 확대(목표 18%), 정기 리밸런싱. 근거 출처: 그룹 PB 자산진단 가이드 v3.2, 시장지표 2026-05-22 기준.',
        tokens: 422,
        latencyMs: 3640,
      },
    ],
  },
  {
    id: 'cnv-92f70a',
    userMaskedId: 'usr_92f7',
    userDept: 'PB영업본부',
    agentId: 'AGT-204',
    agentName: 'PB 자산진단 어시스턴트',
    agentVersion: 'v0.4.0',
    startedAt: '2026-05-22 09:31:48',
    durationSec: 58,
    feedback: 'down',
    feedbackComment: '오래된 버전 응답인 듯 — 가이드 v2.x 기준으로 답변함.',
    langfuseTraceId: 'lf_trace_92f70a1133',
    turns: [
      {
        role: 'user',
        time: '09:31:48',
        text: '자산 분산도 권장 기준이 0.5인가요 0.6인가요?',
        tokens: 38,
      },
      {
        role: 'agent',
        time: '09:31:50',
        text: '그룹 PB 가이드 기준 자산 분산도 권장은 0.6 이상입니다.',
        tokens: 62,
        latencyMs: 1620,
      },
      {
        role: 'user',
        time: '09:32:31',
        text: '최근 가이드는 0.5로 바뀌었다고 들었는데요?',
        tokens: 34,
      },
      {
        role: 'agent',
        time: '09:32:33',
        text: '제 학습 자료에는 0.6 기준으로만 명시되어 있어 추가 확인이 필요합니다.',
        tokens: 64,
        latencyMs: 1480,
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
 * Aggregate 헬퍼 — 탭 상단 KPI용
 * ───────────────────────────────────────────────────────────── */

export function getConversationKpis(sessions: ConversationSession[]) {
  const total = sessions.length;
  const totalTurns = sessions.reduce((a, s) => a + s.turns.length, 0);
  const avgTurns = total === 0 ? 0 : totalTurns / total;
  const up = sessions.filter((s) => s.feedback === 'up').length;
  const down = sessions.filter((s) => s.feedback === 'down').length;
  const rated = up + down;
  const upRate = rated === 0 ? 0 : (up / rated) * 100;
  const unrated = sessions.filter((s) => s.feedback === 'none').length;
  const unratedPct = total === 0 ? 0 : (unrated / total) * 100;
  const totalTokens = sessions.reduce((a, s) => a + getSessionTokens(s).total, 0);
  const avgTokens = total === 0 ? 0 : totalTokens / total;
  return { total, avgTurns, upRate, unratedPct, avgTokens, up, down, unrated };
}

/** 사용 가능한 필터 옵션을 데이터에서 추출. */
export function getConversationFilterOptions(sessions: ConversationSession[]) {
  const agents = Array.from(
    new Set(sessions.map((s) => `${s.agentId}:::${s.agentName}`)),
  ).map((k) => {
    const [id, name] = k.split(':::');
    return { id, name };
  });
  const versions = Array.from(new Set(sessions.map((s) => s.agentVersion))).sort().reverse();
  const depts = Array.from(new Set(sessions.map((s) => s.userDept))).sort();
  return { agents, versions, depts };
}
