/**
 * AI Studio — 개발환경 목록.
 *
 * RFP: ONM-008 개발 환경 구축
 *      "개발/운영 에이전트가 운영되는 운영환경 이외에 **플레이 그라운드 개념의
 *       개발 환경의 클러스터 구축** 및 AI플랫폼 환경 구성"
 *
 * 프로젝트 상세의 탭으로만 열리던 화면을 Studio 상위 항목으로 올렸다.
 * 개발 환경이 운영과 분리된 별도 클러스터라는 사실을 상단 배너에서 못 박는다.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import {
  MOCK_DEVENV_TASKS,
  DEVENV_LABEL,
  type DevenvState,
  type DevenvKind,
} from '@/data/mockDevenvTasks';

const STATE_TONE: Record<DevenvState, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  '실행 중': 'ok',
  정지: 'neutral',
  오류: 'bad',
  '동기화 대기': 'warn',
};

const KIND_ICON: Record<DevenvKind, string> = {
  coder: '🖥️',
  jenkins: '⚙️',
  argocd: '🚀',
};

export default function DevenvListPage() {
  const byScope = (scope: 'user' | 'project') =>
    MOCK_DEVENV_TASKS.filter((t) => t.scope === scope);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">개발환경</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            운영 클러스터와 분리된 별도 개발 클러스터에서 동작한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal flex-shrink-0 mt-1">
          ONM-008
        </span>
      </div>

      <div className="border border-info-border bg-info-bg rounded px-3.5 py-2.5 mb-3.5">
        <div className="text-[11.5px] font-extrabold text-info mb-0.5">
          개발 클러스터 · ns-*-dev
        </div>
        <p className="text-[11px] text-ink-dark font-semibold leading-snug">
          여기서 만든 에이전트는 <b>미승인(Draft)</b> 상태다 — 계열사 개발·테스트 DB 로만
          통신하며, 100% 익명화된 데이터만 접근한다. 운영 DB 연결은 정식 승인 이후 런타임에서
          열린다(EDA-005 · SEC-007).
        </p>
      </div>

      {(['user', 'project'] as const).map((scope) => (
        <section key={scope} className="mb-3.5">
          <h2 className="text-[13px] font-extrabold text-ink mb-2">
            {scope === 'user' ? '개인 워크스페이스' : '프로젝트 공용 도구'}
          </h2>
          <div className="flex flex-col gap-1.5">
            {byScope(scope).map((t) => (
              <Link
                key={t.id}
                to={`/studio/devenv/${t.id}`}
                className="grid grid-cols-[28px_150px_1fr_auto_auto] gap-3 items-center px-4 py-3 bg-white border border-line-soft rounded hover:border-brand-dark transition-colors"
              >
                <span className="text-[15px] leading-none">{KIND_ICON[t.kind]}</span>
                <span className="text-[11px] font-extrabold text-ink-mid truncate">
                  {DEVENV_LABEL[t.kind]}
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-extrabold text-ink truncate">{t.name}</span>
                    <span className="text-[10px] font-mono font-bold text-ink-light flex-shrink-0">
                      {t.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-mid font-semibold mt-0.5 truncate">
                    {t.meta}
                  </div>
                </div>
                <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap tabular-nums">
                  {t.ownerName} · {t.lastActivity}
                </span>
                <StatusPill tone={STATE_TONE[t.state]} className={cn('whitespace-nowrap')}>
                  {t.state}
                </StatusPill>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
