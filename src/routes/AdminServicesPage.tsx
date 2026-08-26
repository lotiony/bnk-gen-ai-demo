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
import {
  SERVICE_ITEMS,
  PUBLISH_TONE,
  DEPLOY_TONE,
  SHARE_SCOPES,
  type ServiceItem,
  type PublishState,
  type ShareScope,
} from '@/data/mockServiceRegistry';

type Tab = 'publish' | 'deploy' | 'scope';

export default function AdminServicesPage() {
  const [tab, setTab] = useState<Tab>('publish');
  const [items, setItems] = useState<ServiceItem[]>(SERVICE_ITEMS);

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

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">서비스 운영 · 배포 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            AI서비스 · Agent · MCP 의 게시 상태, 배포 현황, 공개범위·운영영역을 관리한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal flex-shrink-0 mt-1">
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
        <div className="flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[70px_1fr_auto_auto] gap-3 items-center px-4 py-2.5 bg-white border border-line-soft rounded">
              <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{it.kind}</span>
              <div className="min-w-0">
                <span className="text-[12.5px] font-extrabold text-ink">{it.name}</span>
                <span className="ml-2 text-[10px] font-mono font-bold text-ink-light">{it.version}</span>
              </div>
              <span className="text-[10.5px] text-ink-mid font-semibold">{TENANT_SHORT[it.tenant]}</span>
              <StatusPill tone={DEPLOY_TONE[it.deployStatus]}>{it.deployStatus}</StatusPill>
            </div>
          ))}
        </div>
      )}

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
                onChange={() => toast('운영영역 변경은 서빙 트래픽 재라우팅을 동반합니다 — 감사 원장에 기록됩니다')}
                className="py-1 px-2 border border-line rounded text-[11px] bg-white font-semibold"
              >
                <option>그룹 공통 운영영역</option>
                <option>계열사 전용 운영영역</option>
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
