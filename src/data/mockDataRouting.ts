/**
 * 승인 기반 DB 동적 라우팅 mock — 핸드오프 §2 화면 9.
 *
 * RFP: LSM-009 · EDA-005 · SEC-006 · SEC-007 · ONM-003 (전부 "상세제안 필요" 16개에 포함)
 *   ⚠️ 요건 원문 제목은 이 저장소에 없다. 화면 문구는 핸드오프 §2 화면 9 서술만 근거로
 *      쓰고, ID 표기는 제안서 조견표와 대조 확인이 필요하다(핸드오프 §6-7).
 *
 * 설계 의도 — 핸드오프가 요구한 것은 "**2중** 승인 통제를 화면으로 대비"다.
 * 그래서 게이트를 둘로 나눠 **어느 하나만으로는 운영 데이터가 열리지 않게** 만든다.
 *   ① 배포 승인(승인권자 결재)   ② 동의 권원 확인(정보보호 그룹)
 * 둘 다 통과해야 운영 DB 복호화 경로가 열린다. 하나만 통과한 상태를 화면에서
 * 실제로 밟아볼 수 있어야 "2중"이 증명된다.
 *
 * 익명화 ≠ 마스킹 — 개발 DB는 "100% 익명화"(핸드오프)다. 별표로 가리는 게 아니라
 * 식별자는 가명 대체, 준식별자는 일반화, 불필요 항목은 삭제한다. 그래서
 * 비식별 컬럼(등급·상담요약)은 양쪽 값이 **같다**. 대비가 개인정보 항목에만
 * 정확히 걸려야 화면이 거짓말을 하지 않는다.
 *
 * 데이터 흐름 3분법(CLAUDE.md) 준수 —
 *   · 정형 운영 데이터 = 데이터 가상화 경유 조회(zero-copy, 물리적 이동 없음)
 *   · 개발 DB = 익명화 처리된 별도 복제본 (원본이 아니므로 이동 논점과 무관)
 *   비정형 임베딩 복제 적재는 이 화면의 범위가 아니다.
 *
 * ⚠️ 전부 가상 데이터다. 실제 BNK 고객 데이터·실제 계정·실제 내규가 아니다.
 */

/* ═══════════════════════ 승인 게이트 ═══════════════════════ */

export type GateId = 'draft' | 'deploy' | 'consent' | 'access';

export interface RoutingGate {
  id: GateId;
  seq: string;
  label: string;
  /** 결재·확인 주체. */
  actor: string;
  /** 대응 요건 ID (조견표 상호 참조용). */
  reqId: string;
  /** 한 줄 설명 — 이 관문이 무엇을 막는가. */
  desc: string;
}

export const ROUTING_GATES: RoutingGate[] = [
  {
    id: 'draft',
    seq: '1',
    label: '기안',
    actor: '정오너 · 2026-06-03 10:20',
    reqId: 'ONM-003',
    desc: '에이전트 운영 배포와 운영 데이터 접근을 함께 기안한다',
  },
  {
    id: 'deploy',
    seq: '2',
    label: '배포 승인',
    actor: '승인권자 · 이도현 (플랫폼 관리 그룹)',
    reqId: 'SEC-006',
    desc: '에이전트 상태를 Draft → Approved 로 전환한다',
  },
  {
    id: 'consent',
    seq: '3',
    label: '동의 권원 확인',
    actor: '정보보호 그룹 · 박거버',
    reqId: 'SEC-007',
    desc: '수집·이용 동의 권원과 처리 목적 합치를 확인한다',
  },
  {
    id: 'access',
    seq: '4',
    label: '운영 DB 복호화 접근',
    actor: '접근 정책 판정(PDP) 자동 적용',
    reqId: 'EDA-005',
    desc: '두 관문이 모두 통과해야 복호화 경로가 열린다',
  },
];

/* ═══════════════════════ 라우팅 대상 ═══════════════════════ */

