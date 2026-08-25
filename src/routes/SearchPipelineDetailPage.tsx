import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import KpiCard from '@/components/ui/KpiCard';
import { cn } from '@/lib/utils';
import {
  findPipelineTask,
  type PipelineTask,
  type PipelineIndexRef,
  type PipelineIndexVersion,
  type PipelineConsumer,
  type PipelineEvalRun,
  type PipelineEvalMetric,
  type PipelineApiKey,
  type PipelineEvalConsole,
  type IndexBuildState,
  type IndexKind,
} from '@/data/mockPipelineTasks';

type TabId = 'overview' | 'indexes' | 'dev' | 'eval' | 'serving';

const STATE_TONE: Record<string, string> = {
  '서빙계 운영': 'bg-ok-bg text-ok border-ok-border',
  '평가 진행': 'bg-info-bg text-info border-info-border',
  '학습계 배포': 'bg-warn-bg text-warn border-warn-border',
  기획: 'bg-surface-soft text-ink-mid border-line-soft',
};

const SENS_TONE: Record<number, string> = {
  1: 'bg-ok-bg text-ok border-ok-border',
  2: 'bg-info-bg text-info border-info-border',
  3: 'bg-warn-bg text-warn border-warn-border',
  4: 'bg-bad-bg text-bad border-bad-border',
};

/**
 * 지식 파이프라인 과제 상세 — 헤더 + 4단계 stepper + 5개 탭(개요·인덱스·학습계·평가·서빙계).
 * 에이전트 과제 상세와 동일한 max-w/padding/Header card/TabBtn 패턴.
 */
export default function SearchPipelineDetailPage() {
  const { projectId, pipelineId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const task = pipelineId ? findPipelineTask(pipelineId) : undefined;
  const [tab, setTab] = useState<TabId>('overview');

  if (!task) return <Navigate to={`/projects/${pid}`} replace />;

  const stateTone = STATE_TONE[task.state] ?? STATE_TONE['기획'];
  const maxSens = Math.max(...task.indexes.map((i) => i.sens));
  const usesCSP = (task.rerankModel ?? '').startsWith('azure/') || (task.rerankModel ?? '').startsWith('aws/');
  const passedAll = task.metrics.every((m) => m.passed === true);

  return (
    <div className="max-w-[1280px] mx-auto px-8 pt-3.5 pb-14">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: task.name },
        ]}
      />

      {/* Header */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
              <span className="text-ink-light text-[10px]">·</span>
              <span className="text-[11px] text-ink-mid">최근 활동 {task.updatedAt}</span>
              <span className="text-ink-light text-[10px] ml-1">·</span>
              <span className={cn('pill border', stateTone)}>
                <span className="mr-1">●</span>
                {task.state}
              </span>
            </div>
            <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.4px] truncate">
              {task.name}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11.5px] text-ink-mid">
              <span className="pill bg-accent-purple-bg text-accent-purple border border-accent-purple-border">
                {task.retrieval}
              </span>
              <span className="pill bg-info-bg text-info border border-info-border">{task.combine}</span>
              <span className="text-ink-light">|</span>
              <span>
                인덱스 <b className="text-ink-dark">{task.indexes.length}</b>개 · 소비 Agent{' '}
                <b className="text-ink-dark">{task.consumers.length}</b>건
              </span>
              <span className="text-ink-light">|</span>
              <span>
                담당 <b className="text-ink-dark">{task.ownerName}</b>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost">📎 첨부 보기</Button>
            <Button>▶ 테스트 호출</Button>
            <Button variant="primary" disabled={!passedAll}>
              ＋ 서빙계 프로모션 결재
            </Button>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <nav className="flex items-center border-b border-line mb-3.5 sticky top-[98px] z-20 bg-white shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>
          개요
        </TabBtn>
        <TabBtn active={tab === 'indexes'} onClick={() => setTab('indexes')}>
          입력 인덱스
          <TabCount>{task.indexes.length}</TabCount>
        </TabBtn>
        <TabBtn active={tab === 'dev'} onClick={() => setTab('dev')}>
          학습계
        </TabBtn>
        <TabBtn active={tab === 'eval'} onClick={() => setTab('eval')}>
          평가
          <TabCount tone={passedAll ? 'ok' : 'warn'}>
            {passedAll ? '통과' : `${task.metrics.filter((m) => m.passed).length}/${task.metrics.length}`}
          </TabCount>
        </TabBtn>
        <TabBtn active={tab === 'serving'} onClick={() => setTab('serving')}>
          서빙계
          {task.currentStage < 4 && <TabCount>대기</TabCount>}
        </TabBtn>
      </nav>

      {tab === 'overview' && <OverviewTab task={task} maxSens={maxSens} usesCSP={usesCSP} />}
      {tab === 'indexes' && <IndexesTab task={task} />}
      {tab === 'dev' && <DevTab task={task} />}
      {tab === 'eval' && <EvalTab task={task} passedAll={passedAll} />}
      {tab === 'serving' && <ServingTab task={task} />}
    </div>
  );
}

