import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import {
  addDeployApproval,
  cancelDeployApproval,
  useDeployApprovals,
  type DeployApproval,
} from '@/lib/deployApprovalStore';
import { SearchSummary } from './RagApiSection';

const PROD_ENDPOINT = 'https://search.aip.group.local/indexes/pb-consult/docs/search';
const PROD_KEY = 'aip-rag-sk-9d2e77c4b1a0prod';

const mask = (key: string) => `${key.slice(0, 10)}${'•'.repeat(8)}${key.slice(-4)}`;
const nowLabel = () =>
  new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const STATE_PILL: Record<string, { className: string; label: string }> = {
  done: { className: 'bg-ok-bg text-ok border-ok-border', label: '배포 완료' },
  pending: { className: 'bg-warn-bg text-warn border-warn-border', label: '승인 대기' },
  rejected: { className: 'bg-bad-bg text-bad border-bad-border', label: '반려' },
};

/** 운영계 탭 — 개발계에서 검증된 빌드를 운영에 배포. 운영계 배포 신청은 결재함으로 연동. */
export default function ServingApiSection() {
  const persona = useCurrentPersona();
  const all = useDeployApprovals();
  const servDeploys = all.filter((d) => d.category === 'serv');
  const trainLatest = all.find((d) => d.category === 'train' && d.state === 'done');
  const servLive = servDeploys.find((d) => d.state === 'done');
  const servPending = servDeploys.some((d) => d.state === 'pending');

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [showDeploys, setShowDeploys] = useState(false);

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  };

  // 운영계 배포 신청 — 현재 개발계 빌드를 운영으로 승격 + 결재함에 운영계 배포 결재 생성.
  const requestDeploy = () => {
    if (!trainLatest || servPending) return;
    const item: DeployApproval = {
      id: `APV-SRV-${Date.now() % 100000}`,
      category: 'serv',
      title: '지식 검색 API 운영계 배포',
      projectName: 'PB 에이전트 프로젝트',
      draftedBy: persona?.name ?? '정오너',
      draftedAt: nowLabel(),
      stage: { current: 1, total: 3, label: '플랫폼 관리 그룹 결재' },
      state: 'pending',
      apiName: '지식 검색 API',
      apiId: 'api-pb-7m2k',
      endpoint: PROD_ENDPOINT,
      datasetName: '상품·시장 안내 매뉴얼',
      version: `s${servDeploys.length + 1}`,
      sources: trainLatest.sources,
      search: trainLatest.search,
    };
    addDeployApproval(item);
    setShowDeploys(true);
  };

  return (
    <section className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">운영계</div>
      </div>

      <div className="px-[18px] py-[18px]">
        <div className="border border-line-soft rounded-lg overflow-hidden bg-white">
          {/* 헤더 */}
          <div className="flex items-center gap-2.5 py-2.5 px-3.5 border-b border-line-soft">
            <span className="text-[13.5px] font-extrabold text-ink truncate">지식 검색 API</span>
            <span
              title="이 인스턴스는 운영계 환경입니다. 개발계 빌드를 운영계 배포 신청 → 결재 승인 후 운영에 반영됩니다."
              className="inline-flex items-center py-[2px] px-2 rounded-full border border-ok-border bg-ok-bg text-ok text-[10px] font-extrabold"
            >
              운영계
            </span>
            <span className="text-[10.5px] text-ink-mid font-mono">api-pb-7m2k</span>
            <span className="flex-1" />
            <button
              onClick={() => setActive((a) => !a)}
              title={active ? '일시중지' : '활성화'}
              className={cn(
                'inline-flex items-center gap-1.5 text-[10.5px] font-extrabold py-[3px] px-2.5 rounded-full border',
                active ? 'bg-ok-bg text-ok border-ok-border hover:bg-white' : 'bg-surface-soft text-ink-mid border-line hover:bg-white',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-ok' : 'bg-ink-light')} />
              {active ? '운영 중' : '일시중지'}
            </button>
            <button
              onClick={requestDeploy}
              disabled={servPending || !trainLatest}
              title={
                servPending
                  ? '이미 승인 대기 중인 운영계 배포 신청이 있습니다'
                  : !trainLatest
                  ? '먼저 개발계에 배포된 빌드가 필요합니다'
                  : '현재 개발계 빌드를 운영계로 배포 신청'
              }
              className="h-7 px-3 bg-brand border border-brand-dark rounded text-[11px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {servPending ? '승인 대기 중' : '▶ 운영계 배포 신청'}
            </button>
          </div>

          {/* Endpoint + Key */}
          <div className="px-3.5 py-2.5 flex flex-col gap-1.5 bg-surface-soft border-b border-line-soft">
            <FieldRow label="Endpoint" value={PROD_ENDPOINT} copied={copied === 'ep'} onCopy={() => copy('ep', PROD_ENDPOINT)} />
            <FieldRow
              label="API Key"
              value={revealed ? PROD_KEY : mask(PROD_KEY)}
              copied={copied === 'key'}
              onCopy={() => copy('key', PROD_KEY)}
              onReveal={() => setRevealed((r) => !r)}
              revealed={revealed}
            />
          </div>

        </div>
      </div>
    </section>
  );
}

/* ---------------- Field row ---------------- */

function FieldRow({
  label,
  value,
  copied,
  onCopy,
  onReveal,
  revealed,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  onReveal?: () => void;
  revealed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className="text-ink-mid font-bold w-[68px] flex-shrink-0 uppercase tracking-[0.3px] text-[10px]">{label}</span>
      <span className="font-mono text-ink-dark truncate flex-1">{value}</span>
      {onReveal && (
        <button
          onClick={onReveal}
          title={revealed ? '숨기기' : '표시'}
          className="w-6 h-6 inline-flex items-center justify-center rounded border border-line bg-white text-ink-mid hover:bg-surface flex-shrink-0"
        >
          {revealed ? '🙈' : '👁'}
        </button>
      )}
      <button
        onClick={onCopy}
        className={cn(
          'h-6 px-2 rounded border text-[10.5px] font-bold flex-shrink-0',
          copied ? 'border-ok-border bg-ok-bg text-ok' : 'border-line bg-white text-ink-dark hover:bg-surface',
        )}
      >
        {copied ? '✓ 복사됨' : '복사'}
      </button>
    </div>
  );
}
