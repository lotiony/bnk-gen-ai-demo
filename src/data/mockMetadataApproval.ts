/**
 * 자동 메타데이터 생성 + Data Owner 사전 검증 mock.
 *
 * RFP EDA-008 자동 메타데이터 생성 및 사람 검증 (필수)
 *   "원천 데이터의 패턴/샘플을 분석하여 비즈니스 메타데이터 및 카탈로그를 자동
 *    생성하되, 생성된 메타데이터가 **Vector DB/RAG에 반영되기 전** 계열사 데이터
 *    관리자(Data Owner)의 **사전 검증 및 승인(HITL)** 을 거치도록 절차 및 기능 구현"
 *
 * 화면이 증명해야 하는 것은 두 가지다.
 *   ① 사람이 컬럼 설명을 일일이 쓰지 않는다 — 패턴·샘플에서 초안이 나온다
 *   ② 그 초안은 **승인 전까지 인덱스에 들어가지 않는다** — 이게 관문이다
 *
 * 전부 가상 데이터다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type MetaReviewState = 'pending' | 'approved' | 'rejected';

export interface MetaColumn {
  /** 물리 컬럼명. */
  column: string;
  /** 물리 타입. */
  type: string;
  /** 자동 생성된 비즈니스 명칭. */
  suggestedName: string;
  /** 자동 생성된 설명. */
  suggestedDesc: string;
  /** 추론 근거 — 무엇을 보고 만들었는가. */
  basis: string;
  /** 생성기 신뢰도 0~100. */
  confidence: number;
  /** 민감도 추정 — 승인 시 마스킹 정책과 연결된다. */
  sensitivity: 'PII' | '신용정보' | '내부' | '공개';
  /** 샘플 값 — 이미 마스킹된 상태로만 보여 준다. */
  sample: string;
}

export interface MetaReviewItem {
  id: string;
  /** 원천 시스템 · 테이블. */
  source: string;
  table: string;
  tenant: Tenant;
  /** 데이터 오너 — 계열사 데이터 관리자. */
  owner: string;
  ownerDept: string;
  /** 생성 시각. */
  generatedAt: string;
  /** 분석한 샘플 행 수. */
  sampledRows: number;
  state: MetaReviewState;
  /** 반영 대상 인덱스 — 승인되어야 여기로 간다. */
  targetIndex: string;
  columns: MetaColumn[];
  /** 반려 시 사유. */
  rejectNote?: string;
}

