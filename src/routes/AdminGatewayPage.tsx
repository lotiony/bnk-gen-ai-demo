/**
 * 관리 콘솔 — LLM Gateway.
 *
 * RFP: ONM-002 LLM Gateway 아키텍처 (필수)
 * 연계: LSM-008(테넌트 토큰 Quota 설정·제어 · 상세제안필요) · SEC-002(가드레일) ·
 *       ONM-005(토큰 과금) · ONM-001(SSO/AD) · SEC-001(테넌트 격리)
 *
 * 요건의 무게중심은 개별 기능이 아니라 **"단일 통로"** 자체다. 라우팅·가드레일·
 * 미터링은 이미 각각 화면이 있었지만, 그 셋이 하나의 관문을 지난다는 사실을
 * 보여 주는 화면이 없었다. 그래서 이 화면은 인바운드 → 4단 관문 → 모델 풀을
 * 한 줄로 세우고, 각 단이 무엇을 결정하는지와 금일 카운터를 함께 놓는다.
 *
 * 하단 쿼터 표는 LSM-008 이다. 요건의 동사가 "설정 및 제어"라서 읽기 전용
 * 소진율만으로는 절반만 채운다 — 값을 실제로 바꿀 수 있게 한다(메모리 state).
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import { TENANT_SHORT } from '@/data/tenants';
import {
  GATEWAY_INBOUND,
  GATEWAY_STAGES,
  MODEL_POOL,
  EXTERNAL_SLOT,
  ROUTING_RULES,
  QUOTA_ACTIONS,
  QUOTA_ACTION_DESC,
  QUOTA_AS_OF,
  GATEWAY_SCOPE_NOTE,
  buildQuotaRows,
  type QuotaAction,
  type QuotaRow,
  type StageTone,
} from '@/data/mockLlmGateway';

type Tab = 'flow' | 'routing' | 'quota';

const STAGE_TONE: Record<StageTone, 'ok' | 'warn' | 'bad' | 'info'> = {
  ok: 'ok',
  warn: 'warn',
  bad: 'bad',
  info: 'info',
};

const POOL_TONE: Record<string, 'ok' | 'warn' | 'neutral' | 'info'> = {
  '운영 중': 'ok',
  '대기(Fallback)': 'info',
  '검증 트래픽': 'warn',
  미개통: 'neutral',
};

export default function AdminGatewayPage() {
  const [tab, setTab] = useState<Tab>('flow');
  const [rows, setRows] = useState<QuotaRow[]>(() => buildQuotaRows());

  const inboundTotal = useMemo(
    () => GATEWAY_INBOUND.reduce((a, i) => a + i.callsToday, 0),
    [],
  );
  const nearCap = useMemo(
    () => rows.filter((r) => r.monthlyUsedM / r.monthlyCapM >= 0.8).length,
    [rows],
  );

  /** 쿼터 값 변경 — 토스트만 띄우지 않고 실제 state 를 바꾼다(LSM-008 "설정 및 제어"). */
  const setCap = (tenant: string, field: 'dailyCapM' | 'monthlyCapM', value: number) => {
    setRows((prev) =>
      prev.map((r) => (r.tenant === tenant ? { ...r, [field]: value } : r)),
    );
  };
  const setAction = (tenant: string, onExceed: QuotaAction) => {
    setRows((prev) => prev.map((r) => (r.tenant === tenant ? { ...r, onExceed } : r)));
    toast(
      `${TENANT_SHORT[tenant as keyof typeof TENANT_SHORT] ?? tenant} 초과 시 동작을 「${onExceed}」로 변경했습니다`,
      QUOTA_ACTION_DESC[onExceed],
      'ok',
    );
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">LLM Gateway</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            내부·외부 모든 LLM 호출이 지나는 단일 통로 — 인증·라우팅·가드레일·미터링을 한 관문에서 통제한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          ONM-002 · LSM-008
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard
          label="금일 인바운드 요청"
          value={inboundTotal.toLocaleString('ko-KR')}
          unit="건"
          sub={`통로 ${GATEWAY_INBOUND.length}종 · 관문은 하나`}
          tone="ok"
        />
        <KpiCard
          label="서빙 모델"
          value={String(MODEL_POOL.filter((m) => m.status === '운영 중').length)}
          unit={`/ ${MODEL_POOL.length}`}
          sub="전량 공동존 내부 서빙"
          tone="ok"
        />
        <KpiCard
          label="게이트웨이 밖 호출"
          value="0"
          unit="건"
          sub="서빙 Pod 인그레스를 게이트웨이 계정으로만 제한"
          tone="ok"
        />
        <KpiCard
          label="월 상한 80% 초과 테넌트"
          value={String(nearCap)}
          unit={`/ ${rows.length}`}
          sub="초과 시 동작은 테넌트별로 설정"
          tone={nearCap > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-0.5 border-b border-line mb-3.5">
        {[
          { k: 'flow' as const, label: '관문 흐름', req: 'ONM-002' },
          { k: 'routing' as const, label: '라우팅 규칙', req: 'ONM-002 · LSM-003' },
          { k: 'quota' as const, label: '테넌트 쿼터', req: 'LSM-008' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k
                ? 'text-brand border-brand'
                : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[9.5px] font-mono font-bold text-ink-light rfp-chip">
              {t.req}
            </span>
          </button>
        ))}
      </div>

      {/* ── 관문 흐름 ── */}
      {tab === 'flow' && (
        <>
          {/* 인바운드 */}
          <section className="card p-4 mb-2.5">
            <div className="flex items-baseline gap-2 mb-2.5">
              <h2 className="text-[14px] font-extrabold text-ink">① 인바운드</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                호출 주체는 넷이지만 관문은 하나다 — 어느 경로로 들어와도 아래 4단을 그대로 지난다
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GATEWAY_INBOUND.map((i) => (
                <div key={i.id} className="border border-line-soft rounded px-3 py-2.5 bg-surface-soft">
                  <div className="text-[12.5px] font-extrabold text-ink">{i.name}</div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-1 leading-snug">
                    {i.desc}
                  </div>
                  <div className="mt-2 pt-2 border-t border-line-soft flex items-baseline justify-between">
                    <span className="text-[10px] text-ink-light font-bold">금일</span>
                    <span className="text-[13px] font-extrabold text-ink font-mono tabular-nums">
                      {i.callsToday.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-ink-light font-semibold mt-1 leading-snug">
                    {i.auth}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="text-center text-[16px] text-ink-light leading-none mb-2.5">▼</div>

          {/* 4단 관문 */}
          <section className="card p-4 mb-2.5">
            <div className="flex items-baseline gap-2 mb-2.5">
              <h2 className="text-[14px] font-extrabold text-ink">② 게이트웨이 4단</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                각 단은 통과하지 못한 요청을 다음 단으로 넘기지 않는다
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GATEWAY_STAGES.map((s) => (
                <div key={s.id} className="border border-line rounded overflow-hidden flex flex-col">
                  <div className="px-3 py-2 bg-brand-bg border-b border-line-soft">
                    <div className="flex items-center gap-1.5">
                      <span className="w-[18px] h-[18px] rounded-full bg-brand text-white text-[10px] font-extrabold grid place-items-center flex-shrink-0">
                        {s.no}
                      </span>
                      <span className="text-[13px] font-extrabold text-ink">{s.name}</span>
                    </div>
                    <div className="text-[9.5px] font-mono font-bold text-ink-light mt-1">
                      {s.pod}
                    </div>
                  </div>
                  <div className="px-3 py-2.5 flex-1">
                    <p className="text-[10.5px] text-ink-dark font-semibold leading-snug mb-2">
                      {s.summary}
                    </p>
                    <ul className="space-y-1 mb-2.5">
                      {s.policies.map((p) => (
                        <li key={p} className="text-[10px] text-ink-mid font-semibold leading-snug flex gap-1">
                          <span className="text-brand flex-shrink-0">·</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2 border-t border-line-soft space-y-1">
                      {s.counters.map((c) => (
                        <div key={c.label} className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-ink-mid font-semibold">{c.label}</span>
                          <StatusPill tone={STAGE_TONE[c.tone]} className="text-[10px] font-mono tabular-nums">
                            {c.value}
                          </StatusPill>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-surface-soft border-t border-line-soft flex flex-wrap gap-1">
                    {s.reqs.map((r) => (
                      <span
                        key={r}
                        className="pill bg-white text-ink-mid border border-line font-mono text-[9px] tracking-normal rfp-chip"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="text-center text-[16px] text-ink-light leading-none mb-2.5">▼</div>

          {/* 모델 풀 */}
          <section className="card p-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-2.5">
              <h2 className="text-[14px] font-extrabold text-ink">③ 모델 풀</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                카탈로그에 등재된 모델만 라우팅 대상이 된다
              </span>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-ink-mid border-b border-line">
                  <th className="text-left font-bold py-2 px-2">모델</th>
                  <th className="text-left font-bold py-2 px-2">서빙</th>
                  <th className="text-left font-bold py-2 px-2">역할</th>
                  <th className="text-right font-bold py-2 px-2 w-[130px]">금일 라우팅 점유</th>
                  <th className="text-left font-bold py-2 px-2 w-[110px]">상태</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_POOL.map((m) => (
                  <tr key={m.name} className="border-b border-line-soft">
                    <td className="py-2 px-2 font-mono font-bold text-ink text-[11.5px]">{m.name}</td>
                    <td className="py-2 px-2 text-ink-mid font-semibold">{m.serving}</td>
                    <td className="py-2 px-2 text-ink-mid font-semibold">{m.role}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-[54px] h-[5px] bg-surface-soft rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full"
                            style={{ width: `${m.sharePct}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] font-extrabold text-ink font-mono tabular-nums w-[32px] text-right">
                          {m.sharePct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <StatusPill tone={POOL_TONE[m.status] ?? 'neutral'}>{m.status}</StatusPill>
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-soft">
                  <td className="py-2 px-2 font-bold text-ink-mid text-[11.5px]">
                    {EXTERNAL_SLOT.name}
                  </td>
                  <td className="py-2 px-2 text-ink-light font-semibold" colSpan={3}>
                    {EXTERNAL_SLOT.note}
                  </td>
                  <td className="py-2 px-2">
                    <StatusPill tone="neutral">{EXTERNAL_SLOT.status}</StatusPill>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* ── 라우팅 규칙 ── */}
      {tab === 'routing' && (
        <section className="card p-4 mb-3.5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">라우팅 규칙</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              위에서부터 먼저 맞는 규칙이 적용된다
            </span>
          </div>
          <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
            모든 규칙에 Fallback 이 있어 특정 모델이 죽어도 서비스가 끊기지 않는다.
            화이트리스트 밖 모델은 어떤 규칙으로도 선택되지 않는다.
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-mid border-b border-line">
                <th className="text-left font-bold py-2 px-2 w-[50px]">순위</th>
                <th className="text-left font-bold py-2 px-2">조건</th>
                <th className="text-left font-bold py-2 px-2">대상 모델</th>
                <th className="text-left font-bold py-2 px-2">Fallback</th>
                <th className="text-left font-bold py-2 px-2 w-[100px]">적용 범위</th>
              </tr>
            </thead>
            <tbody>
              {ROUTING_RULES.map((r) => (
                <tr key={r.priority} className="border-b border-line-soft">
                  <td className="py-2 px-2">
                    <span className="w-[20px] h-[20px] rounded bg-surface-soft text-ink-dark text-[10.5px] font-extrabold grid place-items-center">
                      {r.priority}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-ink font-semibold">{r.condition}</td>
                  <td className="py-2 px-2 font-mono font-bold text-ink text-[11px]">{r.target}</td>
                  <td className="py-2 px-2 font-mono text-ink-mid text-[11px]">{r.fallback}</td>
                  <td className="py-2 px-2 text-ink-mid font-semibold">{r.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── 테넌트 쿼터 (LSM-008) ── */}
      {tab === 'quota' && (
        <section className="card p-4 mb-3.5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">테넌트별 토큰 쿼터</h2>
            <span className="text-[11px] text-ink-mid font-semibold">{QUOTA_AS_OF}</span>
          </div>
          <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
            상한과 초과 시 동작을 이 화면에서 직접 설정한다. 소진량은 미터링·정산과 같은 원장에서 읽으므로
            두 화면이 다른 숫자를 말하지 않는다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[820px]">
              <thead>
                <tr className="text-ink-mid border-b border-line">
                  <th className="text-left font-bold py-2 px-2 w-[150px]">테넌트</th>
                  <th className="text-right font-bold py-2 px-2 w-[110px]">일일 상한 (M)</th>
                  <th className="text-right font-bold py-2 px-2 w-[110px]">월간 상한 (M)</th>
                  <th className="text-left font-bold py-2 px-2 w-[190px]">월 소진</th>
                  <th className="text-left font-bold py-2 px-2 w-[130px]">초과 시 동작</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = Math.min(100, Math.round((r.monthlyUsedM / r.monthlyCapM) * 100));
                  const tone = pct >= 90 ? 'bad' : pct >= 80 ? 'warn' : 'ok';
                  return (
                    <tr key={r.tenant} className="border-b border-line-soft align-middle">
                      <td className="py-2 px-2">
                        <div className="text-[12.5px] font-extrabold text-ink">
                          {TENANT_SHORT[r.tenant as keyof typeof TENANT_SHORT] ?? r.tenant}
                        </div>
                        <div className="text-[9.5px] font-mono text-ink-light font-bold">
                          {r.namespace}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min={1}
                          value={r.dailyCapM}
                          onChange={(e) =>
                            setCap(r.tenant, 'dailyCapM', Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-[68px] px-2 py-1 text-right text-[12px] font-mono font-bold text-ink border border-line rounded bg-white tabular-nums focus:outline-none focus:border-brand"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min={1}
                          value={r.monthlyCapM}
                          onChange={(e) =>
                            setCap(r.tenant, 'monthlyCapM', Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-[76px] px-2 py-1 text-right text-[12px] font-mono font-bold text-ink border border-line rounded bg-white tabular-nums focus:outline-none focus:border-brand"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[6px] bg-surface-soft rounded-full overflow-hidden min-w-[70px]">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-ok',
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-extrabold text-ink tabular-nums w-[86px] text-right">
                            {r.monthlyUsedM.toLocaleString('ko-KR')} / {r.monthlyCapM}M
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={r.onExceed}
                          onChange={(e) => setAction(r.tenant, e.target.value as QuotaAction)}
                          className="px-2 py-1 text-[11.5px] font-bold text-ink border border-line rounded bg-white focus:outline-none focus:border-brand"
                        >
                          {QUOTA_ACTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 초과 시 동작 설명 */}
          <div className="mt-3 pt-3 border-t border-line-soft grid grid-cols-3 gap-2">
            {QUOTA_ACTIONS.map((a) => (
              <div key={a} className="border border-line-soft rounded px-3 py-2 bg-surface-soft">
                <div className="text-[11.5px] font-extrabold text-ink mb-1">{a}</div>
                <div className="text-[10px] text-ink-mid font-semibold leading-snug">
                  {QUOTA_ACTION_DESC[a]}
                </div>
              </div>
            ))}
          </div>

          {rows.find((r) => r.note) && (
            <p className="text-[10px] text-ink-light font-semibold mt-2.5 leading-snug">
              ※ {rows.find((r) => r.note)?.note}
            </p>
          )}
        </section>
      )}

      <p className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">
        {GATEWAY_SCOPE_NOTE}
      </p>
    </div>
  );
}
