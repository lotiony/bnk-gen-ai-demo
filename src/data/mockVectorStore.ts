/**
 * Vector 저장소 mock — 관리 콘솔 화면 「Vector 저장소」.
 *
 * RFP: RAG-005 (필수 · 상세제안필요)
 *   "Vector DB 연동 기능을 제공해야 하며, 특정 제품에 종속되지 않아야 함
 *    (예: pgvector, Milvus, Chroma 등)"
 *   연계: 2-1 "계열사별 데이터 격리" · RAG-002(임베딩 유연성) · RAG-006(무중단 리인덱싱)
 *
 * 이 화면이 답해야 하는 질문은 세 가지다.
 *   ① **제품을 실제로 세 종류 다 붙일 수 있는가** — 커넥터 표에 버전·지원 범위까지 적는다.
 *   ② **계열사 데이터가 정말 섞이지 않는가** — 11개 Namespace 의 컬렉션을 한 표에 놓고
 *      격리 수준(전용 인스턴스 / 공유 인스턴스 내 DB 분리)을 행마다 밝힌다.
 *   ③ **나중에 제품을 바꿀 수 있는가** — 드라이버 인터페이스와 교체 절차를 그린다.
 *
 * ⚠️ 차원(dimension)은 `components/knowledgeData/embedData.ts` 의 EMBED_MODELS 와
 *    같은 값을 쓴다 — bge-m3-ko=1024 / aip-embed-finance=768. 두 화면이 다른 차원을
 *    말하면 그대로 리스크다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙). 제품 버전·건수는 예시 수치다.
 */
import { TENANTS, type Tenant } from './tenants';

/* ═══════════════════════ ① 지원 제품 · 커넥터 ═══════════════════════ */

export type ConnectorStatus = '운영 표준' | '운영 적용' | '검증 완료';

export interface VectorProduct {
  id: 'milvus' | 'pgvector' | 'chroma';
  name: string;
  version: string;
  /** 배포 형태 — 전량 공동존 On-Prem. 관리형 클라우드 서비스는 이 사업 범위 밖이다. */
  deploy: string;
  status: ConnectorStatus;
  /** 이 제품이 실제로 담고 있는 운영 컬렉션 수. */
  collections: number;
  /** 지원 인덱스 알고리즘. */
  indexTypes: string;
  /** 격리를 구현하는 제품 고유 단위. */
  isolationUnit: string;
  /** 어디에 쓰는가 — 선택 근거를 그대로 적는다. */
  role: string;
}

export const VECTOR_PRODUCTS: VectorProduct[] = [
  {
    id: 'milvus',
    name: 'Milvus',
    version: '2.4.x',
    deploy: '공동존 K8s · 분산 클러스터',
    status: '운영 표준',
    collections: 8,
    indexTypes: 'HNSW · IVF_FLAT · DiskANN',
    isolationUnit: 'Database + Partition Key + RBAC',
    role: '대용량 계열사 지식 인덱스 · 그룹 공통 에이전트 10종의 기본 저장소',
  },
  {
    id: 'pgvector',
    name: 'pgvector (PostgreSQL 확장)',
    version: '0.7.x / PostgreSQL 16',
    deploy: '공동존 K8s · 계열사 기존 PG 인스턴스 재사용',
    status: '운영 적용',
    collections: 3,
    indexTypes: 'HNSW · IVFFlat',
    isolationUnit: 'Database / Schema + Row Level Security',
    role: '규모가 작고 정형 데이터와 조인이 잦은 계열사 — 기존 DB 자산을 그대로 쓴다',
  },
  {
    id: 'chroma',
    name: 'Chroma',
    version: '0.5.x',
    deploy: '개발계(dev) 존 · 단일 노드',
    status: '검증 완료',
    collections: 0,
    indexTypes: 'HNSW',
    isolationUnit: 'Collection + Tenant/Database',
    role: '개발계 실험·PoC 전용. 커넥터는 회귀 테스트까지 통과했으나 운영 컬렉션은 아직 없다',
  },
];

/* ═══════════════════════ ② Namespace 별 컬렉션 ═══════════════════════ */

export type IsolationKind = '전용 인스턴스' | '공유 인스턴스 · DB 분리';

export interface VectorCollection {
  tenant: Tenant;
  namespace: string;
  /** 컬렉션(=인덱스 물리 단위) 이름. Namespace 접두사를 강제한다. */
  collection: string;
  product: VectorProduct['id'];
  /** 임베딩 모델 — EMBED_MODELS 와 같은 표기. */
  embedModel: string;
  dimension: number;
  indexType: string;
  metric: string;
  /** 적재 벡터 수. */
  vectors: number;
  isolation: IsolationKind;
  /** 격리 근거 한 줄 — 왜 이 계열사가 이 등급인지. */
  isolationNote: string;
}

