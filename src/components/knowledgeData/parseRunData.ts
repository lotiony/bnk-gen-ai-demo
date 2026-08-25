import type { FileRow } from './storageData';
import type { ParserId } from './parsers';

export type StageId = 'extract' | 'ocr' | 'table' | 'pii';
export type StageState = 'wait' | 'run' | 'done' | 'skip' | 'fail';
export type FileState = 'wait' | 'run' | 'done' | 'fail';

export interface StageStatus {
  id: StageId;
  state: StageState;
  /** 진행 중일 때 보일 페이지/청크 등 짧은 메타. */
  hint?: string;
}

export interface ExtractedBlock {
  page: number;
  /** H1/H2/P/표/리스트/이미지 등 라벨. */
  kind: string;
  text: string;
}

export interface ParseWarning {
  severity: 'warn' | 'fail';
  page?: number;
  message: string;
}

export type ChunkingStrategy = 'length' | 'semantic' | 'tableIsolated' | 'custom';
export type ImageHandling = 'skip' | 'caption' | 'keep';

export interface RunSettings {
  chunking: ChunkingStrategy;
  image: ImageHandling;
  tableToMd: boolean;
  pii: boolean;
  metaTag: boolean;
}

export interface FileRunStatus {
  id: string;
  name: string;
  ext: FileRow['ext'];
  sizeMB: number;
  pages: number;
  state: FileState;
  progress: number;
  stages: StageStatus[];
  chunks: number;
  warnings: ParseWarning[];
  blocks: ExtractedBlock[];
  /** 한 줄 요약 ("PII 마스킹 중", "p47 표 인식 실패" 등). */
  note?: string;
  /** 사용된 파서. */
  parserId: ParserId;
  /** 사용된 청킹/이미지/추가 옵션 — 결과에 고정되어 표시. */
  settings: RunSettings;
  /** 완료/실패 시각 라벨 (목업). */
  finishedAt?: string;
}

const DEFAULT_SETTINGS: RunSettings = {
  chunking: 'semantic',
  image: 'caption',
  tableToMd: true,
  pii: true,
  metaTag: true,
};

export const STAGE_LABELS: Record<StageId, { short: string; long: string }> = {
  extract: { short: '추출', long: '텍스트·블록 추출' },
  ocr: { short: 'OCR', long: 'OCR Fallback' },
  table: { short: '표', long: '표 → 마크다운' },
  pii: { short: 'PII', long: 'PII 사전 마스킹' },
};

/** 파일별 시뮬레이션 시나리오 — 진행 상태·청크 수·경고·요약 메타. blocks는 generator로 분리. */
const SCENARIOS: Record<
  string,
  Partial<Pick<FileRunStatus, 'state' | 'progress' | 'chunks' | 'warnings' | 'note'>> & {
    stages: StageStatus[];
  }
> = {
  'f-vp-manual-q1': {
    state: 'run',
    progress: 20,
    chunks: 264,
    stages: [
      { id: 'extract', state: 'done' },
      { id: 'ocr', state: 'done', hint: '34p 스캔' },
      { id: 'table', state: 'run', hint: '18표' },
      { id: 'pii', state: 'wait' },
    ],
    note: '표 → 마크다운 변환 중',
    warnings: [],
  },
  'f-script-v32': {
    state: 'done',
    progress: 100,
    chunks: 218,
    stages: [
      { id: 'extract', state: 'done' },
      { id: 'ocr', state: 'skip' },
      { id: 'table', state: 'done', hint: '4표' },
      { id: 'pii', state: 'done' },
    ],
    note: '완료 · 경고 없음',
    warnings: [],
  },
  'f-faq-2026': {
    state: 'fail',
    progress: 41,
    chunks: 0,
    stages: [
      { id: 'extract', state: 'done' },
      { id: 'ocr', state: 'done' },
      { id: 'table', state: 'fail', hint: 'p47' },
      { id: 'pii', state: 'wait' },
    ],
    note: 'p47 표 인식 실패 · 재시도 필요',
    warnings: [
      { severity: 'fail', page: 47, message: '표 셀 병합이 5단계 중첩 — 구조 추론 실패. 수동 검수 필요.' },
      { severity: 'warn', page: 18, message: '머리말이 본문과 동일한 폰트로 입력되어 자동 제거 실패.' },
    ],
  },
};

