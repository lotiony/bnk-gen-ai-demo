export type CompKind = '커스텀 파서' | '커스텀 청커' | '커스텀 파이프라인';

export interface PipelineStep {
  stage: string; // 파서 / 청커 / 임베딩 / 인덱스
  ref: string; // 사용 컴포넌트·모델·인덱스
  detail: string;
}

export type CompDeployEnv = '개발계' | '운영계';
export type CompDeployStatus = '운영 중' | '이전' | '배포 중' | '실패';
export type CiStatus = 'passed' | 'running' | 'failed';

export interface CompCommit {
  sha: string;
  msg: string;
  by: string;
  at: string;
}
export interface CompDeploy {
  version: string;
  env: CompDeployEnv;
  commit: string;
  status: CompDeployStatus;
  at: string;
  by: string;
}

export interface CustomComponent {
  id: string;
  kind: CompKind;
  name: string;
  lang: string;
  desc: string;
  version: string;
  updatedAt: string;
  by: string;
  code: string;
  // GitLab 연동
  repo: string;
  path: string;
  branch: string;
  commit: CompCommit;
  ci: { stage: string; status: CiStatus }[];
  deploys: CompDeploy[];
  // 파서
  inputFormats?: string[];
  outputs?: string[];
  // 청커
  strategy?: string;
  chunkSize?: number;
  overlap?: number;
  sampleChunks?: string[];
  // 파이프라인
  steps?: PipelineStep[];
}

export const COMP_KIND_TONE: Record<CompKind, string> = {
  '커스텀 파서': 'text-info',
  '커스텀 청커': 'text-accent-purple',
  '커스텀 파이프라인': 'text-accent-brown',
};

export const COMP_KIND_BADGE: Record<CompKind, string> = {
  '커스텀 파서': 'bg-info-bg text-info border-info-border',
  '커스텀 청커': 'bg-accent-purple-bg text-accent-purple border-accent-purple',
  '커스텀 파이프라인': 'bg-accent-brown-bg text-accent-brown border-accent-brown',
};

