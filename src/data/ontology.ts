/**
 * 온톨로지 T-Box mock — 여신심사 + 전결권 도메인.
 *
 * RFP: RAG-007 Graph RAG(필수) · RAG-008 온톨로지 플랫폼 연계(권고·가점)
 *
 * 설계 의도 — 이 데모의 승부처는 "확률적 추측이 아니라 규칙과 계산으로 확정"을
 * 화면으로 증명하는 것이다(핸드오프 §1.3). 그러려면 한 질의에서
 *   ① 정형DB에서 확정되는 값(신용등급·담보평가액·한도잔액)과
 *   ② 비정형 규정에서 해석되는 근거(여신규정 조항·전결규정)가
 * 함께 걸려야 한다. 두 축을 한 그래프에 묶고, 축을 잇는 다리 관계를 둔다.
 *
 * ⚠️ 전부 가상 데이터다. 실제 BNK 내규·고객 데이터가 아니다.
 */

/** 클래스가 속한 축 — 그래프 배치와 색을 가른다. */
export type Axis = 'credit' | 'rule' | 'org';

export interface OntologyClass {
  name: string;
  /** URI (로마자 표기). */
  uri: string;
  axis: Axis;
  /** 상위 클래스명. */
  parent: string | null;
  /** 데이터 속성. */
  attrs: string[];
  /** idle 배치 좌표. */
  col: number;
  row: number;
}

export interface OntologyRelation {
  name: string;
  /** URI — 관계_도메인_레인지. */
  uri: string;
  domain: string;
  range: string;
}

/* ═══════════════════════ 클래스 (T-Box) ═══════════════════════ */

