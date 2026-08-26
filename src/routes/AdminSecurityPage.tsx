/**
 * 관리 콘솔 — 보안 · 거버넌스 관리.
 *
 * RFP 2-1 관리자 포털 46 「보안·거버넌스 관리 화면」:
 * 개인정보 예외승인 정책 · 데이터 스코프 정책 · 감사 로그 검색·조회.
 * (가드레일·필터링 정책 자체는 별도 「가드레일 정책」 화면이 담당한다)
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import {
  PII_EXCEPTION_REQUESTS,
  DATA_SCOPE_RULES,
  AUDIT_LOGS,
  type PiiExceptionState,
} from '@/data/mockSecurityGovernance';

type Tab = 'pii' | 'scope' | 'audit';

const PII_TONE: Record<PiiExceptionState, 'warn' | 'ok' | 'bad'> = { 대기: 'warn', 승인: 'ok', 반려: 'bad' };
const RESULT_TONE: Record<string, 'ok' | 'bad'> = { 성공: 'ok', 차단: 'bad', 실패: 'bad' };

export default function AdminSecurityPage() {
  const [tab, setTab] = useState<Tab>('pii');
  const [decided, setDecided] = useState<Record<string, PiiExceptionState>>({});
  const [q, setQ] = useState('');

  const filteredLogs = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return AUDIT_LOGS;
    return AUDIT_LOGS.filter((l) =>
      [l.actor, l.tenant, l.actionType, l.target].some((v) => v.toLowerCase().includes(lower)),
    );
  }, [q]);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">보안 · 거버넌스 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            개인정보 예외승인 · 데이터 스코프 정책 · 감사 로그 검색
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal flex-shrink-0 mt-1">
          2-1 보안·거버넌스
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-line mb-3.5">
        {([
          { k: 'pii' as const, label: '개인정보 예외승인' },
          { k: 'scope' as const, label: '데이터 스코프 정책' },
          { k: 'audit' as const, label: '감사 로그 검색' },
        ]).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k ? 'text-brand border-brand' : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'pii' && (
        <div className="flex flex-col gap-1.5">
          {PII_EXCEPTION_REQUESTS.map((r) => {
            const state = decided[r.id] ?? r.state;
            return (
              <div key={r.id} className="card p-3.5">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] font-mono font-bold text-ink-light">{r.id}</span>
                  <span className="text-[12.5px] font-extrabold text-ink">{r.target}</span>
                  <StatusPill tone={PII_TONE[state]} className="ml-auto">{state}</StatusPill>
                </div>
                <p className="text-[11px] text-ink-dark font-semibold leading-snug mb-1">{r.reason}</p>
                <div className="text-[10.5px] text-ink-mid font-semibold">
                  {r.requestedBy} · {TENANT_SHORT[r.tenant]} · {r.dept} · {r.requestedAt}
                  {r.decidedBy && ` · 처리 ${r.decidedBy} ${r.decidedAt}`}
                </div>
                {state === '대기' && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => { setDecided((s) => ({ ...s, [r.id]: '반려' })); toast('반려했습니다'); }}
                      className="py-1 px-2.5 border border-line rounded text-[11px] font-extrabold text-ink-dark hover:border-bad hover:text-bad"
                    >반려</button>
                    <button
                      type="button"
                      onClick={() => { setDecided((s) => ({ ...s, [r.id]: '승인' })); toast('승인했습니다 — 감사 원장에 기록됩니다'); }}
                      className="py-1 px-2.5 bg-brand border border-brand-dark rounded text-[11px] font-extrabold text-white hover:bg-brand-dark"
                    >승인</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'scope' && (
        <div className="card p-4">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] border-b border-line-soft">
                <th className="py-1.5 pr-3">범위</th>
                <th className="py-1.5 pr-3">설명</th>
                <th className="py-1.5 pr-3">승격 승인자</th>
                <th className="py-1.5">기본값</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SCOPE_RULES.map((r) => (
                <tr key={r.scope} className="border-b border-line-soft last:border-0">
                  <td className="py-2 pr-3 font-extrabold text-ink whitespace-nowrap">{r.scope}</td>
                  <td className="py-2 pr-3 text-ink-dark font-semibold">{r.desc}</td>
                  <td className="py-2 pr-3 text-ink-mid font-semibold whitespace-nowrap">{r.approver}</td>
                  <td className="py-2">{r.isDefault && <StatusPill tone="ok">기본값</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <div className="relative mb-3 max-w-[360px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-[12px]">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="사용자 · 계열사 · 행위 · 대상 검색"
              className="w-full py-1.5 pl-8 pr-3 border border-line rounded text-[12px] bg-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            {filteredLogs.map((l, i) => (
              <div key={i} className="grid grid-cols-[150px_90px_90px_1fr_60px] gap-3 items-center px-3.5 py-2 bg-white border border-line-soft rounded">
                <span className="text-[10px] font-mono font-semibold text-ink-mid tabular-nums">{l.at}</span>
                <span className="text-[11px] font-extrabold text-ink truncate">{l.actor}</span>
                <span className="text-[10.5px] text-ink-mid font-semibold">{TENANT_SHORT[l.tenant]}</span>
                <span className="text-[10.5px] text-ink-dark font-semibold truncate">
                  <b className="text-ink">{l.actionType}</b> · {l.target}
                </span>
                <StatusPill tone={RESULT_TONE[l.result]}>{l.result}</StatusPill>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-[11.5px] text-ink-mid font-semibold">검색 결과가 없습니다</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
