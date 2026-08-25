/**
 * 정형DB → 온톨로지 데이터 매핑 mock.
 *
 * RFP EDA-001 "물리적 데이터 이동 없이" 요건에 맞춰, 매핑은 **가상 뷰**로
 * 잡는다(zero-copy). 비정형 문서에서 나온 개체만 '문서 실체화'로 표시한다.
 * — 인벤토리 §6 "정형=zero-copy / 비정형=복제 적재" 3분법 유지.
 *
 * ⚠️ 전부 가상 스키마다.
 */

import { CLASSES, RELATIONS } from './ontology';

/** 매핑 출처 — 레퍼런스의 자동/수동/문서 실체화/미매핑 4분류. */
export type MappingSource = 'auto' | 'manual' | 'document' | 'none';

export type MappingKind = '클래스' | '속성' | '관계';

export interface MappingRow {
  kind: MappingKind;
  /** 온톨로지 대상 표시명. */
  target: string;
  /** 온톨로지 대상 URI. */
  uri: string;
  /** 소스 매핑 — 미매핑이면 null. */
  source: string | null;
  status: MappingSource;
  /** 매핑 신뢰도 (0~1). 미매핑은 null. */
  confidence: number | null;
}

export const SOURCE_LABEL: Record<MappingSource, string> = {
  auto: '자동',
  manual: '수동',
  document: '문서 실체화',
  none: '미매핑',
};

export const SOURCE_TONE: Record<MappingSource, string> = {
  auto: 'bg-ok-bg text-ok border-ok-border',
  manual: 'bg-info-bg text-info border-info-border',
  document: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
  none: 'bg-surface text-ink-light border-line-soft',
};

/* ── 클래스 → 소스 테이블(가상 뷰) ── */
const CLASS_SOURCE: Record<string, { src: string; status: MappingSource; conf: number }> = {
  고객: { src: 'DV_CUST.V_CORP_CUSTOMER', status: 'auto', conf: 1.0 },
  신용등급: { src: 'DV_CRD.V_CREDIT_GRADE', status: 'auto', conf: 1.0 },
  여신약정: { src: 'DV_LOAN.V_CREDIT_AGREEMENT', status: 'auto', conf: 1.0 },
  담보: { src: 'DV_LOAN.V_COLLATERAL', status: 'auto', conf: 1.0 },
  부동산담보: { src: 'DV_LOAN.V_COLLATERAL_RE', status: 'manual', conf: 0.94 },
  심사: { src: 'DV_LOAN.V_CREDIT_REVIEW', status: 'auto', conf: 1.0 },
  여신신청: { src: 'DV_LOAN.V_LOAN_APPLICATION', status: 'auto', conf: 1.0 },
  규정: { src: '여신업무규정.pdf · 전결규정.pdf', status: 'document', conf: 0.97 },
  조항: { src: '여신업무규정.pdf (조항 파싱)', status: 'document', conf: 0.93 },
  전결권: { src: '전결규정.pdf 별표1 (표 인식)', status: 'document', conf: 0.88 },
  직책: { src: 'DV_HR.V_POSITION', status: 'auto', conf: 1.0 },
  조직: { src: 'DV_HR.V_ORG', status: 'auto', conf: 1.0 },
  책무: { src: '책무구조도.xlsx', status: 'document', conf: 0.91 },
};

/* ── 매핑되지 않은 속성 (일부러 남겨 커버리지를 100%가 아니게 둔다) ── */
const UNMAPPED_ATTRS = new Set([
  '부도확률',
  '평가모형',
  '선순위금액',
  '공시지가',
  '조건부승인내용',
  '관리의무',
  '개정차수',
]);

/* ── 매핑되지 않은 관계 ── */
const UNMAPPED_RELATIONS = new Set(['bnk:GeunGeo_ChaekMu_JoHang', 'bnk:BaeBun_ChaekMu_JikChaek']);

function attrSource(cls: string, attr: string): { src: string | null; status: MappingSource; conf: number | null } {
  if (UNMAPPED_ATTRS.has(attr)) return { src: null, status: 'none', conf: null };
  const base = CLASS_SOURCE[cls];
  if (!base) return { src: null, status: 'none', conf: null };
  if (base.status === 'document') {
    return { src: `${base.src} → ${attr}`, status: 'document', conf: 0.9 };
  }
  // 정형은 컬럼까지 내려 잡는다 (가상 뷰 컬럼)
  return { src: `${base.src}.${romanize(attr)}`, status: base.status, conf: base.conf };
}

