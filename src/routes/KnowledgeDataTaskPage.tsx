import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { useWorkCrumb, useWorkContainer } from '@/lib/crumbs';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import UploadModal from '@/components/knowledgeData/UploadModal';
import OriginViewerModal from '@/components/knowledgeData/OriginViewerModal';
import ParseSection from '@/components/knowledgeData/ParseSection';
import type { ParseRowSettings, StagedDoc } from '@/components/knowledgeData/ParseSection';
import ParseModal, { type ParseStartGroup } from '@/components/knowledgeData/ParseModal';
import EmbedModal, { type EmbedStartPayload } from '@/components/knowledgeData/EmbedModal';
import IndexSection from '@/components/knowledgeData/IndexSection';
import EvalSection from '@/components/knowledgeData/EvalSection';
import DeploySection from '@/components/knowledgeData/DeploySection';
import ParseResultModal, { type ReparseOpts } from '@/components/knowledgeData/ParseResultModal';
import { FILE_ROWS, FOLDER_ROWS, FOLDER_FILES, type FileRow } from '@/components/knowledgeData/storageData';
import { buildInitialRun, buildHistoryMock, generateBlocks, type FileRunStatus } from '@/components/knowledgeData/parseRunData';
import { buildIndexListMock, type IndexVersion, type IndexWithVersions } from '@/components/knowledgeData/embedData';
import { toast } from '@/lib/toast';

type TabId = 'storage' | 'manifest' | 'index' | 'eval' | 'deploy';

/** 확장자별 아이콘 색상. */
const EXT_TONE: Record<string, string> = {
  PDF: 'bg-bad-bg text-bad border-bad-border',
  DOC: 'bg-info-bg text-info border-info-border',
  DOCX: 'bg-info-bg text-info border-info-border',
  HWPX: 'bg-brand-tint text-ink border-brand-dark',
  PPT: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border',
  PPTX: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border',
  XLS: 'bg-ok-bg text-ok border-ok-border',
  XLSX: 'bg-ok-bg text-ok border-ok-border',
  CSV: 'bg-ok-bg text-ok border-ok-border',
  PNG: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
};

/** 파싱 대상 묶음(bundle) 목업. 저장된 묶음들 — 여러 개, 각자 인덱스(1:N). */
type Bundle = { id: string; name: string; status: string; indexCount: number; updatedAt: string; docs: StagedDoc[] };
const withPath = (rows: FileRow[], path: string): StagedDoc[] => rows.map((f) => ({ ...f, sourcePath: path }));
const B1_DOCS = withPath(FILE_ROWS.filter((r) => r.isGroupHead || !r.parentGroup).slice(0, 30), '상품·시장 안내 매뉴얼');
const B3_DOCS = withPath(FILE_ROWS.filter((r) => r.isGroupHead || !r.parentGroup).slice(30, 38), '상품·시장 안내 매뉴얼');
const SAVED_BUNDLES: Bundle[] = [
  { id: 'b1', name: 'PB 상담 지식', status: '확정', indexCount: 3, updatedAt: '2026-01-08', docs: B1_DOCS },
  { id: 'b3', name: '2026 신상품 안내', status: '파싱 중', indexCount: 0, updatedAt: '2026-02-13', docs: B3_DOCS },
];
const BUNDLE_STATUS_TONE: Record<string, string> = {
  미저장: 'bg-surface-soft text-ink-mid border-line',
  초안: 'bg-warn-bg text-warn border-warn-border',
  확정: 'bg-ok-bg text-ok border-ok-border',
  '파싱 중': 'bg-info-bg text-info border-info-border',
  완료: 'bg-ok-bg text-ok border-ok-border',
};

/** 셸 밖(프로젝트 경로)에서 단독으로 열릴 때의 컨테이너. */
const WORK_STANDALONE_CLS = 'max-w-[1360px] mx-auto px-8 pt-3.5 pb-14';
/** AI Studio · 지식 데이터 셸 안에서 열릴 때의 컨테이너. */
const WORK_SHELL_CLS = 'w-full pb-14';
/** 과제 상세가 프로젝트 경로로 열릴 때 브레드크럼에 끼울 기준 프로젝트. */
const WORK_PID = 'PRJ-2025-PB-001';

