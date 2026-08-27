/**
 * AI 거버넌스 포탈 — 포탈 관리 (RFP 2-3 「관리자 기능」 + 「Flow Diagram」 확장성 조항).
 *
 * RFP: 2-3 AI거버넌스 포탈 > 관리자 기능
 *      · 부서별 담당자 설정 화면 제공
 *      · 각 단계 도래 시 알림 제공(그룹웨어 메일/메신저 등)
 *      · 보고서 export 기능 제공(사업 건별 및 전체)
 *      · 필요 단계별 파일 업로드 기능 제공
 *      2-3 AI거버넌스 포탈 > Flow Diagram
 *      · 각 단계별 타시스템의 트리거 추가 입력 On/Off 설정
 *
 * 담당자·알림은 **테넌트별로 다르다**. RFP 인프라 나-(3)이 "회사별 일부 절차가
 * 상이하므로" 를 명시하므로, 상단 테넌트 스위처를 바꾸면 담당자 표가 갈린다.
 * 이 화면이 그 조항의 시각적 증거다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { useTenant } from '@/lib/tenantStore';
import { toast } from '@/lib/toast';
import { LIFECYCLE, STAGE_LABEL, type LifecycleStage } from '@/data/mockAiGovernance';
import {
  getStageOwners,
  OWNER_FALLBACK_NOTE,
  NOTIFY_RULES,
  CHANNEL_LABEL,
  SYSTEM_TRIGGERS,
  STAGE_ATTACHMENTS,
  REPORT_TEMPLATES,
  type NotifyChannel,
} from '@/data/mockGovernanceAdmin';

/** 단계 순번 배지 — 라이프사이클 화면과 같은 시각 언어를 쓴다. */
function StageChip({ stage }: { stage: LifecycleStage }) {
  const seq = LIFECYCLE.find((s) => s.id === stage)?.seq ?? 0;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="w-[16px] h-[16px] rounded-full bg-surface border border-line text-ink-mid inline-flex items-center justify-center text-[9px] font-extrabold tabular-nums">
        {seq}
      </span>
      <span className="text-[11.5px] font-extrabold text-ink">{STAGE_LABEL[stage]}</span>
    </span>
  );
}

function Section({
  title,
  req,
  desc,
  children,
}: {
  title: string;
  req: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4 mb-3">
      <div className="flex items-start gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-extrabold text-ink">{title}</h2>
          <p className="text-[11px] text-ink-mid font-semibold mt-0.5 leading-snug">{desc}</p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-0.5">
          {req}
        </span>
      </div>
      {children}
    </section>
  );
}

/** 켜짐/꺼짐 토글 — 데모용. 상태는 메모리에만 산다. */
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'relative w-[34px] h-[19px] rounded-full border transition-colors flex-shrink-0',
        on ? 'bg-brand-dark border-brand-dark' : 'bg-surface border-line',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] w-[13px] h-[13px] rounded-full bg-white transition-all shadow-sm',
          on ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}

