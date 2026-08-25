import type { ModelCategory, ModelEntry, ModelStatus } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  models: ModelEntry[];
}

const CAT_LABEL: Record<ModelCategory, string> = {
  onprem: '언어 모델',
  voice: '음성',
};

const CAT_CHIP: Record<ModelCategory, string> = {
  onprem: 'bg-ok-bg text-ok border-ok-border',
  voice: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
};

const STATUS_CHIP: Record<ModelStatus, { cls: string; dot: string }> = {
  ok: { cls: 'bg-ok-bg text-ok border-ok-border', dot: 'bg-ok' },
  warn: { cls: 'bg-warn-bg text-warn border-warn-border', dot: 'bg-warn' },
  bad: { cls: 'bg-bad-bg text-bad border-bad-border', dot: 'bg-bad' },
  maint: { cls: 'bg-surface-soft text-ink-mid border-line-soft', dot: 'bg-ink-mid' },
};

/** 모델 탭 — 카테고리별 그룹 + 행마다 학습계/서빙계 PTU 사용량 바 */
export default function ModelsTab({ models }: Props) {
  const groups: { label: string; note?: string; items: ModelEntry[] }[] = [
    {
      label: '언어 모델',
      items: models.filter((m) => m.category === 'onprem'),
    },
    {
      label: '음성',
      items: models.filter((m) => m.category === 'voice'),
    },
  ];

  return (
    <section className="card px-5 py-4 mb-3.5">
      <div className="flex items-baseline gap-2.5 mb-3.5 flex-wrap">
        <span className="text-[15px] font-extrabold text-ink tracking-tight">모델</span>
        <span className="text-[11.5px] text-ink-mid font-medium">
          사용 가능 모델 화이트리스트 · 학습계/서빙계 사용 비율
        </span>
        <a href="#" className="ml-auto text-[11.5px] font-bold text-info hover:underline">
          모델 카탈로그 →
        </a>
      </div>

      {groups.map((g) => (
        <div key={g.label} className="mb-3.5 last:mb-0">
          <h4 className="text-[11.5px] font-extrabold tracking-[0.4px] uppercase text-ink-mid mb-2">
            {g.label} ({g.items.length}){g.note && ` · ${g.note}`}
          </h4>
          <div className="flex flex-col gap-2">
            {g.items.map((m, idx) => (
              <ModelRow key={m.id} model={m} rank={idx + 1} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ModelRow({ model, rank }: { model: ModelEntry; rank: number }) {
  return (
    <div className="grid grid-cols-[auto_1fr_340px] gap-3.5 items-center py-3 px-3.5 bg-surface-soft border border-line-soft rounded">
      <span className="w-[22px] h-[22px] rounded-full bg-white border border-line text-[11px] font-extrabold text-ink-dark inline-flex items-center justify-center">
        {rank}
      </span>
      <div>
        <div className="flex items-center gap-2 flex-wrap text-[12.5px] font-extrabold text-ink">
          <span>{model.name}</span>
          <span
            className={cn(
              'text-2xs font-extrabold py-[2px] px-2 rounded-[9px] border',
              CAT_CHIP[model.category],
            )}
          >
            {CAT_LABEL[model.category]}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-extrabold py-[2px] px-2 rounded-[9px] border',
              STATUS_CHIP[model.statusKey].cls,
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                STATUS_CHIP[model.statusKey].dot,
              )}
            />
            {model.statusLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {model.usage.map((u) => {
          const pct = Math.round((u.used / u.capacity) * 100);
          const isWarn = pct >= 75;
          return (
            <div key={u.env} className="grid grid-cols-[44px_1fr_110px] gap-2 items-center">
              <span
                className={cn(
                  'text-[9.5px] font-extrabold tracking-[0.3px] py-0.5 rounded-[8px] text-center border',
                  u.env === 'train'
                    ? 'bg-info-bg text-info border-info-border'
                    : 'bg-ok-bg text-ok border-ok-border',
                )}
              >
                {u.env === 'train' ? '학습계' : '서빙계'}
              </span>
              <div className="h-1.5 bg-white border border-line-soft rounded-sm overflow-hidden">
                <div
                  className={cn(
                    'h-full',
                    isWarn
                      ? 'bg-warn'
                      : u.env === 'train'
                      ? 'bg-info'
                      : 'bg-ok',
                  )}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-2xs font-bold text-ink-dark text-right whitespace-nowrap">
                <b className="text-ink font-extrabold">{u.used}</b>
                <small className="text-ink-mid font-semibold mx-0.5">
                  / {u.capacity} {u.unit}
                </small>
                <span className={cn('font-bold ml-1', isWarn ? 'text-warn' : 'text-ink-mid')}>
                  {pct}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