export const CLASSES: OntologyClass[] = [
  /* ── 여신 축 ── */
  { name: '고객', uri: 'bnk:GoGaek', axis: 'credit', parent: null, col: 0, row: 2,
    attrs: ['고객번호', '고객명', '사업자번호', '설립일자', '거래기간', '주거래여부'] },
  { name: '업종', uri: 'bnk:UpJong', axis: 'credit', parent: null, col: 0, row: 0,
    attrs: ['업종코드', '업종명', '업종위험도'] },
  { name: '재무제표', uri: 'bnk:JaeMuJePyo', axis: 'credit', parent: null, col: 1, row: 0,
    attrs: ['결산년도', '매출액', '영업이익', '당기순이익', '부채비율', '이자보상배율'] },
  { name: '신용등급', uri: 'bnk:SinYongDeungGeup', axis: 'credit', parent: null, col: 1, row: 1,
    attrs: ['등급코드', '평가일자', '부도확률', '평가모형', '등급변동'] },
  { name: '연체이력', uri: 'bnk:YeonCheIRyeok', axis: 'credit', parent: null, col: 1, row: 5,
    attrs: ['연체건수', '최장연체일수', '최종연체일자', '해소여부'] },
  { name: '여신신청', uri: 'bnk:YeoSinSinCheong', axis: 'credit', parent: null, col: 1, row: 3,
    attrs: ['신청번호', '신청금액', '신청일자', '자금용도', '상환방식', '희망만기'] },
  { name: '여신상품', uri: 'bnk:YeoSinSangPum', axis: 'credit', parent: null, col: 2, row: 5,
    attrs: ['상품코드', '상품명', '기준금리', '최대한도', '취급대상'] },
  { name: '여신약정', uri: 'bnk:YeoSinYakJeong', axis: 'credit', parent: null, col: 2, row: 2,
    attrs: ['약정번호', '약정금액', '실행잔액', '한도잔액', '금리', '만기일자', '약정상태'] },
  { name: '담보', uri: 'bnk:DamBo', axis: 'credit', parent: null, col: 3, row: 3,
    attrs: ['담보번호', '담보종류', '감정가액', '설정금액', '담보인정비율', '선순위금액'] },
  { name: '부동산담보', uri: 'bnk:BuDongSanDamBo', axis: 'credit', parent: '담보', col: 4, row: 4,
    attrs: ['소재지', '면적', '공시지가', '감정평가기관'] },
  { name: '예금담보', uri: 'bnk:YeGeumDamBo', axis: 'credit', parent: '담보', col: 4, row: 5,
    attrs: ['예금계좌번호', '예금잔액', '질권설정일'] },
  { name: '보증', uri: 'bnk:BoJeung', axis: 'credit', parent: null, col: 3, row: 5,
    attrs: ['보증기관', '보증비율', '보증금액', '보증서번호'] },
  { name: '심사', uri: 'bnk:SimSa', axis: 'credit', parent: null, col: 2, row: 1,
    attrs: ['심사번호', '심사일자', '심사결과', '심사점수', '부결사유', '조건부승인내용'] },
  { name: '심사역', uri: 'bnk:SimSaYeok', axis: 'credit', parent: null, col: 2, row: 0,
    attrs: ['사번', '성명', '심사등급', '전담업종'] },

  /* ── 규정 축 ── */
  { name: '규정', uri: 'bnk:GyuJeong', axis: 'rule', parent: null, col: 4, row: 0,
    attrs: ['규정번호', '규정명', '제정일자', '최종개정일자', '소관부서'] },
  { name: '조항', uri: 'bnk:JoHang', axis: 'rule', parent: null, col: 5, row: 1,
    attrs: ['조항번호', '조항제목', '조항본문', '시행일자', '개정차수'] },
  { name: '예외조항', uri: 'bnk:YeWoeJoHang', axis: 'rule', parent: '조항', col: 6, row: 0,
    attrs: ['예외사유', '승인요건'] },
  { name: '전결권', uri: 'bnk:JeonGyeolGwon', axis: 'rule', parent: null, col: 6, row: 2,
    attrs: ['전결구분', '금액하한', '금액상한', '위험등급조건', '신용공여포함', '적용시작일'] },
  { name: '여신협의회', uri: 'bnk:YeoSinHyeobUiHoe', axis: 'rule', parent: null, col: 6, row: 4,
    attrs: ['협의회구분', '개최주기', '의결정족수', '부의기준금액'] },
  { name: '책무', uri: 'bnk:ChaekMu', axis: 'rule', parent: null, col: 5, row: 5,
    attrs: ['책무번호', '책무내용', '배분일자', '관리의무'] },

  /* ── 조직 축 ── */
  { name: '직책', uri: 'bnk:JikChaek', axis: 'org', parent: null, col: 7, row: 2,
    attrs: ['직책코드', '직책명', '결재순위', '전결한도'] },
  { name: '조직', uri: 'bnk:JoJik', axis: 'org', parent: null, col: 7, row: 4,
    attrs: ['조직코드', '조직명', '상위조직', '조직구분'] },
];

/* ═══════════════════════ 관계 (Object Property) ═══════════════════════ */

