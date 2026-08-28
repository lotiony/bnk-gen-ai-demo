/**
 * 관리 콘솔 — 모델 관리.
 *
 * RFP: LSM-001 필수 모델 관리 (필수) · LSM-004 API 기반 외부 서빙 (필수)
 * 연계: LSM-002(다중 LLM) · LSM-008(쿼터) · LSM-009(승인 배포) · ONM-002(Gateway) ·
 *       SEC-001(테넌트 격리) · AGB-011(배포 이력)
 *
 * 이 화면이 생기기 전까지 모델은 세 화면에 흩어져 있었다 — 현황은 통합 대시보드,
 * 라우팅은 LLM Gateway, 자원 사용량은 과제 상세. 셋 다 **조회**라서
 * "등록하고 버전을 올리고 폐기하는 곳"이 없었고, 그래서 LSM-001 과 LSM-004 가
 * 함께 비어 있었다. 두 요건을 한 화면에서 답한다.
 *
 * 화면은 세 질문에 순서대로 답한다.
 *   ① 무엇이 등록되어 있는가 — 오픈소스와 자체 파인튜닝이 같은 원장에 있는가(LSM-001)
 *   ② 버전을 어떻게 올리고 되돌리는가 — 승인 없이 서빙 버전이 바뀌지 않는가(LSM-009)
 *   ③ 계열사 레거시가 어떻게 호출하는가 — 그 호출도 통제를 받는가(LSM-004)
 *
 * ⚠️ 모델 목록은 `mockLlmGateway.MODEL_POOL` 파생이다. 여기서 모델을 새로 선언하면
 *    Gateway 화면과 Chat 모델 선택기가 서로 다른 모델을 말하게 된다.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import {
  REGISTRY_MODELS,
  MODEL_STATE_TONE,
  RETIRE_RULE,
  REGISTER_STEPS,
  SERVING_ENDPOINTS,
  API_CLIENTS,
  CLIENT_STATE_TONE,
  EXTERNAL_SLOT,
  EXTERNAL_CALL_NOTE,
  maskKey,
  type RegistryModel,
  type ModelState,
} from '@/data/mockModelRegistry';

type Tab = 'catalog' | 'versions' | 'api';

const TABS: { k: Tab; label: string; req: string }[] = [
  { k: 'catalog', label: '모델 목록', req: 'LSM-001' },
  { k: 'versions', label: '버전 · 배포', req: 'LSM-009' },
  { k: 'api', label: '외부 서빙 API', req: 'LSM-004' },
];

export default function AdminModelsPage() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [registering, setRegistering] = useState(false);
  /** 상태 전이는 메모리에서만 일어난다(브라우저 스토리지 금지 규칙). */
  const [stateOverride, setStateOverride] = useState<Record<string, ModelState>>({});
  const [selected, setSelected] = useState<string>(REGISTRY_MODELS[0].id);

  const models = useMemo(
    () => REGISTRY_MODELS.map((m) => ({ ...m, state: stateOverride[m.id] ?? m.state })),
    [stateOverride],
  );

  const stats = useMemo(() => {
    const serving = models.filter((m) => m.state === '서빙 중').length;
    const tuned = models.filter((m) => m.origin === '자체 파인튜닝').length;
    const keys = API_CLIENTS.filter((c) => c.state !== '정지').length;
    return { serving, tuned, keys };
  }, [models]);

  const setState = (m: RegistryModel, next: ModelState, msg: string) => {
    setStateOverride((s) => ({ ...s, [m.id]: next }));
    toast(msg, `${m.name} · 감사 원장 기록됨`, next === '폐기' ? 'warn' : 'ok');
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">모델 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            오픈소스와 자체 파인튜닝 모델을 하나의 원장에서 등록·버전 관리·폐기하고, 계열사 레거시가
            호출할 표준 인터페이스를 같은 화면에서 발급한다
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0 mt-1">
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            LSM-001
          </span>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            LSM-004
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard
          label="등록 모델"
          value={String(models.length)}
          unit="종"
          sub="오픈소스 · 자체 파인튜닝 통합 원장"
          tone="ok"
        />
        <KpiCard
          label="서빙 중"
          value={String(stats.serving)}
          unit="종"
          sub="Gateway 라우팅 대상"
          tone="ok"
        />
        <KpiCard
          label="자체 파인튜닝"
          value={String(stats.tuned)}
          unit="종"
          sub="계열사 소유 · 공개범위 통제"
          tone="ok"
        />
        <KpiCard
          label="발급 API 키"
          value={String(stats.keys)}
          unit="건"
          sub="계열사 레거시 시스템 호출"
          tone="warn"
        />
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-line-soft">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3 py-2 text-[12px] font-extrabold border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5',
              tab === t.k
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-mid hover:text-ink-dark',
            )}
          >
            {t.label}
            <span className="pill bg-white text-ink-light border border-line font-mono tracking-normal rfp-chip text-[9px]">
              {t.req}
            </span>
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <CatalogTab
          models={models}
          onRegister={() => setRegistering(true)}
          onState={setState}
        />
      )}
      {tab === 'versions' && (
        <VersionsTab models={models} selected={selected} onSelect={setSelected} />
      )}
      {tab === 'api' && <ApiTab />}

      {registering && <RegisterModal onClose={() => setRegistering(false)} />}
    </div>
  );
}

