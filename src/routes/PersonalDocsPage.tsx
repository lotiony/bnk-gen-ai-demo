/**
 * 내 문서 — 개인 문서 기반 RAG.
 *
 * RFP 2-1 사용자 포털: "개인 문서 기반 RAG 구성: 업로드 문서 자동 파싱·벡터 적재 후
 * 에이전트 개발 및 대화에 활용 가능한 환경 제공(개인별 격리 저장)"
 *
 * 업로드하면 파싱→청킹→벡터 적재를 거쳐 **본인 전용 인덱스**에 들어간다. 부서·계열사
 * 누구와도 공유되지 않는다 — 공유하려면 지식 데이터 과제로 승격 신청해야 한다.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import { PERSONAL_DOCS, type PersonalDoc, type PersonalDocState } from '@/data/mockPersonalDocs';

const STATE_TONE: Record<PersonalDocState, 'ok' | 'info' | 'bad'> = { '적재 완료': 'ok', '파싱 중': 'info', 실패: 'bad' };

export default function PersonalDocsPage() {
  const persona = useCurrentPersona();
  const [docs, setDocs] = useState<PersonalDoc[]>(PERSONAL_DOCS);

  const fakeUpload = () => {
    const id = `PDOC-${(docs.length + 1).toString().padStart(2, '0')}`;
    setDocs((d) => [{ id, name: '신규_업로드_문서.pdf', ext: 'PDF', sizeMB: 0.9, uploadedAt: '방금', state: '파싱 중', index: docs[0]?.index ?? 'idx-personal-usr_8f3a' }, ...d]);
    toast('업로드했습니다 — 자동 파싱·벡터 적재를 시작합니다');
    setTimeout(() => {
      setDocs((d) => d.map((x) => x.id === id ? { ...x, state: '적재 완료', chunks: 12 } : x));
    }, 1600);
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">내 문서</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            업로드한 문서는 자동 파싱·벡터 적재되어 대화와 에이전트 개발에 활용됩니다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          2-1 개인 문서 RAG
        </span>
      </div>

      <div className="border border-brand-tint bg-brand-bg rounded px-3.5 py-2.5 mb-3.5">
        <div className="text-[11.5px] font-extrabold text-brand mb-0.5">개인별 격리 저장</div>
        <p className="text-[11px] text-ink-dark font-semibold leading-snug">
          이 문서들은 <b>본인({persona?.name ?? '나'})만</b> 조회·검색할 수 있습니다. 부서·계열사와
          공유되지 않으며, 공유가 필요하면 지식 데이터 과제로 승격 신청해야 합니다.
        </p>
      </div>

      <div className="flex justify-end mb-2.5">
        <button
          type="button"
          onClick={fakeUpload}
          className="py-1.5 px-3.5 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark"
        >+ 문서 업로드</button>
      </div>

      <div className="flex flex-col gap-1.5">
        {docs.map((d) => (
          <div key={d.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 bg-white border border-line-soft rounded">
            <div className="min-w-0">
              <div className="text-[12.5px] font-extrabold text-ink truncate">{d.name}</div>
              <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 font-mono">{d.index}</div>
            </div>
            <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">{d.ext} · {d.sizeMB}MB</span>
            <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap tabular-nums">
              {d.uploadedAt}{d.chunks ? ` · 청크 ${d.chunks}개` : ''}
            </span>
            <StatusPill tone={STATE_TONE[d.state]}>{d.state}</StatusPill>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-ink-mid font-semibold mt-3 leading-snug">
        적재가 완료된 문서는 AI Studio 의 에이전트 빌더에서 연결 지식 자산으로 선택할 수 있고,
        대화 화면에서 자동으로 참조됩니다.
      </p>
    </div>
  );
}
