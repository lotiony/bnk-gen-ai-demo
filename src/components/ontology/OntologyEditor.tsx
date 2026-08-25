/**
 * 온톨로지 편집 도구 — 그래프 설계 탭의 우측 패널.
 *
 * 원본(kt Ontology Platform)의 클래스/관계/속성 편집 · TTL 내보내기 · Import 를
 * 옮겼다. 편집은 전부 메모리 스토어에 반영되고 그래프가 즉시 다시 그려진다.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useOntology,
  addClass,
  removeClass,
  addAttr,
  removeAttr,
  addRelation,
  removeRelation,
  downloadTurtle,
  toTurtle,
  importTurtle,
  resetOntology,
  type ImportResult,
} from '@/lib/ontologyStore';
import type { OntologyClass } from '@/data/ontology';

type Pane = 'detail' | 'add' | 'ttl' | 'import';

export default function OntologyEditor({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (n: string | null) => void;
}) {
  const { classes, relations } = useOntology();
  const [pane, setPane] = useState<Pane>('detail');
  const cls = classes.find((c) => c.name === selected) ?? null;

  return (
    <div className="border border-line-soft rounded bg-white h-[560px] flex flex-col">
      <div className="flex items-center border-b border-line-soft">
        {(
          [
            ['detail', '상세'],
            ['add', '추가'],
            ['ttl', 'TTL'],
            ['import', 'Import'],
          ] as [Pane, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPane(k)}
            className={cn(
              'flex-1 py-2 text-[11px] font-extrabold border-b-2 -mb-px',
              pane === k ? 'border-brand text-brand' : 'border-transparent text-ink-mid hover:text-ink-dark',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {pane === 'detail' && <Detail cls={cls} relations={relations} onSelect={onSelect} />}
        {pane === 'add' && <AddPane classes={classes} />}
        {pane === 'ttl' && <TtlPane />}
        {pane === 'import' && <ImportPane />}
      </div>

      <div className="border-t border-line-soft px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-ink-mid font-semibold">
          클래스 {classes.length} · 관계 {relations.length}
        </span>
        <button type="button" onClick={resetOntology} className="text-[10px] font-bold text-ink-mid hover:text-brand">
          초기화
        </button>
      </div>
    </div>
  );
}

/* ── 상세 · 속성/관계 편집 ── */
function Detail({
  cls,
  relations,
  onSelect,
}: {
  cls: OntologyClass | null;
  relations: ReturnType<typeof useOntology>['relations'];
  onSelect: (n: string | null) => void;
}) {
  const [attr, setAttr] = useState('');
  if (!cls)
    return (
      <div className="text-[11.5px] text-ink-mid font-semibold text-center pt-16 leading-relaxed">
        그래프에서 클래스를 클릭하면
        <br />
        속성·관계를 편집할 수 있습니다
      </div>
    );
  const rels = relations.filter((r) => r.domain === cls.name || r.range === cls.name);
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-ink truncate">{cls.name}</div>
          <div className="text-[10px] font-mono text-ink-mid">{cls.uri}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`'${cls.name}' 클래스와 연결된 관계를 함께 삭제합니다. 진행할까요?`)) {
              removeClass(cls.uri);
              onSelect(null);
            }
          }}
          className="text-[10px] font-bold text-bad hover:underline flex-shrink-0"
        >
          삭제
        </button>
      </div>
      <div className="mt-1.5 flex gap-1 flex-wrap">
        <span className="pill bg-surface text-ink-mid border border-line-soft">{cls.axis}</span>
        {cls.parent && <span className="pill bg-info-bg text-info border border-info-border">상위 {cls.parent}</span>}
      </div>

      <div className="mt-3 text-[10px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">속성 {cls.attrs.length}</div>
      <ul className="mt-1 space-y-0.5">
        {cls.attrs.map((a) => (
          <li key={a} className="flex items-center gap-1.5 text-[11px] text-ink-dark font-semibold group">
            <span className="flex-1 truncate">· {a}</span>
            <button type="button" onClick={() => removeAttr(cls.uri, a)} className="text-ink-light hover:text-bad opacity-0 group-hover:opacity-100">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-1.5 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (attr.trim()) {
            addAttr(cls.uri, attr.trim());
            setAttr('');
          }
        }}
      >
        <input
          value={attr}
          onChange={(e) => setAttr(e.target.value)}
          placeholder="속성 추가"
          className="flex-1 min-w-0 border border-line rounded px-2 py-1 text-[11px]"
        />
        <button type="submit" className="px-2 bg-brand text-white rounded text-[11px] font-extrabold">
          ＋
        </button>
      </form>

      <div className="mt-3 text-[10px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">관계 {rels.length}</div>
      <ul className="mt-1 space-y-1">
        {rels.map((r) => (
          <li key={r.uri} className="flex items-center gap-1.5 text-[10.5px] text-ink-dark font-semibold group">
            <span className="flex-1 min-w-0 truncate">
              {r.domain} <b className="text-brand">{r.name}</b> {r.range}
            </span>
            <button type="button" onClick={() => removeRelation(r.uri)} className="text-ink-light hover:text-bad opacity-0 group-hover:opacity-100">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── 클래스·관계 추가 ── */
function AddPane({ classes }: { classes: OntologyClass[] }) {
  const [cname, setCname] = useState('');
  const [rel, setRel] = useState({ name: '', domain: classes[0]?.name ?? '', range: classes[1]?.name ?? '' });
  const [msg, setMsg] = useState('');

  const uriOf = (n: string) => 'bnk:' + n.replace(/[^\w가-힣]/g, '') + Math.random().toString(36).slice(2, 5);

  return (
    <>
      <div className="text-[10px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">클래스 추가</div>
      <form
        className="mt-1.5 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!cname.trim()) return;
          const n = classes.length;
          addClass({ name: cname.trim(), uri: uriOf(cname.trim()), axis: 'credit', parent: null, attrs: [], col: n % 8, row: Math.floor(n / 8) });
          setMsg(`클래스 '${cname.trim()}' 추가됨`);
          setCname('');
        }}
      >
        <input value={cname} onChange={(e) => setCname(e.target.value)} placeholder="클래스명" className="flex-1 min-w-0 border border-line rounded px-2 py-1 text-[11px]" />
        <button type="submit" className="px-2.5 bg-brand text-white rounded text-[11px] font-extrabold">
          추가
        </button>
      </form>

      <div className="mt-4 text-[10px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">관계 추가</div>
      <form
        className="mt-1.5 space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rel.name.trim() || rel.domain === rel.range) {
            setMsg('관계명이 필요하고 도메인·레인지가 달라야 합니다');
            return;
          }
          addRelation({ name: rel.name.trim(), uri: uriOf(`${rel.name}_${rel.domain}_${rel.range}`), domain: rel.domain, range: rel.range });
          setMsg(`관계 '${rel.name.trim()}' 추가됨`);
          setRel((r) => ({ ...r, name: '' }));
        }}
      >
        <input value={rel.name} onChange={(e) => setRel({ ...rel, name: e.target.value })} placeholder="관계명 (예: 보유)" className="w-full border border-line rounded px-2 py-1 text-[11px]" />
        <div className="flex items-center gap-1">
          <select value={rel.domain} onChange={(e) => setRel({ ...rel, domain: e.target.value })} className="flex-1 min-w-0 border border-line rounded px-1 py-1 text-[10.5px]">
            {classes.map((c) => (
              <option key={c.uri}>{c.name}</option>
            ))}
          </select>
          <span className="text-ink-mid text-[11px]">→</span>
          <select value={rel.range} onChange={(e) => setRel({ ...rel, range: e.target.value })} className="flex-1 min-w-0 border border-line rounded px-1 py-1 text-[10.5px]">
            {classes.map((c) => (
              <option key={c.uri}>{c.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="w-full py-1 bg-brand text-white rounded text-[11px] font-extrabold">
          관계 추가
        </button>
      </form>

      <p className="mt-3 text-[10px] text-ink-mid font-semibold leading-relaxed">
        💡 그래프에서 <b>클래스를 다른 클래스 위로 끌어다 놓으면 병합</b>됩니다. 속성이 합쳐지고 관계 끝점이 옮겨집니다.
      </p>
      {msg && <div className="mt-2 text-[10.5px] font-bold text-brand">{msg}</div>}
    </>
  );
}

/* ── TTL 내보내기 ── */
function TtlPane() {
  const ttl = toTurtle();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => downloadTurtle()} className="flex-1 py-1.5 bg-brand text-white rounded text-[11px] font-extrabold">
          ⬇ .ttl 다운로드
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(ttl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="px-2.5 py-1.5 border border-line rounded text-[11px] font-extrabold text-ink-dark"
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div className="mt-2 text-[10px] text-ink-mid font-semibold">W3C Turtle · owl:Class / ObjectProperty / DatatypeProperty</div>
      <pre className="mt-1.5 text-[9.5px] font-mono leading-relaxed bg-surface border border-line-soft rounded p-2 overflow-x-auto whitespace-pre">
        {ttl.slice(0, 2600)}
        {ttl.length > 2600 ? `\n… (총 ${ttl.length.toLocaleString('ko-KR')}자)` : ''}
      </pre>
    </>
  );
}

/* ── Import ── */
function ImportPane() {
  const [text, setText] = useState('');
  const [res, setRes] = useState<ImportResult | null>(null);
  return (
    <>
      <div className="text-[10px] text-ink-mid font-semibold leading-relaxed">
        Turtle(.ttl) 을 붙여넣으면 온톨로지를 교체합니다. 이 앱이 내보낸 형식을 되읽는 수준의 파서입니다.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="@prefix bnk: <...> .&#10;bnk:GoGaek a owl:Class ; rdfs:label &quot;고객&quot;@ko ."
        className="mt-2 w-full h-[300px] border border-line rounded p-2 text-[10px] font-mono"
      />
      <button
        type="button"
        onClick={() => setRes(importTurtle(text))}
        disabled={!text.trim()}
        className="mt-2 w-full py-1.5 bg-brand text-white rounded text-[11px] font-extrabold disabled:opacity-50"
      >
        가져오기
      </button>
      {res && (
        <div className={cn('mt-2 text-[10.5px] font-bold rounded px-2 py-1.5 border', res.ok ? 'bg-ok-bg text-ok border-ok-border' : 'bg-bad-bg text-bad border-bad-border')}>
          {res.ok ? `클래스 ${res.classes} · 관계 ${res.relations} · 속성 ${res.attrs} 가져옴` : `실패 — ${res.error}`}
        </div>
      )}
    </>
  );
}