export interface RoutingTarget {
  kind: 'dev' | 'prod';
  /** 패널 제목. */
  title: string;
  /** 에이전트 상태 라벨. */
  stateLabel: string;
  namespace: string;
  endpoint: string;
  /** 접속 계정 — 개발계/운영계 분리(DatabaseTaskPage 계정 규칙과 동일 체계). */
  account: string;
  /** 데이터 상태 한 줄. */
  dataState: string;
  /** 암호화·비식별 처리. */
  protection: string;
  /** 데이터 이동 성격 — 3분법 명시. */
  transfer: string;
}

export const ROUTING_TARGETS: Record<'dev' | 'prod', RoutingTarget> = {
  dev: {
    kind: 'dev',
    title: '개발 DB (개발계)',
    stateLabel: 'Draft',
    namespace: 'ns-bank-bs-dev',
    endpoint: 'consult-db-dev.aip.group.local:5432 / pb_consult',
    account: 'svc_pb_consult_ro_dev',
    dataState: '100% 익명화 처리 · 재식별 불가',
    protection: '가명 대체 + 준식별자 일반화 (k-익명성 k=5)',
    transfer: '익명화 복제본 — 원본 아님',
  },
  prod: {
    kind: 'prod',
    title: '운영 DB (운영계)',
    stateLabel: 'Approved',
    namespace: 'ns-bank-bs-prod',
    endpoint: 'consult-db.aip.group.local:5432 / pb_consult',
    account: 'svc_pb_consult_ro',
    dataState: '원본 · 컬럼 암호화 복호화 조회',
    protection: '컬럼 암호화(양방향) + TDE · 권원 확인 시에만 복호화',
    transfer: '데이터 가상화 경유(zero-copy) — 물리적 이동 없음',
  },
};

/* ═══════════════════════ 질의 · 결과 ═══════════════════════ */

/** 좌우 패널이 **동일하게** 실행하는 질의. 달라지는 것은 라우팅 대상뿐이다. */
export const ROUTING_QUERY = `SELECT c.customer_id, c.name, c.birth_date, c.phone, c.grade,
       l.consult_at, l.summary
  FROM consult_log l
  JOIN customer   c ON c.customer_id = l.customer_id
 WHERE l.consult_at >= '2026-05-01'
 ORDER BY l.consult_at DESC
 LIMIT 5;`;

export type AnonymizeKind = '가명 대체' | '일반화' | '삭제' | '원본 유지';

export interface RoutingColumn {
  key: string;
  label: string;
  /** 개인정보 항목 여부 — 좌우 대비의 대상. */
  pii: boolean;
  /** 개발 DB 익명화 처리 방식. */
  anonymize: AnonymizeKind;
  /** 운영 DB 저장 형태. */
  storage: '컬럼 암호화' | '평문';
  /** 표 열 폭 (px). 1920 기준 좌우 패널이 같은 폭을 쓴다. */
  w: number;
}

export const ROUTING_COLUMNS: RoutingColumn[] = [
  { key: 'customer_id', label: '고객ID', pii: true, anonymize: '가명 대체', storage: '컬럼 암호화', w: 96 },
  { key: 'name', label: '고객명', pii: true, anonymize: '가명 대체', storage: '컬럼 암호화', w: 72 },
  { key: 'birth_date', label: '생년월일', pii: true, anonymize: '일반화', storage: '컬럼 암호화', w: 94 },
  { key: 'phone', label: '연락처', pii: true, anonymize: '삭제', storage: '컬럼 암호화', w: 118 },
  { key: 'grade', label: '등급', pii: false, anonymize: '원본 유지', storage: '평문', w: 56 },
  { key: 'consult_at', label: '상담일시', pii: true, anonymize: '일반화', storage: '평문', w: 130 },
  { key: 'summary', label: '상담 요약', pii: false, anonymize: '원본 유지', storage: '평문', w: 0 },
];

export interface RoutingRow {
  /** 개발 DB(익명화) 값. */
  dev: Record<string, string>;
  /** 운영 DB(복호화) 값. */
  prod: Record<string, string>;
}

