/**
 * 지식 · 데이터 — 무중단 리인덱싱.
 *
 * RFP: RAG-010 무중단 리인덱싱 지원 (권고)
 *      RAG-002 청킹 전략 · 임베딩 모델 유연성 (필수) — 재청킹 여부가 여기서 갈린다
 *
 * 진행률 막대만 보여 주면 "무중단"이 증명되지 않는다. 핵심은
 * **서빙 별칭이 언제 어디를 가리키는가**이므로 그것을 표의 맨 앞에 둔다.
 */
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { useTenant } from '@/lib/tenantStore';
import { TENANT_SHORT } from '@/data/tenants';
import {
  REINDEX_JOBS,
  REINDEX_PRINCIPLES,
  PHASE_ORDER,
  type ReindexJob,
} from '@/data/mockReindex';

export default function ReindexPage() {
  const tenant = useTenant();
  const jobs =
    tenant === '그룹 공통'
      ? REINDEX_JOBS
      : REINDEX_JOBS.filter((j) => j.tenant === tenant || j.tenant === '그룹 공통');

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">무중단 리인덱싱</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            새 인덱스를 옆에 만들어 두고 검증 통과 시 별칭만 옮긴다 — 전환 순간에도 조회가
            끊기지 않는다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          RAG-010
        </span>
      </div>

      <div className="flex flex-col gap-2.5 mb-3.5">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
        {jobs.length === 0 && (
          <div className="card px-6 py-10 text-center text-[12px] text-ink-mid font-semibold">
            {tenant} 에 진행 중인 리인덱싱 작업이 없습니다
          </div>
        )}
      </div>

      <section className="card p-4">
        <h2 className="text-[14px] font-extrabold text-ink mb-2.5">무중단 원칙</h2>
        <div className="grid grid-cols-4 gap-3">
          {REINDEX_PRINCIPLES.map((p) => (
            <div key={p.k} className="border-l-2 border-line pl-3">
              <div className="text-[11.5px] font-extrabold text-ink-dark mb-0.5">{p.k}</div>
              <div className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">{p.v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function JobCard({ job }: { job: ReindexJob }) {
  const swapReady = job.phase === '스왑 대기';
  const passed =
    job.quality?.every((q) => q.after >= q.threshold) ?? false;

  return (
    <div
      className={cn(
        'card p-4',
        swapReady && 'border-ok-border',
      )}
    >
      <div className="flex items-start gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13.5px] font-mono font-extrabold text-ink">{job.alias}</span>
            <span className="text-[10px] font-mono font-bold text-ink-light">{job.id}</span>
            <span className="pill bg-surface-soft text-ink-mid border border-line-soft">
              {TENANT_SHORT[job.tenant]}
            </span>
            {job.rechunk && (
              <span className="pill bg-accent-purple-bg text-accent-purple border border-accent-purple-border">
                재청킹 포함
              </span>
            )}
            <StatusPill tone={swapReady ? 'ok' : 'info'}>{job.phase}</StatusPill>
          </div>
          <p className="text-[11px] text-ink-dark font-semibold mt-1">{job.reason}</p>
        </div>
        {swapReady && (
          <button
            type="button"
            disabled={!passed}
            title={passed ? undefined : '품질 게이트를 통과하지 못해 스왑할 수 없습니다'}
            onClick={() =>
              toast(`${job.alias} 별칭을 ${job.building} 으로 전환합니다 — 조회 중단 없음`)
            }
            className="py-1.5 px-3.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            별칭 전환
          </button>
        )}
      </div>

      {/* 별칭 상태 — 이 화면의 핵심 */}
      <div className="grid grid-cols-[1fr_28px_1fr] gap-2 items-center mb-3">
        <div className="border border-ok-border bg-ok-bg rounded px-3 py-2">
          <div className="text-[9.5px] text-ok font-extrabold uppercase tracking-[0.3px]">
            현재 서빙 중
          </div>
          <div className="text-[11.5px] font-mono font-bold text-ink-dark mt-0.5">
            {job.serving}
          </div>
        </div>
        <div className="text-center text-[14px] text-ink-light font-black">→</div>
        <div
          className={cn(
            'border rounded px-3 py-2',
            swapReady ? 'border-brand-dark bg-brand-bg' : 'border-line-soft bg-surface-soft',
          )}
        >
          <div className="text-[9.5px] text-ink-mid font-extrabold uppercase tracking-[0.3px]">
            빌드 중 (미서빙)
          </div>
          <div className="text-[11.5px] font-mono font-bold text-ink-dark mt-0.5">
            {job.building}
          </div>
        </div>
      </div>

      {/* 단계 */}
      <div className="flex items-center gap-1 mb-2">
        {PHASE_ORDER.map((p) => {
          const idx = PHASE_ORDER.indexOf(job.phase);
          const me = PHASE_ORDER.indexOf(p);
          const done = me < idx;
          const now = me === idx;
          return (
            <div key={p} className="flex-1">
              <div
                className={cn(
                  'h-[4px] rounded-full',
                  done ? 'bg-ok' : now ? 'bg-brand' : 'bg-surface',
                )}
              />
              <div
                className={cn(
                  'text-[9px] font-extrabold mt-1 text-center',
                  done ? 'text-ok' : now ? 'text-brand' : 'text-ink-light',
                )}
              >
                {p}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[10.5px] text-ink-mid font-semibold tabular-nums">
        <span>
          문서 <b className="text-ink-dark">{job.docs.toLocaleString('ko-KR')}</b>건 · 청크{' '}
          <b className="text-ink-dark">{job.chunks.toLocaleString('ko-KR')}</b>개
        </span>
        <span>시작 {job.startedAt}</span>
        <span className="ml-auto text-ink-dark font-bold">{job.eta}</span>
      </div>

      {/* 품질 게이트 */}
      {job.quality && (
        <div className="mt-2.5 pt-2.5 border-t border-line-soft">
          <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
            품질 게이트 — 기존 인덱스 성능 이상이어야 스왑한다
          </div>
          <div className="grid grid-cols-3 gap-2">
            {job.quality.map((q) => {
              const ok = q.after >= q.threshold;
              return (
                <div
                  key={q.metric}
                  className={cn(
                    'border rounded px-2.5 py-1.5',
                    ok ? 'border-ok-border bg-ok-bg' : 'border-bad-border bg-bad-bg',
                  )}
                >
                  <div className="text-[10px] font-extrabold text-ink-dark">{q.metric}</div>
                  <div className="text-[11px] font-bold text-ink-mid tabular-nums mt-0.5">
                    {q.before.toFixed(2)} →{' '}
                    <b className={ok ? 'text-ok' : 'text-bad'}>{q.after.toFixed(2)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
