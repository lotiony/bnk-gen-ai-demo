/**
 * 계열사별 미터링 · Chargeback — 핸드오프 §2 화면 11.
 *
 * RFP: LSM-010 · ONM-005
 *
 * 정산 화면이 신뢰를 얻으려면 **규칙이 화면에 있어야 한다.** 숫자만 던지면
 * "이 금액이 왜 우리 것이냐"는 질문에 답할 수 없다. 그래서
 *   ① 입력/출력을 나눠 보여주고 ② 배분 규칙(가중치)을 그대로 적고
 *   ③ 계열사 → 부서로 한 번 더 내려간다.
 *
 * 총액은 관리자 대시보드 비용 탭과 **같은 함수**에서 온다. 두 화면이 다른
 * 숫자를 말하면 그 자체가 리스크다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import {
  getMeteringRows,
  getDeptRows,
  getUserRows,
  getMeteringTotals,
  BILLING_MONTH,
  BILLING_RULES,
  OUTPUT_WEIGHT,
  SETTLEMENT_REPORTS,
  getAgentRows,
} from '@/data/mockMetering';
import { useTenant } from '@/lib/tenantStore';
import { toast } from '@/lib/toast';
import StatusPill from '@/components/ui/StatusPill';

const fmtTok = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;
const fmtKRW = (n: number) => n.toLocaleString('ko-KR');

export default function MeteringPage() {
  const rows = useMemo(() => getMeteringRows(), []);
  const totals = useMemo(() => getMeteringTotals(), []);
  /*
   * 상단 Namespace 스위처를 따라간다 — 계열사를 바꾸면 부서 분해가 그 계열사로
   * 열린다. 그룹 공통을 고르면 사용액 1위 계열사를 기본으로 잡는다.
   */
  const tenant = useTenant();
  const initialPick = rows.some((r) => r.name === tenant) ? tenant : (rows[0]?.name ?? '');
  const [picked, setPicked] = useState<string>(initialPick);
  const [pickedTenant, setPickedTenant] = useState<string>(tenant);
  if (pickedTenant !== tenant) {
    // 렌더 중 동기화 — 테넌트가 바뀌면 부서/사용자 선택을 새 계열사로 리셋한다.
    setPickedTenant(tenant);
    setPicked(rows.some((r) => r.name === tenant) ? tenant : (rows[0]?.name ?? ''));
  }
  const depts = useMemo(() => getDeptRows(picked), [picked]);
  const [pickedDept, setPickedDept] = useState<string | null>(null);
  const effectiveDept = pickedDept && depts.some((d) => d.dept === pickedDept)
    ? pickedDept
    : (depts[0]?.dept ?? null);
  const users = useMemo(
    () => (effectiveDept ? getUserRows(picked, effectiveDept) : []),
    [picked, effectiveDept],
  );
  const maxCost = Math.max(...rows.map((r) => r.monthCost), 1);
  const agentRows = useMemo(() => getAgentRows(), []);

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">
            계열사별 미터링 · Chargeback
          </h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            정산 대상 월 <b className="text-ink-dark">{BILLING_MONTH}</b> · 계열사 {rows.length}개 ·
            입력/출력 토큰 분리 계측
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
          <span className="rfp-chip text-[10px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
            대응 요건
          </span>
          {['LSM-010', 'ONM-005'].map((r) => (
            <span key={r} className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard
          label="전사 토큰"
          value={fmtTok(totals.total)}
          sub={`입력 ${fmtTok(totals.input)} · 출력 ${fmtTok(totals.output)}`}
          tone="ok"
        />
        <KpiCard
          label="전사 정산액"
          value={`₩${fmtKRW(totals.cost)}`}
          sub={`입력분 ₩${fmtKRW(totals.inputCost)} · 출력분 ₩${fmtKRW(totals.outputCost)}`}
          tone="ok"
        />
        {/*
          단가(₩/1M)를 헤드라인으로 박지 않는다. 가격 산정은 이 데모의 범위 밖이고
          (핸드오프 §8), 화면에 적힌 수치는 제안 확약으로 읽힌다(RFP Ⅳ.4.1).
          배분 규칙(가중치)은 아래 '정산 규칙'에 그대로 적어 두었다.
        */}
        <KpiCard
          label="출력 토큰 비중"
          value={`${((totals.output / totals.total) * 100).toFixed(1)}%`}
          sub={`배분 시 출력 가중치 ${OUTPUT_WEIGHT}배 적용`}
          tone="warn"
        />
        <KpiCard
          label="최다 사용 계열사"
          value={totals.topTenant?.name ?? '-'}
          sub={`₩${fmtKRW(totals.topTenant?.monthCost ?? 0)} · 비중 ${(totals.topTenant?.pct ?? 0).toFixed(1)}%`}
          tone="warn"
        />
      </div>

      {/* ── 계열사별 정산표 ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[14px] font-extrabold text-ink">계열사별 월 정산</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            행을 누르면 아래에 <b className="text-ink-dark">부서별 분해</b>가 열린다
          </span>
          <span className="ml-auto text-[11px] text-ink-mid font-bold">{rows.length}개 계열사</span>
        </div>
        <div className="border border-line-soft rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft">
                  계열사
                </th>
                {['입력 토큰', '출력 토큰', '합계', '입력분', '출력분', '정산액', '비중', '전월비', '에이전트'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-right text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.name === picked;
                return (
                  <tr
                    key={r.name}
                    onClick={() => setPicked(r.name)}
                    className={cn(
                      'border-b border-line-soft last:border-b-0 cursor-pointer hover:bg-surface-soft',
                      on && 'bg-brand-bg hover:bg-brand-bg',
                    )}
                  >
                    <td className="px-2.5 py-[7px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="text-[11.5px] font-extrabold text-ink-dark whitespace-nowrap">
                          {r.name}
                        </span>
                        <span className="text-[9.5px] font-mono text-ink-light whitespace-nowrap">
                          {r.namespace}
                        </span>
                      </div>
                    </td>
                    <Num v={fmtTok(r.inputTokens)} />
                    <Num v={fmtTok(r.outputTokens)} />
                    <Num v={fmtTok(r.totalTokens)} bold />
                    <Num v={`₩${fmtKRW(r.inputCost)}`} muted />
                    <Num v={`₩${fmtKRW(r.outputCost)}`} muted />
                    <Num v={`₩${fmtKRW(r.monthCost)}`} bold />
                    <td className="px-2.5 py-[7px] text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-[44px] h-[6px] rounded-full bg-line-soft overflow-hidden inline-block">
                          <span
                            className="block h-full"
                            style={{ width: `${(r.monthCost / maxCost) * 100}%`, backgroundColor: r.color }}
                          />
                        </span>
                        <span className="text-[11px] font-bold text-ink-mid tabular-nums w-[34px] text-right">
                          {r.pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2.5 py-[7px] text-right whitespace-nowrap">
                      <span
                        className={cn(
                          'text-[11px] font-extrabold tabular-nums',
                          r.deltaPct > 0 ? 'text-bad' : r.deltaPct < 0 ? 'text-ok' : 'text-ink-mid',
                        )}
                      >
                        {r.deltaPct > 0 ? '▲' : r.deltaPct < 0 ? '▼' : '–'}{' '}
                        {Math.abs(r.deltaPct).toFixed(1)}%
                      </span>
                    </td>
                    <Num v={String(r.agents)} muted />
                  </tr>
                );
              })}
              <tr className="bg-surface-soft font-extrabold">
                <td className="px-2.5 py-2 text-[11.5px] text-ink">합계</td>
                <Num v={fmtTok(totals.input)} bold />
                <Num v={fmtTok(totals.output)} bold />
                <Num v={fmtTok(totals.total)} bold />
                <Num v={`₩${fmtKRW(totals.inputCost)}`} bold />
                <Num v={`₩${fmtKRW(totals.outputCost)}`} bold />
                <Num v={`₩${fmtKRW(totals.cost)}`} bold />
                <Num v="100.0%" bold />
                <td />
                <Num v={String(rows.reduce((a, r) => a + r.agents, 0))} bold />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 입력/출력 구성 + 부서별 ── */}
      <div className="grid grid-cols-[1fr_1fr] gap-3.5 mb-3.5">
        <section className="card px-5 py-4">
          <h2 className="text-[14px] font-extrabold text-ink mb-1">입력 · 출력 구성</h2>
          <p className="text-[11px] text-ink-mid font-semibold mb-3">
            업무 성격에 따라 출력 비중이 다르다 — 상담 요약은 출력이 길고, 조회·분류는 입력이 길다
          </p>
          <div className="space-y-1.5">
            {rows.map((r) => {
              const outPct = (r.outputTokens / r.totalTokens) * 100;
              return (
                <div key={r.name} className="grid grid-cols-[92px_1fr_54px] items-center gap-2">
                  <span className="text-[11px] font-bold text-ink-dark truncate">{r.name}</span>
                  <span className="h-[14px] rounded-sm overflow-hidden flex bg-line-soft">
                    <span className="bg-info h-full" style={{ width: `${100 - outPct}%` }} />
                    <span className="bg-brand h-full" style={{ width: `${outPct}%` }} />
                  </span>
                  <span className="text-[10.5px] font-bold text-ink-mid tabular-nums text-right">
                    출력 {outPct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2.5 border-t border-line-soft flex items-center gap-3">
            <Legend cls="bg-info" label="입력 토큰" />
            <Legend cls="bg-brand" label="출력 토큰" />
          </div>
        </section>

        <section className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">부서별 분해</h2>
            <span className="pill bg-brand-tint text-brand border border-brand-tint">{picked}</span>
          </div>
          <p className="text-[11px] text-ink-mid font-semibold mb-3">
            계열사 정산액을 부서 사용 비율로 재분배한다 · 부서는 SSO 조직 정보를 따른다
          </p>
          <div className="border border-line-soft rounded overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-soft">
                  <th className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft">
                    부서
                  </th>
                  {['이용자', '입력', '출력', '정산액', '비중'].map((h) => (
                    <th
                      key={h}
                      className="text-right text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depts.map((d) => (
                  <tr
                    key={d.dept}
                    onClick={() => setPickedDept(d.dept)}
                    className={cn(
                      'border-b border-line-soft last:border-b-0 cursor-pointer',
                      effectiveDept === d.dept ? 'bg-brand-bg' : 'hover:bg-surface-soft',
                    )}
                  >
                    <td className="px-2.5 py-[7px] text-[11.5px] font-extrabold text-ink-dark whitespace-nowrap">
                      {d.dept}
                    </td>
                    <Num v={d.users.toLocaleString('ko-KR')} muted />
                    <Num v={fmtTok(d.inputTokens)} />
                    <Num v={fmtTok(d.outputTokens)} />
                    <Num v={`₩${fmtKRW(d.cost)}`} bold />
                    <Num v={`${d.pct.toFixed(0)}%`} muted />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── 사용자별 분해 (LSM-010 "개별 사용자별") ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">사용자별 분해</h2>
          <span className="pill bg-brand-tint text-brand border border-brand-tint">
            {picked} · {effectiveDept ?? '-'}
          </span>
          <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            LSM-010
          </span>
        </div>
        <p className="text-[11px] text-ink-mid font-semibold mb-3">
          부서 표에서 행을 누르면 해당 부서의 상위 이용자로 내려간다 · 이름은 감사 목적 외
          노출하지 않으므로 마스킹 ID 로 적산한다
        </p>
        <div className="border border-line-soft rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft">
                  사용자
                </th>
                {['입력', '출력', '정산액', '부서 내 비중'].map((h) => (
                  <th
                    key={h}
                    className="text-right text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.maskedId + u.name} className="border-b border-line-soft last:border-b-0">
                  <td className="px-2.5 py-[7px] text-[11.5px] whitespace-nowrap">
                    <span className="font-mono font-bold text-ink-mid">{u.maskedId}</span>
                    <span className="ml-2 font-extrabold text-ink-dark">{u.name}</span>
                  </td>
                  <Num v={fmtTok(u.inputTokens)} />
                  <Num v={fmtTok(u.outputTokens)} />
                  <Num v={`₩${fmtKRW(u.cost)}`} bold />
                  <Num v={`${u.pct.toFixed(0)}%`} muted />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 에이전트별 미터링 (AGB-010) ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">에이전트별 미터링</h2>
          <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            AGB-010
          </span>
        </div>
        <p className="text-[11px] text-ink-mid font-semibold mb-3">
          조직 축(계열사·부서·사용자)과 별개로 <b className="text-ink-dark">무엇이 비용을 쓰는지</b>를
          본다 · 호출 1건당 비용이 높은 에이전트가 최적화 대상이다
        </p>
        <div className="border border-line-soft rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft">
                  에이전트
                </th>
                {['호출', '입력', '출력', '정산액', '건당', '전월비'].map((h) => (
                  <th
                    key={h}
                    className="text-right text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentRows.map((a) => (
                <tr key={a.agentId} className="border-b border-line-soft last:border-b-0">
                  <td className="px-2.5 py-[7px] whitespace-nowrap">
                    <span className="text-[10px] font-mono font-bold text-ink-mid">
                      {a.agentId}
                    </span>
                    <span className="ml-2 text-[11.5px] font-extrabold text-ink-dark">
                      {a.name}
                    </span>
                    <span className="ml-2 pill bg-surface-soft text-ink-mid border border-line-soft">
                      {a.tenant}
                    </span>
                  </td>
                  <Num v={a.calls.toLocaleString('ko-KR')} />
                  <Num v={fmtTok(a.inputTokens)} />
                  <Num v={fmtTok(a.outputTokens)} />
                  <Num v={`₩${fmtKRW(a.cost)}`} bold />
                  <Num v={`₩${fmtKRW(a.costPerCall)}`} muted />
                  <td
                    className={cn(
                      'px-2.5 py-[7px] text-right text-[11px] font-bold tabular-nums whitespace-nowrap',
                      a.deltaPct > 0 ? 'text-bad' : 'text-ok',
                    )}
                  >
                    {a.deltaPct > 0 ? '▲' : '▼'} {Math.abs(a.deltaPct).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 월별 정산 리포트 자동 생성 (ONM-005) ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">월별 정산 리포트</h2>
          <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            ONM-005
          </span>
        </div>
        <p className="text-[11px] text-ink-mid font-semibold mb-3">
          매월 1일 06:00 에 전 계열사 정산 리포트가 자동 산출된다 · 산출물은 사내 과금 근거로
          그대로 쓰인다
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {SETTLEMENT_REPORTS.map((r) => {
            const cost = r.state === 'scheduled' ? totals.cost : r.totalCost;
            return (
              <div key={r.id} className="border border-line-soft rounded px-3 py-2.5 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12.5px] font-extrabold text-ink tabular-nums">
                    {r.month}
                  </span>
                  <StatusPill tone={r.state === 'issued' ? 'ok' : 'warn'}>
                    {r.state === 'issued' ? '산출 완료' : '산출 예정'}
                  </StatusPill>
                </div>
                <div className="text-[11px] text-ink-mid font-semibold">{r.runAt}</div>
                <div className="text-[11px] text-ink-dark font-semibold mt-1">
                  계열사 {r.tenants}개 · 합계{' '}
                  <b className="text-ink tabular-nums">₩{fmtKRW(cost)}</b>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {r.formats.map((f) => (
                    <button
                      key={f}
                      type="button"
                      disabled={r.state === 'scheduled'}
                      onClick={() => toast(`${r.month} 정산 리포트 · ${f} 내려받기`)}
                      className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-[3px] hover:border-brand-dark hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ↓ {f}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 정산 규칙 ── */}
      <section className="card px-5 py-4">
        <h2 className="text-[14px] font-extrabold text-ink mb-2.5">정산 규칙</h2>
        <div className="grid grid-cols-4 gap-3">
          {BILLING_RULES.map((r) => (
            <div key={r.k} className="border-l-2 border-line pl-3">
              <div className="text-[11.5px] font-extrabold text-ink-dark mb-0.5">{r.k}</div>
              <div className="text-[11px] text-ink-mid font-semibold leading-relaxed">{r.v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Num({ v, bold, muted }: { v: string; bold?: boolean; muted?: boolean }) {
  return (
    <td
      className={cn(
        'px-2.5 py-[7px] text-right text-[11px] tabular-nums whitespace-nowrap',
        bold ? 'font-extrabold text-ink' : muted ? 'font-semibold text-ink-mid' : 'font-bold text-ink-dark',
      )}
    >
      {v}
    </td>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2.5 h-2.5 rounded-sm', cls)} />
      <span className="text-[10.5px] text-ink-mid font-semibold">{label}</span>
    </span>
  );
}