export const ROUTING_ROWS: RoutingRow[] = [
  {
    dev: {
      customer_id: 'PSN-4C81',
      name: '고객 A',
      birth_date: '1990년대',
      phone: '—',
      grade: '우수',
      consult_at: '2026-01',
      summary: '만기 예금 재예치 상담',
    },
    prod: {
      customer_id: 'CUST-88421',
      name: '홍서준',
      birth_date: '1991-05-23',
      phone: '010-3847-2910',
      grade: '우수',
      consult_at: '2026-06-01 14:22',
      summary: '만기 예금 재예치 상담',
    },
  },
  {
    dev: {
      customer_id: 'PSN-9A17',
      name: '고객 B',
      birth_date: '1980년대',
      phone: '—',
      grade: '일반',
      consult_at: '2026-01',
      summary: '주담대 중도상환수수료 문의',
    },
    prod: {
      customer_id: 'CUST-71934',
      name: '문지아',
      birth_date: '1984-11-02',
      phone: '010-2255-6108',
      grade: '일반',
      consult_at: '2026-06-01 11:47',
      summary: '주담대 중도상환수수료 문의',
    },
  },
  {
    dev: {
      customer_id: 'PSN-2F63',
      name: '고객 C',
      birth_date: '1970년대',
      phone: '—',
      grade: '최우수',
      consult_at: '2026-01',
      summary: 'ISA 만기 후 운용 상담',
    },
    prod: {
      customer_id: 'CUST-40275',
      name: '차윤호',
      birth_date: '1976-03-14',
      phone: '010-7712-3345',
      grade: '최우수',
      consult_at: '2026-05-31 16:03',
      summary: 'ISA 만기 후 운용 상담',
    },
  },
  {
    dev: {
      customer_id: 'PSN-8B02',
      name: '고객 D',
      birth_date: '1990년대',
      phone: '—',
      grade: '우수',
      consult_at: '2026-01',
      summary: '퇴직연금 IRP 이전 안내',
    },
    prod: {
      customer_id: 'CUST-93860',
      name: '임세라',
      birth_date: '1993-08-30',
      phone: '010-9034-4471',
      grade: '우수',
      consult_at: '2026-05-31 10:18',
      summary: '퇴직연금 IRP 이전 안내',
    },
  },
  {
    dev: {
      customer_id: 'PSN-5D49',
      name: '고객 E',
      birth_date: '1960년대',
      phone: '—',
      grade: '일반',
      consult_at: '2026-01',
      summary: '정기예금 중도해지 이자 문의',
    },
    prod: {
      customer_id: 'CUST-15508',
      name: '배동현',
      birth_date: '1962-12-07',
      phone: '010-4489-1620',
      grade: '일반',
      consult_at: '2026-05-30 15:31',
      summary: '정기예금 중도해지 이자 문의',
    },
  },
];

/* ═══════════════════════ 동의 권원 ═══════════════════════ */

export interface ConsentEvidence {
  k: string;
  v: string;
  /** 확인 통과 여부 — 하나라도 false 면 권원 확인이 성립하지 않는다. */
  ok: boolean;
}

/**
 * 동의 권원 확인 항목 — "승인이 났으니 열어준다" 가 아니라
 * "이 처리 목적에 대한 권원이 있으니 열어준다" 를 화면에 남긴다.
 */
export const CONSENT_EVIDENCE: ConsentEvidence[] = [
  { k: '수집·이용 동의', v: '상담 이력 활용 동의 (2025-09-05 취득)', ok: true },
  { k: '처리 목적 합치', v: '상담 품질 개선 · AI 응답 생성 — 동의 목적 범위 내', ok: true },
  { k: '보유·이용 기간', v: '동의일로부터 5년 (2030-09-04 까지)', ok: true },
  { k: '제3자 제공', v: '해당 없음 — 그룹 공동존 내부 처리', ok: true },
  { k: '동의 철회 대상', v: '조회 대상 5건 중 철회 0건', ok: true },
  { k: '재확인 기일', v: '2026-09-05 (연 1회)', ok: true },
];

