import { Link, Navigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  findModelTask,
  MODEL_TASK_STATE_TONE,
  type ModelPtuAllocation,
} from '@/data/mockModelTasks';

/**
 * 모델 과제 상세 — 한 모델 = 한 신청 건.
 * 현재 화면은 운영 중 모델의 **PTU 할당 vs 실사용**을 중심으로 보여준다.
 */
export default function ModelTaskDetailPage() {
  const { projectId, modelTaskId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const task = modelTaskId ? findModelTask(modelTaskId) : undefined;

  if (!task) {
    return <Navigate to={`/projects/${pid}`} replace />;
  }

  const tone = MODEL_TASK_STATE_TONE[task.state];

  const costLabel =
    task.estimatedMonthCost >= 100_000_000
      ? `₩${(task.estimatedMonthCost / 100_000_000).toFixed(2)}억`
      : `₩${(task.estimatedMonthCost / 1_000_000).toFixed(0)}M`;

  // 총 할당/사용 합산 — 헤더 부근에 노출
  const totalAllocated = task.ptu.reduce((a, p) => a + p.allocated, 0);
  const totalUsed = task.ptu.reduce((a, p) => a + p.used, 0);
  const totalPct = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
  const ptuUnit = task.ptu[0]?.unit ?? 'PTU';

  return (
    <div className="max-w-[1600px] mx-auto px-8 pt-3.5 pb-14">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: '모델 과제' },
          { label: task.modelName },
        ]}
        trailing={task.id}
      />

      {/* Header */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="w-12 h-12 rounded-md bg-accent-brown-bg border border-accent-brown-border inline-flex items-center justify-center text-[22px] flex-shrink-0">
            🧠
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
              <span className="text-ink-light text-[10px]">·</span>
              <span className="text-[11px] font-bold text-accent-brown uppercase tracking-[0.4px]">
                {task.modelKind}
              </span>
              <span className="text-ink-light text-[10px]">·</span>
              <span className="text-[11px] text-ink-mid">신청일 {task.requestedAt}</span>
              <span
                className={cn(
                  'pill border ml-1.5 inline-flex items-center gap-1',
                  tone.cls,
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
                {task.state}
              </span>
              {task.innovDesignationRequired && (
                <span className="pill bg-warn-bg text-warn border border-warn-border">
                  혁신금융 지정
                </span>
              )}
            </div>
            <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.4px] font-mono break-all">
              {task.modelName}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11.5px] text-ink-mid">
              <span>
                신청자 <b className="text-ink-dark">{task.ownerName}</b>
              </span>
              {task.approvedAt && (
                <>
                  <span className="text-ink-light">|</span>
                  <span>
                    최종 승인 <b className="text-ink-dark">{task.approvedAt}</b>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <KpiTile
          label="신청 상태"
          value={task.state}
          sub={
            task.approvedAt
              ? `승인 ${task.approvedAt.slice(0, 10)}`
              : `신청 ${task.requestedAt.slice(0, 10)}`
          }
          tone={task.state === '사용 중' ? 'ok' : task.state === '반려' ? 'bad' : 'warn'}
        />
        <KpiTile
          label="사용 환경"
          value={task.env}
          sub={`${task.modelHost} · ${task.modelKind.toUpperCase()}`}
        />
        <KpiTile
          label="예상 월 비용"
          value={costLabel}
          sub={`연환산 ${
            task.estimatedMonthCost >= 100_000_000
              ? `₩${((task.estimatedMonthCost * 12) / 100_000_000).toFixed(1)}억`
              : `₩${((task.estimatedMonthCost * 12) / 1_000_000).toFixed(0)}M`
          }`}
        />
      </div>

      {/* PTU 할당량 / 현재 사용량 */}
      <div className="space-y-3.5">
        <section className="card px-5 py-4">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-[14px] font-extrabold text-ink">PTU 할당 및 사용량</h3>
                <div className="text-[10.5px] text-ink-mid mt-0.5">
                  환경별 약정 PTU 대비 어제 평균 사용량 · 매 5분 갱신
                </div>
              </div>
              <div className="text-[11.5px] text-ink-mid">
                전체 <b className="text-ink-dark tabular-nums">{totalUsed.toFixed(1)}</b> /{' '}
                <b className="text-ink-dark tabular-nums">{totalAllocated}</b> {ptuUnit} ·{' '}
                <b
                  className={cn(
                    'tabular-nums',
                    totalPct >= 90 ? 'text-bad' : totalPct >= 75 ? 'text-warn' : 'text-ok',
                  )}
                >
                  {totalPct.toFixed(0)}%
                </b>
              </div>
            </div>

            {task.ptu.length === 0 ? (
              <div className="text-center text-ink-light py-8 text-[11.5px] italic">
                아직 PTU가 할당되지 않았습니다.
              </div>
            ) : (
              <ul className="space-y-3">
                {task.ptu.map((p) => (
                  <PtuRow key={p.env} ptu={p} />
                ))}
              </ul>
            )}
          </section>

          {/* 7일 사용률 추이 */}
          {task.ptu.length > 0 && (
            <section className="card px-5 py-4">
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-[14px] font-extrabold text-ink">7일 사용률 추이</h3>
                  <div className="text-[10.5px] text-ink-mid mt-0.5">
                    할당 PTU 대비 일별 평균 사용률(%)
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  {task.ptu.map((p) => (
                    <span key={p.env} className="inline-flex items-center gap-1">
                      <span
                        className={cn(
                          'inline-block w-2.5 h-2.5 rounded-sm',
                          p.env === '학습계' ? 'bg-info' : 'bg-brand-dark',
                        )}
                      />
                      <span className="text-ink-dark font-bold">{p.env}</span>
                      <span className="text-ink-mid font-semibold tabular-nums">
                        {p.weeklyUtilPct[p.weeklyUtilPct.length - 1]}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <WeeklyUtilChart ptus={task.ptu} />
            </section>
          )}
      </div>

      <div className="mt-3.5">
        <Link to={`/projects/${pid}`}>
          <Button>← 프로젝트로</Button>
        </Link>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const accent =
    tone === 'bad' ? 'border-l-bad' : tone === 'warn' ? 'border-l-warn' : 'border-l-ok';
  return (
    <div className={cn('card px-4 py-3 border-l-[3px]', accent)}>
      <div className="text-[10.5px] text-ink-mid font-bold mb-1">{label}</div>
      <div className="text-[18px] font-extrabold text-ink tabular-nums">{value}</div>
      {sub && (
        <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 tabular-nums">{sub}</div>
      )}
    </div>
  );
}

function PtuRow({ ptu }: { ptu: ModelPtuAllocation }) {
  const pct = ptu.allocated > 0 ? (ptu.used / ptu.allocated) * 100 : 0;
  const remain = ptu.allocated - ptu.used;
  const tone = pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : 'ok';
  const toneCls =
    tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ok';
  const barColor = tone === 'bad' ? '#D8313D' : tone === 'warn' ? '#C9760F' : '#1B8A4D';
  const envChip =
    ptu.env === '학습계'
      ? 'bg-info-bg text-info border-info-border'
      : 'bg-ok-bg text-ok border-ok-border';

  return (
    <li className="border border-line-soft rounded px-4 py-3.5 bg-surface-soft/40">
      <div className="flex items-baseline justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('pill border text-[10px]', envChip)}>{ptu.env}</span>
          <span className="text-[13.5px] font-extrabold text-ink">
            <span className="tabular-nums">{ptu.used.toLocaleString()}</span>
            <span className="text-ink-mid text-[11.5px] font-bold mx-1">/</span>
            <span className="tabular-nums">{ptu.allocated.toLocaleString()}</span>
            <span className="text-ink-mid text-[11.5px] font-bold ml-1">{ptu.unit}</span>
          </span>
        </div>
        <div className="flex items-baseline gap-3 text-[11px]">
          <span className="text-ink-mid">
            잔여{' '}
            <b className="text-ink-dark tabular-nums">
              {remain.toFixed(remain < 10 ? 1 : 0)} {ptu.unit}
            </b>
          </span>
          <span className={cn('text-[18px] font-extrabold tabular-nums', toneCls)}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-white border border-line-soft overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-ink-mid font-semibold">
        <span>어제 평균 사용량 · 5분 단위 집계</span>
        <span>
          {tone === 'bad'
            ? '⚠ 한도 임박 — 증설 검토'
            : tone === 'warn'
            ? '주의 — 피크 시 한도 근접'
            : '여유'}
        </span>
      </div>
    </li>
  );
}

/** 7일 사용률 라인 차트 (각 환경 1개 라인). */
function WeeklyUtilChart({ ptus }: { ptus: ModelPtuAllocation[] }) {
  const N = ptus[0]?.weeklyUtilPct.length ?? 7;
  const W = 760;
  const H = 180;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xs = (i: number) => padL + (i / Math.max(1, N - 1)) * innerW;
  const ys = (v: number) => padT + (1 - v / 100) * innerH;
  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');

  const yTicks = [0, 25, 50, 75, 100];

  // 7일 라벨 — D-6 ~ 어제
  const labels: string[] = [];
  for (let i = N - 1; i >= 0; i--) {
    labels.push(i === 0 ? '어제' : `D-${i}`);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={ys(t)}
            y2={ys(t)}
            stroke={t === 100 ? '#F4C8D0' : '#EDEDED'}
            strokeWidth={1}
            strokeDasharray={t === 100 ? '4 3' : '2 3'}
          />
          <text x={padL - 6} y={ys(t) + 3} textAnchor="end" fontSize="9" fill="#999999">
            {t}%
          </text>
        </g>
      ))}
      <line
        x1={padL}
        x2={W - padR}
        y1={ys(75)}
        y2={ys(75)}
        stroke="#F4D89F"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {ptus.map((p) => (
        <g key={p.env}>
          <path
            d={pathOf(p.weeklyUtilPct)}
            fill="none"
            stroke={p.env === '학습계' ? '#1F5BB8' : '#CB2C10'}
            strokeWidth={1.8}
          />
          <circle
            cx={xs(p.weeklyUtilPct.length - 1)}
            cy={ys(p.weeklyUtilPct[p.weeklyUtilPct.length - 1])}
            r={3}
            fill={p.env === '학습계' ? '#1F5BB8' : '#CB2C10'}
          />
        </g>
      ))}
      {labels.map((label, i) => (
        <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#999999">
          {label}
        </text>
      ))}
    </svg>
  );
}

