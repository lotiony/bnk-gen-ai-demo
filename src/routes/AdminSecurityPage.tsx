/**
 * 관리 콘솔 — 보안 · 거버넌스 관리.
 *
 * RFP 2-1 관리자 포털 46 「보안·거버넌스 관리 화면」:
 * 개인정보 예외승인 정책 · 데이터 스코프 정책 · 통합 감사 원장.
 * (가드레일·필터링 정책 자체는 별도 「가드레일 정책」 화면이 담당한다)
 *
 * 감사 탭은 SEC-009(전 행위 상세 보안 실행 로그) + ONM-004(누가·어떤 에이전트·
 * 어떤 동의 권원으로 복호화 조회했는지)를 **한 원장**으로 담는다.
 * SEC-008(비식별 저장 원칙)은 스코프 탭의 저장 정책 카드가 근거다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import {
  PII_EXCEPTION_REQUESTS,
  DATA_SCOPE_RULES,
  UNIFIED_AUDIT,
  UNIFIED_AUDIT_CATEGORIES,
  type PiiExceptionState,
  type UnifiedAuditCategory,
  type UnifiedAuditVerdict,
} from '@/data/mockSecurityGovernance';

type Tab = 'pii' | 'scope' | 'audit';

const PII_TONE: Record<PiiExceptionState, 'warn' | 'ok' | 'bad'> = { 대기: 'warn', 승인: 'ok', 반려: 'bad' };
const VERDICT_TONE: Record<UnifiedAuditVerdict, 'ok' | 'bad' | 'info'> = { 허용: 'ok', 차단: 'bad', 익명화: 'info' };

export default function AdminSecurityPage() {
  const [tab, setTab] = useState<Tab>('pii');
  const [decided, setDecided] = useState<Record<string, PiiExceptionState>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<UnifiedAuditCategory | 'all'>('all');

  const filteredLogs = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return (
      UNIFIED_AUDIT.filter((l) => {
        if (cat !== 'all' && l.category !== cat) return false;
        if (!lower) return true;
        return [l.actor, l.via ?? '', l.tenant, l.action, l.target, l.consentBasis ?? ''].some((v) =>
          v.toLowerCase().includes(lower),
        );
      })
        /* 감사 원장은 시간순이 생명이다 — 필터·검색을 거쳐도 최신순을 유지한다.
           (ONM-004 · SEC-009 근거 화면이라 시간이 역행하면 그대로 지적 대상) */
        .sort((a, b) => b.at.localeCompare(a.at))
    );
  }, [q, cat]);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">보안 · 거버넌스 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            개인정보 예외승인 · 데이터 스코프 정책 · 통합 감사 원장
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          SEC-008 · 009 · ONM-004
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-line mb-3.5">
        {([
          { k: 'pii' as const, label: '개인정보 예외승인' },
          { k: 'scope' as const, label: '데이터 스코프 정책' },
          { k: 'audit' as const, label: '통합 감사 원장' },
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
        <div>
        {/* SEC-008 — 사후 학습·재활용 목적 저장 시 비식별화 원칙 */}
        <div className="border border-line bg-surface-soft rounded px-3.5 py-2.5 mb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11.5px] font-extrabold text-ink">저장 시 비식별화 원칙</span>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">SEC-008</span>
          </div>
          <p className="text-[11px] text-ink-dark font-semibold leading-snug">
            프롬프트 입력·첨부파일이 사후 학습이나 재활용 목적으로 저장될 때는{' '}
            <b>원본 식별이 불가능하도록 자동 비식별화(마스킹 · 토큰화)</b> 후 적재된다.
            원본 복원 키는 저장 계층에 남지 않으며, 이 원칙의 예외는 상단 「개인정보 예외승인」
            결재를 거쳐야 한다.
          </p>
        </div>
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
        </div>
      )}

      {tab === 'audit' && (
        <div>
          {/* 원장 안내 — 데이터 라우팅 화면의 감사 표와 같은 원장이다(ONM-004) */}
          <div className="border border-line bg-surface-soft rounded px-3.5 py-2.5 mb-3">
            <div className="text-[11.5px] font-extrabold text-ink mb-0.5">
              전 행위 통합 원장 — 자원변경 · 권한양도 · 모델배포 · 프롬프트실행 · 복호화요청
            </div>
            <p className="text-[11px] text-ink-dark font-semibold leading-snug">
              복호화요청 행에는 <b>누가 · 어떤 에이전트를 통해 · 어떤 동의 권원으로</b> 조회했는지가
              함께 적산된다(ONM-004). 데이터 라우팅 화면의 접근 감사 표와 같은 원장이다 —
              위·변조 방지를 위해 암호화 보관되며 삭제할 수 없다.
            </p>
          </div>

          {/* 카테고리 필터 + 검색 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCat('all')}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-extrabold border',
                  cat === 'all'
                    ? 'bg-brand text-white border-brand-dark'
                    : 'bg-white text-ink-mid border-line hover:border-brand-dark',
                )}
              >전체 {UNIFIED_AUDIT.length}</button>
              {UNIFIED_AUDIT_CATEGORIES.map((c) => {
                const n = UNIFIED_AUDIT.filter((l) => l.category === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-extrabold border',
                      cat === c
                        ? 'bg-brand text-white border-brand-dark'
                        : 'bg-white text-ink-mid border-line hover:border-brand-dark',
                    )}
                  >{c} {n}</button>
                );
              })}
            </div>
            <div className="relative ml-auto w-[280px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-[12px]">🔍</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="행위자 · 에이전트 · 대상 · 동의권원 검색"
                className="w-full py-1.5 pl-8 pr-3 border border-line rounded text-[12px] bg-white"
              />
            </div>
          </div>

          <div className="border border-line-soft rounded overflow-hidden bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-soft">
                  {['시각', '행위자', '경유 에이전트', '분류', '행위 · 대상', '동의 권원', '판정'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-2 border-b border-line-soft whitespace-nowrap"
                    >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l, i) => (
                  <tr key={`${l.at}-${i}`} className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40 align-top">
                    <td className="px-2.5 py-2 text-[10px] font-mono font-semibold text-ink-mid tabular-nums whitespace-nowrap">{l.at}</td>
                    <td className="px-2.5 py-2 text-[11px] font-extrabold text-ink whitespace-nowrap">
                      {l.actor}
                      <div className="text-[9.5px] text-ink-light font-semibold">{TENANT_SHORT[l.tenant]}</div>
                    </td>
                    <td className="px-2.5 py-2 text-[10.5px] text-ink-dark font-semibold whitespace-nowrap">
                      {l.via ?? <span className="text-ink-light">—</span>}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <span className="pill bg-surface text-ink-mid border border-line-soft">{l.category}</span>
                    </td>
                    <td className="px-2.5 py-2 text-[11px] min-w-[220px]">
                      <b className="text-ink font-extrabold">{l.action}</b>
                      <span className="text-ink-mid font-semibold"> · {l.target}</span>
                      {l.note && <div className="text-[10px] text-ink-light font-semibold mt-0.5">{l.note}</div>}
                    </td>
                    <td className="px-2.5 py-2 text-[10.5px] font-semibold min-w-[140px]">
                      {l.consentBasis ? (
                        <span className="text-ok">{l.consentBasis}</span>
                      ) : l.category === '복호화요청' ? (
                        <span className="text-bad font-extrabold">권원 없음</span>
                      ) : (
                        <span className="text-ink-light">해당 없음</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <StatusPill tone={VERDICT_TONE[l.verdict]}>{l.verdict}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-[11.5px] text-ink-mid font-semibold">검색 결과가 없습니다</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