export const META_REVIEWS: MetaReviewItem[] = [
  {
    id: 'META-1042',
    source: '여신 정보계',
    table: 'LN_CONTRACT_MST',
    tenant: '부산은행',
    owner: '오데이터',
    ownerDept: '데이터관리부',
    generatedAt: '2026-01-07 22:10',
    sampledRows: 5000,
    state: 'pending',
    targetIndex: 'idx-loan-contract-v1 (ns-bank-bs)',
    columns: [
      {
        column: 'CTRT_NO',
        type: 'VARCHAR(20)',
        suggestedName: '여신 계약번호',
        suggestedDesc: '여신 계약 1건을 식별하는 고유 번호. 지점코드 3자리 + 일련번호 구조.',
        basis: '값 형식이 전건 동일(3+13자리) · 유일성 100% · 컬럼명 약어 CTRT=계약',
        confidence: 94,
        sensitivity: '내부',
        sample: '051-0000001234567',
      },
      {
        column: 'CUST_RRN',
        type: 'VARCHAR(13)',
        suggestedName: '고객 주민등록번호',
        suggestedDesc: '차주의 주민등록번호. 개인식별정보이므로 조회 시 기본 마스킹 대상.',
        basis: '13자리 숫자 · 7번째 자리 1~4 분포 · 생년월일 패턴 일치율 99.8%',
        confidence: 99,
        sensitivity: 'PII',
        sample: '9****-*******',
      },
      {
        column: 'LN_AMT',
        type: 'NUMBER(18,2)',
        suggestedName: '여신 실행금액',
        suggestedDesc: '해당 계약으로 실행된 원금 총액(원). 감액·증액 시 최종값으로 갱신된다.',
        basis: '전건 양수 · 중앙값 4,800만 · 컬럼명 AMT=금액 · 통화 단위 원',
        confidence: 88,
        sensitivity: '신용정보',
        sample: '48,000,000',
      },
      {
        column: 'DLQ_DCNT',
        type: 'NUMBER(5)',
        suggestedName: '연체 일수',
        suggestedDesc: '약정 상환일 경과 후 누적 연체 일수. 0이면 정상.',
        basis: '값 범위 0~1,095 · 0 비율 92% · 약어 DLQ=delinquency, DCNT=day count',
        confidence: 71,
        sensitivity: '신용정보',
        sample: '0',
      },
      {
        column: 'RMK_CNTN',
        type: 'CLOB',
        suggestedName: '비고',
        suggestedDesc: '담당자 자유 기술 메모. 정형 규칙이 없어 검색 품질이 낮을 수 있다.',
        basis: '자유 텍스트 · 결측 68% · 길이 편차 큼(4~2,300자)',
        confidence: 42,
        sensitivity: '내부',
        sample: '(마스킹된 자유 텍스트)',
      },
    ],
  },
  {
    id: 'META-1043',
    source: '수신 계정계',
    table: 'DP_ACCT_BAL',
    tenant: '경남은행',
    owner: '남데이터',
    ownerDept: '데이터기획팀',
    generatedAt: '2026-01-08 03:40',
    sampledRows: 5000,
    state: 'pending',
    targetIndex: 'idx-deposit-balance-v1 (ns-bank-kn)',
    columns: [
      {
        column: 'ACCT_NO',
        type: 'VARCHAR(16)',
        suggestedName: '계좌번호',
        suggestedDesc: '수신 계좌 식별 번호. 금융 민감정보로 조회 시 부분 마스킹 대상.',
        basis: '16자리 숫자 · 유일성 100% · 체크섬 규칙 일치',
        confidence: 96,
        sensitivity: 'PII',
        sample: '1012-****-**34',
      },
      {
        column: 'BAL_AMT',
        type: 'NUMBER(18,2)',
        suggestedName: '계좌 잔액',
        suggestedDesc: '기준일시 현재 원화 잔액(원).',
        basis: '전건 0 이상 · 일 단위 변동 · 컬럼명 BAL=balance',
        confidence: 91,
        sensitivity: '신용정보',
        sample: '3,240,500',
      },
      {
        column: 'PROD_CD',
        type: 'CHAR(6)',
        suggestedName: '상품 코드',
        suggestedDesc: '수신 상품 분류 코드. 상품 마스터와 조인해 상품명을 얻는다.',
        basis: '고유값 84개 · 상품 마스터 코드 집합과 100% 일치',
        confidence: 89,
        sensitivity: '공개',
        sample: 'DP0142',
      },
    ],
  },
  {
    id: 'META-1039',
    source: '카드 정보계',
    table: 'CD_APPR_HIST',
    tenant: 'BNK캐피탈',
    owner: '정데이터',
    ownerDept: '리스크데이터팀',
    generatedAt: '2026-01-05 09:12',
    sampledRows: 5000,
    state: 'approved',
    targetIndex: 'idx-card-approval-v2 (ns-capital)',
    columns: [
      {
        column: 'APPR_NO',
        type: 'VARCHAR(12)',
        suggestedName: '승인번호',
        suggestedDesc: '카드 승인 거래 1건의 고유 번호.',
        basis: '12자리 숫자 · 유일성 100%',
        confidence: 95,
        sensitivity: '내부',
        sample: '840113002914',
      },
      {
        column: 'MCHT_NM',
        type: 'VARCHAR(60)',
        suggestedName: '가맹점명',
        suggestedDesc: '승인이 발생한 가맹점 상호.',
        basis: '자유 텍스트 · 가맹점 마스터와 92% 매칭',
        confidence: 84,
        sensitivity: '공개',
        sample: '(가상)한빛문구 서면점',
      },
    ],
  },
  {
    id: 'META-1036',
    source: '여신 정보계',
    table: 'LN_GUARANTOR',
    tenant: '부산은행',
    owner: '오데이터',
    ownerDept: '데이터관리부',
    generatedAt: '2026-01-03 16:30',
    sampledRows: 5000,
    state: 'rejected',
    targetIndex: 'idx-loan-guarantor-v1 (ns-bank-bs)',
    rejectNote:
      '보증인 성명·연락처가 "공개" 로 분류되어 반려. 제3자 개인정보이므로 PII 로 재분류 후 재상신할 것.',
    columns: [
      {
        column: 'GRNT_NM',
        type: 'VARCHAR(30)',
        suggestedName: '보증인 성명',
        suggestedDesc: '연대보증인 이름.',
        basis: '한글 2~4자 · 성씨 분포 일치',
        confidence: 90,
        sensitivity: '공개',
        sample: '(가상)김**',
      },
    ],
  },
];

export const SENSITIVITY_TONE: Record<MetaColumn['sensitivity'], string> = {
  PII: 'bg-bad-bg text-bad border-bad-border',
  신용정보: 'bg-warn-bg text-warn border-warn-border',
  내부: 'bg-info-bg text-info border-info-border',
  공개: 'bg-surface-soft text-ink-mid border-line-soft',
};