export default function GovernanceAdminPage() {
  const tenant = useTenant();
  const { rows: owners, delegated } = useMemo(() => getStageOwners(tenant), [tenant]);

  const [notifyOn, setNotifyOn] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(NOTIFY_RULES.map((r, i) => [i, r.enabled])),
  );
  const [triggerOn, setTriggerOn] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(SYSTEM_TRIGGERS.map((t, i) => [i, t.enabled])),
  );

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">포탈 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            담당자 · 알림 · 타시스템 트리거 · 제출 서류 · 보고서 산출을 설정한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          2-3 관리자 기능
        </span>
      </div>

      {/* ── ① 부서별 담당자 ── */}
      <Section
        title="부서별 담당자 설정"
        req="2-3 · 부서별 담당자"
        desc={`${tenant} 기준 · 단계별 1차 담당자와 부재 시 대리자를 지정한다`}
      >
        {delegated && (
          <div className="border border-warn-border bg-warn-bg rounded px-3 py-2 mb-2.5 text-[11px] font-semibold text-ink-dark leading-snug">
            <b className="text-warn">{tenant}</b> 는 아직 담당자를 지정하지 않았다 —{' '}
            {OWNER_FALLBACK_NOTE}
          </div>
        )}
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="text-left text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] border-b border-line-soft">
              <th className="py-1.5 pr-3 font-extrabold">단계</th>
              <th className="py-1.5 pr-3 font-extrabold">담당 부서</th>
              <th className="py-1.5 pr-3 font-extrabold">1차 담당자</th>
              <th className="py-1.5 pr-3 font-extrabold">부재 시 대리</th>
              <th className="py-1.5 pr-3 font-extrabold">지정일</th>
              <th className="py-1.5 font-extrabold text-right">변경</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.stage} className="border-b border-line-soft last:border-0">
                <td className="py-2 pr-3">
                  <StageChip stage={o.stage} />
                </td>
                <td className="py-2 pr-3 font-bold text-ink-dark">{o.dept}</td>
                <td className="py-2 pr-3 font-extrabold text-ink">{o.owner}</td>
                <td className="py-2 pr-3 font-semibold text-ink-mid">{o.backup}</td>
                <td className="py-2 pr-3 font-semibold text-ink-mid tabular-nums">
                  {o.assignedAt}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      toast(`${STAGE_LABEL[o.stage]} 단계 담당자 변경 — 감사 원장에 기록됩니다`)
                    }
                    className="text-[11px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-brand-dark hover:text-brand"
                  >
                    담당자 지정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ── ② 단계 도래 알림 ── */}
      <Section
        title="단계 도래 알림"
        req="2-3 · 단계 도래 시 알림"
        desc="기일이 도래하면 그룹웨어 메일 · 메신저 · 포탈 알림함으로 담당자에게 통지한다"
      >
        <div className="space-y-1.5">
          {NOTIFY_RULES.map((r, i) => {
            const on = notifyOn[i];
            return (
              <div
                key={`${r.stage}-${i}`}
                className={cn(
                  'grid grid-cols-[92px_1fr_auto_auto_auto] gap-3 items-center px-3 py-2 rounded border',
                  on ? 'bg-white border-line-soft' : 'bg-surface-soft border-line-soft opacity-70',
                )}
              >
                <StageChip stage={r.stage} />
                <div className="min-w-0">
                  <div className="text-[11.5px] font-bold text-ink truncate">{r.trigger}</div>
                </div>
                <div className="flex items-center gap-1">
                  {r.channels.map((c: NotifyChannel) => (
                    <span
                      key={c}
                      className="pill bg-info-bg text-info border border-info-border whitespace-nowrap"
                    >
                      {CHANNEL_LABEL[c]}
                    </span>
                  ))}
                </div>
                <span className="text-[10.5px] font-bold text-ink-mid tabular-nums whitespace-nowrap">
                  최근 30일 {r.sent30d}건
                </span>
                <Toggle
                  on={on}
                  label={`${r.trigger} 알림`}
                  onClick={() => setNotifyOn((s) => ({ ...s, [i]: !s[i] }))}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── ③ 타시스템 트리거 ── */}
      <Section
        title="타시스템 트리거 연동"
        req="2-3 · 단계별 트리거 On/Off"
        desc="ITSM 등 기존 시스템과 단계별로 주고받는 트리거를 켜고 끈다 — 신규 시스템 추가를 감안한 확장 구조"
      >
        <div className="space-y-1.5">
          {SYSTEM_TRIGGERS.map((t, i) => {
            const on = triggerOn[i];
            return (
              <div
                key={`${t.stage}-${t.system}-${i}`}
                className={cn(
                  'grid grid-cols-[92px_120px_1fr_auto_auto_auto] gap-3 items-center px-3 py-2 rounded border',
                  on ? 'bg-white border-line-soft' : 'bg-surface-soft border-line-soft opacity-70',
                )}
              >
                <StageChip stage={t.stage} />
                <span className="text-[11.5px] font-extrabold text-ink truncate">{t.system}</span>
                <span className="text-[11px] font-semibold text-ink-dark leading-snug">
                  {t.desc}
                </span>
                <StatusPill tone={t.direction === 'outbound' ? 'info' : 'neutral'}>
                  {t.direction === 'outbound' ? '발신 →' : '← 수신'}
                </StatusPill>
                <span className="text-[10px] font-bold text-ink-mid font-mono whitespace-nowrap">
                  {t.iface}
                </span>
                <Toggle
                  on={on}
                  label={`${t.system} 트리거`}
                  onClick={() => setTriggerOn((s) => ({ ...s, [i]: !s[i] }))}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[10.5px] text-ink-mid font-semibold mt-2.5 leading-snug">
          🔗 트리거 추가는 단계 정의를 건드리지 않는다 — 연동 대상이 늘어도 라이프사이클
          자체는 그대로 둔 채 행만 추가된다.
        </p>
      </Section>

      {/* ── ④ 단계별 제출 서류 ── */}
      <Section
        title="단계별 제출 서류"
        req="2-3 · 단계별 파일 업로드"
        desc="관문 통과에 필요한 첨부를 단계별로 정의하고, 제출 현황을 추적한다"
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {STAGE_ATTACHMENTS.map((a, i) => {
            const complete = a.submitted >= a.total;
            return (
              <div
                key={`${a.stage}-${a.docName}-${i}`}
                className="grid grid-cols-[92px_1fr_auto_auto] gap-2.5 items-center px-3 py-2 rounded border border-line-soft bg-white"
              >
                <StageChip stage={a.stage} />
                <div className="min-w-0">
                  <div className="text-[11.5px] font-bold text-ink truncate">
                    {a.docName}
                    {a.required && <span className="text-bad ml-1">*</span>}
                  </div>
                  <div className="text-[10px] text-ink-mid font-semibold mt-0.5">{a.formats}</div>
                </div>
                <span
                  className={cn(
                    'text-[11px] font-extrabold tabular-nums whitespace-nowrap',
                    complete ? 'text-ok' : 'text-warn',
                  )}
                >
                  {a.submitted}/{a.total}
                </span>
                <button
                  type="button"
                  onClick={() => toast(`${a.docName} 업로드 — 단계 첨부로 원장에 연결됩니다`)}
                  className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-brand-dark hover:text-brand whitespace-nowrap"
                >
                  업로드
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[10.5px] text-ink-mid font-semibold mt-2.5">
          <span className="text-bad font-extrabold">*</span> 표시는 필수 첨부다 — 미제출 시 다음
          단계 결재가 반려된다.
        </p>
      </Section>

      {/* ── ⑤ 보고서 Export ── */}
      <Section
        title="보고서 산출"
        req="2-3 · 보고서 export(건별/전체)"
        desc="사업 건별 이력서와 전체 총괄표를 각각 산출한다"
      >
        <div className="grid grid-cols-2 gap-2">
          {REPORT_TEMPLATES.map((r) => (
            <div
              key={r.id}
              className="border border-line-soft rounded px-3 py-2.5 bg-white flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <StatusPill tone={r.scope === '건별' ? 'neutral' : 'info'}>{r.scope}</StatusPill>
                <span className="text-[12px] font-extrabold text-ink truncate">{r.name}</span>
              </div>
              <p className="text-[10.5px] text-ink-mid font-semibold leading-snug">{r.desc}</p>
              <div className="flex items-center gap-1.5 mt-auto pt-1">
                {r.formats.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toast(`${r.name} · ${f} 산출을 시작합니다`)}
                    className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-[3px] hover:border-brand-dark hover:text-brand"
                  >
                    ↓ {f}
                  </button>
                ))}
                <span className="ml-auto text-[9.5px] text-ink-light font-semibold tabular-nums">
                  {r.lastRunAt ? `최근 ${r.lastRunAt}` : '산출 이력 없음'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