/* =================== 파서별 blocks generator =================== */

/** 파일별 도메인·섹션·표 토픽 — 파서가 어떻게 추출하든 내용은 이 컨텍스트 기반. */
interface FileCtx {
  domain: string;
  title: string;
  sections: { title: string; body: string; pagePos: number }[];
  tables: { title: string; shape: string; pagePos: number }[];
  lists: { title: string; items: string[]; pagePos: number }[];
}

function fileCtx(file: FileRow): FileCtx {
  const id = file.id;
  const pages = file.pages ?? 50;
  const p = (ratio: number) => Math.max(1, Math.round(pages * ratio));
  if (id.startsWith('f-vp-manual')) {
    const quarter = file.name.match(/(20\d{2}Q\d)/)?.[1] ?? '2026Q1';
    return {
      domain: '상품·시장 안내 매뉴얼',
      title: `상품·시장 안내 매뉴얼 — ${quarter}`,
      sections: [
        { title: '개정 요약', body: `본 매뉴얼은 ${quarter} 기준 신규 상품과 시장 전망을 갱신하였습니다. 예·적금·펀드 라인업 개편, 분기 시장 전망 반영, 고액 자산가 상담 가이드가 추가되었습니다.`, pagePos: p(0.02) },
        { title: '분기 시장 전망', body: '금리·환율·주요 자산군 전망을 분기별로 정리하였습니다. 전망은 상담 시점의 시장 상황에 따라 달라질 수 있어 최신본 확인이 필요합니다.', pagePos: p(0.08) },
        { title: '예·적금 상품 라인업', body: '우대금리 조건, 가입 자격, 만기·중도해지 규정을 상품별로 정리하였습니다. PB는 고객 자산 성향에 맞는 상품을 안내합니다.', pagePos: p(0.18) },
        { title: '펀드·투자 상품', body: '위험등급, 운용 전략, 과거 수익률 및 수수료 구조를 요약하였습니다. 투자성향 진단 결과에 부합하는 상품만 권유합니다.', pagePos: p(0.3) },
        { title: '세제·절세 안내', body: 'ISA·연금저축 등 절세 계좌의 한도·요건과 과세 이연 효과를 정리하였습니다.', pagePos: p(0.45) },
        { title: 'PB 상담 활용 가이드', body: '고객이 "어떤 상품이 저에게 맞나요"라고 물으면, 자산 성향·목표·기간을 확인한 뒤 매뉴얼의 적합 상품을 조회·요약해 답변 초안을 제공합니다.', pagePos: p(0.6) },
        { title: '상담 사례', body: `사례 — 은퇴 예정 고객 (${quarter.slice(0, 4)}-11): 안정형 자산 배분 문의. 연금저축·채권형 펀드 조합을 제시하고 세제 혜택을 함께 안내.`, pagePos: p(0.8) },
      ],
      tables: [
        { title: '분기 시장 전망 요약', shape: '8×5', pagePos: p(0.1) },
        { title: '상품군별 우대금리·수수료', shape: '10×4', pagePos: p(0.22) },
        { title: '위험등급별 상품 분포', shape: '8×4', pagePos: p(0.5) },
      ],
      lists: [
        {
          title: '상담 전 확인 5가지',
          items: ['고객 자산 성향', '투자 목표·기간', '기존 보유 상품', '세제 계좌 활용 여부', '위험 감내 수준'],
          pagePos: p(0.32),
        },
      ],
    };
  }
  if (id.startsWith('f-script')) {
    const ver = file.name.match(/v(\d+\.\d+)/)?.[1] ?? '3.0';
    return {
      domain: 'PB 상담 스크립트',
      title: `PB 상담 스크립트 v${ver}`,
      sections: [
        { title: '상담 원칙', body: '고객의 상담 목적과 자산 성향을 먼저 확인하고, 상품 권유 전 투자성향 진단 결과를 점검합니다. 근거 자료를 함께 제시합니다.', pagePos: p(0.05) },
        { title: '니즈 파악', body: '"안정적으로", "목돈 마련", "노후 준비" 등 고객 발화에서 상담 목적을 분류하고 적합 상품군으로 연결합니다.', pagePos: p(0.18) },
        { title: '상품 안내 멘트', body: '"고객님 성향에는 이 상품이 적합합니다. 우대금리 조건과 만기 규정은 이렇습니다"라며 매뉴얼 근거와 함께 설명합니다.', pagePos: p(0.4) },
        { title: '상담 종결', body: '권유 상품과 근거를 요약해 고객에게 재확인하고, 필요 시 상담 내용을 리포트 초안으로 정리합니다.', pagePos: p(0.6) },
        { title: 'FAQ', body: 'Q. 고객이 원금 손실을 우려할 때는? A. 위험등급과 과거 수익률을 설명하고, 안정형 대안 상품을 함께 제시합니다.', pagePos: p(0.85) },
      ],
      tables: [{ title: '상담 목적별 권유 상품', shape: '8×3', pagePos: p(0.28) }],
      lists: [
        {
          title: '상담 원칙 5가지',
          items: ['상담 목적 확인', '투자성향 진단 점검', '근거 자료 제시', '적합성 원칙 준수', '상담 내용 요약·기록'],
          pagePos: p(0.08),
        },
      ],
    };
  }
  // FAQ
  return {
    domain: 'PB 상담 FAQ',
    title: 'PB 상담 자주 묻는 질문 (FAQ) 2026',
    sections: [
      { title: 'Q1. 고객 성향에 맞는 상품은 어떻게 찾습니까?', body: '투자성향 진단 결과(안정형·중립형·공격형)와 상담 목적을 확인한 뒤, 매뉴얼의 적합 상품군에서 우대금리·위험등급 조건을 비교해 안내합니다.', pagePos: p(0.1) },
      { title: 'Q2. 예·적금과 펀드 중 무엇을 권해야 합니까?', body: '원금 보전이 우선이면 예·적금, 수익 추구·중장기 목표면 위험등급에 맞는 펀드를 제시합니다. 반드시 적합성 원칙을 확인합니다.', pagePos: p(0.3) },
      { title: 'Q3. 절세 상담은 어떻게 진행합니까?', body: 'ISA·연금저축의 납입 한도와 요건을 확인하고, 과세 이연·세액공제 효과를 고객 상황에 맞게 계산해 안내합니다.', pagePos: p(0.55) },
      { title: 'Q4. 시장 급변 시 상담 대응은?', body: '최신 분기 시장 전망본을 확인하고, 고객 자산 배분에 미치는 영향과 리밸런싱 필요 여부를 근거와 함께 설명합니다.', pagePos: p(0.8) },
    ],
    tables: [{ title: '상품군별 요약 비교표', shape: '6×3', pagePos: p(0.92) }],
    lists: [
      {
        title: '상담 전 확인 4가지',
        items: ['투자성향 진단 결과', '상담 목적·목표 기간', '기존 보유 상품', '세제 계좌 활용 여부'],
        pagePos: p(0.15),
      },
    ],
  };
}

