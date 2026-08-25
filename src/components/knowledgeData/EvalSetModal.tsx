import { useRef, useState } from 'react';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';

/** .xlsx 등 파싱 불가 파일 업로드 시 시뮬레이션으로 추가할 목업 문항. */
const MOCK_UPLOAD: Array<[string, string, string]> = [
  ['펀드 판매보수와 운용보수 차이는?', '펀드_상품설명서.pdf', '판매보수는 판매사, 운용보수는 자산운용사가 수취한다.'],
  ['ISA 서민형 가입 자격은?', 'ISA_약관.pdf', '총급여 5,000만원 이하 등 요건을 충족하면 서민형으로 가입할 수 있다.'],
  ['연금저축 중도인출 시 세금은?', '연금저축_상품설명서.pptx', '중도인출 시 기타소득세 16.5%가 부과된다.'],
  ['예금 이자 지급 방식은?', '예금_상품설명서.docx', '만기일시지급식과 월이자지급식 중 선택할 수 있다.'],
  ['적금 자동이체 우대금리는?', '적금_상품설명서.hwpx', '자동이체 등록 시 최대 0.3%p 우대금리가 적용된다.'],
];

export interface GoldenItem {
  id: string;
  q: string;
  /** 정답 문서 — 근거 구절이 속한 원본 문서. */
  gold: string;
  /** 정답 근거 구절(청크) — 검색된 청크에 이 구절이 포함됐는지로 Recall@5·MRR·nDCG 채점. */
  passage: string;
}

export interface EvalSet {
  id: string;
  name: string;
  items: GoldenItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  sets: EvalSet[];
  /** 현재 편집·평가 대상 평가셋 id. */
  activeId: string;
  onChangeSets: (sets: EvalSet[]) => void;
  onSelectActive: (id: string) => void;
}

