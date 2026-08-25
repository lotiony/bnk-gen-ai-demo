import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import StatusPill from '@/components/ui/StatusPill';
import SectionCard from '@/components/projectForm/SectionCard';
import SidebarCard from '@/components/projectForm/SidebarCard';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import FormField, { Input, Select, Row } from '@/components/projectForm/FormField';
import { cn } from '@/lib/utils';

/**
 * 지식 파이프라인 과제 등록 — 지식데이터 과제에서 만든 인덱스를 골라
 * 검색엔진(retriever) 서비스로 가공·평가·서빙계 프로모션 까지 처리.
 * 에이전트/지식데이터 과제와 동일한 디자인 토큰·레이아웃 사용.
 */
export default function SearchPipelineTaskPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-101';

  // A
  const [name, setName] = useState('규정검색_컴플라이언스');
  // B
  const [selectedIdx, setSelectedIdx] = useState<Set<string>>(
    () => new Set(['idx-voice-phishing-v3', 'idx-compliance-rules-v3']),
  );
  const [combine, setCombine] = useState<'single' | 'fed' | 'route'>('fed');
  // C
  const [retrieval, setRetrieval] = useState<Set<string>>(() => new Set(['hybrid', 'rerank']));
  const [embedModel, setEmbedModel] = useState('on-prem/e5-large-ko-1024d');
  const [rerankModel, setRerankModel] = useState('onprem/bge-reranker-v2-m3');
  const [topK, setTopK] = useState(10);
  const [tenancy, setTenancy] = useState<'single' | 'multi'>('multi');
  // D
  const [scenarios, setScenarios] = useState([
    { name: '보이스피싱탐지 에이전트 (사례 매뉴얼 검색)', avg: '2.4', peak: '8.0' },
    { name: '컴플라이언스 자문 챗봇 (규정 인용)', avg: '1.2', peak: '5.0' },
    { name: '', avg: '', peak: '' },
  ]);
  // E
  const [goldenCount] = useState(147);
  const goldenMin = 120;
  const [recall, setRecall] = useState('0.85');
  const [mrr, setMrr] = useState('0.68');
  const [ndcg, setNdcg] = useState('0.78');
  const [humanEval, setHumanEval] = useState(false);
  // H
  const [agreeAttached, setAgreeAttached] = useState(false);
  const [innovDocAttached, setInnovDocAttached] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const toggleSet = (s: Set<string>, k: string, set: (n: Set<string>) => void) => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    set(next);
  };

  // 인덱스 카탈로그(목업) — 외부 과제 인덱스 표시용
  const indexCatalog = [
    {
      id: 'idx-voice-phishing-v3',
      label: 'idx-voice-phishing-v3',
      ownerTask: '보이스피싱 사례매뉴얼',
      mine: true,
      sens: 2,
      chunks: 3841,
      refresh: '분기',
      embed: '1024d · 한국어 e5-large',
    },
    {
      id: 'idx-compliance-rules-v3',
      label: 'idx-compliance-rules-v3',
      ownerTask: '전사 규정·컴플라이언스 지식',
      mine: false,
      sens: 3,
      chunks: 12407,
      refresh: '실시간',
      embed: '1024d · 한국어 e5-large',
    },
    {
      id: 'idx-product-catalog-2026',
      label: 'idx-product-catalog-2026',
      ownerTask: '상품 카탈로그 지식',
      mine: false,
      sens: 1,
      chunks: 2154,
      refresh: '월',
      embed: '768d · multilingual-e5',
    },
  ];

  // 자동 매칭 결과
  const usesExternalIdx = useMemo(
    () => [...selectedIdx].some((id) => !indexCatalog.find((i) => i.id === id)?.mine),
    [selectedIdx],
  );
  const maxSens = useMemo(
    () =>
      Math.max(
        ...indexCatalog.filter((i) => selectedIdx.has(i.id)).map((i) => i.sens),
        0,
      ),
    [selectedIdx],
  );
  const usesCSP = rerankModel.startsWith('azure/') || rerankModel.startsWith('aws/');

  // 필수 충족 판정
  const filledScenarios = scenarios.filter((s) => s.name.trim()).length;
  const requiredFilled =
    Boolean(name.trim()) &&
    selectedIdx.size > 0 &&
    retrieval.size > 0 &&
    filledScenarios >= 3 &&
    goldenCount >= goldenMin &&
    (!usesExternalIdx || agreeAttached) &&
    (!usesCSP || innovDocAttached);

  const submit = () => {
    if (!requiredFilled || submitting) return;
    setSubmitting(true);
    window.setTimeout(() => navigate(`/projects/${pid}`), 350);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: '지식 파이프라인 과제 등록' },
        ]}
      />

      {/* Page head */}
      <div className="card px-6 py-5 mb-3.5 flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
            지식 파이프라인 과제 등록
          </h1>
          <p className="text-xs text-ink-mid font-semibold mt-1">
            지식데이터 과제의 인덱스를 골라 <b className="text-ink-dark">검색엔진(retriever)</b>을 학습계 배포 →
            평가 → 서빙계 프로모션 까지 한 흐름으로 처리합니다
          </p>
        </div>
        <span className="text-xs text-ink-mid font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-ok rounded-full" />
          자동 저장됨 ·{' '}
          {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} KST
        </span>
      </div>

      {/* 4-stage stepper */}
      <div className="card px-4 py-3 mb-3.5">
        <div className="flex items-center gap-1">
          <StageItem n={1} name="인덱스 선택·기획" meta="입력 명세 8영역" active />
          <StageArrow />
          <StageItem n={2} name="학습계 배포·튜닝" meta="결재 · 간이" />
          <StageArrow />
          <StageItem n={3} name="평가·테스트" meta="골든셋 · 자동·휴먼" />
          <StageArrow />
          <StageItem n={4} name="서빙계 프로모션" meta="결재 · 풀 + 품질 게이트" />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        <div>
          {/* A. 과제 기본 정보 */}
          <SectionCard
            letter="A"
            name="과제 기본 정보"
            summary="과제명·소속·결재 그룹"
            tag="MVP"
            defaultOpen
          >
            <Row>
              <FormField label="과제명" required hint="권장 규칙: 검색엔진명_도메인">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 규정검색_컴플라이언스"
                />
              </FormField>
              <FormField label="과제 코드" info="기안 시 자동 발번">
                <Input defaultValue="SRC-2026-NEW" disabled />
              </FormField>
            </Row>
            <Row>
              <FormField label="소속 부서·팀" info="SSO 디렉토리에서 자동">
                <Input defaultValue="데이터플랫폼팀 · AI디지털전략부" disabled />
              </FormField>
              <FormField label="기간" required>
                <div className="flex items-center gap-2">
                  <Input type="date" defaultValue="2026-06-01" />
                  <span className="text-ink-mid">~</span>
                  <Input type="date" defaultValue="2026-12-31" />
                </div>
              </FormField>
            </Row>
            <FormField label="프로젝트 오너 그룹" required info="책임자 1명 + 백업 0~2명">
              <div className="mb-2">
                <ChipReadonly primary role="책임자">
                  조현우
                </ChipReadonly>
                <ChipReadonly role="백업" roleVariant="fallback">
                  박서연
                </ChipReadonly>
                <ChipReadonly role="백업" roleVariant="fallback">
                  윤지수
                </ChipReadonly>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid">🔍</span>
                <Input placeholder="사번·이름으로 검색하여 추가" className="pl-8" />
              </div>
            </FormField>
          </SectionCard>

          {/* B. 입력 인덱스 선택 */}
          <SectionCard
            letter="B"
            name="입력 인덱스 선택"
            summary="지식데이터 과제에서 만든 인덱스를 골라 옵니다"
            tag="MVP"
            defaultOpen
          >
            <FormField label="원천 인덱스" required info="복수 선택 가능">
              <div className="space-y-2">
                {indexCatalog.map((idx) => {
                  const on = selectedIdx.has(idx.id);
                  return (
                    <button
                      key={idx.id}
                      type="button"
                      onClick={() => toggleSet(selectedIdx, idx.id, setSelectedIdx)}
                      className={cn(
                        'w-full text-left p-3 rounded border flex items-center gap-3',
                        on
                          ? 'bg-brand-tint border-brand-dark'
                          : 'bg-white border-line hover:border-brand-dark',
                      )}
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border-2 inline-flex items-center justify-center text-[10px] flex-shrink-0',
                          on
                            ? 'bg-brand-dark border-brand-dark text-white'
                            : 'border-line bg-white',
                        )}
                      >
                        {on && '✓'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">
                            {idx.label}
                          </span>
                          <span className="text-ink-light text-[10px]">·</span>
                          <span className="text-[10px] font-bold text-info">{idx.embed}</span>
                          {idx.mine && (
                            <span className="text-[9.5px] font-extrabold bg-ok-bg text-ok border border-ok-border py-px px-1.5 rounded-md">
                              내 과제
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] font-extrabold text-ink truncate">
                          {idx.ownerTask}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-[10.5px] text-ink-mid font-semibold">
                        <SensPill sens={idx.sens} />
                        <span>
                          청크 <b className="text-ink-dark">{idx.chunks.toLocaleString()}</b> · 갱신{' '}
                          {idx.refresh}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormField>

            {usesExternalIdx && (
              <div className="mt-3 bg-warn-bg border border-warn-border rounded p-2.5 text-[11.5px] text-warn flex items-start gap-2">
                <span className="font-extrabold">⚠</span>
                <div>
                  <b>외부 과제 인덱스 사용</b> · 선택한 인덱스 중 다른 과제 소속이 있습니다. 소유 PM 동의 자료를
                  H.첨부에 업로드해야 결재 상신 가능.
                </div>
              </div>
            )}

            <Row>
              <FormField label="결합 방식" required>
                <div className="flex gap-2">
                  <RadioBox
                    checked={combine === 'single'}
                    onChange={() => setCombine('single')}
                    label="단일"
                  />
                  <RadioBox
                    checked={combine === 'fed'}
                    onChange={() => setCombine('fed')}
                    label="페더레이션"
                  />
                  <RadioBox
                    checked={combine === 'route'}
                    onChange={() => setCombine('route')}
                    label="라우팅"
                  />
                </div>
              </FormField>
              <FormField label="원천 변경 구독" info="ON 시 원천 갱신 알림이 본 과제로도 전달">
                <div className="flex gap-2">
                  <RadioBox checked label="ON" onChange={() => {}} />
                  <RadioBox checked={false} label="OFF" onChange={() => {}} />
                </div>
              </FormField>
            </Row>
          </SectionCard>

          {/* C. 검색엔진 사양 */}
          <SectionCard
            letter="C"
            name="검색엔진 사양"
            summary="Retrieval 방식 · 모델 후보 · 멀티테넌시"
            tag="MVP"
            defaultOpen
          >
            <FormField label="Retrieval 방식" required info="결재 가중 없음">
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['bm25', 'BM25', '키워드 기반. 임베딩 비용 없음'],
                    ['dense', 'Dense', '의미 기반 임베딩 검색'],
                    ['hybrid', 'Hybrid', 'BM25 + Dense 가중 결합 · 권장'],
                    ['rerank', '+ Rerank', 'Cross-encoder 재정렬'],
                  ] as const
                ).map(([k, label, desc]) => {
                  const on = retrieval.has(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleSet(retrieval, k, setRetrieval)}
                      className={cn(
                        'text-left p-3 rounded border transition-colors',
                        on
                          ? 'bg-brand-tint border-brand-dark'
                          : 'bg-white border-line hover:border-brand-dark',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12.5px] font-extrabold text-ink">{label}</span>
                        <span
                          className={cn(
                            'w-4 h-4 rounded-full border-2 inline-block',
                            on ? 'border-brand-dark bg-brand' : 'border-line',
                          )}
                        />
                      </div>
                      <div className="text-[10.5px] text-ink-mid leading-snug">{desc}</div>
                    </button>
                  );
                })}
              </div>
            </FormField>

            <Row>
              <FormField label="임베딩 모델" required info="LLM 게이트웨이 화이트리스트">
                <Select value={embedModel} onChange={(e) => setEmbedModel(e.target.value)}>
                  <option value="on-prem/e5-large-ko-1024d">on-prem/e5-large-ko-1024d</option>
                  <option value="on-prem/bge-m3-1024d">on-prem/bge-m3-1024d</option>
                  <option value="onprem/bge-m3-ko">onprem/bge-m3-ko</option>
                </Select>
              </FormField>
              <FormField label="Rerank 모델" info="선택 시 cross-encoder 단계 추가">
                <Select value={rerankModel} onChange={(e) => setRerankModel(e.target.value)}>
                  <option value="">선택 안 함</option>
                  <option value="on-prem/bge-reranker-large">on-prem/bge-reranker-large</option>
                  <option value="onprem/bge-reranker-v2-m3">onprem/bge-reranker-v2-m3 (CSP)</option>
                  <option value="onprem/bge-reranker-v2-m3">onprem/bge-reranker-v2-m3 (CSP)</option>
                </Select>
              </FormField>
            </Row>

            {usesCSP && (
              <div className="mb-3 bg-info-bg border border-info-border rounded p-2.5 text-[11.5px] text-info flex items-start gap-2">
                <span className="font-extrabold">ℹ</span>
                <div>
                  <b>CSP 모델 선택</b> · F.비용 영역에 비용 결재 자동 묶임 · H.첨부의 혁신금융서비스 지정 서류
                  필수로 전환됨
                </div>
              </div>
            )}

            <Row>
              <FormField label="기본 Top-K">
                <Input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value) || 10)}
                />
              </FormField>
              <FormField label="멀티테넌시" required>
                <Select value={tenancy} onChange={(e) => setTenancy(e.target.value as 'single' | 'multi')}>
                  <option value="single">단일 테넌트</option>
                  <option value="multi">다중 테넌트 (소비 Agent별 격리)</option>
                </Select>
              </FormField>
            </Row>
          </SectionCard>

          {/* D. 소비 시나리오 */}
          <SectionCard
            letter="D"
            name="소비 시나리오"
            summary="어떤 Agent가 이 검색엔진을 호출하나요"
            tag="MVP"
            defaultOpen
          >
            <FormField label="소비 Agent 후보" required info="최소 3개 · placeholder는 예시">
              <div className="space-y-2">
                <div className="grid grid-cols-[28px_1fr_120px_120px_28px] gap-2 text-[10.5px] text-ink-mid font-bold uppercase tracking-[0.3px] px-1">
                  <span>＃</span>
                  <span>Agent 이름 또는 설명</span>
                  <span className="text-center">평균 QPS</span>
                  <span className="text-center">피크 QPS</span>
                  <span></span>
                </div>
                {scenarios.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[28px_1fr_120px_120px_28px] gap-2 items-center"
                  >
                    <span className="text-center text-[11px] font-extrabold text-ink-mid">{i + 1}</span>
                    <Input
                      value={s.name}
                      onChange={(e) => {
                        const next = [...scenarios];
                        next[i] = { ...next[i], name: e.target.value };
                        setScenarios(next);
                      }}
                      placeholder="예: 통합 포털 Agent — 사내 QA"
                    />
                    <Input
                      value={s.avg}
                      onChange={(e) => {
                        const next = [...scenarios];
                        next[i] = { ...next[i], avg: e.target.value };
                        setScenarios(next);
                      }}
                      placeholder="2.4"
                      className="text-right tabular-nums"
                    />
                    <Input
                      value={s.peak}
                      onChange={(e) => {
                        const next = [...scenarios];
                        next[i] = { ...next[i], peak: e.target.value };
                        setScenarios(next);
                      }}
                      placeholder="8.0"
                      className="text-right tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setScenarios(scenarios.filter((_, j) => j !== i))}
                      className="w-7 h-7 rounded border border-line-soft text-ink-mid text-[13px] hover:bg-bad-bg hover:text-bad hover:border-bad-border"
                      title="제거"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setScenarios([...scenarios, { name: '', avg: '', peak: '' }])}
                  className="h-8 px-3 border border-dashed border-line rounded text-[11.5px] text-ink-dark font-bold hover:bg-brand-tint hover:border-brand-dark"
                >
                  ＋ 시나리오 추가
                </button>
              </div>
            </FormField>

            <Row>
              <FormField label="예상 일간 호출량">
                <Input defaultValue="320,000" className="text-right tabular-nums" />
              </FormField>
              <FormField label="응답 SLA" info="그룹 표준에서 자동 적용 — 폼 입력 불필요">
                <div className="flex items-center gap-2 p-2 bg-ok-bg border border-ok-border rounded text-[11.5px] text-ok font-bold">
                  <span>✓</span>
                  P95 <b>800ms</b> · 가용성 <b>99.9%</b> (대고객 표준값)
                </div>
              </FormField>
            </Row>
          </SectionCard>

          {/* E. 평가 설계 */}
          <SectionCard
            letter="E"
            name="평가 설계"
            summary="골든셋 · 품질 게이트 · 휴먼 평가"
            tag="MVP"
            defaultOpen
          >
            <div className="mb-3 bg-brand-tint border border-brand-dark rounded p-2.5 text-[11.5px] text-ink">
              <b>품질 게이트 자동 동작</b> · 아래 임계값은 Stage 4 서빙계 프로모션 결재의 자동 게이트로 동작 ·
              미달 시 결재 차단. 골든셋 <b>{goldenMin}건</b> 이상이어야 Stage 3 진입 가능.
            </div>

            <FormField label="골든셋 데이터셋" required info="질문·정답 청크 페어">
              <div className="flex items-center gap-3 p-3 border border-ok-border rounded bg-white">
                <span className="w-8 h-8 rounded bg-ok-bg text-ok border border-ok-border inline-flex items-center justify-center text-sm">
                  📄
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-extrabold text-ink truncate">
                    goldset_compliance_v1.jsonl
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                    <b className="text-ok">{goldenCount}건</b> · 업로드 2026-05-22 · 윤지수
                  </div>
                </div>
                <Button variant="ghost">교체</Button>
              </div>
              <div className="text-[10.5px] text-ink-mid mt-1.5">
                최소 {goldenMin}건 충족 (<b className="text-ok">{goldenCount}건</b> / {goldenMin}건)
              </div>
            </FormField>

            <FormField label="품질 게이트 임계값" required>
              <table className="w-full border border-line-soft rounded overflow-hidden bg-white text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-surface-soft">
                    <th className="text-left py-2 px-3 font-extrabold text-[11px] text-ink-dark border-b border-line-soft">
                      지표
                    </th>
                    <th className="text-right py-2 px-3 font-extrabold text-[11px] text-ink-dark w-[110px] border-b border-line-soft">
                      베이스라인
                    </th>
                    <th className="text-right py-2 px-3 font-extrabold text-[11px] text-ink-dark w-[140px] border-b border-line-soft">
                      게이트 임계값
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    name="Recall@10"
                    desc="정답 청크 포함률"
                    baseline="0.82"
                    value={recall}
                    onChange={setRecall}
                  />
                  <MetricRow
                    name="MRR@10"
                    desc="평균 역순위"
                    baseline="0.61"
                    value={mrr}
                    onChange={setMrr}
                  />
                  <MetricRow
                    name="nDCG@10"
                    desc="정규화 누적 이득"
                    baseline="0.74"
                    value={ndcg}
                    onChange={setNdcg}
                    last
                  />
                </tbody>
              </table>
            </FormField>

            <FormField label="휴먼 평가 큐 사용" info="자동 평가 통과 후 별도 휴먼 검수 시 ON">
              <div className="flex gap-2">
                <RadioBox checked={humanEval} onChange={() => setHumanEval(true)} label="ON" />
                <RadioBox checked={!humanEval} onChange={() => setHumanEval(false)} label="OFF" />
              </div>
            </FormField>
          </SectionCard>

          {/* F. 비용 */}
          <SectionCard
            letter="F"
            name="모델·인프라 비용"
            summary="임베딩 · rerank · 서빙 자원"
            tag="MVP"
          >
            {usesCSP && (
              <div className="mb-3 bg-info-bg border border-info-border rounded p-2.5 text-[11.5px] text-info">
                <b>CSP 모델 포함</b> · 본 과제 결재선에 비용 결재 자동 묶임 · 혁신금융서비스 지정 서류 첨부 필수
              </div>
            )}

            <table className="w-full border border-line-soft rounded overflow-hidden bg-white text-xs border-separate border-spacing-0">
              <thead>
                <tr className="bg-surface-soft">
                  <th className="text-left py-2 px-3 font-extrabold text-[11px] text-ink-dark border-b border-line-soft">
                    모델
                  </th>
                  <th className="text-right py-2 px-3 font-extrabold text-[11px] text-ink-dark border-b border-line-soft w-[110px]">
                    단가
                  </th>
                  <th className="text-right py-2 px-3 font-extrabold text-[11px] text-ink-dark border-b border-line-soft w-[110px]">
                    월간 호출
                  </th>
                  <th className="text-right py-2 px-3 font-extrabold text-[11px] text-ink-dark border-b border-line-soft w-[130px]">
                    월간 비용
                  </th>
                </tr>
              </thead>
              <tbody>
                <CostRow
                  badgeTone="on-prem"
                  badge="on-prem"
                  name="e5-large-ko-1024d"
                  unit="GPU 분배"
                  calls="9.6M"
                  cost="₩ 0"
                />
                {usesCSP && (
                  <CostRow
                    badgeTone="csp"
                    badge="CSP"
                    name={rerankModel}
                    unit="₩ 0.4 / 콜"
                    calls="9.6M"
                    cost="₩ 3,840,000"
                  />
                )}
                <CostRow
                  badgeTone="infra"
                  badge="INFRA"
                  name="서빙 노드 GPU·메모리·스토리지"
                  unit="정책 단가"
                  calls="—"
                  cost="₩ 1,250,000"
                  last
                />
              </tbody>
              <tfoot>
                <tr className="bg-brand-tint">
                  <td className="py-2 px-3 font-extrabold text-ink text-[12px]" colSpan={3}>
                    월간 합계 (학습계 + 서빙계)
                  </td>
                  <td className="py-2 px-3 text-right font-extrabold text-ink text-[12px] tabular-nums">
                    ₩ {(usesCSP ? 5090000 : 1250000).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </SectionCard>

          {/* G. 거버넌스 (자동) */}
          <SectionCard
            letter="G"
            name="거버넌스·보안"
            summary="B·C 입력값으로부터 자동 매칭"
            tag="자동"
          >
            <div className="bg-brand-tint border border-brand-dark rounded p-3 space-y-1.5 text-[11.5px] text-ink-dark">
              <AutoLine>
                <b>인덱스 민감도 승계</b> · 선택한 인덱스 중 최고 등급{' '}
                <b>{maxSens || 1}등급</b> 자동 승계
              </AutoLine>
              <AutoLine>
                <b>적용 법규</b> · 신용정보법 · 개인정보보호법 · 전자금융감독규정 (자동 매핑)
              </AutoLine>
              <AutoLine>
                <b>마스킹·접근 제어</b> ·{' '}
                {maxSens >= 3
                  ? '민감도 ≥ 3 → 호출 측 SSO 인증 강제 · 응답 청크 PII 마스킹 자동 적용'
                  : '표준 정책 적용 (별도 강화 없음)'}
              </AutoLine>
              <AutoLine>
                <b>감사 로그</b> · 검색 쿼리·반환 청크·호출 Agent ID·SSO 사번 자동 기록 (8번 감사 원장)
              </AutoLine>
              <AutoLine>
                <b>보안 검토</b> ·{' '}
                {maxSens >= 3
                  ? '민감도 ≥ 3이므로 서빙계 프로모션 결재에 자동 추가'
                  : '자동 추가 없음'}
              </AutoLine>
            </div>
          </SectionCard>

          {/* H. 첨부 */}
          <SectionCard
            letter="H"
            name="문서 첨부"
            summary="자동 매칭에 따라 필수 항목이 늘어납니다"
            tag="MVP"
          >
            <div className="space-y-2">
              <AttachRow
                required={usesExternalIdx}
                name="인덱스 소유 과제 PM 동의 자료"
                cond="B에서 외부 과제 인덱스 사용 시 필수"
                attached={agreeAttached}
                onAttach={() => setAgreeAttached((v) => !v)}
              />
              <AttachRow
                name="골든셋 (CSV·JSONL)"
                cond="E에서 등록한 goldset_compliance_v1.jsonl 자동 연결"
                attached
                auto
              />
              <AttachRow
                required={usesCSP}
                name="혁신금융서비스 지정 서류"
                cond="F에서 CSP 모델 사용 시 필수"
                attached={innovDocAttached}
                onAttach={() => setInnovDocAttached((v) => !v)}
              />
              <AttachRow
                name="평가 리포트"
                cond="Stage 3 산출물 — 서빙계 프로모션 결재 시 자동 첨부"
                attached={false}
                disabled
                disabledLabel="Stage 3 이후"
              />
            </div>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <aside>
          <SidebarCard title="제출 전 체크">
            <div className="space-y-1.5 text-[11.5px]">
              <CheckRow label="A. 기본 정보" ok={Boolean(name.trim())} val="기본" />
              <CheckRow
                label="B. 인덱스 선택"
                ok={selectedIdx.size > 0}
                val={`${selectedIdx.size}건`}
              />
              <CheckRow label="C. 검색엔진 사양" ok={retrieval.size > 0} val={`${retrieval.size}방식`} />
              <CheckRow
                label="D. 소비 시나리오"
                ok={filledScenarios >= 3}
                val={`${filledScenarios}/3 행`}
              />
              <CheckRow
                label="E. 평가 설계"
                ok={goldenCount >= goldenMin}
                val={`${goldenCount}/${goldenMin}건`}
              />
              <CheckRow label="F. 비용" ok val={usesCSP ? 'CSP 포함' : 'on-prem'} />
              <CheckRow label="G. 거버넌스 (자동)" ok val={`민감도 ${maxSens || 1}`} />
              <CheckRow
                label="H. 첨부"
                ok={(!usesExternalIdx || agreeAttached) && (!usesCSP || innovDocAttached)}
                val={
                  (!usesExternalIdx || agreeAttached) && (!usesCSP || innovDocAttached)
                    ? '충족'
                    : '미흡'
                }
              />
            </div>
          </SidebarCard>

          <SidebarCard title="자동 결재선">
            <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.4px] mb-1.5">
              학습계 배포 (간이)
            </div>
            <div className="space-y-1.5 mb-3">
              <ApprStep seq="0" label="기안 — 프로젝트 오너 그룹" tone="draft" />
              <ApprStep seq="1" label="직속 상사" />
              {usesExternalIdx && (
                <ApprStep seq="2" label="인덱스 소유 PM 동의 확인" tone="auto" />
              )}
            </div>
            <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.4px] mb-1.5">
              서빙계 프로모션 (풀 · Stage 4)
            </div>
            <div className="space-y-1.5">
              <ApprStep seq="0" label="기안 — 프로젝트 오너 그룹" tone="draft" />
              <ApprStep seq="1" label="부서장" />
              <ApprStep seq="2" label="계열사 거버넌스" />
              <ApprStep
                seq="3"
                label={`품질 게이트 (R≥${recall}/M≥${mrr}/N≥${ndcg})`}
                tone="gate"
              />
              {maxSens >= 3 && <ApprStep seq="4" label="보안 검토" tone="auto" />}
              <ApprStep seq={maxSens >= 3 ? '5' : '4'} label="계열사 플랫폼 관리자" />
            </div>
          </SidebarCard>

          <SidebarCard title="월간 비용 요약">
            <div className="space-y-1.5 text-[11.5px]">
              <SumRow label="on-prem 임베딩" value="₩ 0" />
              {usesCSP && (
                <SumRow label="CSP rerank" value="₩ 3.84M" tone="purple" />
              )}
              <SumRow label="인프라" value="₩ 1.25M" />
              <div className="border-t border-line-soft pt-1.5 mt-1.5">
                <SumRow label="합계" value={`₩ ${(usesCSP ? 5.09 : 1.25).toFixed(2)}M`} bold />
              </div>
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
            결재 상신 전까지 자유롭게 저장 가능
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to={`/projects/${pid}`}>
              <Button variant="ghost">취소</Button>
            </Link>
            <Button>임시 저장</Button>
            <Button variant="primary" disabled={!requiredFilled || submitting} onClick={submit}>
              {submitting ? '기안 중…' : '학습계 배포 결재 상신 →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function StageItem({
  n,
  name,
  meta,
  active,
}: {
  n: number;
  name: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        'flex-1 flex items-center gap-2.5 px-3 py-2 rounded transition-colors text-left',
        active ? 'bg-brand-tint border border-brand-dark' : 'hover:bg-surface-soft',
      )}
    >
      <span
        className={cn(
          'w-6 h-6 rounded-full inline-flex items-center justify-center font-extrabold text-[11px] border-2 flex-shrink-0',
          active
            ? 'bg-brand border-brand-dark text-white'
            : 'bg-white border-line text-ink-mid',
        )}
      >
        {n}
      </span>
      <span className="flex flex-col leading-tight min-w-0">
        <span
          className={cn(
            'text-[12.5px] font-extrabold truncate',
            active ? 'text-ink' : 'text-ink-mid',
          )}
        >
          {name}
        </span>
        <span className="text-[10.5px] text-ink-mid font-semibold truncate">{meta}</span>
      </span>
    </button>
  );
}

