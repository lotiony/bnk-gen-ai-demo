/**
 * 관리 콘솔 — Vector 저장소.
 *
 * RFP: RAG-005 Vector DB 연동·독립성 (필수 · 상세제안필요)
 * 연계: 2-1 계열사 데이터 격리 · SEC-001(테넌트 격리) · RAG-002(임베딩 유연성) ·
 *       RAG-006(무중단 리인덱싱)
 *
 * 발주처가 제품명(pgvector · Milvus · Chroma)을 직접 적어 넣은 요건이다. 그래서
 * 이 화면은 세 가지를 순서대로 답한다.
 *   ① 제품을 정말 세 종류 다 붙였는가 — 커넥터 표에 버전·역할까지 적는다
 *   ② 계열사 데이터가 섞이지 않는가 — 11개 Namespace 컬렉션을 한 표에 놓는다
 *   ③ 나중에 제품을 바꿀 수 있는가 — 드라이버 인터페이스와 교체 절차를 그린다
 *
 * ②가 이 화면의 무게중심이다. 요건은 "연동"이지만 발주처가 실제로 확인하려는 건
 * 공유 인프라에서 계열사 벡터가 분리되는지다(SEC-001 과 같은 질문).
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import { TENANT_SHORT } from '@/data/tenants';
import {
  VECTOR_PRODUCTS,
  VECTOR_COLLECTIONS,
  NAMESPACE_COUNT,
  STORE_OPERATIONS,
  DRIVER_MATRIX,
  SWAP_STEPS,
  VECTOR_SCOPE_NOTE,
  type ConnectorStatus,
} from '@/data/mockVectorStore';

type Tab = 'collections' | 'products' | 'driver';

const STATUS_TONE: Record<ConnectorStatus, 'ok' | 'info' | 'warn'> = {
  '운영 표준': 'ok',
  '운영 적용': 'info',
  '검증 완료': 'warn',
};

const MARK_COLOR: Record<string, string> = {
  '○': 'text-ok',
  '△': 'text-warn',
  '×': 'text-bad',
};

export default function AdminVectorStorePage() {
  const [tab, setTab] = useState<Tab>('collections');

  const stats = useMemo(() => {
    const vectors = VECTOR_COLLECTIONS.reduce((a, c) => a + c.vectors, 0);
    const dedicated = VECTOR_COLLECTIONS.filter((c) => c.isolation === '전용 인스턴스').length;
    const products = new Set(VECTOR_COLLECTIONS.map((c) => c.product)).size;
    return { vectors, dedicated, products };
  }, []);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">Vector 저장소</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            특정 제품에 종속되지 않는 드라이버 구조 위에서, 계열사 벡터를 Namespace 단위로 분리해 운영한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          RAG-005
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard
          label="연동 제품"
          value={String(VECTOR_PRODUCTS.length)}
          unit="종"
          sub="Milvus · pgvector · Chroma"
          tone="ok"
        />
        <KpiCard
          label="Namespace 컬렉션"
          value={String(VECTOR_COLLECTIONS.length)}
          unit={`/ ${NAMESPACE_COUNT}`}
          sub="1 Namespace 1 컬렉션 · 교차 검색 경로 없음"
          tone="ok"
        />
        <KpiCard
          label="전용 인스턴스 격리"
          value={String(stats.dedicated)}
          unit="개"
          sub="나머지는 공유 인스턴스 · DB 분리"
          tone="ok"
        />
        <KpiCard
          label="적재 벡터"
          value={(stats.vectors / 1_000_000).toFixed(2)}
          unit="M"
          sub={`실제 사용 제품 ${stats.products}종`}
          tone="ok"
        />
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-0.5 border-b border-line mb-3.5">
        {[
          { k: 'collections' as const, label: '계열사 컬렉션', req: 'SEC-001 · 2-1' },
          { k: 'products' as const, label: '제품 · 커넥터', req: 'RAG-005' },
          { k: 'driver' as const, label: '드라이버 · 교체', req: 'RAG-005 · RAG-006' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k
                ? 'text-brand border-brand'
                : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[9.5px] font-mono font-bold text-ink-light rfp-chip">
              {t.req}
            </span>
          </button>
        ))}
      </div>

      {/* ── 계열사 컬렉션 ── */}
      {tab === 'collections' && (
        <section className="card p-4 mb-3.5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">Namespace × 컬렉션</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              계열사 10 + 그룹 공통 1 = {NAMESPACE_COUNT}개
            </span>
          </div>
          <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
            컬렉션 이름에 Namespace 접두사를 강제하고, 검색 호출의 ns 인자는 SSO 클레임에서 주입되어
            호출자가 바꿀 수 없다. 그래서 교차 계열사 검색은 권한 이전에 <b className="text-ink">경로 자체가 없다</b>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead>
                <tr className="text-ink-mid border-b border-line">
                  <th className="text-left font-bold py-2 px-2 w-[130px]">계열사</th>
                  <th className="text-left font-bold py-2 px-2 w-[150px]">컬렉션</th>
                  <th className="text-left font-bold py-2 px-2 w-[90px]">제품</th>
                  <th className="text-left font-bold py-2 px-2 w-[150px]">임베딩 · 차원</th>
                  <th className="text-left font-bold py-2 px-2 w-[130px]">인덱스</th>
                  <th className="text-right font-bold py-2 px-2 w-[90px]">벡터</th>
                  <th className="text-left font-bold py-2 px-2">격리</th>
                </tr>
              </thead>
              <tbody>
                {VECTOR_COLLECTIONS.map((c) => (
                  <tr key={c.namespace} className="border-b border-line-soft">
                    <td className="py-2 px-2">
                      <div className="text-[12.5px] font-extrabold text-ink">
                        {TENANT_SHORT[c.tenant as keyof typeof TENANT_SHORT] ?? c.tenant}
                      </div>
                      <div className="text-[9.5px] font-mono text-ink-light font-bold">
                        {c.namespace}
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono font-bold text-ink text-[11px]">
                      {c.collection}
                    </td>
                    <td className="py-2 px-2">
                      <span className="pill bg-surface-soft text-ink-dark border border-line-soft text-[10px]">
                        {VECTOR_PRODUCTS.find((p) => p.id === c.product)?.name.split(' ')[0] ?? c.product}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-[11px] font-mono font-bold text-ink-dark">{c.embedModel}</div>
                      <div className="text-[9.5px] text-ink-light font-semibold">
                        {c.dimension}차원 · {c.metric}
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono text-ink-mid text-[10.5px]">{c.indexType}</td>
                    <td className="py-2 px-2 text-right font-mono font-extrabold text-ink text-[11.5px] tabular-nums">
                      {(c.vectors / 1000).toFixed(0)}K
                    </td>
                    <td className="py-2 px-2">
                      <StatusPill tone={c.isolation === '전용 인스턴스' ? 'ok' : 'info'}>
                        {c.isolation}
                      </StatusPill>
                      <div className="text-[9.5px] text-ink-mid font-semibold mt-1 leading-snug">
                        {c.isolationNote}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 제품 · 커넥터 ── */}
      {tab === 'products' && (
        <section className="card p-4 mb-3.5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">지원 제품 · 커넥터</h2>
            <span className="text-[11px] text-ink-mid font-semibold">전량 공동존 On-Premise 배포</span>
          </div>
          <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
            제품마다 격리를 구현하는 단위가 다르다. 그 차이를 드라이버가 흡수하므로 상위 파이프라인은
            어느 제품에 적재되는지 알 필요가 없다.
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {VECTOR_PRODUCTS.map((p) => (
              <div key={p.id} className="border border-line rounded overflow-hidden flex flex-col">
                <div className="px-3 py-2.5 bg-surface-soft border-b border-line-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold text-ink leading-snug">{p.name}</div>
                      <div className="text-[10px] font-mono text-ink-light font-bold mt-0.5">
                        {p.version}
                      </div>
                    </div>
                    <StatusPill tone={STATUS_TONE[p.status]} className="flex-shrink-0">
                      {p.status}
                    </StatusPill>
                  </div>
                </div>
                <div className="px-3 py-2.5 flex-1 space-y-2">
                  {[
                    { k: '배포 형태', v: p.deploy },
                    { k: '격리 단위', v: p.isolationUnit },
                    { k: '인덱스', v: p.indexTypes },
                    { k: '역할', v: p.role },
                  ].map((row) => (
                    <div key={row.k}>
                      <div className="text-[9.5px] text-ink-light font-extrabold tracking-[0.3px] uppercase">
                        {row.k}
                      </div>
                      <div className="text-[11px] text-ink-dark font-semibold leading-snug mt-0.5">
                        {row.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-brand-bg border-t border-line-soft flex items-baseline justify-between">
                  <span className="text-[10px] text-ink-mid font-bold">운영 컬렉션</span>
                  <span className="text-[13px] font-extrabold text-ink font-mono tabular-nums">
                    {p.collections}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 드라이버 · 교체 ── */}
      {tab === 'driver' && (
        <>
          <section className="card p-4 mb-2.5">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="text-[14px] font-extrabold text-ink">저장소 인터페이스</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                상위 구성요소는 이 6개 연산만 알고 제품 이름을 모른다
              </span>
            </div>
            <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
              제품 종속을 없애는 실체가 이 인터페이스다. <b className="text-ink">ns 인자는 SSO 클레임에서 주입</b>되므로
              호출자가 다른 계열사 컬렉션을 지정할 수 없다 — 격리가 애플리케이션 규칙이 아니라 구조로 강제된다.
            </p>
            <div className="space-y-1">
              {STORE_OPERATIONS.map((o) => (
                <div
                  key={o.sig}
                  className="grid grid-cols-[340px_1fr] gap-3 items-baseline px-3 py-2 bg-surface-soft border border-line-soft rounded"
                >
                  <code className="text-[11px] font-mono font-bold text-ink">{o.sig}</code>
                  <span className="text-[11px] text-ink-mid font-semibold leading-snug">{o.desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-4 mb-2.5">
            <div className="flex items-baseline gap-2 mb-2.5">
              <h2 className="text-[14px] font-extrabold text-ink">드라이버 기능 매트릭스</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                ○ 지원 · △ 제한 · × 미지원 — 제한·미지원은 플랫폼이 메운다
              </span>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-ink-mid border-b border-line">
                  <th className="text-left font-bold py-2 px-2 w-[190px]">기능</th>
                  <th className="text-center font-bold py-2 px-2 w-[70px]">Milvus</th>
                  <th className="text-center font-bold py-2 px-2 w-[80px]">pgvector</th>
                  <th className="text-center font-bold py-2 px-2 w-[70px]">Chroma</th>
                  <th className="text-left font-bold py-2 px-2">비고</th>
                </tr>
              </thead>
              <tbody>
                {DRIVER_MATRIX.map((d) => (
                  <tr key={d.feature} className="border-b border-line-soft">
                    <td className="py-2 px-2 font-extrabold text-ink">{d.feature}</td>
                    {([d.milvus, d.pgvector, d.chroma] as const).map((m, i) => (
                      <td key={i} className="py-2 px-2 text-center">
                        <span className={cn('text-[14px] font-extrabold', MARK_COLOR[m])}>{m}</span>
                      </td>
                    ))}
                    <td className="py-2 px-2 text-ink-mid font-semibold leading-snug">{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card p-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-2.5">
              <h2 className="text-[14px] font-extrabold text-ink">제품 교체 절차</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                "바꿀 수 있다"를 절차로 보여 준다 — 재임베딩 없이 옮긴다
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SWAP_STEPS.map((s, i) => (
                <div key={s.n} className="relative">
                  <div className="border border-line rounded px-3 py-2.5 h-full bg-surface-soft">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-[18px] h-[18px] rounded-full bg-brand text-white text-[10px] font-extrabold grid place-items-center flex-shrink-0">
                        {s.n}
                      </span>
                      <span className="text-[12.5px] font-extrabold text-ink">{s.title}</span>
                    </div>
                    <p className="text-[10.5px] text-ink-mid font-semibold leading-snug">{s.desc}</p>
                  </div>
                  {i < SWAP_STEPS.length - 1 && (
                    <span className="absolute top-1/2 -right-[9px] -translate-y-1/2 text-[12px] text-ink-light leading-none z-10">
                      ›
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <p className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">{VECTOR_SCOPE_NOTE}</p>
    </div>
  );
}