/* ============ Tab: Overview ============ */
function OverviewTab({
  task,
  maxSens,
  usesCSP,
}: {
  task: PipelineTask;
  maxSens: number;
  usesCSP: boolean;
}) {
  const goldenPct = Math.round((task.golden.count / task.golden.min) * 100);
  return (
    <section className="space-y-3.5">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="골든셋"
          value={String(task.golden.count)}
          unit="건"
          delta={{ text: `▲ 최소 ${task.golden.min}건 충족 (${goldenPct}%)`, tone: 'up' }}
          sub={`${task.golden.uploadedBy} · ${task.golden.uploadedAt}`}
          tone="ok"
        />
        <KpiCard
          label="Recall@10"
          value={task.metrics[0].current?.toFixed(2) ?? '—'}
          delta={{
            text: `${(task.metrics[0].current ?? 0) >= task.metrics[0].threshold ? '▲' : '▼'} 임계 ${task.metrics[0].threshold}`,
            tone: (task.metrics[0].current ?? 0) >= task.metrics[0].threshold ? 'up' : 'down',
          }}
          sub={`베이스라인 ${task.metrics[0].baseline}`}
          tone={(task.metrics[0].current ?? 0) >= task.metrics[0].threshold ? 'ok' : 'warn'}
        />
        <KpiCard
          label="P95 응답 (학습계)"
          value={task.p95Ms ? String(task.p95Ms) : '—'}
          unit="ms"
          delta={{ text: '목표 ≤ 800ms', tone: (task.p95Ms ?? 0) <= 800 ? 'up' : 'down' }}
          sub="대고객 표준 SLA"
          tone={(task.p95Ms ?? 0) <= 800 ? 'ok' : 'warn'}
        />
        <KpiCard
          label="민감도 등급"
          value={String(maxSens)}
          unit="등급"
          delta={{ text: '인덱스 중 최고값 자동 승계', tone: 'neutral' }}
          sub={maxSens >= 3 ? '보안 검토 자동 필수' : '표준 정책 적용'}
          tone={maxSens >= 3 ? 'warn' : 'ok'}
        />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        {/* 파이프라인 정보 */}
        <div className="card px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-ink mb-3">파이프라인 정보</h2>
          <Kv label="과제명" value={task.name} />
          <Kv label="과제 코드" value={task.id} />
          <Kv label="Retrieval 방식" value={task.retrieval} />
          <Kv label="결합 방식" value={task.combine} />
          <Kv label="임베딩 모델" value={task.embedModel} />
          <Kv
            label="Rerank 모델"
            value={task.rerankModel ?? '미사용'}
            tone={usesCSP ? 'warn' : undefined}
          />
          <Kv label="Top-K" value={String(task.topK)} />
          <Kv label="청크 윈도우" value={`±${task.chunkWindow}`} />
          <Kv label="멀티테넌시" value={task.tenancy} />
          <Kv label="담당자" value={task.ownerName} />
          <Kv label="마지막 갱신" value={task.updatedAt} last />
        </div>

        {/* 사이드 — 거버넌스 자동 매칭 */}
        <aside className="card px-4 py-3.5">
          <div className="text-[11.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2.5">
            거버넌스 자동 매칭
          </div>
          <div className="bg-brand-tint border border-brand-dark rounded p-3 space-y-1.5 text-[11.5px] text-ink-dark">
            <AutoLine>
              <b>민감도 승계</b> · 인덱스 최고 등급 <b>{maxSens}등급</b>
            </AutoLine>
            <AutoLine>
              <b>적용 법규</b> · 신용정보법 · 개인정보보호법 · 전자금융감독규정
            </AutoLine>
            {maxSens >= 3 && (
              <AutoLine>
                <b>마스킹</b> · 응답 청크 PII 마스킹 자동 + SSO 인증 강제
              </AutoLine>
            )}
            {usesCSP && (
              <AutoLine>
                <b>비용 결재</b> · CSP rerank 사용 → 혁신금융서비스 지정 서류 첨부 필수
              </AutoLine>
            )}
            <AutoLine>
              <b>감사 로그</b> · 쿼리·반환 청크·호출 Agent ID 자동 기록
            </AutoLine>
          </div>
        </aside>
      </div>

      {/* 변경 노트 */}
      <div className="card px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-ink mb-2">최근 변경</h2>
        <p className="text-[12.5px] text-ink-dark leading-relaxed">{task.changeNote}</p>
      </div>
    </section>
  );
}

