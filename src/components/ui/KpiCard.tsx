import { cn } from '@/lib/utils';

export type KpiTone = 'ok' | 'warn' | 'bad';

interface Props {
  label: string;
  value: string;
  unit?: string;
  delta?: { text: string; tone: 'up' | 'down' | 'neutral' };
  sub?: string;
  tone?: KpiTone;
  /** 좌측 stripe 색을 끄려면 false */
  stripe?: boolean;
  spark?: number[];
}

const STRIPE: Record<KpiTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
};

const DELTA_COLOR = {
  up: 'text-ok',
  down: 'text-bad',
  neutral: 'text-ink-mid',
};

/** 홈 대시보드 / 프로젝트 상세 상단 KPI 카드 */
export default function KpiCard({
  label,
  value,
  unit,
  delta,
  sub,
  tone = 'ok',
  stripe = true,
  spark,
}: Props) {
  return (
    <div className="card relative overflow-hidden px-[18px] py-4 flex flex-col gap-1.5">
      {stripe && <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', STRIPE[tone])} />}
      <span className="text-[11px] font-extrabold tracking-[0.3px] uppercase text-ink-mid">
        {label}
      </span>
      <span className="text-2xl font-extrabold leading-none text-ink tracking-[-0.4px]">
        {value}
        {unit && <small className="text-[13px] text-ink-mid font-bold ml-0.5">{unit}</small>}
      </span>
      {delta && (
        <span className="text-[11px] font-bold text-ink-mid">
          <span className={DELTA_COLOR[delta.tone]}>{delta.text}</span>
        </span>
      )}
      {sub && <span className="text-[11px] text-ink-mid font-semibold">{sub}</span>}
      {spark && (
        <div className="flex items-end gap-[2px] h-6 mt-0.5">
          {spark.map((h, i) => (
            <span
              key={i}
              className={cn(
                'flex-1 rounded-[1px] min-h-[3px]',
                i === spark.length - 1 ? 'bg-kb-yellow-dark' : 'bg-line-soft',
              )}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