/* ═══════════════════════ ① 모델 목록 ═══════════════════════ */

function CatalogTab({
  models,
  onRegister,
  onState,
}: {
  models: RegistryModel[];
  onRegister: () => void;
  onState: (m: RegistryModel, next: ModelState, msg: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
          <h2 className="text-[13px] font-extrabold text-ink">등록 모델 원장</h2>
          <span className="text-[10.5px] text-ink-light font-semibold">
            오픈소스 · 자체 파인튜닝을 같은 원장에서 관리한다
          </span>
          <button
            type="button"
            onClick={onRegister}
            className="ml-auto h-7 px-3 rounded bg-brand border border-brand-dark text-white text-[11.5px] font-extrabold hover:bg-brand-dark"
          >
            ＋ 모델 등록
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft border-b border-line">
                {['모델', '계열', '규격', '서빙', '소유 · 공개범위', '상태', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-[9.5px] font-extrabold uppercase tracking-[0.4px] text-ink-light whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-line-soft last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[11px] font-bold text-ink-dark">{m.name}</div>
                    <div className="text-[10px] text-ink-light font-semibold mt-0.5">
                      {m.role}
                      {m.baseModel && (
                        <>
                          {' · 기반 '}
                          <span className="font-mono">{m.baseModel}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusPill tone={m.origin === '자체 파인튜닝' ? 'info' : 'neutral'}>
                      {m.origin}
                    </StatusPill>
                    <div className="text-[9.5px] text-ink-light font-semibold mt-1">{m.license}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-mid font-semibold">
                    {m.params} · {m.contextLen}
                    <div className="text-[9.5px] text-ink-light">{m.quantization}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-mid font-semibold">
                    {m.serving}
                    <div className="text-[9.5px] text-ink-light">{m.gpu}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-bold text-ink-dark">{TENANT_SHORT[m.owner] ?? m.owner}</span>
                    <div className="text-[9.5px] text-ink-light font-semibold mt-0.5">
                      공개범위 {m.scope}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusPill tone={MODEL_STATE_TONE[m.state]}>{m.state}</StatusPill>
                    <div className="text-[9.5px] text-ink-light font-semibold mt-1">
                      등록 {m.registeredAt}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    {m.state === '폐기' ? (
                      <span className="text-[10px] text-ink-light font-semibold">라우팅 제외됨</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        {m.state === '중지' ? (
                          <button
                            type="button"
                            onClick={() => onState(m, '서빙 중', '서빙을 재개했습니다')}
                            className="pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand"
                          >
                            재개
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onState(m, '중지', '서빙을 중지했습니다')}
                            className="pill bg-white text-ink-dark border border-line hover:border-warn hover:text-warn"
                          >
                            중지
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onState(m, '폐기', '모델을 폐기 처리했습니다')}
                          className="pill bg-white text-ink-light border border-line hover:border-bad hover:text-bad"
                        >
                          폐기
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-[12px] font-extrabold text-ink">삭제 대신 폐기</h3>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
            SEC-009 · AGB-011
          </span>
        </div>
        <p className="text-[11px] text-ink-mid font-semibold leading-relaxed">{RETIRE_RULE}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ ② 버전 · 배포 ═══════════════════════ */

function VersionsTab({
  models,
  selected,
  onSelect,
}: {
  models: RegistryModel[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const model = models.find((m) => m.id === selected) ?? models[0];

  return (
    <div className="grid grid-cols-[260px_1fr] gap-3">
      <div className="card p-0 overflow-hidden self-start">
        <div className="px-3.5 py-2.5 border-b border-line-soft">
          <h2 className="text-[12px] font-extrabold text-ink">모델 선택</h2>
        </div>
        <ul>
          {models.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={cn(
                  'w-full text-left px-3.5 py-2.5 border-b border-line-soft last:border-0 transition-colors',
                  m.id === selected ? 'bg-brand-tint' : 'hover:bg-surface-soft',
                )}
              >
                <div className="font-mono text-[10.5px] font-bold text-ink-dark truncate">
                  {m.name}
                </div>
                <div className="text-[9.5px] text-ink-light font-semibold mt-0.5">
                  버전 {m.versions.length}개 · 현재 {m.versions.find((v) => v.current)?.v ?? '—'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-extrabold text-ink font-mono">{model.name}</h2>
          <StatusPill tone={MODEL_STATE_TONE[model.state]}>{model.state}</StatusPill>
          <span className="ml-auto text-[10.5px] text-ink-light font-semibold">
            서빙 버전 변경은 승인 결재를 거친다
          </span>
        </div>

        <ol className="flex flex-col">
          {model.versions.map((v, i) => (
            <li key={v.v} className="flex gap-3">
              {/* 타임라인 축 */}
              <div className="flex flex-col items-center flex-shrink-0 w-4">
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full mt-1.5 border-2',
                    v.current ? 'bg-brand border-brand' : 'bg-white border-line-2',
                  )}
                />
                {i < model.versions.length - 1 && <span className="flex-1 w-px bg-line-soft" />}
              </div>
              <div className="pb-4 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] font-extrabold text-ink-dark">{v.v}</span>
                  {v.current && (
                    <span className="pill bg-brand-tint text-brand border border-brand-tint">
                      현재 서빙
                    </span>
                  )}
                  <span className="text-[10px] text-ink-light font-semibold">{v.at}</span>
                  {!v.current && (
                    <button
                      type="button"
                      onClick={() =>
                        toast(
                          `${v.v} 로 롤백을 상신했습니다`,
                          `${model.name} · 서빙계 배포 결재 대기`,
                          'warn',
                        )
                      }
                      className="ml-auto pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand"
                    >
                      이 버전으로 롤백 상신
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-ink-mid font-semibold mt-1 leading-relaxed">
                  {v.note}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-2 pt-3 border-t border-line-soft flex items-center gap-2">
          <span className="text-[10.5px] text-ink-mid font-semibold">
            롤백·승격은 서빙계 배포 결재로 이어진다
          </span>
          <Link
            to="/approvals"
            className="ml-auto text-[11px] font-extrabold text-info hover:underline"
          >
            전역 결재함 →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ ③ 외부 서빙 API ═══════════════════════ */

function ApiTab() {
  const [issuing, setIssuing] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* 엔드포인트 */}
      <div className="grid grid-cols-2 gap-2.5">
        {SERVING_ENDPOINTS.map((e) => (
          <div key={e.protocol} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="pill bg-info-bg text-info border border-info-border font-mono tracking-normal">
                {e.protocol}
              </span>
              <span className="text-[10.5px] text-ink-light font-semibold">{e.spec}</span>
            </div>
            <div className="font-mono text-[11px] font-bold text-ink-dark break-all bg-surface-soft border border-line-soft rounded px-2.5 py-2">
              {e.url}
            </div>
            <p className="text-[10.5px] text-ink-mid font-semibold mt-2 leading-relaxed">{e.note}</p>
          </div>
        ))}
      </div>

      {/* 발급 키 */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
          <h2 className="text-[13px] font-extrabold text-ink">발급 키 · 호출 시스템</h2>
          <span className="text-[10.5px] text-ink-light font-semibold">
            키마다 허용 모델 · RPS 상한 · 소스 IP 를 따로 건다
          </span>
          <button
            type="button"
            onClick={() => setIssuing(true)}
            className="ml-auto h-7 px-3 rounded bg-brand border border-brand-dark text-white text-[11.5px] font-extrabold hover:bg-brand-dark"
          >
            ＋ 키 발급 신청
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft border-b border-line">
                {['호출 시스템', '계열사', '프로토콜', '키', '허용 모델', 'RPS', '소스 IP', '금일 호출', '상태'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-[9.5px] font-extrabold uppercase tracking-[0.4px] text-ink-light whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {API_CLIENTS.map((c) => (
                <tr key={c.id} className="border-b border-line-soft last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-ink-dark">{c.system}</div>
                    <div className="text-[9.5px] text-ink-light font-semibold mt-0.5 font-mono">
                      {c.id} · 만료 {c.expiresAt}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-ink-mid">
                    {TENANT_SHORT[c.tenant] ?? c.tenant}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
                      {c.protocol}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[10.5px] text-ink-mid">
                    {maskKey(c.key)}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.models.map((m) => (
                      <div key={m} className="font-mono text-[10px] text-ink-mid font-semibold">
                        {m}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-ink-dark">
                    {c.rps}/s
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[10.5px] text-ink-mid">
                    {c.sourceIp}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-ink-dark">
                    {c.callsToday.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusPill tone={CLIENT_STATE_TONE[c.state]}>{c.state}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 통제 서사 */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-[12px] font-extrabold text-ink">외부 호출도 같은 4단을 지난다</h3>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
              ONM-002 · LSM-008
            </span>
          </div>
          <p className="text-[11px] text-ink-mid font-semibold leading-relaxed">
            {EXTERNAL_CALL_NOTE}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-[12px] font-extrabold text-ink">{EXTERNAL_SLOT.name}</h3>
            <StatusPill tone="neutral">{EXTERNAL_SLOT.status}</StatusPill>
          </div>
          <p className="text-[11px] text-ink-mid font-semibold leading-relaxed">
            {EXTERNAL_SLOT.note}
          </p>
        </div>
      </div>

      {issuing && (
        <SimpleModal title="API 키 발급 신청" onClose={() => setIssuing(false)}>
          <p className="text-[11.5px] text-ink-mid font-semibold leading-relaxed">
            키 발급은 신청 즉시 열리지 않는다. 호출 시스템 · 대상 모델 · RPS 상한 · 소스 IP 를 적어
            기안하면, 계열사 승인과 플랫폼 운영 승인을 거쳐 발급된다. 발급된 키는 화면에 다시
            표시되지 않으며 최초 1회만 신청자에게 전달된다.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link to="/approvals" className="text-[11px] font-extrabold text-info hover:underline">
              전역 결재함에서 진행 상태 확인 →
            </Link>
            <button
              type="button"
              onClick={() => {
                toast('키 발급을 상신했습니다', '계열사 승인 → 플랫폼 운영 승인', 'warn');
                setIssuing(false);
              }}
              className="ml-auto h-8 px-4 rounded bg-brand border border-brand-dark text-white text-[11.5px] font-extrabold hover:bg-brand-dark"
            >
              발급 상신
            </button>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

/* ═══════════════════════ 모델 등록 ═══════════════════════ */

function RegisterModal({ onClose }: { onClose: () => void }) {
  return (
    <SimpleModal title="모델 등록" onClose={onClose} req="LSM-001 · LSM-009">
      <p className="text-[11.5px] text-ink-mid font-semibold leading-relaxed mb-3">
        등록은 목록에 줄을 추가하는 것이 아니라 반입 검사와 승인을 거치는 절차다. 라이선스 적합성과
        학습 데이터 비식별이 확인되지 않으면 서빙 단계로 넘어가지 않는다.
      </p>
      <ol className="flex flex-col gap-2">
        {REGISTER_STEPS.map((s) => (
          <li
            key={s.step}
            className="border border-line-soft rounded px-3 py-2.5 bg-surface-soft flex gap-3"
          >
            <span className="text-[11.5px] font-extrabold text-ink-dark whitespace-nowrap">
              {s.step}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] font-extrabold text-brand">{s.owner}</span>
              <span className="block text-[10.5px] text-ink-mid font-semibold leading-relaxed mt-0.5">
                {s.note}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-2">
        <Link to="/admin/intake" className="text-[11px] font-extrabold text-info hover:underline">
          반입 승인 화면으로 →
        </Link>
        <button
          type="button"
          onClick={() => {
            toast('모델 등록을 기안했습니다', '반입 검사 대기 · 검사 통과 후 검증 트래픽', 'warn');
            onClose();
          }}
          className="ml-auto h-8 px-4 rounded bg-brand border border-brand-dark text-white text-[11.5px] font-extrabold hover:bg-brand-dark"
        >
          등록 기안
        </button>
      </div>
    </SimpleModal>
  );
}

function SimpleModal({
  title,
  req,
  children,
  onClose,
}: {
  title: string;
  req?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div className="card w-[620px] max-h-[84vh] overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2 sticky top-0 bg-white">
          <h3 className="text-[13px] font-extrabold text-ink">{title}</h3>
          {req && (
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
              {req}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[12px] text-ink-light hover:text-ink-dark font-extrabold"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-3.5">{children}</div>
      </div>
    </div>
  );
}
