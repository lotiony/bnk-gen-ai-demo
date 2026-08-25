import type { Project } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  project: Project;
}

/** 개요 탭 — 운영 KPI + 비즈니스 케이스 (좌) + 서비스 메타 (우) */
export default function OverviewTab({ project }: Props) {
  return (
    <>
      <section className="card px-5 py-4 mb-3.5">
        <SectionHead title="개요" />
      <div className="grid grid-cols-[1fr_360px] gap-3.5">
        {/* 좌측 — 비즈니스 케이스 + 기능 요건 */}
        <div className="flex flex-col gap-2.5">
          <OvBlock title="비즈니스 목표">
            <p className="text-[12.5px] text-ink-dark leading-relaxed">{project.bizGoal}</p>
          </OvBlock>
          <OvBlock title="현재 페인포인트">
            <ul className="list-disc pl-5 text-[12.5px] text-ink-dark leading-[1.7] space-y-1">
              {project.painPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </OvBlock>
          <OvBlock title="기대 효과">
            <p className="text-[12.5px] text-ink-dark leading-relaxed">
              상담 준비·자료 조회 시간 단축 · 표준 응답 자동화 · PB의 고난도·고가치 상담 집중
            </p>
          </OvBlock>
        </div>

        {/* 우측 메타 패널 */}
        <div className="flex flex-col gap-2.5">
          <MetaBox title="서비스 구분">
            <MetaRow k="대상" v={project.target} />
            <MetaRow k="노출 채널" v={<ChannelChips value={project.serviceChannel} />} />
          </MetaBox>
          <MetaBox title="입출력 MODALITY">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                { on: project.modality.text, label: '텍스트' },
                { on: project.modality.doc, label: '문서' },
                { on: project.modality.voice, label: '음성' },
                { on: project.modality.image, label: '이미지' },
              ].map((m) => (
                <span
                  key={m.label}
                  className={cn(
                    'text-2xs font-bold py-[3px] px-2.5 rounded-[9px] border',
                    m.on
                      ? 'bg-info-bg text-info border-info-border'
                      : 'bg-surface-soft text-ink-light border-line-soft',
                  )}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </MetaBox>
          <MetaBox title="데이터 자산">
            <MetaRow
              k="민감도"
              v={
                <span className="text-bad">
                  {project.sensitivity} ({project.sensitivity === 4 ? '최상' : '상'})
                </span>
              }
            />
            <MetaRow k="개인정보" v={project.pii ? '포함' : '미포함'} />
            <MetaRow k="신용정보" v={project.credit ? '포함' : '미포함'} />
          </MetaBox>
        </div>
      </div>
      </section>
    </>
  );
}

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex items-baseline gap-2.5 mb-3.5 flex-wrap">
      <span className="text-[15px] font-extrabold text-ink tracking-tight">{title}</span>
      {desc && <span className="text-[11.5px] text-ink-mid font-medium">{desc}</span>}
    </div>
  );
}

function OvBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-soft border border-line-soft rounded p-3.5">
      <h4 className="text-[11.5px] font-extrabold tracking-[0.4px] uppercase text-ink-mid mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function MetaBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-soft border border-line-soft rounded p-3">
      <h4 className="text-[11px] font-extrabold tracking-[0.4px] uppercase text-ink-mid mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2 py-1 text-[12.5px] border-b border-dashed border-line-soft last:border-0">
      <span className="text-ink-mid font-semibold text-[11.5px] flex-shrink-0">{k}</span>
      <span className="text-ink font-bold text-right">{v}</span>
    </div>
  );
}

/** "A + B" 형식의 노출 채널 문자열을 칩으로 렌더링. */
function ChannelChips({ value }: { value: string }) {
  const parts = value.split('+').map((s) => s.trim()).filter(Boolean);
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {parts.map((label) => (
        <span
          key={label}
          className="text-[11px] font-bold py-[3px] px-2 rounded-[9px] border bg-info-bg text-info border-info-border"
        >
          {label}
        </span>
      ))}
    </span>
  );
}
