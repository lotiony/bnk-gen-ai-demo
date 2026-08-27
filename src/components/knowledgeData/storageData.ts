export type FileRow = {
  id: string;
  name: string;
  ext: 'PDF' | 'DOCX' | 'HWPX' | 'XLSX' | 'CSV' | 'DOC' | 'PPT' | 'PPTX' | 'XLS' | 'PNG';
  sizeMB: number;
  pages?: number;
  updatedBy: string;
  updatedAt: string;
  defaultChecked?: boolean;
  isNew?: boolean;
  /** 그룹 식별자. 같은 group 안의 row끼리 펼침/접힘을 공유한다. */
  parentGroup?: string;
  /** 그룹 헤더(최신본)인 경우 true. */
  isGroupHead?: boolean;
  /** 헤더에만: 숨겨진 이전 버전 개수. */
  priorCount?: number;
  /** PDF가 스캔본(OCR 필요)인지 힌트. 파서 추천에 사용. */
  isScanned?: boolean;
};

export type FolderRow = {
  name: string;
  updatedBy: string;
  updatedAt: string;
  childCount?: number;
  /** 오픈데이터 — 이 과제뿐 아니라 모든 과제에서 공유되는 문서. */
  openData?: boolean;
};

export const FOLDER_ROWS: FolderRow[] = [
  { name: '규정 매뉴얼', updatedBy: '조현우', updatedAt: '2026-04-14', openData: true },
  { name: 'archive', updatedBy: '박서연', updatedAt: '2025-12-01', childCount: 14 },
];

/* ═══════════════════════ 외부 연동 소스 (EDA-003) ═══════════════════════ */

/**
 * RFP EDA-003 (필수): "외부 자회사 시스템에 분산된 비정형 데이터(파일 서버, NAS 등)를
 * 본 플랫폼과 안전하게 연동할 수 있는 표준 연동 방안 제시 (MCP 기반의 연동 인터페이스
 * 및 대안 방식 포함)"
 *
 * 업로드만이 아니다 — 계열사 파일서버·NAS·그룹웨어가 커넥터로 붙어
 * 동기화 주기에 따라 저장소로 들어온다. 유입 전 SEC-004 필터를 거친다.
 */
export type ExternalSourceState = '동기화 정상' | '동기화 중' | '연결 대기';

export interface ExternalSource {
  id: string;
  name: string;
  /** 연동 방식 — MCP 커넥터가 기본, 대안은 표준 프로토콜. */
  kind: 'MCP 커넥터' | 'SMB/NFS' | 'REST 수집기';
  /** 원천 위치. */
  origin: string;
  cycle: '실시간' | '일 1회' | '주 1회';
  docCount: number;
  lastSyncAt: string;
  state: ExternalSourceState;
}

export const EXTERNAL_SOURCES: ExternalSource[] = [
  {
    id: 'SRC-NAS-01', name: '부산은행 상품문서 NAS', kind: 'SMB/NFS',
    origin: 'nas-bs-01.bs.bnk.local/products', cycle: '일 1회',
    docCount: 1240, lastSyncAt: '오늘 04:00', state: '동기화 정상',
  },
  {
    id: 'SRC-GW-01', name: '그룹웨어 문서함 (부서 공유)', kind: 'MCP 커넥터',
    origin: 'mcp://groupware.bnk.local · docs.list', cycle: '실시간',
    docCount: 386, lastSyncAt: '5분 전', state: '동기화 정상',
  },
  {
    id: 'SRC-FS-02', name: '여신심사부 파일서버', kind: 'SMB/NFS',
    origin: 'fs-loan.bs.bnk.local/manual', cycle: '주 1회',
    docCount: 88, lastSyncAt: '2026-01-05 04:00', state: '동기화 중',
  },
  {
    id: 'SRC-EX-01', name: '보험 청구서식 수집기 (BNK캐피탈)', kind: 'REST 수집기',
    origin: 'https://api.capital.bnk.local/forms', cycle: '일 1회',
    docCount: 0, lastSyncAt: '—', state: '연결 대기',
  },
];

