/**
 * 온톨로지(T-Box) mock — 여신심사 + 전결권 도메인.
 *
 * RFP: RAG-007 Graph RAG(필수) · RAG-008 온톨로지 플랫폼 연계(권고·가점)
 *
 * 설계 의도 — 이 데모의 승부처는 "확률적 추측이 아니라 규칙과 계산으로 확정"을
 * 화면으로 증명하는 것이다(핸드오프 §1.3). 그러려면 한 질의에서
 *   ① 정형DB에서 확정되는 값(신용등급·담보평가액·한도잔액)과
 *   ② 비정형 규정에서 해석되는 근거(여신규정 조항·전결규정)가
 * 함께 걸려야 한다. 여신심사 단독도, 규정/책무 단독도 한쪽만 보여준다.
 * 그래서 두 축을 한 그래프에 묶었다.
 *
 * ⚠️ 전부 가상 데이터다. 실제 BNK 내규·고객 데이터가 아니다.
 */

export type NodeKind = 'class' | 'attr';

/** 클래스가 속한 축 — 그래프에서 색/배치를 가른다. */
export type Axis = 'credit' | 'rule';

export interface OntologyClass {
  /** 한글 표시명. */
  name: string;
  /** URI (로마자 표기). */
  uri: string;
  axis: Axis;
  /** 상위 클래스명 (없으면 null). */
  parent: string | null;
  /** 데이터 속성 목록. */
  attrs: string[];
  /** 레이아웃 열(0부터, 좌→우 계층 전개). */
  col: number;
  /** 레이아웃 행. */
  row: number;
}

export interface OntologyRelation {
  /** 관계명. */
  name: string;
  /** URI — 관계_도메인_레인지 규칙. */
  uri: string;
  domain: string;
  range: string;
}

/* ────────────────────────── 클래스 (T-Box) ────────────────────────── */

export const CLASSES: OntologyClass[] = [
  // ── 여신 축 (정형DB에서 실체화)
  {
    name: '고객',
    uri: 'bnk:GoGaek',
    axis: 'credit',
    parent: null,
    attrs: ['고객번호', '고객명', '사업자번호', '업종코드', '설립일자', '거래기간'],
    col: 0,
    row: 1,
  },
  {
    name: '신용등급',
    uri: 'bnk:SinYongDeungGeup',
    axis: 'credit',
    parent: null,
    attrs: ['등급코드', '평가일자', '부도확률', '평가모형'],
    col: 1,
    row: 0,
  },
  {
    name: '여신약정',
    uri: 'bnk:YeoSinYakJeong',
    axis: 'credit',
    parent: null,
    attrs: ['약정번호', '약정금액', '실행잔액', '한도잔액', '금리', '만기일자', '약정상태'],
    col: 1,
    row: 2,
  },
  {
    name: '담보',
    uri: 'bnk:DamBo',
    axis: 'credit',
    parent: null,
    attrs: ['담보번호', '담보종류', '감정가액', '설정금액', '담보인정비율', '선순위금액'],
    col: 2,
    row: 3,
  },
  {
    name: '부동산담보',
    uri: 'bnk:BuDongSanDamBo',
    axis: 'credit',
    parent: '담보',
    attrs: ['소재지', '면적', '공시지가'],
    col: 3,
    row: 4,
  },
  {
    name: '심사',
    uri: 'bnk:SimSa',
    axis: 'credit',
    parent: null,
    attrs: ['심사번호', '심사일자', '심사결과', '심사점수', '부결사유', '조건부승인내용'],
    col: 2,
    row: 1,
  },
  {
    name: '여신신청',
    uri: 'bnk:YeoSinSinCheong',
    axis: 'credit',
    parent: null,
    attrs: ['신청번호', '신청금액', '신청일자', '자금용도', '상환방식'],
    col: 1,
    row: 4,
  },

  // ── 규정/전결 축 (비정형 문서에서 실체화)
  {
    name: '규정',
    uri: 'bnk:GyuJeong',
    axis: 'rule',
    parent: null,
    attrs: ['규정번호', '규정명', '제정일자', '최종개정일자', '소관부서'],
    col: 3,
    row: 0,
  },
  {
    name: '조항',
    uri: 'bnk:JoHang',
    axis: 'rule',
    parent: null,
    attrs: ['조항번호', '조항제목', '조항본문', '시행일자', '개정차수'],
    col: 4,
    row: 1,
  },
  {
    name: '전결권',
    uri: 'bnk:JeonGyeolGwon',
    axis: 'rule',
    parent: null,
    attrs: ['전결구분', '금액하한', '금액상한', '위험등급조건', '적용시작일'],
    col: 5,
    row: 2,
  },
  {
    name: '직책',
    uri: 'bnk:JikChaek',
    axis: 'rule',
    parent: null,
    attrs: ['직책코드', '직책명', '결재순위'],
    col: 6,
    row: 2,
  },
  {
    name: '조직',
    uri: 'bnk:JoJik',
    axis: 'rule',
    parent: null,
    attrs: ['조직코드', '조직명', '상위조직'],
    col: 6,
    row: 4,
  },
  {
    name: '책무',
    uri: 'bnk:ChaekMu',
    axis: 'rule',
    parent: null,
    attrs: ['책무번호', '책무내용', '배분일자', '관리의무'],
    col: 5,
    row: 0,
  },
];