/** 파서 종류별로 blocks를 다르게 추출. */
export function generateBlocks(file: FileRow, parserId: ParserId): ExtractedBlock[] {
  const ctx = fileCtx(file);
  switch (parserId) {
    case 'layout-pdf':
      return layoutPdfBlocks(ctx);
    case 'basic':
      return basicBlocks(ctx);
    case 'hwp':
      return hwpBlocks(ctx);
    case 'spreadsheet':
      return spreadsheetBlocks(ctx);
    default:
      return basicBlocks(ctx);
  }
}

/** Layout-aware PDF: 제목 계층·표·리스트·이미지가 풍부하게 보존. */
function layoutPdfBlocks(ctx: FileCtx): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  blocks.push({ page: 1, kind: 'H1', text: ctx.title });
  ctx.sections.forEach((s, i) => {
    blocks.push({ page: s.pagePos, kind: i === 0 ? 'H2' : i % 3 === 0 ? 'H2' : 'H3', text: `${i + 1}. ${s.title}` });
    blocks.push({ page: s.pagePos, kind: 'P', text: s.body });
  });
  ctx.tables.forEach((t) => {
    blocks.push({ page: t.pagePos, kind: '표', text: `${t.title} (${t.shape} 마크다운 변환 · 셀 병합 보존)` });
  });
  ctx.lists.forEach((l) => {
    blocks.push({
      page: l.pagePos,
      kind: '리스트',
      text: `${l.title}:\n${l.items.map((it, i) => `${i + 1}. ${it}`).join('\n')}`,
    });
  });
  // 이미지 캡션 1개
  blocks.push({ page: Math.round((ctx.sections[1]?.pagePos ?? 10)), kind: '이미지', text: '[그림 1] 상품 적합성 매칭 플로우 다이어그램 — Vision 캡션' });
  return blocks.sort((a, b) => a.page - b.page);
}

