import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { approvals } from '@/data/mockApprovals';
import {
  useDeployApprovals,
  decideDeployApproval,
  cancelDeployApproval,
  type DeployApproval,
} from '@/lib/deployApprovalStore';
import { SearchSummary } from '@/components/knowledgeData/RagApiSection';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/projectForm/SectionCard';
import { KvGrid, KvRow } from '@/components/projectForm/KvGrid';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import SidebarCard from '@/components/projectForm/SidebarCard';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { canViewApproval, canViewPtuPool } from '@/lib/personaView';

/**
 * 결재 상세 — 좌측: 영역 A~J 아코디언 / 우측: 결재선 진행·이력·첨부 / 하단: 의견 + 액션 sticky bar
 * (PRJ-101_approval.html 포팅)
 */
export default function ApprovalDetailPage() {
  const { approvalId } = useParams();
  const persona = useCurrentPersona();

  // 서빙계 배포 결재는 전용 상세로 렌더.
  const deployApprovals = useDeployApprovals();
  const dep = deployApprovals.find((d) => d.id === approvalId);
  if (dep) {
    if (persona && !canViewApproval(persona, dep.id)) {
      return (
        <div className="max-w-[1440px] mx-auto px-6 py-6">
          <Crumb items={[{ label: '결재함', to: '/approvals' }, { label: '열람 권한 없음' }]} />
          <div className="card px-6 py-10 text-center">
            <div className="text-[32px] mb-2">🔒</div>
            <h1 className="text-lg font-extrabold text-ink mb-1.5">열람 권한이 없는 결재입니다</h1>
            <Link to="/approvals" className="inline-block mt-4 text-[12px] font-bold text-info hover:underline">
              결재함으로 →
            </Link>
          </div>
        </div>
      );
    }
    return <DeployApprovalDetail dep={dep} all={deployApprovals} />;
  }

  const approval = approvals.find((a) => a.id === approvalId) ?? approvals[0];
  const showPtuPool = canViewPtuPool(persona);

  // 목록에서 걸러진 결재는 상세 URL로 직접 들어와도 열람 불가.
  if (persona && !canViewApproval(persona, approval.id)) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        <Crumb items={[{ label: '결재함', to: '/approvals' }, { label: '열람 권한 없음' }]} />
        <div className="card px-6 py-10 text-center">
          <div className="text-[32px] mb-2">🔒</div>
          <h1 className="text-lg font-extrabold text-ink mb-1.5">열람 권한이 없는 결재입니다</h1>
          <p className="text-xs text-ink-mid font-semibold">
            {persona.role} 권한으로는 이 결재 건을 볼 수 없습니다. 결재함에서 담당 결재를
            확인해 주세요.
          </p>
          <Link
            to="/approvals"
            className="inline-block mt-4 text-[12px] font-bold text-info hover:underline"
          >
            결재함으로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '결재함', to: '/approvals' },
          { label: '진행 중 결재', to: '/approvals' },
          { label: approval.title },
        ]}
        trailing={approval.id}
      />

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        <main>
          {/* Approval header */}
          <div className="card px-6 py-5 mb-3.5">
            <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px] mb-2">
              {approval.title}
            </h1>
            <div className="flex items-center gap-2.5 text-[11.5px] text-ink-mid font-semibold flex-wrap">
              <span>
                과제 코드 <b className="text-ink-dark">prj-vp-7k3m9d</b>
              </span>
              <span className="text-line">|</span>
              <span>
                기안자 <b className="text-ink-dark">{approval.draftedBy}</b> (프로젝트 오너 그룹)
              </span>
              <span className="text-line">|</span>
              <span>
                도착 <b className="text-ink-dark">{approval.draftedAt}</b>
              </span>
            </div>
          </div>

          {/* Sections A~J (아코디언) */}
          <SectionCard
            letter="A"
            name="프로젝트 기본 정보"
            defaultOpen
          >
            <KvGrid>
              <KvRow k="프로젝트명" v="리스크 관리 에이전트_AI디지털전략부" tone="strong" />
              <KvRow k="프로젝트 코드" v="prj-vp-7k3m9d" />
              <KvRow k="소속 부서·팀" v="AI디지털전략부" />
              <KvRow
                k="프로젝트 오너 그룹"
                v={
                  <>
                    <ChipReadonly primary role="책임자">
                      정오너
                    </ChipReadonly>
                    <ChipReadonly>이도현</ChipReadonly>
                    <ChipReadonly>박서연</ChipReadonly>
                  </>
                }
              />
              <KvRow k="시작 ~ 종료" v="2026.06.01 ~ 2026.12.31" />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="B"
            name="서비스 구분 / 노출 채널"
          >
            <KvGrid>
              <KvRow k="서비스 대상" v="대직원" tone="strong" />
              <KvRow k="노출 채널" v={<ChipReadonly primary>통합웹앱</ChipReadonly>} />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="C"
            name="비즈니스 케이스"
          >
            <KvGrid>
              <KvRow
                k="비즈니스 목표"
                v="여신·시장·운영 리스크 지표를 실시간 모니터링하고, 리스크 담당자에게 이상 징후 알림과 대응 가이드를 제공하여 리스크 인지·대응 시점을 앞당긴다."
              />
              <KvRow
                k="현재 페인포인트"
                v="리스크 지표가 여러 시스템에 분산돼 담당자가 수작업으로 취합, 이상 징후 인지가 평균 반나절 지연됨."
              />
              <KvRow
                k="기대 효과"
                v="이상 징후 탐지 시점 단축 · 리스크 리포트 작성 시간 60% 절감 · 대응 프로세스 표준화"
              />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="D"
            name="기능 요건 초안"
          >
            <KvGrid>
              <KvRow
                k="주요 시나리오"
                v={
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li>리스크 지표 실시간 모니터링 → 임계치 초과 시 담당자 알림 + 대응 가이드 제시</li>
                    <li>규정·내규 문서 조회 → 리스크 이벤트에 대한 근거·조치 초안 자동 생성</li>
                  </ul>
                }
              />
              <KvRow k="입출력 modality" v="텍스트 · 문서·파일" />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="E"
            name="데이터 자산"
            defaultOpen
          >
            <KvGrid>
              <KvRow k="사용 데이터 종류" v="사내 문서 (RAG) · 정형 DB" />
              <KvRow k="개인정보 포함" v="포함" tone="red" />
              <KvRow k="신용정보 포함" v="포함" tone="red" />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="F"
            name="사용 가능 모델"
          >
            <KvGrid>
              <KvRow
                k="모델 사용 (호스트)"
                v={
                  <>
                    <ChipReadonly primary>on-prem · openai/gpt-oss-120b</ChipReadonly>
                    <ChipReadonly primary>Azure · azure/gpt-5.5</ChipReadonly>
                  </>
                }
              />
              <KvRow k="1콜 평균 토큰" v="입력 1,200 · 출력 450" />
              <KvRow k="피크 동시 호출 수" v="3 RPS" />
              <KvRow k="일평균 호출량" v="3,500 콜/일" />
              <KvRow
                k="예상 TPM"
                v="297,000 TPM (피크 3 RPS × 60초 × 콜당 1,650 토큰)"
                tone="strong"
              />
            </KvGrid>

            {/* PTU 풀 현황 — 플랫폼 관리자 전용 */}
            {showPtuPool && (
            <div className="mt-4 bg-surface-soft border border-line-soft rounded-md p-4">
              <div className="flex items-center gap-2 mb-3 text-[12.5px] font-extrabold text-ink-dark">
                🛠 공유 PTU 풀 현황
                <span className="ml-auto pill bg-accent-brown-bg text-accent-brown border border-accent-brown-border">
                  플랫폼 관리자 전용
                </span>
              </div>
              <PoolRow name="csp-pool-1" sub="azure/gpt-5.5 · 주력" cap="200 PTU" pct={78} add={12} tone="bad" />
              <PoolRow name="csp-pool-2" sub="aws/claude-sonnet-4.6 · Fallback" cap="50 PTU" pct={45} add={4} />
              <PoolRow name="onprem-pool-A" sub="openai/gpt-oss-120b · 주력" cap="8 GPU" pct={62} add={9} />
              <PoolRow name="onprem-pool-B" sub="google/gemma-4-31B · Fallback" cap="8 GPU" pct={30} add={3} />

              <div className="flex items-center gap-3 mt-3 text-[10.5px] text-ink-mid">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-info rounded-sm" />
                  현재 점유
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-brand rounded-sm" />
                  이 과제 추가 시
                </span>
                <span className="ml-auto">임계치 90% 도달 시 풀 증설 사전 합의 권장</span>
              </div>

              <div className="mt-3 bg-bad-bg border border-bad-border rounded p-2.5 text-[11.5px] text-bad font-bold">
                ⚠ csp-pool-1 (azure/gpt-5.5) — 이 과제 추가 시 점유율 90% 도달, 풀 증설 검토 필요
              </div>
            </div>
            )}
          </SectionCard>

          <SectionCard
            letter="G"
            name="예산·자원"
          >
            <KvGrid>
              <KvRow
                k="사전 협의 담당자"
                v={<ChipReadonly primary>김플랫</ChipReadonly>}
              />
              <KvRow
                k="예산 할당"
                v="총 1,000,000,000원"
              />
            </KvGrid>
          </SectionCard>

          <SectionCard letter="J" name="문서 첨부" defaultOpen>
            <div className="space-y-1.5">
              {[
                ['구축요건 정의서', 'build-spec-rm-2026.pdf'],
                ['AI 서비스 기획서', 'ai-service-plan-2026.pdf'],
                ['AI 서비스 위험 평가서', 'ai-risk-assessment-2026.pdf'],
                ['AI 서비스 위험관리 계획서', 'ai-risk-mgmt-plan-2026.pdf'],
                ['AI 서비스 위험점검 체크리스트', 'ai-risk-checklist-2026.pdf'],
                ['AI 업무 위수탁 체크리스트', 'ai-outsourcing-checklist-2026.pdf'],
                ['혁신금융서비스 지정 서류', 'innov-fin-2026q2.pdf'],
              ].map(([name, file]) => (
                <div
                  key={file}
                  className="flex items-center gap-2 py-2 px-3 bg-surface-soft border border-line-soft rounded"
                >
                  <span className="text-[12.5px] font-bold text-ink-dark flex-1">{name}</span>
                  <span className="pill bg-bad-bg text-bad border border-bad-border">필수</span>
                  <a href="#" className="text-info text-[12px] font-semibold hover:underline">
                    ✓ {file}
                  </a>
                </div>
              ))}
            </div>
          </SectionCard>
        </main>

        {/* Right sidebar */}
        <aside>
          <SidebarCard title="결재선 진행" icon="📋">
            <ApprovalStep num="✓" who="기안 — 정오너" time="09:14" state="done" />
            <ApprovalStep num="1" who="거버넌스 관리 그룹" time="대기" state="current" />
            <ApprovalStep num="2" who="사업 관리 그룹" time="-" state="pending" />
            <ApprovalStep num="3" who="플랫폼 관리 그룹" time="-" state="pending" />
            <ApprovalStep num="4" who="부서장" time="-" state="pending" />
          </SidebarCard>

          <SidebarCard title="결재 이력" icon="🕒">
            <div className="border-b border-line-soft pb-2.5 last:border-0">
              <div className="flex items-center gap-2 text-[11.5px] mb-1">
                <span className="font-bold text-ink-dark">정오너</span>
                <span className="pill bg-info-bg text-info border border-info-border">기안</span>
                <span className="ml-auto text-ink-mid">05-14 09:14</span>
              </div>
              <p className="text-[11.5px] text-ink-dark leading-relaxed">
                대직원 리스크 관리 Agent 신규 구축 건입니다. 우선 검토 부탁드립니다.
              </p>
            </div>
          </SidebarCard>

          <SidebarCard title="첨부 빠른 보기" icon="📎">
            {[
              '구축요건 정의서',
              'AI 서비스 기획서',
              'AI 서비스 위험 평가서',
              'AI 서비스 위험관리 계획서',
              'AI 서비스 위험점검 체크리스트',
              'AI 업무 위수탁 체크리스트',
              '혁신금융서비스 지정 서류',
            ].map((f) => (
              <a
                key={f}
                href="#"
                className="flex items-center justify-between py-1.5 px-2 text-[11.5px] text-ink-dark hover:bg-surface-soft rounded"
              >
                <span>{f}</span>
                <span className="text-ok font-bold">✓</span>
              </a>
            ))}
          </SidebarCard>
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-3">
          <textarea
            placeholder="결재 의견을 입력하세요 (선택)"
            rows={2}
            className="flex-1 border border-line rounded px-3 py-2 text-[12.5px] resize-none focus:outline-none focus:border-brand-dark"
          />
          <Button variant="danger">반려</Button>
          <Button>보류</Button>
          <Button variant="primary">✓ 승인</Button>
        </div>
      </div>
    </div>
  );
}

