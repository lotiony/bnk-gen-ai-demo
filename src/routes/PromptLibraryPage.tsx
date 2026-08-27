/**
 * AI Studio — 프롬프트 라이브러리.
 *
 * RFP: RAG-001 (필수) "RAG 아키텍처 작동 시 검색된 컨텍스트와 결합하는 필수
 *      시스템 프롬프트의 템플릿화, 버전 관리 및 중앙 제어 기능"
 *
 * 마켓플레이스의 PRM-* 프롬프트 자산과 **같은 자산**이다(mockPrompts 가
 * CATALOG_PROMPTS 리터럴을 조회한다). 카탈로그는 전시·공유를, 여기는
 * 저작·버전·중앙 제어를 담당한다.
 *
 * 버전 규약 — versions[0] 이 최신이며 serving 은 항상 하나다. 롤백은 이력을
 * 지우지 않고 과거 본문을 새 버전으로 복제해 올린다(감사 추적 유지).
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import { TENANT_SHORT } from '@/data/tenants';
import type { Tenant } from '@/data/tenants';
import { usePromptTemplates, publishVersion, rollbackTo } from '@/lib/promptStore';
import type { PromptTemplate } from '@/data/mockPrompts';

export default function PromptLibraryPage() {
  const templates = usePromptTemplates();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '');
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">프롬프트 라이브러리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            RAG 시스템 프롬프트를 템플릿으로 관리한다 — 버전 이력 · 롤백 · 중앙 제어
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal flex-shrink-0 mt-1">
          RAG-001
        </span>
      </div>

      {/* 중앙 제어 안내 */}
      <div className="border border-line bg-surface-soft rounded px-3.5 py-2.5 mb-3.5">
        <div className="text-[11.5px] font-extrabold text-ink mb-0.5">
          서빙 버전이 곧 시스템 프롬프트다
        </div>
        <p className="text-[11px] text-ink-dark font-semibold leading-snug">
          중앙 제어 템플릿의 새 버전을 배포하면 전 Namespace 의 RAG 호출에 즉시 반영된다.
          에이전트 코드는 프롬프트 본문을 갖지 않고 <b>템플릿 ID 만 참조</b>한다 —
          그래야 프롬프트 수정이 배포 없이 중앙에서 끝난다. 마켓플레이스의 프롬프트 자산과 같은 자산이다.
        </p>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-3.5 items-start">
        {/* 좌: 템플릿 목록 */}
        <div className="flex flex-col gap-1.5">
          {templates.map((t) => {
            const serving = t.versions.find((v) => v.status === 'serving');
            const on = t.id === selected?.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  'text-left card px-3.5 py-3 transition-colors',
                  on ? 'border-brand-dark bg-brand-bg' : 'hover:border-brand-dark',
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-mono font-bold text-ink-light">{t.id}</span>
                  <span className="pill bg-surface-soft text-ink-mid border border-line-soft">
                    {TENANT_SHORT[t.tenant as Tenant] ?? t.tenant}
                  </span>
                  {t.centralControl && (
                    <span className="pill bg-brand-tint text-brand border border-brand-tint">중앙 제어</span>
                  )}
                </div>
                <div className="text-[12.5px] font-extrabold text-ink leading-tight">{t.name}</div>
                <div className="text-[10px] text-ink-mid font-semibold mt-1">
                  서빙 <b className="text-ink-dark">{serving?.ver}</b> · 버전 {t.versions.length}개 · {t.owner}
                </div>
              </button>
            );
          })}
        </div>

        {/* 우: 상세 */}
        {selected && <TemplateDetail key={selected.id} tpl={selected} />}
      </div>
    </div>
  );
}