/** Basic: 제목 인식이 약함. 대부분 P, 표는 텍스트로 압축. 이미지는 무시. */
function basicBlocks(ctx: FileCtx): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  blocks.push({ page: 1, kind: 'P', text: `[제목] ${ctx.title}` });
  ctx.sections.forEach((s, i) => {
    // 가끔 H2로만 인식 (낮은 빈도)
    if (i % 4 === 0) {
      blocks.push({ page: s.pagePos, kind: 'H2', text: s.title });
    }
    blocks.push({ page: s.pagePos, kind: 'P', text: `${s.title}. ${s.body}` });
  });
  ctx.tables.forEach((t) => {
    blocks.push({ page: t.pagePos, kind: 'P', text: `[표] ${t.title} — 표 구조는 텍스트로 압축됨 (${t.shape})` });
  });
  ctx.lists.forEach((l) => {
    blocks.push({ page: l.pagePos, kind: 'P', text: `${l.title}: ${l.items.join(' · ')}` });
  });
  return blocks.sort((a, b) => a.page - b.page);
}

/** OCR: 모든 게 P로 인식. 표 구조 깨짐. 일부 오인식 글자. */
function ocrBlocks(ctx: FileCtx): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  // 첫 페이지 OCR — 큰 글자만 인식
  blocks.push({ page: 1, kind: 'P', text: `${ctx.title.replace(/[—-]/g, '–')}` });
  ctx.sections.forEach((s) => {
    // 가끔 오인식 (특수문자, 깨진 글자)
    const garbled = s.body.replace(/[".,]/g, (c) => (Math.random() < 0.15 ? '' : c));
    blocks.push({ page: s.pagePos, kind: 'P', text: `[${s.title}] ${garbled}` });
  });
  // 표는 인식 못 함 — 셀이 그냥 텍스트로 나열
  ctx.tables.forEach((t) => {
    blocks.push({ page: t.pagePos, kind: 'P', text: `${t.title} — 행1 행2 행3 ... (셀 구분 손실)` });
  });
  // 리스트는 항목 분리 안 됨
  ctx.lists.forEach((l) => {
    blocks.push({ page: l.pagePos, kind: 'P', text: `${l.title}: ${l.items.join(' ')}` });
  });
  return blocks.sort((a, b) => a.page - b.page);
}

/** HWP: 한글 문서 — 식·도표 보존. 표는 한글 헤더 유지. */
function hwpBlocks(ctx: FileCtx): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  blocks.push({ page: 1, kind: 'H1', text: ctx.title });
  ctx.sections.forEach((s, i) => {
    blocks.push({ page: s.pagePos, kind: 'H2', text: `제${i + 1}장 ${s.title}` });
    blocks.push({ page: s.pagePos, kind: 'P', text: s.body });
  });
  ctx.tables.forEach((t) => {
    blocks.push({ page: t.pagePos, kind: '표(한글)', text: `${t.title} — 한글 표 (${t.shape}) · 셀 병합·헤더 행 보존` });
  });
  ctx.lists.forEach((l) => {
    blocks.push({
      page: l.pagePos,
      kind: '리스트',
      text: `${l.title}:\n${l.items.map((it, i) => `(${i + 1}) ${it}`).join('\n')}`,
    });
  });
  // HWP만의 식·도표
  blocks.push({ page: Math.round(ctx.sections[0]?.pagePos ?? 2), kind: '수식', text: '회수율 = (회수금 / 총 피해금) × 100' });
  return blocks.sort((a, b) => a.page - b.page);
}