/** 평가셋(골든셋) 관리 모달 — 여러 평가셋을 생성/전환/편집. 문항은 질문·정답 문서·근거 구절로 관리. */
export default function EvalSetModal({ open, onClose, sets, activeId, onChangeSets, onSelectActive }: Props) {
  const current = sets.find((s) => s.id === activeId) ?? sets[0];

  const [q, setQ] = useState('');
  const [gold, setGold] = useState('');
  const [passage, setPassage] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const updateItems = (items: GoldenItem[]) =>
    onChangeSets(sets.map((s) => (s.id === current.id ? { ...s, items } : s)));

  const rename = (name: string) =>
    onChangeSets(sets.map((s) => (s.id === current.id ? { ...s, name } : s)));

  const addSet = () => {
    const id = `set-${Date.now()}`;
    onChangeSets([...sets, { id, name: `새 평가셋 ${sets.length + 1}`, items: [] }]);
    onSelectActive(id);
  };

  const deleteSet = () => {
    if (sets.length <= 1) return;
    const rest = sets.filter((s) => s.id !== current.id);
    onChangeSets(rest);
    onSelectActive(rest[0].id);
  };

  const addItem = () => {
    const question = q.trim();
    const doc = gold.trim();
    const psg = passage.trim();
    if (!question || !doc || !psg) return;
    updateItems([...current.items, { id: `g-${Date.now()}-${current.items.length}`, q: question, gold: doc, passage: psg }]);
    setQ('');
    setGold('');
    setPassage('');
  };

  const removeItem = (id: string) => updateItems(current.items.filter((i) => i.id !== id));

  /** CSV 텍스트를 [질문, 정답 문서, 근거 구절] 행으로 파싱. */
  const parseCsv = (text: string): Array<[string, string, string]> => {
    const rows: Array<[string, string, string]> = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols[0] === '질문' || cols[0].toLowerCase() === 'question') continue; // 헤더 skip
      if (cols.length >= 3 && cols[0] && cols[1] && cols[2]) rows.push([cols[0], cols[1], cols[2]]);
    }
    return rows;
  };

  const appendRows = (rows: Array<[string, string, string]>, fileName: string) => {
    if (rows.length === 0) {
      setNotice(`${fileName} · 추가할 문항을 찾지 못했습니다 (질문,정답 문서,근거 구절 형식 확인)`);
      return;
    }
    const base = Date.now();
    const newItems: GoldenItem[] = rows.map(([q2, gold2, psg2], i) => ({
      id: `g-${base}-${i}`,
      q: q2,
      gold: gold2,
      passage: psg2,
    }));
    updateItems([...current.items, ...newItems]);
    setNotice(`${fileName} · ${newItems.length}개 문항이 추가되었습니다`);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = () => appendRows(parseCsv(String(reader.result ?? '')), file.name);
      reader.readAsText(file);
    } else {
      // .xlsx/.xls 등 바이너리 — 프로토타입에서는 파싱 대신 목업 문항 추가
      appendRows(MOCK_UPLOAD, file.name);
    }
    e.target.value = ''; // 같은 파일 재선택 허용
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      title="평가셋 관리"
      subtitle={<>여러 평가셋을 만들어 전환·관리합니다 · 평가는 활성 평가셋 기준으로 실행됩니다</>}
      footer={
        <>
          <span className="text-[11.5px] text-ink-mid">
            활성 평가셋 <b className="text-ink-dark">{current.name}</b> · {current.items.length} 문항 · 다음 평가 실행부터
            반영됩니다
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-ink hover:bg-brand-dark"
          >
            완료
          </button>
        </>
      }
    >
      {/* 평가셋 선택·관리 */}
      <div className="border border-line-soft rounded-lg bg-surface-soft p-3 mb-3">
        <div className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-2">평가셋</div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={current.id}
            onChange={(e) => onSelectActive(e.target.value)}
            className="h-8 px-2.5 border border-line rounded text-[12px] bg-white font-bold text-ink-dark focus:outline-none focus:border-brand-dark min-w-[180px]"
          >
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.items.length})
              </option>
            ))}
          </select>
          <span className="text-ink-light text-[11px]">활성</span>
          <span className="flex-1" />
          <input
            value={current.name}
            onChange={(e) => rename(e.target.value)}
            placeholder="평가셋 이름"
            className="h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark w-[200px]"
          />
          <button
            onClick={addSet}
            className="h-8 px-3 bg-white border border-line rounded text-[11.5px] font-bold text-ink-dark hover:bg-surface whitespace-nowrap"
          >
            ＋ 새 평가셋
          </button>
          <button
            onClick={deleteSet}
            disabled={sets.length <= 1}
            title={sets.length <= 1 ? '최소 1개의 평가셋이 필요합니다' : '이 평가셋 삭제'}
            className="h-8 px-3 bg-white border border-line rounded text-[11.5px] font-bold text-bad hover:bg-bad-bg hover:border-bad-border disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 새 문항 추가 */}
      <div className="border border-line-soft rounded-lg bg-surface-soft p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">
            문항 추가 <span className="text-ink-light normal-case font-semibold">— {current.name}</span>
          </div>
          <span className="flex-1" />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            title="엑셀(.xlsx)·CSV로 문항을 일괄 추가합니다. 열: 질문, 정답 문서, 근거 구절"
            className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-info hover:bg-info-bg hover:border-info-border whitespace-nowrap"
          >
            ↑ 엑셀 업로드
          </button>
        </div>
        {notice && (
          <div className="text-[10.5px] font-semibold text-ok bg-ok-bg border border-ok-border rounded px-2.5 py-1.5 mb-2">
            {notice}
          </div>
        )}
        <div className="space-y-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="질문 (예: ISA 계좌 연간 납입한도는?)"
            className="w-full h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark"
          />
          <div className="grid grid-cols-[220px_1fr_auto] gap-2 items-center">
            <input
              value={gold}
              onChange={(e) => setGold(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="정답 문서 (예: ISA_상품설명서.xlsx)"
              className="h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark"
            />
            <input
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="근거 구절 (정답이 담긴 원문 청크 — 검색 청크에 이 구절 포함 시 정답)"
              className="h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark"
            />
            <button
              onClick={addItem}
              disabled={!q.trim() || !gold.trim() || !passage.trim()}
              className="h-8 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              ＋ 추가
            </button>
          </div>
        </div>
      </div>

      {/* 문항 목록 */}
      <div className="border border-line-soft rounded-lg overflow-hidden">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
              <th className="text-left py-2 px-3 font-bold w-10">#</th>
              <th className="text-left py-2 px-3 font-bold">질문</th>
              <th className="text-left py-2 px-3 font-bold whitespace-nowrap">정답 문서</th>
              <th className="text-left py-2 px-3 font-bold">근거 구절</th>
              <th className="text-center py-2 px-3 font-bold w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {current.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[11.5px] text-ink-light">
                  문항이 없습니다. 위에서 질문·정답 문서·근거 구절을 추가하세요.
                </td>
              </tr>
            ) : (
              current.items.map((it, i) => (
                <tr key={it.id} className="hover:bg-surface">
                  <td className="py-2 px-3 text-ink-light tabular-nums">{i + 1}</td>
                  <td className="py-2 px-3 text-ink-dark font-semibold">{it.q}</td>
                  <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{it.gold}</td>
                  <td className="py-2 px-3 text-ink-mid max-w-[320px] truncate" title={it.passage}>
                    {it.passage}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => removeItem(it.id)}
                      title="삭제"
                      className={cn(
                        'w-6 h-6 inline-flex items-center justify-center rounded text-ink-mid hover:bg-bad-bg hover:text-bad',
                      )}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}