/** 권원이 확인되지 않았을 때 우측 패널에 띄우는 미충족 사유. */
export const LOCK_REASONS: { gate: GateId; text: string }[] = [
  { gate: 'deploy', text: '배포 승인 미완료 — 에이전트가 Draft 상태입니다' },
  { gate: 'consent', text: '동의 권원 미확인 — 정보보호 그룹 확인이 필요합니다' },
];

/* ═══════════════════════ 감사 로그 (ONM-003) ═══════════════════════ */

export type AuditVerdict = 'allow' | 'deny' | 'anon';

export interface AuditRow {
  at: string;
  actor: string;
  action: string;
  target: string;
  verdict: AuditVerdict;
  note: string;
}

export const AUDIT_VERDICT_META: Record<AuditVerdict, { label: string; cls: string }> = {
  allow: { label: '허용', cls: 'bg-ok-bg text-ok border-ok-border' },
  deny: { label: '차단', cls: 'bg-bad-bg text-bad border-bad-border' },
  anon: { label: '익명화', cls: 'bg-info-bg text-info border-info-border' },
};

/** 화면 진입 시점의 기본 이력 — Draft 상태에서 이미 쌓여 있던 것. */
export const AUDIT_SEED: AuditRow[] = [
  {
    at: '2026-06-03 10:20',
    actor: '정오너',
    action: '운영 데이터 접근 기안',
    target: 'DRT-101',
    verdict: 'deny',
    note: '결재 진행 중 — 운영 DB 접근 보류',
  },
  {
    at: '2026-06-03 09:58',
    actor: 'svc_pb_consult_ro_dev',
    action: 'SELECT consult_log ⋈ customer',
    target: 'ns-bank-bs-dev',
    verdict: 'anon',
    note: '익명화 복제본 조회 · 5행 반환',
  },
  {
    at: '2026-06-02 17:41',
    actor: 'AGT-204 (Draft)',
    action: '운영 DB 접근 시도',
    target: 'ns-bank-bs-prod',
    verdict: 'deny',
    note: 'PDP 판정 — Draft 상태는 운영계 라우팅 불가',
  },
];

/** 게이트 통과에 따라 파생되는 감사 행 — 상태에서 계산하므로 중복 적재가 없다. */
export function deriveAuditRows(deployApproved: boolean, consentVerified: boolean): AuditRow[] {
  const rows: AuditRow[] = [];

  if (deployApproved) {
    rows.push({
      at: '2026-06-03 11:05',
      actor: '이도현 (승인권자)',
      action: '배포 승인 — Draft → Approved',
      target: 'AGT-204',
      verdict: 'allow',
      note: 'SEC-006 승인권자 결재 완료',
    });
  }
  if (deployApproved && !consentVerified) {
    rows.push({
      at: '2026-06-03 11:06',
      actor: 'AGT-204 (Approved)',
      action: '운영 DB 복호화 조회 시도',
      target: 'ns-bank-bs-prod',
      verdict: 'deny',
      note: 'PDP 판정 — 동의 권원 미확인 · 2중 통제 중 1건만 충족',
    });
  }
  if (consentVerified) {
    rows.push({
      at: '2026-06-03 11:12',
      actor: '박거버 (정보보호 그룹)',
      action: '동의 권원 확인 완료',
      target: '상담 이력 활용 동의 · 5건',
      verdict: 'allow',
      note: 'SEC-007 처리 목적 합치 확인',
    });
  }
  if (deployApproved && consentVerified) {
    rows.push({
      at: '2026-06-03 11:12',
      actor: 'svc_pb_consult_ro',
      action: 'SELECT consult_log ⋈ customer (복호화)',
      target: 'ns-bank-bs-prod',
      verdict: 'allow',
      note: '가상화 계층 경유 · 5행 반환 · 복호화 컬럼 4개',
    });
  }
  return rows;
}