export const RELATIONS: OntologyRelation[] = [
  /* 여신 축 */
  { name: '영위', uri: 'bnk:YeongWi_GoGaek_UpJong', domain: '고객', range: '업종' },
  { name: '제출', uri: 'bnk:JeChul_GoGaek_JaeMuJePyo', domain: '고객', range: '재무제표' },
  { name: '평가', uri: 'bnk:PyeongGa_GoGaek_SinYongDeungGeup', domain: '고객', range: '신용등급' },
  { name: '보유', uri: 'bnk:BoYu_GoGaek_YeoSinYakJeong', domain: '고객', range: '여신약정' },
  { name: '신청', uri: 'bnk:SinCheong_GoGaek_YeoSinSinCheong', domain: '고객', range: '여신신청' },
  { name: '보유', uri: 'bnk:BoYu_GoGaek_YeonCheIRyeok', domain: '고객', range: '연체이력' },
  { name: '산출근거', uri: 'bnk:SanChul_SinYongDeungGeup_JaeMuJePyo', domain: '신용등급', range: '재무제표' },
  { name: '반영', uri: 'bnk:BanYeong_SinYongDeungGeup_YeonCheIRyeok', domain: '신용등급', range: '연체이력' },
  { name: '적용상품', uri: 'bnk:JeokYong_YeoSinSinCheong_YeoSinSangPum', domain: '여신신청', range: '여신상품' },
  { name: '제공', uri: 'bnk:JeGong_YeoSinYakJeong_DamBo', domain: '여신약정', range: '담보' },
  { name: '보강', uri: 'bnk:BoGang_YeoSinYakJeong_BoJeung', domain: '여신약정', range: '보증' },
  { name: '대상', uri: 'bnk:DaeSang_SimSa_YeoSinSinCheong', domain: '심사', range: '여신신청' },
  { name: '반영', uri: 'bnk:BanYeong_SimSa_SinYongDeungGeup', domain: '심사', range: '신용등급' },
  { name: '검토', uri: 'bnk:GeomTo_SimSa_DamBo', domain: '심사', range: '담보' },
  { name: '담당', uri: 'bnk:DamDang_SimSaYeok_SimSa', domain: '심사역', range: '심사' },

  /* 규정 축 */
  { name: '포함', uri: 'bnk:PoHam_GyuJeong_JoHang', domain: '규정', range: '조항' },
  { name: '단서', uri: 'bnk:DanSeo_JoHang_YeWoeJoHang', domain: '조항', range: '예외조항' },
  { name: '규정', uri: 'bnk:GyuJeong_JoHang_JeonGyeolGwon', domain: '조항', range: '전결권' },
  { name: '부의', uri: 'bnk:BuUi_JeonGyeolGwon_YeoSinHyeobUiHoe', domain: '전결권', range: '여신협의회' },
  { name: '근거', uri: 'bnk:GeunGeo_ChaekMu_JoHang', domain: '책무', range: '조항' },

  /* 조직 축 */
  { name: '귀속', uri: 'bnk:GwiSok_JeonGyeolGwon_JikChaek', domain: '전결권', range: '직책' },
  { name: '소속', uri: 'bnk:SoSok_JikChaek_JoJik', domain: '직책', range: '조직' },
  { name: '배분', uri: 'bnk:BaeBun_ChaekMu_JikChaek', domain: '책무', range: '직책' },
  { name: '소속', uri: 'bnk:SoSok_SimSaYeok_JoJik', domain: '심사역', range: '조직' },

  /* ★ 축을 잇는 다리 — 정형과 비정형이 한 답변에서 만나는 지점 */
  { name: '근거', uri: 'bnk:GeunGeo_SimSa_JoHang', domain: '심사', range: '조항' },
  { name: '적용', uri: 'bnk:JeokYong_YeoSinSinCheong_JeonGyeolGwon', domain: '여신신청', range: '전결권' },
  { name: '준거', uri: 'bnk:JunGeo_DamBo_JoHang', domain: '담보', range: '조항' },
];

/* ═══════════════════════ 파생 ═══════════════════════ */

export const CLASS_COUNT = CLASSES.length;
export const ATTR_COUNT = CLASSES.reduce((a, c) => a + c.attrs.length, 0);
export const RELATION_COUNT = RELATIONS.length;

const DEG = (() => {
  const m = new Map<string, number>();
  for (const r of RELATIONS) {
    m.set(r.domain, (m.get(r.domain) ?? 0) + 1);
    m.set(r.range, (m.get(r.range) ?? 0) + 1);
  }
  return m;
})();

export function degreeOf(name: string): number {
  return DEG.get(name) ?? 0;
}

/** 연결 수 기준 허브 TOP 5. */
export const HUB_CLASSES: string[] = [...DEG.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([n]) => n);

export function classByName(name: string): OntologyClass | undefined {
  return CLASSES.find((c) => c.name === name);
}

export function relationsOf(name: string): OntologyRelation[] {
  return RELATIONS.filter((r) => r.domain === name || r.range === name);
}
