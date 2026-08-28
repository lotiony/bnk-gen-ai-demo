/**
 * 관리 콘솔 — 플랫폼 모듈.
 *
 * RFP: ONM-007 클라우드 확장 및 이식성을 고려한 표준 MSA 아키텍처 (필수)
 * 연계: 2-1 구축범위 1.5.4(모듈형 서비스 확장 구조) · AGB-011(버전·배포 이력) ·
 *       ONM-006(파드 상태) · ONM-008(개발 환경)
 *
 * 왜 화면을 따로 두는가 —
 *   ONM-007 은 설계 요건이라 그동안 데모에 근거 화면이 없었다. 그런데 발주처가
 *   확인하려는 건 아키텍처 그림이 아니라 **"하나 바꾸면 뭐가 같이 흔들리느냐"** 다.
 *   그래서 이 화면은 모듈 목록을 나열하는 데서 멈추지 않고, 변경 유형을 고르면
 *   계약 그래프로 영향 모듈을 계산해서 보여 준다. 대부분의 변경에서 결과가
 *   **0건**으로 나오는 것 자체가 모듈형 구조의 증명이다.
 *
 * 탭 구성 — ① 모듈 구성(무엇이 독립 단위인가) ② 변경 영향도(정말 안 흔들리는가)
 *          ③ 배포 · 복구(흔들렸을 때 어떻게 되돌리는가)
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import {
  PLATFORM_MODULES,
  MODULE_BY_ID,
  CHANGE_SCENARIOS,
  RELEASE_HISTORY,
  COMPAT_POLICY,
  PLATFORM_SCOPE_NOTE,
  impactedModules,
  type ModuleId,
  type DeployStrategy,
} from '@/data/mockPlatformModules';

type Tab = 'modules' | 'impact' | 'release';

const STRATEGY_TONE: Record<DeployStrategy, 'ok' | 'warn' | 'info'> = {
  'Blue-Green': 'ok',
  Canary: 'warn',
  Rolling: 'info',
};

export default function AdminPlatformPage() {
  const [tab, setTab] = useState<Tab>('modules');
  const [scenarioId, setScenarioId] = useState(CHANGE_SCENARIOS[0].id);

  const scenario = CHANGE_SCENARIOS.find((s) => s.id === scenarioId) ?? CHANGE_SCENARIOS[0];
  const impacted = useMemo(() => impactedModules(scenario), [scenario]);
  const impactedSet = new Set<ModuleId>(impacted);

  const stats = useMemo(() => {
    const replicas = PLATFORM_MODULES.reduce((a, m) => a + m.replicas, 0);
    const compat = PLATFORM_MODULES.reduce((a, m) => a + m.supported.length, 0);
    const zeroImpact = CHANGE_SCENARIOS.filter((s) => !s.breaksContract).length;
    return { replicas, compat, zeroImpact };
  }, []);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">플랫폼 모듈</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            독립 배포 단위로 분리하고 버전이 부여된 계약으로만 통신한다 — 변경이 계약을 넘어 전파되지 않는다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          ONM-007
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard
          label="독립 배포 모듈"
          value={String(PLATFORM_MODULES.length)}
          unit="개"
          sub="K8s 표준 MSA · 모듈별 독립 스케일"
          tone="ok"
        />
        <KpiCard
          label="이중화 파드"
          value={String(stats.replicas)}
          unit="개"
          sub="전 모듈 2 AZ 분산 · 무중단(HA)"
          tone="ok"
        />
        <KpiCard
          label="병행 서빙 계약"
          value={String(stats.compat)}
          unit="버전"
          sub="하위 호환 최대 2버전 유지"
          tone="ok"
        />
        <KpiCard
          label="영향 0건 변경"
          value={`${stats.zeroImpact}`}
          unit={`/ ${CHANGE_SCENARIOS.length}`}
          sub="계약이 유지되면 전파되지 않는다"
          tone="ok"
        />
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-0.5 border-b border-line mb-3.5">
        {[
          { k: 'modules' as const, label: '모듈 구성', req: 'ONM-007' },
          { k: 'impact' as const, label: '변경 영향도', req: '1.5.4' },
          { k: 'release' as const, label: '배포 · 복구', req: 'AGB-011' },
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

      {/* ── 모듈 구성 ── */}
      {tab === 'modules' && (
        <section className="card p-4 mb-3.5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">모듈 원장</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              공동존 On-Premise K8s · 모듈별 독립 배포
            </span>
          </div>
          <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
            모듈은 서로를 직접 호출하지 않고 <b className="text-ink">버전이 명시된 계약</b>만 지난다.
            호출자는 배포 시점에 고정한 버전을 계속 호출하므로, 제공자가 새 버전을 올려도 호출자는
            바뀌지 않는다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[940px]">
              <thead>
                <tr className="text-ink-mid border-b border-line">
                  <th className="text-left font-bold py-2 px-2 w-[170px]">모듈</th>
                  <th className="text-left font-bold py-2 px-2 w-[165px]">제공 계약</th>
                  <th className="text-left font-bold py-2 px-2 w-[120px]">하위 호환</th>
                  <th className="text-left font-bold py-2 px-2">소비하는 계약</th>
                  <th className="text-left font-bold py-2 px-2 w-[160px]">이중화</th>
                  <th className="text-left font-bold py-2 px-2 w-[125px]">배포 방식</th>
                  <th className="text-left font-bold py-2 px-2 w-[105px]">최근 배포</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_MODULES.map((m) => (
                  <tr key={m.id} className="border-b border-line-soft">
                    <td className="py-2 px-2">
                      <div className="text-[12.5px] font-extrabold text-ink">{m.name}</div>
                      <div className="text-[9.5px] text-ink-light font-semibold">{m.role}</div>
                    </td>
                    <td className="py-2 px-2">
                      <code className="font-mono text-[11px] font-bold text-ink-dark">
                        {m.contract}
                      </code>
                      <span className="ml-1 pill bg-surface-soft text-ink-dark border border-line-soft text-[10px]">
                        {m.version}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-[10.5px] text-ink-mid font-bold">
                      {m.supported.length ? m.supported.join(' · ') : '—'}
                    </td>
                    <td className="py-2 px-2">
                      {m.dependsOn.length ? (
                        <span className="text-[10.5px] font-mono text-ink-mid font-bold">
                          {m.dependsOn.map((d) => MODULE_BY_ID[d].contract).join(' · ')}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-ink-light font-semibold">
                          없음 — 최하위 모듈
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-[11px] text-ink-dark font-semibold">{m.ha}</div>
                      <div className="text-[9.5px] text-ink-light font-semibold">
                        파드 {m.replicas}개
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <StatusPill tone={STRATEGY_TONE[m.strategy]}>{m.strategy}</StatusPill>
                    </td>
                    <td className="py-2 px-2 text-[10.5px] font-mono text-ink-mid font-bold tabular-nums">
                      {m.lastDeployedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 변경 영향도 ── */}
      {tab === 'impact' && (
        <>
          <section className="card p-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="text-[14px] font-extrabold text-ink">변경 영향 산출</h2>
              <span className="text-[11px] text-ink-mid font-semibold">
                계약 그래프로 배포 승인 전에 계산한다
              </span>
            </div>
            <p className="text-[10.5px] text-ink-mid font-semibold mb-3 leading-snug">
              RFP 가 지목한 세 가지 변경(AI 서비스 · Agent · MCP)은 모두 계약을 바꾸지 않는다. 그래서
              영향 모듈이 <b className="text-ink">0건</b>으로 나온다. 계약 자체를 바꾸는 네 번째
              경우에만 소비 모듈이 잡히고, 하위 호환 병행으로 흡수한다.
            </p>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {CHANGE_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScenarioId(s.id)}
                  className={cn(
                    'text-left border rounded px-3 py-2.5 transition-colors',
                    s.id === scenarioId
                      ? 'border-brand bg-brand-bg'
                      : 'border-line bg-surface-soft hover:border-line-warm',
                  )}
                >
                  <div className="text-[9.5px] font-extrabold tracking-[0.3px] uppercase text-ink-light mb-1">
                    {s.kind}
                  </div>
                  <div className="text-[12px] font-extrabold text-ink leading-snug">{s.label}</div>
                  <div className="mt-1.5">
                    <StatusPill tone={s.breaksContract ? 'warn' : 'ok'}>
                      {s.breaksContract ? '계약 변경' : '계약 유지'}
                    </StatusPill>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_320px] gap-4">
              <div>
                <div className="text-[9.5px] font-extrabold tracking-[0.3px] uppercase text-ink-light mb-1.5">
                  모듈 지도
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PLATFORM_MODULES.map((m) => {
                    const isTarget = m.id === scenario.target;
                    const isHit = impactedSet.has(m.id);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'border rounded px-2.5 py-2',
                          isTarget
                            ? 'border-brand bg-brand-bg'
                            : isHit
                              ? 'border-warn-border bg-warn-bg'
                              : 'border-line bg-white',
                        )}
                      >
                        <div className="text-[11.5px] font-extrabold text-ink leading-snug">
                          {m.name}
                        </div>
                        <div className="text-[9.5px] font-mono font-bold text-ink-light mt-0.5">
                          {m.contract} {m.version}
                        </div>
                        <div className="mt-1.5 text-[9.5px] font-extrabold">
                          {isTarget ? (
                            <span className="text-brand">● 배포 대상</span>
                          ) : isHit ? (
                            <span className="text-warn">▲ 영향 · 이관 필요</span>
                          ) : (
                            <span className="text-ink-light">무영향</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-line rounded overflow-hidden">
                <div className="px-3 py-2.5 bg-surface-soft border-b border-line-soft">
                  <div className="text-[12.5px] font-extrabold text-ink">산출 결과</div>
                </div>
                <div className="px-3 py-3 space-y-3">
                  <div>
                    <div className="text-[9.5px] font-extrabold tracking-[0.3px] uppercase text-ink-light">
                      영향 모듈
                    </div>
                    <div
                      className={cn(
                        'text-[26px] font-extrabold leading-none mt-1 tracking-[-0.5px]',
                        impacted.length ? 'text-warn' : 'text-ok',
                      )}
                    >
                      {impacted.length}
                      <small className="text-[12px] font-bold text-ink-mid ml-1">
                        / {PLATFORM_MODULES.length}
                      </small>
                    </div>
                    <div className="text-[10.5px] text-ink-mid font-semibold mt-1 leading-snug">
                      {impacted.length
                        ? impacted.map((id) => MODULE_BY_ID[id].name).join(' · ')
                        : '배포 대상 외 모듈은 재기동하지 않는다'}
                    </div>
                  </div>
                  <div className="border-t border-line-soft pt-2.5">
                    <div className="text-[9.5px] font-extrabold tracking-[0.3px] uppercase text-ink-light">
                      변경 내용
                    </div>
                    <p className="text-[11px] text-ink-dark font-semibold leading-snug mt-1">
                      {scenario.detail}
                    </p>
                  </div>
                  <div className="border-t border-line-soft pt-2.5">
                    <div className="text-[9.5px] font-extrabold tracking-[0.3px] uppercase text-ink-light">
                      차단 장치
                    </div>
                    <p className="text-[11px] text-ink-dark font-semibold leading-snug mt-1">
                      {scenario.mitigation}
                    </p>
                  </div>
                  <div className="border-t border-line-soft pt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-ink-light font-semibold">대응 요건</span>
                    <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
                      {scenario.requirement}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card p-4 mb-3.5">
            <h2 className="text-[14px] font-extrabold text-ink mb-2.5">계약 운영 정책</h2>
            <div className="grid grid-cols-4 gap-2">
              {COMPAT_POLICY.map((p) => (
                <div key={p.title} className="border border-line rounded px-3 py-2.5 bg-surface-soft">
                  <div className="text-[12.5px] font-extrabold text-ink mb-1">{p.title}</div>
                  <p className="text-[10.5px] text-ink-mid font-semibold leading-snug">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── 배포 · 복구 ── */}
      {tab === 'release' && (
        <section className="card p-4 mb-3.5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-[14px] font-extrabold text-ink">모듈 배포 이력</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              승인 시점의 영향 모듈 수를 함께 기록한다
            </span>
          </div>
          <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
            영향 모듈이 0건이면 무중단 즉시 배포 대상이다. 계약을 깨는 배포만 병행 서빙 구간을 두며,
            이상이 확인되면 이전 슬롯으로 되돌린다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead>
                <tr className="text-ink-mid border-b border-line">
                  <th className="text-left font-bold py-2 px-2 w-[95px]">배포 번호</th>
                  <th className="text-left font-bold py-2 px-2 w-[145px]">모듈</th>
                  <th className="text-left font-bold py-2 px-2 w-[165px]">버전</th>
                  <th className="text-left font-bold py-2 px-2 w-[110px]">방식</th>
                  <th className="text-right font-bold py-2 px-2 w-[85px]">영향 모듈</th>
                  <th className="text-left font-bold py-2 px-2 w-[100px]">결과</th>
                  <th className="text-left font-bold py-2 px-2">기록</th>
                </tr>
              </thead>
              <tbody>
                {RELEASE_HISTORY.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft">
                    <td className="py-2 px-2 font-mono font-bold text-ink-dark text-[11px]">
                      {r.id}
                    </td>
                    <td className="py-2 px-2 text-[12px] font-extrabold text-ink">
                      {MODULE_BY_ID[r.module].name}
                    </td>
                    <td className="py-2 px-2 font-mono text-[10.5px] text-ink-dark font-bold">
                      {r.version}
                    </td>
                    <td className="py-2 px-2">
                      <StatusPill tone={STRATEGY_TONE[r.strategy]}>{r.strategy}</StatusPill>
                    </td>
                    <td
                      className={cn(
                        'py-2 px-2 text-right font-mono font-extrabold text-[12px] tabular-nums',
                        r.impactCount ? 'text-warn' : 'text-ok',
                      )}
                    >
                      {r.impactCount}
                    </td>
                    <td className="py-2 px-2">
                      <StatusPill
                        tone={
                          r.outcome === '정상' ? 'ok' : r.outcome === '롤백' ? 'bad' : 'warn'
                        }
                      >
                        {r.outcome}
                      </StatusPill>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-[11px] text-ink-dark font-semibold leading-snug">
                        {r.note}
                      </div>
                      <div className="text-[9.5px] text-ink-light font-semibold mt-0.5 tabular-nums">
                        {r.at} · {r.by}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">{PLATFORM_SCOPE_NOTE}</p>
    </div>
  );
}