/** 한글 속성명을 가상 컬럼명으로 — 데모용 단순 규칙. */
function romanize(attr: string): string {
  const map: Record<string, string> = {
    고객번호: 'CUST_NO',
    고객명: 'CUST_NM',
    사업자번호: 'BIZ_REG_NO',
    업종코드: 'IND_CD',
    설립일자: 'ESTB_DT',
    거래기간: 'TXN_PERIOD',
    등급코드: 'GRADE_CD',
    평가일자: 'EVAL_DT',
    약정번호: 'AGMT_NO',
    약정금액: 'AGMT_AMT',
    실행잔액: 'EXEC_BAL',
    한도잔액: 'LIMIT_BAL',
    금리: 'INT_RATE',
    만기일자: 'MAT_DT',
    약정상태: 'AGMT_STAT',
    담보번호: 'COLL_NO',
    담보종류: 'COLL_TYPE',
    감정가액: 'APPR_AMT',
    설정금액: 'SETL_AMT',
    담보인정비율: 'LTV_RATE',
    소재지: 'ADDR',
    면적: 'AREA',
    심사번호: 'REVIEW_NO',
    심사일자: 'REVIEW_DT',
    심사결과: 'REVIEW_RSLT',
    심사점수: 'REVIEW_SCR',
    부결사유: 'REJECT_RSN',
    신청번호: 'APP_NO',
    신청금액: 'APP_AMT',
    신청일자: 'APP_DT',
    자금용도: 'FUND_PURP',
    상환방식: 'REPAY_TYPE',
    직책코드: 'POS_CD',
    직책명: 'POS_NM',
    결재순위: 'APPR_SEQ',
    조직코드: 'ORG_CD',
    조직명: 'ORG_NM',
    상위조직: 'PARENT_ORG',
  };
  return map[attr] ?? attr;
}

/** 전체 매핑 행 — 클래스 → 속성 → 관계 순. */
export const MAPPING_ROWS: MappingRow[] = [
  ...CLASSES.map<MappingRow>((c) => {
    const m = CLASS_SOURCE[c.name];
    return {
      kind: '클래스',
      target: c.name,
      uri: c.uri,
      source: m?.src ?? null,
      status: m?.status ?? 'none',
      confidence: m?.conf ?? null,
    };
  }),
  ...CLASSES.flatMap<MappingRow>((c) =>
    c.attrs.map((a) => {
      const m = attrSource(c.name, a);
      return {
        kind: '속성' as const,
        target: `${c.name} · ${a}`,
        uri: `${c.uri}#${a}`,
        source: m.src,
        status: m.status,
        confidence: m.conf,
      };
    }),
  ),
  ...RELATIONS.map<MappingRow>((r) => {
    const unmapped = UNMAPPED_RELATIONS.has(r.uri);
    return {
      kind: '관계',
      target: `${r.domain} —${r.name}→ ${r.range}`,
      uri: r.uri,
      source: unmapped ? null : `조인: ${CLASS_SOURCE[r.domain]?.src ?? '—'} ⋈ ${CLASS_SOURCE[r.range]?.src ?? '—'}`,
      status: unmapped ? 'none' : CLASS_SOURCE[r.domain]?.status === 'document' ? 'document' : 'auto',
      confidence: unmapped ? null : 0.96,
    };
  }),
];

export interface CoverageStat {
  label: string;
  sub: string;
  mapped: number;
  total: number;
  breakdown: { status: MappingSource; count: number }[];
}

function statOf(kind: MappingKind, label: string, sub: string): CoverageStat {
  const rows = MAPPING_ROWS.filter((r) => r.kind === kind);
  const by = (s: MappingSource) => rows.filter((r) => r.status === s).length;
  return {
    label,
    sub,
    mapped: rows.filter((r) => r.status !== 'none').length,
    total: rows.length,
    breakdown: [
      { status: 'auto', count: by('auto') },
      { status: 'manual', count: by('manual') },
      { status: 'document', count: by('document') },
      { status: 'none', count: by('none') },
    ],
  };
}

export const COVERAGE: CoverageStat[] = [
  statOf('클래스', '엔티티', 'CLASS'),
  statOf('속성', '속성', 'DATA'),
  statOf('관계', '관계', 'OBJECT'),
];

/** 실체화된 인스턴스 수 (A-Box). */
export const INSTANCE_COUNT = 148;