function ApprovalStep({
  num,
  who,
  time,
  state,
}: {
  num: string;
  who: string;
  time: string;
  state: 'done' | 'current' | 'pending';
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[11.5px]">
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          state === 'done' && 'bg-ok text-white',
          state === 'current' && 'bg-brand text-ink border border-brand-dark',
          state === 'pending' && 'bg-surface-soft text-ink-light border border-line-soft',
        )}
      >
        {num}
      </span>
      <span
        className={cn(
          'flex-1',
          state === 'current' && 'font-extrabold text-ink',
          state === 'done' && 'text-ink-dark',
          state === 'pending' && 'text-ink-light',
        )}
      >
        {who}
      </span>
      <span className="text-[10.5px] text-ink-mid">{time}</span>
    </div>
  );
}

function PoolRow({
  name,
  sub,
  cap,
  pct,
  add,
  tone = 'normal',
}: {
  name: string;
  sub: string;
  cap: string;
  pct: number;
  add: number;
  tone?: 'normal' | 'bad';
}) {
  const after = pct + add;
  return (
    <div className="grid grid-cols-[170px_70px_1fr_120px] gap-2.5 items-center py-2 border-b border-line-soft last:border-0">
      <div className="text-[12px]">
        <div className="font-extrabold text-ink-dark">{name}</div>
        <div className="text-[10.5px] text-ink-mid">{sub}</div>
      </div>
      <div className="text-[11px] text-ink-mid font-bold">{cap}</div>
      <div className="relative h-2 bg-white border border-line-soft rounded overflow-hidden">
        <div
          className={cn('absolute left-0 top-0 bottom-0', tone === 'bad' ? 'bg-bad' : 'bg-info')}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 bg-brand"
          style={{ left: `${pct}%`, width: `${add}%` }}
        />
      </div>
      <div
        className={cn(
          'text-[11px] font-extrabold text-right',
          tone === 'bad' ? 'text-bad' : 'text-ink-dark',
        )}
      >
        {pct}% <span className="text-ink-mid mx-0.5">→</span>
        <span className={after >= 90 ? 'text-bad' : 'text-ink'}>
          {after}%{after >= 90 && ' ⚠'}
        </span>
      </div>
    </div>
  );
}

