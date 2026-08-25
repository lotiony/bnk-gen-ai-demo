import { forwardRef, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';
import { getEmbedModel, type IndexKind, type IndexWithVersions } from './embedData';
import {
  addDeployApproval,
  cancelDeployApproval,
  nextDeployVersion,
  useDeployApprovals,
  type DeployApproval,
  type QueryType,
  type SearchConfig,
  type VectorAlgo,
} from '@/lib/deployApprovalStore';

const QUERY_TYPE_LABEL: Record<QueryType, string> = {
  keyword: '키워드',
  vector: '벡터',
  hybrid: '하이브리드',
};
const VECTOR_ALGO_LABEL: Record<VectorAlgo, string> = { hnsw: 'HNSW', knn: 'Exhaustive KNN' };

/** 결재/배포 상태 → 배지. (ApprovalItem state 기준) */
const STATE_PILL: Record<string, { className: string; label: string }> = {
  pending: { className: 'bg-warn-bg text-warn border-warn-border', label: '승인 대기' },
  done: { className: 'bg-ok-bg text-ok border-ok-border', label: '배포 완료' },
  rejected: { className: 'bg-bad-bg text-bad border-bad-border', label: '반려' },
};

export interface RagApi {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  indexIds: string[];
  indexVersions: Record<string, string>;
  search: SearchConfig;
  status: 'active' | 'paused';
  createdAt: string;
  callsToday: number;
}

interface Props {
  indexes: IndexWithVersions[];
}

const INDEX_KIND_LABEL: Record<IndexKind, string> = {
  hybrid: '하이브리드',
  vector: '벡터 전용',
  bm25: 'BM25',
};

const randKey = () => `kb-rag-sk-${Math.random().toString(16).slice(2, 18).padEnd(16, '0')}`;
const mask = (key: string) => `${key.slice(0, 10)}${'•'.repeat(8)}${key.slice(-4)}`;
const nowLabel = () =>
  new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** 검색 구성 한 줄 요약. */
export function SearchSummary({ s }: { s: SearchConfig }) {
  return (
    <>
      <span>쿼리 <b className="text-ink-dark">{QUERY_TYPE_LABEL[s.queryType]}</b></span>
      <span className="text-ink-light">·</span>
      <span>시맨틱 랭커 <b className="text-ink-dark">{s.semanticRanker ? 'ON' : 'OFF'}</b></span>
      {s.queryType !== 'keyword' && (
        <>
          <span className="text-ink-light">·</span>
          <span>벡터 <b className="text-ink-dark">{VECTOR_ALGO_LABEL[s.vectorAlgo]}</b></span>
        </>
      )}
      <span className="text-ink-light">·</span>
      <span>Top <b className="text-ink-dark">{s.topK}</b></span>
      {s.captions && (
        <>
          <span className="text-ink-light">·</span>
          <span>캡션 <b className="text-ink-dark">ON</b></span>
        </>
      )}
    </>
  );
}

function buildApiMock(): RagApi {
  return {
    id: 'api-pb-7m2k',
    name: '지식 검색 API',
    endpoint: 'https://kb-genai-dev.search.windows.net/indexes/pb-consult/docs/search',
    apiKey: 'kb-rag-sk-3f9a2b7c1d4e88a1',
    indexIds: ['idx-vp-call-7m2k'],
    indexVersions: { 'idx-vp-call-7m2k': 'v4' },
    search: { queryType: 'hybrid', semanticRanker: true, vectorAlgo: 'hnsw', topK: 5, captions: true },
    status: 'active',
    createdAt: '2026-01-08 10:12',
    callsToday: 1284,
  };
}

/** 학습계(RAG API) 탭 — 검색 API 발급·관리, 서빙계 배포 신청은 결재함으로 연동. */
const RagApiSection = forwardRef<HTMLElement, Props>(function RagApiSection({ indexes }, ref) {
  const [api, setApi] = useState<RagApi | null>(() => buildApiMock());
  const [modalOpen, setModalOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showDeploys, setShowDeploys] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [testQuery, setTestQuery] = useState('ISA 계좌 납입한도 알려줘');
  const [testResult, setTestResult] = useState<{ latencyMs: number; count: number } | null>(null);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const deploys = useDeployApprovals().filter((d) => d.category === 'train');
  const latestDeployed = deploys.find((d) => d.state === 'done');
  const pending = deploys.some((d) => d.state === 'pending');

  const indexById = useMemo(() => {
    const m = new Map<string, IndexWithVersions>();
    indexes.forEach((i) => m.set(i.indexId, i));
    return m;
  }, [indexes]);

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  };

  const toggleStatus = () =>
    setApi((cur) => (cur ? { ...cur, status: cur.status === 'active' ? 'paused' : 'active' } : cur));

  const rotateKey = () => setApi((cur) => (cur ? { ...cur, apiKey: randKey() } : cur));

  /** 배포 신청 — 학습계 설정 반영 + 결재함에 서빙계 배포 결재 생성(승인 대기). */
  const submitDeployRequest = (payload: {
    name: string;
    indexIds: string[];
    indexVersions: Record<string, string>;
    search: SearchConfig;
  }) => {
    setApi((cur) => {
      if (cur) {
        return {
          ...cur,
          name: payload.name,
          indexIds: payload.indexIds,
          indexVersions: payload.indexVersions,
          search: payload.search,
        };
      }
      const slug = `idx-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: `api-${Date.now()}`,
        name: payload.name,
        endpoint: `https://kb-genai-dev.search.windows.net/indexes/${slug}/docs/search`,
        apiKey: randKey(),
        indexIds: payload.indexIds,
        indexVersions: payload.indexVersions,
        search: payload.search,
        status: 'active',
        createdAt: nowLabel(),
        callsToday: 0,
      };
    });
    const ver = nextDeployVersion();
    const sources = payload.indexIds.map((id) => {
      const idx = indexById.get(id);
      const v = idx?.versions.find((x) => x.version === payload.indexVersions[id]) ?? idx?.versions[0];
      return {
        name: idx?.indexName ?? id,
        version: payload.indexVersions[id],
        model: v ? getEmbedModel(v.modelId).short : '',
      };
    });
    addDeployApproval({
      id: `APV-DEP-${Date.now()}`,
      category: 'train',
      title: `${payload.name} 학습계 배포 (${ver})`,
      projectName: 'PB 에이전트 프로젝트',
      draftedBy: '정오너',
      draftedAt: nowLabel(),
      stage: { current: 0, total: 1, label: '프로젝트 오너 그룹 결재' },
      state: 'pending',
      mine: true,
      apiName: payload.name,
      apiId: api?.id ?? 'api-pb-7m2k',
      endpoint: api?.endpoint ?? '',
      datasetName: '상품·시장 안내 매뉴얼',
      version: ver,
      sources,
      search: payload.search,
    });
    setShowDeploys(true);
    setModalOpen(false);
  };

  const active = api?.status === 'active';
  const sources = api
    ? (api.indexIds.map((id) => indexById.get(id)).filter(Boolean) as IndexWithVersions[])
    : [];

  const runTest = () => {
    if (!api) return;
    // 실제로는 Azure AI Search 호출. 여기서는 응답 요약만 표시.
    setTestResult({ latencyMs: 240 + (testQuery.length % 7) * 18, count: api.search.topK });
  };

  /** cURL 사용 예시 — 현재 검색 구성 반영. */
  const buildCurl = () => {
    if (!api) return '';
    const s = api.search;
    const body: Record<string, unknown> = { search: testQuery || '검색어', top: s.topK };
    if (s.queryType === 'keyword') {
      body.queryType = 'simple';
    } else {
      body.vectorQueries = [{ kind: 'text', text: testQuery || '검색어', fields: 'contentVector', k: s.topK }];
      if (s.queryType === 'vector') body.search = '*';
    }
    if (s.semanticRanker) {
      body.queryType = 'semantic';
      body.semanticConfiguration = 'default';
      if (s.captions) {
        body.captions = 'extractive';
        body.answers = 'extractive';
      }
    }
    return [
      `curl -X POST "${api.endpoint}?api-version=2024-07-01" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "api-key: <API_KEY>" \\`,
      `  -d '${JSON.stringify(body)}'`,
    ].join('\n');
  };

  return (
    <section ref={ref} className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
          학습계
        </div>
        {!api && (
          <button
            onClick={() => setModalOpen(true)}
            disabled={indexes.length === 0}
            className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ＋ RAG API 발급
          </button>
        )}
      </div>

      <div className="px-[18px] py-[18px]">
        {!api ? (
          <div className="py-12 text-center">
            <div className="text-[26px] mb-2">🔌</div>
            <div className="text-[13px] font-extrabold text-ink mb-1">발급된 RAG API가 없습니다</div>
            <div className="text-[11.5px] text-ink-mid">인덱스를 소스로 묶어 검색 API를 발급하세요.</div>
          </div>
        ) : (
          <div className="border border-line-soft rounded-lg overflow-hidden bg-white">
            {/* 헤더 */}
            <div className="flex items-center gap-2.5 py-2.5 px-3.5 border-b border-line-soft">
              <span className="text-[13.5px] font-extrabold text-ink truncate">{api.name}</span>
              <span
                title="이 인스턴스는 학습계(dev) 환경입니다. 학습계 배포 신청 → 결재 승인 후 반영됩니다."
                className="inline-flex items-center py-[2px] px-2 rounded-full border border-info-border bg-info-bg text-info text-[10px] font-extrabold"
              >
                학습계
              </span>
              <span className="text-[10.5px] text-ink-mid font-mono">{api.id}</span>
              <span className="flex-1" />
              <button
                onClick={toggleStatus}
                title={active ? '일시중지' : '활성화'}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[10.5px] font-extrabold py-[3px] px-2.5 rounded-full border',
                  active
                    ? 'bg-ok-bg text-ok border-ok-border hover:bg-white'
                    : 'bg-surface-soft text-ink-mid border-line hover:bg-white',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-ok' : 'bg-ink-light')} />
                {active ? '활성' : '일시중지'}
              </button>
              <button
                onClick={() => setModalOpen(true)}
                disabled={pending}
                title={pending ? '이미 승인 대기 중인 배포 신청이 있습니다' : '설정을 확인·변경하고 학습계 배포를 신청'}
                className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? '승인 대기 중' : '▶ 학습계 배포 신청'}
              </button>
            </div>

            {/* Endpoint + Key */}
            <div className="px-3.5 py-2.5 flex flex-col gap-1.5 bg-surface-soft border-b border-line-soft">
              <FieldRow label="Endpoint" value={api.endpoint} copied={copied === 'ep'} onCopy={() => copy('ep', api.endpoint)} />
              <FieldRow
                label="API Key"
                value={revealed ? api.apiKey : mask(api.apiKey)}
                copied={copied === 'key'}
                onCopy={() => copy('key', api.apiKey)}
                onReveal={() => setRevealed((r) => !r)}
                revealed={revealed}
                onRotate={rotateKey}
              />
            </div>

            {/* API 테스트 — 접기 */}
            <div className="border-t border-line-soft">
              <button
                type="button"
                onClick={() => setShowTest((s) => !s)}
                className="w-full flex items-center justify-between py-2 px-3.5 text-[11px] font-bold text-ink-mid hover:bg-surface"
              >
                <span>🔎 API 테스트</span>
                <span className={cn('text-[10px] transition-transform', showTest && 'rotate-180')}>▾</span>
              </button>
              {showTest && (
                <div className="border-t border-line-soft px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runTest()}
                      placeholder="질의문을 입력하세요"
                      className="flex-1 h-8 px-2.5 border border-line rounded text-[12px] text-ink-dark bg-white focus:outline-none focus:border-kb-yellow-dark"
                    />
                    <button
                      onClick={runTest}
                      className="h-8 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark flex-shrink-0"
                    >
                      ▶ 검색 실행
                    </button>
                  </div>
                  {testResult && (
                    <div className="mt-2.5 text-[11px] text-ok font-semibold flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok" />
                      200 OK · {testResult.latencyMs}ms · {testResult.count}건 반환
                      {api.search.semanticRanker && ' · 시맨틱 랭커 적용'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 사용 방법 (REST) — 접기 */}
            <div className="border-t border-line-soft">
              <button
                type="button"
                onClick={() => setShowDocs((s) => !s)}
                className="w-full flex items-center justify-between py-2 px-3.5 text-[11px] font-bold text-ink-mid hover:bg-surface"
              >
                <span>📘 사용 방법 (REST)</span>
                <span className={cn('text-[10px] transition-transform', showDocs && 'rotate-180')}>▾</span>
              </button>
              {showDocs && (
                <div className="border-t border-line-soft px-3.5 py-3 flex flex-col gap-2.5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">요청 (cURL)</span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(buildCurl());
                          setCopiedDoc(true);
                          window.setTimeout(() => setCopiedDoc(false), 1200);
                        }}
                        className={cn(
                          'h-5 px-1.5 border rounded text-[10px] font-bold',
                          copiedDoc ? 'border-ok-border bg-ok-bg text-ok' : 'border-line bg-white text-ink-dark hover:bg-surface',
                        )}
                      >
                        {copiedDoc ? '✓ 복사됨' : '복사'}
                      </button>
                    </div>
                    <pre className="text-[10.5px] font-mono text-ink-dark bg-ink/[0.04] border border-line-soft rounded p-2.5 overflow-x-auto leading-relaxed whitespace-pre">
{buildCurl()}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold mb-1">응답 예시</div>
                    <pre className="text-[10.5px] font-mono text-ink-dark bg-ink/[0.04] border border-line-soft rounded p-2.5 overflow-x-auto leading-relaxed whitespace-pre">
{`{
  "@odata.count": 128,
  "value": [
    {
      "@search.score": 0.0328,
      "@search.rerankerScore": 2.62,
      "@search.captions": [{ "text": "ISA 연간 납입한도는 2,000만원..." }],
      "id": "chunk-0f3a",
      "content": "...",
      "source": "PB_상담_지식인덱스",
      "page": 3
    }
  ]
}`}
                    </pre>
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">
                    · 인증: 헤더 <b className="text-ink-dark font-mono">api-key</b> 에 발급된 키 전달 ·
                    api-version <b className="text-ink-dark font-mono">2024-07-01</b> · 요청 한도 초과 시 <b className="text-ink-dark">429</b> 반환
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <IssueApiModal
          indexes={indexes}
          existing={api}
          onClose={() => setModalOpen(false)}
          onSave={submitDeployRequest}
        />
      )}
    </section>
  );
});

export default RagApiSection;

/* ---------------- Field row (endpoint / key) ---------------- */

function FieldRow({
  label,
  value,
  copied,
  onCopy,
  onReveal,
  revealed,
  onRotate,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  onReveal?: () => void;
  revealed?: boolean;
  onRotate?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold w-[68px] flex-shrink-0">{label}</span>
      <code className="flex-1 min-w-0 text-[11.5px] font-mono text-ink-dark truncate">{value}</code>
      {onRotate && (
        <button
          onClick={() => {
            if (window.confirm('API Key를 재발급하면 기존 키는 즉시 무효화됩니다. 계속할까요?')) onRotate();
          }}
          title="키 재발급"
          className="h-6 px-1.5 border border-line bg-white rounded text-[11px] text-ink-mid hover:bg-surface flex-shrink-0"
        >
          ↻
        </button>
      )}
      {onReveal && (
        <button
          onClick={onReveal}
          title={revealed ? '가리기' : '표시'}
          className="h-6 px-1.5 border border-line bg-white rounded text-[11px] text-ink-mid hover:bg-surface flex-shrink-0"
        >
          {revealed ? '🙈' : '👁'}
        </button>
      )}
      <button
        onClick={onCopy}
        className={cn(
          'h-6 px-2 border rounded text-[10.5px] font-bold flex-shrink-0',
          copied ? 'border-ok-border bg-ok-bg text-ok' : 'border-line bg-white text-ink-dark hover:bg-surface',
        )}
      >
        {copied ? '✓ 복사됨' : '복사'}
      </button>
    </div>
  );
}

/* ---------------- Issue / deploy-request modal ---------------- */

function IssueApiModal({
  indexes,
  existing,
  onClose,
  onSave,
}: {
  indexes: IndexWithVersions[];
  existing: RagApi | null;
  onClose: () => void;
  onSave: (p: {
    name: string;
    indexIds: string[];
    indexVersions: Record<string, string>;
    search: SearchConfig;
  }) => void;
}) {
  const name = existing?.name ?? '검색 API';
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(existing?.indexIds ?? (indexes[0] ? [indexes[0].indexId] : [])),
  );
  const [indexVersions, setIndexVersions] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    indexes.forEach((idx) => {
      m[idx.indexId] = existing?.indexVersions?.[idx.indexId] ?? idx.versions[0]?.version ?? '';
    });
    return m;
  });

  const s0 = existing?.search;
  const [queryType, setQueryType] = useState<QueryType>(s0?.queryType ?? 'hybrid');
  const [semanticRanker, setSemanticRanker] = useState(s0?.semanticRanker ?? true);
  const [vectorAlgo, setVectorAlgo] = useState<VectorAlgo>(s0?.vectorAlgo ?? 'hnsw');
  const [topK, setTopK] = useState(s0?.topK ?? 5);
  const [captions, setCaptions] = useState(s0?.captions ?? true);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const modelOf = (idx: IndexWithVersions) => {
    const ver = indexVersions[idx.indexId] ?? idx.versions[0]?.version;
    const v = idx.versions.find((x) => x.version === ver) ?? idx.versions[0];
    return v?.modelId;
  };
  const firstSelected = indexes.find((i) => selected.has(i.indexId));
  const lockedModel = firstSelected ? modelOf(firstSelected) : null;

  const search: SearchConfig = {
    queryType,
    semanticRanker,
    vectorAlgo,
    topK,
    captions: semanticRanker && captions,
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={existing ? '학습계 배포 신청' : 'RAG API 발급'}
      subtitle={
        existing
          ? '설정을 확인·변경한 뒤 학습계 배포를 신청합니다 (결재함에서 승인 후 반영)'
          : '인덱스를 소스로 묶어 검색 API를 구성합니다'
      }
      size="md"
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onClose}
            className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
          >
            취소
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() =>
              onSave({
                name,
                indexIds: [...selected],
                indexVersions: Object.fromEntries([...selected].map((id) => [id, indexVersions[id]])),
                search,
              })
            }
            className="py-2 px-3.5 bg-kb-yellow border border-kb-yellow-dark rounded text-[12.5px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {existing ? '▶ 학습계 배포 신청' : '▶ API 발급'}
          </button>
        </div>
      }
    >
      {/* 소스 인덱스 (다중 선택 + 버전) */}
      <div className="mb-3.5">
        <div className="text-xs font-bold text-ink-dark mb-2 flex items-center gap-1.5">
          <span>소스 인덱스</span>
          <InfoTip text="검색 대상 인덱스입니다. 여러 개를 함께 고를 수 있지만, 벡터 공간이 같아야 하므로 동일 임베딩 모델의 인덱스끼리만 선택됩니다. 각 인덱스의 버전도 지정할 수 있습니다." />
          <span className="text-[10.5px] text-ink-mid font-medium">동일 임베딩 모델의 인덱스만 함께 선택 가능</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {indexes.map((idx) => {
            const on = selected.has(idx.indexId);
            const selVer = indexVersions[idx.indexId] ?? idx.versions[0]?.version;
            const vObj = idx.versions.find((v) => v.version === selVer) ?? idx.versions[0];
            const model = vObj?.modelId;
            const mismatch = lockedModel != null && !on && model !== lockedModel;
            return (
              <div
                key={idx.indexId}
                className={cn(
                  'flex items-center gap-2 py-2 px-2.5 border rounded transition-colors',
                  on ? 'border-kb-yellow-dark bg-kb-yellow-tint' : 'border-line bg-white',
                  mismatch && 'opacity-50',
                )}
              >
                <button
                  onClick={() => !mismatch && toggle(idx.indexId)}
                  disabled={mismatch}
                  className={cn('flex items-center gap-2.5 flex-1 min-w-0 text-left', mismatch && 'cursor-not-allowed')}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                      on ? 'border-kb-yellow-dark bg-kb-yellow-dark' : 'border-line',
                    )}
                  >
                    {on && <span className="text-white text-[10px] font-extrabold">✓</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-extrabold text-ink truncate">📦 {idx.indexName}</span>
                    <span className="block text-[10.5px] text-ink-mid font-semibold flex items-center gap-1">
                      {getEmbedModel(vObj.modelId).short} · {INDEX_KIND_LABEL[vObj.kind]} · 벡터{' '}
                      {vObj.vectors.toLocaleString('ko-KR')}
                      {mismatch && (
                        <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-bad-border bg-bad-bg text-bad text-[9.5px] font-bold ml-1">
                          모델 불일치
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {on && (
                  <select
                    value={selVer}
                    onChange={(e) => setIndexVersions((m) => ({ ...m, [idx.indexId]: e.target.value }))}
                    title="버전 선택"
                    className="h-8 px-2 border border-line rounded text-[11px] font-bold text-ink-dark bg-white flex-shrink-0 focus:outline-none focus:border-kb-yellow-dark"
                  >
                    {idx.versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        {v.version} · 벡터 {v.vectors.toLocaleString('ko-KR')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Azure AI Search 검색 설정 */}
      <div className="mb-1">
        <div className="text-xs font-extrabold text-ink mb-2">검색 설정</div>

        <div className="mb-3">
          <div className="text-[11px] font-bold text-ink-dark mb-1.5 flex items-center">
            쿼리 유형 (Query type)
            <InfoTip text="검색 방식입니다. 키워드=BM25 어휘 검색, 벡터=의미 기반 유사도 검색, 하이브리드=둘을 RRF로 합쳐 정확도를 높입니다." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['keyword', 'vector', 'hybrid'] as QueryType[]).map((q) => {
              const on = queryType === q;
              return (
                <button
                  key={q}
                  onClick={() => setQueryType(q)}
                  className={cn(
                    'py-2 px-2 border rounded text-center text-[12px] font-extrabold transition-colors',
                    on ? 'border-kb-yellow-dark bg-kb-yellow-tint text-ink shadow-sm' : 'border-line bg-white text-ink-mid hover:border-kb-yellow-dark',
                  )}
                >
                  {QUERY_TYPE_LABEL[q]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[11px] font-bold text-ink-dark mb-1.5 flex items-center">
              벡터 알고리즘
              <InfoTip text="벡터 검색 색인 방식입니다. HNSW=근사 최근접(빠르고 대규모에 적합), Exhaustive KNN=전수 비교(가장 정확하지만 느림)." />
              {queryType === 'keyword' && <span className="text-[10px] text-ink-light font-medium ml-1">키워드 미사용</span>}
            </label>
            <select
              value={vectorAlgo}
              disabled={queryType === 'keyword'}
              onChange={(e) => setVectorAlgo(e.target.value as VectorAlgo)}
              className="w-full h-9 px-2.5 border border-line rounded text-[12px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-kb-yellow-dark disabled:opacity-50"
            >
              <option value="hnsw">HNSW</option>
              <option value="knn">Exhaustive KNN</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-ink-dark mb-1.5 flex items-center">
              Top (K)
              <InfoTip text="검색으로 가져올 상위 결과(청크) 개수입니다. 값이 클수록 문맥은 풍부하지만 프롬프트 토큰과 지연이 늘어납니다." />
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-full h-9 px-3 border border-line rounded text-[12.5px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-kb-yellow-dark"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSemanticRanker((v) => !v)}
            className={cn(
              'flex items-start gap-2.5 py-2 px-3 border rounded text-left transition-colors',
              semanticRanker ? 'border-kb-yellow-dark bg-[#FFFEF8]' : 'border-line bg-white hover:border-kb-yellow-dark',
            )}
          >
            <ToggleDot on={semanticRanker} />
            <span className="flex-1">
              <span className="block text-[12px] font-extrabold text-ink flex items-center">
                시맨틱 랭커
                <InfoTip text="1차 검색 결과를 딥러닝 기반으로 다시 정렬(L2 reranking)해 관련도를 높입니다. Azure의 semantic ranker 기능." />
              </span>
              <span className="block text-[10.5px] text-ink-mid mt-0.5 leading-snug">L2 재순위(semantic ranker)</span>
            </span>
          </button>
          <button
            onClick={() => semanticRanker && setCaptions((v) => !v)}
            disabled={!semanticRanker}
            className={cn(
              'flex items-start gap-2.5 py-2 px-3 border rounded text-left transition-colors',
              !semanticRanker && 'opacity-50 cursor-not-allowed',
              captions && semanticRanker ? 'border-kb-yellow-dark bg-[#FFFEF8]' : 'border-line bg-white hover:border-kb-yellow-dark',
            )}
          >
            <ToggleDot on={captions && semanticRanker} />
            <span className="flex-1">
              <span className="block text-[12px] font-extrabold text-ink flex items-center">
                시맨틱 캡션·답변
                <InfoTip text="검색 결과에서 질의와 가장 관련된 핵심 문장(캡션)과 추출 답변을 함께 반환합니다. 시맨틱 랭커가 켜져 있어야 사용할 수 있습니다." />
              </span>
              <span className="block text-[10.5px] text-ink-mid mt-0.5 leading-snug">captions & answers</span>
            </span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/** 옵션 설명 툴팁. */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <span
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-line text-ink-mid text-[9px] font-bold cursor-help select-none leading-none"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-[60] hidden group-hover:block w-[230px] px-2.5 py-1.5 rounded-md bg-ink text-white text-[10.5px] font-medium leading-relaxed shadow-lg normal-case tracking-normal text-left"
      >
        {text}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 -mt-1 rotate-45 bg-ink" />
      </span>
    </span>
  );
}

function ToggleDot({ on }: { on: boolean }) {
  return (
    <span className={cn('relative w-[26px] h-4 rounded-lg transition-colors flex-shrink-0 mt-0.5', on ? 'bg-ok' : 'bg-line')}>
      <span className={cn('absolute top-[2px] w-3 h-3 bg-white rounded-full transition-all', on ? 'left-3' : 'left-[2px]')} />
    </span>
  );
}
