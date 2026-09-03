import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { toast } from '@/lib/toast';
import { useWorkCrumb, useWorkContainer } from '@/lib/crumbs';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/projectForm/SectionCard';
import SidebarCard from '@/components/projectForm/SidebarCard';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import FormField, { Input, Textarea, Select, Row } from '@/components/projectForm/FormField';
import { cn } from '@/lib/utils';
import { MOCK_KNOWLEDGE_TASKS } from '@/data/mockKnowledgeTasks';
import { addAgentTask, BUILDER_LABEL, type AgentBuilder } from '@/data/mockAgentTasks';
import { getTemplate } from '@/data/mockTemplates';
import { useCurrentPersona } from '@/lib/persona';
import DeploySubmitModal from '@/components/studio/DeploySubmitModal';
import {
  AGENT_USE_SCOPES,
  submitAgentDeploy,
  previewDeployApprovers,
  findAgentDeploy,
  type AgentUseScope,
  type AgentDeployApproval,
} from '@/data/mockApprovals';

/**
 * 에이전트 과제 등록 — 프로젝트 내 에이전트 1개를 정의 (시스템 프롬프트·모델·도구·연결 지식).
 * 프로젝트 등록 폼과 동일한 디자인 토큰을 사용한다.
 */
/** 셸 밖(프로젝트 경로)에서 단독으로 열릴 때의 컨테이너. */
const WORK_STANDALONE_CLS = 'max-w-[1360px] mx-auto px-6 py-6 pb-[120px]';
/** AI Studio · 지식 데이터 셸 안에서 열릴 때의 컨테이너. */
const WORK_SHELL_CLS = 'w-full pb-[120px]';

