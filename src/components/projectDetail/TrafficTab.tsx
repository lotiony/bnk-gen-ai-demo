import { useMemo, useState } from 'react';
import KpiCard from '@/components/ui/KpiCard';
import { cn } from '@/lib/utils';
import {
  getAgentTrafficSnapshot,
  type ModelTokenUsage,
} from '@/data/mockAgentTraffic';

interface Props {
  /** 프로젝트 식별자. 시드값으로만 사용. */
  projectId: string;
}

/**
 * Grafana 대시보드 URL 생성. 실제 운영에서는 Grafana org/dashboard UID를
 * 환경변수로 주입한다. 현재는 mock URL.
 */
const GRAFANA_BASE = 'https://monitor.aip.group.local';
function grafanaDashUrl(projectId: string): string {
  return `${GRAFANA_BASE}/d/aip-agent-monitoring/agent-monitoring?var-project=${projectId}`;
}
function grafanaPanelUrl(projectId: string, panel: number): string {
  return `${grafanaDashUrl(projectId)}&viewPanel=${panel}`;
}

/**
 * 프로젝트 모니터링 탭 — 트래픽 + 자원(인프라) 통합.
 *
 * 노출 메트릭:
 *  · 요청량 — RPS/RPM/TPS, 총 요청, 세션/Turn, DAU/WAU/MAU
 *  · 지연  — P50/P95/P99, TTFT, 타임아웃 발생률
 *  · 결과  — 성공률/실패율, Fallback 발동 횟수
 *  · 환경  — 학습계 vs 서빙계 트래픽, SLO 충족률·Error Budget
 *  · 자원  — Replica/Ready/Pending, CPU/Memory 평균·P95
 *  · LLM   — 입출력 토큰(모델별), 토큰 쿼터 소진율, TPM 한도 도달률
 */