/* ---------------- 서빙계 배포 결재 상세 ---------------- */

function DeployApprovalDetail({ dep, all }: { dep: DeployApproval; all: DeployApproval[] }) {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const pending = dep.state === 'pending';
  const isServ = dep.category === 'serv';
  const env = isServ ? '서빙계' : '학습계';
  // 비교용 현재 = 같은 환경(train/serv)의 최신 승인(done) 배포 (이 건 제외).
  const current = all.find((d) => d.category === dep.category && d.state === 'done' && d.id !== dep.id);

  const decide = (decision: 'approve' | 'reject') => {
    decideDeployApproval(dep.id, decision, note);
    navigate('/approvals');
  };
  const cancel = () => {
    if (window.confirm('배포 신청을 취소(회수)할까요?')) {
      cancelDeployApproval(dep.id);
      navigate('/approvals');
    }
  };

  const statePill =
    dep.state === 'done'
      ? { cls: 'bg-ok-bg text-ok border-ok-border', label: '배포 완료' }
      : dep.state === 'rejected'
      ? { cls: 'bg-bad-bg text-bad border-bad-border', label: '반려' }
      : { cls: 'bg-warn-bg text-warn border-warn-border', label: '승인 대기' };

  const step2Tone = dep.state === 'done' ? 'done' : dep.state === 'rejected' ? 'rejected' : 'current';

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '결재함', to: '/approvals' },
          { label: `${env} 배포 결재` },
          { label: dep.title },
        ]}
        trailing={dep.id}
      />

      {/* 헤더 */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-bold',
              isServ ? 'bg-ok-bg text-ok border-ok-border' : 'bg-info-bg text-info border-info-border',
            )}
          >
            {env} 배포
          </span>
          <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-extrabold', statePill.cls)}>
            {statePill.label}
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px] mb-1.5">{dep.title}</h1>
        <p className="text-xs text-ink-mid font-semibold">
          기안자 <b className="text-ink-dark">{dep.draftedBy}</b> · 신청 일시 <b className="text-ink-dark">{dep.draftedAt}</b> ·
          결재선 <b className="text-ink-dark">{dep.stage.label}</b>
        </p>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        {/* 좌측 — 신청 정보 */}
        <div>
          <FormSection title="신청 정보">
            <FormRow k="지식 데이터" v={dep.datasetName} />
            <FormRow k="과제" v={dep.projectName ?? '-'} />
            <FormRow k="RAG API" v={`${dep.apiName}  ·  ${dep.apiId}`} />
            <FormRow k="배포 버전" v={`${dep.version} → ${env}`} />
            {isServ && <FormRow k="승격 원본" v={`학습계 빌드 · ${dep.sources.map((s) => `${s.name} ${s.version}`).join(', ')}`} />}
            <FormRow k="Endpoint" v={<code className="text-[11px] font-mono text-ink-dark break-all">{dep.endpoint}</code>} />
          </FormSection>

          <FormSection title="배포 구성">
            <FormRow
              k="소스 인덱스"
              v={
                <span className="flex flex-wrap gap-1">
                  {dep.sources.map((sc) => (
                    <span
                      key={sc.name}
                      className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-line-soft bg-white text-ink-dark font-bold text-[10.5px]"
                    >
                      📦 {sc.name}
                      <span className="text-ink-mid font-semibold">· {sc.version} · {sc.model}</span>
                    </span>
                  ))}
                </span>
              }
            />
            <FormRow
              k="검색 설정"
              v={<span className="flex items-center gap-1.5 flex-wrap text-[11px]"><SearchSummary s={dep.search} /></span>}
            />
          </FormSection>

          <FormSection title={`현재 ${env} 대비`}>
            {current ? (
              <>
                <FormRow
                  k={`현재 ${current.version}`}
                  v={<span className="flex items-center gap-1.5 flex-wrap text-[11px] text-ink-mid"><SearchSummary s={current.search} /></span>}
                />
                <FormRow
                  k={`신청 ${dep.version}`}
                  v={<span className="flex items-center gap-1.5 flex-wrap text-[11px]"><SearchSummary s={dep.search} /></span>}
                />
              </>
            ) : (
              <div className="text-[11.5px] text-ink-mid px-3 py-2">현재 {env}에 배포된 버전이 없습니다 (최초 배포).</div>
            )}
          </FormSection>

          {!pending && dep.reviewer && (
            <FormSection title="결재 결과">
              <FormRow k="결과" v={dep.state === 'rejected' ? '반려' : '승인'} />
              <FormRow k="결재자" v={dep.reviewer} />
              {dep.decidedAt && <FormRow k="처리 일시" v={dep.decidedAt} />}
              {dep.reviewNote && <FormRow k="의견" v={dep.reviewNote} />}
            </FormSection>
          )}
        </div>

        {/* 우측 — 결재 진행 사이드바 */}
        <aside className="sticky top-[106px] self-start">
          <SidebarCard title="결재 진행">
            <div className="space-y-1.5">
              <ApprStep seq="✓" label="기안" sub={`${dep.draftedBy} · ${dep.draftedAt}`} tone="done" />
              {isServ && (
                <ApprStep
                  seq="2"
                  label="프로젝트 오너 그룹 결재"
                  sub={dep.state === 'done' ? '승인 완료' : dep.state === 'rejected' ? '반려' : '결재 대기'}
                  tone={step2Tone}
                />
              )}
              <ApprStep
                seq={isServ ? '3' : '2'}
                label={dep.stage.label}
                sub={dep.reviewer ? `${dep.reviewer}${dep.decidedAt ? ` · ${dep.decidedAt}` : ''}` : isServ ? '대기' : '결재 대기'}
                tone={dep.state === 'done' ? 'done' : dep.state === 'rejected' ? 'rejected' : isServ ? 'upcoming' : 'current'}
              />
            </div>
          </SidebarCard>

          {pending && (
            <SidebarCard title="결재 의견">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="승인·반려 사유 (선택)"
                className="w-full text-[12px] text-ink-dark leading-[1.6] border border-line rounded p-2 bg-white resize-y focus:outline-none focus:border-brand-dark"
              />
            </SidebarCard>
          )}
        </aside>
      </div>

      {/* 하단 고정 액션 바 */}
      {pending && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-3">
            <div className="text-[11.5px] text-ink-mid font-semibold">
              <span className="text-warn font-extrabold">승인 대기</span>
              <span className="mx-2 text-line">·</span>
              {env} 배포 결재 · {dep.stage.label}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={cancel}>신청 회수</Button>
              <button
                onClick={() => decide('reject')}
                className="py-2 px-3.5 bg-white border border-bad-border rounded text-[12.5px] font-extrabold text-bad hover:bg-bad-bg"
              >
                반려
              </button>
              <Button variant="primary" onClick={() => decide('approve')}>
                ✓ 승인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprStep({
  seq,
  label,
  sub,
  tone,
}: {
  seq: string;
  label: string;
  sub: string;
  tone: 'done' | 'current' | 'rejected' | 'upcoming';
}) {
  const current = tone === 'current';
  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1.5 px-2 rounded border',
        tone === 'done' && 'bg-ok-bg/40 border-ok-border',
        tone === 'rejected' && 'bg-bad-bg border-bad-border',
        tone === 'upcoming' && 'bg-white border-line-soft',
        current && 'bg-brand-tint border-brand-dark',
      )}
    >
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          tone === 'done' && 'bg-ok text-white border border-ok',
          tone === 'rejected' && 'bg-bad text-white border border-bad',
          tone === 'upcoming' && 'bg-white text-ink-light border border-line',
          current && 'bg-brand-dark text-white border border-brand-dark',
        )}
      >
        {tone === 'rejected' ? '✕' : seq}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[11.5px]', current ? 'font-extrabold text-ink' : 'font-bold text-ink-dark')}>{label}</span>
        <span className="block text-[10.5px] text-ink-mid font-semibold truncate">{sub}</span>
      </span>
    </div>
  );
}