function StageArrow() {
  return <span className="text-line text-sm px-0.5">›</span>;
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

function SensPill({ sens }: { sens: number }) {
  const tone =
    sens >= 4 ? 'bad' : sens === 3 ? 'warn' : sens === 2 ? 'info' : 'ok';
  return <StatusPill tone={tone as 'bad' | 'warn' | 'info' | 'ok'}>{sens}등급</StatusPill>;
}

function MetricRow({
  name,
  desc,
  baseline,
  value,
  onChange,
  last,
}: {
  name: string;
  desc: string;
  baseline: string;
  value: string;
  onChange: (v: string) => void;
  last?: boolean;
}) {
  return (
    <tr>
      <td className={cn('py-2 px-3', !last && 'border-b border-line-soft')}>
        <b>{name}</b> <span className="text-ink-mid text-[10.5px]">— {desc}</span>
      </td>
      <td
        className={cn(
          'py-2 px-3 text-right tabular-nums font-bold text-ink-dark',
          !last && 'border-b border-line-soft',
        )}
      >
        {baseline}
      </td>
      <td className={cn('py-2 px-3 text-right', !last && 'border-b border-line-soft')}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-right tabular-nums inline-block w-[90px] !py-1"
        />
      </td>
    </tr>
  );
}

function CostRow({
  badge,
  badgeTone,
  name,
  unit,
  calls,
  cost,
  last,
}: {
  badge: string;
  badgeTone: 'on-prem' | 'csp' | 'infra';
  name: string;
  unit: string;
  calls: string;
  cost: string;
  last?: boolean;
}) {
  const badgeClass = {
    'on-prem': 'bg-ok-bg text-ok border-ok-border',
    csp: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
    infra: 'bg-surface-soft text-ink-mid border-line-soft',
  }[badgeTone];
  return (
    <tr>
      <td className={cn('py-2 px-3', !last && 'border-b border-line-soft')}>
        <div className="flex items-center gap-2 font-bold text-ink">
          <span
            className={cn(
              'inline-flex items-center text-[10px] font-extrabold py-[1px] px-1.5 rounded-full border',
              badgeClass,
            )}
          >
            {badge}
          </span>
          {name}
        </div>
      </td>
      <td
        className={cn(
          'py-2 px-3 text-right tabular-nums text-ink-dark text-[11.5px]',
          !last && 'border-b border-line-soft',
        )}
      >
        {unit}
      </td>
      <td
        className={cn(
          'py-2 px-3 text-right tabular-nums text-ink-dark text-[11.5px]',
          !last && 'border-b border-line-soft',
        )}
      >
        {calls}
      </td>
      <td
        className={cn(
          'py-2 px-3 text-right tabular-nums font-extrabold text-ink',
          !last && 'border-b border-line-soft',
        )}
      >
        {cost}
      </td>
    </tr>
  );
}

function AttachRow({
  required,
  name,
  cond,
  attached,
  auto,
  disabled,
  disabledLabel,
  onAttach,
}: {
  required?: boolean;
  name: string;
  cond: string;
  attached: boolean;
  auto?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onAttach?: () => void;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[28px_1fr_90px_90px] gap-2.5 items-center p-2.5 border rounded text-[11.5px]',
        required && !attached
          ? 'border-bad-border bg-bad-bg/30'
          : 'border-line-soft bg-white',
      )}
    >
      <span className="w-6 h-6 rounded bg-surface inline-flex items-center justify-center text-ink-mid">
        📎
      </span>
      <div>
        <div className="font-extrabold text-ink">{name}</div>
        <div className="text-[10.5px] text-ink-mid font-medium mt-0.5">{cond}</div>
      </div>
      <span
        className={cn(
          'text-[10.5px] font-extrabold uppercase tracking-[0.3px]',
          attached ? 'text-ok' : disabled ? 'text-ink-mid' : 'text-bad',
        )}
      >
        {disabled ? disabledLabel : auto ? '자동' : attached ? '첨부됨' : '미첨부'}
      </span>
      <button
        disabled={disabled || auto}
        onClick={onAttach}
        className={cn(
          'h-7 px-2.5 rounded border text-[11px] font-bold',
          disabled || auto
            ? 'border-line-soft bg-surface text-ink-light cursor-not-allowed'
            : attached
            ? 'border-line bg-white text-ink-dark hover:bg-surface'
            : 'border-brand-dark bg-brand text-white font-extrabold hover:bg-brand-dark',
        )}
      >
        {auto ? '미리보기' : attached ? '교체' : '＋ 업로드'}
      </button>
    </div>
  );
}

function AutoLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 leading-snug">
      <span className="text-brand-dark text-[9px] mt-[5px]">●</span>
      <span>{children}</span>
    </div>
  );
}

function CheckRow({ label, ok, val }: { label: string; ok: boolean; val: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-dashed border-line-soft last:border-b-0">
      <span className="flex items-center gap-2 text-ink-dark font-semibold">
        <span
          className={cn(
            'w-3.5 h-3.5 rounded inline-flex items-center justify-center text-[9px] font-extrabold',
            ok ? 'bg-ok text-white' : 'bg-bad-bg text-bad border border-bad-border',
          )}
        >
          {ok ? '✓' : '!'}
        </span>
        {label}
      </span>
      <span
        className={cn(
          'text-[10.5px] font-bold',
          ok ? 'text-ok' : 'text-bad',
        )}
      >
        {val}
      </span>
    </div>
  );
}

function ApprStep({
  seq,
  label,
  tone = 'normal',
}: {
  seq: string;
  label: string;
  tone?: 'normal' | 'draft' | 'auto' | 'gate';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded border',
        tone === 'draft' && 'bg-surface-soft border-line-soft',
        tone === 'auto' && 'bg-warn-bg border-warn-border',
        tone === 'gate' && 'bg-bad-bg border-bad-border',
        tone === 'normal' && 'bg-white border-line-soft',
      )}
    >
      <span className="w-5 h-5 rounded-full bg-white border border-line inline-flex items-center justify-center text-[10px] font-extrabold text-ink-dark flex-shrink-0">
        {seq}
      </span>
      <span
        className={cn(
          'text-[11px] font-bold',
          tone === 'gate' ? 'text-bad' : 'text-ink-dark',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function SumRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: 'purple';
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-ink-mid', bold && 'font-extrabold text-ink')}>{label}</span>
      <span
        className={cn(
          'font-bold tabular-nums',
          tone === 'purple' && 'text-accent-purple',
          bold && 'font-extrabold text-ink text-[13px]',
        )}
      >
        {value}
      </span>
    </div>
  );
}
