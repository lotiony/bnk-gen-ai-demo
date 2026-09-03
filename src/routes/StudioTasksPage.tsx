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
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import StatusPill from '@/components/ui/StatusPill';
import { useTenant } from '@/lib/tenantStore';
import { useCurrentPersona } from '@/lib/persona';
import { TENANT_SHORT } from '@/data/tenants';
import {
  useStudioTasks,
  scopeTasks,
  KIND_LABEL,
  KIND_TONE,
  type StudioTaskKind,
} from '@/data/studioTasks';
import {
  useTemplates,
  markTemplateUsed,
  TEMPLATE_TARGET,
  type TemplateItem,
} from '@/data/mockTemplates';
import { MOCK_KNOWLEDGE_TASKS } from '@/data/mockKnowledgeTasks';
import Button from '@/components/ui/Button';

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
  const navigate = useNavigate();
  const tenant = useTenant();
  const [kind, setKind] = useState<StudioTaskKind | 'all'>('all');
  const [query, setQuery] = useState('');
  /** 템플릿 상세 모달 — 복제 전에 무엇을 쓰는지 확인시킨다(2A-2). */
  const [detailId, setDetailId] = useState<string | null>(null);

  // 워크플로우 빌더·에이전트 빌더에서 저장한 템플릿이 여기에 그대로 나타난다.
  const templates = useTemplates();

  const allTasks = useStudioTasks();
  const persona = useCurrentPersona();
  /*
   * 전체 조망은 공동존을 운영·감독하는 역할만 받는다. 지주 개발자는 그룹 공통
   * Namespace 에 있어도 남의 계열사 과제를 보지 않는다(SEC-001).
   */
  const scoped = useMemo(
    () => scopeTasks(allTasks, tenant, persona?.canSwitchTenant ?? false),
    [allTasks, tenant, persona],
  );
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

  /*
   * 「내 과제」 — 지금 이 계정이 만들었거나 결재를 올려 둔 것.
   *
   * 전체 목록만 있으면 방금 기안한 에이전트가 남의 과제 사이에 묻힌다.
   * 시연에서 "홈으로 돌아오면 내 것이 결재 진행 중으로 보인다"(2A-8·2B-6)가
   * 성립하려면 내 것이 따로 묶여야 한다.
   */
  const mine = useMemo(
    () => scoped.filter((t) => t.ownerName === persona?.name),
    [scoped, persona],
  );
  const minePending = mine.filter((t) => t.state.includes('결재 진행 중'));

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

      {/* ── 내 과제 · 진행 중 (2A-1 · 2A-8 · 2B-6) ── */}
      {mine.length > 0 && (
        <div className="card px-4 py-3 mb-3.5">
          <div className="flex items-baseline gap-2 mb-2">
            <h2 className="text-[12.5px] font-extrabold text-ink">내 과제</h2>
            <span className="text-[11px] text-ink-mid font-semibold">
              <b className="text-ink-dark">{persona?.name}</b> 담당 · {mine.length}건
              {minePending.length > 0 && (
                <>
                  {' '}· 결재 진행 중{' '}
                  <b className="text-warn">{minePending.length}건</b>
                </>
              )}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {mine.slice(0, 6).map((t) => {
              const pending = t.state.includes('결재 진행 중');
              return (
                <Link
                  key={`${t.kind}-${t.id}`}
                  to={t.href}
                  className={cn(
                    'border rounded px-3 py-2.5 bg-white block hover:border-brand-dark transition-colors',
                    pending ? 'border-warn-border' : 'border-line-soft',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('pill border', KIND_TONE[t.kind])}>{KIND_LABEL[t.kind]}</span>
                    <span className="ml-auto text-[9.5px] font-mono font-bold text-ink-light">{t.id}</span>
                  </div>
                  <div className="text-[12px] font-extrabold text-ink leading-tight truncate" title={t.name}>
                    {t.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <StatusPill tone={pending ? 'warn' : stateTone(t.state)}>{t.state}</StatusPill>
                    <span className="ml-auto text-[10px] text-ink-mid font-semibold">{t.updatedAt}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 템플릿 (29 템플릿화 및 재사용 자산 관리) ── */}
      <div className="card px-4 py-3 mb-3.5">
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-[12.5px] font-extrabold text-ink">템플릿에서 시작</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            검증된 자산을 템플릿으로 저장해 두면 다른 조직이 복제해 시작한다 ·{' '}
            <b className="text-ink-dark">{templates.length}</b>건
          </span>
          <span className="ml-auto text-[10px] font-mono font-bold text-ink-light">2-1 템플릿화</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {templates.map((t) => (
            <div key={t.id} className="border border-line-soft rounded px-3 py-2.5 bg-white">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{t.kind}</span>
                <span className="ml-auto text-[10px] text-ink-mid font-semibold">{t.usedCount}회 사용</span>
              </div>
              <div className="text-[12px] font-extrabold text-ink leading-tight mb-1">{t.name}</div>
              <p className="text-[10.5px] text-ink-mid font-semibold leading-snug mb-1.5">{t.desc}</p>
              <div className="flex items-center gap-1.5">
                {/*
                  바로 복제하지 않고 상세를 먼저 연다 — 용도·연결 지식·사용 실적을
                  보고 고르는 것이 '검증된 자산 재사용' 이다(2-1 템플릿화).
                */}
                <button
                  type="button"
                  onClick={() => setDetailId(t.id)}
                  className="text-[10.5px] font-extrabold text-info hover:underline"
                >템플릿 상세 →</button>
                <span className="ml-auto text-[9.5px] font-mono font-bold text-ink-light">{t.id}</span>
              </div>
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

      {/* ── 템플릿 상세 모달 (2A-2) ── */}
      {detailId && (() => {
        const t = templates.find((x) => x.id === detailId);
        if (!t) return null;
        return (
          <TemplateDetailModal
            tpl={t}
            onClose={() => setDetailId(null)}
            onUse={() => {
              // 재사용 자산 관리 지표 — 복제하면 사용 횟수가 실제로 올라간다.
              markTemplateUsed(t.id);
              setDetailId(null);
              toast(
                `${t.name} 템플릿을 복제했습니다`,
                `${t.id} · 저장 ${t.savedBy} — 빌더에 구성이 채워진 상태로 열립니다`,
                'ok',
              );
              // 토스트로 끝내면 '복제' 가 말뿐이다. 해당 빌더를 템플릿 구성이
              // 채워진 상태로 연다(`?tpl=` 을 빌더가 해석한다).
              navigate(`${TEMPLATE_TARGET[t.kind]}?tpl=${t.id}`);
            }}
          />
        );
      })()}

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

/* ═══════════════ 템플릿 상세 (2A-2) ═══════════════ */

/**
 * RFP 2-1 「에이전트/워크플로우/프롬프트의 템플릿화 및 조직 내 재사용 자산 관리」
 *
 * 카드에서 바로 빌더로 보내면 개발자가 **무엇을 복제하는지 모르고 고른다.**
 * 용도·구성·연결 지식·사용 실적을 먼저 보여 주고, 거기서 복제로 넘긴다.
 */
function TemplateDetailModal({
  tpl,
  onUse,
  onClose,
}: {
  tpl: TemplateItem;
  onUse: () => void;
  onClose: () => void;
}) {
  const agent = tpl.preset?.kind === '에이전트' ? tpl.preset.agent : null;
  const wf = tpl.preset?.kind === '워크플로우' ? tpl.preset : null;
  const linked = agent
    ? MOCK_KNOWLEDGE_TASKS.filter((k) => agent.linkedKnowledge.includes(k.id))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-6">
      <div className="w-full max-w-[600px] max-h-[86vh] overflow-auto bg-white border border-line rounded-lg shadow-xl">
        <div className="px-5 py-4 border-b border-line-soft">
          <div className="flex items-center gap-2 mb-1">
            <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{tpl.kind}</span>
            <h2 className="text-[15px] font-extrabold text-ink">{tpl.name}</h2>
            <span className="ml-auto text-[10.5px] font-mono font-bold text-ink-light">{tpl.id}</span>
          </div>
          <p className="text-[11.5px] text-ink-mid font-semibold">{tpl.desc}</p>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <section>
            <SubTitle>사용 실적</SubTitle>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="복제 사용" value={`${tpl.usedCount}회`} />
              <MiniStat label="저장" value={tpl.savedBy} />
            </div>
          </section>

          {agent && (
            <>
              <section>
                <SubTitle>복제되는 구성</SubTitle>
                <dl className="grid grid-cols-[86px_1fr] gap-y-1 text-[11.5px]">
                  <dt className="text-ink-mid font-semibold">배포 단계</dt>
                  <dd className="text-ink-dark font-bold">{agent.stage}</dd>
                  <dt className="text-ink-mid font-semibold">주력 모델</dt>
                  <dd className="text-ink-dark font-bold font-mono text-[11px]">{agent.mainModel}</dd>
                  <dt className="text-ink-mid font-semibold">도구</dt>
                  <dd className="text-ink-dark font-bold">{agent.tools.join(' · ') || '없음'}</dd>
                  <dt className="text-ink-mid font-semibold">가드레일</dt>
                  <dd className="text-ink-dark font-bold">
                    PII 마스킹 {agent.pii ? '활성' : '비활성'} · 레드팀 {agent.redteam ? '필수' : '생략'}
                  </dd>
                </dl>
              </section>
              <section>
                <SubTitle>기능 — 시스템 프롬프트가 정의하는 일</SubTitle>
                <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed bg-surface-soft border border-line-soft rounded px-3 py-2">
                  {agent.systemPrompt}
                </p>
              </section>
              <section>
                <SubTitle>연결 지식</SubTitle>
                {linked.length === 0 ? (
                  <div className="text-[11.5px] text-warn font-semibold">연결된 지식이 없습니다</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {linked.map((k) => (
                      <div key={k.id} className="flex items-center gap-2.5 px-3 py-2 border border-line-soft rounded">
                        <span className="text-[10px] font-mono font-bold text-ink-light">{k.id}</span>
                        <span className="text-[11.5px] font-extrabold text-ink truncate">{k.name}</span>
                        <span className="ml-auto text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">
                          소유 {k.ownerName} · 갱신 {k.updatedAt}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {wf && (
            <section>
              <SubTitle>복제되는 구성</SubTitle>
              <div className="text-[11.5px] text-ink-dark font-semibold">
                노드 {wf.nodes.length}개 · 연결 {wf.edges.length}개 — 캔버스에 그대로 배치됩니다
              </div>
            </section>
          )}

          {tpl.preset?.kind === '프롬프트' && (
            <section>
              <SubTitle>복제되는 구성</SubTitle>
              <div className="text-[11.5px] text-ink-dark font-semibold">
                프롬프트 라이브러리의 <b>{tpl.preset.promptId}</b> 템플릿을 엽니다
              </div>
            </section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line-soft flex items-center gap-2">
          <span className="text-[11px] text-ink-mid font-semibold">
            복제하면 빌더가 이 구성으로 채워진 채 열립니다
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>닫기</Button>
            <Button variant="primary" onClick={onUse}>이 템플릿 사용하기 →</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px] mb-1.5">
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line-soft bg-white px-3 py-2">
      <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px]">{label}</div>
      <div className="text-[13px] font-extrabold text-ink mt-0.5">{value}</div>
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
