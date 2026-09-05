/**
 * 그룹 공동 사용 에이전트 — RFP AGB-006 필수 Use Case 10종.
 *
 * RFP AGB-006 (필수 · 상세제안필요)
 *   "플랫폼 구축 후 전사 임직원이 업무에 활용할 수 있도록 주요 공통 업무용
 *    AI에이전트에 대해 제시해야 함
 *    [필수 포함 Use Case] ①규정/책무 어시스턴트 ②그룹웨어 문서 어시스턴트
 *    ③회의 보조 ④문서작성 도우미 ⑤고객/민원 분석 및 마케팅 ⑥광고심의 지원
 *    ⑦지식/상품 어시스턴트 ⑧여신업무 어시스턴트 ⑨외환업무 어시스턴트
 *    ⑩단말기 네비게이터"
 *
 * **10종이 하나라도 비면 상세제안 항목에서 바로 지적된다.** 그래서 카탈로그의
 * 일반 자산 목록과 별도로, 요구된 번호에 1:1 대응하는 블록을 따로 세운다.
 * 이 파일이 곧 제안서 조견표의 AGB-006 근거다.
 *
 * 계열사 자산이 아니라 **그룹 공통(ns-group-common)** 에 배포되므로 10개 계열사
 * 전 임직원이 자기 Namespace 에서 그대로 호출한다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

export type GroupAgentStatus = '운영 중' | '검증 중' | '개발 중';

export interface GroupAgent {
  /** RFP 표기 번호 — ①~⑩. */
  no: string;
  id: string;
  /** RFP 가 부른 Use Case 명. 임의로 바꾸지 않는다. */
  useCase: string;
  /** 우리가 제공하는 에이전트 표시명. */
  name: string;
  status: GroupAgentStatus;
  /** RFP 세부설명이 요구한 기능을 화면에서 확인 가능한 단위로 쪼갠 것. */
  features: string[];
  /** 이 Use Case 가 기대는 연계 시스템·자산. */
  depends: string[];
  /** 주력 모델. */
  model: string;
  /** 7일 호출 수. 개발 중이면 0. */
  callsWeekly: number;
  /** 담당 계열사 — 제작 주관. 배포 범위는 그룹 전체다. */
  ownerTenant: string;
}

