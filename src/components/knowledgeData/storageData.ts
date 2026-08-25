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

/** 폴더 안 파일 (폴더명 → 파일 목록). 공용 데이터 폴더는 읽기 전용. */
export const FOLDER_FILES: Record<string, FileRow[]> = {
  '규정 매뉴얼': [
    { id: 'reg-1', name: '금융소비자보호_내규.pdf', ext: 'PDF', sizeMB: 3.2, pages: 74, updatedBy: '준법지원부', updatedAt: '2026-04-14' },
    { id: 'reg-2', name: 'AI_윤리_가이드라인.pdf', ext: 'PDF', sizeMB: 1.8, pages: 42, updatedBy: 'DT추진부', updatedAt: '2026-03-02' },
    { id: 'reg-3', name: '개인정보_처리방침.pdf', ext: 'PDF', sizeMB: 2.4, pages: 58, updatedBy: '정보보호부', updatedAt: '2026-02-18' },
    { id: 'reg-4', name: '전자금융거래_기본약관.pdf', ext: 'PDF', sizeMB: 1.1, pages: 26, updatedBy: '준법지원부', updatedAt: '2025-12-30' },
    { id: 'reg-5', name: '소비자보호_점검항목.csv', ext: 'CSV', sizeMB: 0.3, updatedBy: '준법지원부', updatedAt: '2026-04-10' },
    { id: 'reg-6', name: '내부통제_기준.doc', ext: 'DOC', sizeMB: 1.4, updatedBy: '준법지원부', updatedAt: '2026-03-20' },
    { id: 'reg-7', name: 'AI윤리_교육자료.pptx', ext: 'PPTX', sizeMB: 8.6, updatedBy: 'DT추진부', updatedAt: '2026-03-05' },
    { id: 'reg-8', name: '컴플라이언스_교육.ppt', ext: 'PPT', sizeMB: 6.2, updatedBy: '준법지원부', updatedAt: '2025-11-12' },
    { id: 'reg-9', name: '리스크_점검표.xlsx', ext: 'XLSX', sizeMB: 0.9, updatedBy: '정보보호부', updatedAt: '2026-02-28' },
    { id: 'reg-10', name: '규정_개정이력.xls', ext: 'XLS', sizeMB: 0.7, updatedBy: '준법지원부', updatedAt: '2025-10-08' },
    { id: 'reg-11', name: '거버넌스_조직도.png', ext: 'PNG', sizeMB: 0.5, updatedBy: 'DT추진부', updatedAt: '2026-01-15' },
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
