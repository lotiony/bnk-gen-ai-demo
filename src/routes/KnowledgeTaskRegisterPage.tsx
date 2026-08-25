import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/projectForm/SectionCard';
import SidebarCard from '@/components/projectForm/SidebarCard';
import FormField, { Input, Row } from '@/components/projectForm/FormField';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';

/** 지식 과제 유형. */
const TASK_TYPES = [
  { id: '지식 데이터', icon: '📁', desc: '문서를 파싱·임베딩해 검색 인덱스로 구축' },
  { id: 'DB 커넥터', icon: '🗄️', desc: '사내·외부 DB를 읽기 전용으로 연동' },
  { id: 'API 커넥터', icon: '🔗', desc: '외부 REST API를 지식 소스로 연동' },
] as const;
type TaskType = (typeof TASK_TYPES)[number]['id'];

/**
 * 인프라 선택지.
 *
 * 본 사업은 공동존 상면 On-Premise 전용이므로 실제 선택지는 하나다.
 * Public LLM 은 RFP 권고 항목(ONM-007 — 향후 망분리 규제 완화 대비
 * Public/Hybrid Cloud 전환 용이성)을 화면으로 보이기 위해 비활성 상태로
 * 노출한다. 선택 시 비용 결재 + 혁신금융서비스 지정 서류가 자동으로
 * 결재선에 묶이는 통제 구조까지 함께 보여준다.
 */
const INFRAS = {
  onprem: {
    label: '공동존 On-Premise',
    logo: '🏢',
    engine: 'OpenSearch · 공동존 검색엔진',
    available: true,
    note: '부산 문현 공동존 · BareMetal K8s',
  },
  hybrid: {
    label: 'Public LLM 하이브리드',
    logo: '🌐',
    engine: '향후 망분리 규제 완화 시 활성',
    available: false,
    note: '선택 시 비용 결재 + 혁신금융서비스 지정 서류 자동 첨부',
  },
} as const;
type InfraId = keyof typeof INFRAS;

/**
 * 새 Knowledge 과제 등록 — 지식 과제 생성은 결재(기안) 대상이다.
 * 입력 완료 후 [기안 →] 하면 프로젝트 오너 그룹 결재선으로 넘어간다.
 */
