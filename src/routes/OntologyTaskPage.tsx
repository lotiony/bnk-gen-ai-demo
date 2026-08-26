/**
 * 온톨로지 과제 상세 — 과제 카테고리 'Ontology' 의 독립 화면.
 *
 * RFP: RAG-007 Graph RAG(필수) · RAG-008 온톨로지 플랫폼 연계(권고·가점)
 *
 * 지식 데이터 과제의 한 탭이 아니라 **별도 과제 유형**이다. 온톨로지는
 * 특정 지식 데이터 하나에 종속되지 않고 여러 소스(정형DB 가상 뷰 + 문서)를
 * 가로질러 구축되기 때문이다.
 */
import { Link, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { useWorkCrumb, useWorkContainer, useWorkReturnPath, useWorkReturnLabel, useInWorkspace } from '@/lib/crumbs';
import OntologySection from '@/components/ontology/OntologySection';

/** 셸 밖(프로젝트 경로)에서 단독으로 열릴 때의 컨테이너. */
const WORK_STANDALONE_CLS = 'max-w-[1360px] mx-auto px-6 py-5';
/** AI Studio · 지식 데이터 셸 안에서 열릴 때의 컨테이너. */
const WORK_SHELL_CLS = 'w-full pb-5';

export default function OntologyTaskPage() {
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-2025-PB-001';
  const crumbItems = useWorkCrumb('온톨로지 · 지식그래프', pid);
  const containerCls = useWorkContainer(WORK_STANDALONE_CLS, WORK_SHELL_CLS);
  const returnPath = useWorkReturnPath(pid);
  const returnLabel = useWorkReturnLabel();
  const inWorkspace = useInWorkspace();

  return (
    <div className={containerCls}>
      <Crumb items={crumbItems} />

      <div className="flex items-start gap-3 mt-2 mb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px]">온톨로지</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {!inWorkspace && (
              <span className="pill bg-surface text-ink-mid border border-line-soft">
                과제 <b className="text-ink-dark">PB 에이전트 프로젝트</b>
              </span>
            )}
            <span className="pill bg-info-bg text-info border border-info-border">
              인프라 🏢 <b>공동존 On-Prem</b>
            </span>
            <span className="pill bg-brand-tint text-brand border border-brand-tint">ONT-101</span>
          </div>
        </div>
        <div className="text-[11px] text-ink-mid font-semibold flex items-center gap-1.5 pt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ok" />
          자동 저장됨 · 10:42 KST
        </div>
      </div>

      <OntologySection />

      <div className="mt-4">
        <Link
          to={returnPath}
          className="inline-flex items-center h-8 px-3 border border-line rounded text-[12px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
        >
          {returnLabel}
        </Link>
      </div>
    </div>
  );
}