function DeployStepper({ dep }: { dep: DeployApproval }) {
  const isDone = dep.state === 'done';
  const isRejected = dep.state === 'rejected';
  const steps = [
    { label: '기안', sub: `${dep.draftedBy} · ${dep.draftedAt}`, status: 'done' as const },
    {
      label: dep.stage.label,
      sub: dep.reviewer ? `${dep.reviewer}${dep.decidedAt ? ` · ${dep.decidedAt}` : ''}` : '결재 대기',
      status: isDone ? ('done' as const) : isRejected ? ('rejected' as const) : ('current' as const),
    },
  ];

  const circle: Record<string, string> = {
    done: 'bg-ok text-white border-ok',
    current: 'bg-brand text-ink border-brand-dark',
    rejected: 'bg-bad text-white border-bad',
    upcoming: 'bg-white text-ink-light border-line',
  };
  const mark: Record<string, string> = { done: '✓', rejected: '✕', current: '', upcoming: '' };

  return (
    <div className="card px-5 py-4 mb-3.5">
      <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold mb-3">결재 진행</div>
      <div className="flex items-start">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center text-center w-[92px] flex-shrink-0">
              <span
                className={cn(
                  'w-7 h-7 rounded-full border-2 inline-flex items-center justify-center text-[12px] font-extrabold',
                  circle[s.status],
                )}
              >
                {mark[s.status] || i + 1}
              </span>
              <span className="text-[11.5px] font-extrabold text-ink mt-1.5 leading-tight">{s.label}</span>
              <span className="text-[10px] text-ink-mid font-semibold mt-0.5 leading-tight break-keep">{s.sub}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-[2px] mt-[13px] mx-1 rounded-full',
                  steps[i].status === 'done' ? 'bg-ok' : 'bg-line',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden mb-3.5">
      <div className="py-2 px-4 bg-surface-soft border-b border-line-soft text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold">
        {title}
      </div>
      <div className="divide-y divide-line-soft">{children}</div>
    </div>
  );
}

function FormRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-4 text-[12.5px]">
      <span className="w-[110px] flex-shrink-0 text-ink-mid font-semibold text-[11.5px]">{k}</span>
      <span className="flex-1 min-w-0 text-ink-dark font-semibold">{v}</span>
    </div>
  );
}
