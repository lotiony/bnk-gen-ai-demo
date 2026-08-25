import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/projectForm/SectionCard';
import SidebarCard from '@/components/projectForm/SidebarCard';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import FormField, { Input, Textarea, Select, Row } from '@/components/projectForm/FormField';
import { cn } from '@/lib/utils';
import { MOCK_KNOWLEDGE_TASKS } from '@/data/mockKnowledgeTasks';
import { addAgentTask, BUILDER_LABEL, type AgentBuilder } from '@/data/mockAgentTasks';

/**
 * 에이전트 과제 등록 — 프로젝트 내 에이전트 1개를 정의 (시스템 프롬프트·모델·도구·연결 지식).
 * 프로젝트 등록 폼과 동일한 디자인 토큰을 사용한다.
 */
export default function AgentTaskRegisterPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-101';

  const [name, setName] = useState('보이스피싱 1차 분류 에이전트');
  const [stage, setStage] = useState<'학습계' | '서빙계'>('학습계');
  const [builder, setBuilder] = useState<AgentBuilder>('pro-code');
  const [systemPrompt, setSystemPrompt] = useState(
    '당신은 보이스피싱 통화를 1차 분류하는 어시스턴트입니다. 통화 내용에서 의심 단서(긴급성·송금 요청·기관 사칭)를 식별하여 risk_score(0~100)와 근거를 JSON으로 반환합니다.',
  );
  const [mainModel, setMainModel] = useState('openai/gpt-oss-120b');
  const [fallbackModel, setFallbackModel] = useState('google/gemma-4-31B-it-assistant');
  const [tools, setTools] = useState<Set<string>>(new Set(['rag_search', 'function_call']));
  const [linkedKnw, setLinkedKnw] = useState<Set<string>>(new Set(['KNW-201']));
  const [pii, setPii] = useState(true);
  const [redteam, setRedteam] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const submit = () => {
    if (!requiredFilled || submitting) return;
    setSubmitting(true);
    addAgentTask({
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
    });
    // 약간의 지연으로 기안 처리 느낌
    window.setTimeout(() => navigate(`/projects/${pid}`), 350);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: '에이전트 과제 등록' },
        ]}
      />

      <div className="card px-6 py-5 mb-3.5 flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">에이전트 과제 등록</h1>
          <p className="text-xs text-ink-mid font-semibold mt-1">
            프로젝트 내 에이전트 1개를 정의합니다 · 시스템 프롬프트·모델·연결 지식·도구·가드레일
          </p>
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
              <FormField label="에이전트명" required hint="과제 단위로 식별되는 이름">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 보이스피싱 1차 분류 에이전트"
                />
              </FormField>
              <FormField label="과제 코드" info="기안 시 자동 발번">
                <Input defaultValue="AGT-2026-NEW" disabled />
              </FormField>
            </Row>
            <Row>
              <FormField label="담당자" required>
                <div className="mb-2">
                  <ChipReadonly primary role="책임자">
                    김플랫
                  </ChipReadonly>
                  <ChipReadonly>박서연</ChipReadonly>
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
                  <option value="openai/gpt-oss-120b">openai/gpt-oss-120b</option>
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
                          on ? 'bg-brand-dark border-brand-dark text-ink' : 'border-line bg-white',
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

          <SidebarCard title="결재선 미리보기">
            <div className="space-y-1.5 text-[11.5px]">
              <ApprLineStep seq="0" label="기안 — 담당자" tone="draft" />
              <ApprLineStep seq="1" label="프로젝트 오너 그룹" />
              {stage === '서빙계' && <ApprLineStep seq="2" label="레드팀 게이트" tone="auto" note="(서빙계)" />}
              <ApprLineStep seq={stage === '서빙계' ? '3' : '2'} label="플랫폼 관리 그룹" />
            </div>
          </SidebarCard>
        </aside>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-3">
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
            <Link to={`/projects/${pid}`}>
              <Button variant="ghost">취소</Button>
            </Link>
            <Button>임시 저장</Button>
            <Button variant="primary" disabled={!requiredFilled || submitting} onClick={submit}>
              {submitting ? '기안 중…' : '기안 →'}
            </Button>
          </div>
        </div>
      </div>
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