/** Spreadsheet: 시트별 블록 + 표. 텍스트 본문 없음. */
function spreadsheetBlocks(ctx: FileCtx): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  const sheetNames = ['요약', '사례 분류', '월별 통계', '연락처', '참고'];
  sheetNames.forEach((name, i) => {
    const page = i + 1;
    blocks.push({ page, kind: '시트', text: `[Sheet] ${name}` });
    // 시트 안 표 1개씩
    if (i < ctx.tables.length) {
      const t = ctx.tables[i];
      blocks.push({ page, kind: '표', text: `${name} 시트 · ${t.title} (${t.shape})` });
    } else {
      blocks.push({ page, kind: '표', text: `${name} 시트 · 데이터 (10×5)` });
    }
    // 일부 셀 코멘트
    if (i === 0) {
      blocks.push({ page, kind: '셀', text: 'A1: 분기 / B1: 발생 건수 / C1: 평균 피해액 / D1: 회수율 (헤더)' });
    }
  });
  return blocks;
}

/** ParseRunFile의 unique id — 같은 파일을 여러 파서로 돌렸을 때 별개로 누적되도록. */
export const makeRunId = (fileId: string, parserId: ParserId) => `${fileId}__${parserId}`;

export function buildInitialRun(
  targets: FileRow[],
  parserId: ParserId,
  settings: RunSettings = DEFAULT_SETTINGS,
): FileRunStatus[] {
  return targets.map((t) => {
    const scenario = SCENARIOS[t.id];
    // blocks는 파서에 맞춰 생성. 상태가 'wait'이면 빈 배열.
    const willHaveBlocks = scenario ? scenario.state !== 'wait' : false;
    const blocks = willHaveBlocks ? generateBlocks(t, parserId) : [];
    if (scenario) {
      return {
        id: makeRunId(t.id, parserId),
        name: t.name,
        ext: t.ext,
        sizeMB: t.sizeMB,
        pages: t.pages ?? 0,
        state: scenario.state ?? 'wait',
        progress: scenario.progress ?? 0,
        stages: scenario.stages,
        chunks: scenario.chunks ?? 0,
        warnings: scenario.warnings ?? [],
        blocks,
        note: scenario.note,
        parserId,
        settings,
      };
    }
    // 기본: 모두 대기 상태
    return {
      id: makeRunId(t.id, parserId),
      name: t.name,
      ext: t.ext,
      sizeMB: t.sizeMB,
      pages: t.pages ?? 0,
      state: 'wait',
      progress: 0,
      chunks: 0,
      warnings: [],
      blocks: [],
      stages: [
        { id: 'extract', state: 'wait' },
        { id: 'ocr', state: 'wait' },
        { id: 'table', state: 'wait' },
        { id: 'pii', state: 'wait' },
      ],
      parserId,
      settings,
    };
  });
}

/** 페이지 첫 진입 시 이미 완료/진행된 파싱 이력 — 데모용 mock.
 *  새 파싱을 시작하지 않아도 파싱 진행 탭에 이전 이력이 누적되어 보이도록. */
