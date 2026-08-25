/**
 * Query 시연 시나리오 — 온톨로지 그래프 리트리벌 재생 스크립트.
 *
 * 데모의 클라이맥스(핸드오프 화면 4). 백엔드가 없으므로 추론 과정을
 * 스크립트로 재생하되, **구조는 실제 온톨로지 추론과 동일하게** 짠다.
 *
 * 핵심 메시지 — "LLM은 질의문만 작성하고, 값·판정은 그래프에서 실행한
 * 확정 결과다". 그래서 각 스텝은 (질의문 / 실행 종류 / 확정 근거) 3요소를
 * 갖고, 마지막 답변은 **확정 부분과 추정 부분을 배지로 갈라** 표시한다.
 *
 * ⚠️ 전부 가상 데이터다. 실제 BNK 여신 데이터·내규가 아니다.
 */

/** 스텝 종류 — 좌측 그래프 연출과 우측 배지를 함께 가른다. */
export type StepKind =
  | 'plan' // 계획 수립 (LLM)
  | 'anchor' // 결정론 앵커링 (그래프)
  | 'traverse' // 관계 순회 (그래프)
  | 'sql' // 정형DB 투사/조인
  | 'doc' // 비정형 문서 조항 조회
  | 'compute'; // 규칙 계산

export interface QueryStep {
  kind: StepKind;
  /** 스텝 서술 (LLM 톤). */
  text: string;
  /** 실행한 질의문 (있으면 코드블록으로 표시). */
  query?: string;
  /** 실행 결과 요약 배지. */
  resultBadge?: string;
  /** 확정 근거 한 줄 — 왜 이게 확정인지. */
  basis?: string;
  /** 이 스텝에서 그래프에 점등할 클래스 (좌측 순회 연출). */
  lightClasses?: string[];
  /** 이 스텝에서 점등할 관계 URI. */
  lightRelations?: string[];
}

export interface AnswerFact {
  label: string;
  value: string;
  /** 정형DB에서 확정된 값인지. */
  confirmed: boolean;
}

export interface QueryScenario {
  id: string;
  /** 드롭다운·칩에 뜨는 질문. */
  question: string;
  /** 질문 성격 라벨. */
  tag: string;
  steps: QueryStep[];
  /** 그래프에서 확정된 사실 목록. */
  facts: AnswerFact[];
  /** 판정 한 줄. */
  verdict: string;
  /** 규정 근거. */
  ruleBasis: { clause: string; body: string }[];
  /** 결론 항목. */
  conclusion: string[];
  /** 확정되지 않은 부분 — 솔직하게 남긴다. */
  caveat: string;
}

/* ══════════════════════════ 시나리오 ══════════════════════════ */

