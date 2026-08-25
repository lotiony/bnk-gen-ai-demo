import { Link } from 'react-router-dom';
import { useState } from 'react';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/projectForm/SectionCard';
import SidebarCard from '@/components/projectForm/SidebarCard';
import FormField, { Input, Textarea, Select, Row } from '@/components/projectForm/FormField';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';

/** 필수 첨부 문서 목록. */
const ATTACHMENTS = [
  '구축요건 정의서',
  'AI 서비스 기획서',
  'AI 서비스 위험 평가서',
  'AI 서비스 위험관리 계획서',
  'AI 서비스 위험점검 체크리스트',
  'AI 업무 위수탁 체크리스트',
  '혁신금융서비스 지정 서류',
];

/** 모델 사용 호스트 4종. */
const HOSTS = ['on-prem', 'Azure', 'AWS', 'GCP'] as const;

/** 호스트별 선택 가능 모델 (데모 목록). */
const HOST_MODELS: Record<string, string[]> = {
  'on-prem': ['onprem/gpt-oss-120b', 'meta/llama-3-70b', 'kakao/kanana-flag-32.5B-it'],
  Azure: ['onprem/qwen3-32b', 'onprem/qwen3-32b', 'onprem/qwen3-32b'],
  AWS: ['onprem/llama-3.3-70b', 'onprem/sLLM-13b', 'onprem/llama-3.3-70b'],
  GCP: ['google/gemini-3-pro', 'google/gemini-3-flash'],
};

/**
 * 새 프로젝트 등록 — 사전 입력 명세 v0.7 기준 A·B·C·D·E·F·G·J 8개 섹션 + 우측 사이드바
 * (PRJ-101_project_register.html 포팅)
 */
