/**
 * AI 거버넌스 포탈 — 핸드오프 §2 화면 14 (P0 ★).
 *
 * RFP: 2-3 AI거버넌스 포탈 전체
 *
 * 이 화면이 증명해야 하는 명제 —
 *   "AI 서비스는 **원장에 등록되고 라이프사이클 관문을 통과해야만** 운영에 오른다.
 *    그리고 운영에 오른 뒤에도 연 1회 기일이 돌아온다."
 *
 * 그래서 화면을 세 덩어리로 나눴다.
 *   ① 라이프사이클 — 관문이 어디에 있는지 (단계를 눌러 결재선·산출물·의무를 편다)
 *   ② 위험 분포   — 법상 고영향과 내부 위험등급을 **겹쳐서** 본다
 *   ③ 기일 관리   — 경과·임박 건이 위로 올라온다. 여기가 실무가 매일 보는 화면이다
 *
 * 법령 표기 주의 — 조문 번호를 화면에 적지 않는다. 데모 화면이 곧 확약이 되는
 * 구조(RFP Ⅳ.4.1)에서 조문 오기는 그대로 리스크다. 자세한 근거는 mock 파일 주석 참조.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import { TENANT_SHORT } from '@/data/tenants';
import {
  LIFECYCLE,
  AI_SERVICES,
  ACTIVE_SERVICES,
  GOV_STATS,
  GOV_TODAY,
  RISK_META,
  STAGE_LABEL,
  countByStage,
  countByRisk,
  dueServices,
  type LifecycleStage,
  type RiskGrade,
  type AiService,
} from '@/data/mockAiGovernance';

const RISK_GRADES: RiskGrade[] = ['고', '중', '저'];

export default function AiGovernancePage() {
  const [stage, setStage] = useState<LifecycleStage>('assess');
  const meta = LIFECYCLE.find((s) => s.id === stage)!;
  const stageServices = AI_SERVICES.filter((s) => s.stage === stage);

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">AI 거버넌스 포탈</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            그룹 전 계열사 AI 서비스를 하나의 원장에서 관리한다 · 기준일 {GOV_TODAY}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
          <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
            대응 요건
          </span>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
            2-3 AI거버넌스 포탈
          </span>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-5 gap-2.5 mb-3.5">
        <KpiCard
          label="등록 AI 서비스"
          value={String(GOV_STATS.total)}
          unit="건"
          sub={`운영 중 ${GOV_STATS.operating}건 · 종료 ${AI_SERVICES.length - GOV_STATS.total}건`}
          tone="ok"
        />
        <KpiCard
          label="고영향 AI"
          value={String(GOV_STATS.highImpact)}
          unit="건"
          sub="법상 고영향 인공지능 해당"
          tone="bad"
        />
        <KpiCard
          label="기일 경과"
          value={String(GOV_STATS.overdue)}
          unit="건"
          sub="연 1회 재평가 기한 초과"
          tone="bad"
        />
        <KpiCard
          label="30일 내 도래"
          value={String(GOV_STATS.dueSoon)}
          unit="건"
          sub="재평가 결재 자동 기안 대상"
          tone="warn"
        />
        <KpiCard
          label="영향평가 미실시"
          value={String(GOV_STATS.assessPending)}
          unit="건"
          sub="고영향인데 평가 이력 없음"
          tone="warn"
        />
      </div>

      {/* ── ① 라이프사이클 ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">AI 서비스 라이프사이클</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            단계를 누르면 결재선 · 산출물 · 대응 의무가 펼쳐진다
          </span>
        </div>

        <LifecycleFlow stage={stage} onPick={setStage} />

        {/* 선택 단계 상세 */}
        <div className="grid grid-cols-[1fr_300px] gap-3.5 mt-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-[22px] h-[22px] rounded-full bg-brand-dark text-white inline-flex items-center justify-center text-[11px] font-extrabold">
                {meta.seq}
              </span>
              <span className="text-[14px] font-extrabold text-ink">{meta.label}</span>
              <span className="pill bg-surface text-ink-mid border border-line-soft">
                이 단계 {stageServices.length}건
              </span>
            </div>
            <p className="text-[12px] text-ink-dark font-semibold leading-relaxed">{meta.desc}</p>

            {/* 관문 — 이 화면의 핵심 메시지 */}
            <div className="mt-2.5 flex items-start gap-2 bg-brand-bg border border-brand-tint rounded px-3 py-2">
              <span className="text-[13px] leading-none mt-[1px]">🚧</span>
              <span className="min-w-0">
                <span className="block text-[10px] font-extrabold text-brand uppercase tracking-[0.4px]">
                  진행 관문
                </span>
                <span className="block text-[11.5px] font-bold text-ink-dark leading-snug mt-0.5">
                  {meta.gate}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <TagBlock title="산출물" items={meta.outputs} tone="info" />
              <TagBlock title="AI기본법 대응 의무" items={meta.duties} tone="purple" />
            </div>

            {/* 이 단계에 머무는 서비스 */}
            <div className="mt-3">
              <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.4px] mb-1.5">
                이 단계의 서비스
              </div>
              {stageServices.length === 0 ? (
                <div className="text-[11px] text-ink-light font-semibold py-2">해당 서비스가 없습니다</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {stageServices.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 border border-line-soft rounded px-2 py-1 bg-white"
                    >
                      <span className={cn('pill border', RISK_META[s.riskGrade].cls)}>{s.riskGrade}</span>
                      <span className="text-[11.5px] font-bold text-ink-dark">{s.name}</span>
                      {s.highImpact && (
                        <span className="pill bg-bad-bg text-bad border border-bad-border">고영향</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 결재선 */}
          <aside className="self-start">
            <div className="border border-line-soft rounded px-3.5 py-3">
              <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2">
                단계 결재선
              </div>
              <div className="space-y-1.5">
                {meta.approvals.map((a, i) => (
                  <div key={a.seq}>
                    <div
                      className={cn(
                        'flex items-start gap-2 py-1.5 px-2 rounded border',
                        i === meta.approvals.length - 1
                          ? 'bg-brand-tint border-brand-dark'
                          : 'bg-white border-line-soft',
                      )}
                    >
                      <span
                        className={cn(
                          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
                          i === meta.approvals.length - 1
                            ? 'bg-brand-dark text-white'
                            : 'bg-white text-ink-light border border-line',
                        )}
                      >
                        {a.seq}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11.5px] font-extrabold text-ink">
                          {a.role} · {a.org}
                        </span>
                        <span className="block text-[10.5px] text-ink-mid font-semibold leading-snug">
                          {a.note}
                        </span>
                      </span>
                    </div>
                    {i < meta.approvals.length - 1 && (
                      <div className="text-center text-[9px] text-ink-light leading-none py-[1px]">▾</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ── ② 위험 분포 + ③ 기일 관리 ── */}
      <div className="grid grid-cols-[340px_1fr] gap-3.5 mb-3.5">
        <section className="card px-5 py-4 self-start">
          <h2 className="text-[14px] font-extrabold text-ink mb-1">위험등급 분포</h2>
          <p className="text-[11px] text-ink-mid font-semibold leading-snug mb-3">
            내부 위험등급(고/중/저)과 법상 고영향 여부는 <b className="text-ink-dark">다른 축</b>이다.
            겹치는 부분을 진한 색으로 표시한다.
          </p>
          <div className="space-y-2.5">
            {RISK_GRADES.map((g) => {
              const { total, highImpact } = countByRisk(g);
              const pct = (total / Math.max(1, ACTIVE_SERVICES.length)) * 100;
              const hiPct = (highImpact / Math.max(1, ACTIVE_SERVICES.length)) * 100;
              return (
                <div key={g}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('pill border', RISK_META[g].cls)}>{g}</span>
                    <span className="text-[11.5px] font-extrabold text-ink-dark">{total}건</span>
                    {highImpact > 0 && (
                      <span className="text-[10.5px] text-ink-mid font-semibold">
                        (그중 고영향 {highImpact})
                      </span>
                    )}
                  </div>
                  <div className="h-[18px] bg-surface-soft rounded-sm overflow-hidden flex">
                    <div className={cn(RISK_META[g].bar)} style={{ width: `${hiPct}%` }} />
                    <div
                      className={cn(RISK_META[g].bar, 'opacity-35')}
                      style={{ width: `${pct - hiPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2.5 border-t border-line-soft flex items-center gap-3">
            <LegendDot cls="bg-ink" label="법상 고영향" solid />
            <LegendDot cls="bg-ink" label="고영향 아님" />
          </div>
          <div className="mt-3 pt-2.5 border-t border-line-soft space-y-1.5">
            <MiniStat k="생성형 AI 표시 적용" v={`${GOV_STATS.genAiNotice} / ${GOV_STATS.total}건`} />
            <MiniStat k="운영 단계 진입" v={`${GOV_STATS.operating}건`} />
          </div>
        </section>

        <section className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">모니터링 기일 도래 관리</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              연 1회 재평가 · 기일이 지나면 <b className="text-ink-dark">서비스 노출이 제한</b>된다
            </span>
            <span className="ml-auto pill bg-bad-bg text-bad border border-bad-border">
              경과 {GOV_STATS.overdue} · 임박 {GOV_STATS.dueSoon}
            </span>
          </div>
          <DueTable rows={dueServices(140)} />
        </section>
      </div>

      {/* ── AI 서비스 원장 ── */}
      <section className="card px-5 py-4">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[14px] font-extrabold text-ink">AI 서비스 원장</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            종료된 서비스도 원장에는 남는다 — 감사 대응을 위해 기록을 보존한다
          </span>
          <span className="ml-auto text-[11px] text-ink-mid font-bold">{AI_SERVICES.length}건</span>
        </div>
        <LedgerTable rows={AI_SERVICES} />
      </section>
    </div>
  );
}

/* ═══════════════════════ 라이프사이클 Flow ═══════════════════════ */

const FC = {
  brand: '#CB2C10',
  brandDark: '#A82410',
  brandTint: '#FBE9E6',
  line: '#E0E0E1',
  inkMid: '#666666',
  inkLight: '#999999',
  ink: '#212121',
};

/** 5단계 가로 흐름. 폭 1046 은 관리 콘솔 본문(≈1092px)에 맞춘 값이다. */
function LifecycleFlow({
  stage,
  onPick,
}: {
  stage: LifecycleStage;
  onPick: (s: LifecycleStage) => void;
}) {
  const W = 190;
  const STEP = 214;
  const X0 = 7;
  const Y = 22;
  const H = 74;

  return (
    <svg viewBox="0 0 1060 116" className="w-full h-auto my-1" role="img" aria-label="AI 서비스 라이프사이클 5단계">
      <defs>
        <marker id="gov-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={FC.inkLight} />
        </marker>
      </defs>

      {LIFECYCLE.map((s, i) => {
        const x = X0 + i * STEP;
        const on = s.id === stage;
        const count = countByStage(s.id);
        return (
          <g key={s.id}>
            {i > 0 && (
              <line
                x1={x - STEP + W} y1={Y + H / 2} x2={x - 6} y2={Y + H / 2}
                stroke={FC.inkLight} strokeWidth="1.4" markerEnd="url(#gov-ar)"
              />
            )}
            <g onClick={() => onPick(s.id)} className="cursor-pointer">
              <rect
                x={x} y={Y} width={W} height={H} rx="3"
                fill={on ? FC.brandTint : '#FFFFFF'}
                stroke={on ? FC.brand : FC.line}
                strokeWidth={on ? 1.8 : 1.2}
              />
              <circle cx={x + 20} cy={Y + 22} r="10" fill={on ? FC.brandDark : '#FFFFFF'} stroke={on ? FC.brandDark : FC.line} strokeWidth="1.2" />
              <text x={x + 20} y={Y + 26} fontSize="11" fontWeight="800" textAnchor="middle" fill={on ? '#FFFFFF' : FC.inkLight}>
                {s.seq}
              </text>
              <text x={x + 38} y={Y + 26} fontSize="13.5" fontWeight="800" fill={on ? FC.brandDark : FC.ink}>
                {s.label}
              </text>
              <text x={x + 14} y={Y + 48} fontSize="10.5" fontWeight="600" fill={FC.inkMid}>
                {s.duties[0]}
              </text>
              <text x={x + 14} y={Y + 64} fontSize="10.5" fontWeight="700" fill={on ? FC.brand : FC.inkLight}>
                서비스 {count}건
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════ 표 ═══════════════════════ */

function dDayPill(d: number) {
  if (d < 0) return { label: `D+${-d} 경과`, cls: 'bg-bad-bg text-bad border-bad-border' };
  if (d <= 30) return { label: `D-${d}`, cls: 'bg-warn-bg text-warn border-warn-border' };
  return { label: `D-${d}`, cls: 'bg-surface text-ink-mid border-line-soft' };
}

function DueTable({ rows }: { rows: AiService[] }) {
  return (
    <div className="border border-line-soft rounded overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-soft">
            {['서비스', '계열사', '등급', '최근 평가', '다음 기일', 'D-day', '담당', '조치'].map((h) => (
              <th key={h} className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const d = dDayPill(s.dDay);
            return (
              <tr key={s.id} className={cn('border-b border-line-soft last:border-b-0', s.dDay < 0 && 'bg-bad-bg/25')}>
                <td className="px-2.5 py-[7px]">
                  <span className="text-[11.5px] font-extrabold text-ink-dark">{s.name}</span>
                  {s.highImpact && (
                    <span className="ml-1.5 pill bg-bad-bg text-bad border border-bad-border">고영향</span>
                  )}
                </td>
                <td className="px-2.5 py-[7px] text-[11px] text-ink-mid font-semibold whitespace-nowrap">
                  {TENANT_SHORT[s.tenant]}
                </td>
                <td className="px-2.5 py-[7px]">
                  <span className={cn('pill border', RISK_META[s.riskGrade].cls)}>{s.riskGrade}</span>
                </td>
                <td className="px-2.5 py-[7px] text-[11px] font-mono text-ink-mid whitespace-nowrap">
                  {s.lastAssessedAt}
                </td>
                <td className="px-2.5 py-[7px] text-[11px] font-mono text-ink-dark font-bold whitespace-nowrap">
                  {s.nextDueAt}
                </td>
                <td className="px-2.5 py-[7px] whitespace-nowrap">
                  <span className={cn('pill border', d.cls)}>{d.label}</span>
                </td>
                <td className="px-2.5 py-[7px] text-[11px] text-ink-mid font-semibold whitespace-nowrap">
                  {s.owner}
                </td>
                <td className="px-2.5 py-[7px] text-[11px] font-bold whitespace-nowrap">
                  {s.dDay < 0 ? (
                    <span className="text-bad">노출 제한 · 재평가 기안됨</span>
                  ) : s.dDay <= 30 ? (
                    <span className="text-warn">재평가 결재 자동 기안</span>
                  ) : (
                    <span className="text-ink-light">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTable({ rows }: { rows: AiService[] }) {
  return (
    <div className="border border-line-soft rounded overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-soft">
            {['ID', '서비스', '계열사', '단계', '내부 등급', '법상 고영향', '고영향 근거', '생성형 표시', '담당'].map((h) => (
              <th key={h} className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={cn('border-b border-line-soft last:border-b-0', s.stage === 'retire' && 'opacity-55')}>
              <td className="px-2.5 py-[7px] text-[11px] font-mono text-ink-mid whitespace-nowrap">{s.id}</td>
              <td className="px-2.5 py-[7px] text-[11.5px] font-extrabold text-ink-dark">{s.name}</td>
              <td className="px-2.5 py-[7px] text-[11px] text-ink-mid font-semibold whitespace-nowrap">
                {TENANT_SHORT[s.tenant]}
              </td>
              <td className="px-2.5 py-[7px] text-[11px] font-bold text-ink-dark whitespace-nowrap">
                {STAGE_LABEL[s.stage]}
              </td>
              <td className="px-2.5 py-[7px]">
                <span className={cn('pill border', RISK_META[s.riskGrade].cls)}>{s.riskGrade}</span>
              </td>
              <td className="px-2.5 py-[7px] whitespace-nowrap">
                {s.highImpact ? (
                  <span className="pill bg-bad-bg text-bad border border-bad-border">해당</span>
                ) : (
                  <span className="pill bg-surface text-ink-mid border border-line-soft">비해당</span>
                )}
              </td>
              <td className="px-2.5 py-[7px] text-[11px] text-ink-mid font-semibold">
                {s.highImpactBasis ?? '—'}
              </td>
              <td className="px-2.5 py-[7px] text-[11px] font-bold whitespace-nowrap">
                {s.genAiNotice ? <span className="text-ok">적용</span> : <span className="text-ink-light">미적용</span>}
              </td>
              <td className="px-2.5 py-[7px] text-[11px] text-ink-mid font-semibold whitespace-nowrap">{s.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════ 소품 ═══════════════════════ */

function TagBlock({ title, items, tone }: { title: string; items: string[]; tone: 'info' | 'purple' }) {
  const cls =
    tone === 'info'
      ? 'bg-info-bg text-info border-info-border'
      : 'bg-accent-purple-bg text-accent-purple border-accent-purple-border';
  return (
    <div>
      <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.4px] mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span key={t} className={cn('pill border', cls)}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ cls, label, solid }: { cls: string; label: string; solid?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2.5 h-2.5 rounded-sm', cls, !solid && 'opacity-35')} />
      <span className="text-[10.5px] text-ink-mid font-semibold">{label}</span>
    </span>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ink-mid font-semibold">{k}</span>
      <span className="ml-auto text-[11.5px] font-extrabold text-ink-dark">{v}</span>
    </div>
  );
}
