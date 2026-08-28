/**
 * 온톨로지 A-Box mock — 실체화된 개체.
 *
 * T-Box(클래스)만 그리면 "스키마 그림"으로 보인다. 원본(kt Ontology Platform)이
 * 설득력 있는 이유는 순회할 때 **클래스 아래 실제 개체가 펼쳐지고, 선택되지 않은
 * 개체가 점선 후보로 남기** 때문이다. "이 고객의 이 약정, 이 담보를 타고 갔다"가
 * 눈에 보여야 결정론적 추론이라는 주장이 성립한다.
 *
 * ⚠️ 전부 가상 데이터다. 실제 BNK 고객·여신·내규가 아니다.
 */

export interface Instance {
  id: string;
  /** 소속 클래스명. */
  cls: string;
  /** 그래프 노드 라벨. */
  label: string;
  /** 상세 카드에 표시할 속성값. */
  props: Record<string, string>;
  /** 출처 — 정형DB 뷰 또는 문서. */
  origin: string;
}

/* ═══════════════════════ 개체 ═══════════════════════ */

export const INSTANCES: Instance[] = [
  /* 고객 */
  { id: 'cust-8842', cls: '고객', label: '대성정밀(주)', origin: 'DV_CUST.V_CORP_CUSTOMER',
    props: { 고객번호: 'CUST-8842', 사업자번호: '214-81-****', 설립일자: '2009-04-17', 거래기간: '11년 2개월', 주거래여부: 'Y' } },
  { id: 'cust-7310', cls: '고객', label: '한빛기계(주)', origin: 'DV_CUST.V_CORP_CUSTOMER',
    props: { 고객번호: 'CUST-7310', 사업자번호: '607-81-****', 거래기간: '4년 8개월', 주거래여부: 'N' } },
  { id: 'cust-9021', cls: '고객', label: '동성화학(주)', origin: 'DV_CUST.V_CORP_CUSTOMER',
    props: { 고객번호: 'CUST-9021', 사업자번호: '502-81-****', 거래기간: '7년 1개월', 주거래여부: 'Y' } },

  /* 업종 */
  { id: 'ind-c29', cls: '업종', label: '기계부품 제조', origin: 'DV_CUST.V_INDUSTRY',
    props: { 업종코드: 'C29', 업종명: '기타 기계 및 장비 제조업', 업종위험도: '중(3등급)' } },

  /* 재무제표 */
  { id: 'fs-2025', cls: '재무제표', label: 'FY2025 결산', origin: 'DV_CRD.V_FIN_STATEMENT',
    props: { 결산년도: '2025', 매출액: '182.4억', 영업이익: '9.4억', 당기순이익: '6.1억', 부채비율: '178%', 이자보상배율: '3.2배' } },
  { id: 'fs-2024', cls: '재무제표', label: 'FY2024 결산', origin: 'DV_CRD.V_FIN_STATEMENT',
    props: { 결산년도: '2024', 매출액: '171.0억', 영업이익: '7.8억', 부채비율: '192%', 이자보상배율: '2.7배' } },
  { id: 'fs-2023', cls: '재무제표', label: 'FY2023 결산', origin: 'DV_CRD.V_FIN_STATEMENT',
    props: { 결산년도: '2023', 매출액: '158.2억', 영업이익: '5.1억', 부채비율: '205%', 이자보상배율: '1.9배' } },

  /* 신용등급 */
  { id: 'grade-bbb', cls: '신용등급', label: 'BBB0', origin: 'DV_CRD.V_CREDIT_GRADE',
    props: { 등급코드: 'BBB0', 평가일자: '2026-03-18', 부도확률: '1.42%', 평가모형: 'CSS-CORP-v4', 등급변동: '유지' } },
  { id: 'grade-bbb-prev', cls: '신용등급', label: 'BBB+ (직전)', origin: 'DV_CRD.V_CREDIT_GRADE',
    props: { 등급코드: 'BBB+', 평가일자: '2025-03-20', 부도확률: '1.05%', 등급변동: '하향' } },

  /* 연체이력 */
  { id: 'dlq-none', cls: '연체이력', label: '연체 없음', origin: 'DV_LOAN.V_DELINQUENCY',
    props: { 연체건수: '0', 최장연체일수: '0', 해소여부: '해당없음' } },

  /* 여신신청 */
  { id: 'app-0311', cls: '여신신청', label: 'APP-2026-0311', origin: 'DV_LOAN.V_LOAN_APPLICATION',
    props: { 신청번호: 'APP-2026-0311', 신청금액: '5.0억', 신청일자: '2026-05-28', 자금용도: '운전자금', 상환방식: '만기일시', 희망만기: '2027-05-27' } },
  { id: 'app-0188', cls: '여신신청', label: 'APP-2025-0188 (완결)', origin: 'DV_LOAN.V_LOAN_APPLICATION',
    props: { 신청번호: 'APP-2025-0188', 신청금액: '4.0억', 신청일자: '2025-06-02', 자금용도: '시설자금' } },

  /* 여신상품 */
  { id: 'prod-wc', cls: '여신상품', label: '기업운전자금대출', origin: 'DV_LOAN.V_LOAN_PRODUCT',
    props: { 상품코드: 'LP-WC-002', 기준금리: 'CD 91일 + 2.1%', 최대한도: '30억', 취급대상: 'BB0 이상 법인' } },

  /* 여신약정 */
  { id: 'ln-0117', cls: '여신약정', label: 'LN-2024-0117', origin: 'DV_LOAN.V_CREDIT_AGREEMENT',
    props: { 약정번호: 'LN-2024-0117', 약정금액: '8.0억', 실행잔액: '6.2억', 한도잔액: '1.8억', 금리: '5.42%', 만기일자: '2027-01-16', 약정상태: '정상' } },
  { id: 'ln-0233', cls: '여신약정', label: 'LN-2025-0233', origin: 'DV_LOAN.V_CREDIT_AGREEMENT',
    props: { 약정번호: 'LN-2025-0233', 약정금액: '4.0억', 실행잔액: '3.2억', 한도잔액: '0.8억', 금리: '5.88%', 만기일자: '2026-12-01', 약정상태: '정상' } },
  { id: 'ln-9902', cls: '여신약정', label: 'LN-2021-9902 (상환완료)', origin: 'DV_LOAN.V_CREDIT_AGREEMENT',
    props: { 약정번호: 'LN-2021-9902', 약정금액: '3.0억', 실행잔액: '0', 약정상태: '상환완료' } },

  /* 담보 */
  { id: 'col-5521', cls: '담보', label: 'COL-5521 부동산', origin: 'DV_LOAN.V_COLLATERAL',
    props: { 담보번호: 'COL-5521', 담보종류: '부동산(공장)', 감정가액: '8.4억', 설정금액: '10.1억', 담보인정비율: '55%', 선순위금액: '1.2억' } },
  { id: 'col-5522', cls: '담보', label: 'COL-5522 예금', origin: 'DV_LOAN.V_COLLATERAL',
    props: { 담보번호: 'COL-5522', 담보종류: '예금질권', 감정가액: '0.5억', 담보인정비율: '100%', 선순위금액: '0' } },
  { id: 'col-4408', cls: '담보', label: 'COL-4408 기계기구', origin: 'DV_LOAN.V_COLLATERAL',
    props: { 담보번호: 'COL-4408', 담보종류: '기계기구', 감정가액: '1.1억', 담보인정비율: '40%' } },

  /* 부동산담보 */
  { id: 're-5521', cls: '부동산담보', label: '김해 공장부지', origin: 'DV_LOAN.V_COLLATERAL_RE',
    props: { 소재지: '경남 김해시 주촌면', 면적: '3,240㎡', 공시지가: '6.1억', 감정평가기관: '한국감정원' } },

  /* 예금담보 */
  { id: 'dep-5522', cls: '예금담보', label: '정기예금 질권', origin: 'DV_LOAN.V_COLLATERAL_DEP',
    props: { 예금계좌번호: '301-****-8842', 예금잔액: '0.5억', 질권설정일: '2025-06-10' } },

  /* 보증 */
  { id: 'grt-kodit', cls: '보증', label: '신용보증기금 부분보증', origin: 'DV_LOAN.V_GUARANTEE',
    props: { 보증기관: '신용보증기금', 보증비율: '85%', 보증금액: '1.7억', 보증서번호: 'KODIT-2026-****' } },

  /* 심사 */
  { id: 'rv-0455', cls: '심사', label: 'RV-2026-0455', origin: 'DV_LOAN.V_CREDIT_REVIEW',
    props: { 심사번호: 'RV-2026-0455', 심사일자: '2026-06-03', 심사결과: '조건부승인(안)', 심사점수: '72.4', 조건부승인내용: '영업흑자 3개년 확인 조건' } },
  { id: 'rv-0188', cls: '심사', label: 'RV-2025-0188 (승인)', origin: 'DV_LOAN.V_CREDIT_REVIEW',
    props: { 심사번호: 'RV-2025-0188', 심사일자: '2025-06-11', 심사결과: '승인', 심사점수: '75.1' } },

  /* 심사역 */
  { id: 'ofc-lee', cls: '심사역', label: '이지훈 심사역', origin: 'DV_HR.V_EMPLOYEE',
    props: { 사번: 'E-20417', 성명: '이지훈', 심사등급: '선임', 전담업종: '기계·금속' } },

  /* 규정 */
  { id: 'reg-cr', cls: '규정', label: '여신업무규정', origin: '여신업무규정.pdf',
    props: { 규정번호: 'REG-CR-001', 제정일자: '2011-03-02', 최종개정일자: '2026-03-01', 소관부서: '여신기획부' } },
  { id: 'reg-au', cls: '규정', label: '전결규정', origin: '전결규정.pdf',
    props: { 규정번호: 'REG-AU-003', 제정일자: '2014-07-15', 최종개정일자: '2025-11-20', 소관부서: '경영관리부' } },

  /* 조항 */
  { id: 'cl-12', cls: '조항', label: '여신규정 §12', origin: '여신업무규정.pdf p.24',
    props: { 조항번호: '제12조', 조항제목: '신용공여 한도', 시행일자: '2026-03-01', 개정차수: '7차',
      조항본문: 'BBB등급 법인의 신용공여는 유효담보가액 부족분에 한하여 2억원 이내로 취급할 수 있다. 단, 최근 3년 연속 영업흑자 요건을 충족하여야 한다.' } },
  { id: 'cl-3', cls: '조항', label: '여신규정 §3', origin: '여신업무규정.pdf p.6',
    props: { 조항번호: '제3조', 조항제목: '심사 기준의 수립', 시행일자: '2025-01-01',
      조항본문: '여신 심사 기준의 수립·개정 및 그 운영에 관한 관리 의무는 여신본부장이 진다.' } },
  { id: 'cl-au5', cls: '조항', label: '전결규정 §5 별표1', origin: '전결규정.pdf 별표1',
    props: { 조항번호: '제5조 별표1', 조항제목: '여신 전결 구분', 시행일자: '2025-11-20',
      조항본문: '동일인 여신 총액 10억원 초과 20억원 이하이며 신용공여를 포함하는 건은 여신본부장 전결. 10억원 이하 담보부는 지점장 전결.' } },
  { id: 'cl-9', cls: '조항', label: '여신규정 §9', origin: '여신업무규정.pdf p.18',
    props: { 조항번호: '제9조', 조항제목: '담보 인정 기준', 조항본문: '부동산 담보의 인정비율은 감정가액의 55% 이내로 하며, 선순위 설정액을 차감한다.' } },

  /* 예외조항 */
  { id: 'ex-12-1', cls: '예외조항', label: '§12 단서', origin: '여신업무규정.pdf p.24',
    props: { 예외사유: '주거래 고객이며 보증기관 부분보증이 있는 경우', 승인요건: '여신협의회 부의' } },

  /* 전결권 */
  { id: 'au-c', cls: '전결권', label: 'AU-C 본부장', origin: '전결규정.pdf 별표1',
    props: { 전결구분: 'AU-C', 금액하한: '10억 초과', 금액상한: '20억 이하', 신용공여포함: 'Y', 적용시작일: '2025-11-20' } },
  { id: 'au-b', cls: '전결권', label: 'AU-B 지점장', origin: '전결규정.pdf 별표1',
    props: { 전결구분: 'AU-B', 금액하한: '5억 초과', 금액상한: '10억 이하', 신용공여포함: 'N(담보부 한정)' } },
  { id: 'au-d', cls: '전결권', label: 'AU-D 협의회', origin: '전결규정.pdf 별표1',
    props: { 전결구분: 'AU-D', 금액하한: '20억 초과', 신용공여포함: 'Y' } },

  /* 여신협의회 */
  { id: 'cmte-std', cls: '여신협의회', label: '상시 여신협의회', origin: '전결규정.pdf 제7조',
    props: { 협의회구분: '상시', 개최주기: '주 1회', 의결정족수: '재적 2/3', 부의기준금액: '20억 초과' } },

  /* 책무 */
  { id: 'cm-004', cls: '책무', label: 'CM-여신-004', origin: '책무구조도.xlsx',
    props: { 책무번호: 'CM-여신-004', 책무내용: '여신 심사 기준 수립 및 운영 관리', 배분일자: '2025-07-01', 관리의무: '연 1회 적정성 점검' } },

  /* 직책 */
  { id: 'pos-head', cls: '직책', label: '여신본부장', origin: 'DV_HR.V_POSITION',
    props: { 직책코드: 'P-310', 결재순위: '2', 전결한도: '20억' } },
  { id: 'pos-branch', cls: '직책', label: '지점장', origin: 'DV_HR.V_POSITION',
    props: { 직책코드: 'P-520', 결재순위: '4', 전결한도: '10억(담보부)' } },

  /* 조직 */
  { id: 'org-cr', cls: '조직', label: '여신본부', origin: 'DV_HR.V_ORG',
    props: { 조직코드: 'O-3100', 상위조직: '은행 본점', 조직구분: '본부' } },
  { id: 'org-br', cls: '조직', label: '부산중앙지점', origin: 'DV_HR.V_ORG',
    props: { 조직코드: 'O-5203', 상위조직: '동부영업본부', 조직구분: '영업점' } },
];

export const INSTANCE_COUNT = INSTANCES.length;

export function instById(id: string): Instance | undefined {
  return INSTANCES.find((i) => i.id === id);
}

export function instancesOfClass(cls: string): Instance[] {
  return INSTANCES.filter((i) => i.cls === cls);
}

/* ═══════════════════════ 순회 경로 ═══════════════════════ */

/** 순회에서 실제로 선택된 개체 간 연결. */
export interface TravEdge {
  from: string;
  to: string;
  rel: string;
}

export interface TravNode {
  id: string;
  /** 이 스텝(0부터)에 점등된다. */
  step: number;
  /** 앵커·핵심 개체는 강조. */
  focus?: boolean;
}

export interface Traversal {
  anchor: string;
  nodes: TravNode[];
  edges: TravEdge[];
}