export const GROUP_AGENTS: GroupAgent[] = [
  {
    no: '①',
    id: 'GRP-001',
    useCase: '규정/책무 어시스턴트',
    name: '규정 · 책무 어시스턴트',
    status: '운영 중',
    features: [
      '내규 질의 의도 분석 후 근거 조항 인용 응답',
      '전결권 제시 · 규정 간 관계 연결(메타정보)',
      '본문 및 개정 전후 비교표 자동 생성',
      '외부 법령 변경 시 내규 영향도 검토',
      '내규 변경 시 책무 영향도 검토',
    ],
    depends: ['규정 인덱스', '온톨로지(전결·책무 관계)', 'Graph RAG'],
    model: 'onprem/gpt-oss-120b',
    callsWeekly: 22400,
    ownerTenant: '부산은행',
  },
  {
    no: '②',
    id: 'GRP-002',
    useCase: '그룹웨어 문서 어시스턴트',
    name: '그룹웨어 문서 어시스턴트',
    status: '운영 중',
    features: [
      '그룹웨어 내부문서 자연어 검색 · 요약',
      '문서 초안 작성 지원',
      '문서 내 첨부파일 관계 연결',
      '문서 메타정보 관리',
    ],
    depends: ['그룹웨어 MCP', '문서 파서(HWP·DOCX·PDF)'],
    model: 'onprem/gpt-oss-120b',
    callsWeekly: 18900,
    ownerTenant: 'BNK시스템',
  },
  {
    no: '③',
    id: 'GRP-003',
    useCase: '회의 보조',
    name: '회의 보조 에이전트',
    status: '운영 중',
    features: [
      '녹음된 회의 내용 요약 정리',
      '회의 진행 관리 · 액션아이템 추출',
      '회의 일정 조율(일정관리 에이전트 연계)',
      '회의실 예약(자원관리 에이전트 연계)',
    ],
    depends: ['STT 모델', '일정관리 MCP', '자원관리 MCP'],
    model: 'Whisper-Large-KO + onprem/gpt-oss-120b',
    callsWeekly: 41200,
    ownerTenant: 'BNK시스템',
  },
  {
    no: '④',
    id: 'GRP-004',
    useCase: '문서작성 도우미',
    name: '품의 · 보고서 작성 도우미',
    status: '운영 중',
    features: [
      '품의문 초안 작성 — 배경·근거규정·예산 입력 기반',
      '보고서 개조식 초안 작성',
      '계열사별 서식 자동 반영',
      '작성 중 근거규정 인용 검증',
    ],
    depends: ['그룹 표준 프롬프트 템플릿', '규정 인덱스'],
    model: 'onprem/gpt-oss-120b',
    callsWeekly: 26700,
    ownerTenant: '부산은행',
  },
  {
    no: '⑤',
    id: 'GRP-005',
    useCase: '고객/민원 분석 및 마케팅',
    name: '고객 · 민원 분석 에이전트',
    status: '운영 중',
    features: [
      '고객 정보(직업·나이·거래) 기반 프로필 생성',
      '자산 운용 · 포트폴리오 제안 및 상품 추천',
      '고객 상담 내용 분석 및 요약',
      '민원 유형 자동 분류 및 회신 초안',
    ],
    depends: ['고객 DB 가상 뷰(RLS/CLS)', '동의 권원 확인', '상품 인덱스'],
    model: 'onprem/qwen3-32b',
    callsWeekly: 15900,
    ownerTenant: '부산은행',
  },
  {
    no: '⑥',
    id: 'GRP-006',
    useCase: '광고심의 지원',
    name: '광고심의 지원 에이전트',
    status: '운영 중',
    features: [
      '마케팅 문구 작성 및 표시·광고 규정 위반 검증',
      '광고심의용 파일 피드백',
      '내부 심의 시스템 연동 상신',
      '대체 문구 제안',
    ],
    depends: ['광고심의 규정 인덱스', '심의시스템 MCP'],
    model: 'google/gemma-4-31B-it-assistant',
    callsWeekly: 4800,
    ownerTenant: 'BNK캐피탈',
  },
  {
    no: '⑦',
    id: 'GRP-007',
    useCase: '지식/상품 어시스턴트',
    name: '지식 · 상품 어시스턴트',
    status: '검증 중',
    features: [
      '그룹웨어 전자문서 · 상품매뉴얼 · KMS 통합 연동',
      '사례별 질의 답변 — 출처 문서·청크 표시',
      '상품 비교표 자동 생성(금리·조건·우대)',
      '상품 개정 시 변경분 알림',
    ],
    depends: ['KMS 커넥터', '상품매뉴얼 인덱스', '전자문서 MCP', '하이브리드 서치'],
    model: 'onprem/gpt-oss-120b',
    callsWeekly: 0,
    ownerTenant: '경남은행',
  },
  {
    no: '⑧',
    id: 'GRP-008',
    useCase: '여신업무 어시스턴트',
    name: '여신업무 어시스턴트',
    status: '운영 중',
    features: [
      '여신 상담 신청 및 서류 징구 검증',
      '여신 심사 및 약정서 작성 지원',
      '신용조사 · 담보 보증평가 보조',
      '약정 조건이행 및 기일 관리',
      '건전성 리스크 모니터링 및 부실 이행 회수',
      '기능단위 내부시스템 연결',
    ],
    depends: ['여신 계정계 MCP', '담보 평가 커넥터', '여신 규정 인덱스'],
    model: 'onprem/gpt-oss-120b',
    callsWeekly: 24600,
    ownerTenant: '부산은행',
  },
  {
    no: '⑨',
    id: 'GRP-009',
    useCase: '외환업무 어시스턴트',
    name: '외환업무 어시스턴트',
    status: '운영 중',
    features: [
      '신용장 · 징구서류 검증 및 요약',
      '조건변경 전문 대조 — 품목별 요구서류 차이 식별',
      'SWIFT 전문 필드 정합성 검증',
      '외환 규정 해석 및 근거 조항 인용',
    ],
    depends: ['SWIFT 전문 어댑터', '외환 규정 인덱스'],
    model: 'onprem/gpt-oss-120b',
    callsWeekly: 6100,
    /*
     * 제작 주관은 **부산은행**이다.
     *
     * 외환 시나리오가 "부산은행 직원의 개선 의견 → 부산은행 관리자 승인 →
     * 그룹 마켓 등록 → 경남은행 적용" 으로 흐른다. 개선안 결재의 승인권자는
     * 소유 계열사의 AI서비스 관리자로 배정되므로(`resolveAffiliateApprover`),
     * 주관이 경남은행이면 부산은행 직원이 낸 개선안을 경남은행 관리자가
     * 승인하게 되어 서사와 결재선이 어긋난다.
     */
    ownerTenant: '부산은행',
  },
  {
    no: '⑩',
    id: 'GRP-010',
    useCase: '단말기 네비게이터',
    name: '단말기 네비게이터',
    status: '개발 중',
    features: [
      '자연어 업무 호출 — "외화 송금 취소" → 해당 화면 직행',
      '업무 판별 지원 — 연계 업무 순서 및 화면 노출',
      '필수 절차 안내 — 업무 주의사항 · 조작방법서',
      '담당자 팝업 — 문의처 즉시 연결',
    ],
    depends: ['단말 화면 메타 카탈로그', '조작방법서 인덱스', '단말 연계 MCP'],
    model: 'google/gemma-4-31B-it-assistant',
    callsWeekly: 0,
    ownerTenant: 'BNK시스템',
  },
];

export const GROUP_AGENT_STATUS_TONE: Record<GroupAgentStatus, 'ok' | 'warn' | 'neutral'> = {
  '운영 중': 'ok',
  '검증 중': 'warn',
  '개발 중': 'neutral',
};
