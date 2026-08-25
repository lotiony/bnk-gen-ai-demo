import type { FileRow } from './storageData';

export type ParserId = 'basic' | 'layout-pdf' | 'custom-pdf' | 'hwp' | 'spreadsheet' | 'pptx';
export type Compat = 'best' | 'ok' | 'no';

export interface ParserDef {
  id: ParserId;
  name: string;
  short: string;
  desc: string;
  /** 페이지당 평균 처리 시간 (초). 추정 표시용. */
  secPerPage: number;
  version: string;
}

export const PARSERS: ParserDef[] = [
  {
    id: 'basic',
    name: 'DOCX 파서',
    short: 'DOCX 파서',
    desc: 'Word·PPT·일반 텍스트 문서 전용 · 빠름 (1.2초/p)',
    secPerPage: 1.2,
    version: '1.8.3',
  },
  {
    id: 'layout-pdf',
    name: 'PDF 파서',
    short: 'PDF 파서',
    desc: '열·표·제목 계층을 보존하는 PDF 전용 추출',
    secPerPage: 3.4,
    version: '2.4.1',
  },
  {
    id: 'custom-pdf',
    name: '커스텀 PDF 파서',
    short: '커스텀 PDF 파서',
    desc: '사용자 등록 커스텀 PDF 파서 · 사내 규칙 반영',
    secPerPage: 3.0,
    version: '1.0.0',
  },
  {
    id: 'hwp',
    name: 'HWPX 파서',
    short: 'HWPX 파서',
    desc: '한글(HWP/HWPX) 전용 — 식·도표 보존',
    secPerPage: 2.6,
    version: '1.3.0',
  },
  {
    id: 'spreadsheet',
    name: 'XLSX 파서',
    short: 'XLSX 파서',
    desc: 'XLSX·CSV 전용 — 시트·수식 구조화',
    secPerPage: 0.4,
    version: '1.1.2',
  },
  {
    id: 'pptx',
    name: 'PPTX 파서',
    short: 'PPTX 파서',
    desc: 'PPT·PPTX 전용 — 슬라이드·도형·표 텍스트 추출',
    secPerPage: 1.6,
    version: '1.0.0',
  },
];

export function getParser(id: ParserId): ParserDef {
  return PARSERS.find((p) => p.id === id) ?? PARSERS[0];
}

/** 확장자 + 메타(스캔 여부)로 형식 전용 파서 호환성 계산. 각 형식은 전용 파서만 호환. */
export function compatFor(file: FileRow, parser: ParserId): Compat {
  const ext = file.ext;
  const scanned = file.isScanned === true;

  switch (ext) {
    case 'PDF':
      if (parser === 'layout-pdf') return 'best';
      if (parser === 'custom-pdf') return 'ok';
      return 'no';
    case 'DOCX':
    case 'DOC':
      return parser === 'basic' ? 'best' : 'no';
    case 'PPT':
    case 'PPTX':
      return parser === 'pptx' ? 'best' : 'no';
    case 'HWPX':
      return parser === 'hwp' ? 'best' : 'no';
    case 'XLSX':
    case 'XLS':
    case 'CSV':
      return parser === 'spreadsheet' ? 'best' : 'no';
    case 'PNG':
      return parser === 'layout-pdf' ? 'best' : 'no';
    default:
      return parser === 'basic' ? 'best' : 'no';
  }
}

/** 이 파일에서 선택 가능한 전용 파서들 — 비호환은 제외, 추천(best) 우선 정렬. */
export function parsersFor(file: FileRow): ParserDef[] {
  const rank = (c: Compat) => (c === 'best' ? 0 : c === 'ok' ? 1 : 2);
  return PARSERS.filter((p) => compatFor(file, p.id) !== 'no').sort(
    (a, b) => rank(compatFor(file, a.id)) - rank(compatFor(file, b.id)),
  );
}

/** 파일에 대한 추천 파서. compatFor에서 'best' 등급인 첫 파서. */
export function recommendedParser(file: FileRow): ParserId {
  const best = PARSERS.find((p) => compatFor(file, p.id) === 'best');
  return best?.id ?? 'basic';
}

/** 추천 이유 — 사용자에게 표시할 한 줄 카피. */
export function recommendationReason(file: FileRow): string {
  const ext = file.ext;
  const scanned = file.isScanned === true;
  if (ext === 'PDF') {
    return scanned
      ? '스캔 PDF로 감지됨 — 레이아웃 파서로 처리합니다'
      : '레이아웃·표 구조를 보존해야 하는 PDF입니다';
  }
  if (ext === 'DOCX') return '구조화된 워드 문서 — Basic Text로 빠르게 처리합니다';
  if (ext === 'HWPX') return '한글(HWPX) 전용 — 식·도표가 깨지지 않습니다';
  if (ext === 'XLSX') return '스프레드시트 — 시트·수식을 구조화합니다';
  return '파일 형식 기본값입니다';
}