export function buildHistoryMock(): { files: FileRunStatus[]; startedAt: string } {
  const allDone: StageStatus[] = [
    { id: 'extract', state: 'done' },
    { id: 'ocr', state: 'skip' },
    { id: 'table', state: 'done' },
    { id: 'pii', state: 'done' },
  ];
  // 이력에 들어갈 파일 메타 (저장소의 FileRow와 동일)
  const items: {
    file: FileRow;
    parserId: ParserId;
    chunks: number;
    warnings: ParseWarning[];
    note: string;
    settings: RunSettings;
    finishedAt: string;
  }[] = [
    {
      file: { id: 'f-vp-manual-2025q4', name: '상품안내_매뉴얼.pdf', ext: 'PDF', sizeMB: 11.8, pages: 178, updatedBy: '윤지수', updatedAt: '2026-01-08' },
      parserId: 'layout-pdf',
      chunks: 1683,
      warnings: [],
      note: '완료 · 경고 없음',
      settings: { ...DEFAULT_SETTINGS },
      finishedAt: '2026-01-08 09:14',
    },
    {
      file: { id: 'f-vp-manual-2025q3', name: '상품안내_매뉴얼.pdf', ext: 'PDF', sizeMB: 10.4, pages: 162, updatedBy: '윤지수', updatedAt: '2025-10-14' },
      parserId: 'layout-pdf',
      chunks: 1524,
      warnings: [{ severity: 'warn', page: 88, message: '표 헤더 자동 추론 실패 — 수동 확인 권장 (8×4 표, 헤더 행 모호)' }],
      note: '완료 · 경고 1',
      settings: { ...DEFAULT_SETTINGS, image: 'skip' },
      finishedAt: '2025-10-14 11:32',
    },
    {
      file: { id: 'f-script-v31', name: 'PB_상담스크립트.docx', ext: 'DOCX', sizeMB: 1.9, pages: 36, updatedBy: '박서연', updatedAt: '2025-08-22' },
      parserId: 'basic',
      chunks: 208,
      warnings: [],
      note: '완료 · 경고 없음',
      settings: { ...DEFAULT_SETTINGS, chunking: 'length' },
      finishedAt: '2025-08-22 16:08',
    },
  ];
  const files: FileRunStatus[] = items.map((it) => ({
    id: makeRunId(it.file.id, it.parserId),
    name: it.file.name,
    ext: it.file.ext,
    sizeMB: it.file.sizeMB,
    pages: it.file.pages ?? 0,
    state: 'done',
    progress: 100,
    stages: allDone,
    chunks: it.chunks,
    warnings: it.warnings,
    blocks: generateBlocks(it.file, it.parserId),
    note: it.note,
    parserId: it.parserId,
    settings: it.settings,
    finishedAt: it.finishedAt,
  }));
  return { files, startedAt: '09:12' };
}

/** 단계 전환 임계값 (progress %). step 단계를 순서대로 진행. */
const STAGE_THRESHOLDS: { id: StageId; until: number }[] = [
  { id: 'extract', until: 25 },
  { id: 'ocr', until: 45 },
  { id: 'table', until: 70 },
  { id: 'pii', until: 100 },
];

function advanceStages(prev: StageStatus[], progress: number): { stages: StageStatus[]; note?: string } {
  let currentStage: StageId | null = null;
  const stages = prev.map((s) => {
    const threshold = STAGE_THRESHOLDS.find((t) => t.id === s.id)?.until ?? 100;
    if (progress >= threshold) {
      return s.state === 'run' || s.state === 'wait'
        ? { ...s, state: 'done' as StageState, hint: undefined }
        : s;
    }
    if (s.state === 'wait' || s.state === 'run') {
      if (!currentStage) {
        currentStage = s.id;
        return { ...s, state: 'run' as StageState, hint: `${progress}%` };
      }
    }
    return s;
  });
  const stageLabel = currentStage
    ? STAGE_LABELS[currentStage as StageId].long
    : undefined;
  return { stages, note: stageLabel ? `${stageLabel} 진행 중` : undefined };
}

/** 진행 중 파일(state=run) 한 건의 progress를 +step만큼 올리고, 100%면 done으로 전이. */
export function tickRun(prev: FileRunStatus[], step = 4): FileRunStatus[] {
  return prev.map((f) => {
    if (f.state !== 'run') return f;
    const next = Math.min(100, f.progress + step);
    if (next >= 100) {
      return {
        ...f,
        state: 'done',
        progress: 100,
        stages: f.stages.map((s) =>
          s.state === 'run' || s.state === 'wait' ? { ...s, state: 'done', hint: undefined } : s,
        ),
        note: '완료',
      };
    }
    // 청크 수도 진행률에 비례해 자연스럽게 증가 (목표치를 향해 진행)
    const targetChunks = 1840; // 데모 목표
    const chunksNow = Math.round((next / 100) * targetChunks);
    const adv = advanceStages(f.stages, next);
    return {
      ...f,
      progress: next,
      chunks: chunksNow,
      stages: adv.stages,
      note: adv.note ?? f.note,
    };
  });
}