/**
 * 격리 등급을 나눈 기준 —
 *   · **전용 인스턴스**: 규모가 크거나(은행 2사) 전 계열사가 함께 쓰는 그룹 공통 영역.
 *     장애·부하가 다른 계열사로 전이되지 않아야 한다.
 *   · **공유 인스턴스 · DB 분리**: 나머지. 하나의 클러스터 안에서 Database 단위로 나누고
 *     Namespace 서비스계정 RBAC 로 교차 조회를 차단한다.
 * 두 등급 모두 **컬렉션은 반드시 1 Namespace 1 컬렉션**이며 교차 검색 경로가 없다.
 */
export const VECTOR_COLLECTIONS: VectorCollection[] = [
  {
    tenant: '부산은행', namespace: 'ns-bank-bs', collection: 'bs_knowledge_v4',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=32)', metric: 'COSINE',
    vectors: 1284600, isolation: '전용 인스턴스',
    isolationNote: '그룹 최대 사용량 — 전용 클러스터로 부하 전이 차단',
  },
  {
    tenant: '경남은행', namespace: 'ns-bank-kn', collection: 'kn_knowledge_v3',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=32)', metric: 'COSINE',
    vectors: 861400, isolation: '전용 인스턴스',
    isolationNote: '은행 계정계 문서 포함 — 규제 관점에서 물리 분리',
  },
  {
    tenant: 'BNK캐피탈', namespace: 'ns-capital', collection: 'cp_knowledge_v2',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=16)', metric: 'COSINE',
    vectors: 214800, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: 'Milvus Database `db_capital` + 전용 서비스계정 RBAC',
  },
  {
    tenant: 'BNK투자증권', namespace: 'ns-securities', collection: 'sc_knowledge_v2',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=16)', metric: 'COSINE',
    vectors: 186300, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: 'Milvus Database `db_securities` + 전용 서비스계정 RBAC',
  },
  {
    tenant: 'BNK저축은행', namespace: 'ns-savings', collection: 'sv_knowledge_v1',
    product: 'pgvector', embedModel: 'aip-embed-finance', dimension: 768, indexType: 'HNSW(m=16)', metric: 'cosine',
    vectors: 42700, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: '기존 PostgreSQL 자산 재사용 — schema `sv_rag` + RLS',
  },
  {
    tenant: 'BNK자산운용', namespace: 'ns-am', collection: 'am_knowledge_v1',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=16)', metric: 'COSINE',
    vectors: 58900, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: 'Milvus Database `db_am` + 전용 서비스계정 RBAC',
  },
  {
    tenant: 'BNK벤처투자', namespace: 'ns-vc', collection: 'vc_knowledge_v1',
    product: 'pgvector', embedModel: 'aip-embed-finance', dimension: 768, indexType: 'IVFFlat(lists=100)', metric: 'cosine',
    vectors: 12400, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: '소규모 — schema `vc_rag` + RLS',
  },
  {
    tenant: 'BNK시스템', namespace: 'ns-system', collection: 'sys_knowledge_v2',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=16)', metric: 'COSINE',
    vectors: 96200, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: 'Milvus Database `db_system` + 전용 서비스계정 RBAC',
  },
  {
    tenant: 'BNK신용정보', namespace: 'ns-ci', collection: 'ci_knowledge_v1',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=16)', metric: 'COSINE',
    vectors: 33500, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: 'Milvus Database `db_ci` + 전용 서비스계정 RBAC',
  },
  {
    tenant: 'BNK엘앤에스', namespace: 'ns-lns', collection: 'lns_knowledge_v1',
    product: 'pgvector', embedModel: 'aip-embed-finance', dimension: 768, indexType: 'IVFFlat(lists=100)', metric: 'cosine',
    vectors: 8900, isolation: '공유 인스턴스 · DB 분리',
    isolationNote: '소규모 — schema `lns_rag` + RLS',
  },
  {
    tenant: '그룹 공통', namespace: 'ns-group-common', collection: 'grp_common_v5',
    product: 'milvus', embedModel: 'bge-m3-ko', dimension: 1024, indexType: 'HNSW(M=32)', metric: 'COSINE',
    vectors: 742100, isolation: '전용 인스턴스',
    isolationNote: '그룹 공동 사용 에이전트 10종(AGB-006)의 공용 지식 — 전 계열사가 읽는다',
  },
];

