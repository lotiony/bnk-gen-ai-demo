import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { type AgentBuilder } from '@/data/mockAgentTasks';
import {
  MOCK_CATALOG_AGENTS,
  type CatalogAgent,
  type Tenant,
} from '@/data/mockCatalogAgents';

/** 현재 로그인 사용자의 계열사 — 김국민 · PB사업부 · KB국민은행. */
const MY_TENANT: Tenant = 'KB국민은행';

type BuilderKindFilter = 'all' | 'low-code' | 'pro-code';
type HostFilter = 'all' | 'on-prem' | 'csp';

const STATE_TONE: Record<string, 'ok' | 'info' | 'warn' | 'neutral'> = {
  '운영 중': 'ok',
  '실행 중': 'info',
  계획: 'warn',
  보류: 'neutral',
};

/** Studio(노코드)·LangGraph = low-code, 그 외 = pro-code. */
function builderKind(b: AgentBuilder): 'low-code' | 'pro-code' {
  return b === 'pro-code' ? 'pro-code' : 'low-code';
}

/** azure/aws prefix는 CSP, 그 외는 on-prem 화이트리스트 모델. */
function modelHost(modelName: string): 'on-prem' | 'csp' {
  const prefix = modelName.split('/')[0]?.toLowerCase();
  return prefix === 'azure' || prefix === 'aws' || prefix === 'gcp' ? 'csp' : 'on-prem';
}

/**
 * 공통 카탈로그 — 에이전트.
 * 모든 계열사·과제의 에이전트가 한 곳에 모이는 조회·공유 신청 화면.
 * 격자 뷰. 카드 메타는 대고객/대직원·low-code/pro-code·on-prem/csp 3축으로 단순화.
 */
