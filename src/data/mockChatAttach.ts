/**
 * 대화 중 파일 첨부 mock — 핸드오프 §2 화면 18.
 *
 * RFP 2-1 사용자 포털:
 *   "대화중 파일 업로드 기능(문서/이미지), 업로드 파일 기반 응답·요약·번역"
 * 연계 요건:
 *   SEC-008 — 프롬프트/파일 비식별화 처리 (저장 시 원본 식별 불가)
 *   SEC-004 — 민감정보 차단 필터링
 *   SEC-005 — 계열사별 DRM 자동 암·복호화 연동
 *
 * 개인 문서 저장소(`mockPersonalDocs`)와 다른 축이다. 저장소 문서는 개인 격리
 * 인덱스에 **남아서** 이후 대화·에이전트 개발에 계속 쓰이고, 여기 첨부는 그 턴에서만
 * 쓰이는 **일회성**이다. 그래서 첨부는 인덱스에 적재하지 않고 세션 컨텍스트로만 간다.
 *
 * 이 mock 의 무게중심은 "첨부하면 답이 나온다" 가 아니라 **첨부가 반입 검사를
 * 통과해야 답이 나온다** 는 쪽이다. 그래서 표본 4건을 판정별로 하나씩 둔다 —
 * 정상 / 자동 비식별 / 번역 대상 / DRM 차단. 시연에서 마지막 건이 핵심이다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

/** 반입 검사 판정. */
export type AttachVerdict = 'ok' | 'masked' | 'blocked';

export interface AttachAction {
  kind: '요약' | '번역' | '추출';
  /** 버튼 라벨. */
  label: string;
  /** 사용자 발화로 기록될 문장. */
  q: string;
  /** 답변 본문. */
  a: string;
}

export interface AttachFile {
  id: string;
  name: string;
  ext: string;
  sizeMB: number;
  kind: '문서' | '이미지';
  verdict: AttachVerdict;
  /** 반입 검사 한 줄 요약 — 첨부 칩에 그대로 노출된다. */
  scan: string;
  /** 자동 비식별 처리 건수(verdict === 'masked'). */
  maskedCount?: number;
  /** 비식별 처리된 항목명. */
  maskedItems?: string[];
  /** 차단 사유(verdict === 'blocked'). */
  blockReason?: string;
  /** 차단 시 안내할 다음 절차. */
  blockNext?: string;
  /** 파싱 결과 — 통과한 첨부에만 있다. */
  pages?: number;
  chunks?: number;
  actions: AttachAction[];
}

