/**
 * 지식 · 데이터 — 지식 데이터 과제 목록.
 *
 * RFP: RAG-004(테넌트/에이전트별 데이터소스 저장소) · RAG-002(청킹·임베딩 선택)
 *      RAG-005(Vector DB 계열사별 인덱스 분리) · EDA-003(비정형 연동)
 *
 * 계열사별로 저장소가 갈린다는 것을 목록 단계에서 보여 준다 —
 * RAG-005 는 "계열사별 Vector DB 인덱스(또는 컬렉션) 분리" 를 명시 요구한다.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { useTenant } from '@/lib/tenantStore';
import { TENANT_SHORT, TENANTS } from '@/data/tenants';
import { STUDIO_TASKS, scopeTasks } from '@/data/studioTasks';

/** 지식·데이터 메뉴에서 여는 도구들. */
const TOOLS: { label: string; desc: string; to: string; req: string }[] = [
  {
    label: '온톨로지 · 지식그래프',
    desc: '도메인 온톨로지를 설계하고 Graph RAG 리트리버에 연결한다',
    to: '/knowledge/ontology',
    req: 'RAG-007 · 008',
  },
  {
    label: '검색 파이프라인',
    desc: '하이브리드 서치 · 리랭킹 · 골든셋 평가를 한 흐름으로 처리한다',
    to: '/knowledge/pipeline',
    req: 'RAG-006 · 009',
  },
  {
    label: '데이터 라우팅',
    desc: '승인 상태에 따라 개발 DB / 운영 DB 를 런타임에서 전환한다',
    to: '/knowledge/routing',
    req: 'EDA-005 · SEC-007',
  },
  {
    label: '메타데이터 승인',
    desc: '자동 생성된 비즈니스 메타데이터를 Data Owner 가 사전 검증한다',
    to: '/knowledge/metadata',
    req: 'EDA-008',
  },
];

function stateTone(state: string): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (state.includes('완료') || state.includes('운영')) return 'ok';
  if (state.includes('실행') || state.includes('배포')) return 'info';
  if (state.includes('계획') || state.includes('평가') || state.includes('기획')) return 'warn';
  if (state.includes('보류')) return 'bad';
  return 'neutral';
}

export default function KnowledgeListPage() {
  const tenant = useTenant();
  const meta = TENANTS.find((t) => t.name === tenant);

  const tasks = useMemo(
    () =>
      scopeTasks(STUDIO_TASKS, tenant).filter(
        (t) => t.kind === 'knowledge' || t.kind === 'pipeline' || t.kind === 'ontology',
      ),
    [tenant],
  );

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">지식 데이터</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            원천 수집 · 파싱 · 청킹 · 임베딩 · 인덱스를 과제 단위로 관리한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          RAG-002 · 004 · 005
        </span>
      </div>

      {/* 격리 안내 — RAG-005 · SEC-001 */}
      <div className="border border-line bg-surface-soft rounded px-3.5 py-2.5 mb-3.5">
        <div className="text-[11.5px] font-extrabold text-ink mb-0.5">
          {tenant} 전용 저장소 · <span className="font-mono text-ink-mid">{meta?.namespace}</span>
        </div>
        <p className="text-[11px] text-ink-dark font-semibold leading-snug">
          검색엔진 인덱스 · Vector 컬렉션 · Object Storage 는 Namespace 단위로 분리되고,
          영구 볼륨(LUN)도 독립 연결된다. 다른 계열사의 인덱스는 이 목록에 나타나지 않는다.
        </p>
      </div>

      {/* 도구 진입 */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="card px-3.5 py-3 hover:border-brand-dark transition-colors block"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[12px] font-extrabold text-ink leading-tight">{t.label}</span>
            </div>
            <p className="text-[10.5px] text-ink-mid font-semibold leading-snug mb-1.5">{t.desc}</p>
            <span className="rfp-chip text-[9px] font-mono font-bold text-ink-light">{t.req}</span>
          </Link>
        ))}
      </div>

      {/* 과제 목록 */}
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[13px] font-extrabold text-ink">지식 자산 과제 {tasks.length}건</h2>
        <Link
          to="/knowledge/data"
          className="text-[11.5px] font-extrabold text-info hover:underline"
        >
          + 새 지식 데이터 과제
        </Link>
      </div>
      <div className="flex flex-col gap-1.5">
        {tasks.map((t) => (
          <Link
            key={`${t.kind}-${t.id}`}
            to={t.href}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 bg-white border border-line-soft rounded hover:border-brand-dark transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-extrabold text-ink truncate">{t.name}</span>
                <span className="text-[10px] font-mono font-bold text-ink-light flex-shrink-0">
                  {t.id}
                </span>
              </div>
              <div className="text-[11px] text-ink-mid font-semibold mt-0.5 truncate">{t.note}</div>
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
    </div>
  );
}