/* ────────────────────────── 관계 (Object Property) ────────────────────────── */

export const RELATIONS: OntologyRelation[] = [
  // 여신 축
  { name: '보유', uri: 'bnk:BoYu_GoGaek_YeoSinYakJeong', domain: '고객', range: '여신약정' },
  { name: '평가', uri: 'bnk:PyeongGa_GoGaek_SinYongDeungGeup', domain: '고객', range: '신용등급' },
  { name: '신청', uri: 'bnk:SinCheong_GoGaek_YeoSinSinCheong', domain: '고객', range: '여신신청' },
  { name: '제공', uri: 'bnk:JeGong_YeoSinYakJeong_DamBo', domain: '여신약정', range: '담보' },
  { name: '대상', uri: 'bnk:DaeSang_SimSa_YeoSinSinCheong', domain: '심사', range: '여신신청' },
  { name: '반영', uri: 'bnk:BanYeong_SimSa_SinYongDeungGeup', domain: '심사', range: '신용등급' },
  { name: '검토', uri: 'bnk:GeomTo_SimSa_DamBo', domain: '심사', range: '담보' },

  // 규정 축
  { name: '포함', uri: 'bnk:PoHam_GyuJeong_JoHang', domain: '규정', range: '조항' },
  { name: '규정', uri: 'bnk:GyuJeong_JoHang_JeonGyeolGwon', domain: '조항', range: '전결권' },
  { name: '귀속', uri: 'bnk:GwiSok_JeonGyeolGwon_JikChaek', domain: '전결권', range: '직책' },
  { name: '소속', uri: 'bnk:SoSok_JikChaek_JoJik', domain: '직책', range: '조직' },
  { name: '배분', uri: 'bnk:BaeBun_ChaekMu_JikChaek', domain: '책무', range: '직책' },
  { name: '근거', uri: 'bnk:GeunGeo_ChaekMu_JoHang', domain: '책무', range: '조항' },

  // ★ 두 축을 잇는 다리 — 이 관계가 있어야 "정형 + 비정형"이 한 답변에서 결합된다
  { name: '근거', uri: 'bnk:GeunGeo_SimSa_JoHang', domain: '심사', range: '조항' },
  { name: '적용', uri: 'bnk:JeokYong_YeoSinSinCheong_JeonGyeolGwon', domain: '여신신청', range: '전결권' },
];

/* ────────────────────────── 파생 통계 ────────────────────────── */

export const CLASS_COUNT = CLASSES.length;
export const ATTR_COUNT = CLASSES.reduce((a, c) => a + c.attrs.length, 0);
export const RELATION_COUNT = RELATIONS.length;

/** 연결 수 기준 허브 클래스 TOP 5 (그래프에서 강조). */
export const HUB_CLASSES: string[] = (() => {
  const deg = new Map<string, number>();
  for (const r of RELATIONS) {
    deg.set(r.domain, (deg.get(r.domain) ?? 0) + 1);
    deg.set(r.range, (deg.get(r.range) ?? 0) + 1);
  }
  return [...deg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n]) => n);
})();

/** 클래스별 연결 수 — 글로우 진하기에 사용. */
export function degreeOf(className: string): number {
  return RELATIONS.filter((r) => r.domain === className || r.range === className).length;
}

export function classByName(name: string): OntologyClass | undefined {
  return CLASSES.find((c) => c.name === name);
}