const S1: QueryScenario = {
  id: 'Q1',
  tag: '여신 + 전결',
  question: '대성정밀 5억 신규 여신 신청 건, 승인 가능한가요? 전결은 누가 하죠?',
  steps: [
    {
      kind: 'plan',
      text:
        '먼저 대성정밀의 신용등급과 기존 여신·담보 현황을 정형DB에서 확정하고, ' +
        '그 다음 여신업무규정에서 해당 등급·금액 구간의 취급 가능 여부와 조건을 확인합니다. ' +
        '마지막으로 전결규정에서 신청금액 5억이 어느 전결 구간에 속하는지 판정합니다.',
      lightClasses: [],
    },
    {
      kind: 'anchor',
      text: "질문의 개체 '대성정밀'을 그래프에서 특정하고 관계·담보 명세까지 펼쳤어요(결정론 앵커링).",
      basis: '질문 개체를 그래프 라벨로 직접 특정한 뒤 관계를 타고 확장(결정론)',
      lightClasses: ['고객'],
    },
    {
      kind: 'sql',
      text:
        '대성정밀에 연결된 신용등급과 여신신청 개체를 조회합니다. ' +
        '등급이 규정 적용 구간을 가르므로 먼저 확정해야 합니다.',
      query: 'search(대성정밀의 신용등급, 여신신청 금액과 자금용도)',
      resultBadge: 'SQL 투사/조인 · 1건',
      basis: '집계·조인은 소스 DB에 SQL로 투사 (트리플스토어 아님)',
      lightClasses: ['고객', '신용등급', '여신신청'],
      lightRelations: ['bnk:PyeongGa_GoGaek_SinYongDeungGeup', 'bnk:SinCheong_GoGaek_YeoSinSinCheong'],
    },
    {
      kind: 'traverse',
      text:
        '기존 여신약정과 제공 담보를 순회해 한도 잔액과 담보 여력을 확정합니다. ' +
        '담보인정비율을 곱한 유효담보가액이 승인 판정의 입력값입니다.',
      query: 'search(대성정밀 여신약정의 한도잔액, 제공 담보의 감정가액·담보인정비율)',
      resultBadge: 'SQL 투사/조인 · 3건',
      basis: '그래프에서 이 SPARQL을 실행한 결과',
      lightClasses: ['고객', '여신약정', '담보', '부동산담보'],
      lightRelations: ['bnk:BoYu_GoGaek_YeoSinYakJeong', 'bnk:JeGong_YeoSinYakJeong_DamBo'],
    },
    {
      kind: 'compute',
      text:
        '유효담보가액 = 감정가액 × 담보인정비율 − 선순위금액 으로 계산합니다. ' +
        '8.4억 × 0.55 − 1.2억 = 3.42억. 신청금액 5억 대비 부족분 1.58억이 신용공여 구간입니다.',
      resultBadge: '규칙 계산 · 확정',
      basis: '값은 DB, 계산은 규정 산식 — LLM 추론 아님',
      lightClasses: ['담보', '부동산담보'],
    },
    {
      kind: 'doc',
      text:
        '여신업무규정에서 BBB등급·신용공여 구간의 취급 조건 조항을 조회합니다. ' +
        '심사 개체가 조항을 근거로 참조하고 있어 그래프를 타고 직접 도달합니다.',
      query: 'search(여신업무규정 중 BBB등급 신용공여 취급조건 조항)',
      resultBadge: '문서 조항 · 2건',
      basis: '문서에서 실체화된 조항 개체 — 원문 링크 보유',
      lightClasses: ['심사', '조항', '규정'],
      lightRelations: ['bnk:GeunGeo_SimSa_JoHang', 'bnk:PoHam_GyuJeong_JoHang'],
    },
    {
      kind: 'traverse',
      text:
        '마지막으로 신청금액 5억이 걸리는 전결 구간을 판정하고, 그 전결권이 귀속된 직책과 소속 조직까지 펼칩니다.',
      query: 'search(여신 5억 신용공여 건의 전결권 → 직책 → 조직)',
      resultBadge: '그래프 순회 · 3 hop',
      basis: '전결규정 별표1에서 실체화된 금액 구간을 그래프로 매칭',
      lightClasses: ['여신신청', '전결권', '직책', '조직'],
      lightRelations: [
        'bnk:JeokYong_YeoSinSinCheong_JeonGyeolGwon',
        'bnk:GwiSok_JeonGyeolGwon_JikChaek',
        'bnk:SoSok_JikChaek_JoJik',
      ],
    },
  ],
  facts: [
    { label: '고객', value: '대성정밀(주) · 사업자 214-81-****', confirmed: true },
    { label: '신용등급', value: 'BBB (2026-03-18 평가)', confirmed: true },
    { label: '기존 약정 / 한도잔액', value: '12.0억 / 2.6억', confirmed: true },
    { label: '담보 감정가액', value: '8.4억 (부동산 · 담보인정비율 55%)', confirmed: true },
    { label: '유효담보가액', value: '3.42억 (선순위 1.2억 차감)', confirmed: true },
    { label: '신청금액', value: '5.0억 (운전자금 · 만기일시)', confirmed: true },
  ],
  verdict: '담보부 3.42억 + 신용공여 1.58억 구성으로 취급 가능. 전결권자는 여신본부장.',
  ruleBasis: [
    {
      clause: '여신업무규정 제12조 (신용공여 한도)',
      body:
        'BBB등급 법인의 신용공여는 유효담보가액 부족분에 한하여 2억원 이내로 취급할 수 있다. ' +
        '단, 최근 3년 연속 영업흑자 요건을 충족하여야 한다.',
    },
    {
      clause: '전결규정 제5조 별표1 (여신 전결 구분)',
      body:
        '동일인 여신 총액 10억원 초과 20억원 이하이며 신용공여를 포함하는 건은 여신본부장 전결. ' +
        '10억원 이하는 지점장 전결.',
    },
  ],
  conclusion: [
    '승인 가능 여부: 조건부 가능 — 신용공여 1.58억이 제12조 한도(2억) 이내',
    '전결권자: 여신본부장 (기존 12억 + 신규 5억 = 17억, 신용공여 포함 구간)',
    '선행 확인: 최근 3년 연속 영업흑자 요건 (제12조 단서)',
  ],
  caveat:
    '영업흑자 요건 충족 여부는 재무제표 개체가 아직 실체화되지 않아 이 그래프만으로는 확정되지 않습니다. ' +
    '재무 데이터 매핑 후 재조회하면 확정 판정이 가능합니다.',
};