export default function ProjectRegisterPage() {
  const persona = useCurrentPersona();
  // 기안자 = 현재 접속자. 오너 그룹 책임자와 소속 부서를 기본값으로 채운다.
  const drafterName = persona?.name ?? '';
  const drafterDept = persona?.dept ?? '';
  const [target, setTarget] = useState<'external' | 'internal'>('external');
  // 대고객(대외)은 사내 전용 통합 포털을 쓸 수 없어 API만 가능 → 기본 채널 api.
  const [channel, setChannel] = useState<'portal' | 'api'>('api');

  // ── 입력 상태 (진행률·섹션 완료·미충족 계산의 단일 소스) ──
  const [f, setF] = useState({
    name: '',
    startDate: '',
    endDate: '',
    apiChannel: '',
    dailyCalls: '',
    bizGoal: '',
    painPoint: '',
    expectedEffect: '',
    scenarios: '',
    sensitivity: '',
    tokenIn: '',
    tokenOut: '',
    peakRps: '',
    advisor: '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const [modality, setModality] = useState<string[]>([]);
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  // 호스트별 선택 모델 (host → modelId)
  const [hostModels, setHostModels] = useState<Record<string, string>>({});
  const toggleHost = (h: string) => {
    if (hosts.includes(h)) {
      setHosts(hosts.filter((x) => x !== h));
      setHostModels((m) => {
        const n = { ...m };
        delete n[h];
        return n;
      });
    } else {
      setHosts([...hosts, h]);
    }
  };
  const [attached, setAttached] = useState<boolean[]>(Array(ATTACHMENTS.length).fill(false));
  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // 오너 그룹 책임자는 접속자로 자동 채워짐 → 접속자 있으면 충족.
  const ownerFilled = !!drafterName;

  // 예상 TPM(분당 처리 토큰) = 피크 요청량(RPS) × 60초 × 콜당 토큰(입력+출력).
  const estTpm = (() => {
    const rps = Number(f.peakRps) || 0;
    const tokens = (Number(f.tokenIn) || 0) + (Number(f.tokenOut) || 0);
    return { rps, tokens, tpm: rps * 60 * tokens };
  })();

  // 섹션별 필수 충족 여부 (입력에서 파생).
  const sectionReq: Record<string, boolean[]> = {
    A: [f.name.trim() !== '', ownerFilled, f.startDate !== '', f.endDate !== ''],
    B: [
      true, // 서비스 대상 (기본 선택)
      true, // 노출 채널 (기본 선택)
      ...(channel === 'api' ? [f.apiChannel.trim() !== ''] : []),
    ],
    C: [f.bizGoal.trim() !== '', f.painPoint.trim() !== '', f.expectedEffect.trim() !== ''],
    D: [f.scenarios.trim() !== '', modality.length > 0],
    E: [dataTypes.length > 0, f.sensitivity !== ''],
    F: [
      hosts.length > 0 && hosts.every((h) => !!hostModels[h]), // 호스트 선택 + 각 호스트 모델 선택
      f.tokenIn !== '',
      f.tokenOut !== '',
      f.peakRps !== '',
      f.dailyCalls !== '',
    ],
    G: [f.advisor.trim() !== ''],
  };
  const allReq = Object.values(sectionReq).flat();
  const reqTotal = allReq.length;
  const reqFilled = allReq.filter(Boolean).length;

  const attachTotal = attached.length;
  const attachFilled = attached.filter(Boolean).length;

  const unmet = reqTotal - reqFilled + (attachTotal - attachFilled);
  const sectionOk: Record<string, boolean> = {
    ...Object.fromEntries(Object.entries(sectionReq).map(([k, v]) => [k, v.every(Boolean)])),
    J: attachFilled === attachTotal,
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: '새 프로젝트 등록' },
        ]}
      />

      <div className="card px-6 py-5 mb-3.5 flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">새 프로젝트 등록</h1>
          <p className="text-xs text-ink-mid font-semibold mt-1">
            사전 입력 명세 <b className="text-ink-dark">v0.7</b> 기준 · 8개 영역 · 입력하신 내용에
            따라 결재선과 필요한 첨부 문서가 정해집니다
          </p>
        </div>
        <span className="text-xs text-ink-mid font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-ok rounded-full" />
          자동 저장됨 · 09:23 KST
        </span>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        {/* Form column */}
        <div>
          {/* A. 기본 정보 */}
          <SectionCard letter="A" name="프로젝트 기본 정보" tag="MVP" defaultOpen>
            <Row>
              <FormField label="프로젝트명" required>
                <Input value={f.name} onChange={set('name')} example="에이전트명_프로젝트 형식 권장" />
              </FormField>
              <FormField label="프로젝트 코드">
                <Input example="저장 시 자동 발번" disabled />
              </FormField>
            </Row>
            <Row>
              <FormField label="소속 부서·팀">
                <Input value={drafterDept} example="로그인 정보에서 자동 입력" disabled />
              </FormField>
              <FormField label="프로젝트 오너 그룹" required>
                {drafterName && (
                  <div className="mb-2">
                    <ChipReadonly primary role="책임자">
                      {drafterName}
                    </ChipReadonly>
                  </div>
                )}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid">🔍</span>
                  <Input example="사번·이름으로 검색하여 추가" className="pl-8" />
                </div>
              </FormField>
            </Row>
            <Row>
              <FormField label="시작일" required>
                <Input type="date" value={f.startDate} onChange={set('startDate')} />
              </FormField>
              <FormField label="종료 예정일" required>
                <Input type="date" value={f.endDate} onChange={set('endDate')} />
              </FormField>
            </Row>
          </SectionCard>

          {/* B. 서비스 구분 + 노출 채널 */}
          <SectionCard
            letter="B"
            name="서비스 구분 + 노출 채널"
            tag="MVP"
            defaultOpen
          >
            <FormField label="서비스 대상" required>
              <div className="flex gap-3">
                <RadioBox
                  checked={target === 'external'}
                  onChange={() => {
                    setTarget('external');
                    setChannel('api'); // 대고객은 통합 포털 불가 → API로 강제
                  }}
                  label="대고객"
                />
                <RadioBox
                  checked={target === 'internal'}
                  onChange={() => setTarget('internal')}
                  label="대직원"
                />
              </div>
            </FormField>

            <FormField label="노출 채널" required>
              <div className="space-y-2">
                {target === 'internal' && (
                  <ChannelCard
                    active={channel === 'portal'}
                    onClick={() => setChannel('portal')}
                    label="① 그룹 공통 AI 포털"
                  />
                )}
                <ChannelCard
                  active={channel === 'api'}
                  onClick={() => setChannel('api')}
                  label={`${target === 'internal' ? '②' : '①'} API 활용 (에이전트를 API로만 제공)`}
                />
                {channel === 'api' && (
                  <div className="pl-3 pt-1">
                    <label className="block text-[11.5px] font-bold text-ink-dark mb-1">
                      노출 채널 <span className="text-bad">*</span>
                    </label>
                    <Input
                      value={f.apiChannel}
                      onChange={set('apiChannel')}
                      example="이 API를 노출할 채널을 입력하세요 (예: 사내 CRM, 콜센터 IVR)"
                    />
                  </div>
                )}
              </div>
            </FormField>
          </SectionCard>

          {/* C. 비즈니스 케이스 */}
          <SectionCard letter="C" name="비즈니스 케이스" tag="MVP">
            <FormField label="비즈니스 목표" required>
              <Textarea
                rows={3}
                value={f.bizGoal}
                onChange={set('bizGoal')}
                example="3~5문장으로 비즈니스 목표를 입력하세요"
              />
            </FormField>
            <Row>
              <FormField label="현재 페인포인트" required>
                <Textarea rows={2} value={f.painPoint} onChange={set('painPoint')} />
              </FormField>
              <FormField label="기대 효과" required>
                <Textarea rows={2} value={f.expectedEffect} onChange={set('expectedEffect')} />
              </FormField>
            </Row>
          </SectionCard>

          {/* D. 기능 요건 초안 */}
          <SectionCard letter="D" name="기능 요건 초안" tag="MVP">
            <FormField label="주요 시나리오" required>
              <Textarea
                rows={4}
                value={f.scenarios}
                onChange={set('scenarios')}
                example="시나리오 1: ...&#10;시나리오 2: ...&#10;시나리오 3: ..."
              />
            </FormField>
            <FormField label="입출력 modality" required>
              <div className="flex flex-wrap gap-2">
                {['텍스트', '문서·파일', '이미지', '음성'].map((m) => (
                  <CheckboxChip
                    key={m}
                    label={m}
                    checked={modality.includes(m)}
                    onToggle={() => toggle(modality, setModality, m)}
                  />
                ))}
              </div>
            </FormField>
          </SectionCard>

          {/* E. 데이터 자산 */}
          <SectionCard letter="E" name="데이터 자산 + 외부 부서 검토" tag="MVP">
            <FormField label="사용 데이터 종류" required>
              <div className="flex flex-wrap gap-2">
                {['사내 문서 (RAG)', '정형 DB', '외부 데이터', '없음'].map((d) => (
                  <CheckboxChip
                    key={d}
                    label={d}
                    checked={dataTypes.includes(d)}
                    onToggle={() => toggle(dataTypes, setDataTypes, d)}
                  />
                ))}
              </div>
            </FormField>
            <Row>
              <FormField label="RAG 인덱스 후보">
                <Input example="예: 상품 안내 매뉴얼 v1.0" />
              </FormField>
              <FormField label="DB 커넥터 후보">
                <Input example="예: tbl_customer (customer_id, name, grade)" />
              </FormField>
            </Row>
            <Row>
              <FormField label="데이터 민감도 등급" required>
                <Select value={f.sensitivity} onChange={set('sensitivity')}>
                  <option value="" disabled>선택</option>
                  <option value="1">1등급 (공개)</option>
                  <option value="2">2등급 (사내)</option>
                  <option value="3">3등급 (제한)</option>
                  <option value="4">4등급 (기밀)</option>
                </Select>
              </FormField>
              <FormField label="개인정보 포함">
                <div className="flex gap-3 mt-1">
                  <RadioBox label="포함" />
                  <RadioBox label="미포함" />
                </div>
              </FormField>
            </Row>
            <FormField label="신용정보 포함">
              <div className="flex gap-3">
                <RadioBox label="포함" />
                <RadioBox label="미포함" />
              </div>
            </FormField>
          </SectionCard>

          {/* F. 모델 + 비용 추정 */}
          <SectionCard letter="F" name="사용 가능 모델 + 비용 추정" tag="MVP">
            <FormField label="모델 사용 (호스트)" required>
              <div className="flex flex-wrap gap-2">
                {HOSTS.map((h) => (
                  <CheckboxChip
                    key={h}
                    label={h}
                    checked={hosts.includes(h)}
                    onToggle={() => toggleHost(h)}
                  />
                ))}
              </div>
              {hosts.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  {HOSTS.filter((h) => hosts.includes(h)).map((h) => (
                    <div key={h} className="grid grid-cols-[76px_1fr] gap-2 items-center">
                      <span className="text-[11.5px] font-bold text-ink-dark">{h}</span>
                      <Select
                        value={hostModels[h] ?? ''}
                        onChange={(e) => setHostModels((m) => ({ ...m, [h]: e.target.value }))}
                      >
                        <option value="" disabled>
                          모델 선택
                        </option>
                        {HOST_MODELS[h].map((mdl) => (
                          <option key={mdl} value={mdl}>
                            {mdl}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </FormField>
            <Row>
              <FormField label="1콜 평균 입력 토큰" required>
                <Input type="number" value={f.tokenIn} onChange={set('tokenIn')} example="예: 1,200" />
              </FormField>
              <FormField label="1콜 평균 출력 토큰" required>
                <Input type="number" value={f.tokenOut} onChange={set('tokenOut')} example="예: 450" />
              </FormField>
            </Row>
            <FormField label="피크 동시 호출 수" required>
              <Input
                type="number"
                value={f.peakRps}
                onChange={set('peakRps')}
                example="가장 붐빌 때 초당 최대 동시 호출 수(RPS)를 입력하세요"
                className="max-w-[200px]"
              />
            </FormField>
            <FormField label="일평균 호출량" required>
              <Input
                type="number"
                value={f.dailyCalls}
                onChange={set('dailyCalls')}
                example="하루 평균 예상 호출(콜) 건수를 입력하세요"
                className="max-w-[200px]"
              />
            </FormField>

            {/* 예상 TPM — 피크 RPS × 60초 × 콜당 토큰 */}
            <div className="mt-3 bg-surface-soft border border-line-soft rounded-md p-3.5">
              <div className="flex items-center gap-2 mb-2 text-[12.5px] font-extrabold text-ink-dark">
                🧮 예상 TPM (분당 처리 토큰)
              </div>
              {estTpm.tpm > 0 ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[22px] font-extrabold text-ink">
                      {estTpm.tpm.toLocaleString()}
                    </span>
                    <span className="text-[12px] font-bold text-ink-mid">TPM</span>
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-1 leading-relaxed">
                    피크 {estTpm.rps} RPS × 60초 × 콜당 {estTpm.tokens.toLocaleString()} 토큰(입력+출력)
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-ink-light font-semibold">
                  피크 동시 호출 수 · 1콜 평균 입력/출력 토큰을 입력하면 자동 계산됩니다.
                </div>
              )}
            </div>
          </SectionCard>

          {/* G. 예산·자원 */}
          <SectionCard letter="G" name="예산·자원" tag="MVP">
            <FormField
              label="예산·인프라 사전 협의 담당자"
              required
            >
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid">🔍</span>
                <Input value={f.advisor} onChange={set('advisor')} example="담당자 검색하여 추가" className="pl-8" />
              </div>
            </FormField>
          </SectionCard>

          {/* J. 문서 첨부 */}
          <SectionCard letter="J" name="문서 첨부 일괄" tag="MVP" defaultOpen>
            <p className="text-[11.5px] text-ink-mid mb-3">
              입력한 내용(개인정보·CSP 모델 등)에 따라 필수 첨부 항목이 자동 표시됩니다.
            </p>
            {ATTACHMENTS.map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-2 py-2 px-3 bg-surface-soft border border-line-soft rounded mb-1.5"
              >
                <span className="text-[12.5px] font-bold text-ink-dark flex-1">{name}</span>
                <span className="pill bg-bad-bg text-bad border border-bad-border">필수</span>
                {attached[i] ? (
                  <button
                    onClick={() => setAttached((a) => a.map((v, j) => (j === i ? false : v)))}
                    className="pill bg-ok-bg text-ok border border-ok-border hover:opacity-80"
                    title="첨부 취소"
                  >
                    ✓ 첨부됨
                  </button>
                ) : (
                  <button
                    onClick={() => setAttached((a) => a.map((v, j) => (j === i ? true : v)))}
                    className="text-info text-[11.5px] font-bold hover:underline"
                  >
                    ＋ 업로드
                  </button>
                )}
              </div>
            ))}
          </SectionCard>
        </div>

        {/* Right sidebar */}
        <aside className="sticky top-[106px] self-start">
          <SidebarCard title="진행률">
            <Progress label="필수 필드" current={reqFilled} total={reqTotal} />
            <Progress
              label="필수 첨부"
              current={attachFilled}
              total={attachTotal}
              tone={attachFilled === attachTotal ? 'normal' : 'bad'}
            />
          </SidebarCard>

          <SidebarCard title="섹션 네비게이션">
            <div className="space-y-1 text-[11.5px]">
              {([
                ['A', '프로젝트 기본 정보'],
                ['B', '서비스·노출 채널'],
                ['C', '비즈니스 케이스'],
                ['D', '기능 요건 초안'],
                ['E', '데이터 자산'],
                ['F', '모델·비용'],
                ['G', '예산·자원'],
                ['J', '문서 첨부'],
              ] as const).map(([letter, name]) => {
                const ok = sectionOk[letter];
                return (
                <a
                  key={letter as string}
                  href={`#sec-${letter}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-soft"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-tint text-ink font-extrabold text-2xs border border-brand-dark">
                      {letter}
                    </span>
                    <span className="font-semibold text-ink-dark">{name}</span>
                  </span>
                  {ok ? (
                    <span className="text-ok font-bold">✓</span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-bad" />
                  )}
                </a>
                );
              })}
            </div>
          </SidebarCard>

          <SidebarCard title="입력 내용에 따른 결재선 미리보기">
            <div className="space-y-1.5 text-[11.5px]">
              <ApprLineStep seq="0" label="기안 — 프로젝트 오너 그룹" tone="current" />
              <ApprLineStep seq="1" label="거버넌스 관리 그룹" />
              <ApprLineStep seq="2" label="사업 관리 그룹" />
              <ApprLineStep seq="3" label="플랫폼 관리 그룹" />
              <ApprLineStep seq="4" label="부서장" />
            </div>
          </SidebarCard>
        </aside>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-[11.5px] text-ink-mid font-semibold">
            {unmet > 0 ? (
              <span className="text-bad font-extrabold">필수 미충족 {unmet}건</span>
            ) : (
              <span className="text-ok font-extrabold">✓ 필수 항목 모두 충족</span>
            )}
            <span className="mx-2 text-line">·</span>
            마지막 저장 09:23 · 자동 저장 활성
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/projects">
              <Button variant="ghost">취소</Button>
            </Link>
            <Button>임시 저장</Button>
            <Button variant="primary" disabled={unmet > 0}>
              기안 →
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

function CheckboxChip({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full border cursor-pointer text-[11.5px] font-bold transition-colors',
        checked
          ? 'bg-info-bg border-info-border text-info'
          : 'bg-surface-soft border-line-soft text-ink-mid hover:border-info-border',
      )}
    >
      {checked && '✓ '}
      {label}
    </button>
  );
}

function ChannelCard({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded border',
        active
          ? 'bg-brand-tint border-brand-dark'
          : 'bg-white border-line hover:border-brand-dark',
      )}
    >
      <div className="text-[12.5px] font-extrabold text-ink">{label}</div>
      {desc && <div className="text-[11px] text-ink-mid font-semibold mt-0.5">{desc}</div>}
    </button>
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
  const pct = Math.round((current / total) * 100);
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
  tone?: 'normal' | 'draft' | 'auto' | 'current';
  note?: string;
}) {
  const current = tone === 'current';
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded border',
        tone === 'draft' && 'bg-surface-soft border-line-soft',
        tone === 'auto' && 'bg-warn-bg border-warn-border',
        tone === 'normal' && 'bg-white border-line-soft',
        current && 'bg-brand-tint border-brand-dark',
      )}
    >
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          current
            ? 'bg-brand-dark text-white border border-brand-dark'
            : 'bg-white border border-line text-ink-dark',
        )}
      >
        {seq}
      </span>
      <span
        className={cn(
          'text-[11.5px]',
          current ? 'font-extrabold text-ink' : 'font-semibold text-ink-dark',
        )}
      >
        {label}
        {note && <span className="text-ink-mid text-[10.5px] ml-1">{note}</span>}
      </span>
    </div>
  );
}
