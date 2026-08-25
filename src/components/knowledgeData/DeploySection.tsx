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
import RagApiSection, { SearchSummary } from './RagApiSection';
import ServingApiSection from './ServingApiSection';
import type { IndexWithVersions } from './embedData';

interface Props {
  indexes: IndexWithVersions[];
}

const DEV_ENDPOINT = 'https://search-dev.aip.group.local/indexes/pb-consult/docs/search';
const PROD_ENDPOINT = 'https://search.aip.group.local/indexes/pb-consult/docs/search';

const verLabel = (v: string) => `#${v.replace(/\D/g, '')}`;
const nowLabel = () =>
  new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** 배포 탭 — 버전 파이프라인 표 중심. 학습계 배포 버전별 환경 상태·서빙계 승격을 한 표에서 관리. */
export default function DeploySection({ indexes }: Props) {
  const persona = useCurrentPersona();
  const all = useDeployApprovals();
  const trainDeploys = all.filter((d) => d.category === 'train' && d.state === 'done'); // 최신순
  const servDeploys = all.filter((d) => d.category === 'serv');
  const servLive = servDeploys.find((d) => d.state === 'done');
  const servPending = servDeploys.find((d) => d.state === 'pending');
  const liveVer = servLive?.sources[0]?.version;
  const pendingVer = servPending?.sources[0]?.version;

  const [env, setEnv] = useState<'train' | 'serv'>('train');

  const promote = (d: DeployApproval) => {
    if (servPending) return;
    const item: DeployApproval = {
      id: `APV-SRV-${Date.now() % 100000}`,
      category: 'serv',
      title: '지식 검색 API 서빙계 배포',
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
      sources: d.sources,
      search: d.search,
    };
    addDeployApproval(item);
  };

  return (
    <div className="card shadow-sm mb-3.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="text-sm font-extrabold text-ink">배포</div>
      </div>

      <div className="px-[18px] py-[18px]">
        {/* 환경별 상세 (상단) — 학습계/서빙계 운영 API·엔드포인트·배포 신청·승격 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">환경별 상세</span>
          <div className="inline-flex rounded-lg border border-line overflow-hidden">
            {([
              { k: 'train', label: '학습계', sub: 'dev' },
              { k: 'serv', label: '서빙계', sub: 'prod' },
            ] as const).map((e) => (
              <button
                key={e.k}
                onClick={() => setEnv(e.k)}
                className={cn(
                  'h-7 px-3 text-[11.5px] font-extrabold inline-flex items-center gap-1',
                  env === e.k
                    ? e.k === 'train'
                      ? 'bg-info-bg text-info'
                      : 'bg-ok-bg text-ok'
                    : 'bg-white text-ink-mid hover:bg-surface',
                )}
              >
                {e.label}
                <span className="text-[9px] font-bold opacity-70">{e.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">{env === 'train' ? <RagApiSection indexes={indexes} /> : <ServingApiSection />}</div>

        {/* 배포 버전 파이프라인 표 */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">배포 버전 파이프라인</span>
          <span className="text-[10px] text-ink-light font-semibold">· 학습계 배포 버전별 구성·환경 상태·서빙계 승격</span>
        </div>
        <div className="border border-line-soft rounded-lg overflow-x-auto mb-4">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">버전</th>
                <th className="text-left py-2 px-3 font-bold">인덱스 · 검색 구성</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">배포일</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">배포자</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">학습계</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">서빙계</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {trainDeploys.map((d, i) => {
                const ver = d.sources[0]?.version;
                const isLive = liveVer && ver === liveVer;
                const isPending = pendingVer && ver === pendingVer;
                return (
                  <tr key={d.id} className="hover:bg-surface">
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-ink-mid font-semibold">학습계</span>
                        <span className="inline-flex items-center justify-center text-[10.5px] font-extrabold py-[1px] px-2 rounded-full border bg-brand-tint text-ink border-brand-dark">
                          {verLabel(d.version)}
                        </span>
                        {i === 0 && (
                          <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-info-border bg-info-bg text-info text-[9px] font-extrabold">
                            현재
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        {d.sources.map((s) => (
                          <span key={s.name} className="font-bold text-ink-dark">
                            {s.name} · {s.version}
                          </span>
                        ))}
                        <span className="text-ink-light">·</span>
                        <span className="text-ink-mid font-semibold">
                          <SearchSummary s={d.search} />
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{d.draftedAt}</td>
                    <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{d.draftedBy}</td>
                    <td className="py-2 px-3 text-center">
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-info-border bg-info-bg text-info text-[10px] font-extrabold whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-info" /> 배포 중
                        </span>
                      ) : (
                        <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-line bg-surface-soft text-ink-mid text-[10px] font-extrabold whitespace-nowrap">
                          이전
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-ok-border bg-ok-bg text-ok text-[10px] font-extrabold whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-ok" /> 운영 중
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold whitespace-nowrap">
                          승인 대기
                        </span>
                      ) : (
                        <span className="text-ink-light text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {isLive ? (
                        <span className="text-[10.5px] text-ink-light font-semibold">운영 중</span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Link
                            to={`/approvals/${servPending!.id}`}
                            className="h-6 px-2 border border-brand-dark bg-brand-tint rounded text-[10.5px] font-extrabold hover:bg-brand inline-flex items-center text-brand hover:text-white"
                          >
                            결재함 →
                          </Link>
                          <button
                            onClick={() => {
                              if (window.confirm('서빙계 배포 신청을 취소할까요?')) cancelDeployApproval(servPending!.id);
                            }}
                            className="h-6 px-2 border border-line bg-white rounded text-[10.5px] font-bold text-ink-mid hover:text-bad hover:bg-bad-bg hover:border-bad-border"
                          >
                            취소
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => promote(d)}
                          disabled={!!servPending}
                          title={servPending ? '이미 승인 대기 중인 서빙계 배포가 있습니다' : '이 버전을 서빙계로 승격'}
                          className="h-6 px-2.5 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ▶ 서빙계로 승격
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

/** 서빙계에 올라간 빌드가 어느 학습계 버전인지 매칭. */
function trainVerOf(serv: DeployApproval, trainDeploys: DeployApproval[]): string {
  const v = serv.sources[0]?.version;
  const match = trainDeploys.find((t) => t.sources[0]?.version === v);
  return match?.version ?? 's1';
}