export const CUSTOM_COMPONENTS: CustomComponent[] = [
  {
    id: 'CMP-101',
    kind: '커스텀 파서',
    name: '금감원 PDF 표 파서',
    lang: 'Python',
    desc: '표·서식 영역을 인식해 구조화 텍스트로 추출',
    version: 'v1.3',
    updatedAt: '2026-06-01',
    by: '김지우',
    inputFormats: ['PDF', 'HWP'],
    outputs: ['본문 텍스트', '표(마크다운)', '메타(페이지·제목)'],
    repo: 'git.aip.group.local/pb-agent/components',
    path: 'parsers/fss_pdf_table',
    branch: 'main',
    commit: { sha: 'a3f9c21', msg: 'fix: 병합 셀 표 추출 보정', by: '김지우', at: '2026-06-01 18:22' },
    ci: [
      { stage: 'build', status: 'passed' },
      { stage: 'test', status: 'passed' },
      { stage: 'deploy', status: 'passed' },
    ],
    deploys: [
      { version: 'v1.3', env: '운영계', commit: 'a3f9c21', status: '운영 중', at: '2026-06-01 18:40', by: '이도현' },
      { version: 'v1.3', env: '개발계', commit: 'a3f9c21', status: '운영 중', at: '2026-06-01 18:30', by: '김지우' },
      { version: 'v1.2', env: '운영계', commit: '7c1b0e4', status: '이전', at: '2026-05-25 11:10', by: '이도현' },
    ],
    code: `import pdfplumber

def parse(path: str) -> list[dict]:
    docs = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            tables = page.extract_tables()
            docs.append({
                "page": i + 1,
                "text": text,
                "tables": [to_markdown(t) for t in tables],
            })
    return docs`,
  },
  {
    id: 'CMP-102',
    kind: '커스텀 청커',
    name: '법령 조·항 단위 청커',
    lang: 'Python',
    desc: '법령 조/항 경계를 기준으로 분할 (조항 단위 검색 최적화)',
    version: 'v2.0',
    updatedAt: '2026-06-02',
    by: '박서연',
    strategy: '조·항 단위 (정규식 경계)',
    chunkSize: 800,
    overlap: 80,
    sampleChunks: [
      '제1조(목적) 이 규정은 보이스피싱 예방을 위한 상담 절차를 정함을 목적으로 한다.',
      '제2조(정의) 1. "보이스피싱"이란 전기통신금융사기를 말한다. 2. "의심거래"란 …',
      '제3조(상담 원칙) 상담원은 고객의 개인정보를 최소한으로 수집하며 …',
    ],
    repo: 'git.aip.group.local/pb-agent/components',
    path: 'chunkers/law_clause',
    branch: 'main',
    commit: { sha: 'e82d5f0', msg: 'feat: overlap 파라미터화', by: '박서연', at: '2026-06-02 14:05' },
    ci: [
      { stage: 'build', status: 'passed' },
      { stage: 'test', status: 'passed' },
      { stage: 'deploy', status: 'running' },
    ],
    deploys: [
      { version: 'v2.0', env: '개발계', commit: 'e82d5f0', status: '운영 중', at: '2026-06-02 14:20', by: '박서연' },
      { version: 'v2.0', env: '운영계', commit: 'e82d5f0', status: '배포 중', at: '방금', by: '이도현' },
      { version: 'v1.4', env: '운영계', commit: 'b1290aa', status: '이전', at: '2026-05-27 09:41', by: '이도현' },
    ],
    code: `import re

CLAUSE = re.compile(r"제\\d+조")

def chunk(text: str, size=800, overlap=80) -> list[str]:
    parts = CLAUSE.split(text)
    chunks, buf = [], ""
    for p in parts:
        if len(buf) + len(p) > size:
            chunks.append(buf)
            buf = buf[-overlap:]
        buf += p
    if buf:
        chunks.append(buf)
    return chunks`,
  },
  {
    id: 'CMP-103',
    kind: '커스텀 파이프라인',
    name: '규정검색 컴플라이언스',
    lang: 'YAML',
    desc: '파서 → 청커 → 임베딩 → 인덱스 구성',
    version: 'v1.1',
    updatedAt: '2026-06-03',
    by: '정오너',
    steps: [
      { stage: '파서', ref: 'CMP-101 · 금감원 PDF 표 파서', detail: 'PDF/HWP → 구조화 텍스트' },
      { stage: '청커', ref: 'CMP-102 · 법령 조·항 단위 청커', detail: 'size 800 · overlap 80' },
      { stage: '임베딩', ref: 'text-embedding-3-large', detail: '3072차원 · on-prem' },
      { stage: '인덱스', ref: '규정_검증_인덱스', detail: '하이브리드(BM25+벡터)' },
    ],
    repo: 'git.aip.group.local/pb-agent/components',
    path: 'pipelines/reg_compliance',
    branch: 'main',
    commit: { sha: 'f40ab99', msg: 'chore: 임베딩 모델 3-large 승격', by: '정오너', at: '2026-06-03 09:58' },
    ci: [
      { stage: 'build', status: 'passed' },
      { stage: 'test', status: 'passed' },
      { stage: 'deploy', status: 'passed' },
    ],
    deploys: [
      { version: 'v1.1', env: '개발계', commit: 'f40ab99', status: '운영 중', at: '2026-06-03 10:05', by: '정오너' },
      { version: 'v1.0', env: '개발계', commit: 'cc7712d', status: '이전', at: '2026-05-29 16:20', by: '정오너' },
    ],
    code: `name: 규정검색 컴플라이언스
parser:
  ref: CMP-101        # 금감원 PDF 표 파서
chunker:
  ref: CMP-102        # 법령 조·항 단위 청커
  size: 800
  overlap: 80
embedding:
  model: text-embedding-3-large
  dim: 3072
index:
  target: 규정_검증_인덱스
  retrieval: hybrid`,
  },
];

export function findComponent(id: string | undefined): CustomComponent | undefined {
  return CUSTOM_COMPONENTS.find((c) => c.id === id);
}