/* ============ Tab: Indexes ============ */
function IndexesTab({ task }: { task: PipelineTask }) {
  // 현재 활성 구성 — 모든 인덱스 포함 + 각 인덱스의 pinned 버전
  const activeConfig: Record<string, string> = Object.fromEntries(
    task.indexes.map((i) => [i.id, i.pinnedVersion ?? i.versions[0].version]),
  );

  // staged state — 사용자 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(task.indexes.map((i) => i.id)),
  );
  const [pickedVersions, setPickedVersions] = useState<Record<string, string>>(activeConfig);
  const [submitting, setSubmitting] = useState(false);
  const [submittedToast, setSubmittedToast] = useState<string | null>(null);

  // 변경 감지 — 활성 인덱스/버전 vs staged
  const droppedIds = task.indexes.filter((i) => !selectedIds.has(i.id)).map((i) => i.id);
  const addedIds: string[] = []; // 현재 모델에선 추가 후보 없음 (확장 여지)
  const changedVersionIdxs = task.indexes
    .filter((i) => selectedIds.has(i.id) && pickedVersions[i.id] !== activeConfig[i.id])
    .map((i) => i.id);
  const totalChanges = droppedIds.length + addedIds.length + changedVersionIdxs.length;

  const toggleIndex = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const pickVersion = (indexId: string, version: string) => {
    setPickedVersions((m) => ({ ...m, [indexId]: version }));
  };
  const reset = () => {
    setSelectedIds(new Set(task.indexes.map((i) => i.id)));
    setPickedVersions(activeConfig);
  };
  const submit = () => {
    if (totalChanges === 0 || selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmittedToast(
        `지식파이프라인 배포가 시작되었습니다 (변경 ${totalChanges}건 · 선택 인덱스 ${selectedIds.size}개)`,
      );
      window.setTimeout(() => setSubmittedToast(null), 4000);
    }, 400);
  };

  return (
    <section className="space-y-3.5">
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-[15px] font-extrabold text-ink">입력 인덱스</h2>
            <span className="text-[11px] text-ink-mid">
              결합 방식: <b className="text-ink-dark">{task.combine}</b> · 원천 변경 구독 ON
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalChanges > 0 && (
              <span className="pill bg-bad-bg text-bad border border-bad-border font-extrabold text-[10px]">
                변경 {totalChanges}건
              </span>
            )}
            <Button
              variant="primary"
              disabled={totalChanges === 0 || selectedIds.size === 0 || submitting}
              onClick={submit}
            >
              {submitting ? '배포 중…' : '🚀 지식파이프라인 배포'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {task.indexes.map((idx) => (
            <IndexRowCard
              key={idx.id}
              idx={idx}
              selected={selectedIds.has(idx.id)}
              onToggleSelected={() => toggleIndex(idx.id)}
              pickedVersion={pickedVersions[idx.id]}
              activeVersion={activeConfig[idx.id]}
              onPickVersion={(v) => pickVersion(idx.id, v)}
            />
          ))}
        </div>
      </div>

      {/* Fixed action bar — 변경 있을 때만 노출 */}
      {totalChanges > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-brand-dark shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="max-w-[1280px] mx-auto px-8 py-3 flex items-center gap-3.5">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-extrabold text-ink mb-1">
                지식파이프라인 배포 변경 사항
                <span className="ml-2 pill bg-bad-bg text-bad border border-bad-border font-extrabold text-[10px]">
                  {totalChanges}건
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-dark">
                {changedVersionIdxs.map((id) => {
                  const idx = task.indexes.find((i) => i.id === id)!;
                  return (
                    <span key={id} className="inline-flex items-center gap-1">
                      <span className="text-ink-mid">{idx.indexName}</span>
                      <span className="font-mono font-extrabold text-bad">{activeConfig[id]}</span>
                      <span className="text-ink-mid">→</span>
                      <span className="font-mono font-extrabold text-ok">{pickedVersions[id]}</span>
                    </span>
                  );
                })}
                {droppedIds.map((id) => {
                  const idx = task.indexes.find((i) => i.id === id)!;
                  return (
                    <span key={id} className="inline-flex items-center gap-1">
                      <span className="text-ink-mid line-through">{idx.indexName}</span>
                      <span className="pill bg-bad-bg text-bad border border-bad-border font-extrabold text-[9.5px]">
                        제외
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <Button variant="ghost" onClick={reset}>
              ↺ 초기화
            </Button>
            <Button
              variant="primary"
              disabled={selectedIds.size === 0 || submitting}
              onClick={submit}
            >
              {submitting ? '배포 중…' : '🚀 지식파이프라인 배포'}
            </Button>
          </div>
        </div>
      )}

      {/* Submit toast */}
      {submittedToast && (
        <div className="fixed bottom-6 right-6 z-50 card border-ok-border bg-ok-bg px-4 py-3 shadow-lg flex items-center gap-2.5 max-w-[420px]">
          <span className="w-6 h-6 rounded-full bg-ok text-white inline-flex items-center justify-center font-extrabold text-[11px]">
            ✓
          </span>
          <span className="text-[12px] font-bold text-ink">{submittedToast}</span>
        </div>
      )}
    </section>
  );
}

const INDEX_KIND_LABEL: Record<IndexKind, string> = {
  hybrid: '하이브리드',
  vector: '벡터 전용',
  bm25: 'BM25',
};

const INDEX_BUILD_STATE: Record<IndexBuildState, { className: string; label: string }> = {
  built: { className: 'bg-ok-bg text-ok border-ok-border', label: '빌드 완료' },
  building: { className: 'bg-info-bg text-info border-info-border', label: '빌드 중' },
  stale: { className: 'bg-warn-bg text-warn border-warn-border', label: '재빌드 필요' },
};

function IndexRowCard({
  idx,
  selected,
  onToggleSelected,
  pickedVersion,
  activeVersion,
  onPickVersion,
}: {
  idx: PipelineIndexRef;
  selected: boolean;
  onToggleSelected: () => void;
  pickedVersion: string;
  activeVersion: string;
  onPickVersion: (version: string) => void;
}) {
  const current = idx.versions[0];
  const currentState = INDEX_BUILD_STATE[current.state];
  const changedVersion = selected && pickedVersion !== activeVersion;
  return (
    <div
      className={cn(
        'border rounded overflow-hidden bg-white transition-colors',
        !selected
          ? 'border-line-soft opacity-60'
          : changedVersion
          ? 'border-brand-dark shadow-sm'
          : 'border-line-soft',
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 py-3 px-3.5">
        <label className="inline-flex items-center cursor-pointer flex-shrink-0" title="학습계 배포에 포함">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="w-4 h-4 accent-brand-dark cursor-pointer"
          />
        </label>
        <span className="w-9 h-9 rounded bg-gradient-to-br from-brand to-brand-dark border border-brand-dark inline-flex items-center justify-center text-[11px] font-extrabold text-ink flex-shrink-0">
          IDX
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13.5px] font-extrabold text-ink truncate">{idx.indexName}</span>
            <span className="text-[10.5px] text-ink-mid font-mono">{idx.id}</span>
          </div>
          <div className="text-[10.5px] text-ink-mid mt-0.5">
            소유 <b className="text-ink-dark">{idx.ownerTask}</b>
            {idx.mine && (
              <span className="text-[9.5px] font-extrabold bg-ok-bg text-ok border border-ok-border py-px px-1.5 rounded-md ml-1.5">
                내 과제
              </span>
            )}
            <span className="text-line mx-1.5">·</span>
            마지막 동기화 {idx.lastSync} · 갱신 주기 {idx.refresh}
          </div>
        </div>
        <span className={cn('pill border font-extrabold', SENS_TONE[idx.sens])}>{idx.sens}등급</span>
        {idx.versions.length > 1 && (
          <span className="inline-flex items-center text-[10px] font-bold py-[2px] px-2 rounded-full border bg-info-bg text-info border-info-border">
            버전 {idx.versions.length}
          </span>
        )}
        {idx.pendingChunks > 0 && (
          <span className="inline-flex items-center text-[10px] font-extrabold py-[2px] px-2 rounded-full border bg-warn-bg text-warn border-warn-border">
            ＋{idx.pendingChunks}
          </span>
        )}
        {changedVersion && (
          <span className="inline-flex items-center text-[10px] font-extrabold py-[2px] px-2 rounded-full border bg-brand text-white border-brand-dark">
            변경됨
          </span>
        )}
        <span className={cn('pill border font-extrabold', currentState.className)}>
          {currentState.label}
        </span>
      </div>

      {/* 버전 이력 */}
      <div className="border-t border-line-soft">
        <div className="py-2 px-3.5 text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold bg-surface-soft border-b border-line-soft flex items-center justify-between">
          <span>버전 이력</span>
          <span className="text-ink-mid font-semibold normal-case tracking-normal text-[11px]">
            {idx.versions.length}건 · 활성 버전{' '}
            <b className="text-ink-dark font-mono">{activeVersion}</b>
            {changedVersion && (
              <>
                <span className="mx-1 text-ink-light">→</span>
                <b className="text-bad font-mono">{pickedVersion}</b>
              </>
            )}
          </span>
        </div>
        <ul className="divide-y divide-line-soft">
          {idx.versions.map((v) => (
            <IndexVersionRow
              key={v.version}
              v={v}
              isPicked={v.version === pickedVersion}
              isActive={v.version === activeVersion}
              disabled={!selected}
              onPick={() => onPickVersion(v.version)}
              groupName={`pick-${idx.id}`}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function IndexVersionRow({
  v,
  isPicked,
  isActive,
  disabled,
  onPick,
  groupName,
}: {
  v: PipelineIndexVersion;
  isPicked: boolean;
  isActive: boolean;
  disabled: boolean;
  onPick: () => void;
  groupName: string;
}) {
  const state = INDEX_BUILD_STATE[v.state];
  // 빌드 중인 버전은 선택 불가
  const cannotPick = v.state !== 'built';
  return (
    <li
      className={cn(
        'flex items-center gap-3 py-2 px-3.5 text-[12px]',
        isPicked && !disabled && 'bg-brand-tint',
        disabled && 'opacity-50',
      )}
    >
      <label
        className={cn(
          'inline-flex items-center flex-shrink-0',
          (disabled || cannotPick) && 'cursor-not-allowed',
          !disabled && !cannotPick && 'cursor-pointer',
        )}
        title={cannotPick ? '빌드 완료된 버전만 선택 가능' : '이 버전 사용'}
      >
        <input
          type="radio"
          name={groupName}
          checked={isPicked}
          disabled={disabled || cannotPick}
          onChange={onPick}
          className="w-3.5 h-3.5 accent-brand-dark cursor-pointer disabled:cursor-not-allowed"
        />
      </label>
      <span
        className={cn(
          'inline-flex items-center justify-center text-[10.5px] font-extrabold py-[2px] px-2 rounded-full border min-w-[42px]',
          isPicked
            ? 'bg-brand text-white border-brand-dark'
            : 'bg-surface-soft text-ink-dark border-line',
        )}
      >
        {v.version}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap text-[11.5px]">
          <span className="text-ink-dark font-bold">{v.createdAt}</span>
          <span className="text-ink-light">·</span>
          <span className="text-ink-mid font-semibold">by {v.createdBy}</span>
          <span className="text-ink-light">·</span>
          <span>
            <b className="text-ink-dark font-mono">{v.modelId}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            <b className="text-ink-dark">{INDEX_KIND_LABEL[v.kind]}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            벡터 <b className="text-ink-dark tabular-nums">{v.vectors.toLocaleString('ko-KR')}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            문서 <b className="text-ink-dark">{v.docs}</b>건
          </span>
        </div>
        {v.changeNote && (
          <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
            {v.changeNote}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {isActive && (
          <span className="inline-flex items-center text-[9.5px] font-extrabold py-[1px] px-1.5 rounded-md border bg-info-bg text-info border-info-border whitespace-nowrap">
            현재 활성
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center text-[10px] font-extrabold py-[2px] px-2 rounded-full border whitespace-nowrap',
            state.className,
          )}
        >
          {state.label}
        </span>
      </div>
    </li>
  );
}

function ChangeRow({
  time,
  sourceLabel,
  event,
  tone,
}: {
  time: string;
  sourceLabel: string;
  event: string;
  tone: 'info' | 'ok' | 'warn';
}) {
  const dotCls = { info: 'bg-info', ok: 'bg-ok', warn: 'bg-warn' }[tone];
  return (
    <div className="flex items-start gap-3 py-2 border-b border-line-soft last:border-b-0">
      <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotCls)} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink-dark font-semibold">{event}</div>
        <div className="text-[10.5px] text-ink-mid mt-0.5">
          <b className="text-ink-dark">{sourceLabel}</b> · {time}
        </div>
      </div>
    </div>
  );
}

/* ============ Tab: Dev (학습계) ============ */
function DevTab({ task }: { task: PipelineTask }) {
  return (
    <section className="space-y-3.5">
      {/* Endpoint + API 키 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">학습계 endpoint</h2>
          <span className="pill bg-ok-bg text-ok border border-ok-border font-extrabold">
            <span className="mr-1">●</span>활성
          </span>
        </div>
        <div className="font-mono text-[12px] bg-surface-soft border border-line-soft rounded p-3 text-ink-dark break-all mb-2">
          {task.endpointDev}
        </div>
        <div className="text-[10.5px] text-ink-mid">
          학습계 호출 시 <b className="text-ink-dark">API 키 + SSO 인증</b> 필요 · 일일 호출 한도 10,000건 · 응답 SLA
          P95 <b className="text-ink-dark">{task.p95Ms}ms</b>
        </div>
      </div>

      {/* API 키 (단일 패널 — 에이전트 ApiKeyPanel 패턴) */}
      <ApiKeyPanel initial={task.apiKey} endpoint={task.endpointDev ?? ''} />

      {/* 배포 버전 이력 */}
      <DevDeploymentHistory deployments={task.devDeployments} />
    </section>
  );
}

/** 단일 학습계 API 키 패널 — 에이전트 과제 ApiKeyPanel과 동일 패턴. */
function ApiKeyPanel({ initial, endpoint }: { initial?: PipelineApiKey; endpoint: string }) {
  const [key, setKey] = useState<PipelineApiKey | undefined>(initial);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const makeNewKey = (): PipelineApiKey => {
    const rand = Array.from({ length: 36 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
        Math.floor(Math.random() * 62),
      ),
    ).join('');
    return {
      fullKey: `sk-train-${rand}`,
      lastFour: rand.slice(-4),
      endpoint,
      issuedAt: new Date()
        .toLocaleString('ko-KR', { hour12: false })
        .replace(/\./g, '-')
        .slice(0, 16),
      issuedBy: '김플랫',
      callCount: 0,
    };
  };

  if (!key) {
    return (
      <div className="card px-5 py-4 flex items-center gap-3 bg-surface-soft">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-surface-soft border border-line-soft text-lg flex-shrink-0">
          🔑
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-extrabold text-ink">학습계 API 키 미발급</div>
          <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
            발급 후 학습계 endpoint 호출이 가능합니다.
          </div>
        </div>
        <button
          onClick={() => {
            setKey(makeNewKey());
            setRevealed(true);
          }}
          className="h-8 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
        >
          ＋ 키 발급
        </button>
      </div>
    );
  }

  const displayKey = revealed
    ? key.fullKey
    : `sk-train-${'•'.repeat(28)}${key.lastFour}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(key.fullKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('복사 실패 — 보안 컨텍스트가 필요합니다');
    }
  };

  const handleReissue = () => {
    const msg =
      `학습계 API 키를 재발급합니다.\n\n` +
      `현재 키: ${key.fullKey.slice(0, 12)}…${key.lastFour}\n` +
      `발급일: ${key.issuedAt}\n` +
      `누적 호출: ${key.callCount.toLocaleString()}건\n\n` +
      `재발급 시 기존 키는 즉시 무효화되며, 이 키를 사용하는 모든 클라이언트에 즉시 새 키를 배포해야 합니다.\n\n계속하시겠습니까?`;
    if (!window.confirm(msg)) return;
    setKey(makeNewKey());
    setRevealed(true);
  };

  return (
    <div className="card px-5 py-3.5 border-info-border/40">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-md text-lg flex-shrink-0 border bg-info-bg border-info-border">
          🔑
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-mid uppercase tracking-[0.3px]">
              학습계 API 키
            </span>
          </div>
          <code className="text-[11px] text-ink-mid font-mono truncate block mt-0.5">
            {key.endpoint}
          </code>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setRevealed((v) => !v)}
            className="h-7 px-2 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface"
            title={revealed ? '키 숨기기' : '키 보기'}
          >
            {revealed ? '🙈 숨기기' : '👁 보기'}
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              'h-7 px-2 bg-white border border-line rounded text-[11px] font-bold hover:bg-surface',
              copied ? 'text-ok border-ok-border bg-ok-bg' : 'text-ink-dark',
            )}
          >
            {copied ? '✓ 복사됨' : '📋 복사'}
          </button>
          <button
            onClick={handleReissue}
            className="h-7 px-2 rounded text-[11px] font-bold border bg-white border-line text-ink-dark hover:bg-surface"
          >
            ↻ 재발급
          </button>
        </div>
      </div>

      <div
        className={cn(
          'font-mono text-[12.5px] py-2 px-3 rounded border tabular-nums tracking-wide break-all',
          revealed
            ? 'bg-surface-soft border-line text-ink-dark'
            : 'bg-surface-soft/60 border-line-soft text-ink-mid',
        )}
      >
        {displayKey}
      </div>

      <div className="flex items-center gap-2 text-[10.5px] text-ink-mid font-semibold mt-2 flex-wrap">
        <span>
          발급 <b className="text-ink-dark">{key.issuedAt}</b> · {key.issuedBy}
        </span>
        <span className="text-line">·</span>
        <span>
          누적 호출 <b className="text-ink-dark tabular-nums">{key.callCount.toLocaleString()}</b>건
        </span>
        {key.lastUsedAt && (
          <>
            <span className="text-line">·</span>
            <span>
              마지막 호출 <b className="text-ink-dark">{key.lastUsedAt}</b>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const DEV_DEPLOY_STATUS: Record<
  'active' | 'previous' | 'rolled-back' | 'failed',
  { label: string; className: string }
> = {
  active: { label: '활성', className: 'bg-ok-bg text-ok border-ok-border' },
  previous: { label: '이전', className: 'bg-surface-soft text-ink-mid border-line-soft' },
  'rolled-back': { label: '롤백', className: 'bg-warn-bg text-warn border-warn-border' },
  failed: { label: '실패', className: 'bg-bad-bg text-bad border-bad-border' },
};

function DevDeploymentHistory({ deployments }: { deployments: PipelineTask['devDeployments'] }) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">배포 버전 이력</h2>
          <p className="text-[11px] text-ink-mid mt-0.5">
            학습계 배포 이력 · 어떤 인덱스 버전 조합으로 언제 누가 배포했는지
          </p>
        </div>
        <span className="text-[11px] text-ink-mid">
          전체 <b className="text-ink-dark">{deployments.length}</b>건
        </span>
      </div>
      <ul className="space-y-2">
        {deployments.map((d) => (
          <DevDeploymentRow key={d.id} d={d} />
        ))}
      </ul>
    </div>
  );
}

function DevDeploymentRow({ d }: { d: PipelineTask['devDeployments'][number] }) {
  const state = DEV_DEPLOY_STATUS[d.status];
  const isActive = d.status === 'active';
  return (
    <li
      className={cn(
        'border rounded overflow-hidden',
        isActive ? 'border-brand-dark bg-brand-tint' : 'border-line-soft bg-white',
      )}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span
          className={cn(
            'inline-flex items-center justify-center text-[11px] font-extrabold py-[3px] px-2.5 rounded-full border min-w-[48px]',
            isActive
              ? 'bg-brand text-white border-brand-dark'
              : 'bg-surface-soft text-ink-dark border-line',
          )}
        >
          {d.version}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-ink-dark font-bold">{d.deployedAt}</span>
            <span className="text-ink-light">·</span>
            <span className="text-ink-mid font-semibold">by {d.deployedBy}</span>
            {d.approvalId && (
              <>
                <span className="text-ink-light">·</span>
                <span className="text-info font-mono font-bold text-[10.5px]">{d.approvalId}</span>
              </>
            )}
          </div>
          {d.note && (
            <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">{d.note}</div>
          )}
        </div>
        <span className={cn('pill border font-extrabold', state.className)}>{state.label}</span>
        {!isActive && (
          <button
            type="button"
            className="h-7 px-2.5 border border-line bg-white rounded text-[11px] font-bold text-ink-dark hover:bg-surface"
            title="이 구성으로 롤백"
          >
            ↺ 롤백
          </button>
        )}
      </div>
      {/* 인덱스 구성 */}
      <div className="border-t border-line-soft bg-white">
        <div className="py-1.5 px-3.5 text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold bg-surface-soft border-b border-line-soft">
          인덱스 구성 ({d.indexConfig.length}개)
        </div>
        <ul className="divide-y divide-line-soft">
          {d.indexConfig.map((c) => (
            <li
              key={c.indexId}
              className="flex items-center gap-3 py-1.5 px-3.5 text-[11.5px]"
            >
              <span className="text-ink-dark font-bold flex-1 min-w-0 truncate">{c.indexName}</span>
              <span className="text-ink-mid font-mono text-[10.5px]">{c.indexId}</span>
              <span className="inline-flex items-center justify-center text-[10px] font-extrabold py-[1px] px-2 rounded-full border bg-info-bg text-info border-info-border min-w-[36px]">
                {c.version}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/* ============ Tab: Eval (에이전트 EvalTab 패턴 재사용) ============ */
function EvalTab({ task, passedAll }: { task: PipelineTask; passedAll: boolean }) {
  // 학습계 배포 버전 목록 (필터 옵션)
  const deployVersions = task.devDeployments.map((d) => d.version);
  const [versionFilter, setVersionFilter] = useState<string>('all');

  const filteredRuns = task.evalRuns.filter(
    (r) => versionFilter === 'all' || r.deployVersion === versionFilter,
  );

  return (
    <section>
      {/* 평가 콘솔 (Langfuse 카드 패턴) */}
      {task.evalConsole && (
        <div className="mb-3.5">
          <EvalConsoleCard console={task.evalConsole} />
        </div>
      )}

      {/* 품질 게이트 — 검색 평가 특화 */}
      <div className="card px-5 py-4 mb-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">품질 게이트 현황</h2>
            <p className="text-[11px] text-ink-mid mt-0.5">
              서빙계 프로모션 결재의 자동 게이트 · 미달 시 결재 차단
            </p>
          </div>
          <span
            className={cn(
              'pill border font-extrabold',
              passedAll
                ? 'bg-ok-bg text-ok border-ok-border'
                : 'bg-warn-bg text-warn border-warn-border',
            )}
          >
            {passedAll ? '✓ 모든 임계값 통과' : '⚠ 일부 미통과'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {task.metrics.map((m) => (
            <MetricBlock key={m.name} m={m} />
          ))}
        </div>
      </div>

      {/* 골든셋 (에이전트 테스트셋 카드 패턴) */}
      <div className="card px-5 py-4 mb-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold text-ink">골든셋</h3>
          {task.evalConsole && (
            <a
              href={task.evalConsole.datasetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] font-bold text-info hover:underline"
            >
              ＋ {task.evalConsole.name}에서 데이터셋 관리 ↗
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded border border-line-soft bg-surface-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12.5px] font-extrabold text-ink truncate flex-1">
                {task.golden.fileName}
              </div>
              {task.evalConsole && (
                <a
                  href={task.evalConsole.datasetUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="평가 콘솔에서 골든셋 열기"
                  className="text-[10.5px] font-bold text-info hover:underline flex-shrink-0"
                >
                  dataset ↗
                </a>
              )}
            </div>
            <div className="text-[10.5px] text-ink-mid font-semibold mt-1">
              <span className="tabular-nums">{task.golden.count}</span>건 · 최소 {task.golden.min}건
              충족 · {task.golden.uploadedBy} · {task.golden.uploadedAt}
            </div>
          </div>
        </div>
      </div>

      {/* 평가 이력 테이블 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">평가 이력</h2>
            <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
              학습계 배포 버전 × 골든셋 조합으로 누적된 회귀 평가 결과 · Recall@10 · MRR@10 · nDCG@10
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-ink-mid font-bold">배포 버전</label>
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="h-7 px-2 border border-line rounded text-[11.5px] bg-white"
            >
              <option value="all">전체</option>
              {deployVersions.map((v) => {
                const dep = task.devDeployments.find((d) => d.version === v)!;
                return (
                  <option key={v} value={v}>
                    {v}
                    {dep.status === 'active' ? ' (활성)' : ''}
                  </option>
                );
              })}
            </select>
            {task.evalConsole && (
              <a
                href={task.evalConsole.runUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 bg-info-bg border border-info-border rounded text-[12px] font-bold text-info hover:bg-info hover:text-white"
                title="평가 콘솔에서 새 평가 시작"
              >
                🔭 {task.evalConsole.name}에서 자세히 ↗
              </a>
            )}
          </div>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="py-7 text-center text-xs text-ink-light font-semibold bg-surface-soft border border-dashed border-line-soft rounded">
            선택한 조건에 해당하는 평가 이력이 없습니다
          </div>
        ) : (
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">
                  배포
                </th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">
                  실행 ID · 노트
                </th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[140px]">
                  실행 시각
                </th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[80px]">
                  실행자
                </th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[68px]">
                  트리거
                </th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[60px]">
                  골든
                </th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[72px]">
                  R@10
                </th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[72px]">
                  MRR
                </th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[72px]">
                  nDCG
                </th>
                <th className="text-center py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[64px]">
                  게이트
                </th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[80px]">
                  trace
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((r, i) => {
                const dep = task.devDeployments.find((d) => d.version === r.deployVersion);
                const last = i === filteredRuns.length - 1;
                return (
                  <EvalRunRow
                    key={r.id}
                    run={r}
                    deployActive={dep?.status === 'active'}
                    last={last}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function EvalConsoleCard({ console: c }: { console: PipelineEvalConsole }) {
  return (
    <div className="card px-5 py-3.5 flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-info-bg border border-info-border text-base flex-shrink-0">
        🔭
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold text-ink-mid uppercase tracking-[0.3px]">
            검색 평가 콘솔
          </span>
          <span className="pill bg-info-bg text-info border border-info-border">{c.name}</span>
        </div>
        <div className="text-[11.5px] text-ink-mid font-semibold truncate">
          <code className="font-mono text-ink-dark">{c.url}</code>
          <span className="mx-2 text-line">·</span>
          trace <b className="text-ink-dark tabular-nums">{c.traceCount.toLocaleString()}</b>건
          <span className="mx-2 text-line">·</span>
          마지막 동기화 <b className="text-ink-dark">{c.lastSyncedAt}</b>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-3 bg-info-bg border border-info-border rounded text-[12px] font-bold text-info hover:bg-info hover:text-white"
        >
          콘솔 열기 ↗
        </a>
      </div>
    </div>
  );
}

function MetricBlock({ m }: { m: PipelineEvalMetric }) {
  const passed = m.passed === true;
  return (
    <div
      className={cn(
        'border rounded p-3',
        passed ? 'border-ok-border bg-ok-bg/30' : 'border-warn-border bg-warn-bg/30',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-extrabold text-ink uppercase tracking-[0.3px]">{m.name}</span>
        <span
          className={cn(
            'pill border font-extrabold text-[9.5px]',
            passed ? 'bg-ok-bg text-ok border-ok-border' : 'bg-warn-bg text-warn border-warn-border',
          )}
        >
          {passed ? '✓ 통과' : '⚠ 미달'}
        </span>
      </div>
      <div className="text-[24px] font-extrabold text-ink tabular-nums leading-none mb-1">
        {m.current?.toFixed(2) ?? '—'}
      </div>
      <div className="flex items-center gap-2 text-[10.5px] text-ink-mid mt-2">
        <span>
          베이스라인 <b className="text-ink-dark tabular-nums">{m.baseline.toFixed(2)}</b>
        </span>
        <span className="text-line">·</span>
        <span>
          임계 <b className="text-ink-dark tabular-nums">{m.threshold.toFixed(2)}</b>
        </span>
      </div>
    </div>
  );
}

function EvalRunRow({
  run,
  deployActive,
  last,
}: {
  run: PipelineEvalRun;
  deployActive: boolean;
  last: boolean;
}) {
  const passed = run.metrics.every((m) => m.passed === true);
  const triggerTone =
    run.trigger === '자동'
      ? 'bg-info-bg text-info border-info-border'
      : run.trigger === '원천 변경'
      ? 'bg-warn-bg text-warn border-warn-border'
      : 'bg-surface-soft text-ink-mid border-line-soft';
  const metricCell = (idx: number) => {
    const m = run.metrics[idx];
    return (
      <td
        className={cn(
          'py-2 px-2.5 text-right tabular-nums font-bold',
          m.passed ? 'text-ink-dark' : 'text-bad',
          !last && 'border-b border-line-soft',
        )}
      >
        {m.current?.toFixed(2)}
      </td>
    );
  };
  return (
    <tr className="hover:bg-[#FDF6F4]">
      <td className={cn('py-2 px-2.5', !last && 'border-b border-line-soft')}>
        {run.deployVersion ? (
          <span
            className={cn(
              'pill border',
              deployActive
                ? 'bg-brand-tint text-ink border-brand-dark'
                : 'bg-surface-soft text-ink-mid border-line-soft',
            )}
          >
            {run.deployVersion}
          </span>
        ) : (
          <span className="text-ink-light text-[11px]">—</span>
        )}
      </td>
      <td className={cn('py-2 px-2.5', !last && 'border-b border-line-soft')}>
        <div className="font-extrabold text-ink">{run.id}</div>
        <div className="text-[10px] font-medium text-ink-mid mt-0.5">{run.note}</div>
      </td>
      <td
        className={cn(
          'py-2 px-2.5 text-ink-mid text-[11px] tabular-nums',
          !last && 'border-b border-line-soft',
        )}
      >
        {run.runAt}
      </td>
      <td
        className={cn(
          'py-2 px-2.5 text-ink-dark text-[11.5px]',
          !last && 'border-b border-line-soft',
        )}
      >
        {run.ranBy}
      </td>
      <td className={cn('py-2 px-2.5', !last && 'border-b border-line-soft')}>
        <span className={cn('pill border font-bold text-[10px]', triggerTone)}>{run.trigger}</span>
      </td>
      <td
        className={cn(
          'py-2 px-2.5 text-right tabular-nums text-ink-dark text-[11.5px]',
          !last && 'border-b border-line-soft',
        )}
      >
        {run.goldenSize}
      </td>
      {metricCell(0)}
      {metricCell(1)}
      {metricCell(2)}
      <td className={cn('py-2 px-2.5 text-center', !last && 'border-b border-line-soft')}>
        <span
          className={cn(
            'pill border font-extrabold text-[10px]',
            passed ? 'bg-ok-bg text-ok border-ok-border' : 'bg-bad-bg text-bad border-bad-border',
          )}
        >
          {passed ? '✓ 통과' : '✕ 차단'}
        </span>
      </td>
      <td className={cn('py-2 px-2.5 text-right', !last && 'border-b border-line-soft')}>
        {run.consoleRunUrl ? (
          <a
            href={run.consoleRunUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-info hover:underline"
            title="평가 콘솔에서 케이스별 결과 보기"
          >
            🔭 trace ↗
          </a>
        ) : (
          <span className="text-ink-light text-[11px]">—</span>
        )}
      </td>
    </tr>
  );
}

/* ============ Tab: Serving ============ */
function ServingTab({ task }: { task: PipelineTask }) {
  const isLive = task.currentStage === 4;
  return (
    <section className="space-y-3.5">
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">서빙계 endpoint</h2>
            <p className="text-[11px] text-ink-mid mt-0.5">
              {isLive ? '운영 중인 검색엔진' : '평가 통과 후 서빙계 프로모션 결재로 활성화'}
            </p>
          </div>
          <span
            className={cn(
              'pill border font-extrabold',
              isLive
                ? 'bg-ok-bg text-ok border-ok-border'
                : 'bg-surface-soft text-ink-mid border-line-soft',
            )}
          >
            <span className="mr-1">●</span>
            {isLive ? '운영' : '대기 중'}
          </span>
        </div>
        {isLive ? (
          <div className="font-mono text-[12px] bg-surface-soft border border-line-soft rounded p-3 text-ink-dark break-all">
            {task.endpointProd}
          </div>
        ) : (
          <div className="bg-surface-soft border border-dashed border-line rounded p-5 text-center">
            <div className="text-[12.5px] font-bold text-ink-dark mb-1">
              평가 게이트를 모두 통과하면 endpoint가 발급됩니다
            </div>
            <div className="text-[11px] text-ink-mid">
              현재 Stage {task.currentStage} / 4 · 다음 단계는 <b className="text-ink-dark">서빙계 프로모션 결재</b>
            </div>
          </div>
        )}
      </div>

      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">소비 Agent</h2>
          <span className="text-[11px] text-ink-mid">
            연결된 Agent <b className="text-ink-dark">{task.consumers.length}</b>건
          </span>
        </div>
        <div className="space-y-2">
          {task.consumers.map((c) => (
            <ConsumerRow key={c.agentId} consumer={c} />
          ))}
        </div>
      </div>

      <div className="card px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">SLA · 운영 메트릭</h2>
        <div className="grid grid-cols-3 gap-3">
          <SlaBlock label="P95 응답" value={`${task.p95Ms} ms`} target="≤ 800 ms" passed={(task.p95Ms ?? 0) <= 800} />
          <SlaBlock
            label="가용성 (30일)"
            value={`${task.availability}%`}
            target="≥ 99.9%"
            passed={(task.availability ?? 0) >= 99.9}
          />
          <SlaBlock label="일간 호출" value={isLive ? '320,000' : '0'} target="추정 320K" passed />
        </div>
      </div>
    </section>
  );
}

function ConsumerRow({ consumer }: { consumer: PipelineConsumer }) {
  const stateTone =
    consumer.state === '연동 중'
      ? 'bg-ok-bg text-ok border-ok-border'
      : consumer.state === '검토 중'
      ? 'bg-info-bg text-info border-info-border'
      : 'bg-surface-soft text-ink-mid border-line-soft';
  return (
    <div className="border border-line-soft rounded p-3 flex items-center gap-3 hover:border-info">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{consumer.agentId}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-info">에이전트 과제</span>
        </div>
        <div className="text-[13px] font-extrabold text-ink truncate">{consumer.agentName}</div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-[10.5px] text-ink-mid font-semibold">
        <span>
          호출 비중 <b className="text-ink-dark tabular-nums">{consumer.share}%</b>
        </span>
        <span>담당 {consumer.ownerName}</span>
      </div>
      <span className={cn('pill border font-extrabold', stateTone)}>{consumer.state}</span>
    </div>
  );
}

function SlaBlock({
  label,
  value,
  target,
  passed,
}: {
  label: string;
  value: string;
  target: string;
  passed: boolean;
}) {
  return (
    <div
      className={cn(
        'border rounded p-3',
        passed ? 'border-ok-border bg-ok-bg/30' : 'border-warn-border bg-warn-bg/30',
      )}
    >
      <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-1">{label}</div>
      <div className="text-[20px] font-extrabold text-ink tabular-nums leading-none mb-1.5">{value}</div>
      <div className="text-[10.5px] text-ink-mid">
        {passed ? '✓ ' : '⚠ '}
        목표 {target}
      </div>
    </div>
  );
}

/* ============ 공용 helpers ============ */

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-extrabold border-b-2 -mb-px transition-colors',
        active
          ? 'text-ink border-brand-dark bg-brand-tint'
          : 'text-ink-mid border-transparent hover:text-ink-dark hover:bg-surface',
      )}
    >
      {children}
    </button>
  );
}

function TabCount({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = {
    neutral: 'bg-white text-ink-mid border-line',
    ok: 'bg-ok-bg text-ok border-ok-border',
    warn: 'bg-warn-bg text-warn border-warn-border',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-extrabold py-[1px] px-1.5 rounded-full border',
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

function Kv({
  label,
  value,
  last,
  tone,
}: {
  label: string;
  value: string;
  last?: boolean;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink-dark';
  return (
    <div
      className={cn(
        'flex justify-between gap-3 py-2 text-[12.5px]',
        !last && 'border-b border-line-soft',
      )}
    >
      <span className="text-ink-mid font-semibold">{label}</span>
      <span className={cn('font-extrabold text-right', toneCls)}>{value}</span>
    </div>
  );
}

function AutoLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 leading-snug">
      <span className="text-brand-dark text-[9px] mt-[5px]">●</span>
      <span>{children}</span>
    </div>
  );
}