export default function CatalogPage() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<BuilderKindFilter>('all');
  const [host, setHost] = useState<HostFilter>('all');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return MOCK_CATALOG_AGENTS.filter((a) => {
      if (kind !== 'all' && builderKind(a.builder) !== kind) return false;
      if (host !== 'all' && modelHost(a.mainModel) !== host) return false;
      if (ql) {
        // 카드 표시 필드 + ID 기준으로 매칭
        const hay = `${a.id} ${a.name} ${a.mainModel} ${a.ownerName} ${a.description} ${a.projectName}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [q, kind, host]);

  // 필터 칩 카운트
  const counts = useMemo(() => {
    const lowCode = MOCK_CATALOG_AGENTS.filter((a) => builderKind(a.builder) === 'low-code').length;
    const proCode = MOCK_CATALOG_AGENTS.filter((a) => builderKind(a.builder) === 'pro-code').length;
    const onPrem = MOCK_CATALOG_AGENTS.filter((a) => modelHost(a.mainModel) === 'on-prem').length;
    const csp = MOCK_CATALOG_AGENTS.filter((a) => modelHost(a.mainModel) === 'csp').length;
    return { lowCode, proCode, onPrem, csp };
  }, []);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      {/* Page header */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <span className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">공통 카탈로그</span>
          <span className="pill bg-kb-yellow-tint text-ink border border-kb-yellow-dark font-extrabold">
            🤖 에이전트
          </span>
          <span className="text-sm text-ink-mid font-semibold">{MOCK_CATALOG_AGENTS.length}건</span>
          <span className="text-xs text-ink-mid font-medium ml-2.5">
            모든 계열사·과제에 등록된 에이전트를 한 곳에서 조회 — 같은 계열사 자산만 공유 신청 가능
          </span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[280px] max-w-[520px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-sm">🔍</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="에이전트 ID·이름·설명·모델·소유자 검색"
                className="w-full py-2 pl-8 pr-3 border border-line rounded text-[12.5px] bg-white focus:outline-none focus:border-kb-yellow-dark"
              />
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <FilterGroup label="빌더">
            <Chip on={kind === 'all'} onClick={() => setKind('all')}>
              전체
            </Chip>
            <Chip on={kind === 'low-code'} onClick={() => setKind('low-code')}>
              low-code <span className="text-ink-mid">{counts.lowCode}</span>
            </Chip>
            <Chip on={kind === 'pro-code'} onClick={() => setKind('pro-code')}>
              pro-code <span className="text-ink-mid">{counts.proCode}</span>
            </Chip>
          </FilterGroup>
          <span className="w-px h-5 bg-line-soft" />
          <FilterGroup label="모델 호스팅">
            <Chip on={host === 'all'} onClick={() => setHost('all')}>
              전체
            </Chip>
            <Chip on={host === 'on-prem'} onClick={() => setHost('on-prem')} tone="ok">
              on-prem <span className="text-ink-mid">{counts.onPrem}</span>
            </Chip>
            <Chip on={host === 'csp'} onClick={() => setHost('csp')}>
              CSP <span className="text-ink-mid">{counts.csp}</span>
            </Chip>
          </FilterGroup>
        </div>
      </div>

      {/* 결과 요약 */}
      <div className="text-[11.5px] text-ink-mid font-semibold px-1 mb-2.5">
        {q.trim() && (
          <>
            <b className="text-ink-dark">"{q.trim()}"</b> 검색 ·{' '}
          </>
        )}
        <b className="text-ink-dark">{filtered.length}건</b> 표시 · 정렬: 최근 갱신 순
      </div>

      {/* 격자 카드 (3열) */}
      {filtered.length === 0 ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-ink-light font-semibold">
          조건에 맞는 에이전트가 없습니다 · 필터를 조정해 보세요
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => (
            <CatalogAgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ 격자 카드 — 작고 컴팩트 ============ */
function CatalogAgentCard({ agent }: { agent: CatalogAgent }) {
  const sameTenant = agent.tenant === MY_TENANT;
  const kind = builderKind(agent.builder);
  const host = modelHost(agent.mainModel);

  const handleShareRequest = () => {
    if (!sameTenant) return;
    window.alert(
      `[공유 신청 접수]\n\n` +
        `${agent.id} ${agent.name}\n` +
        `소유: ${agent.tenant} · ${agent.projectName}\n\n` +
        `소유 PM(${agent.ownerName})에게 공유 요청이 전송되고, 거버넌스 결재선에 자동 등록됩니다.`,
    );
  };

  return (
    <div
      className={cn(
        'bg-white border rounded-md flex flex-col overflow-hidden transition-colors',
        sameTenant
          ? 'border-line-soft hover:border-kb-yellow-dark hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
          : 'border-line-soft',
      )}
    >
      {/* head */}
      <div className="px-3.5 py-3 border-b border-line-soft">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-6 h-6 rounded bg-kb-yellow-tint text-ink inline-flex items-center justify-center text-[12px] flex-shrink-0">
            🤖
          </span>
          <span className="text-[10px] font-mono font-bold text-ink-mid">{agent.id}</span>
          <span className="ml-auto">
            <StatusPill tone={STATE_TONE[agent.state] ?? 'neutral'}>● {agent.state}</StatusPill>
          </span>
        </div>
        <div className="text-[13px] font-extrabold text-ink leading-tight mb-1">{agent.name}</div>
        <div className="text-[10.5px] text-ink-mid font-medium leading-snug line-clamp-2">
          {agent.description}
        </div>
      </div>

      {/* 3축 메타 pills */}
      <div className="px-3.5 py-2.5 flex items-center gap-1 flex-wrap bg-surface-soft">
        <span
          className={cn(
            'pill border font-extrabold text-[10px]',
            agent.customerFacing
              ? 'bg-kb-yellow text-ink border-kb-yellow-dark'
              : 'bg-info-bg text-info border-info-border',
          )}
        >
          {agent.customerFacing ? '대고객' : '대직원'}
        </span>
        <span
          className={cn(
            'pill border font-extrabold text-[10px]',
            kind === 'pro-code'
              ? 'bg-accent-purple-bg text-accent-purple border-accent-purple-border'
              : 'bg-surface text-ink-dark border-line',
          )}
        >
          {kind}
        </span>
        <span
          className={cn(
            'pill border font-extrabold text-[10px]',
            host === 'on-prem'
              ? 'bg-ok-bg text-ok border-ok-border'
              : 'bg-bad-bg text-bad border-bad-border',
          )}
        >
          {host === 'on-prem' ? 'on-prem' : 'CSP'}
        </span>
      </div>

      {/* tenant / project */}
      <div className="px-3.5 py-2 text-[10.5px] text-ink-mid font-semibold border-b border-line-soft">
        <span className={cn('font-bold', sameTenant ? 'text-ink-dark' : 'text-bad')}>{agent.tenant}</span>
        {!sameTenant && (
          <span className="ml-1 pill bg-bad-bg text-bad border border-bad-border font-extrabold text-[9px]">
            타 계열사
          </span>
        )}
        <div className="text-ink-mid font-medium mt-0.5 truncate">
          {agent.projectName}{' '}
          <span className="text-ink-light text-[9.5px] font-mono">({agent.projectId})</span>
        </div>
      </div>

      {/* footer — owner + 공유 신청 */}
      <div className="px-3.5 py-2.5 mt-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-kb-yellow to-kb-yellow-dark text-ink text-[9px] font-extrabold inline-flex items-center justify-center border border-kb-yellow-dark flex-shrink-0">
            {agent.ownerInitial}
          </span>
          <span className="text-[10.5px] font-bold text-ink-dark truncate">{agent.ownerName}</span>
        </div>
        {sameTenant ? (
          <button
            type="button"
            onClick={handleShareRequest}
            className="py-1 px-2.5 bg-kb-yellow border border-kb-yellow-dark rounded text-[11px] font-extrabold text-ink hover:bg-kb-yellow-dark"
          >
            ＋ 공유 신청
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="그룹 표준 정책상 계열사 간 에이전트 공유는 지원되지 않습니다"
            className="py-1 px-2.5 bg-surface-soft border border-line-soft rounded text-[10.5px] font-bold text-ink-light cursor-not-allowed inline-flex items-center gap-1"
          >
            🔒 공유 불가
          </button>
        )}
      </div>
    </div>
  );
}

/* ============ Filter chips ============ */
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mr-0.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'ok' | 'info';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 py-1 px-2.5 rounded-md border text-[11px] font-bold transition-colors',
        on
          ? tone === 'ok'
            ? 'bg-ok-bg border-ok-border text-ok'
            : tone === 'info'
            ? 'bg-info-bg border-info-border text-info'
            : 'bg-kb-yellow-tint border-kb-yellow-dark text-ink'
          : 'bg-white border-line-soft text-ink-mid hover:border-kb-yellow-dark hover:text-ink-dark',
      )}
    >
      {children}
    </button>
  );
}