/** tenants.ts 의 11개와 어긋나면 화면에서 바로 드러나므로 여기서 한 번 맞춰 둔다. */
export const NAMESPACE_COUNT = TENANTS.length;

/* ═══════════════════════ ③ 추상화 계층 ═══════════════════════ */

/**
 * AX Suite Data(RAG) 모듈이 노출하는 저장소 인터페이스.
 * 상위(파이프라인·에이전트 런타임)는 이 6개 연산만 알고, 제품 이름을 모른다.
 */
export interface StoreOperation {
  sig: string;
  desc: string;
}

export const STORE_OPERATIONS: StoreOperation[] = [
  { sig: 'createCollection(ns, dim, metric, indexType)', desc: 'Namespace 컬렉션 생성 — 접두사·격리 정책은 여기서 강제' },
  { sig: 'upsert(ns, vectors[], payload[])', desc: '임베딩 적재 · 갱신 (청크 메타 포함)' },
  { sig: 'search(ns, queryVec, topK, filter)', desc: '유사도 검색 — ns 는 SSO 클레임에서 주입되며 호출자가 바꿀 수 없다' },
  { sig: 'deleteByFilter(ns, filter)', desc: '문서 폐기 · 보존기간 만료 삭제 (파기 이력 감사 기록)' },
  { sig: 'stats(ns)', desc: '벡터 수 · 용량 · 인덱스 상태 조회' },
  { sig: 'snapshot(ns) / restore(ns, snap)', desc: '제품 교체 · 무중단 리인덱싱(RAG-006) 시 사용' },
];

/** 드라이버별 기능 매트릭스 — ○ 지원 / △ 제한 / × 미지원. */
export interface DriverCapability {
  feature: string;
  milvus: '○' | '△' | '×';
  pgvector: '○' | '△' | '×';
  chroma: '○' | '△' | '×';
  /** 제한·미지원일 때 플랫폼이 어떻게 메우는지. */
  note: string;
}

export const DRIVER_MATRIX: DriverCapability[] = [
  { feature: 'HNSW 인덱스', milvus: '○', pgvector: '○', chroma: '○', note: '세 제품 모두 동일 파라미터로 추상화' },
  { feature: '메타데이터 필터 검색', milvus: '○', pgvector: '○', chroma: '○', note: '필터 DSL 을 드라이버가 각 제품 문법으로 번역' },
  { feature: '스칼라 · 벡터 혼합 조인', milvus: '△', pgvector: '○', chroma: '×', note: 'pgvector 만 SQL 조인 — 정형 결합이 잦은 계열사에 pgvector 를 배정한 이유' },
  { feature: 'BM25 하이브리드 검색', milvus: '○', pgvector: '△', chroma: '×', note: '미지원 제품은 OpenSearch BM25 와 애플리케이션 단 RRF 결합으로 동일 결과' },
  { feature: '파티션 · DB 단위 격리', milvus: '○', pgvector: '○', chroma: '△', note: 'Chroma 는 개발계 전용이라 격리 요건 대상이 아니다' },
  { feature: '스냅샷 · 복구', milvus: '○', pgvector: '○', chroma: '△', note: 'Chroma 는 파일 복사 방식 — 운영 미적용' },
];

/** 제품 교체 절차 — "바꿀 수 있다"를 절차로 보여 준다. */
export const SWAP_STEPS: { n: number; title: string; desc: string }[] = [
  { n: 1, title: '드라이버 전환', desc: '컬렉션 설정의 store.driver 값만 교체. 파이프라인·에이전트 코드는 그대로다' },
  { n: 2, title: '재적재', desc: '기존 임베딩을 그대로 snapshot → restore. 재임베딩(GPU 재소모) 없이 옮긴다' },
  { n: 3, title: '검색 품질 회귀', desc: '골든셋으로 Recall@10 · nDCG 를 이전 제품과 비교해 기준 미달이면 중단' },
  { n: 4, title: '별칭 스왑', desc: '무중단 리인덱싱(RAG-006)과 같은 별칭 전환으로 서비스 중단 없이 교체' },
];

/** 화면 하단 고지 — 제안 범위를 정확히 적는다. */
export const VECTOR_SCOPE_NOTE =
  '제품 선정은 요구사항 분석 단계에서 계열사별 데이터 규모·기존 DB 자산·운영 인력을 확인해 확정한다. ' +
  '세 제품 모두 동일한 드라이버 인터페이스 뒤에 있으므로 확정 시점이 늦어도 상위 구성에는 영향이 없다.';