const S2: QueryScenario = {
  id: 'Q2',
  tag: '전결권',
  question: '여신 8억이면 지점장 전결인가요, 본부장 전결인가요?',
  steps: [
    {
      kind: 'plan',
      text: '전결규정 별표1의 금액 구간을 조회하고, 신용공여 포함 여부에 따른 분기를 확인합니다.',
    },
    {
      kind: 'anchor',
      text: "'전결권' 클래스를 앵커로 잡고 금액 구간 속성을 펼쳤어요(결정론 앵커링).",
      basis: '질문의 금액 조건을 전결권 개체의 금액하한·금액상한 속성으로 직접 매칭',
      lightClasses: ['전결권'],
    },
    {
      kind: 'doc',
      text: '전결규정 별표1에서 8억이 속하는 구간을 판정합니다.',
      query: 'search(전결권 중 금액하한 ≤ 8억 ≤ 금액상한 인 구간)',
      resultBadge: '문서 조항 · 1건',
      basis: '표 인식으로 실체화된 금액 구간 — 규칙 매칭(계산)',
      lightClasses: ['전결권', '조항', '규정'],
      lightRelations: ['bnk:GyuJeong_JoHang_JeonGyeolGwon', 'bnk:PoHam_GyuJeong_JoHang'],
    },
    {
      kind: 'traverse',
      text: '해당 전결권이 귀속된 직책과 조직을 순회합니다.',
      query: 'search(전결권 → 직책 → 조직)',
      resultBadge: '그래프 순회 · 2 hop',
      basis: '그래프에서 이 SPARQL을 실행한 결과',
      lightClasses: ['전결권', '직책', '조직'],
      lightRelations: ['bnk:GwiSok_JeonGyeolGwon_JikChaek', 'bnk:SoSok_JikChaek_JoJik'],
    },
  ],
  facts: [
    { label: '해당 구간', value: '5억 초과 ~ 10억 이하', confirmed: true },
    { label: '전결권자', value: '지점장 (담보부 한정)', confirmed: true },
    { label: '분기 조건', value: '신용공여 포함 시 → 여신본부장', confirmed: true },
  ],
  verdict: '담보부 8억이면 지점장 전결. 신용공여가 섞이면 본부장 전결로 상향됩니다.',
  ruleBasis: [
    {
      clause: '전결규정 제5조 별표1 (여신 전결 구분)',
      body:
        '동일인 여신 총액 5억원 초과 10억원 이하 담보부 여신은 지점장 전결. ' +
        '신용공여를 포함하는 경우 금액과 무관하게 한 단계 상위 직책이 전결한다.',
    },
  ],
  conclusion: [
    '담보부 8억: 지점장 전결',
    '신용공여 포함 8억: 여신본부장 전결 (한 단계 상향)',
  ],
  caveat:
    '동일인 합산 기준(기존 여신 포함 여부)은 질문에 명시되지 않았습니다. ' +
    '합산 시 구간이 달라질 수 있어 실제 신청 건에서는 고객 개체를 함께 앵커링해야 합니다.',
};