export default function TrafficTab({ projectId }: Props) {
  const snap = useMemo(() => getAgentTrafficSnapshot(projectId, true), [projectId]);
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('1h');

  const trainShare = (snap.trainRps / Math.max(0.01, snap.trainRps + snap.servRps)) * 100;
  const servShare = 100 - trainShare;
  const sloOk = snap.sloAttainment >= 99;
  const tpmTone: 'ok' | 'warn' | 'bad' =
    snap.tpmUtilization >= 90 ? 'bad' : snap.tpmUtilization >= 75 ? 'warn' : 'ok';
  const quotaTone: 'ok' | 'warn' | 'bad' =
    snap.tokenQuotaUsedPct >= 85 ? 'bad' : snap.tokenQuotaUsedPct >= 60 ? 'warn' : 'ok';
  const cpuTone: 'ok' | 'warn' | 'bad' =
    snap.cpuP95 >= 85 ? 'bad' : snap.cpuP95 >= 70 ? 'warn' : 'ok';
  const memTone: 'ok' | 'warn' | 'bad' =
    snap.memP95 >= 85 ? 'bad' : snap.memP95 >= 70 ? 'warn' : 'ok';

  return (
    <section className="space-y-3.5">
      {/* 헤더 컨트롤 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11.5px] text-ink-mid">
          마지막 갱신 <b className="text-ink-dark tabular-nums">{snap.updatedAt}</b>
          <span className="mx-1.5 text-line">·</span>
          시계열은 분 단위 · 자동 갱신 60s · 프로젝트 내 운영 에이전트 합산
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {(['1h', '24h', '7d'] as const).map((r) => (
              <ChipButton key={r} active={range === r} onClick={() => setRange(r)}>
                {r === '1h' ? '최근 1시간' : r === '24h' ? '24시간' : '7일'}
              </ChipButton>
            ))}
          </div>
          <a
            href={grafanaDashUrl(projectId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded text-[11.5px] font-extrabold bg-ink text-white border border-ink hover:bg-ink-dark"
            title="이 프로젝트의 Grafana 대시보드 새 창으로 열기"
          >
            <span aria-hidden>📊</span>
            Grafana 대시보드
            <span aria-hidden className="text-[10px]">↗</span>
          </a>
        </div>
      </div>

      {/* ── 1. 요청량 KPI ─────────────────────────────────────── */}
      <SectionTitle title="요청량" hint="RPS · 총 요청 · 세션 · DAU/WAU/MAU" />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="RPS (현재)"
          value={snap.rps.toFixed(2)}
          sub={`RPM ${snap.rpm.toLocaleString()} · TPS ${snap.tps.toFixed(1)} tok/s`}
          tone="ok"
          spark={normalize(snap.rpsSeries.slice(-24))}
        />
        <KpiCard
          label="총 요청 수"
          value={fmtCompact(snap.total24h)}
          sub={`7일 누계 ${fmtCompact(snap.total7d)}`}
          tone="ok"
        />
        <KpiCard
          label="세션"
          value={snap.activeSessions.toLocaleString()}
          unit="개"
          sub={`동시 세션 ${snap.concurrentSessions} · Turn ${fmtCompact(snap.turns24h)}`}
          tone="ok"
        />
        <KpiCard
          label="고유 사용자"
          value={`${snap.dau.toLocaleString()}`}
          unit="DAU"
          sub={`WAU ${snap.wau.toLocaleString()} · MAU ${snap.mau.toLocaleString()}`}
          tone="ok"
        />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        <ChartCard
          title="RPS 추이"
          subtitle="최근 60분, 분 단위"
          grafanaHref={grafanaPanelUrl(projectId, 1)}
        >
          <LineChart series={snap.rpsSeries} height={120} valueFormatter={(v) => v.toFixed(1)} />
        </ChartCard>
        <ChartCard
          title="학습계 vs 서빙계"
          subtitle="현재 RPS 분배"
          grafanaHref={grafanaPanelUrl(projectId, 2)}
        >
          <SplitBar
            left={{ label: '학습계', value: snap.trainRps, pct: trainShare, tone: 'info' }}
            right={{ label: '서빙계', value: snap.servRps, pct: servShare, tone: 'ok' }}
            unit="RPS"
          />
          <div className="mt-3 pt-3 border-t border-line-soft text-[11px] text-ink-mid space-y-1">
            <div className="flex justify-between">
              <span>학습계 RPS</span>
              <b className="text-ink-dark tabular-nums">{snap.trainRps.toFixed(2)}</b>
            </div>
            <div className="flex justify-between">
              <span>서빙계 RPS</span>
              <b className="text-ink-dark tabular-nums">{snap.servRps.toFixed(2)}</b>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── 2. 지연 / 결과 KPI ────────────────────────────────── */}
      <SectionTitle title="응답 지연 · 결과" hint="P50/P95/P99 · TTFT · 타임아웃 · 성공률 · Fallback" />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="P95 응답"
          value={(snap.p95Ms / 1000).toFixed(2)}
          unit="s"
          sub={`P50 ${(snap.p50Ms / 1000).toFixed(2)}s · P99 ${(snap.p99Ms / 1000).toFixed(2)}s`}
          tone={snap.p95Ms <= snap.sloTargetP95Ms ? 'ok' : 'warn'}
          spark={normalize(snap.p95Series.slice(-24))}
        />
        <KpiCard
          label="TTFT"
          value={snap.ttftMs.toString()}
          unit="ms"
          sub="첫 토큰까지 시간"
          tone={snap.ttftMs <= 800 ? 'ok' : 'warn'}
          spark={normalize(snap.ttftSeries.slice(-24))}
        />
        <KpiCard
          label="타임아웃 발생률"
          value={snap.timeoutRate.toFixed(2)}
          unit="%"
          sub="24h"
          tone={snap.timeoutRate < 0.5 ? 'ok' : snap.timeoutRate < 1 ? 'warn' : 'bad'}
        />
        <KpiCard
          label="성공률"
          value={snap.successRate.toFixed(2)}
          unit="%"
          sub={`실패 ${snap.failureRate.toFixed(2)}% · Fallback 발동 ${snap.fallbackCount24h}건`}
          tone={snap.successRate >= 99 ? 'ok' : snap.successRate >= 97 ? 'warn' : 'bad'}
          spark={normalize(snap.successRateSeries.slice(-24))}
        />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        <ChartCard
          title="P95 지연 추이"
          subtitle={`SLO 목표 ≤ ${snap.sloTargetP95Ms}ms`}
          grafanaHref={grafanaPanelUrl(projectId, 3)}
        >
          <LineChart
            series={snap.p95Series}
            threshold={snap.sloTargetP95Ms}
            height={120}
            valueFormatter={(v) => `${Math.round(v)}ms`}
          />
        </ChartCard>
        <ChartCard
          title="SLO 충족률"
          subtitle="30일 · P95 ≤ 목표"
          grafanaHref={grafanaPanelUrl(projectId, 4)}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-extrabold text-ink tabular-nums">
              {snap.sloAttainment.toFixed(2)}
            </span>
            <span className="text-[14px] text-ink-mid font-bold">%</span>
            <span
              className={cn(
                'pill ml-auto',
                sloOk
                  ? 'bg-ok-bg text-ok border border-ok-border'
                  : 'bg-warn-bg text-warn border border-warn-border',
              )}
            >
              {sloOk ? '정상' : '주의'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-ink-mid space-y-1">
            <div className="flex justify-between">
              <span>Error Budget 소진</span>
              <b className="text-ink-dark tabular-nums">{snap.errorBudgetBurn.toFixed(1)}%</b>
            </div>
            <ProgressBar
              value={snap.errorBudgetBurn}
              tone={snap.errorBudgetBurn >= 80 ? 'bad' : snap.errorBudgetBurn >= 50 ? 'warn' : 'ok'}
            />
          </div>
        </ChartCard>
      </div>

      {/* ── 3. 자원(인프라) ─────────────────────────────────── */}
      <SectionTitle title="자원 (Pod / 컴퓨트)" hint="Replica · CPU · Memory · Ready/Pending" />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="현재 Replica"
          value={snap.podsDesired.toString()}
          unit="개"
          sub={`Ready ${snap.podsReady} · Pending ${snap.podsPending}`}
          tone={snap.podsPending === 0 ? 'ok' : 'warn'}
        />
        <KpiCard
          label="Pod Ready 비율"
          value={((snap.podsReady / Math.max(1, snap.podsDesired)) * 100).toFixed(1)}
          unit="%"
          sub={
            snap.podsPending > 0
              ? `Pending ${snap.podsPending}개 — 스케일링 중`
              : '모든 Pod 정상'
          }
          tone={snap.podsReady === snap.podsDesired ? 'ok' : 'warn'}
        />
        <KpiCard
          label="CPU 사용률 (평균)"
          value={snap.cpuAvg.toFixed(1)}
          unit="%"
          sub={`P95 ${snap.cpuP95.toFixed(1)}%`}
          tone={cpuTone}
          spark={normalize(snap.cpuSeries.slice(-24))}
        />
        <KpiCard
          label="Memory 사용률 (평균)"
          value={snap.memAvg.toFixed(1)}
          unit="%"
          sub={`P95 ${snap.memP95.toFixed(1)}%`}
          tone={memTone}
          spark={normalize(snap.memSeries.slice(-24))}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ChartCard
          title="CPU 추이"
          subtitle="Pod 평균"
          grafanaHref={grafanaPanelUrl(projectId, 5)}
        >
          <LineChart
            series={snap.cpuSeries}
            threshold={80}
            height={100}
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </ChartCard>
        <ChartCard
          title="Memory 추이"
          subtitle="Pod 평균"
          grafanaHref={grafanaPanelUrl(projectId, 6)}
        >
          <LineChart
            series={snap.memSeries}
            threshold={80}
            height={100}
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </ChartCard>
        <ChartCard
          title="Replica 수 추이"
          subtitle="HPA 스케일 이벤트"
          grafanaHref={grafanaPanelUrl(projectId, 7)}
        >
          <LineChart
            series={snap.podSeries}
            height={100}
            valueFormatter={(v) => `${Math.round(v)}개`}
            step
          />
        </ChartCard>
      </div>

      {/* ── 4. LLM 토큰 ───────────────────────────────────── */}
      <SectionTitle
        title="LLM 토큰 · 쿼터"
        hint="모델별 입출력 토큰 · 토큰 쿼터 · TPM 한도 도달률"
      />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="입력 토큰 (24h)"
          value={fmtCompact(snap.inputTokens24h)}
          sub={`모델 ${snap.models.length}종 합산`}
          tone="ok"
        />
        <KpiCard
          label="출력 토큰 (24h)"
          value={fmtCompact(snap.outputTokens24h)}
          sub={`총 ${fmtCompact(snap.inputTokens24h + snap.outputTokens24h)} 토큰 처리`}
          tone="ok"
        />
        <KpiCard
          label="토큰 쿼터 소진율"
          value={snap.tokenQuotaUsedPct.toFixed(1)}
          unit="%"
          sub="과제 단위 월 쿼터"
          tone={quotaTone}
        />
        <KpiCard
          label="TPM 한도 도달률"
          value={snap.tpmUtilization.toFixed(1)}
          unit="%"
          sub={`최고 압박 모델 · ${snap.tpmHotModel}`}
          tone={tpmTone}
          spark={normalize(snap.tpmUtilSeries.slice(-24))}
        />
      </div>

      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-3 gap-2">
          <h3 className="text-[14px] font-extrabold text-ink">모델별 토큰 사용량 (24h)</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-ink-mid">호출 비중·입력·출력 토큰</span>
            <a
              href={grafanaPanelUrl(projectId, 8)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10.5px] font-extrabold text-info hover:underline whitespace-nowrap"
              title="Grafana 패널 새 창으로 열기"
            >
              Grafana ↗
            </a>
          </div>
        </div>
        <ModelTokenTable models={snap.models} />
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 pt-1.5">
      <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
      {hint && <span className="text-[11px] text-ink-mid">— {hint}</span>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  grafanaHref,
  children,
}: {
  title: string;
  subtitle?: string;
  /** 지정 시 우상단에 Grafana 패널 새 창 링크 표시. */
  grafanaHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <h3 className="text-[13px] font-extrabold text-ink">{title}</h3>
        <div className="flex items-baseline gap-2">
          {subtitle && <span className="text-[10.5px] text-ink-mid">{subtitle}</span>}
          {grafanaHref && (
            <a
              href={grafanaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10.5px] font-extrabold text-info hover:underline whitespace-nowrap"
              title="Grafana 패널 새 창으로 열기"
            >
              Grafana ↗
            </a>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function LineChart({
  series,
  height = 110,
  threshold,
  step,
  valueFormatter,
}: {
  series: number[];
  height?: number;
  threshold?: number;
  step?: boolean;
  valueFormatter?: (v: number) => string;
}) {
  if (series.length === 0) return null;
  const W = 600;
  const H = height;
  const padX = 6;
  const padY = 10;
  const maxRaw = Math.max(...series, threshold ?? 0);
  const minRaw = Math.min(...series);
  const max = maxRaw === minRaw ? maxRaw + 1 : maxRaw * 1.08;
  const min = Math.max(0, minRaw - (max - minRaw) * 0.1);
  const xs = (i: number) => padX + (i / (series.length - 1)) * (W - padX * 2);
  const ys = (v: number) => padY + (1 - (v - min) / (max - min)) * (H - padY * 2);
  let d = '';
  if (step) {
    series.forEach((v, i) => {
      const x = xs(i);
      const y = ys(v);
      if (i === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else {
        d += ` L ${x.toFixed(1)} ${ys(series[i - 1]).toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
  } else {
    series.forEach((v, i) => {
      const x = xs(i);
      const y = ys(v);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
  }
  const areaPath = `${d} L ${xs(series.length - 1).toFixed(1)} ${(H - padY).toFixed(1)} L ${xs(
    0,
  ).toFixed(1)} ${(H - padY).toFixed(1)} Z`;

  const last = series[series.length - 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height }}
      >
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={padX}
            x2={W - padX}
            y1={padY + p * (H - padY * 2)}
            y2={padY + p * (H - padY * 2)}
            stroke="#EDEDED"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}
        {threshold !== undefined && threshold >= min && threshold <= max && (
          <line
            x1={padX}
            x2={W - padX}
            y1={ys(threshold)}
            y2={ys(threshold)}
            stroke="#D8313D"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        )}
        <path d={areaPath} fill="#FBE9E6" opacity={0.55} />
        <path d={d} fill="none" stroke="#CB2C10" strokeWidth={1.6} />
        <circle cx={xs(series.length - 1)} cy={ys(last)} r={2.8} fill="#1A1A1A" />
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-ink-light font-semibold tabular-nums">
        <span>{valueFormatter ? valueFormatter(min) : min.toFixed(1)}</span>
        <span>
          현재{' '}
          <b className="text-ink-dark">{valueFormatter ? valueFormatter(last) : last.toFixed(1)}</b>
        </span>
        <span>{valueFormatter ? valueFormatter(max) : max.toFixed(1)}</span>
      </div>
    </div>
  );
}

function SplitBar({
  left,
  right,
  unit,
}: {
  left: { label: string; value: number; pct: number; tone: 'ok' | 'info' };
  right: { label: string; value: number; pct: number; tone: 'ok' | 'info' };
  unit: string;
}) {
  return (
    <div>
      <div className="flex h-7 rounded overflow-hidden border border-line-soft">
        <div
          className={cn(
            'flex items-center justify-center text-[11px] font-extrabold tabular-nums',
            left.tone === 'info' ? 'bg-info-bg text-info' : 'bg-ok-bg text-ok',
          )}
          style={{ width: `${left.pct}%` }}
        >
          {left.pct > 12 && `${left.pct.toFixed(0)}%`}
        </div>
        <div
          className={cn(
            'flex items-center justify-center text-[11px] font-extrabold tabular-nums',
            right.tone === 'info' ? 'bg-info-bg text-info' : 'bg-ok-bg text-ok',
          )}
          style={{ width: `${right.pct}%` }}
        >
          {right.pct > 12 && `${right.pct.toFixed(0)}%`}
        </div>
      </div>
      <div className="flex justify-between text-[11px] mt-1.5 font-semibold">
        <span className="text-info">
          ■ {left.label}{' '}
          <b className="text-ink-dark tabular-nums">
            {left.value.toFixed(2)} {unit}
          </b>
        </span>
        <span className="text-ok">
          ■ {right.label}{' '}
          <b className="text-ink-dark tabular-nums">
            {right.value.toFixed(2)} {unit}
          </b>
        </span>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-ok';
  return (
    <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
      <div
        className={cn('h-full rounded-full', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ModelTokenTable({ models }: { models: ModelTokenUsage[] }) {
  const totalInput = models.reduce((a, m) => a + m.inputTokens24h, 0) || 1;
  const totalOutput = models.reduce((a, m) => a + m.outputTokens24h, 0) || 1;
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line">
          <th className="text-left font-bold py-2">모델</th>
          <th className="text-right font-bold py-2 w-[90px]">호출 비중</th>
          <th className="text-right font-bold py-2 w-[120px]">입력 토큰</th>
          <th className="text-left font-bold py-2 pl-3">분포</th>
          <th className="text-right font-bold py-2 w-[120px]">출력 토큰</th>
          <th className="text-left font-bold py-2 pl-3">분포</th>
        </tr>
      </thead>
      <tbody>
        {models.map((m) => {
          const inPct = (m.inputTokens24h / totalInput) * 100;
          const outPct = (m.outputTokens24h / totalOutput) * 100;
          return (
            <tr key={m.name} className="border-b border-line-soft last:border-0">
              <td className="py-2 font-mono text-[11.5px] text-ink-dark">{m.name}</td>
              <td className="py-2 text-right tabular-nums font-extrabold text-ink">
                {m.callShare.toFixed(1)}%
              </td>
              <td className="py-2 text-right tabular-nums font-bold text-ink">
                {m.inputTokens24h.toLocaleString()}
              </td>
              <td className="py-2 pl-3">
                <BarMini pct={inPct} tone="info" />
              </td>
              <td className="py-2 text-right tabular-nums font-bold text-ink">
                {m.outputTokens24h.toLocaleString()}
              </td>
              <td className="py-2 pl-3">
                <BarMini pct={outPct} tone="ok" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BarMini({ pct, tone }: { pct: number; tone: 'info' | 'ok' }) {
  return (
    <div className="h-1.5 rounded-full bg-line-soft overflow-hidden w-full">
      <div
        className={cn('h-full rounded-full', tone === 'info' ? 'bg-info' : 'bg-ok')}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function ChipButton({
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
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded text-[11px] font-extrabold border tabular-nums',
        active
          ? 'bg-brand-tint border-brand-dark text-ink'
          : 'bg-white border-line text-ink-dark hover:border-brand-dark',
      )}
    >
      {children}
    </button>
  );
}

function normalize(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  if (max === min) return arr.map(() => 50);
  return arr.map((v) => ((v - min) / (max - min)) * 100);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
