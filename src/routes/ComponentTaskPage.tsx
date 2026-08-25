import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { cn } from '@/lib/utils';
import {
  findComponent,
  COMP_KIND_BADGE,
  type CustomComponent,
  type CompDeploy,
} from '@/data/mockComponents';

type CompTab = 'guide' | 'deploy';

export default function ComponentTaskPage() {
  const { projectId, componentId } = useParams();
  const pid = projectId ?? 'PRJ-2025-PB-001';
  const comp = findComponent(componentId);
  const [tab, setTab] = useState<CompTab>('guide');

  if (!comp) {
    return (
      <div className="max-w-[1120px] mx-auto px-6 py-16 text-center">
        <div className="text-[26px] mb-2">🔗</div>
        <div className="text-[13px] font-extrabold text-ink mb-1">컴포넌트를 찾을 수 없습니다</div>
        <Link to={`/projects/${pid}`} className="text-[11.5px] text-info font-bold hover:underline">
          ← 과제 목록
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] mx-auto px-6 py-6">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: comp.name },
        ]}
      />

      {/* Page head */}
      <div className="flex items-end justify-between gap-6 mb-3.5">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px] mb-1.5">{comp.name}</h1>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 py-[3px] px-2 border border-line-soft rounded-xl bg-white text-[11px] font-bold text-ink-mid">
              {comp.id}
            </span>
            <span className={cn('inline-flex items-center py-[3px] px-2 border rounded-xl text-[11px] font-extrabold', COMP_KIND_BADGE[comp.kind])}>
              {comp.kind}
            </span>
            <span className="inline-flex items-center gap-1.5 py-[3px] px-2 border border-line-soft rounded-xl bg-white text-[11px] font-bold text-ink-mid">
              {comp.lang} · {comp.version}
            </span>
          </div>
        </div>
        <Link to={`/projects/${pid}`} className="text-[11.5px] text-info font-bold py-1.5 px-2.5 hover:underline">
          ← 과제 목록
        </Link>
      </div>

      <div className="text-[12px] text-ink-mid font-semibold mb-3.5">
        {comp.desc} · 최종 수정 <b className="text-ink-dark">{comp.updatedAt}</b> · {comp.by}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-line mb-3.5">
        <TabBtn active={tab === 'guide'} onClick={() => setTab('guide')}>개발 가이드</TabBtn>
        <TabBtn active={tab === 'deploy'} onClick={() => setTab('deploy')}>배포</TabBtn>
      </div>

      {tab === 'guide' && <GuideView comp={comp} />}
      {tab === 'deploy' && <DeployView comp={comp} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative py-2.5 px-3.5 text-[13px] font-bold -mb-px border-b-2',
        active ? 'text-ink border-brand-dark' : 'text-ink-mid border-transparent hover:text-ink-dark',
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- 개발 가이드 (인터페이스 규격 + 에러 코드 규약) ---------------- */

const INTERFACE_SPEC: Record<CustomComponent['kind'], { signature: string; io: string }> = {
  '커스텀 파서': {
    signature: `# 진입점 (필수) — 포털 런타임이 이 함수를 호출합니다.
def parse(path: str, opts: dict) -> list[Document]:
    ...`,
    io: `# 반환 스키마
Document = {
    "page":   int,          # 필수 · 1-base 페이지 번호
    "text":   str,          # 필수 · 추출 본문
    "tables": list[str],    # 선택 · 표(markdown)
    "meta":   dict,         # 선택 · {title, source ...}
}`,
  },
  '커스텀 청커': {
    signature: `# 진입점 (필수)
def chunk(doc: Document, size: int = 800, overlap: int = 80) -> list[Chunk]:
    ...`,
    io: `# 반환 스키마
Chunk = {
    "text":  str,           # 필수 · 청크 본문
    "order": int,           # 필수 · 문서 내 순서(0-base)
    "meta":  dict,          # 선택 · {clause, page ...}
}`,
  },
  '커스텀 파이프라인': {
    signature: `# 선언형 정의 (component.yaml) + 진입점
def run(input_uri: str) -> RunResult:
    ...`,
    io: `# 반환 스키마
RunResult = {
    "docs":    int,         # 필수 · 파싱 문서 수
    "chunks":  int,         # 필수 · 생성 청크 수
    "indexed": int,         # 필수 · 색인 건수
}`,
  },
};

const RETURN_CONVENTION = `# 성공
return { "status": "ok", "data": <결과> }

# 실패 — 반드시 에러 코드와 함께
return { "status": "error", "error": { "code": "E1002", "message": "..." } }

# 또는 예외 (런타임이 error 응답으로 변환)
raise ComponentError("E1002", "PDF 표 추출 실패: page 12")`;

interface ErrRow {
  code: string;
  name: string;
  when: string;
  retry: '가능' | '불가';
}
const ERROR_CODES: ErrRow[] = [
  { code: 'E1001', name: 'UNSUPPORTED_FORMAT', when: '지원하지 않는 입력 형식', retry: '불가' },
  { code: 'E1002', name: 'PARSE_FAILED', when: '문서 파싱 실패 (손상·암호화 등)', retry: '불가' },
  { code: 'E2001', name: 'EMPTY_CHUNKS', when: '청크 생성 결과 없음', retry: '불가' },
  { code: 'E2002', name: 'CHUNK_OVERSIZE', when: 'chunk size 상한 초과', retry: '불가' },
  { code: 'E3001', name: 'STEP_FAILED', when: '파이프라인 단계 실행 실패', retry: '가능' },
  { code: 'E4001', name: 'TIMEOUT', when: '실행 시간 초과', retry: '가능' },
  { code: 'E5001', name: 'PII_IN_OUTPUT', when: '출력·로그에 개인정보 감지 → 차단', retry: '불가' },
  { code: 'E9000', name: 'INTERNAL', when: '알 수 없는 오류', retry: '가능' },
];

function GuideView({ comp }: { comp: CustomComponent }) {
  const spec = INTERFACE_SPEC[comp.kind];
  return (
    <>
      {/* 인터페이스 규격 */}
      <section className="card shadow-sm mb-3.5">
        <div className="flex items-center gap-2 py-3 px-[18px] border-b border-line-soft text-sm font-extrabold text-ink">
          인터페이스 규격
          <span className="text-[11px] text-ink-mid font-semibold">{comp.kind} · {comp.lang} · io_schema v1</span>
        </div>
        <div className="px-[18px] py-[18px] flex flex-col gap-3">
          <div>
            <div className="text-[11px] font-extrabold text-ink-dark mb-1.5">시그니처</div>
            <pre className="text-[11.5px] font-mono text-ink-dark bg-surface-soft border border-line-soft rounded-lg p-3.5 overflow-x-auto whitespace-pre leading-[1.6]">{spec.signature}</pre>
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-ink-dark mb-1.5">입·출력 스키마</div>
            <pre className="text-[11.5px] font-mono text-ink-dark bg-surface-soft border border-line-soft rounded-lg p-3.5 overflow-x-auto whitespace-pre leading-[1.6]">{spec.io}</pre>
          </div>
        </div>
      </section>

      {/* 반환·에러 규약 */}
      <section className="card shadow-sm mb-3.5">
        <div className="py-3 px-[18px] border-b border-line-soft text-sm font-extrabold text-ink">반환 · 에러 규약</div>
        <div className="px-[18px] py-[18px]">
          <div className="text-[11px] font-extrabold text-ink-dark mb-1.5">반환 규약</div>
          <pre className="text-[11.5px] font-mono text-ink-dark bg-surface-soft border border-line-soft rounded-lg p-3.5 overflow-x-auto whitespace-pre leading-[1.6] mb-4">{RETURN_CONVENTION}</pre>

          <div className="text-[11px] font-extrabold text-ink-dark mb-1.5">에러 코드</div>
          <div className="border border-line-soft rounded-lg overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">코드</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">이름</th>
                  <th className="text-left py-2 px-3 font-bold">발생 상황</th>
                  <th className="text-center py-2 px-3 font-bold whitespace-nowrap">재시도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {ERROR_CODES.map((e) => (
                  <tr key={e.code} className="hover:bg-surface">
                    <td className="py-2 px-3 font-mono font-extrabold text-ink-dark whitespace-nowrap">{e.code}</td>
                    <td className="py-2 px-3 font-mono text-ink-mid whitespace-nowrap">{e.name}</td>
                    <td className="py-2 px-3 text-ink-dark">{e.when}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap',
                          e.retry === '가능' ? 'bg-info-bg text-info border-info-border' : 'bg-surface-soft text-ink-mid border-line',
                        )}
                      >
                        {e.retry}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10.5px] text-ink-light font-semibold mt-2">
            · 코드 체계: <code className="font-mono">E1xxx</code> 파서 · <code className="font-mono">E2xxx</code> 청커 · <code className="font-mono">E3xxx</code> 파이프라인 · <code className="font-mono">E4xxx</code> 런타임 · <code className="font-mono">E5xxx</code> 규제 · <code className="font-mono">E9xxx</code> 기타
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- 배포 (지식 데이터 배포 탭과 동일: 환경별 상세 + 버전 파이프라인 표) ---------------- */

function DeployView({ comp }: { comp: CustomComponent }) {
  const [env, setEnv] = useState<'train' | 'serv'>('train');
  const trainDeploys = comp.deploys.filter((d) => d.env === '학습계');
  const servDeploys = comp.deploys.filter((d) => d.env === '서빙계');
  const versions = [...new Set(comp.deploys.map((d) => d.version))];
  const envDetail = env === 'train' ? trainDeploys[0] : servDeploys.find((d) => d.status === '운영 중') ?? servDeploys[0];

  return (
    <div className="card shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="text-sm font-extrabold text-ink">배포</div>
      </div>

      <div className="px-[18px] py-[18px]">
        {/* 환경별 상세 (상단) */}
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
        <div className="border border-line-soft rounded-lg px-3.5 py-1 mb-4">
          {envDetail ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-0">
              <Kv k="배포 버전" v={<span className="font-mono font-bold">{envDetail.version}</span>} />
              <Kv
                k="상태"
                v={
                  envDetail.status === '운영 중' ? (
                    <span className="inline-flex items-center gap-1 py-[1px] px-1.5 rounded-full border border-ok-border bg-ok-bg text-ok text-[10px] font-extrabold">● 운영 중</span>
                  ) : envDetail.status === '배포 중' ? (
                    <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-info-border bg-info-bg text-info text-[10px] font-extrabold">배포 중</span>
                  ) : (
                    <span className="text-ink-mid">{envDetail.status}</span>
                  )
                }
              />
              <Kv k="커밋" v={<code className="text-[11px] font-mono text-ink-dark">{envDetail.commit}</code>} />
              <Kv k="배포일" v={`${envDetail.at} · ${envDetail.by}`} />
              <Kv k="GitLab" v={<code className="text-[11px] font-mono text-ink-dark break-all">{comp.repo}/{comp.path}</code>} span />
            </div>
          ) : (
            <div className="text-[11.5px] text-ink-mid px-1 py-3">해당 환경에 배포된 버전이 없습니다.</div>
          )}
        </div>

        {/* 배포 버전 파이프라인 표 */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">배포 버전 파이프라인</span>
          <span className="text-[10px] text-ink-light font-semibold">· 버전별 커밋·환경 상태·서빙계 승격</span>
        </div>
        <div className="border border-line-soft rounded-lg overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">버전</th>
                <th className="text-left py-2 px-3 font-bold">커밋 · 구성</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">배포일</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">배포자</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">학습계</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">서빙계</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {versions.map((v, i) => {
                const t = trainDeploys.find((d) => d.version === v);
                const s = servDeploys.find((d) => d.version === v);
                const base = t ?? s!;
                const servLive = s?.status === '운영 중';
                const servDeploying = s?.status === '배포 중';
                return (
                  <tr key={v} className="hover:bg-surface">
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center text-[10.5px] font-extrabold py-[1px] px-2 rounded-full border bg-brand-tint text-ink border-brand-dark">
                        {v}
                      </span>
                      {i === 0 && (
                        <span className="ml-1.5 inline-flex items-center py-[1px] px-1.5 rounded-full border border-info-border bg-info-bg text-info text-[9px] font-extrabold">
                          현재
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <code className="font-mono font-bold text-ink-dark">{base.commit}</code>
                        <span className="text-ink-light">·</span>
                        <span className="text-ink-mid font-semibold font-mono">{comp.path}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{base.at}</td>
                    <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{base.by}</td>
                    <td className="py-2 px-3 text-center">
                      {t ? (
                        i === 0 ? (
                          <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-info-border bg-info-bg text-info text-[10px] font-extrabold whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-info" /> 배포 중
                          </span>
                        ) : (
                          <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-line bg-surface-soft text-ink-mid text-[10px] font-extrabold whitespace-nowrap">이전</span>
                        )
                      ) : (
                        <span className="text-ink-light text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {servLive ? (
                        <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-ok-border bg-ok-bg text-ok text-[10px] font-extrabold whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-ok" /> 운영 중
                        </span>
                      ) : servDeploying ? (
                        <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold whitespace-nowrap">승인 대기</span>
                      ) : (
                        <span className="text-ink-light text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {servLive ? (
                        <span className="text-[10.5px] text-ink-light font-semibold">운영 중</span>
                      ) : servDeploying ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Link
                            to="/approvals"
                            className="h-6 px-2 border border-brand-dark bg-brand-tint rounded text-[10.5px] font-extrabold text-white hover:bg-brand inline-flex items-center"
                          >
                            결재함 →
                          </Link>
                        </span>
                      ) : (
                        <button
                          className="h-6 px-2.5 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-white hover:bg-brand-dark"
                          title="이 버전을 서빙계로 승격"
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

/* ---------------- helpers ---------------- */

function Kv({ k, v, span }: { k: string; v: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 py-2.5 border-b border-line-soft last:border-0 text-[12px]', span && 'col-span-2')}>
      <span className="text-ink-mid font-semibold w-[92px] flex-shrink-0">{k}</span>
      <span className="text-ink-dark font-bold min-w-0">{v}</span>
    </div>
  );
}