const S3: QueryScenario = {
  id: 'Q3',
  tag: '책무구조',
  question: '여신 심사 부실이 나면 책무는 누구한테 있나요?',
  steps: [
    {
      kind: 'plan',
      text: '책무구조도에서 여신 심사 관련 책무를 찾고, 배분된 직책과 근거 조항을 확인합니다.',
    },
    {
      kind: 'anchor',
      text: "'책무' 클래스에서 여신 심사 관련 책무 개체를 특정했어요(결정론 앵커링).",
      basis: '책무구조도에서 실체화된 책무 개체를 라벨로 직접 특정',
      lightClasses: ['책무'],
    },
    {
      kind: 'traverse',
      text: '책무가 배분된 직책과 그 근거 조항을 동시에 순회합니다.',
      query: 'search(여신심사 책무 → 배분 직책, 근거 조항)',
      resultBadge: '그래프 순회 · 2 hop',
      basis: '그래프에서 이 SPARQL을 실행한 결과',
      lightClasses: ['책무', '직책', '조항', '조직'],
      lightRelations: ['bnk:BaeBun_ChaekMu_JikChaek', 'bnk:GeunGeo_ChaekMu_JoHang', 'bnk:SoSok_JikChaek_JoJik'],
    },
  ],
  facts: [
    { label: '책무번호', value: 'CM-여신-004', confirmed: true },
    { label: '책무내용', value: '여신 심사 기준 수립 및 운영 관리', confirmed: true },
    { label: '배분 직책', value: '여신본부장 (1차) · 여신심사부장 (2차)', confirmed: true },
    { label: '배분일자', value: '2025-07-01', confirmed: true },
  ],
  verdict: '여신 심사 기준 운영 책무는 여신본부장에게 1차 배분되어 있습니다.',
  ruleBasis: [
    {
      clause: '여신업무규정 제3조 (심사 기준의 수립)',
      body: '여신 심사 기준의 수립·개정 및 그 운영에 관한 관리 의무는 여신본부장이 진다.',
    },
  ],
  conclusion: [
    '1차 책무: 여신본부장 — 심사 기준 수립·운영 관리',
    '2차 책무: 여신심사부장 — 개별 심사 건의 기준 적용',
    '근거: 여신업무규정 제3조 · 책무구조도 CM-여신-004',
  ],
  caveat:
    '개별 부실 건의 귀책은 심사 시점의 기준 적용 여부에 따라 달라집니다. ' +
    '해당 심사 개체를 앵커로 다시 질의하면 적용된 조항까지 확정할 수 있습니다.',
};

export const SCENARIOS: QueryScenario[] = [S1, S2, S3];

/** 아직 시나리오를 붙이지 않은 질문 — 드롭다운 폭을 넓혀 실제 제품처럼 보이게 한다. */
export const EXTRA_QUESTIONS: string[] = [
  '대성정밀 담보 재평가하면 한도 얼마나 늘어나요?',
  '신용등급 BB 이하인데 신용공여 나간 건 있어요?',
  '만기 3개월 이내 여신약정 건수와 금액 합계는?',
  '부동산담보 담보인정비율이 규정 상한을 넘는 건 있나요?',
  '지점장 전결로 나간 건 중에 신용공여 포함된 게 있어요?',
  '업종별 여신 잔액이 어떻게 나뉘어요?',
];
