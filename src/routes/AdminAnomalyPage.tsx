/**
 * 관리 콘솔 — 이상 탐지 · 실행 로그 · 원인 진단. 시연 3막 파트 A (3A-2 · 3A-5 · 3A-6).
 *
 * RFP: AGB-009(에이전트 실행 로그·중간 추론 기록·관리자 추적, 필수) ·
 *      ONM-002(모니터링) · SEC-009(감사 추적)
 *
 * 한 화면에서 **탐지 → 조사 → 진단**까지 간다. 화면을 셋으로 쪼개면 시연에서
 * 이동만 하다 끝나고, 무엇보다 "무엇을 보고 그렇게 판단했는지" 가 흩어진다.
 *
 * ⚠️ 조치 버튼을 두지 않는다. 관리자는 원인을 **판단**해 개발팀에 넘기고,
 *    실제 수정은 워크플로우 배포 결재를 타야 한다. 여기서 눌러 고치는 그림을
 *    그리면 그게 그대로 계약 확약이 된다(RFP Ⅳ.4.1).
 *
 * 화면 아래쪽의 「운영 대응 이력」은 **이미 끝난** 건이다(외환 시나리오 화면 13).
 * 지금 조사할 건과 섞지 않으려고 축을 나눴다. 운영의 가치는 무장애가 아니라
 * 되짚을 수 있음이라서, 처리 완료 기록도 화면에 남긴다(SEC-009).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { useCurrentPersona } from '@/lib/persona';
import {
  ANOMALY_ALERTS,
  SURGE_CALL_LOG,
  REPEAT_CALLERS,
  LOOP_DIAGNOSIS,
  resolvedIncidentsFor,
  type ResolvedIncident,
} from '@/data/mockAffiliateOps';

export default function AdminAnomalyPage() {
  const persona = useCurrentPersona();
  /*
   * 그룹 조망 권한인가 — 공동존을 운영·감독하는 역할만 계열사를 가로질러 본다
   * (SEC-001). 계열사 관리자는 자기 Namespace 만 본다.
   */
  const wide = !!persona?.canSwitchTenant;
  const alerts = ANOMALY_ALERTS.filter(
    (a) => wide || !persona?.tenant || a.tenant === persona.tenant,
  );
  const incidents = resolvedIncidentsFor(persona?.tenant, wide);
  const [openId, setOpenId] = useState<string | null>(alerts[0]?.id ?? null);
  /** 3A-5·3A-6 은 「상세 조사」를 눌러야 열린다 — 탐지와 조사를 시연에서 나눈다. */
  const [investigating, setInvestigating] = useState(false);
  const alert = alerts.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">이상 탐지</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            <b className="text-ink-dark">{wide ? '그룹 전체' : persona?.tenant}</b>
            {wide ? ' 11개 Namespace 의' : ' Namespace 의'} 사용량·응답 이상을 규칙으로 감지한다 ·
            판단과 조치는 관리자 몫이다
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
          {['AGB-009', 'ONM-002', 'SEC-009'].map((r) => (
            <span key={r} className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              {r}
            </span>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <div className="text-[26px] mb-2">✓</div>
          <h2 className="text-[14px] font-extrabold text-ink mb-1">감지된 이상이 없습니다</h2>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3.5">
          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setOpenId(a.id); setInvestigating(false); }}
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 bg-white border rounded text-left',
                openId === a.id ? 'border-bad' : 'border-bad-border hover:border-bad',
              )}
            >
              <span className="pill bg-bad-bg text-bad border border-bad-border">⚠ {a.severity}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-ink">{a.headline}</div>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                  {a.agentId} · {a.taskName} · 감지 {a.detectedAt}
                </div>
              </div>
              <span className="text-[11px] font-extrabold text-bad tabular-nums whitespace-nowrap">
                ×{a.multiple.toFixed(1)}
              </span>
              <span className="text-[11px] font-extrabold text-info">
                {openId === a.id ? '선택됨' : '열기 →'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── 3A-2 이상 알림 상세 ── */}
      {alert && (
        <section className="card px-5 py-4 mb-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <h2 className="text-[14px] font-extrabold text-ink">이상 상세</h2>
            <span className="text-[10px] font-mono font-bold text-ink-light">{alert.id}</span>
            <StatusPill tone="bad">조사 필요</StatusPill>
          </div>

          <div className="grid grid-cols-4 gap-2.5 mb-3">
            <Cell label="대상 자산" value={alert.agentName} sub={`${alert.agentId} · ${alert.taskId}`} />
            <Cell label="직전 14일 일평균" value={alert.baselineCalls.toLocaleString('ko-KR')} sub="정상 구간 기준선" />
            <Cell label="어제 호출" value={alert.currentCalls.toLocaleString('ko-KR')} sub={`기준선 대비 ×${alert.multiple.toFixed(1)}`} bad />
            <Cell label="영향 사용자" value={`${alert.affectedUsers}명`} sub="응답 지연을 겪은 사용자" bad />
          </div>

          {/* 감지 규칙 — 근거 없는 알림은 관제가 아니다 */}
          <div className="rounded border border-line-soft bg-surface-soft px-3.5 py-2.5 mb-3">
            <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px] mb-1">
              감지 규칙
            </div>
            <div className="text-[12px] font-extrabold text-ink">{alert.rule}</div>
            <div className="text-[11px] text-ink-dark font-semibold mt-0.5 leading-relaxed">
              {alert.ruleDetail}
            </div>
            <div className="text-[11px] text-ink-mid font-semibold mt-1">
              급증 시작 <b className="text-ink-dark">{alert.surgeFrom}</b> · 감지{' '}
              <b className="text-ink-dark">{alert.detectedAt}</b>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/metering"
              className="h-8 px-3 inline-flex items-center rounded border border-line text-[12px] font-extrabold text-ink-dark hover:border-brand-dark"
            >
              미터링에서 급증 시점 보기
            </Link>
            <button
              type="button"
              onClick={() => setInvestigating(true)}
              disabled={investigating}
              className="h-8 px-3.5 inline-flex items-center rounded bg-brand border border-brand-dark text-[12px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {investigating ? '조사 중 — 아래 결과 확인' : '상세 조사 →'}
            </button>
          </div>
        </section>
      )}

      {/* ── 3A-5 실행 로그 ── */}
      {alert && investigating && (
        <>
          <section className="card px-5 py-4 mb-3.5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[14px] font-extrabold text-ink">실행 로그</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                {alert.agentId} · 최근 호출 · 처리 시간과 호출 간격을 함께 본다
              </span>
              <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
                AGB-009
              </span>
            </div>
            <p className="text-[11px] text-ink-mid font-semibold mb-3">
              사용자 식별자는 마스킹해 적산한다 — 감사 목적 외에는 실명을 노출하지 않는다
            </p>

            {/* 반복 호출 상위 */}
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {REPEAT_CALLERS.map((c, i) => (
                <div
                  key={c.maskedUser}
                  className={cn(
                    'rounded border px-3 py-2.5',
                    i === 0 ? 'border-bad-border bg-bad-bg' : 'border-line-soft bg-white',
                  )}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11.5px] font-mono font-extrabold text-ink-dark">{c.maskedUser}</span>
                    <span className="text-[10px] text-ink-mid font-semibold">{c.dept}</span>
                  </div>
                  <div className={cn('text-[16px] font-extrabold tabular-nums mt-0.5', i === 0 ? 'text-bad' : 'text-ink')}>
                    {c.calls24h.toLocaleString('ko-KR')}
                    <span className="text-[10.5px] font-semibold text-ink-mid ml-1">회 / 24h</span>
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold">
                    평균 간격 {c.avgGapSec}초 · 전체의 {c.sharePct.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-line-soft rounded overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-soft">
                    {['시각', '사용자', '부서', '질의', '간격', '처리 시간', '상태'].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap',
                          i >= 4 ? 'text-right' : 'text-left',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SURGE_CALL_LOG.map((r, i) => {
                    const loop = r.repeatSeq > 1;
                    return (
                      <tr
                        key={i}
                        className={cn('border-b border-line-soft last:border-b-0', loop && 'bg-bad-bg/40')}
                      >
                        <td className="px-2.5 py-[7px] text-[10.5px] font-mono font-semibold text-ink-mid whitespace-nowrap">{r.at}</td>
                        <td className="px-2.5 py-[7px] text-[11px] font-mono font-bold text-ink-dark whitespace-nowrap">
                          {r.maskedUser}
                          {loop && <span className="ml-1.5 pill bg-bad-bg text-bad border border-bad-border">{r.repeatSeq}회째</span>}
                        </td>
                        <td className="px-2.5 py-[7px] text-[11px] font-semibold text-ink-mid whitespace-nowrap">{r.dept}</td>
                        <td className="px-2.5 py-[7px] text-[11px] font-semibold text-ink-dark truncate max-w-[280px]">{r.query}</td>
                        <td className={cn('px-2.5 py-[7px] text-right text-[11px] font-bold tabular-nums whitespace-nowrap', loop ? 'text-bad' : 'text-ink-light')}>
                          {r.gapSec === null ? '—' : `${r.gapSec}초`}
                        </td>
                        <td className={cn('px-2.5 py-[7px] text-right text-[11px] font-extrabold tabular-nums whitespace-nowrap', r.ms > 5000 ? 'text-bad' : 'text-ink-dark')}>
                          {(r.ms / 1000).toFixed(1)}s
                        </td>
                        <td className="px-2.5 py-[7px] text-right whitespace-nowrap">
                          <StatusPill tone={r.status === '정상' ? 'ok' : r.status === '지연' ? 'warn' : 'bad'}>
                            {r.status}
                          </StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 3A-6 시스템 진단 ── */}
          <section className="card px-5 py-4 border border-warn-border">
            <div className="flex items-center gap-2 mb-2.5">
              <h2 className="text-[14px] font-extrabold text-ink">시스템 진단</h2>
              <StatusPill tone="bad">{LOOP_DIAGNOSIS.verdict}</StatusPill>
              <span className="text-[11px] text-ink-mid font-semibold">
                신뢰도 {LOOP_DIAGNOSIS.confidence}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {LOOP_DIAGNOSIS.signals.map((s) => (
                <div key={s.k} className="rounded border border-line-soft bg-white px-3 py-2">
                  <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px]">{s.k}</div>
                  <div className="text-[11.5px] font-semibold text-ink-dark mt-0.5 leading-snug">{s.v}</div>
                </div>
              ))}
            </div>

            <div className="rounded border border-warn-border bg-warn-bg px-3.5 py-3">
              <div className="text-[10px] font-extrabold text-warn uppercase tracking-[0.3px] mb-1">
                지목된 원인
              </div>
              <div className="text-[12.5px] font-extrabold text-ink">
                {LOOP_DIAGNOSIS.workflowId} {LOOP_DIAGNOSIS.workflowName}
                <span className="text-ink-mid font-semibold"> · {LOOP_DIAGNOSIS.workflowNode}</span>
              </div>
              <p className="text-[11px] text-ink-dark font-semibold mt-1 leading-relaxed">
                영향 사용자 {LOOP_DIAGNOSIS.affectedUsers}명 · 시스템은 패턴을 표시할 뿐이고,
                원인 판단과 조치는 관리자가 한다. 수정은{' '}
                <b>{LOOP_DIAGNOSIS.handoffTo}</b> 이 워크플로우 배포 결재를 거쳐 반영한다.
              </p>
              <div className="mt-2.5">
                <Link
                  to="/studio/workflow"
                  className="h-7 px-3 inline-flex items-center rounded border border-line bg-white text-[11.5px] font-extrabold text-ink-dark hover:border-brand-dark"
                >
                  워크플로우 열기 →
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── 운영 대응 이력 (외환 시나리오 화면 13) ── */}
      {incidents.length > 0 && (
        <section className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">운영 대응 이력</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              처리 완료된 건 · 무엇이 문제였고 어떻게 해결했는지가 남는다
            </span>
            <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              SEC-009
            </span>
          </div>
          <p className="text-[11px] text-ink-mid font-semibold mb-3">
            문제 확인 → 담당자 조치 → 복구 확인까지 한 건으로 묶어 기록한다 · 조치 주체는 항상
            사람이다
          </p>
          <div className="flex flex-col gap-2.5">
            {incidents.map((inc) => (
              <IncidentCard key={inc.id} inc={inc} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * 처리 완료된 운영 이슈 한 건.
 *
 * 신고자의 말을 그대로 인용하는 것이 이 카드의 출발점이다 — 운영 기록이
 * 시스템 용어로만 남으면 "무엇이 문제였는지" 가 사용자 관점에서 사라진다.
 */
function IncidentCard({ inc }: { inc: ResolvedIncident }) {
  return (
    <article className="border border-line rounded px-4 py-3.5 bg-white">
      <div className="flex items-baseline gap-2 flex-wrap mb-2">
        <span className="text-[13px] font-extrabold text-ink">{inc.scope}</span>
        <span className="text-[10px] font-mono font-bold text-ink-light">
          {inc.agentId} · {inc.id}
        </span>
        <StatusPill tone="ok" className="ml-auto">
          ✓ {inc.state}
        </StatusPill>
      </div>

      {/* 신고자의 말 그대로 */}
      <blockquote className="border-l-[3px] border-bad-border pl-3 py-0.5 mb-3">
        <p className="text-[14px] font-extrabold text-ink leading-snug">“{inc.report}”</p>
        <p className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
          {inc.reportedBy} · 신고 {inc.reportedAt} · 영향 사용자 {inc.affectedUsers}명 · 복구까지{' '}
          {inc.duration}
        </p>
      </blockquote>

      {/* 문제 확인 → 담당자 조치 → 복구 확인 */}
      <div className="grid grid-cols-3 gap-2.5">
        {inc.steps.map((st, i) => (
          <section
            key={st.k}
            className={cn(
              'rounded border px-3.5 py-3',
              i === inc.steps.length - 1 ? 'border-ok-border bg-ok-bg' : 'border-line-soft bg-surface-soft',
            )}
          >
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-[10px] font-mono font-extrabold text-ink-light">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={cn(
                  'text-[12.5px] font-extrabold',
                  i === inc.steps.length - 1 ? 'text-ok' : 'text-ink',
                )}
              >
                {st.k}
              </span>
            </div>
            <p className="text-[11px] text-ink-dark font-semibold leading-snug">{st.v}</p>
            <div className="mt-1.5 pt-1.5 border-t border-line-soft text-[10px] text-ink-mid font-semibold leading-snug">
              {st.at}
              {st.by && (
                <>
                  <br />
                  {st.by}
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-2.5 text-[10.5px] text-ink-mid font-semibold">
        감사 원장 참조 <b className="text-ink-dark font-mono">{inc.auditRef}</b> · 처리 완료된 가상
        운영 이력입니다
      </p>
    </article>
  );
}

function Cell({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className={cn('rounded border px-3 py-2.5 bg-white', bad ? 'border-bad-border' : 'border-line-soft')}>
      <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px]">{label}</div>
      <div className={cn('text-[16px] font-extrabold tabular-nums mt-0.5 truncate', bad ? 'text-bad' : 'text-ink')} title={value}>
        {value}
      </div>
      {sub && <div className="text-[10.5px] text-ink-mid font-semibold truncate">{sub}</div>}
    </div>
  );
}