function TemplateDetail({ tpl }: { tpl: PromptTemplate }) {
  const persona = useCurrentPersona();
  const me = persona?.name ?? '사용자';
  const serving = tpl.versions.find((v) => v.status === 'serving') ?? tpl.versions[0];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  const startEdit = () => {
    setDraft(serving.body);
    setNote('');
    setEditing(true);
  };
  const publish = () => {
    if (!draft.trim()) return;
    publishVersion(tpl.id, draft, note.trim(), me);
    setEditing(false);
    toast(
      tpl.centralControl
        ? `${tpl.id} 새 버전 배포 — 전 Namespace 에 즉시 반영됩니다`
        : `${tpl.id} 새 버전 배포 완료`,
    );
  };
  const rollback = (ver: string) => {
    rollbackTo(tpl.id, ver, me);
    toast(`${tpl.id} · ${ver} 본문으로 롤백 — 새 버전으로 서빙에 올렸습니다`);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 */}
      <section className="card px-4 py-3.5">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-[11px] font-mono font-bold text-ink-light">{tpl.id}</span>
          <h2 className="text-[15px] font-extrabold text-ink">{tpl.name}</h2>
          {tpl.centralControl && (
            <span className="pill bg-brand-tint text-brand border border-brand-tint">
              중앙 제어 — 배포 시 전 Namespace 반영
            </span>
          )}
          <span className="ml-auto text-[10.5px] text-ink-mid font-semibold">
            {tpl.owner} · <span className="font-mono">{tpl.model}</span>
          </span>
        </div>
        <p className="text-[11.5px] text-ink-mid font-semibold leading-snug mb-2">{tpl.description}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">소비처</span>
          {tpl.usedBy.length === 0 ? (
            <span className="text-[10.5px] text-ink-light font-semibold">아직 참조하는 에이전트 없음</span>
          ) : (
            tpl.usedBy.map((u) => (
              <span key={u} className="pill bg-white text-ink-dark border border-line">{u}</span>
            ))
          )}
        </div>
      </section>

      {/* 서빙 본문 / 편집 */}
      <section className="card">
        <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
          <h3 className="text-[13px] font-extrabold text-ink">
            서빙 중 본문 · <span className="text-brand">{serving.ver}</span>
          </h3>
          <span className="text-[10.5px] text-ink-mid font-semibold">
            {serving.at} · {serving.by}
          </span>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="ml-auto h-7 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
            >✎ 새 버전 작성</button>
          )}
        </div>
        {editing ? (
          <div className="p-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full resize-y border border-line rounded px-3 py-2.5 font-mono text-[11.5px] leading-[1.65] text-ink-dark bg-white outline-none focus:border-brand-dark"
            />
            <div className="flex items-center gap-2 mt-2.5">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="변경 메모 — 무엇을 왜 바꿨는지 (버전 이력에 남습니다)"
                className="flex-1 h-8 px-2.5 border border-line rounded text-[11.5px] bg-white focus:outline-none focus:border-brand-dark"
              />
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-8 px-3 bg-white border border-line rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface"
              >취소</button>
              <button
                type="button"
                onClick={publish}
                disabled={!draft.trim()}
                className="h-8 px-3.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-45"
              >{tpl.centralControl ? '배포 — 전 Namespace 반영' : '새 버전 배포'}</button>
            </div>
          </div>
        ) : (
          <pre className="px-4 py-3.5 text-[11.5px] font-mono leading-[1.7] text-ink-dark whitespace-pre-wrap overflow-x-auto">
            {serving.body}
          </pre>
        )}
      </section>

      {/* 버전 이력 */}
      <section className="card px-4 py-3.5">
        <h3 className="text-[13px] font-extrabold text-ink mb-2.5">
          버전 이력 <span className="text-[11px] text-ink-mid font-semibold">· 롤백은 이력을 지우지 않고 새 버전으로 쌓인다</span>
        </h3>
        <ul className="space-y-0">
          {tpl.versions.map((v, i) => (
            <li key={v.ver} className="flex gap-2.5">
              <div className="flex flex-col items-center flex-shrink-0 w-5">
                <span
                  className={cn(
                    'w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[8.5px] font-extrabold',
                    v.status === 'serving' ? 'bg-brand text-white' : 'bg-surface-soft text-ink-mid border border-line',
                  )}
                >{v.ver.replace('v', '')}</span>
                {i < tpl.versions.length - 1 && <span className="w-px flex-1 bg-line-soft my-0.5" />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11.5px] font-extrabold text-ink">{v.ver}</span>
                  {v.status === 'serving' ? (
                    <span className="pill bg-ok-bg text-ok border border-ok-border">서빙 중</span>
                  ) : (
                    <span className="pill bg-surface-soft text-ink-light border border-line-soft">보관</span>
                  )}
                  <span className="text-[10.5px] text-ink-mid font-semibold">{v.at} · {v.by}</span>
                  {v.status !== 'serving' && (
                    <button
                      type="button"
                      onClick={() => rollback(v.ver)}
                      className="ml-auto h-6 px-2 border border-line rounded text-[10.5px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
                    >↺ 이 버전으로 롤백</button>
                  )}
                </div>
                <div className="text-[11px] text-ink-dark font-semibold mt-0.5">{v.changeNote}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
