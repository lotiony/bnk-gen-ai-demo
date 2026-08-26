/**
 * 지식 · 데이터 — 메타데이터 승인 (Data Owner HITL).
 *
 * RFP: EDA-008 자동 메타데이터 생성 및 사람 검증 (필수)
 *
 * 관문이 이 화면의 전부다 — 자동 생성된 비즈니스 메타데이터는
 * **Data Owner 가 승인하기 전까지 Vector DB / RAG 인덱스에 반영되지 않는다.**
 * 그래서 상단에 "반영 대기" 를 크게 세우고, 승인·반려 버튼을 컬럼 표 바로 옆에 뒀다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { useTenant } from '@/lib/tenantStore';
import { TENANT_SHORT } from '@/data/tenants';
import {
  META_REVIEWS,
  SENSITIVITY_TONE,
  type MetaReviewItem,
  type MetaReviewState,
} from '@/data/mockMetadataApproval';

const STATE_META: Record<MetaReviewState, { tone: 'warn' | 'ok' | 'bad'; label: string }> = {
  pending: { tone: 'warn', label: '반영 대기' },
  approved: { tone: 'ok', label: '반영됨' },
  rejected: { tone: 'bad', label: '반려' },
};

export default function MetadataApprovalPage() {
  const tenant = useTenant();

  /** 승인·반려 결과는 메모리에만 산다(브라우저 스토리지 금지). */
  const [decided, setDecided] = useState<Record<string, MetaReviewState>>({});
  const stateOf = (r: MetaReviewItem): MetaReviewState => decided[r.id] ?? r.state;

  const scoped = useMemo(
    () =>
      tenant === '그룹 공통'
        ? META_REVIEWS
        : META_REVIEWS.filter((r) => r.tenant === tenant),
    [tenant],
  );

  const [selectedId, setSelectedId] = useState<string | null>(scoped[0]?.id ?? null);
  const selected = scoped.find((r) => r.id === selectedId) ?? scoped[0] ?? null;

  const pendingCount = scoped.filter((r) => stateOf(r) === 'pending').length;

  const decide = (r: MetaReviewItem, next: MetaReviewState) => {
    setDecided((s) => ({ ...s, [r.id]: next }));
    toast(
      next === 'approved'
        ? `${r.table} 메타데이터 승인 — ${r.targetIndex} 반영을 시작합니다`
        : `${r.table} 메타데이터 반려 — 인덱스에 반영되지 않습니다`,
    );
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">메타데이터 승인</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            원천 데이터의 패턴·샘플로 자동 생성한 비즈니스 메타데이터를 Data Owner 가 사전
            검증한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal flex-shrink-0 mt-1">
          EDA-008
        </span>
      </div>

      {/* 관문 안내 */}
      <div className="border border-warn-border bg-warn-bg rounded px-3.5 py-2.5 mb-3.5">
        <div className="text-[11.5px] font-extrabold text-warn mb-0.5">
          반영 대기 {pendingCount}건 — 승인 전까지 인덱스에 들어가지 않는다
        </div>
        <p className="text-[11px] text-ink-dark font-semibold leading-snug">
          자동 생성기는 컬럼 설명·민감도 <b>초안</b>만 만든다. Data Owner 가 승인해야 Vector DB /
          RAG 인덱스에 반영되고, 승인된 민감도 분류가 그대로 마스킹 정책으로 연결된다.
        </p>
      </div>

      {scoped.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <div className="text-[28px] mb-2">✅</div>
          <h2 className="text-[14px] font-extrabold text-ink mb-1">
            {tenant} 에 검증 대기 중인 메타데이터가 없습니다
          </h2>
          <p className="text-[11.5px] text-ink-mid font-semibold">
            상단 Namespace 를 바꾸면 다른 계열사의 검증 큐로 이동합니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[260px_1fr] gap-3.5">
          {/* ── 좌: 검증 큐 ── */}
          <div className="flex flex-col gap-1.5 self-start sticky top-[110px]">
            {scoped.map((r) => {
              const st = stateOf(r);
              const on = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded border transition-colors',
                    on ? 'bg-brand-bg border-brand-dark' : 'bg-white border-line-soft hover:border-brand-dark',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11.5px] font-extrabold text-ink font-mono truncate">
                      {r.table}
                    </span>
                    <StatusPill tone={STATE_META[st].tone} className="ml-auto flex-shrink-0">
                      {STATE_META[st].label}
                    </StatusPill>
                  </div>
                  <div className="text-[10px] text-ink-mid font-semibold">
                    {r.source} · {TENANT_SHORT[r.tenant]}
                  </div>
                  <div className="text-[9.5px] text-ink-light font-semibold mt-0.5 tabular-nums">
                    {r.columns.length}개 컬럼 · {r.generatedAt}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 우: 상세 ── */}
          {selected && (
            <div className="card p-4 min-w-0">
              <div className="flex items-start gap-3 mb-3 pb-3 border-b border-line-soft">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-[15px] font-extrabold text-ink font-mono">
                      {selected.table}
                    </h2>
                    <span className="text-[11px] text-ink-mid font-semibold">
                      {selected.source}
                    </span>
                    <StatusPill tone={STATE_META[stateOf(selected)].tone}>
                      {STATE_META[stateOf(selected)].label}
                    </StatusPill>
                  </div>
                  <div className="text-[11px] text-ink-mid font-semibold mt-1">
                    Data Owner <b className="text-ink-dark">{selected.owner}</b> ·{' '}
                    {selected.ownerDept} · 샘플{' '}
                    <b className="text-ink-dark tabular-nums">
                      {selected.sampledRows.toLocaleString('ko-KR')}
                    </b>
                    행 분석
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-1">
                    반영 대상 <span className="font-mono text-ink-dark">{selected.targetIndex}</span>
                  </div>
                </div>
                {stateOf(selected) === 'pending' && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => decide(selected, 'rejected')}
                      className="py-1.5 px-3 border border-line rounded text-[11.5px] font-extrabold text-ink-dark hover:border-bad hover:text-bad"
                    >
                      반려
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(selected, 'approved')}
                      className="py-1.5 px-3.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
                    >
                      승인 · 인덱스 반영
                    </button>
                  </div>
                )}
              </div>

              {stateOf(selected) === 'rejected' && selected.rejectNote && (
                <div className="border border-bad-border bg-bad-bg rounded px-3 py-2 mb-3 text-[11px] font-semibold text-ink-dark leading-snug">
                  <b className="text-bad">반려 사유</b> · {selected.rejectNote}
                </div>
              )}

              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] border-b border-line-soft">
                    <th className="py-1.5 pr-3 font-extrabold">물리 컬럼</th>
                    <th className="py-1.5 pr-3 font-extrabold">자동 생성 메타데이터</th>
                    <th className="py-1.5 pr-3 font-extrabold">추론 근거</th>
                    <th className="py-1.5 pr-3 font-extrabold">민감도</th>
                    <th className="py-1.5 font-extrabold text-right">신뢰도</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.columns.map((c) => (
                    <tr key={c.column} className="border-b border-line-soft last:border-0 align-top">
                      <td className="py-2.5 pr-3">
                        <div className="font-mono font-extrabold text-ink text-[11px]">
                          {c.column}
                        </div>
                        <div className="text-[9.5px] text-ink-mid font-semibold mt-0.5">
                          {c.type}
                        </div>
                        <div className="text-[9.5px] text-ink-light font-semibold mt-0.5">
                          샘플 {c.sample}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[240px]">
                        <div className="font-extrabold text-ink">{c.suggestedName}</div>
                        <div className="text-[10.5px] text-ink-dark font-semibold mt-0.5 leading-snug">
                          {c.suggestedDesc}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[220px] text-[10.5px] text-ink-mid font-semibold leading-snug">
                        {c.basis}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={cn('pill border whitespace-nowrap', SENSITIVITY_TONE[c.sensitivity])}>
                          {c.sensitivity}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <div
                          className={cn(
                            'text-[12px] font-extrabold tabular-nums',
                            c.confidence >= 85
                              ? 'text-ok'
                              : c.confidence >= 60
                                ? 'text-warn'
                                : 'text-bad',
                          )}
                        >
                          {c.confidence}%
                        </div>
                        {c.confidence < 60 && (
                          <div className="text-[9px] text-bad font-bold mt-0.5 whitespace-nowrap">
                            직접 확인 필요
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-[10px] text-ink-mid font-semibold mt-3 pt-2.5 border-t border-line-soft leading-snug">
                🔒 승인·반려 행위는 감사 원장에 기록된다(SEC-009). 승인된 민감도 분류는 중앙 정책
                기반 자동 익명화의 입력이 된다(SEC-006).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