export const ATTACH_SAMPLES: AttachFile[] = [
  {
    id: 'ATT-01',
    name: '여신심사_품의서_초안.docx',
    ext: 'DOCX',
    sizeMB: 0.9,
    kind: '문서',
    verdict: 'ok',
    scan: 'PII 미검출 · DRM 미적용 · 금칙어 없음',
    pages: 12,
    chunks: 34,
    actions: [
      {
        kind: '요약',
        label: '요약해줘',
        q: '첨부한 여신심사 품의서 초안을 요약해줘.',
        a:
          '품의서 초안 12쪽을 5개 항으로 정리했습니다.\n\n' +
          '① 여신 종류 — 운전자금 대출 신규, 한도 12억원, 기간 1년 (분기 이자 후취)\n' +
          '② 담보 — 공장용지·건물 근저당 1순위, 감정가 18.4억원 대비 담보인정비율 65%\n' +
          '③ 신용 — 최근 3개년 매출 증가율 연평균 11.2%, 부채비율 143% (업종 평균 168% 대비 양호)\n' +
          '④ 특이사항 — 2025년 4분기 일시적 유동성 저하 구간이 있으나 회수 완료로 기재\n' +
          '⑤ 전결 — 한도 12억원은 지점장 전결 범위를 초과하여 본부 여신협의회 상정 대상\n\n' +
          '⑤항은 초안에 "지점 전결"로 적혀 있어 정정이 필요합니다. 전결 기준 판정이 필요하면 규정 에이전트로 이어서 질의하십시오.',
      },
      {
        kind: '추출',
        label: '금액·기간만 뽑아줘',
        q: '첨부 문서에서 금액과 기간 항목만 뽑아줘.',
        a:
          '문서에서 금액·기간에 해당하는 값만 추출했습니다.\n\n' +
          '· 신규 한도 — 1,200,000,000원\n' +
          '· 여신 기간 — 12개월 (2026-07-01 ~ 2027-06-30)\n' +
          '· 담보 감정가 — 1,840,000,000원\n' +
          '· 담보인정비율 — 65%\n' +
          '· 이자 지급 — 분기 후취, 최초 지급일 2026-09-30\n\n' +
          '문서에 표기된 값을 그대로 옮긴 것이며 재계산하지 않았습니다.',
      },
    ],
  },
  {
    id: 'ATT-02',
    name: '고객상담_녹취요약.pdf',
    ext: 'PDF',
    sizeMB: 0.6,
    kind: '문서',
    verdict: 'masked',
    scan: '민감정보 3건 자동 비식별 후 반입',
    maskedCount: 3,
    maskedItems: ['주민등록번호 1건', '휴대전화번호 2건'],
    pages: 4,
    chunks: 9,
    actions: [
      {
        kind: '요약',
        label: '상담 내용 요약',
        q: '첨부한 상담 녹취 요약본의 핵심만 정리해줘.',
        a:
          '비식별 처리된 본문을 기준으로 요약했습니다.\n\n' +
          '· 문의 목적 — 만기 도래 예금의 재예치 조건 비교\n' +
          '· 고객 요구 — 원금 보장 전제, 6개월 이내 중도 해지 가능성 있음\n' +
          '· 안내 내용 — 6개월 회전식 정기예금과 수시입출식 고금리 상품 2종 비교 안내\n' +
          '· 미결 사항 — 중도해지 이율 적용 구간에 대해 재확인 요청, 콜백 예정\n\n' +
          '원본의 주민등록번호 1건과 휴대전화번호 2건은 반입 시점에 마스킹되어 모델에 전달되지 않았습니다. ' +
          '요약 결과에도 식별정보는 포함되지 않습니다.',
      },
    ],
  },
  {
    id: 'ATT-03',
    name: 'Group_ESG_Report_2026_EN.pdf',
    ext: 'PDF',
    sizeMB: 2.1,
    kind: '문서',
    verdict: 'ok',
    scan: 'PII 미검출 · 영문 문서 · 번역 가능',
    pages: 28,
    chunks: 76,
    actions: [
      {
        kind: '번역',
        label: '국문으로 번역',
        q: '첨부한 영문 ESG 보고서를 국문으로 번역해줘.',
        a:
          '28쪽 중 요약(Executive Summary) 부분을 국문으로 옮겼습니다.\n\n' +
          '「2026년 그룹 지속가능경영 보고서 — 요약」\n' +
          '당 그룹은 2026 회계연도에 온실가스 배출량을 전년 대비 8.4% 감축하였으며, ' +
          '녹색금융 취급액은 2조 4,100억원으로 전년 대비 19% 증가하였습니다. ' +
          '이사회 산하 ESG위원회는 연 4회 개최되었고, 중대성 평가를 통해 도출된 12개 핵심 이슈 중 ' +
          '기후 리스크 관리와 정보보호 두 항목을 최우선 과제로 선정하였습니다.\n\n' +
          '전체 28쪽 번역이 필요하면 문서로 출력해 드립니다. 용어는 그룹 ESG 용어집 기준으로 통일했습니다.',
      },
      {
        kind: '요약',
        label: '핵심 지표만 요약',
        q: '첨부 보고서의 핵심 지표만 뽑아줘.',
        a:
          '보고서에 수치로 명시된 지표만 추렸습니다.\n\n' +
          '· 온실가스 배출량 — 전년 대비 8.4% 감축\n' +
          '· 녹색금융 취급액 — 2조 4,100억원 (전년 대비 +19%)\n' +
          '· ESG위원회 개최 — 연 4회\n' +
          '· 중대성 평가 핵심 이슈 — 12개, 이 중 최우선 2개(기후 리스크·정보보호)\n\n' +
          '보고서에 없는 값은 채우지 않았습니다.',
      },
    ],
  },
  {
    id: 'ATT-04',
    name: '이사회_의결서_대외비.pdf',
    ext: 'PDF',
    sizeMB: 1.4,
    kind: '문서',
    verdict: 'blocked',
    scan: '계열사 DRM 등급 「대외비」 — 반입 차단',
    blockReason:
      '문서에 계열사 DRM(문서보안)이 적용되어 있고 등급이 「대외비」입니다. 현재 계정 권한으로는 복호화 권원이 확인되지 않아 플랫폼으로 반입할 수 없습니다.',
    blockNext:
      '열람이 필요하면 문서 소유 부서에 DRM 열람 권한을 신청하십시오. 권한이 부여되면 반입 시점에 자동 복호화되어 첨부됩니다.',
    actions: [],
  },
];

/**
 * 첨부가 붙은 턴의 실행 단계.
 *
 * 일반 질의(RUN_STEPS)와 다른 단계를 앞에 세운다 — 반입 검사와 파싱이 먼저 돌고,
 * 그 다음에야 문서 컨텍스트를 읽는다. 순서를 뒤집으면 "검사 없이 먼저 읽었다"는
 * 그림이 되어 SEC-004·SEC-008 설명과 어긋난다.
 */
export const ATTACH_STEPS: { kind: string; label: string; ms: number }[] = [
  { kind: 'scan', label: '첨부 반입 검사 · DRM 권원 확인', ms: 560 },
  { kind: 'mask', label: '민감정보 탐지 · 자동 비식별화', ms: 520 },
  { kind: 'parse', label: '문서 파싱 · 청크 생성', ms: 600 },
  { kind: 'doc', label: '첨부 컨텍스트 조회', ms: 480 },
  { kind: 'compute', label: '응답 생성', ms: 520 },
];

/** 첨부 판정별 표시 톤. */
export const ATTACH_VERDICT_TONE: Record<AttachVerdict, string> = {
  ok: 'bg-ok-bg text-ok border-ok-border',
  masked: 'bg-warn-bg text-warn border-warn-border',
  blocked: 'bg-bad-bg text-bad border-bad-border',
};

export const ATTACH_VERDICT_LABEL: Record<AttachVerdict, string> = {
  ok: '반입 승인',
  masked: '비식별 후 반입',
  blocked: '반입 차단',
};

/**
 * 첨부는 인덱스에 남지 않는다는 것을 화면에서 못박는 문구.
 * 개인 문서 저장소와 혼동되면 "개인 격리 저장" 설명이 흐려진다.
 */
export const ATTACH_RETENTION_NOTE =
  '첨부 파일은 이 대화 세션에서만 사용되며 개인 인덱스에 적재되지 않습니다. 계속 활용하려면 개인 문서 저장소에 등록하십시오.';
