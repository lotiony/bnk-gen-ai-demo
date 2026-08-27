/**
 * AI Studio — 과제 목록.
 *
 * RFP: AGB-001(에이전트 빌더) · AGB-002(워크플로우 빌더) · AGB-011(버전·배포 이력 통합)
 *      LSM-009(승인 기반 에이전트 배포) · ONM-008(개발 환경)
 *      2-1 포탈 공통(역할별 워크스페이스) · 2-1 기타(공통/전용 영역 논리적 분리)
 *
 * 프로젝트로 묶지 않고 과제를 바로 나열한다. 대신 두 축으로 좁힌다 —
 *   · 상단 Namespace 스위처(테넌트)  : 남의 계열사 자산은 애초에 안 보인다
 *   · 종류 필터                      : 에이전트 / 워크플로우 / 지식 / …
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import StatusPill from '@/components/ui/StatusPill';
import { useTenant } from '@/lib/tenantStore';
import { TENANT_SHORT } from '@/data/tenants';
import {
  STUDIO_TASKS,
  scopeTasks,
  KIND_LABEL,
  KIND_TONE,
  type StudioTaskKind,
} from '@/data/studioTasks';
import { TEMPLATES } from '@/data/mockTemplates';

const KIND_ORDER: StudioTaskKind[] = [
  'agent',
  'workflow',
  'knowledge',
  'pipeline',
  'model',
  'devenv',
  'ontology',
];

/** 상태 문자열은 과제 종류마다 어휘가 달라서 톤만 매핑한다. */
function stateTone(state: string): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (state.includes('운영')) return 'ok';
  if (state.includes('실행') || state.includes('배포')) return 'info';
  if (state.includes('평가') || state.includes('계획') || state.includes('기획')) return 'warn';
  if (state.includes('보류') || state.includes('오류') || state.includes('정지')) return 'bad';
  return 'neutral';
}

/** 새 과제 시작 진입 — 빌더로 바로 보낸다. */
const STARTERS: { label: string; desc: string; to: string; req: string }[] = [
  {
    label: '에이전트',
    desc: '프롬프트 · 모델 · 도구를 묶어 업무 에이전트를 만든다',
    to: '/studio/agents',
    req: 'AGB-001',
  },
  {
    label: '워크플로우',
    desc: '드래그 앤 드롭으로 다단계 업무 절차를 설계한다',
    to: '/studio/workflow',
    req: 'AGB-002',
  },
  {
    label: 'Tool · MCP',
    desc: 'OpenAPI · 금융 전문을 코딩 없이 Tool 로 변환한다',
    to: '/studio/tools',
    req: 'AGB-004',
  },
  {
    label: '플레이그라운드',
    desc: '모델 · RAG 설정을 바꿔 가며 응답을 시험한다',
    to: '/studio/playground',
    req: 'LSM-005',
  },
];

export default function StudioTasksPage() {
  const tenant = useTenant();
  const [kind, setKind] = useState<StudioTaskKind | 'all'>('all');
  const [query, setQuery] = useState('');

  const scoped = useMemo(() => scopeTasks(STUDIO_TASKS, tenant), [tenant]);
  const visible = useMemo(() => {
    let arr = scoped;
    if (kind !== 'all') arr = arr.filter((t) => t.kind === kind);
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.note.toLowerCase().includes(q),
      );
    }
    return [...arr].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [scoped, kind, query]);

  const countOf = (k: StudioTaskKind) => scoped.filter((t) => t.kind === k).length;

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">과제</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            <b className="text-ink-dark">{tenant}</b> Namespace 에서 보이는 과제{' '}
            <b className="text-ink-dark">{scoped.length}</b>건 · 그룹 공통 자산은 모든 계열사에서
            함께 보인다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          AGB-001 · 011
        </span>
      </div>

      {/* ── 새 과제 시작 ── */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        {STARTERS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="card px-3.5 py-3 hover:border-brand-dark transition-colors block"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[12.5px] font-extrabold text-ink">+ {s.label}</span>
              <span className="rfp-chip ml-auto text-[9px] font-mono font-bold text-ink-light">{s.req}</span>
            </div>
            <p className="text-[10.5px] text-ink-mid font-semibold leading-snug">{s.desc}</p>
          </Link>
        ))}
      </div>

      {/* ── 템플릿 (29 템플릿화 및 재사용 자산 관리) ── */}
      <div className="card px-4 py-3 mb-3.5">
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-[12.5px] font-extrabold text-ink">템플릿에서 시작</h2>
          <span className="text-[10px] font-mono font-bold text-ink-light">2-1 템플릿화</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="border border-line-soft rounded px-3 py-2.5 bg-white">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{t.kind}</span>
                <span className="ml-auto text-[10px] text-ink-mid font-semibold">{t.usedCount}회 사용</span>
              </div>
              <div className="text-[12px] font-extrabold text-ink leading-tight mb-1">{t.name}</div>
              <p className="text-[10.5px] text-ink-mid font-semibold leading-snug mb-1.5">{t.desc}</p>
              <button
                type="button"
                onClick={() => toast(`${t.name} 템플릿을 복제해 새 과제를 시작합니다`)}
                className="text-[10.5px] font-extrabold text-info hover:underline"
              >이 템플릿 사용하기 →</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── 필터 ── */}
      <div className="card px-4 py-3 mb-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <FilterChip active={kind === 'all'} onClick={() => setKind('all')}>
            전체 {scoped.length}
          </FilterChip>
          {KIND_ORDER.filter((k) => countOf(k) > 0).map((k) => (
            <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]} {countOf(k)}
            </FilterChip>
          ))}
        </div>
        <div className="relative ml-auto min-w-[220px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-[12px]">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="과제명 · ID"
            className="w-full py-1.5 pl-8 pr-3 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark"
          />
        </div>
      </div>

      {/* ── 목록 ── */}
      {visible.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <div className="text-[28px] mb-2">🗂️</div>
          <h2 className="text-[14px] font-extrabold text-ink mb-1">조건에 맞는 과제가 없습니다</h2>
          <p className="text-[11.5px] text-ink-mid font-semibold">
            상단 Namespace 를 바꾸면 다른 계열사의 과제 범위로 이동합니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((t) => (
            <Link
              key={`${t.kind}-${t.id}`}
              to={t.href}
              className="grid grid-cols-[92px_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 bg-white border border-line-soft rounded hover:border-brand-dark transition-colors"
            >
              <span className={cn('pill border justify-center', KIND_TONE[t.kind])}>
                {KIND_LABEL[t.kind]}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-extrabold text-ink truncate">{t.name}</span>
                  <span className="text-[10px] font-mono font-bold text-ink-light flex-shrink-0">
                    {t.id}
                  </span>
                </div>
                <div className="text-[11px] text-ink-mid font-semibold mt-0.5 truncate">
                  {t.note}
                </div>
              </div>
              <span
                className={cn(
                  'pill border whitespace-nowrap',
                  t.tenant === '그룹 공통'
                    ? 'bg-brand-tint text-brand border-brand-tint'
                    : 'bg-surface-soft text-ink-mid border-line-soft',
                )}
              >
                {TENANT_SHORT[t.tenant]}
              </span>
              <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap tabular-nums">
                {t.ownerName} · {t.updatedAt}
              </span>
              <StatusPill tone={stateTone(t.state)}>{t.state}</StatusPill>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full border text-[11px] font-extrabold transition-colors',
        active
          ? 'bg-brand-dark border-brand-dark text-white'
          : 'bg-white border-line text-ink-dark hover:border-brand-dark',
      )}
    >
      {children}
    </button>
  );
}
