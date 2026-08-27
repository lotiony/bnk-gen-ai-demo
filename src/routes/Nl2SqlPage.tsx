/**
 * 지식 · 데이터 — 자연어 데이터 조회 (NL-to-SQL).
 *
 * RFP: EDA-006 자연어 기반 데이터 추출 (권고)
 *      EDA-007 자연어 쿼리 보안 가드레일 (권고 · EDA-006 제안 시 상세제안필요)
 *      EDA-001 데이터 가상화 계층 (필수) — 질의 대상은 물리 테이블이 아니라 가상 뷰다
 *
 * 상세제안 대상은 EDA-007 이므로 **가드레일이 주인공**이다. SQL 이 만들어지는 것만
 * 보여 주면 절반이고, 위험한 질의가 어떻게 막히는지가 나머지 절반이다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { useTenant } from '@/lib/tenantStore';
import {
  NLQ_SCENARIOS,
  VIRTUAL_VIEWS,
  GUARD_TONE,
  MAX_ROW_LIMIT,
} from '@/data/mockNl2sql';

export default function Nl2SqlPage() {
  const tenant = useTenant();
  const [id, setId] = useState<string | null>(null);
  const [freeform, setFreeform] = useState('');
  const [ran, setRan] = useState(false);

  const scenario = useMemo(() => NLQ_SCENARIOS.find((s) => s.id === id) ?? null, [id]);
  const blocked = scenario ? !scenario.executed : false;

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">
            자연어 데이터 조회
          </h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            현업이 문장으로 물으면 SQL 을 만들어 조회한다 · 대상은 물리 테이블이 아니라{' '}
            <b className="text-ink-dark">가상화 뷰</b>다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          EDA-006 · 007
        </span>
      </div>

      {/* 질의 대상 뷰 */}
      <section className="card p-4 mb-3">
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-[13px] font-extrabold text-ink">질의 대상 가상 뷰</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            {tenant} 권한으로 접근 가능한 뷰만 노출된다 · 물리 테이블은 질의 대상이 아니다
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {VIRTUAL_VIEWS.map((v) => (
            <div key={v.name} className="border border-line-soft rounded px-3 py-2 bg-white">
              <div className="text-[11.5px] font-mono font-extrabold text-ink">{v.name}</div>
              <p className="text-[10.5px] text-ink-mid font-semibold mt-0.5 leading-snug">
                {v.desc}
              </p>
              <div className="mt-1.5 space-y-0.5">
                <div className="text-[9.5px] font-semibold text-ink-dark">
                  <b className="text-ink-light">RLS</b> {v.rls}
                </div>
                <div className="text-[9.5px] font-semibold text-ink-dark">
                  <b className="text-ink-light">CLS</b> {v.cls}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 질의 입력 */}
      <section className="card p-4 mb-3">
        <h2 className="text-[13px] font-extrabold text-ink mb-2">질의</h2>
        <div className="flex flex-col gap-1.5 mb-3">
          {NLQ_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setId(s.id);
                setFreeform('');
                setRan(false);
              }}
              className={cn(
                'text-left px-3 py-2 rounded border transition-colors',
                id === s.id
                  ? 'bg-brand-bg border-brand-dark'
                  : 'bg-white border-line-soft hover:border-brand-dark',
              )}
            >
              <div className="text-[12px] font-bold text-ink leading-snug">{s.question}</div>
              <div className="text-[10px] text-ink-mid font-semibold mt-0.5">{s.purpose}</div>
            </button>
          ))}
        </div>
        <textarea
          value={freeform}
          onChange={(e) => {
            setFreeform(e.target.value);
            setId(null);
            setRan(false);
          }}
          rows={2}
          placeholder="직접 입력 — 예: 이번 분기 연체 30일 이상 건수를 상품별로"
          className="w-full py-2 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark resize-none"
        />
        <div className="flex items-center gap-2 mt-2.5">
          <button
            type="button"
            disabled={!id && !freeform.trim()}
            onClick={() => setRan(true)}
            className="py-1.5 px-4 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ SQL 생성 · 실행
          </button>
          <span className="ml-auto text-[10.5px] text-ink-mid font-semibold">
            최대 조회 <b className="text-ink-dark tabular-nums">
              {MAX_ROW_LIMIT.toLocaleString('ko-KR')}
            </b>
            행 · 결과 파일 다운로드 차단
          </span>
        </div>
      </section>

      {/* 결과 */}
      {ran && !scenario && (
        <div className="card p-4 border-warn-border bg-warn-bg">
          <div className="text-[12px] font-extrabold text-warn mb-1">
            사전 정의 질의가 아닙니다
          </div>
          <p className="text-[11.5px] text-ink-dark font-semibold leading-snug">
            이 시연 환경에는 사전 정의 질의만 준비되어 있습니다. 위 예시 중 하나를 선택하면 SQL
            생성과 가드레일 판정 결과를 확인할 수 있습니다.
          </p>
        </div>
      )}

      {ran && scenario && (
        <div className="grid grid-cols-[1fr_380px] gap-3">
          {/* 좌: SQL + 결과 */}
          <div className="min-w-0 flex flex-col gap-3">
            <section className="card p-4">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-[13px] font-extrabold text-ink">생성된 SQL</h2>
                {blocked && <StatusPill tone="bad">실행되지 않음</StatusPill>}
              </div>
              <pre className="whitespace-pre-wrap text-[11px] font-mono leading-relaxed border border-line-soft bg-surface-soft rounded px-3 py-2.5 text-ink-dark overflow-x-auto">
                {scenario.sql}
              </pre>
            </section>

            {scenario.executed ? (
              <section className="card p-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <h2 className="text-[13px] font-extrabold text-ink">조회 결과</h2>
                  <span className="text-[11px] text-ink-mid font-semibold tabular-nums">
                    {scenario.rowCount}행 · 상위 {scenario.rows?.length}행 표시
                  </span>
                  <span className="ml-auto text-[10.5px] font-extrabold text-ink-light">
                    ⛔ 다운로드 차단됨
                  </span>
                </div>
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="text-left text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] border-b border-line-soft">
                      {scenario.columns?.map((c) => (
                        <th key={c} className="py-1.5 pr-3 font-extrabold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.rows?.map((r, i) => (
                      <tr key={i} className="border-b border-line-soft last:border-0">
                        {r.map((cell, j) => (
                          <td
                            key={j}
                            className={cn(
                              'py-1.5 pr-3',
                              j === 0
                                ? 'font-extrabold text-ink'
                                : 'font-bold text-ink-dark tabular-nums',
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <section className="card p-4 border-bad-border bg-bad-bg">
                <div className="text-[12.5px] font-extrabold text-bad mb-1">질의가 차단되었습니다</div>
                <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed">
                  {scenario.blockNotice}
                </p>
              </section>
            )}
          </div>

          {/* 우: 가드레일 판정 */}
          <section className="card p-4 self-start">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-[13px] font-extrabold text-ink">가드레일 판정</h2>
              <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
                EDA-007
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {scenario.guards.map((g) => {
                const meta = GUARD_TONE[g.result];
                return (
                  <div
                    key={g.name}
                    className={cn(
                      'px-3 py-2 rounded border',
                      g.result === 'block'
                        ? 'border-bad-border bg-bad-bg'
                        : g.result === 'rewrite'
                          ? 'border-warn-border bg-warn-bg'
                          : 'border-line-soft bg-white',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11.5px] font-extrabold text-ink">{g.name}</span>
                      <StatusPill tone={meta.tone} className="ml-auto">
                        {meta.label}
                      </StatusPill>
                    </div>
                    <p className="text-[10.5px] text-ink-dark font-semibold leading-snug">
                      {g.detail}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-ink-mid font-semibold mt-2.5 pt-2 border-t border-line-soft leading-snug">
              🔒 생성된 SQL · 판정 결과 · 반환 건수는 모두 감사 원장에 기록된다(SEC-009).
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