export default function KnowledgeTaskRegisterPage() {
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const navigate = useNavigate();
  const persona = useCurrentPersona();
  const drafterName = persona?.name ?? '';
  const drafterDept = persona?.dept ?? '';

  const [taskType, setTaskType] = useState<TaskType>('지식 데이터');
  const [infra, setInfra] = useState<InfraId>('onprem');
  const infraCfg = INFRAS[infra];

  const [name, setName] = useState('');

  // ── 필수 충족 계산 ── (과제명만 필수, 나머지는 선택/기본값)
  const reqFields = [name.trim()];
  const reqFilled = reqFields.filter(Boolean).length;
  const reqTotal = reqFields.length;
  const unmet = reqTotal - reqFilled;

  const submit = () => {
    if (unmet > 0) return;
    // 프로토타입: 기안하면 결재함으로 이동 (지식 과제 생성 결재 상신).
    navigate('/approvals');
  };

  return (
    <div className="max-w-[1760px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: '새 Knowledge 과제' },
        ]}
      />

      <div className="card px-6 py-5 mb-3.5 flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">새 Knowledge 과제 등록</h1>
          <p className="text-xs text-ink-mid font-semibold mt-1">
            지식 과제 생성은 <b className="text-ink-dark">결재 대상</b>입니다 · 입력을 마치면 프로젝트 오너 그룹
            결재선으로 상신됩니다
          </p>
        </div>
        <span className="text-xs text-ink-mid font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-ok rounded-full" />
          임시 저장됨 · 방금
        </span>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        {/* Form column */}
        <div>
          {/* A. 과제 기본 정보 */}
          <SectionCard letter="A" name="과제 기본 정보" tag="필수" defaultOpen>
            <Row>
              <FormField label="과제명" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} example="예: 보이스피싱 사례매뉴얼" />
              </FormField>
              <FormField label="과제 코드">
                <Input example="기안 시 자동 발번 (KNW-###)" disabled />
              </FormField>
            </Row>
            <Row>
              <FormField label="담당자" required>
                {drafterName ? (
                  <div className="pt-0.5">
                    <ChipReadonly primary role="기안자">
                      {drafterName}
                    </ChipReadonly>
                  </div>
                ) : (
                  <Input example="로그인 정보에서 자동 입력" disabled />
                )}
              </FormField>
              <FormField label="소속 부서·팀">
                <Input value={drafterDept} example="로그인 정보에서 자동 입력" disabled />
              </FormField>
            </Row>
          </SectionCard>

          {/* B. 과제 유형 */}
          <SectionCard letter="B" name="과제 유형" summary={taskType} tag="필수" defaultOpen>
            <div className="grid grid-cols-3 gap-2.5">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTaskType(t.id)}
                  className={cn(
                    'text-left p-3 rounded-lg border transition-colors',
                    taskType === t.id
                      ? 'bg-brand-tint border-brand-dark'
                      : 'bg-white border-line hover:border-brand-dark',
                  )}
                >
                  <div className="text-[18px] mb-1">{t.icon}</div>
                  <div className="text-[12.5px] font-extrabold text-ink">{t.id}</div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 leading-snug">{t.desc}</div>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* C. 인프라 */}
          <SectionCard letter="C" name="인프라" summary={infraCfg.label} tag="필수" defaultOpen>
            <FormField
              label="구동 인프라"
              required
              hint="본 사업은 공동존 상면 On-Premise 전용입니다. 세부 검색 엔진·임베딩 모델은 인덱스 빌드 단계에서 설정합니다."
            >
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(INFRAS) as InfraId[]).map((c) => {
                  const cfg = INFRAS[c];
                  const on = infra === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={!cfg.available}
                      title={cfg.available ? undefined : '향후 망분리 규제 완화 시 활성화 (RFP ONM-007)'}
                      onClick={() => cfg.available && setInfra(c)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                        !cfg.available
                          ? 'bg-surface border-line-soft cursor-not-allowed opacity-70'
                          : on
                            ? 'bg-info-bg border-info-border'
                            : 'bg-white border-line hover:border-info-border',
                      )}
                    >
                      <span className="text-[22px] leading-none">{cfg.logo}</span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-[12.5px] font-extrabold',
                            cfg.available ? 'text-ink' : 'text-ink-light',
                          )}
                        >
                          {cfg.label}
                          {!cfg.available && (
                            <span className="ml-1.5 text-[9.5px] font-bold text-ink-light">향후</span>
                          )}
                        </span>
                        <span className="block text-[10.5px] text-ink-mid font-semibold">{cfg.engine}</span>
                      </span>
                      <span
                        className={cn(
                          'ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0',
                          on ? 'border-info bg-info' : 'border-line',
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10.5px] text-ink-mid font-semibold">
                🔒 {INFRAS.hybrid.note} — RFP ONM-007 대비
              </p>
            </FormField>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <aside className="sticky top-[106px] self-start">
          <SidebarCard title="진행률">
            <Progress label="필수 필드" current={reqFilled} total={reqTotal} />
          </SidebarCard>

          <SidebarCard title="선택 요약">
            <div className="space-y-1.5 text-[11.5px]">
              <SummaryRow k="유형" v={taskType} />
              <SummaryRow k="인프라" v={infraCfg.label} />
            </div>
          </SidebarCard>

          <SidebarCard title="결재선 미리보기">
            <div className="space-y-1.5">
              <ApprLineStep
                seq="0"
                label="기안"
                tone="current"
                note={drafterName ? `· ${drafterName}` : undefined}
              />
              <ApprLineStep seq="1" label="플랫폼 관리 그룹" />
            </div>
          </SidebarCard>
        </aside>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1760px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-[11.5px] text-ink-mid font-semibold">
            {unmet > 0 ? (
              <span className="text-bad font-extrabold">필수 미충족 {unmet}건</span>
            ) : (
              <span className="text-ok font-extrabold">✓ 필수 항목 모두 충족</span>
            )}
            <span className="mx-2 text-line">·</span>
            지식 과제 생성 결재
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to={`/projects/${pid}`}>
              <Button variant="ghost">취소</Button>
            </Link>
            <Button>임시 저장</Button>
            <Button variant="primary" disabled={unmet > 0} onClick={submit}>
              기안 →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-mid font-semibold">{k}</span>
      <span className="text-ink-dark font-bold text-right truncate">{v}</span>
    </div>
  );
}

function Progress({
  label,
  current,
  total,
  tone = 'normal',
}: {
  label: string;
  current: number;
  total: number;
  tone?: 'normal' | 'bad';
}) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-[11.5px] font-semibold text-ink-dark mb-1">
        <span>{label}</span>
        <span>
          <b>{current}</b> / {total}
        </span>
      </div>
      <div className="h-1.5 bg-surface-soft rounded overflow-hidden">
        <div
          className={cn('h-full', tone === 'bad' ? 'bg-bad' : 'bg-brand-dark')}
          style={{ width: `${pct}%` }}
        />
      </div>
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
  tone?: 'normal' | 'auto' | 'current';
  note?: string;
}) {
  const current = tone === 'current';
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded border',
        tone === 'auto' && 'bg-warn-bg border-warn-border',
        tone === 'normal' && 'bg-white border-line-soft',
        current && 'bg-brand-tint border-brand-dark',
      )}
    >
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          current ? 'bg-brand-dark text-white border border-brand-dark' : 'bg-white border border-line text-ink-dark',
        )}
      >
        {seq}
      </span>
      <span className={cn('text-[11.5px]', current ? 'font-extrabold text-ink' : 'font-semibold text-ink-dark')}>
        {label}
        {note && <span className="text-ink-mid text-[10.5px] ml-1">{note}</span>}
      </span>
    </div>
  );
}