export default function KnowledgeDataTaskPage() {
  const crumbItems = useWorkCrumb('지식 데이터', WORK_PID);
  const containerCls = useWorkContainer(WORK_STANDALONE_CLS, WORK_SHELL_CLS);
  // 그룹별 펼침 상태 — 초기엔 모두 접힘(이전 버전 숨김).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // 저장소 파일 목록 — 업로드/삭제가 실제로 반영되는 단일 소스. 파싱·임베딩 탭도 이 상태를 공유한다.
  const [fileRows, setFileRows] = useState<FileRow[]>(FILE_ROWS);
  // 체크된 파일 id — 초기엔 아무것도 선택 안 됨.
  const [checked, setChecked] = useState<Set<string>>(new Set());

  /** 업로드 완료 — 새 파일을 목록 맨 위에 추가(신규 배지). 파싱 탭에도 즉시 반영. */
  const addUploadedFiles = (rows: FileRow[]) => {
    if (rows.length === 0) return;
    setFileRows((cur) => [...rows, ...cur]);
  };

  /** 삭제 — 지정한 id 제거. 그룹 헤더를 지우면 같은 그룹의 이전 버전도 함께 제거. */
  const deleteFiles = (ids: Set<string>) => {
    if (ids.size === 0) return;
    setFileRows((cur) => {
      const groupsToDrop = new Set(
        cur.filter((r) => ids.has(r.id) && r.isGroupHead && r.parentGroup).map((r) => r.parentGroup!),
      );
      return cur.filter(
        (r) => !ids.has(r.id) && !(r.parentGroup && groupsToDrop.has(r.parentGroup)),
      );
    });
    setChecked((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setStaged((cur) => cur.filter((s) => !ids.has(s.id)));
  };

  const [uploadOpen, setUploadOpen] = useState(false);
  const [originRow, setOriginRow] = useState<FileRow | null>(null);
  // 일괄 파싱 모달 대상
  const [parseTargets, setParseTargets] = useState<FileRow[]>([]);

  // 활성 탭
  const [tab, setTab] = useState<TabId>('storage');

  // 파싱 작업 목록 — 저장소에서 담은 문서들(칸반 대상). 초기엔 신규/대표 문서가 담겨 있음.
  const SOURCE_PATH = '상품·시장 안내 매뉴얼';
  const [staged, setStaged] = useState<StagedDoc[]>([]);
  // 저장된 데이터셋 목록 — 최종 확정 시 담는 중이던 데이터셋이 임시 이름으로 고정되어 여기에 추가된다.
  const [savedBundles, setSavedBundles] = useState<Bundle[]>(SAVED_BUNDLES);

  /** 저장소에서 선택한 문서(+선택 폴더의 파일)를 파싱 대상에 담고 드로어를 연다. */
  const stageChecked = () => {
    const fileAdds = fileRows
      .filter((r) => checked.has(r.id))
      .map((r) => ({ ...r, sourcePath: SOURCE_PATH }));
    const folderAdds = FOLDER_ROWS.filter((f) => checked.has(f.name)).flatMap((f) =>
      (FOLDER_FILES[f.name] ?? []).map((x) => ({ ...x, sourcePath: f.name })),
    );
    const toAdd = [...fileAdds, ...folderAdds];
    if (toAdd.length === 0) return;
    setStaged((cur) => {
      const ids = new Set(cur.map((s) => s.id));
      const fresh = toAdd.filter((r) => !ids.has(r.id));
      return [...cur, ...fresh];
    });
    setChecked(new Set());
    setManifestOpen(true);
  };

  /** 작업 목록에서 문서 빼기. */
  const removeStaged = (id: string) => setStaged((cur) => cur.filter((s) => s.id !== id));

  /** 단건 담기 — 파일 행에서 바로 파싱 대상에 추가하고 드로어를 연다. */
  const stageOne = (r: FileRow, sourcePath: string = SOURCE_PATH) => {
    setStaged((cur) => (cur.some((s) => s.id === r.id) ? cur : [...cur, { ...r, sourcePath }]));
    setManifestOpen(true);
  };

  /** 폴더 담기 — 폴더 안의 파일들을 파싱 대상에 추가하고 드로어를 연다. */
  const stageFolder = (folderName: string) => {
    const files = FOLDER_FILES[folderName] ?? [];
    if (files.length === 0) return;
    setStaged((cur) => {
      const ids = new Set(cur.map((s) => s.id));
      const fresh = files.filter((f) => !ids.has(f.id)).map((f) => ({ ...f, sourcePath: folderName }));
      return [...cur, ...fresh];
    });
    setManifestOpen(true);
  };
  const unstageFolder = (folderName: string) => {
    const ids = new Set((FOLDER_FILES[folderName] ?? []).map((f) => f.id));
    setStaged((cur) => cur.filter((s) => !ids.has(s.id)));
  };

  // 파싱에 담긴 파일 집합 · 요약 — 저장소에서 담김 표시 + 최종 확정에 사용.
  const stagedIds = new Set(staged.map((s) => s.id));
  const stagedDocCount = staged.filter((s) => s.isGroupHead || !s.parentGroup).length;
  const stagedTotalMB = staged.reduce((sum, r) => sum + r.sizeMB, 0);
  // 파싱 배치 확정 여부.
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  /** 최종 확정 — 저장소에서 담던 데이터셋을 임시 이름(데이터셋-날짜)으로 고정해 저장 목록에 추가하고 파싱 청킹으로 이동. */
  const confirmBatch = () => {
    if (staged.length > 0) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const frozen: Bundle = {
        id: `ds-${Date.now()}`,
        name: `데이터셋 ${today}`,
        status: '파싱 중',
        indexCount: 0,
        updatedAt: today,
        docs: staged,
      };
      setSavedBundles((cur) => [frozen, ...cur]);
      setStaged([]); // '담는 중' 카드 제거 → 고정된 데이터셋으로 대체
      setBatchConfirmed(true);
      setOpenBundle(frozen.id); // 고정된 데이터셋의 파싱 청킹 화면으로 이동
      setTab('manifest');
    }
  };
  // 매니페스트 드로어 열림 상태 — 담기 누르면 우측에서 슬라이드로 열림.
  const [manifestOpen, setManifestOpen] = useState(true);

  // 문서별 버전 정책 — 최신 자동 추종 vs 특정 버전 고정. (문서별로 선택)
  const latestVer = (d: FileRow) => (d.priorCount ?? 0) + 1;
  const [versionPolicy, setVersionPolicy] = useState<Record<string, 'latest' | 'pinned'>>({
    'f-script-v32': 'pinned', // 데모: 한 문서는 고정 상태에서 새 버전 대기
  });
  const [pinnedAt, setPinnedAt] = useState<Record<string, number>>({ 'f-script-v32': 1 });
  const togglePolicy = (id: string, lv: number) => {
    const cur = versionPolicy[id] ?? 'latest';
    if (cur === 'latest') {
      setVersionPolicy((p) => ({ ...p, [id]: 'pinned' }));
      setPinnedAt((pa) => ({ ...pa, [id]: lv })); // 고정 전환 시 현재 최신에 고정
    } else {
      setVersionPolicy((p) => ({ ...p, [id]: 'latest' }));
    }
  };
  const adoptLatest = (id: string, lv: number) => setPinnedAt((pa) => ({ ...pa, [id]: lv }));
  const stagedHeads = staged.filter((s) => s.isGroupHead || !s.parentGroup);
  // 매니페스트 검색 + 페이징 (10/20/50개 보기).
  const [manifestPageSize, setManifestPageSize] = useState(10);
  const [manifestPage, setManifestPage] = useState(1);
  const [manifestQuery, setManifestQuery] = useState('');
  const manifestFiltered = stagedHeads.filter((d) =>
    d.name.toLowerCase().includes(manifestQuery.trim().toLowerCase()),
  );
  const manifestTotalPages = Math.max(1, Math.ceil(manifestFiltered.length / manifestPageSize));
  const manifestCurPage = Math.min(manifestPage, manifestTotalPages);
  const manifestPageDocs = manifestFiltered.slice(
    (manifestCurPage - 1) * manifestPageSize,
    manifestCurPage * manifestPageSize,
  );

  // 파싱 대상 묶음 목록 + 상세. 'working' = 지금 담는 중인 묶음(=staged).
  const [openBundle, setOpenBundle] = useState<string | null>(null);
  const bundles: Bundle[] = [
    ...(stagedHeads.length > 0
      ? [{ id: 'working', name: '새 데이터셋 (담는 중)', status: '미저장', indexCount: 0, updatedAt: '방금 전', docs: staged }]
      : []),
    ...savedBundles,
  ];
  const detailBundle = bundles.find((b) => b.id === openBundle);
  const detailHeads = (detailBundle?.docs ?? []).filter((d) => d.isGroupHead || !d.parentGroup);
  const detailFiltered = detailHeads.filter((d) =>
    d.name.toLowerCase().includes(manifestQuery.trim().toLowerCase()),
  );
  const detailTotalPages = Math.max(1, Math.ceil(detailFiltered.length / manifestPageSize));
  const detailCurPage = Math.min(manifestPage, detailTotalPages);
  const detailPaged = detailFiltered.slice(
    (detailCurPage - 1) * manifestPageSize,
    detailCurPage * manifestPageSize,
  );

  // 파싱 진행 상태 — 페이지 진입 시 이전 파싱 이력(mock)이 이미 누적되어 보이도록 초기화.
  const [parseRun, setParseRun] = useState<{ files: FileRunStatus[]; startedAt: string } | null>(
    () => buildHistoryMock(),
  );
  // 「결과 확인」 모달
  const [resultFile, setResultFile] = useState<FileRunStatus | null>(null);

  // parseRun이 갱신될 때 resultFile도 같이 갱신 (진행률이 올라가도 모달이 stale하지 않게)
  useEffect(() => {
    if (!resultFile || !parseRun) return;
    const fresh = parseRun.files.find((f) => f.id === resultFile.id);
    if (fresh && fresh !== resultFile) setResultFile(fresh);
  }, [parseRun, resultFile]);

  /** 공용 파싱 실행 — 즉시 진행(run) 상태로 넣고 ~2초 뒤 완료(done) 처리. 개별·일괄·재파싱 공용. */
  const runParse = (
    files: FileRow[],
    parserId: FileRunStatus['parserId'],
    settings: FileRunStatus['settings'],
    replaceDocRuns = false,
  ) => {
    if (files.length === 0) return;
    const nowLabel = () =>
      new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    // 진행 상태 run + 2초 뒤 적용할 완료본을 동시에 준비.
    const running: FileRunStatus[] = [];
    const doneById = new Map<string, FileRunStatus>();
    files.forEach((file) => {
      const base = buildInitialRun([file], parserId, settings)[0];
      running.push({ ...base, state: 'run', progress: 15, finishedAt: undefined });
      const blocks = base.blocks.length ? base.blocks : generateBlocks(file, parserId);
      const chunks = base.chunks || Math.max(1, Math.round((file.pages ?? Math.ceil(file.sizeMB * 12)) * 9));
      doneById.set(base.id, { ...base, blocks, chunks, state: 'done', progress: 100, finishedAt: nowLabel() });
    });
    const runIds = new Set(running.map((r) => r.id));
    const docIds = new Set(files.map((f) => f.id));
    setParseRun((cur) => {
      const startedAt = cur?.startedAt ?? nowLabel();
      const kept = (cur?.files ?? []).filter((r) =>
        replaceDocRuns ? !docIds.has(r.id.split('__')[0]) : !runIds.has(r.id),
      );
      return { startedAt, files: [...kept, ...running] };
    });
    // ~2초 뒤 완료 처리.
    window.setTimeout(() => {
      setParseRun((cur) =>
        cur ? { ...cur, files: cur.files.map((r) => doneById.get(r.id) ?? r) } : cur,
      );
    }, 2000);
  };

  /** 일괄 파싱 — ParseModal에서 그룹별 파서로 시작. */
  const DEFAULT_RUN_SETTINGS: FileRunStatus['settings'] = {
    chunking: 'semantic',
    image: 'caption',
    tableToMd: true,
    pii: true,
    metaTag: true,
  };
  const startParseGroups = (groups: ParseStartGroup[]) => {
    groups.forEach((g) => g.parserIds.forEach((pid) => runParse(g.files, pid, DEFAULT_RUN_SETTINGS)));
  };

  /** 행 단위 파싱 시작 — 행 안에서 선택한 파서들로 시작. */
  const startParseRow = (file: FileRow, settings: ParseRowSettings) => {
    if (settings.parserIds.length === 0) return;
    const runSettings: FileRunStatus['settings'] = {
      chunking: settings.chunking,
      image: settings.image,
      tableToMd: settings.options.tableToMd,
      pii: settings.options.pii,
      metaTag: settings.options.metaTag,
    };
    settings.parserIds.forEach((pid) => runParse([file], pid, runSettings));
  };

  /** 재파싱 — 결과 모달에서 옵션(파서·청커)을 바꿔 해당 문서를 다시 파싱한다. */
  const reparseFile = (f: FileRunStatus, opts: ReparseOpts) => {
    const fileRow: FileRow = {
      id: f.id.split('__')[0],
      name: f.name,
      ext: f.ext,
      sizeMB: f.sizeMB,
      pages: f.pages,
      updatedBy: '',
      updatedAt: '',
    };
    runParse([fileRow], opts.parserId, { ...f.settings, chunking: opts.chunking }, true);
  };

  // 인덱스 목록 — 임베딩하면 대상 인덱스에 새 버전으로 쌓인다. (단일 소스)
  const [indexes, setIndexes] = useState<IndexWithVersions[]>(() => buildIndexListMock());
  const renameIndex = (id: string, name: string) =>
    setIndexes((cur) => cur.map((i) => (i.indexId === id ? { ...i, indexName: name } : i)));
  const editSynonyms = (id: string, synonyms: string[]) =>
    setIndexes((cur) => cur.map((i) => (i.indexId === id ? { ...i, synonyms } : i)));
  const indexBuildingCount = indexes.reduce(
    (s, i) => s + i.versions.filter((v) => v.state === 'building').length,
    0,
  );
  // 임베딩 옵션 모달 대상 데이터셋 (열려 있으면 모달 표시).
  const [embedModalBundle, setEmbedModalBundle] = useState<Bundle | null>(null);

  /** 임베딩 시작 — 옵션 모달에서 선택한 값으로 대상 인덱스에 새 버전 추가(building → ~2초 후 built). */
  const runEmbed = (bundle: Bundle, payload: EmbedStartPayload) => {
    const heads = bundle.docs.filter((d) => d.isGroupHead || !d.parentGroup);
    const docIds = new Set(bundle.docs.map((d) => d.id));
    const chunks =
      parseRun?.files
        .filter((f) => f.state === 'done' && docIds.has(f.id.split('__')[0]))
        .reduce((s, f) => s + f.chunks, 0) ?? 0;
    const createdAt = new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    setIndexes((cur) => {
      const target = cur.find((i) => i.indexName === payload.indexName);
      const nextVerNo = (target?.versions.length ?? 0) + 1;
      const newVer: IndexVersion = {
        version: `v${nextVerNo}`,
        createdAt,
        createdBy: '정오너',
        modelId: payload.modelId,
        kind: payload.kind,
        vectors: chunks,
        sizeMB: +(chunks * 0.0027).toFixed(1),
        fileIds: heads.map((h) => h.id),
        state: 'building',
        changeNote: `${bundle.name} 임베딩 · 문서 ${heads.length}건`,
      };
      if (target) {
        return cur.map((i) =>
          i.indexId === target.indexId ? { ...i, versions: [newVer, ...i.versions] } : i,
        );
      }
      // 새 인덱스 생성
      const newIndex: IndexWithVersions = {
        indexId: `idx-${Date.now()}`,
        indexName: payload.indexName,
        pendingChunks: 0,
        synonyms: [],
        versions: [newVer],
      };
      return [newIndex, ...cur];
    });
    setTab('index'); // 임베딩하면 인덱스 탭으로 이동
    // ~2초 뒤 빌드 완료 처리 (해당 인덱스의 최신 building 버전).
    window.setTimeout(() => {
      setIndexes((cur) =>
        cur.map((i) =>
          i.indexName === payload.indexName
            ? {
                ...i,
                versions: i.versions.map((v, vi) =>
                  vi === 0 && v.state === 'building' ? { ...v, state: 'built' } : v,
                ),
              }
            : i,
        ),
      );
    }, 2000);
  };

  // 파싱 진행 집계 — 탭 카운터 배지용
  const parseDone = parseRun?.files.filter((f) => f.state === 'done').length ?? 0;
  const parseRunning = parseRun?.files.filter((f) => f.state === 'run').length ?? 0;

  // 진행 상태 갱신은 파싱 시작 시 예약된 ~2초 타이머(runParse)가 처리한다.

  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));

  const toggleChecked = (id: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 그룹 헤더와 그룹에 속하지 않은 단독 파일은 항상 보임. 자식(이전 버전)만 접힘 토글.
  const visibleFileRows = fileRows.filter(
    (r) => r.isGroupHead || !r.parentGroup || openGroups[r.parentGroup],
  );

  // 전체 선택 — 폴더(이름 기준) + 파일 모두 포함.
  const allChecked = checked.size === FOLDER_ROWS.length + fileRows.length;
  const toggleSelectAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set([...FOLDER_ROWS.map((f) => f.name), ...fileRows.map((r) => r.id)]));
  };

  const totalMB = fileRows.filter((r) => checked.has(r.id)).reduce((s, r) => s + r.sizeMB, 0);
  // 처리 대기 = 업로드됐지만 아직 파싱이 완료되지 않은 신규 문서(대표본 기준).
  const parseDoneIds = new Set(
    parseRun?.files.filter((f) => f.state === 'done').map((f) => f.id) ?? [],
  );
  const pendingUploadCount = fileRows.filter(
    (r) => (r.isGroupHead || !r.parentGroup) && r.isNew && !parseDoneIds.has(r.id),
  ).length;
  // 폴더 진입 상태 (null이면 루트). 폴더명을 클릭하면 그 폴더 안으로 이동.
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const folderFiles = openFolder ? FOLDER_FILES[openFolder] ?? [] : [];

  // 저장소 목록 페이지네이션 (10/20/50개 보기). 버전 그룹이 쪼개지지 않게 최상위 문서 단위로 페이징.
  const [filePageSize, setFilePageSize] = useState(10);
  const [filePage, setFilePage] = useState(1);
  const topLevelRows = fileRows.filter((r) => r.isGroupHead || !r.parentGroup);
  const fileTotalPages = Math.max(1, Math.ceil(topLevelRows.length / filePageSize));
  const fileCurPage = Math.min(filePage, fileTotalPages);
  const pagedTopIds = new Set(
    topLevelRows.slice((fileCurPage - 1) * filePageSize, fileCurPage * filePageSize).map((r) => r.id),
  );
  const pagedGroups = new Set(
    topLevelRows
      .slice((fileCurPage - 1) * filePageSize, fileCurPage * filePageSize)
      .filter((r) => r.isGroupHead && r.parentGroup)
      .map((r) => r.parentGroup),
  );
  const pagedRows = visibleFileRows.filter((r) =>
    r.isGroupHead || !r.parentGroup
      ? pagedTopIds.has(r.id)
      : !!(r.parentGroup && pagedGroups.has(r.parentGroup)),
  );

  // ESC로 모달 닫기는 각 모달 내부에서 처리.
  useEffect(() => {
    document.title = '지식 데이터 · BNK 공동 생성형 AI 플랫폼';
  }, []);

  return (
    <div className={containerCls}>
      <Crumb items={crumbItems} />

      {/* Page head */}
      <div className="flex items-end justify-between gap-6 mb-3.5">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px] mb-1.5">지식 데이터</h1>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 py-[3px] px-2 border border-line-soft rounded-xl bg-white text-[11px] font-bold">
              <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">과제</span>
              <span className="text-ink font-extrabold">PB 에이전트 프로젝트</span>
            </span>
            <span
              title="이 과제의 인프라는 공동존 On-Premise 로 설정되어 있습니다"
              className="inline-flex items-center gap-1.5 py-[3px] px-2 border border-info-border rounded-xl bg-info-bg text-[11px] font-bold"
            >
              <span className="text-[10px] uppercase tracking-[0.3px] text-info font-bold">인프라</span>
              <span className="inline-flex items-center gap-1 text-info font-extrabold">
                <span aria-hidden className="text-[12px] leading-none">🏢</span>
                공동존 On-Prem
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-[11.5px] text-ink-mid">
          <span className="w-[7px] h-[7px] rounded-full bg-ok shadow-[0_0_0_3px_rgba(27,138,77,0.15)]" />
          <span>자동 저장됨 · 10:42 KST</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-line mb-3.5 -mt-1">
        <TabButton active={tab === 'storage'} onClick={() => setTab('storage')}>
          저장소
        </TabButton>
        <TabButton active={tab === 'manifest'} onClick={() => setTab('manifest')}>
          데이터셋
          {stagedDocCount > 0 && <TabCount tone="info">{stagedDocCount} 담김</TabCount>}
        </TabButton>
        <TabButton active={tab === 'index'} onClick={() => setTab('index')}>
          인덱스
          {indexBuildingCount > 0 && <TabCount tone="info">{indexBuildingCount} 빌드 중</TabCount>}
        </TabButton>
        <TabButton active={tab === 'eval'} onClick={() => setTab('eval')}>
          평가
        </TabButton>
        <TabButton active={tab === 'deploy'} onClick={() => setTab('deploy')}>
          배포
        </TabButton>
        <span className="flex-1" />
        {tab !== 'storage' && (
          <button
            onClick={() => setTab('storage')}
            className="text-[11.5px] text-info font-bold py-1.5 px-2.5 hover:underline"
          >
            ← 저장소로
          </button>
        )}
      </div>

      {/* Storage tab */}
      {tab === 'storage' && (
      <section className="card shadow-sm mb-3.5">
        <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
          <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
            지식 저장소
            {pendingUploadCount > 0 ? (
              <span
                title="업로드됐지만 아직 파싱·임베딩되지 않은 신규 문서입니다"
                className="inline-flex items-center gap-1 pill bg-warn-bg text-warn border border-warn-border"
              >
                ● 처리 대기 {pendingUploadCount}건
              </span>
            ) : (
              <span className="pill bg-surface-soft text-ink-light border border-line-soft">
                처리 대기 없음
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-ink-mid">
            파일 <b className="text-ink-dark font-extrabold">{fileRows.length}</b>개
            <span className="text-ink-light mx-1.5">·</span>
            <b className="text-ink-dark font-extrabold">
              {fileRows.reduce((s, r) => s + r.sizeMB, 0).toFixed(1)}
            </b>{' '}
            MB
          </div>
        </div>

        <div className="py-3.5 px-[18px]">
          {/* 검색 + 정렬 */}
          <div className="flex gap-2 items-center mb-2.5">
            <div className="relative flex-1 max-w-[340px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-xs pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                placeholder="이 폴더 내 검색"
                className="w-full h-[30px] py-0 pl-7 pr-2.5 border border-line rounded text-xs font-sans focus:outline-none focus:border-brand-dark"
              />
            </div>
            <span className="flex-1" />
            <select className="h-[30px] px-2.5 border border-line rounded text-xs bg-white">
              <option>이름 ↑</option>
              <option>추가일 ↓</option>
              <option>용량 ↓</option>
            </select>
          </div>

          {/* 경로 + 액션 */}
          <div className="flex items-center gap-2.5 mb-2.5 py-[7px] px-2.5 bg-surface-soft border border-line-soft rounded">
            <span className="text-ink-mid text-[11px] font-bold">경로</span>
            <div className="flex-1 flex items-center gap-1 text-xs text-ink-dark">
              <b className="text-ink font-extrabold">상품·시장 안내 매뉴얼</b>
              <span className="text-ink-light ml-1">·</span>
              {openFolder ? (
                <>
                  <button
                    onClick={() => setOpenFolder(null)}
                    className="text-info font-bold ml-0.5 hover:underline"
                  >
                    루트
                  </button>
                  <span className="text-ink-light mx-0.5">›</span>
                  <span className="text-ink font-extrabold">{openFolder}</span>
                </>
              ) : (
                <span className="text-ink-mid font-semibold ml-0.5">루트</span>
              )}
            </div>
            <button
              onClick={() => {
                const name = window.prompt('새 폴더 이름을 입력하세요');
                if (name) toast(`"${name}" 폴더가 생성됩니다 (목업).`);
              }}
              className="h-[30px] px-2.5 border border-line bg-white rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface"
            >
              ＋ 새 폴더
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="h-[30px] px-2.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
            >
              ↑ 파일 업로드
            </button>
          </div>

          {/* File table */}
          <table className="w-full border border-line-soft rounded overflow-hidden bg-white text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="w-6 text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">
                  <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} />
                </th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">이름</th>
                <th className="w-[78px] text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">용량</th>
                <th className="w-[104px] text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">변경일</th>
                <th className="w-[132px] py-2 px-2.5 border-b border-line-soft"></th>
              </tr>
            </thead>
            <tbody>
              {openFolder ? (
                folderFiles.map((r, i, arr) => (
                  <tr key={r.id} className="hover:bg-[#FDF6F4]">
                    <td className={cn('py-2 px-2.5', i < arr.length - 1 && 'border-b border-line-soft')}>
                      <input type="checkbox" />
                    </td>
                    <td className={cn('py-2 px-2.5', i < arr.length - 1 && 'border-b border-line-soft')}>
                      <div className="flex items-center gap-2 font-bold text-ink">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-8 h-8 rounded text-[8.5px] font-extrabold flex-shrink-0 border',
                            EXT_TONE[r.ext] ?? 'bg-surface-soft text-ink-mid border-line-soft',
                          )}
                        >
                          {r.ext}
                        </span>
                        <span className="text-ink font-bold">{r.name}</span>
                      </div>
                    </td>
                    <td className={cn('py-2 px-2.5 text-right tabular-nums font-bold text-ink-dark', i < arr.length - 1 && 'border-b border-line-soft')}>
                      {r.sizeMB.toFixed(1)} MB
                    </td>
                    <td className={cn('py-2 px-2.5 text-ink-mid text-[11px]', i < arr.length - 1 && 'border-b border-line-soft')}>{r.updatedAt}</td>
                    <td className={cn('py-2 px-2.5', i < arr.length - 1 && 'border-b border-line-soft')}>
                      <div className="flex gap-1 justify-end items-center">
                        <button
                          onClick={() =>
                            stagedIds.has(r.id) ? removeStaged(r.id) : stageOne(r, openFolder ?? SOURCE_PATH)
                          }
                          title={stagedIds.has(r.id) ? '데이터셋에서 빼기' : '데이터셋에 담기'}
                          className={cn(
                            'h-[26px] px-2 rounded border text-[11px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap',
                            stagedIds.has(r.id)
                              ? 'bg-info-bg text-info border-info-border hover:bg-white'
                              : 'bg-white text-ink-dark border-line hover:bg-brand-tint hover:border-brand-dark',
                          )}
                        >
                          {stagedIds.has(r.id) ? '− 빼기' : '＋ 담기'}
                        </button>
                        <RowActBtn title="미리보기" onClick={() => setOriginRow(r)}>👁</RowActBtn>
                        <span
                          title="공용 데이터는 중앙에서 관리됩니다."
                          className="text-[10.5px] text-ink-mid font-semibold ml-0.5"
                        >
                          🔒
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <>
              {fileCurPage === 1 && FOLDER_ROWS.map((f) => {
                const fFiles = FOLDER_FILES[f.name] ?? [];
                const fStaged = fFiles.length > 0 && fFiles.every((x) => stagedIds.has(x.id));
                return (
                <tr key={f.name} className={cn('hover:bg-[#FDF6F4]', checked.has(f.name) && 'bg-brand-tint')}>
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <input
                      type="checkbox"
                      checked={checked.has(f.name)}
                      onChange={() => toggleChecked(f.name)}
                    />
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <div className="flex items-center gap-2 font-bold text-ink">
                      <span className="inline-block w-3" />
                      <span className="inline-flex items-center justify-center w-7 h-8 rounded bg-brand-tint border border-brand-dark text-warn text-[10px] font-extrabold flex-shrink-0">
                        📁
                      </span>
                      <a
                        onClick={() => setOpenFolder(f.name)}
                        className="text-ink font-bold cursor-pointer hover:underline"
                      >
                        {f.name}
                      </a>
                      {f.openData && (
                        <span
                          title="모든 과제에서 공유되는 공용 데이터 문서"
                          className="inline-flex items-center gap-1 pill bg-info-bg text-info border border-info-border ml-1.5"
                        >
                          🌐 공용 데이터
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2.5 text-right border-b border-line-soft text-ink-mid font-semibold tabular-nums">—</td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px]">{f.updatedAt}</td>
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <div className="flex gap-1 justify-end items-center">
                      {fFiles.length > 0 && (
                        <button
                          onClick={() => (fStaged ? unstageFolder(f.name) : stageFolder(f.name))}
                          title={fStaged ? '폴더 파일 빼기' : `폴더 안 ${fFiles.length}개 파일 담기`}
                          className={cn(
                            'h-[26px] px-2 rounded border text-[11px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap',
                            fStaged
                              ? 'bg-info-bg text-info border-info-border hover:bg-white'
                              : 'bg-white text-ink-dark border-line hover:bg-brand-tint hover:border-brand-dark',
                          )}
                        >
                          {fStaged ? '− 빼기' : '＋ 담기'}
                        </button>
                      )}
                      {f.openData ? (
                        <span
                          className="text-[10.5px] text-ink-mid font-semibold ml-1"
                          title="공용 데이터는 중앙에서 관리됩니다. 이 과제에서는 수정·삭제할 수 없습니다."
                        >
                          🔒 읽기 전용
                        </span>
                      ) : (
                        <>
                          <RowActBtn title="이름 변경">✎</RowActBtn>
                          <RowActBtn title="제거">✕</RowActBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}

              {pagedRows.map((r, i, arr) => {
                const isLast = i === arr.length - 1;
                const isNew = r.isNew;
                const isChild = !!r.parentGroup && !r.isGroupHead;
                const isHead = r.isGroupHead;
                const isChecked = checked.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      'group transition-colors',
                      // 체크된 행 — 노란 하이라이트
                      isChecked
                        ? 'bg-brand-tint'
                        : isChild
                        ? 'bg-surface-soft hover:bg-[#FDF6F4]'
                        : 'bg-white hover:bg-[#FDF6F4]',
                      !isLast && 'border-b border-line-soft',
                    )}
                  >
                    <td className={cn('py-2 px-2.5', !isLast && 'border-b border-line-soft')}>
                      <input
                        type="checkbox"
                        checked={checked.has(r.id)}
                        onChange={() => toggleChecked(r.id)}
                      />
                    </td>
                    <td className={cn('py-2 px-2.5', !isLast && 'border-b border-line-soft')}>
                      <div className="flex items-center gap-2 font-bold text-ink">
                        {isHead ? (
                          <button
                            onClick={() => toggleGroup(r.parentGroup!)}
                            className={cn(
                              'w-3 h-3 inline-flex items-center justify-center text-[9px] text-ink-mid hover:text-ink transition-transform',
                              openGroups[r.parentGroup!] && 'rotate-90',
                            )}
                            aria-label="이전 버전 토글"
                          >
                            ▶
                          </button>
                        ) : (
                          <span className="inline-block w-3" />
                        )}
                        {isChild && <span className="inline-block w-3" />}
                        <FileTypeBadge ext={r.ext} />
                        <span className="flex items-center gap-1.5">
                          {r.name}
                          {isNew && (
                            <span className="inline-flex items-center text-[10px] font-extrabold py-[1px] px-1.5 rounded-full bg-ok-bg text-ok border border-ok-border">
                              NEW
                            </span>
                          )}
                          {isHead && r.priorCount != null && (
                            <span className="text-[10.5px] text-ink-mid font-semibold ml-1">
                              ＋ 이전 {r.priorCount}
                            </span>
                          )}
                          {isChild && (
                            <span className="text-[10.5px] text-ink-mid font-medium ml-1">이전 버전</span>
                          )}
                          {stagedIds.has(r.id) && !isChild && (
                            <span
                              title="데이터셋에 담긴 문서입니다"
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold py-[1px] px-1.5 rounded-full bg-info-bg text-info border border-info-border"
                            >
                              ✓ 담김
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className={cn('py-2 px-2.5 text-right tabular-nums font-bold text-ink-dark', !isLast && 'border-b border-line-soft')}>
                      {r.sizeMB.toFixed(1)} MB
                    </td>
                    <td className={cn('py-2 px-2.5 text-ink-mid text-[11px]', !isLast && 'border-b border-line-soft')}>{r.updatedAt}</td>
                    <td className={cn('py-2 px-2.5', !isLast && 'border-b border-line-soft')}>
                      <div className="flex gap-1 justify-end items-center">
                        {!isChild && (
                          <button
                            onClick={() => (stagedIds.has(r.id) ? removeStaged(r.id) : stageOne(r))}
                            title={stagedIds.has(r.id) ? '데이터셋에서 빼기' : '데이터셋에 담기'}
                            className={cn(
                              'h-[26px] px-2 rounded border text-[11px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap',
                              stagedIds.has(r.id)
                                ? 'bg-info-bg text-info border-info-border hover:bg-white'
                                : 'bg-white text-ink-dark border-line hover:bg-brand-tint hover:border-brand-dark',
                            )}
                          >
                            {stagedIds.has(r.id) ? '− 빼기' : '＋ 담기'}
                          </button>
                        )}
                        <RowActBtn title="미리보기" onClick={() => setOriginRow(r)}>
                          👁
                        </RowActBtn>
                        <RowActBtn
                          title="제거"
                          onClick={() => {
                            if (window.confirm(`"${r.name}"을(를) 삭제하시겠습니까?`)) {
                              deleteFiles(new Set([r.id]));
                            }
                          }}
                        >
                          ✕
                        </RowActBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
                </>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between gap-3 mt-2.5 text-[11px] text-ink-mid">
            <span className="flex items-center gap-2">
              <span>
                이 폴더에 <b className="text-ink-dark font-extrabold">{FOLDER_ROWS.length}</b>개 폴더 ·{' '}
                <b className="text-ink-dark font-extrabold">{topLevelRows.length}</b>개 파일
              </span>
              <select
                value={filePageSize}
                onChange={(e) => {
                  setFilePageSize(Number(e.target.value));
                  setFilePage(1);
                }}
                className="h-[26px] px-1.5 border border-line rounded text-[11px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
                title="페이지당 표시 개수"
              >
                <option value={10}>10개씩</option>
                <option value={20}>20개씩</option>
                <option value={50}>50개씩</option>
              </select>
            </span>
            <div className="flex gap-[3px] items-center">
              <button
                disabled={fileCurPage === 1}
                onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                className="h-[26px] px-2 border border-line bg-white rounded text-[11px] font-semibold text-ink-mid disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ 이전
              </button>
              {Array.from({ length: fileTotalPages }).map((_, i) => {
                const n = i + 1;
                const on = n === fileCurPage;
                return (
                  <button
                    key={n}
                    onClick={() => setFilePage(n)}
                    className={cn(
                      'h-[26px] min-w-[26px] px-1.5 border rounded text-[11px] font-bold tabular-nums',
                      on
                        ? 'border-brand-dark bg-brand-tint text-ink font-extrabold'
                        : 'border-line bg-white text-ink-dark hover:bg-surface',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                disabled={fileCurPage === fileTotalPages}
                onClick={() => setFilePage((p) => Math.min(fileTotalPages, p + 1))}
                className="h-[26px] px-2 border border-line bg-white rounded text-[11px] font-bold text-ink-dark hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음 ›
              </button>
            </div>
          </div>

          {/* 데이터셋 매니페스트 — 우측 슬라이드 드로어 (담기 누르면 열림) */}
          {stagedDocCount > 0 && (
            <>
              {!manifestOpen && (
                <button
                  onClick={() => setManifestOpen(true)}
                  className="fixed right-0 top-1/2 -translate-y-1/2 z-40 py-3 px-2 bg-info text-white rounded-l-lg shadow-lg text-[12px] font-extrabold [writing-mode:vertical-rl]"
                  title="데이터셋 매니페스트 열기"
                >
                  📦 데이터셋 {stagedDocCount}
                </button>
              )}
              <aside
                className={cn(
                  'fixed top-0 right-0 h-full w-[440px] max-w-[92vw] bg-white border-l border-line shadow-2xl z-50 flex flex-col transition-transform duration-200',
                  manifestOpen ? 'translate-x-0' : 'translate-x-full',
                )}
              >
                {/* 헤더 */}
                <div className="flex items-center gap-2 py-3 px-4 border-b border-line bg-info-bg">
                  <span className="inline-flex items-center gap-1.5 text-info font-extrabold text-[13px]">
                    📦 데이터셋 매니페스트
                  </span>
                  <span className="text-[11px] text-ink-mid font-semibold">
                    <b className="text-ink-dark">{stagedDocCount}</b>개 · {stagedTotalMB.toFixed(1)} MB
                  </span>
                  {batchConfirmed && <span className="text-ok font-bold text-[11px]">● 확정됨</span>}
                  <span className="flex-1" />
                  <button
                    onClick={() => setManifestOpen(false)}
                    title="접기"
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-white text-[17px] font-bold"
                  >
                    »
                  </button>
                </div>
              {/* 검색 */}
              <div className="px-3.5 py-2 border-b border-line-soft bg-white">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-light text-[11px] pointer-events-none">🔍</span>
                  <input
                    value={manifestQuery}
                    onChange={(e) => {
                      setManifestQuery(e.target.value);
                      setManifestPage(1);
                    }}
                    placeholder="담긴 문서 검색"
                    className="w-full h-8 pl-7 pr-2.5 border border-line rounded text-[12px] bg-surface-soft focus:outline-none focus:border-brand-dark"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-white">
                {manifestPageDocs.length === 0 ? (
                  <div className="py-12 text-center text-[12px] text-ink-light">
                    {manifestQuery ? '검색 결과가 없습니다' : '담긴 문서가 없습니다'}
                  </div>
                ) : (
                  manifestPageDocs.map((d, i) => {
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        'flex items-center gap-2.5 py-2 px-3.5 text-[12px]',
                        i < manifestPageDocs.length - 1 && 'border-b border-line-soft',
                      )}
                    >
                      <FileTypeBadge ext={d.ext} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-ink truncate">{d.name}</div>
                        <div className="text-[10px] text-ink-light truncate">{d.sourcePath}</div>
                      </div>

                      <button
                        onClick={() => removeStaged(d.id)}
                        title="매니페스트에서 빼기"
                        className="w-6 h-7 inline-flex items-center justify-center rounded text-ink-light hover:text-bad hover:bg-bad-bg text-[13px]"
                      >
                        ✕
                      </button>
                    </div>
                  );
                  })
                )}
              </div>
              <div className="flex items-center justify-between gap-2 py-2 px-3.5 border-t border-line-soft bg-surface-soft text-[11px] text-ink-mid">
                <div className="flex items-center gap-2">
                  <span>
                    {manifestFiltered.length}개 중 {manifestFiltered.length === 0 ? 0 : (manifestCurPage - 1) * manifestPageSize + 1}–
                    {Math.min(manifestCurPage * manifestPageSize, manifestFiltered.length)} 표시
                  </span>
                  <select
                    value={manifestPageSize}
                    onChange={(e) => {
                      setManifestPageSize(Number(e.target.value));
                      setManifestPage(1);
                    }}
                    className="h-[26px] px-1.5 border border-line rounded text-[11px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
                  >
                    <option value={10}>10개씩</option>
                    <option value={20}>20개씩</option>
                    <option value={50}>50개씩</option>
                  </select>
                </div>
                {manifestTotalPages > 1 && (
                  <div className="flex gap-[3px] items-center">
                    <button
                      disabled={manifestCurPage === 1}
                      onClick={() => setManifestPage((p) => Math.max(1, p - 1))}
                      className="h-[26px] px-2 border border-line bg-white rounded text-[11px] font-semibold text-ink-mid disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ‹ 이전
                    </button>
                    {Array.from({ length: manifestTotalPages }).map((_, i) => {
                      const n = i + 1;
                      const on = n === manifestCurPage;
                      return (
                        <button
                          key={n}
                          onClick={() => setManifestPage(n)}
                          className={cn(
                            'h-[26px] min-w-[26px] px-1.5 border rounded text-[11px] font-bold tabular-nums',
                            on
                              ? 'border-brand-dark bg-brand-tint text-ink font-extrabold'
                              : 'border-line bg-white text-ink-dark hover:bg-surface',
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                    <button
                      disabled={manifestCurPage === manifestTotalPages}
                      onClick={() => setManifestPage((p) => Math.min(manifestTotalPages, p + 1))}
                      className="h-[26px] px-2 border border-line bg-white rounded text-[11px] font-bold text-ink-dark hover:bg-surface disabled:opacity-40"
                    >
                      다음 ›
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 p-3 border-t border-line-soft">
                <button
                  onClick={() => setStaged([])}
                  className="h-8 px-3 bg-white border border-line rounded text-[12px] font-semibold text-ink-dark hover:bg-surface"
                >
                  담김 비우기
                </button>
                <span className="flex-1" />
                <button
                  onClick={confirmBatch}
                  className="h-8 px-3.5 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark"
                >
                  데이터셋 확정 → 파싱 청킹
                </button>
              </div>
              </aside>
            </>
          )}

          {/* 선택 액션 바 — 파싱에 담기 · 이동 · 삭제 */}
          {checked.size > 0 && (
            <div className="flex items-center gap-2.5 mt-3 py-2.5 px-3 bg-surface-soft border border-line-soft rounded text-[11.5px] text-ink-mid">
              <b className="text-ink-dark font-bold">선택 {checked.size}개</b>
              <span>·</span>
              <span>총 {totalMB.toFixed(1)} MB</span>
              <span className="flex-1" />
              <button
                onClick={() => setChecked(new Set())}
                className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface"
              >
                선택 해제
              </button>
              <button
                onClick={() => toast(`${checked.size}개 파일을 이동합니다 (목업).`)}
                className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface"
              >
                ⇄ 이동
              </button>
              <button
                onClick={stageChecked}
                className="h-7 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
              >
                ▶ 데이터셋에 담기
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`${checked.size}개 파일을 삭제하시겠습니까?`)) {
                    deleteFiles(new Set(checked));
                  }
                }}
                className="h-7 px-2.5 bg-white border border-bad-border rounded text-[11.5px] font-semibold text-bad hover:bg-bad-bg"
              >
                ✕ 삭제
              </button>
            </div>
          )}
        </div>
      </section>
      )}

      {/* Manifest tab — 파싱 대상 묶음(bundle) 목록 / 상세 */}
      {tab === 'manifest' &&
        (detailBundle ? (
          /* ===== 데이터셋 상세 = 파싱 청킹 화면 ===== */
          <>
            <div className="flex items-center gap-2.5 mb-2.5">
              <button
                onClick={() => {
                  setOpenBundle(null);
                  setManifestPage(1);
                  setManifestQuery('');
                }}
                className="text-info font-bold text-[11.5px] hover:underline flex-shrink-0"
              >
                ← 데이터셋 목록
              </button>
              <span className="flex-1" />
              {openBundle === 'working' && stagedDocCount > 0 && (
                <>
                  <button
                    onClick={() => setStaged([])}
                    className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface"
                  >
                    담김 비우기
                  </button>
                  <button
                    onClick={confirmBatch}
                    className="h-7 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
                  >
                    데이터셋 확정
                  </button>
                </>
              )}
            </div>
            <ParseSection
              title={detailBundle.name}
              staged={detailBundle.docs}
              runs={parseRun?.files ?? []}
              startedAt={parseRun?.startedAt}
              onRefresh={() => setParseRun(buildHistoryMock())}
              onShowResult={setResultFile}
              onStartFile={startParseRow}
              onRemoveStaged={removeStaged}
              onGotoStorage={() => setTab('storage')}
              onEmbed={detailBundle ? () => setEmbedModalBundle(detailBundle) : undefined}
            />
          </>
        ) : (
          /* ===== 묶음 목록 ===== */
          <section className="card shadow-sm mb-3.5">
            <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
              <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
                📦 데이터셋
                <span className="text-[11px] text-ink-mid font-semibold ml-0.5">
                  {bundles.length}개 · 저장소에서 담아 데이터셋을 만드세요
                </span>
              </div>
            </div>
            <div className="p-[18px] flex flex-col gap-2">
              {bundles.map((b) => {
                const heads = b.docs.filter((d) => d.isGroupHead || !d.parentGroup);
                const mb = b.docs.reduce((s, d) => s + d.sizeMB, 0);
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setOpenBundle(b.id);
                      setManifestPage(1);
                      setManifestQuery('');
                    }}
                    className="flex items-center gap-3 py-3 px-3.5 border border-line-soft rounded-lg bg-white text-left hover:border-brand-dark hover:bg-[#FDF6F4] transition-colors"
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-tint border border-brand-dark text-[16px] flex-shrink-0">
                      📦
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-extrabold text-ink truncate">{b.name}</span>
                      </div>
                      <div className="text-[11px] text-ink-mid font-semibold mt-0.5">
                        문서 <b className="text-ink-dark">{heads.length}</b>개 · {mb.toFixed(1)} MB · 인덱스 {b.indexCount} · {b.updatedAt}
                      </div>
                    </div>
                    <span className="text-ink-light text-[15px] flex-shrink-0">›</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      {/* Index tab — 인덱스 카드 (현재 버전 요약 + 접히는 버전 이력) */}
      {tab === 'index' && (
        <IndexSection
          onRefresh={() => setParseRun(buildHistoryMock())}
          indexes={indexes}
          onRename={renameIndex}
          onEditSynonyms={editSynonyms}
        />
      )}

      {/* 평가 tab — 학습계 검색 API를 골든셋으로 평가 */}
      {tab === 'eval' && <EvalSection />}

      {/* 배포 tab — 학습계(dev) / 서빙계(prod) 환경 토글 */}
      {tab === 'deploy' && <DeploySection indexes={indexes} />}

      {/* Footer actions */}
      <div className="flex items-center">
        <Link to="/projects/PRJ-101">
          <Button>← 과제 목록으로</Button>
        </Link>
      </div>

      {/* Modals */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={addUploadedFiles}
      />
      <ParseModal
        open={parseTargets.length > 0}
        onClose={() => setParseTargets([])}
        targets={parseTargets}
        onStart={startParseGroups}
      />
      <OriginViewerModal row={originRow} onClose={() => setOriginRow(null)} />
      <ParseResultModal
        file={resultFile}
        onClose={() => setResultFile(null)}
        onReparse={reparseFile}
      />
      <EmbedModal
        open={embedModalBundle != null}
        onClose={() => setEmbedModalBundle(null)}
        targets={(embedModalBundle?.docs ?? []).filter((d) => d.isGroupHead || !d.parentGroup)}
        indexes={indexes}
        onStart={(payload) => {
          if (embedModalBundle) runEmbed(embedModalBundle, payload);
        }}
      />
    </div>
  );
}

/* ---------- helpers ---------- */

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-extrabold border-b-2 -mb-px transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active
          ? 'text-ink border-brand-dark bg-brand-tint'
          : 'text-ink-mid border-transparent hover:text-ink-dark hover:bg-surface',
      )}
    >
      {children}
    </button>
  );
}

function TabCount({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'info' | 'ok' }) {
  const toneClass = {
    neutral: 'bg-white text-ink-mid border-line',
    info: 'bg-info-bg text-info border-info-border',
    ok: 'bg-ok-bg text-ok border-ok-border',
  }[tone];
  return (
    <span className={cn('inline-flex items-center text-[10px] font-extrabold py-[1px] px-1.5 rounded-full border', toneClass)}>
      {children}
    </span>
  );
}

function RowActBtn({ title, onClick, children }: { title: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-[26px] h-[26px] inline-flex items-center justify-center border border-line bg-white rounded text-ink-mid text-[13px] hover:bg-surface hover:text-ink-dark"
    >
      {children}
    </button>
  );
}

const EXT_STYLE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

function FileTypeBadge({ ext }: { ext: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-7 h-8 rounded border text-[9.5px] font-extrabold flex-shrink-0',
        EXT_STYLE[ext] ?? 'bg-white border-line-soft text-ink-mid',
      )}
    >
      {ext}
    </span>
  );
}