/** 폴더 안 파일 (폴더명 → 파일 목록). 공용 데이터 폴더는 읽기 전용. */
export const FOLDER_FILES: Record<string, FileRow[]> = {
  '규정 매뉴얼': [
    { id: 'reg-1', name: '금융소비자보호_내규.pdf', ext: 'PDF', sizeMB: 3.2, pages: 74, updatedBy: '준법지원부', updatedAt: '2026-04-14' },
    { id: 'reg-2', name: 'AI_윤리_가이드라인.pdf', ext: 'PDF', sizeMB: 1.8, pages: 42, updatedBy: '디지털혁신부', updatedAt: '2026-03-02' },
    { id: 'reg-3', name: '개인정보_처리방침.pdf', ext: 'PDF', sizeMB: 2.4, pages: 58, updatedBy: '정보보호부', updatedAt: '2026-02-18' },
    { id: 'reg-4', name: '전자금융거래_기본약관.pdf', ext: 'PDF', sizeMB: 1.1, pages: 26, updatedBy: '준법지원부', updatedAt: '2025-12-30' },
    { id: 'reg-5', name: '소비자보호_점검항목.csv', ext: 'CSV', sizeMB: 0.3, updatedBy: '준법지원부', updatedAt: '2026-04-10' },
    { id: 'reg-6', name: '내부통제_기준.doc', ext: 'DOC', sizeMB: 1.4, updatedBy: '준법지원부', updatedAt: '2026-03-20' },
    { id: 'reg-7', name: 'AI윤리_교육자료.pptx', ext: 'PPTX', sizeMB: 8.6, updatedBy: '디지털혁신부', updatedAt: '2026-03-05' },
    { id: 'reg-8', name: '컴플라이언스_교육.ppt', ext: 'PPT', sizeMB: 6.2, updatedBy: '준법지원부', updatedAt: '2025-11-12' },
    { id: 'reg-9', name: '리스크_점검표.xlsx', ext: 'XLSX', sizeMB: 0.9, updatedBy: '정보보호부', updatedAt: '2026-02-28' },
    { id: 'reg-10', name: '규정_개정이력.xls', ext: 'XLS', sizeMB: 0.7, updatedBy: '준법지원부', updatedAt: '2025-10-08' },
    { id: 'reg-11', name: '거버넌스_조직도.png', ext: 'PNG', sizeMB: 0.5, updatedBy: '디지털혁신부', updatedAt: '2026-01-15' },
  ],
  archive: Array.from({ length: 14 }, (_, i) => {
    const kinds = ['상품안내', '약관', 'FAQ', '매뉴얼', '정책', '보고서', '가이드'] as const;
    const exts = ['PDF', 'DOCX', 'HWPX', 'XLSX'] as const;
    const ext = exts[i % exts.length];
    return {
      id: `arch-${i}`,
      name: `${2023 + (i % 2)}_${kinds[i % kinds.length]}_구버전.${ext.toLowerCase()}`,
      ext,
      sizeMB: +(0.5 + (i % 6) * 0.8).toFixed(1),
      updatedBy: '박서연',
      updatedAt: `${2023 + (i % 2)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
    };
  }),
};

export const FILE_ROWS: FileRow[] = [
  {
    id: 'f-vp-manual-q1',
    name: '상품안내_매뉴얼.pdf',
    ext: 'PDF',
    sizeMB: 12.4,
    pages: 186,
    updatedBy: '조현우',
    updatedAt: '방금 전',
    defaultChecked: true,
    isNew: true,
    parentGroup: 'g1',
    isGroupHead: true,
    priorCount: 2,
  },
  {
    id: 'f-vp-manual-2025q4',
    name: '상품안내_매뉴얼.pdf',
    ext: 'PDF',
    sizeMB: 11.8,
    pages: 178,
    updatedBy: '윤지수',
    updatedAt: '2026-01-08',
    parentGroup: 'g1',
  },
  {
    id: 'f-vp-manual-2025q3',
    name: '상품안내_매뉴얼.pdf',
    ext: 'PDF',
    sizeMB: 10.4,
    pages: 162,
    updatedBy: '윤지수',
    updatedAt: '2025-10-14',
    parentGroup: 'g1',
  },
  {
    id: 'f-script-v32',
    name: 'PB_상담스크립트.docx',
    ext: 'DOCX',
    sizeMB: 2.1,
    pages: 38,
    updatedBy: '조현우',
    updatedAt: '방금 전',
    defaultChecked: true,
    isNew: true,
    parentGroup: 'g2',
    isGroupHead: true,
    priorCount: 1,
  },
  {
    id: 'f-script-v31',
    name: 'PB_상담스크립트.docx',
    ext: 'DOCX',
    sizeMB: 1.9,
    pages: 36,
    updatedBy: '박서연',
    updatedAt: '2025-08-22',
    parentGroup: 'g2',
  },
  {
    id: 'f-faq-2026',
    name: 'PB_상담FAQ_2026.hwpx',
    ext: 'HWPX',
    sizeMB: 1.4,
    pages: 22,
    updatedBy: '조현우',
    updatedAt: '방금 전',
    defaultChecked: true,
    isNew: true,
  },
  ...makeDummyFiles(),
];

/** 페이지네이션 확인용 더미 문서 47개 (표본 목업). */
function makeDummyFiles(): FileRow[] {
  const cats = [
    '펀드', '예금', '적금', 'ISA', '연금저축', 'IRP', '주택담보대출', '신용카드',
    '외환', '신탁', '방카슈랑스', '청약', '채권', 'MMF', 'ELS', 'DLS',
    '퇴직연금', '전세자금', '보증보험', '체크카드',
  ];
  const kinds = ['상품설명서', '약관', '가입안내', '상담가이드', 'FAQ', '핵심설명서', '판매절차', '유의사항'];
  const exts: FileRow['ext'][] = ['PDF', 'DOCX', 'HWPX', 'XLSX', 'PPTX'];
  const users = ['윤지수', '박서연', '조현우', '준법지원부', '정보보호부'];
  return Array.from({ length: 47 }, (_, i) => {
    const cat = cats[i % cats.length];
    const kind = kinds[Math.floor(i / cats.length) % kinds.length];
    const ext = exts[i % exts.length];
    const mm = String((i % 11) + 1).padStart(2, '0');
    const dd = String((i % 27) + 1).padStart(2, '0');
    return {
      id: `f-doc-${i}`,
      name: `${cat}_${kind}.${ext.toLowerCase()}`,
      ext,
      sizeMB: +(0.4 + (i % 9) * 1.3).toFixed(1),
      pages: ext === 'XLSX' ? undefined : 8 + (i % 40),
      updatedBy: users[i % users.length],
      updatedAt: `2026-${mm}-${dd}`,
    };
  });
}
