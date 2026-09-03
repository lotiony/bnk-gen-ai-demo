/**
 * 관리 콘솔 — 서비스 운영 · 배포 관리.
 *
 * RFP 2-1 관리자 포털:
 *   38 AI서비스·Agent·MCP 등록·게시·중지 운영관리
 *   40 그룹 공통/계열사 전용 AI자산의 공개·공유 범위 설정
 *   41 그룹 공통서비스/계열사 전용서비스 운영영역 분리 및 관리
 *   45 서비스 배포 관리: 배포 승인·진행 상태, 테스트·배포 현황
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import { useCurrentPersona } from '@/lib/persona';
import { isAffiliateConsoleAdmin } from '@/lib/personaView';
import {
  SERVICE_ITEMS,
  PUBLISH_TONE,
  DEPLOY_TONE,
  SHARE_SCOPES,
  OPERATING_AREAS,
  SLA_WARN_PCT,
  isSlaWarn,
  type ServiceItem,
  type PublishState,
  type ShareScope,
  type OperatingArea,
} from '@/data/mockServiceRegistry';

type Tab = 'publish' | 'deploy' | 'scope';

export default function AdminServicesPage() {
  const persona = useCurrentPersona();
  /*
   * 계열사 관리자는 **자기 계열사 서비스만** 다룬다. 그룹 공통 운영영역의 서비스는
   * 지주가 운영하므로 여기 나오지 않는다 — 남의 서비스에 「중지」 버튼이 보이면
   * 운영영역 분리(RFP 2-1 [41])가 화면에서 무너진다.
   */
  const affiliate = isAffiliateConsoleAdmin(persona);
  const myTenant = persona?.tenant;
  const [tab, setTab] = useState<Tab>('publish');
  const [allItems, setItems] = useState<ServiceItem[]>(SERVICE_ITEMS);
  const items = useMemo(
    () => (affiliate ? allItems.filter((it) => it.tenant === myTenant) : allItems),
    [affiliate, allItems, myTenant],
  );
  /** 상세 패널 — 배포 현황에서 행을 누르면 열린다. */
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((it) => it.id === openId) ?? null;
  const slaWarn = useMemo(() => items.filter(isSlaWarn), [items]);

  const togglePublish = (id: string) => {
    setItems((arr) =>
      arr.map((it) => {
        if (it.id !== id) return it;
        const next: PublishState = it.publishState === '게시 중' ? '중지됨' : '게시 중';
        toast(`${it.name} · ${next === '게시 중' ? '게시했습니다' : '게시를 중지했습니다'}`);
        return { ...it, publishState: next };
      }),
    );
  };

  const setScope = (id: string, scope: ShareScope) => {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, shareScope: scope } : it)));
    toast('공개·공유 범위를 변경했습니다 — 감사 원장에 기록됩니다');
  };

  /**
   * RFP 2-1 [41] "그룹 공통서비스 및 계열사 전용서비스의 **운영영역 분리 및 관리** 기능".
   * 예전에는 select 가 controlled 인데 onChange 가 토스트만 띄워 선택하는 순간
   * 원래 값으로 되돌아갔다 — 제안서 캡처 대상 화면에서 요건이 동작하지 않는 셈이었다.
   * 공개범위(setScope)와 같은 방식으로 실제 상태를 바꾼다.
   */
  const setOperatingArea = (id: string, area: OperatingArea) => {
    setItems((arr) =>
      arr.map((it) => {
        if (it.id !== id || it.operatingArea === area) return it;
        // 계열사 전용으로 내리면 공개범위가 '그룹 전체'로 남을 수 없다 — 같이 좁힌다.
        const nextScope: ShareScope =
          area === '계열사 전용 운영영역' && it.shareScope === '그룹 전체' ? '계열사' : it.shareScope;
        return { ...it, operatingArea: area, shareScope: nextScope };
      }),
    );
    toast(`${area}으로 이관했습니다 — 서빙 트래픽 재라우팅 · 감사 원장에 기록됩니다`);
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">서비스 운영 · 배포 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            {affiliate ? (
              <>
                <b className="text-ink-dark">{myTenant}</b> 전용 운영영역의 서비스 {items.length}건 · 그룹
                공통 운영영역은 지주가 운영한다
              </>
            ) : (
              <>AI서비스 · Agent · MCP 의 게시 상태, 배포 현황, 공개범위·운영영역을 관리한다</>
            )}
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          2-1 서비스운영·배포
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-line mb-3.5">
        {([
          { k: 'publish' as const, label: '게시 · 운영관리', req: '38' },
          { k: 'deploy' as const, label: '배포 현황', req: '45' },
          { k: 'scope' as const, label: '공개범위 · 운영영역', req: '40 · 41' },
        ]).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k ? 'text-brand border-brand' : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[9px] font-mono font-bold text-ink-light">{t.req}</span>
          </button>
        ))}
      </div>

      {tab === 'publish' && (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[70px_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 bg-white border border-line-soft rounded">
              <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{it.kind}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-extrabold text-ink truncate">{it.name}</span>
                  <span className="text-[10px] font-mono font-bold text-ink-light">{it.id}</span>
                </div>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                  {TENANT_SHORT[it.tenant]} · {it.version} · {it.lastActionBy} · {it.lastActionAt}
                </div>
              </div>
              <StatusPill tone="neutral">{it.operatingArea === '그룹 공통 운영영역' ? '그룹 공통' : '계열사 전용'}</StatusPill>
              <StatusPill tone={PUBLISH_TONE[it.publishState]}>{it.publishState}</StatusPill>
              <button
                type="button"
                onClick={() => togglePublish(it.id)}
                className={cn(
                  'py-1 px-2.5 rounded text-[11px] font-extrabold border whitespace-nowrap',
                  it.publishState === '게시 중'
                    ? 'border-line text-ink-dark hover:border-bad hover:text-bad'
                    : 'bg-brand border-brand-dark text-white hover:bg-brand-dark',
                )}
              >
                {it.publishState === '게시 중' ? '중지' : '게시'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'deploy' && (
        <div className="space-y-3">
          {/*
            SLA 주의 — 이상 징후를 먼저 띄운다. 계열사 관리자의 아침은 여기서 시작한다
            (시연 3B-3). 문턱은 대시보드 SLO 카드와 같은 99% 다.
          */}
          <section
            className={cn(
              'card px-4 py-3 border',
              slaWarn.length ? 'border-warn-border bg-warn-bg' : 'border-line-soft',
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-[13px] font-extrabold text-ink">SLA 주의 서비스</h2>
              <span className={cn('pill border', slaWarn.length ? 'bg-white text-warn border-warn-border' : 'bg-surface-soft text-ink-mid border-line-soft')}>
                {slaWarn.length}건
              </span>
              <span className="text-[10.5px] text-ink-mid font-semibold">
                P95 목표 충족률 {SLA_WARN_PCT}% 미만 · 운영 중 서비스 기준
              </span>
            </div>
            {slaWarn.length === 0 ? (
              <div className="text-[11.5px] text-ink-mid font-semibold">전 서비스 목표 충족 중</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {slaWarn.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setOpenId(it.id)}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2 bg-white border border-warn-border rounded text-left hover:border-warn"
                  >
                    <div className="min-w-0">
                      <span className="text-[12px] font-extrabold text-ink">{it.name}</span>
                      <span className="ml-2 text-[10px] font-mono font-bold text-ink-light">{it.id}</span>
                    </div>
                    <span className="text-[11px] font-bold text-ink-dark tabular-nums whitespace-nowrap">
                      P95 {(it.sla!.p95Ms / 1000).toFixed(1)}s / 목표 {(it.sla!.sloTargetMs / 1000).toFixed(1)}s
                    </span>
                    <span className="text-[11px] font-extrabold text-warn tabular-nums">
                      충족률 {it.sla!.attainmentPct.toFixed(1)}%
                    </span>
                    <span className="text-[11px] font-extrabold text-info">상세 →</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-1.5">
            {items.map((it) => {
              const warn = isSlaWarn(it);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setOpenId(it.id)}
                  className={cn(
                    'grid grid-cols-[70px_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 bg-white border rounded text-left hover:border-brand-dark',
                    openId === it.id ? 'border-brand-dark' : warn ? 'border-warn-border' : 'border-line-soft',
                  )}
                >
                  <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{it.kind}</span>
                  <div className="min-w-0">
                    <span className="text-[12.5px] font-extrabold text-ink">{it.name}</span>
                    <span className="ml-2 text-[10px] font-mono font-bold text-ink-light">{it.version}</span>
                  </div>
                  <span className="text-[10.5px] text-ink-mid font-semibold">{TENANT_SHORT[it.tenant]}</span>
                  {it.sla ? (
                    <span className={cn('text-[10.5px] font-bold tabular-nums whitespace-nowrap', warn ? 'text-warn' : 'text-ok')}>
                      {warn ? '⚠ ' : '✓ '}SLA {it.sla.attainmentPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-ink-light font-semibold">계측 전</span>
                  )}
                  <StatusPill tone={DEPLOY_TONE[it.deployStatus]}>{it.deployStatus}</StatusPill>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && <ServiceDetailPanel item={open} onClose={() => setOpenId(null)} />}

      {tab === 'scope' && (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 bg-white border border-line-soft rounded">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-extrabold text-ink truncate">{it.name}</span>
                  <span className="text-[10px] font-mono font-bold text-ink-light">{it.id}</span>
                </div>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{TENANT_SHORT[it.tenant]}</div>
              </div>
              <select
                value={it.operatingArea}
                onChange={(e) => setOperatingArea(it.id, e.target.value as OperatingArea)}
                className="py-1 px-2 border border-line rounded text-[11px] bg-white font-semibold"
              >
                {OPERATING_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select
                value={it.shareScope}
                onChange={(e) => setScope(it.id, e.target.value as ShareScope)}
                className="py-1 px-2 border border-line rounded text-[11px] bg-white font-semibold"
              >
                {SHARE_SCOPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════ 서비스 상세 — 최근 활동 · SLA 메트릭 ═══════════════ */

/**
 * RFP 2-1 [45] "배포 승인·진행 상태 조회, 테스트·배포 현황 관리"
 *
 * 이상 서비스의 **원인을 여기서 짚는다**(시연 3B-4). 메트릭 네 개와 최근 활동을
 * 시간순으로 놓으면 "언제부터 · 어디서 · 왜" 가 한 화면에 잡힌다. 조치 버튼은
 * 두지 않는다 — 조치는 과제 쪽 배포 절차(결재)를 타야 하고, 여기서 눌러 바꾸는
 * 그림을 그리면 그게 확약이 된다.
 */
function ServiceDetailPanel({ item, onClose }: { item: ServiceItem; onClose: () => void }) {
  const warn = isSlaWarn(item);
  const sla = item.sla;
  const KIND_TONE: Record<NonNullable<ServiceItem['activity']>[number]['kind'], string> = {
    배포: 'bg-info-bg text-info border-info-border',
    게시: 'bg-ok-bg text-ok border-ok-border',
    조치: 'bg-ok-bg text-ok border-ok-border',
    지연: 'bg-warn-bg text-warn border-warn-border',
    오류: 'bg-bad-bg text-bad border-bad-border',
  };
  return (
    <section className={cn('card px-5 py-4 mt-3 border', warn ? 'border-warn-border' : 'border-line-soft')}>
      <div className="flex items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{item.kind}</span>
            <h2 className="text-[14px] font-extrabold text-ink">{item.name}</h2>
            <span className="text-[10.5px] font-mono font-bold text-ink-light">{item.id} · {item.version}</span>
            <StatusPill tone={DEPLOY_TONE[item.deployStatus]}>{item.deployStatus}</StatusPill>
            {warn && <StatusPill tone="warn">SLA 주의</StatusPill>}
          </div>
          <p className="text-[11px] text-ink-mid font-semibold mt-1">
            {TENANT_SHORT[item.tenant]} · {item.operatingArea} · 공개 {item.shareScope} · 최근 조치{' '}
            {item.lastActionBy} · {item.lastActionAt}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-extrabold text-ink-mid hover:text-ink border border-line rounded px-2 py-1"
        >
          닫기 ✕
        </button>
      </div>

      {sla ? (
        <div className="grid grid-cols-4 gap-2.5 mb-3.5">
          <Metric
            label="P95 응답"
            value={`${(sla.p95Ms / 1000).toFixed(1)}s`}
            sub={`목표 ${(sla.sloTargetMs / 1000).toFixed(1)}s`}
            bad={sla.p95Ms > sla.sloTargetMs}
          />
          <Metric
            label="P95 목표 충족률"
            value={`${sla.attainmentPct.toFixed(1)}%`}
            sub={`주의 기준 ${SLA_WARN_PCT}%`}
            bad={warn}
          />
          <Metric label="오류율 (7일)" value={`${sla.errorRatePct.toFixed(1)}%`} sub="타임아웃 포함" bad={sla.errorRatePct >= 1} />
          <Metric label="호출 (7일)" value={sla.calls7d.toLocaleString('ko-KR')} sub="서빙계 실측" />
        </div>
      ) : (
        <div className="text-[11.5px] text-ink-mid font-semibold mb-3.5">
          아직 계측 대상이 아니다 — 게시 전이거나 중지된 서비스는 SLA 를 재지 않는다.
        </div>
      )}

      <div>
        <div className="text-[10.5px] font-extrabold text-ink-light uppercase tracking-[0.3px] mb-1.5">
          최근 활동 · 최신순
        </div>
        {item.activity?.length ? (
          <ol className="space-y-1">
            {item.activity.map((a, i) => (
              <li key={i} className="grid grid-cols-[112px_56px_1fr_auto] gap-2.5 items-baseline px-3 py-1.5 bg-white border border-line-soft rounded">
                <span className="text-[10.5px] font-mono font-semibold text-ink-mid whitespace-nowrap">{a.at}</span>
                <span className={cn('pill border justify-center', KIND_TONE[a.kind])}>{a.kind}</span>
                <span className="text-[11.5px] font-semibold text-ink-dark leading-snug">{a.text}</span>
                <span className="text-[10.5px] text-ink-light font-semibold whitespace-nowrap">{a.by}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-[11.5px] text-ink-mid font-semibold">기록된 활동이 없다.</div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className={cn('rounded border px-3 py-2.5 bg-white', bad ? 'border-warn-border' : 'border-line-soft')}>
      <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px]">{label}</div>
      <div className={cn('text-[18px] font-extrabold tabular-nums mt-0.5', bad ? 'text-warn' : 'text-ink')}>{value}</div>
      {sub && <div className="text-[10.5px] text-ink-mid font-semibold">{sub}</div>}
    </div>
  );
}