export default function AgentTaskRegisterPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const crumbItems = useWorkCrumb('에이전트 빌더', pid);
  const containerCls = useWorkContainer(WORK_STANDALONE_CLS, WORK_SHELL_CLS);

  /*
   * 템플릿 복제 진입 — AI Studio 「템플릿에서 시작」의 `?tpl=TPL-01`.
   * 템플릿을 골랐는데 기본값 폼이 뜨면 '복제' 가 말뿐이 된다. 아래 초기값들이
   * 템플릿 프리셋에서 온다(없으면 기존 기본값 그대로).
   */
  const [params] = useSearchParams();
  const tplId = params.get('tpl');
  const tpl = useMemo(() => getTemplate(tplId), [tplId]);
  const pre = tpl?.preset?.kind === '에이전트' ? tpl.preset.agent : null;

  const [name, setName] = useState(pre?.name ?? '보이스피싱 1차 분류 에이전트');
  const [stage, setStage] = useState<'학습계' | '서빙계'>(pre?.stage ?? '학습계');
  const [builder, setBuilder] = useState<AgentBuilder>(pre?.builder ?? 'pro-code');
  const [systemPrompt, setSystemPrompt] = useState(
    pre?.systemPrompt ??
      '당신은 보이스피싱 통화를 1차 분류하는 어시스턴트입니다. 통화 내용에서 의심 단서(긴급성·송금 요청·기관 사칭)를 식별하여 risk_score(0~100)와 근거를 JSON으로 반환합니다.',
  );
  const [mainModel, setMainModel] = useState(pre?.mainModel ?? 'onprem/gpt-oss-120b');
  const [fallbackModel, setFallbackModel] = useState(
    pre?.fallbackModel ?? 'google/gemma-4-31B-it-assistant',
  );
  const [tools, setTools] = useState<Set<string>>(
    () => new Set(pre?.tools ?? ['rag_search', 'function_call']),
  );
  const [linkedKnw, setLinkedKnw] = useState<Set<string>>(
    () => new Set(pre?.linkedKnowledge ?? ['KNW-201']),
  );
  const [pii, setPii] = useState(pre?.pii ?? true);
  const [redteam, setRedteam] = useState(pre?.redteam ?? true);
  const [submitting, setSubmitting] = useState(false);
  /*
   * 사용 범위 — **개인·부서까지만** 여기서 정한다. 계열사 이상은 마켓플레이스의
   * 승격 결재로 넘어간다(RFP 1.3.2 「관리자 승인 절차 기반 공유 범위 통제」).
   * 등록 폼에서 계열사 공개까지 끝내 버리면 그 통제가 화면에서 우회된다.
   */
  const [useScope, setUseScope] = useState<AgentUseScope>('부서');
  /** 상신 완료 팝업 — 확인해야 이동한다. */
  const [submitted, setSubmitted] = useState<AgentDeployApproval | null>(null);

  // 기안자·소속은 로그인 페르소나에서 온다. 하드코딩하면 계정을 바꿔도 같은
  // 사람이 담당자로 찍혀 SoD 서사가 화면에서 무너진다.
  const persona = useCurrentPersona();
  const drafter = persona?.name ?? '강개발';
  const drafterRole = persona?.role ?? '에이전트 개발자';
  const drafterInitial = persona?.initial ?? '강';
  const ownerTenant = persona?.tenant ?? '부산은행';
  const approvers = useMemo(
    () => previewDeployApprovers(ownerTenant, drafter),
    [ownerTenant, drafter],
  );

  const toggleSet = (s: Set<string>, k: string, set: (n: Set<string>) => void) => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    set(next);
  };

  const requiredFilled = useMemo(
    () => Boolean(name.trim() && systemPrompt.trim() && mainModel),
    [name, systemPrompt, mainModel],
  );

  /**
   * 기안 — 과제를 만들고 **배포 결재를 상신한다**.
   *
   * 예전에는 과제만 만들고 끝났다. 그러면 화면이 "승인 기반 배포"(LSM-009)를
   * 말하면서 실제로는 아무 승인도 걸리지 않는 상태가 된다.
   */
  const submit = () => {
    if (!requiredFilled || submitting) return;
    setSubmitting(true);
    const task = addAgentTask({
      name,
      stage,
      builder,
      mainModel,
      fallbackModel: fallbackModel || undefined,
      linkedKnowledge: [...linkedKnw],
      tools: [...tools],
      systemPrompt,
      temperature: 0.2,
      maxOutputTokens: 1024,
      piiMasking: pii,
      redteam,
      ownerName: drafter,
      ownerInitial: drafterInitial,
      tenant: ownerTenant,
    });
    const item = submitAgentDeploy({
      agentId: task.id,
      agentName: name,
      deployStage: stage,
      useScope,
      ownerTenant,
      draftedBy: drafter,
      draftedByRole: drafterRole,
      mainModel,
      builderLabel: BUILDER_LABEL[builder],
      templateFrom: tpl ? { id: tpl.id, name: tpl.name } : undefined,
      linkedKnowledge: MOCK_KNOWLEDGE_TASKS.filter((k) => linkedKnw.has(k.id)).map((k) => ({
        id: k.id,
        name: k.name,
        owner: k.ownerName,
        updatedAt: k.updatedAt,
      })),
      checks: [
        { k: '에이전트명', v: name, pass: true },
        { k: '시스템 프롬프트', v: `${systemPrompt.length}자`, pass: systemPrompt.trim().length > 0 },
        { k: '주력 모델', v: mainModel, pass: true },
        { k: '연결 지식', v: `${linkedKnw.size}건`, pass: linkedKnw.size > 0 },
        { k: 'PII 마스킹', v: pii ? '활성화' : '비활성화', pass: pii },
        { k: '레드팀 게이트', v: redteam ? '통과 필수' : '생략', pass: redteam },
      ],
    });
    setSubmitting(false);
    setSubmitted(findAgentDeploy(item.id) ?? null);
  };

  /**
   * 팝업 확인 후 이동. AI Studio 셸에서 들어왔으면 과제 목록으로 돌아간다 —
   * 예전에는 존재하지 않는 `PRJ-101` 로 보내 「열람 권한 없음」 화면이 떴다.
   */
  const closeAndGo = () => {
    setSubmitted(null);
    navigate(projectId ? `/projects/${projectId}` : '/studio');
  };

  return (
    <div className={containerCls}>
      <Crumb items={crumbItems} />

      <div className="card px-6 py-5 mb-3.5 flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">에이전트 과제 등록</h1>
          <p className="text-xs text-ink-mid font-semibold mt-1">
            프로젝트 내 에이전트 1개를 정의합니다 · 시스템 프롬프트·모델·연결 지식·도구·가드레일
          </p>
          {/*
            복제 출처를 남긴다 — RFP 2-1 「조직 내 재사용 자산 관리」는
            '누가 저장한 무엇을 복제했는지' 가 보여야 관리라고 말할 수 있다.
          */}
          {pre && tpl && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="pill bg-ok-bg text-ok border border-ok-border">
                {tpl.id} 「{tpl.name}」에서 복제 · 저장 {tpl.savedBy} · {tpl.usedCount}회 사용
              </span>
              <span className="text-[11px] text-ink-mid font-semibold">
                검증된 값이 채워졌습니다 · <b className="text-warn">주황 테두리</b> 항목만 확인·조정하면
                됩니다
              </span>
            </div>
          )}
        </div>
        <span className="text-xs text-ink-mid font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-ok rounded-full" />
          자동 저장됨 · {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} KST
        </span>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        <div>
          {/* A. 기본 정보 */}
          <SectionCard letter="A" name="에이전트 기본 정보" summary="이름·담당·배포 단계" tag="MVP" defaultOpen>
            <Row>
              {/*
                2A-3 「사용자 조정 필요 항목만 하이라이트」 —
                템플릿에서 온 값은 그대로 써도 되지만, **이름과 사용 범위는 내 것으로
                바꿔야 한다.** 그 둘만 테두리로 짚어 준다. 전부 강조하면 아무것도
                강조하지 않은 것과 같다.
              */}
              <FormField
                label="에이전트명"
                required
                hint={pre ? '템플릿 이름 그대로면 내 과제와 구분되지 않는다' : '과제 단위로 식별되는 이름'}
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 보이스피싱 1차 분류 에이전트"
                  className={cn(pre && 'border-warn-border bg-warn-bg/40')}
                />
              </FormField>
              <FormField label="과제 코드" info="기안 시 자동 발번">
                <Input defaultValue="AGT-2026-NEW" disabled />
              </FormField>
            </Row>
            <Row>
              <FormField label="담당자" required info="기안자는 로그인 계정으로 확정됩니다">
                <div className="mb-2">
                  <ChipReadonly primary role="기안·책임자">
                    {drafter}
                  </ChipReadonly>
                  <ChipReadonly>{ownerTenant}</ChipReadonly>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid">🔍</span>
                  <Input placeholder="사번·이름으로 검색하여 추가" className="pl-8" />
                </div>
              </FormField>
              <FormField label="배포 단계" required>
                <div className="flex gap-3">
                  <RadioBox checked={stage === '학습계'} onChange={() => setStage('학습계')} label="학습계 (개발)" />
                  <RadioBox checked={stage === '서빙계'} onChange={() => setStage('서빙계')} label="서빙계 (운영)" />
                </div>
                {stage === '서빙계' && (
                  <div className="mt-2 bg-warn-bg border border-warn-border rounded p-2.5 text-[11.5px] text-warn">
                    <b>서빙계</b> 프로모션 시 별도 결재 트리거 · 레드팀 게이트 필수
                  </div>
                )}
              </FormField>
            </Row>
            <Row>
              <FormField label="빌더" required info="개발 방식 · 결재선·인프라 요건이 분기됩니다">
                <div className="flex gap-2">
                  {(['studio', 'pro-code', 'graph'] as AgentBuilder[]).map((b) => (
                    <RadioBox
                      key={b}
                      checked={builder === b}
                      onChange={() => setBuilder(b)}
                      label={BUILDER_LABEL[b]}
                    />
                  ))}
                </div>
              </FormField>
              <FormField label="사용 범위" required info="누가 이 에이전트를 쓸 수 있는가">
                <div className={cn('flex gap-3 rounded', pre && 'ring-1 ring-warn-border ring-offset-2')}>
                  {AGENT_USE_SCOPES.map((sc) => (
                    <RadioBox
                      key={sc}
                      checked={useScope === sc}
                      onChange={() => setUseScope(sc)}
                      label={sc === '개인' ? '개인 (본인만)' : `부서 (${ownerTenant})`}
                    />
                  ))}
                </div>
                {/*
                  계열사 이상은 여기서 못 고른다. 자기 부서를 넘어 남이 보는 자산이
                  되는 순간부터는 마켓플레이스의 승격 결재를 거쳐야 한다(RFP 1.3.2).
                */}
                <div className="mt-2 bg-surface-soft border border-line-soft rounded p-2.5 text-[11px] text-ink-mid font-semibold leading-relaxed">
                  <b className="text-ink-dark">계열사 · 그룹 공개는 여기서 정하지 않습니다.</b>{' '}
                  배포 후 마켓플레이스에서 <b className="text-ink-dark">공개 범위 승격</b>을 별도
                  상신해 소유 계열사 관리자·그룹 거버넌스 승인을 받습니다.
                </div>
              </FormField>
            </Row>
          </SectionCard>

          {/* B. 시스템 프롬프트 */}
          <SectionCard letter="B" name="시스템 프롬프트" summary="에이전트의 역할·출력 형식 정의" tag="MVP" defaultOpen>
            <FormField label="시스템 프롬프트" required info="역할·입출력 형식·금지 사항 명시">
              <Textarea
                rows={6}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="당신은 ... 어시스턴트입니다. 사용자의 입력에서 ... 를 식별하여 JSON으로 반환합니다."
              />
            </FormField>
          </SectionCard>

          {/* C. 모델 */}
          <SectionCard letter="C" name="사용 모델" summary="주력 + Fallback" tag="MVP" defaultOpen>
            <Row>
              <FormField label="주력 모델 (on-prem)" required>
                <Select value={mainModel} onChange={(e) => setMainModel(e.target.value)}>
                  <option value="onprem/gpt-oss-120b">onprem/gpt-oss-120b</option>
                  <option value="google/gemma-4-31B-it-assistant">google/gemma-4-31B-it-assistant</option>
                  <option value="kakao/kanana-flag-32.5B-it">kakao/kanana-flag-32.5B-it</option>
                  <option value="meta/llama-3-70b">meta/llama-3-70b</option>
                </Select>
              </FormField>
              <FormField label="Fallback 모델" info="주력 장애 시 자동 전환">
                <Select value={fallbackModel} onChange={(e) => setFallbackModel(e.target.value)}>
                  <option value="">선택 안 함</option>
                  <option value="google/gemma-4-31B-it-assistant">google/gemma-4-31B-it-assistant</option>
                  <option value="kakao/kanana-flag-32.5B-it">kakao/kanana-flag-32.5B-it</option>
                </Select>
              </FormField>
            </Row>
            <Row>
              <FormField label="Temperature">
                <Input type="number" step="0.1" defaultValue={0.2} />
              </FormField>
              <FormField label="Max output tokens">
                <Input type="number" defaultValue={1024} />
              </FormField>
            </Row>
          </SectionCard>

          {/* D. 연결 지식 자산 */}
          <SectionCard letter="D" name="연결 지식 자산" summary="이 에이전트가 참조할 RAG 인덱스·DB 커넥터" tag="MVP" defaultOpen>
            <FormField label="지식데이터 과제 연결" info="동일 프로젝트의 지식데이터 과제 중 선택">
              <div className="space-y-2">
                {MOCK_KNOWLEDGE_TASKS.map((k) => {
                  const on = linkedKnw.has(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleSet(linkedKnw, k.id, setLinkedKnw)}
                      className={cn(
                        'w-full text-left p-3 rounded border flex items-center gap-3',
                        on ? 'bg-brand-tint border-brand-dark' : 'bg-white border-line hover:border-brand-dark',
                      )}
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border-2 inline-flex items-center justify-center text-[10px]',
                          on ? 'bg-brand-dark border-brand-dark text-white' : 'border-line bg-white',
                        )}
                      >
                        {on && '✓'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{k.id}</span>
                          <span className="text-ink-light text-[10px]">·</span>
                          <span className="text-[10px] font-bold text-info">{k.assetKind}</span>
                        </div>
                        <div className="text-[12.5px] font-extrabold text-ink truncate">{k.name}</div>
                        {/* 어떤 데이터에 기반해 답이 나오는지 — 소유자와 최신 갱신일을 함께 본다. */}
                        <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
                          소유 {k.ownerName} · 최신 갱신 {k.updatedAt}
                        </div>
                      </div>
                      <span className="text-[10.5px] text-ink-mid font-semibold">{k.state}</span>
                    </button>
                  );
                })}
              </div>
            </FormField>
          </SectionCard>

          {/* E. 도구 */}
          <SectionCard letter="E" name="사용 도구" summary="RAG 검색·함수 호출·외부 API" tag="MVP">
            <FormField label="활성화 도구" info="복수 선택">
              <div className="flex flex-wrap gap-2">
                {[
                  ['rag_search', 'RAG 검색'],
                  ['function_call', '함수 호출'],
                  ['db_query', 'DB 조회'],
                  ['web_search', '웹 검색 (외부)'],
                  ['code_interp', '코드 실행'],
                ].map(([key, label]) => {
                  const on = tools.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSet(tools, key, setTools)}
                      className={cn(
                        'inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full border text-[11.5px] font-bold',
                        on
                          ? 'bg-info-bg border-info-border text-info'
                          : 'bg-surface-soft border-line-soft text-ink-mid hover:border-info-border',
                      )}
                    >
                      {on && '✓ '}
                      {label}
                    </button>
                  );
                })}
              </div>
            </FormField>
          </SectionCard>

          {/* F. 가드레일 */}
          <SectionCard letter="F" name="가드레일·안전" summary="PII 마스킹·레드팀 게이트" tag="MVP">
            <FormField label="PII 자동 마스킹" info="입출력 모두 적용">
              <div className="flex gap-3">
                <RadioBox checked={pii} onChange={() => setPii(true)} label="활성화" />
                <RadioBox checked={!pii} onChange={() => setPii(false)} label="비활성화" />
              </div>
            </FormField>
            <FormField
              label="레드팀 평가 게이트"
              info={stage === '서빙계' ? '서빙계 프로모션 시 자동 필수' : '학습계는 선택 가능'}
            >
              <div className="flex gap-3">
                <RadioBox
                  checked={redteam}
                  onChange={() => setRedteam(true)}
                  label="통과 필수"
                />
                <RadioBox
                  checked={!redteam}
                  onChange={() => stage !== '서빙계' && setRedteam(false)}
                  label="생략"
                />
              </div>
            </FormField>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <aside>
          <SidebarCard title="요약">
            <div className="space-y-1.5 text-[11.5px]">
              <SummaryRow label="에이전트명" value={name || '—'} />
              <SummaryRow label="배포" value={stage} />
              <SummaryRow label="주력 모델" value={mainModel} />
              <SummaryRow label="연결 지식" value={`${linkedKnw.size}건`} />
              <SummaryRow label="도구" value={`${tools.size}개`} />
              <SummaryRow label="PII 마스킹" value={pii ? '활성화' : '비활성화'} />
            </div>
          </SidebarCard>

          {/*
            결재선은 상신 시 배정될 **실제 사람**을 미리 보여 준다. 역할명만 적어
            두면 기안한 뒤 결재함에 뜬 이름과 달라진다.
          */}
          <SidebarCard title="결재선 미리보기">
            <div className="space-y-1.5 text-[11.5px]">
              <ApprLineStep seq="0" label={`기안 — ${drafter}`} tone="draft" note={`(${drafterRole})`} />
              <ApprLineStep
                seq="1"
                label={approvers.owner.label}
                note={`${approvers.owner.name} · ${approvers.owner.tenant}`}
              />
              {stage === '서빙계' && (
                <ApprLineStep seq="2" label="레드팀 게이트" tone="auto" note="(서빙계 필수)" />
              )}
              <ApprLineStep
                seq={stage === '서빙계' ? '3' : '2'}
                label="플랫폼 관리 그룹 승인"
                note={`${approvers.platform.name} · ${approvers.platform.tenant}`}
              />
            </div>
            <div className="mt-2 text-[10.5px] text-ink-mid font-semibold leading-relaxed">
              직무 분리(SoD) — 기안자는 승인 단계에 배정되지 않습니다 · ONM-003
            </div>
          </SidebarCard>
        </aside>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1360px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-[11.5px] text-ink-mid font-semibold">
            {requiredFilled ? (
              <span className="text-ok font-extrabold">필수 항목 모두 충족</span>
            ) : (
              <span className="text-bad font-extrabold">필수 항목 미충족</span>
            )}
            <span className="mx-2 text-line">·</span>
            자동 저장 활성
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to={projectId ? `/projects/${projectId}` : '/studio'}>
              <Button variant="ghost">취소</Button>
            </Link>
            <Button onClick={() => toast(`"${name}" 을(를) 템플릿으로 저장했습니다 — 다른 팀도 복제해 시작할 수 있습니다`)}>
              템플릿으로 저장
            </Button>
            <Button>임시 저장</Button>
            <Button variant="primary" disabled={!requiredFilled || submitting} onClick={submit}>
              {submitting ? '기안 중…' : '기안 →'}
            </Button>
          </div>
        </div>
      </div>

      {submitted && <DeploySubmitModal dep={submitted} onClose={closeAndGo} />}
    </div>
  );
}

function RadioBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label
      onClick={onChange}
      className={cn(
        'inline-flex items-center gap-2 py-2 px-3 rounded border cursor-pointer text-[12.5px] font-semibold',
        checked
          ? 'bg-brand-tint border-brand-dark text-ink'
          : 'bg-white border-line text-ink-dark hover:border-brand-dark',
      )}
    >
      <span
        className={cn(
          'w-3.5 h-3.5 rounded-full border-2 inline-block',
          checked ? 'border-brand-dark bg-brand' : 'border-line',
        )}
      />
      {label}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-1.5 px-2 rounded hover:bg-surface-soft">
      <span className="text-ink-mid font-semibold">{label}</span>
      <span className="text-ink-dark font-bold truncate max-w-[180px]" title={value}>
        {value}
      </span>
    </div>
  );
}

function ApprLineStep({
  seq,
  label,
  tone = 'normal',
  note,
}: {
  seq: string;
  label: string;
  tone?: 'normal' | 'draft' | 'auto';
  note?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded border',
        tone === 'draft' && 'bg-surface-soft border-line-soft',
        tone === 'auto' && 'bg-warn-bg border-warn-border',
        tone === 'normal' && 'bg-white border-line-soft',
      )}
    >
      <span className="w-5 h-5 rounded-full bg-white border border-line inline-flex items-center justify-center text-[10px] font-extrabold text-ink-dark flex-shrink-0">
        {seq}
      </span>
      <span className="text-[11.5px] font-semibold text-ink-dark">
        {label}
        {note && <span className="text-ink-mid text-[10.5px] ml-1">{note}</span>}
      </span>
    </div>
  );
}
