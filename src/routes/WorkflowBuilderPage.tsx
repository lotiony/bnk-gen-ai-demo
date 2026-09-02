/**
 * 노코드 워크플로우 빌더 — 핸드오프 §2 화면 7.
 *
 * RFP: AGB-002 · AGB-005 · AGB-008
 *
 * 노코드 빌더라고 말하려면 화면이 실제로 세 가지를 해야 한다.
 *   ① 팔레트에서 캔버스로 **끌어다 놓기**  ② 노드를 **옮기기**
 *   ③ 포트를 끌어 **선을 잇기**
 * 셋 다 mock 이 아니라 실제 동작이다. 정지 이미지로 흉내 내면 시연 중
 * "직접 만들어 보시겠어요" 한 마디에 무너진다.
 *
 * 좌표계 — 노드는 절대 배치된 HTML(텍스트 선명), 관계선은 그 아래 SVG 레이어다.
 * 선은 **노드 경계의 포트 좌표에서 시작·종료**한다. 온톨로지 화면에서 얻은
 * 규칙과 같다: 선이 도형 안에서 튀어나오면 그래프가 싸구려로 보인다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { useWorkCrumb, useWorkContainer } from '@/lib/crumbs';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import { addTemplate, getTemplate } from '@/data/mockTemplates';
import {
  NODE_KINDS,
  KIND_META,
  SEED_NODES,
  SEED_EDGES,
  NODE_W,
  NODE_H,
  TRACE,
  TRACE_TOTAL,
  type NodeKind,
  type WfNode,
  type WfEdge,
  TRACE_FAIL,
  TRACE_FAIL_TOTAL,
  COMPENSATION_BY_NODE,
  CHECKPOINTS,
  LONG_RUNS,
  NL_GENERATION,
  type TraceStep,
} from '@/data/mockWorkflow';

/**
 * ## 좌표계 — 월드(world)와 뷰포트(viewport)를 분리한다
 *
 * 예전에는 캔버스 폭을 **실측해서** 그대로 좌표계로 썼다. 그래서 빌더가 AI Studio
 * 셸(사이드바 200px) 안으로 들어오자 캔버스 폭이 598px 로 줄었고, x=1006 에 있는
 * 마지막 노드부터 네 개가 통째로 잘렸다. 더 나쁜 건 **드래그 클램프도 실측 폭을
 * 썼다는 것** — 잘린 영역의 노드를 건드리면 좁은 폭 안으로 끌려 들어와 되돌릴 수
 * 없었다.
 *
 * 그래서 둘을 뗀다.
 *   · **월드** WORLD_W×WORLD_H — 뷰포트와 무관한 고정 좌표계. 노드 좌표·클램프·
 *     관계선 SVG 가 전부 이 위에서만 논다.
 *   · **뷰포트** — 월드를 들여다보는 창. 스크롤·줌·높이 조절은 여기서만 일어나고
 *     월드 좌표는 건드리지 않는다.
 *
 * 관계선 SVG 에 viewBox 를 걸면 SVG 좌표가 스케일되는데 노드는 절대 px 이라
 * 둘이 어긋난다 — 선이 노드 옆구리에서 시작하는 그 증상이다. 그래서 SVG 는
 * viewBox 없이 **월드 픽셀 좌표를 그대로** 쓰고, 확대·축소는 월드 레이어 전체에
 * 걸린 CSS transform 이 담당한다(노드와 선이 같은 변환을 받으므로 어긋나지 않는다).
 */
const WORLD_W = 1400;
const WORLD_H = 700;

/** 뷰포트 높이 — 하단 핸들로 이 범위 안에서 조절한다. */
const VIEW_H_MIN = 320;
const VIEW_H_MAX = 900;
const VIEW_H_DEFAULT = 470;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;
/**
 * **자동** 맞춤의 하한.
 * 598px 짜리 셸 안에 1184px 그래프를 다 넣으려면 48% 까지 줄여야 하는데,
 * 그러면 11.5px 노드 제목이 5.5px 가 되어 아무도 못 읽는다. 잘려 보이는 것보다
 * 나쁜 게 **읽을 수 없는 화면**이라, 자동 맞춤은 여기서 멈추고 나머지는
 * 스크롤·팬·전체화면에 넘긴다. 사용자가 − 버튼으로 더 줄이는 건 막지 않는다.
 */
const ZOOM_FIT_MIN = 0.7;

/** 출력 포트 좌표 — 노드 오른쪽 경계. 분기 노드는 위/아래로 나눈다. */
function outPort(n: WfNode, port: number) {
  const outs = KIND_META[n.kind].outs.length;
  const step = NODE_H / (outs + 1);
  return { x: n.x + NODE_W, y: n.y + step * (port + 1) };
}
/** 입력 포트 좌표 — 노드 왼쪽 경계 중앙. */
function inPort(n: WfNode) {
  return { x: n.x, y: n.y + NODE_H / 2 };
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(42, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

/** 셸 밖(프로젝트 경로)에서 단독으로 열릴 때의 컨테이너. */
const WORK_STANDALONE_CLS = 'max-w-[1760px] mx-auto px-8 pt-3.5 pb-10';
/** AI Studio · 지식 데이터 셸 안에서 열릴 때의 컨테이너. */
const WORK_SHELL_CLS = 'w-full pb-10';

export default function WorkflowBuilderPage() {
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-2025-PB-001';
  const crumbItems = useWorkCrumb('워크플로우 빌더', pid);
  const containerCls = useWorkContainer(WORK_STANDALONE_CLS, WORK_SHELL_CLS);

  const persona = useCurrentPersona();

  /*
   * 템플릿 복제 진입 — AI Studio 「템플릿에서 시작」의 `?tpl=TPL-02`.
   * 템플릿을 골랐는데 빈 캔버스(혹은 늘 같은 시드)가 뜨면 '복제' 가 말뿐이 된다.
   * 여기서 **캔버스를 템플릿 구성으로 채운 채** 연다.
   */
  const [params] = useSearchParams();
  const tplId = params.get('tpl');
  const tpl = useMemo(() => getTemplate(tplId), [tplId]);
  const tplGraph = tpl?.preset?.kind === '워크플로우' ? tpl.preset : null;

  /** 이 화면의 '원본' — 초기화 버튼이 되돌아갈 기준점. 템플릿이면 템플릿이다. */
  const baseNodes = tplGraph?.nodes ?? SEED_NODES;
  const baseEdges = tplGraph?.edges ?? SEED_EDGES;

  /** 화면 제목 — 템플릿에서 왔으면 그 사실이 제목에 드러나야 한다. */
  // '… 템플릿 (7단계)' 처럼 뒤에 괄호가 붙는 이름도 있으므로 끝이 아니라 단어로 지운다.
  const wfTitle = tplGraph ? tpl!.name.replace(/\s*템플릿/, '').trim() : '여신 상담 워크플로우';

  const [nodes, setNodes] = useState<WfNode[]>(() => baseNodes);
  const [edges, setEdges] = useState<WfEdge[]>(() => baseEdges);
  const [sel, setSel] = useState<string | null>(tplGraph ? 'n1' : 'n3');
  const [tab, setTab] = useState<'prop' | 'trace' | 'longrun'>('prop');
  const [runIdx, setRunIdx] = useState(-1);
  /*
   * 실행 모드 —
   *  'ok'   : 정상 경로 (조건 분기가 갈리는 것을 보여 준다)
   *  'fail' : MCP 호출 실패 → **Saga 보상 트랜잭션**이 역순으로 되돌린다(AGB-008 후단)
   * 성공 경로만 보여 주면 AGB-008 의 절반("일부 단계 실패 시 원상 복구")이 빈다.
   */
  const [runMode, setRunMode] = useState<'ok' | 'fail'>('ok');

  /**
   * 템플릿으로 저장 — RFP 2-1 "에이전트/워크플로우/프롬프트의 **템플릿화** 및
   * 조직 내 재사용 자산 관리".
   *
   * 토스트만 띄우면 요건 문장이 화면에서 증명되지 않는다. 저장한 템플릿은
   * AI Studio 「템플릿에서 시작」 목록에 실제로 나타난다(mockTemplates 스토어).
   */
  const saveTemplate = () => {
    const id = addTemplate({
      kind: '워크플로우',
      name: `${wfTitle} 템플릿 (${nodes.length}단계)`,
      desc: `현재 캔버스 구성을 그대로 복제 — 노드 ${nodes.length} · 연결 ${edges.length}`,
      savedBy: persona?.name ?? '현재 사용자',
      // 구성을 함께 담아야 나중에 「이 템플릿 사용하기」가 **이 캔버스**를 되살린다.
      preset: { kind: '워크플로우', nodes, edges },
    });
    toast(
      `템플릿으로 저장했습니다 · ${id}`,
      'AI Studio 「템플릿에서 시작」 목록에 등록되어 다른 팀도 복제해 시작할 수 있습니다',
      'ok',
    );
  };
  /* `?tpl=` 이 바뀌면(같은 빌더에 머문 채 다른 템플릿으로 진입) 캔버스를 다시 채운다. */
  useEffect(() => {
    setNodes(baseNodes);
    setEdges(baseEdges);
    setRunIdx(-1);
    setSel(tplGraph ? 'n1' : 'n3');
    touchedZoom.current = false;
    // baseNodes/baseEdges 는 tplId 로부터 파생된 값이라 tplId 만 보면 충분하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId]);

  /** 자연어 생성(AGB-003) — 입력 문장과 해석 결과 노출 여부. */
  const [nlText, setNlText] = useState('');
  const [nlParsed, setNlParsed] = useState(false);
  const activeTrace: TraceStep[] = runMode === 'fail' ? TRACE_FAIL : TRACE;
  const [linking, setLinking] = useState<{ from: string; port: number; x: number; y: number } | null>(null);

  /* ── 뷰포트 (월드와 분리된 '보는 창') ── */
  /** 월드 레이어 — 노드·관계선이 얹히는 고정 좌표계. 좌표 변환의 기준점이다. */
  const canvasRef = useRef<HTMLDivElement>(null);
  /** 스크롤 컨테이너 — 월드보다 작을 때 이 안에서 스크롤·팬이 일어난다. */
  const viewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewH, setViewH] = useState(VIEW_H_DEFAULT);
  /** 전체화면 — 시연 중 "직접 만들어 보시겠어요" 에 대응하는 넓은 작업면. */
  const [fullscreen, setFullscreen] = useState(false);
  /**
   * zoom 을 ref 로도 들고 있는 이유 — toCanvas 가 포인터 이벤트 리스너 안에서
   * 불린다. zoom 을 클로저로 잡으면 줌을 바꾼 뒤 리스너를 다시 붙일 때까지
   * **옛 배율로 좌표를 계산**해서 노드가 커서에서 미끄러진다.
   */
  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  /** 빈 배경 드래그 = 화면 팬. moved 로 '클릭(선택 해제)' 과 구분한다. */
  const panRef = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
  const seq = useRef(100);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  /**
   * 화면에 다 들어오는 배율을 계산한다.
   * 노드 클램프는 더 이상 이 값에 걸리지 않는다 — 월드 크기에만 걸린다.
   */
  const computeFit = useCallback(() => {
    const el = viewRef.current;
    if (!el) return 1;
    const pad = 28;
    const maxX = nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 1);
    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H), 1);
    const z = Math.min((el.clientWidth - pad) / maxX, (el.clientHeight - pad) / maxY, 1);
    return Math.max(ZOOM_FIT_MIN, Math.min(ZOOM_MAX, Number(z.toFixed(3))));
  }, [nodes]);

  /** 현재 배율로 그래프 전체가 뷰포트에 들어오는지 — 안 들어오면 안내를 띄운다. */
  const [overflowing, setOverflowing] = useState(false);

  const fit = useCallback(() => setZoom(computeFit()), [computeFit]);

  /**
   * 뷰포트가 좁아지면 자동으로 맞춘다.
   * 1280×720 에서는 캔버스 폭이 520px 남짓이라 자동 맞춤이 없으면 열자마자
   * 잘려 보인다 — 시연 첫인상이 여기서 갈린다. 다만 **사용자가 줌을 직접
   * 만진 뒤에는 건드리지 않는다**(발표 중 확대해 둔 화면이 리사이즈 한 번에
   * 되돌아가면 안 된다).
   */
  const touchedZoom = useRef(false);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const sync = () => {
      if (!touchedZoom.current) setZoom(computeFit());
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeFit]);

  /* 배율·노드·뷰포트가 바뀔 때마다 '다 보이는가' 를 다시 판정한다. */
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const maxX = nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 1);
    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H), 1);
    setOverflowing(maxX * zoom > el.clientWidth + 2 || maxY * zoom > el.clientHeight + 2);
  }, [nodes, zoom, viewH, fullscreen]);

  /** Ctrl/⌘ + 휠 확대·축소. React 의 onWheel 은 passive 라 preventDefault 가 먹지 않는다. */
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      touchedZoom.current = true;
      setZoom((z) =>
        Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number((z - Math.sign(e.deltaY) * ZOOM_STEP).toFixed(2)))),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /** 전체화면 탈출 — Esc. */
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  /* ── 실행 재생 ── */
  useEffect(() => {
    if (runIdx < 0 || runIdx >= activeTrace.length) return;
    // 실제 지연을 그대로 쓰면 30초짜리 타임아웃 스텝에서 시연이 멈춘다. 상한을 둔다.
    const t = setTimeout(
      () => setRunIdx((i) => i + 1),
      Math.min(900, 180 + activeTrace[runIdx].ms / 3),
    );
    return () => clearTimeout(t);
  }, [runIdx, activeTrace]);

  const run = () => {
    setTab('trace');
    setRunIdx(0);
  };

  const ranNodes = runIdx < 0 ? [] : activeTrace.slice(0, runIdx + 1).map((t) => t.nodeId);
  const running = runIdx >= 0 && runIdx < activeTrace.length;
  const doneAll = runIdx >= activeTrace.length;

  /**
   * 화면 좌표 → 월드 좌표.
   *
   * 월드 레이어에 `transform: scale()` 이 걸려 있으므로 getBoundingClientRect 는
   * **배율이 반영된** 박스를 돌려준다. transform-origin 이 0 0 이라 rect.left 는
   * 곧 월드 원점의 화면 x 이고, 스크롤도 여기에 이미 반영돼 있다. 따라서
   * 스크롤 오프셋을 따로 더할 필요가 없고 **배율로 나누기만** 하면 된다.
   * (여기서 배율을 빠뜨리면 확대 상태에서 노드가 커서보다 빨리 달아난다.)
   */
  const toCanvas = useCallback((e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    const z = zoomRef.current || 1;
    return { x: (e.clientX - (r?.left ?? 0)) / z, y: (e.clientY - (r?.top ?? 0)) / z };
  }, []);

  /* ── 노드 이동 ── */
  const onNodePointerDown = (e: React.PointerEvent, n: WfNode) => {
    if ((e.target as HTMLElement).dataset.port) return; // 포트는 선 잇기
    e.preventDefault();
    setSel(n.id);
    const p = toCanvas(e);
    dragRef.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onNodePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toCanvas(e);
    const x = Math.max(0, Math.min(WORLD_W - NODE_W, p.x - d.dx));
    const y = Math.max(0, Math.min(WORLD_H - NODE_H, p.y - d.dy));
    setNodes((ns) => ns.map((n) => (n.id === d.id ? { ...n, x, y } : n)));
  };
  const onNodePointerUp = () => {
    dragRef.current = null;
  };

  /* ── 포트 끌어 선 잇기 ── */
  const startLink = (e: React.PointerEvent, n: WfNode, port: number) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    setLinking({ from: n.id, port, x: p.x, y: p.y });
  };
  useEffect(() => {
    if (!linking) return;
    const move = (e: PointerEvent) => {
      const p = toCanvas(e);
      setLinking((l) => (l ? { ...l, x: p.x, y: p.y } : l));
    };
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const target = el?.closest('[data-nodeid]') as HTMLElement | null;
      const toId = target?.dataset.nodeid;
      setLinking((l) => {
        if (l && toId && toId !== l.from) {
          setEdges((es) => [
            // 같은 출발 포트에서 이미 나간 선은 갈아탄다 — 한 포트 = 한 경로
            ...es.filter((x) => !(x.from === l.from && x.port === l.port)),
            { id: `e${++seq.current}`, from: l.from, port: l.port, to: toId },
          ]);
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [linking, toCanvas]);

  /* ── 팔레트에서 끌어다 놓기 ── */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('text/wf-kind') as NodeKind;
    if (!kind || !KIND_META[kind]) return;
    const p = toCanvas(e);
    const id = `n${++seq.current}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        kind,
        title: KIND_META[kind].label,
        config: [{ k: '설정', v: '미지정' }],
        x: Math.max(0, Math.min(WORLD_W - NODE_W, p.x - NODE_W / 2)),
        y: Math.max(0, Math.min(WORLD_H - NODE_H, p.y - NODE_H / 2)),
      },
    ]);
    setSel(id);
    setTab('prop');
  };

  /* ── 빈 배경 드래그 = 화면 팬 ── */
  const onBgPointerDown = (e: React.PointerEvent) => {
    // 노드·포트 위에서 시작한 드래그는 팬이 아니다.
    if (e.target !== e.currentTarget) return;
    const el = viewRef.current;
    if (!el) return;
    panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onBgPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current;
    const el = viewRef.current;
    if (!pan || !el) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    // 임계값 — 손떨림을 팬으로 오해하면 '빈 곳 클릭 = 선택 해제' 가 죽는다.
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pan.moved = true;
    el.scrollLeft = pan.sl - dx;
    el.scrollTop = pan.st - dy;
  };
  const onBgPointerUp = () => {
    const pan = panRef.current;
    panRef.current = null;
    if (pan && !pan.moved) setSel(null);
  };

  /* ── 뷰포트 높이 조절 (하단 핸들) ── */
  const resizeRef = useRef<{ y: number; h: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeRef.current = { y: e.clientY, h: viewH };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    setViewH(Math.max(VIEW_H_MIN, Math.min(VIEW_H_MAX, r.h + (e.clientY - r.y))));
  };
  const onResizeUp = () => {
    resizeRef.current = null;
  };

  const zoomBy = (d: number) => {
    touchedZoom.current = true;
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number((z + d).toFixed(2)))));
  };

  const removeSelected = () => {
    if (!sel) return;
    setNodes((ns) => ns.filter((n) => n.id !== sel));
    setEdges((es) => es.filter((e) => e.from !== sel && e.to !== sel));
    setSel(null);
  };

  const selNode = sel ? nodeById[sel] : null;

  return (
    <div className={containerCls}>
      <Crumb items={crumbItems} />

      {/* 헤더 */}
      <div className="flex items-start gap-3 mt-2 mb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px]">
            {wfTitle}
            {tplGraph && <span className="text-ink-mid font-bold"> (복제본)</span>}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="pill bg-info-bg text-info border border-info-border">Studio (노코드)</span>
            <span className="pill bg-surface text-ink-mid border border-line-soft">
              노드 <b className="text-ink-dark">{nodes.length}</b> · 연결{' '}
              <b className="text-ink-dark">{edges.length}</b>
            </span>
            <span className="pill bg-brand-tint text-brand border border-brand-tint">
              {tplGraph ? 'WFL-신규' : 'WFL-101'}
            </span>
            {/*
              복제 출처를 화면에 남긴다 — RFP 2-1 「조직 내 재사용 자산 관리」는
              '누가 저장한 무엇을 복제했는지' 가 보여야 관리라고 말할 수 있다.
            */}
            {tpl && (
              <span className="pill bg-ok-bg text-ok border border-ok-border">
                {tpl.id} 템플릿에서 복제 · 저장 {tpl.savedBy} · {tpl.usedCount}회 사용
              </span>
            )}
            {['AGB-002', 'AGB-005', 'AGB-008'].map((r) => (
              <span key={r} className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          {/* 실행 모드 — 정상 / 실패→보상. AGB-008 후단을 시연하는 스위치다. */}
          <div className="inline-flex rounded border border-line overflow-hidden">
            {(
              [
                { k: 'ok' as const, label: '정상' },
                { k: 'fail' as const, label: '실패 → 보상' },
              ]
            ).map((m) => (
              <button
                key={m.k}
                onClick={() => {
                  setRunMode(m.k);
                  setRunIdx(-1);
                }}
                className={cn(
                  'h-8 px-2.5 text-[11.5px] font-extrabold',
                  runMode === m.k ? 'bg-brand-dark text-white' : 'bg-white text-ink-dark hover:bg-surface',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            onClick={saveTemplate}
            className="inline-flex items-center h-8 px-3 rounded border border-line bg-white text-[12px] font-bold text-ink-dark hover:bg-surface"
          >
            템플릿으로 저장
          </button>
          <button
            onClick={() => {
              setNodes(baseNodes);
              setEdges(baseEdges);
              setRunIdx(-1);
              setSel(tplGraph ? 'n1' : 'n3');
            }}
            className="inline-flex items-center h-8 px-3 rounded border border-line bg-white text-[12px] font-bold text-ink-dark hover:bg-surface"
          >
            ↺ 초기화
          </button>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center h-8 px-4 rounded bg-brand border border-brand-dark text-white text-[12px] font-extrabold hover:bg-brand-dark disabled:opacity-50"
          >
            {running ? '실행 중…' : runMode === 'fail' ? '▶ 실패 시나리오 실행' : '▶ 실행'}
          </button>
        </div>
      </div>

      {/*
        전체화면 — AI Studio 셸의 max-w 1360px 밖으로 나가는 유일한 통로다.
        셸 자체를 넓히면 다른 화면이 전부 흔들리므로 이 화면에서만 벗어난다.
      */}
      <div
        className={cn(
          'grid grid-cols-[170px_1fr_300px] gap-3',
          fullscreen && 'fixed inset-0 z-50 bg-surface-soft px-5 py-4 overflow-auto content-start',
        )}
      >
        {/* ── 팔레트 ── */}
        <aside className="card px-3 py-3 self-start">
          <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2">
            컴포넌트
          </div>
          <div className="space-y-1.5">
            {NODE_KINDS.map((k) => (
              <div
                key={k.kind}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/wf-kind', k.kind);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="flex items-center gap-2 border rounded px-2 py-1.5 bg-white cursor-grab active:cursor-grabbing hover:shadow-sm"
                style={{ borderColor: k.color }}
                title={k.desc}
              >
                <span
                  className="w-5 h-5 rounded-sm inline-flex items-center justify-center text-[11px] flex-shrink-0"
                  style={{ background: k.bg, color: k.color }}
                >
                  {k.icon}
                </span>
                <span className="text-[11.5px] font-extrabold text-ink-dark truncate">{k.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2.5 border-t border-line-soft text-[10px] text-ink-mid font-semibold leading-snug">
            캔버스로 끌어다 놓아 추가합니다. 노드 오른쪽 <b className="text-ink-dark">●</b> 를 끌면
            다음 노드로 연결됩니다.
          </div>

          {/*
            AGB-003 자연어 기반 워크플로우 생성 (권고).
            문장을 넣으면 노드가 툭 나오는 것처럼 보이면 신뢰가 떨어진다 —
            무엇을 어떻게 해석했는지를 먼저 펼친다.
          */}
          <div className="mt-3 pt-2.5 border-t border-line-soft">
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-[11px] font-extrabold text-ink">자연어로 만들기</span>
              <span className="rfp-chip ml-auto text-[9px] font-mono font-bold text-ink-light">AGB-003</span>
            </div>
            <textarea
              value={nlText}
              onChange={(e) => {
                setNlText(e.target.value);
                setNlParsed(false);
              }}
              rows={3}
              placeholder="수행할 업무 절차를 문장으로 쓰세요"
              className="w-full py-1.5 px-2 border border-line rounded text-[10.5px] bg-white leading-snug focus:outline-none focus:border-brand-dark resize-none"
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setNlText(NL_GENERATION.prompt);
                  setNlParsed(false);
                }}
                className="text-[10px] font-extrabold text-ink-mid hover:text-brand"
              >
                예시 넣기
              </button>
              <button
                type="button"
                disabled={!nlText.trim()}
                onClick={() => {
                  setNodes(baseNodes);
                  setEdges(baseEdges);
                  setRunIdx(-1);
                  setNlParsed(true);
                  toast('문장을 해석해 파이프라인을 생성했습니다 — 해석 결과를 확인하세요');
                }}
                className="ml-auto py-1 px-2.5 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✦ 생성
              </button>
            </div>

            {nlParsed && (
              <div className="mt-2 border border-line-soft rounded px-2.5 py-2 bg-surface-soft">
                <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">
                  해석 결과
                </div>
                <ul className="space-y-1 mb-2">
                  {NL_GENERATION.parsed.map((l) => {
                    const m = KIND_META[l.nodeKind];
                    return (
                      <li key={l.phrase} className="leading-snug">
                        <div className="text-[10px] font-bold text-ink-dark">"{l.phrase}"</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="pill border text-[9px]"
                            style={{ background: m.bg, color: m.color, borderColor: m.bg }}
                          >
                            {m.label}
                          </span>
                          <span className="text-[9.5px] text-ink-mid font-semibold truncate">
                            {l.as}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1 pt-1.5 border-t border-line-soft">
                  확인이 필요한 것
                </div>
                <ul className="space-y-0.5">
                  {NL_GENERATION.todo.map((t) => (
                    <li key={t} className="text-[9.5px] text-warn font-semibold leading-snug">
                      · {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* ── 캔버스 ── */}
        <section className="card overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-2 border-b border-line-soft flex items-center gap-2">
            {/*
              좁은 셸(1280 에서 캔버스 폭 516px)에서는 이 줄이 먼저 눌린다.
              nowrap + shrink-0 을 안 걸면 '캔버스' 가 세로로 쪼개진다.
            */}
            <span className="text-[12px] font-extrabold text-ink flex-shrink-0 whitespace-nowrap">
              캔버스
            </span>
            <span className="text-[10.5px] text-ink-mid font-semibold min-w-0 truncate hidden [@media(min-width:1600px)]:inline">
              노드를 끌어 옮기고 · 포트를 끌어 연결 · 빈 곳을 끌어 화면 이동
            </span>
            {overflowing && !fullscreen && (
              <button
                onClick={() => setFullscreen(true)}
                className="pill bg-warn-bg text-warn border border-warn-border hover:brightness-95 flex-shrink-0 whitespace-nowrap"
                title="전체화면으로 열면 축소 없이 전부 보인다"
              >
                일부가 화면 밖 · ⤢ 넓게
              </button>
            )}

            {/* 배율 — 좁은 셸에서도 전체가 보이게 하는 장치. 열 때 자동으로 맞춘다. */}
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              {sel && (
                <button
                  onClick={removeSelected}
                  className="pill bg-white text-bad border border-bad-border hover:bg-bad-bg mr-1 whitespace-nowrap"
                >
                  노드 삭제
                </button>
              )}
              <div className="inline-flex items-center rounded border border-line overflow-hidden bg-white">
                <button
                  onClick={() => zoomBy(-ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  title="축소 (Ctrl + 휠)"
                  className="w-7 h-[26px] text-[13px] font-extrabold text-ink-dark hover:bg-surface disabled:opacity-35"
                >
                  −
                </button>
                <span className="w-[46px] text-center text-[10.5px] font-extrabold text-ink-mid tabular-nums border-x border-line-soft leading-[26px]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => zoomBy(ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  title="확대 (Ctrl + 휠)"
                  className="w-7 h-[26px] text-[13px] font-extrabold text-ink-dark hover:bg-surface disabled:opacity-35"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  touchedZoom.current = false;
                  fit();
                }}
                title="전체가 보이도록 맞춘다"
                className="h-[26px] px-2 rounded border border-line bg-white text-[10.5px] font-extrabold text-ink-dark hover:bg-surface whitespace-nowrap"
              >
                맞춤
              </button>
              <button
                onClick={() => {
                  touchedZoom.current = true;
                  setZoom(1);
                }}
                title="실제 크기"
                className="h-[26px] px-2 rounded border border-line bg-white text-[10.5px] font-extrabold text-ink-dark hover:bg-surface whitespace-nowrap"
              >
                100%
              </button>
              <button
                onClick={() => setFullscreen((v) => !v)}
                title={fullscreen ? '전체화면 종료 (Esc)' : '전체화면으로 넓게 쓰기'}
                className="h-[26px] px-2 rounded border border-line bg-white text-[10.5px] font-extrabold text-ink-dark hover:bg-surface whitespace-nowrap"
              >
                {fullscreen ? '⤡ 종료' : '⤢ 넓게'}
              </button>
            </div>
          </div>

          {/* 뷰포트 — 월드보다 좁으면 스크롤된다. 월드 좌표는 여기 영향을 받지 않는다. */}
          <div
            ref={viewRef}
            className="relative overflow-auto bg-surface-soft"
            style={{ height: fullscreen ? 'calc(100vh - 129px)' : viewH }}
          >
          {/*
            축소하면 월드는 시각적으로만 작아지고 **레이아웃 상자는 그대로**라
            오른쪽에 빈 스크롤 영역이 남는다. 배율을 곱한 크기의 상자를 하나 씌워
            스크롤 범위를 실제 그림 크기에 맞춘다.
          */}
          <div style={{ width: WORLD_W * zoom, height: WORLD_H * zoom }}>
          <div
            ref={canvasRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={onDrop}
            onPointerDown={onBgPointerDown}
            onPointerMove={onBgPointerMove}
            onPointerUp={onBgPointerUp}
            className="relative bg-white bg-[linear-gradient(#F2F2F2_1px,transparent_1px),linear-gradient(90deg,#F2F2F2_1px,transparent_1px)] bg-[size:22px_22px]"
            style={{
              width: WORLD_W,
              height: WORLD_H,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 관계선 레이어 */}
            <svg className="absolute inset-0 pointer-events-none" width={WORLD_W} height={WORLD_H}>
              <defs>
                <marker id="wf-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#B4B4B4" />
                </marker>
                <marker id="wf-ar-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#CB2C10" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = nodeById[e.from];
                const b = nodeById[e.to];
                if (!a || !b) return null;
                const on = ranNodes.includes(e.from) && ranNodes.includes(e.to);
                const p1 = outPort(a, e.port);
                const p2 = inPort(b);
                return (
                  <g key={e.id}>
                    <path
                      d={edgePath(p1, { x: p2.x - 7, y: p2.y })}
                      fill="none"
                      stroke={on ? '#CB2C10' : '#B4B4B4'}
                      strokeWidth={on ? 2.2 : 1.5}
                      markerEnd={on ? 'url(#wf-ar-on)' : 'url(#wf-ar)'}
                    />
                    {on && (
                      <path
                        d={edgePath(p1, { x: p2.x - 7, y: p2.y })}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="1.4"
                        strokeDasharray="6 8"
                        strokeLinecap="round"
                        className="og-flowdash"
                        opacity="0.8"
                      />
                    )}
                    {KIND_META[a.kind].outs.length > 1 && (
                      <text
                        x={p1.x + 12}
                        y={p1.y - 5}
                        fontSize="10"
                        fontWeight="800"
                        fill={on ? '#CB2C10' : '#999999'}
                      >
                        {KIND_META[a.kind].outs[e.port]}
                      </text>
                    )}
                  </g>
                );
              })}
              {linking &&
                (() => {
                  const a = nodeById[linking.from];
                  if (!a) return null;
                  return (
                    <path
                      d={edgePath(outPort(a, linking.port), { x: linking.x, y: linking.y })}
                      fill="none"
                      stroke="#CB2C10"
                      strokeWidth="1.8"
                      strokeDasharray="5 4"
                    />
                  );
                })()}
            </svg>

            {/* 노드 레이어 */}
            {nodes.map((n) => {
              const m = KIND_META[n.kind];
              const ran = ranNodes.includes(n.id);
              // 실행 중 노드는 **활성 Trace** 기준이어야 한다. 실패→보상 모드에서
              // TRACE(정상 시나리오)를 보면 캔버스와 Trace 패널이 다른 노드를 가리킨다.
              const now = running && activeTrace[runIdx]?.nodeId === n.id;
              const skipped = doneAll && !ranNodes.includes(n.id);
              return (
                <div
                  key={n.id}
                  data-nodeid={n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  className={cn(
                    'absolute rounded border-2 bg-white select-none cursor-grab active:cursor-grabbing shadow-sm',
                    sel === n.id && 'ring-2 ring-brand/35',
                    skipped && 'opacity-45',
                  )}
                  style={{
                    left: n.x,
                    top: n.y,
                    width: NODE_W,
                    height: NODE_H,
                    borderColor: now ? '#CB2C10' : ran ? m.color : '#E0E0E1',
                    background: now ? '#FBE9E6' : ran ? m.bg : '#FFFFFF',
                  }}
                >
                  <div className="flex items-center gap-1.5 px-2 pt-1.5">
                    <span
                      className="w-[18px] h-[18px] rounded-sm inline-flex items-center justify-center text-[10px] flex-shrink-0"
                      style={{ background: m.bg, color: m.color }}
                    >
                      {m.icon}
                    </span>
                    <span className="text-[9.5px] font-extrabold uppercase tracking-[0.3px]" style={{ color: m.color }}>
                      {m.label}
                    </span>
                    {now && <span className="ml-auto text-[9px] font-extrabold text-brand">실행 중</span>}
                    {ran && !now && <span className="ml-auto text-[10px] text-ok font-extrabold">✓</span>}
                  </div>
                  <div className="px-2 pt-0.5 text-[11.5px] font-extrabold text-ink truncate">
                    {n.title}
                  </div>

                  {/* 입력 포트 */}
                  {n.kind !== 'input' && (
                    <span
                      className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full bg-white border-2"
                      style={{ borderColor: m.color }}
                    />
                  )}
                  {/* 출력 포트 */}
                  {m.outs.map((label, i) => {
                    const step = NODE_H / (m.outs.length + 1);
                    return (
                      <span
                        key={label}
                        data-port="1"
                        onPointerDown={(e) => startLink(e, n, i)}
                        title={`${label} 경로 연결`}
                        className="absolute right-[-6px] w-[11px] h-[11px] rounded-full bg-white border-2 cursor-crosshair hover:scale-125 transition-transform"
                        style={{ borderColor: m.color, top: step * (i + 1) - 5.5 }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          </div>
          </div>

          {/*
            높이 조절 핸들 — 세로로 늘렸다 줄였다.
            분기 노드가 위아래로 벌어지는 그래프라 세로 여유가 판독성을 좌우한다.
          */}
          {!fullscreen && (
            <div
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              title="끌어서 캔버스 높이 조절"
              className="h-[9px] flex items-center justify-center cursor-ns-resize border-t border-line-soft bg-white hover:bg-surface group"
            >
              <span className="w-9 h-[3px] rounded-full bg-line group-hover:bg-ink-light" />
            </div>
          )}
        </section>

        {/* ── 속성 / Trace ── */}
        <aside
          className="card flex flex-col self-start"
          style={{ maxHeight: fullscreen ? 'calc(100vh - 88px)' : viewH + 50 }}
        >
          <div className="flex items-center border-b border-line-soft">
            {(
              [
                { k: 'prop', label: '속성' },
                { k: 'trace', label: '실행 Trace' },
                { k: 'longrun', label: '장기 실행' },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  'flex-1 py-2.5 text-[12px] font-extrabold border-b-2',
                  tab === t.k ? 'border-brand text-brand' : 'border-transparent text-ink-mid hover:text-ink-dark',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {tab === 'prop' ? (
              selNode ? (
                <PropPanel node={selNode} onTitle={(v) => setNodes((ns) => ns.map((n) => (n.id === selNode.id ? { ...n, title: v } : n)))} />
              ) : (
                <div className="text-[11.5px] text-ink-mid font-semibold leading-relaxed">
                  노드를 선택하면 속성이 표시됩니다. 팔레트에서 캔버스로 끌어다 놓아 새 노드를
                  추가할 수 있습니다.
                </div>
              )
            ) : tab === 'trace' ? (
              <TracePanel runIdx={runIdx} nodeById={nodeById} trace={activeTrace} mode={runMode} />
            ) : (
              <LongRunPanel />
            )}
          </div>
        </aside>
      </div>

      <div className="mt-3.5">
        <Link
          to={`/projects/${pid}`}
          className="inline-flex items-center h-8 px-3 border border-line rounded text-[12px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
        >
          ← 과제 목록으로
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════ 속성 패널 ═══════════════════════ */

function PropPanel({ node, onTitle }: { node: WfNode; onTitle: (v: string) => void }) {
  const m = KIND_META[node.kind];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-5 h-5 rounded-sm inline-flex items-center justify-center text-[11px]"
          style={{ background: m.bg, color: m.color }}
        >
          {m.icon}
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.4px]" style={{ color: m.color }}>
          {m.label}
        </span>
        <span className="ml-auto text-[10px] font-mono text-ink-light">{node.id}</span>
      </div>
      <p className="text-[11px] text-ink-mid font-semibold mb-2.5">{m.desc}</p>

      <label className="block text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-1">
        노드 이름
      </label>
      <input
        value={node.title}
        onChange={(e) => onTitle(e.target.value)}
        className="w-full h-8 px-2 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark mb-3"
      />

      <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-1.5">
        설정
      </div>
      <dl className="space-y-1.5">
        {node.config.map((c) => (
          <div key={c.k} className="grid grid-cols-[84px_1fr] gap-2 items-start">
            <dt className="text-[10.5px] font-bold text-ink-light pt-[1px]">{c.k}</dt>
            <dd className="text-[11.5px] font-semibold text-ink-dark break-words">{c.v}</dd>
          </div>
        ))}
      </dl>

      {node.kind === 'agent' && (
        <div className="mt-3 pt-2.5 border-t border-line-soft text-[10.5px] text-ink-mid font-semibold leading-snug">
          이 노드는 <b className="text-ink-dark">승인 완료(Approved)</b> 상태의 에이전트만 호출한다.
          Draft 에이전트를 지정하면 배포 결재에서 반려된다.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Trace 패널 ═══════════════════════ */

/** 스텝 상태별 시각 규칙 — 실패와 보상은 색으로 구분해야 한 눈에 읽힌다. */
const STEP_TONE = {
  ok: { box: 'border-line-soft', badge: '', label: '' },
  fail: { box: 'border-bad bg-bad-bg', badge: 'bg-bad text-white', label: '실패' },
  compensated: {
    box: 'border-warn bg-warn-bg',
    badge: 'bg-warn text-white',
    label: '보상',
  },
} as const;

function TracePanel({
  runIdx,
  nodeById,
  trace,
  mode,
}: {
  runIdx: number;
  nodeById: Record<string, WfNode>;
  trace: TraceStep[];
  mode: 'ok' | 'fail';
}) {
  if (runIdx < 0) {
    return (
      <div className="text-[11.5px] text-ink-mid font-semibold leading-relaxed">
        상단 <b className="text-ink-dark">▶ 실행</b> 을 누르면 노드별 입·출력과 소요 시간이 여기에
        기록됩니다.
        {mode === 'fail' && (
          <>
            <br />
            <br />
            <b className="text-ink-dark">실패 → 보상</b> 모드에서는 MCP 호출이 타임아웃되고, 이미
            완료된 단계가 <b className="text-ink-dark">역순으로</b> 되돌려집니다(Saga 보상
            트랜잭션).
          </>
        )}
      </div>
    );
  }
  const shown = trace.slice(0, runIdx + 1);
  const done = runIdx >= trace.length;

  return (
    <div>
      {done &&
        (mode === 'fail' ? (
          <div className="border border-warn-border bg-warn-bg rounded px-3 py-2 mb-2.5">
            <div className="text-[11.5px] font-extrabold text-warn mb-0.5">
              실행 실패 · 보상 완료
            </div>
            <div className="text-[10.5px] text-ink-dark font-semibold leading-snug">
              {nodeById[TRACE_FAIL_TOTAL.failedAt]?.title ?? TRACE_FAIL_TOTAL.failedAt} 에서
              실패 · 완료된 단계 {TRACE_FAIL_TOTAL.compensated}건을 역순으로 원상 복구했다.
              <br />
              부수효과가 없는 조회·분기 노드는 보상 대상이 아니다.
            </div>
          </div>
        ) : (
          <div className="border border-ok-border bg-ok-bg rounded px-3 py-2 mb-2.5">
            <div className="text-[11.5px] font-extrabold text-ok mb-0.5">실행 완료</div>
            <div className="text-[10.5px] text-ink-dark font-semibold leading-snug">
              총 {TRACE_TOTAL.ms.toLocaleString('ko-KR')}ms · 토큰 입력{' '}
              {TRACE_TOTAL.tokensIn.toLocaleString('ko-KR')} / 출력{' '}
              {TRACE_TOTAL.tokensOut.toLocaleString('ko-KR')}
            </div>
            {TRACE_TOTAL.skipped.length > 0 && (
              <div className="text-[10.5px] text-ink-mid font-semibold mt-1 leading-snug">
                미실행: {TRACE_TOTAL.skipped.join(' · ')} — 조건 분기가 다른 경로를 탔다
              </div>
            )}
          </div>
        ))}
      <ol className="space-y-2">
        {shown.map((s, i) => {
          const n = nodeById[s.nodeId];
          const m = n ? KIND_META[n.kind] : null;
          const st = s.status ?? 'ok';
          const tone = STEP_TONE[st];
          const comp = COMPENSATION_BY_NODE[s.nodeId];
          return (
            <li
              key={`${s.nodeId}-${i}`}
              className={cn('og-step border rounded px-2.5 py-2', tone.box)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={cn(
                    'w-[17px] h-[17px] rounded-full inline-flex items-center justify-center text-[9.5px] font-extrabold',
                    st === 'ok'
                      ? 'bg-surface text-ink-mid border border-line'
                      : tone.badge,
                  )}
                >
                  {st === 'fail' ? '!' : st === 'compensated' ? '↩' : i + 1}
                </span>
                <span className="text-[11.5px] font-extrabold text-ink truncate">
                  {n?.title ?? s.nodeId}
                </span>
                {m && st === 'ok' && (
                  <span
                    className="pill border"
                    style={{ background: m.bg, color: m.color, borderColor: m.bg }}
                  >
                    {m.label}
                  </span>
                )}
                {st !== 'ok' && (
                  <span className={cn('pill', tone.badge)}>{tone.label}</span>
                )}
                <span className="ml-auto text-[10px] font-bold text-ink-mid tabular-nums">
                  {s.ms.toLocaleString('ko-KR')}ms
                </span>
              </div>
              <KV k="입력" v={s.input} />
              <KV k="출력" v={s.output} />
              {s.branch && <KV k="분기" v={`'${s.branch}' 경로 선택`} strong />}
              {s.tokens && (
                <KV
                  k="토큰"
                  v={`입력 ${s.tokens.in.toLocaleString('ko-KR')} · 출력 ${s.tokens.out.toLocaleString('ko-KR')}`}
                />
              )}
              {st === 'compensated' && s.compensation && (
                <KV k="역연산" v={s.compensation} strong />
              )}
              {st === 'fail' && comp && !comp.compensable && (
                <KV k="보상" v="이 노드는 부수효과가 없어 되돌릴 것이 없다" />
              )}
              {s.checkpoint && (
                <div className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-extrabold text-info">
                  ⚑ 체크포인트 저장 · {s.checkpoint}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ═══════════════════════ 장기 실행 패널 ═══════════════════════ */

/**
 * AGB-002 후단: "수시간~수일에 걸친 장기 실행(Long-running) 워크플로우에 대한
 * 체크포인트 기반 장애 복구 기능 제공".
 *
 * 여신 상담은 서류 보완·심사역 검토로 실제로 수일이 걸린다. 그래서 실행이 며칠째
 * 멈춰 있는 것이 정상이고, 장애가 나도 **처음이 아니라 마지막 체크포인트에서** 재개한다.
 */
function LongRunPanel() {
  /**
   * 재개한 실행 — runId → 재개 시각.
   *
   * "재개합니다" 토스트만 띄우고 배지가 '장애 · 재개 가능' 으로 남으면 화면이
   * 스스로와 모순된다. AGB-002(필수·상세제안)의 체크포인트 복구 증빙이라
   * 상태가 실제로 바뀌어야 한다.
   */
  const [resumedAt, setResumedAt] = useState<Record<string, string>>({});
  const resume = (runId: string, checkpoint: string) => {
    const at = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setResumedAt((m) => ({ ...m, [runId]: at }));
    toast(
      `${runId} 재개`,
      `${checkpoint} 에서 재개했습니다 — 처음이 아니라 마지막 체크포인트부터 이어집니다`,
      'ok',
    );
  };

  return (
    <div>
      <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
        체크포인트 정의
      </div>
      <ol className="space-y-1.5 mb-3">
        {CHECKPOINTS.map((c) => (
          <li key={c.id} className="border border-line-soft rounded px-2.5 py-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-mono font-extrabold text-info">{c.id}</span>
              <span className="text-[11.5px] font-extrabold text-ink">{c.label}</span>
              <span className="ml-auto text-[9.5px] font-bold text-ink-mid">보존 {c.ttl}</span>
            </div>
            <p className="text-[10.5px] text-ink-dark font-semibold mt-0.5 leading-snug">
              {c.state}
            </p>
          </li>
        ))}
      </ol>

      <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
        재개 대기 실행 {LONG_RUNS.length - Object.keys(resumedAt).length}건
        {Object.keys(resumedAt).length > 0 && (
          <span className="ml-1 text-ok">· 재개 {Object.keys(resumedAt).length}건</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {LONG_RUNS.map((r) => {
          const resumed = resumedAt[r.runId];
          const broken = r.state === '장애 · 재개 가능' && !resumed;
          const stateLabel = resumed ? '재개됨' : r.state;
          return (
            <li
              key={r.runId}
              className={cn(
                'border rounded px-2.5 py-2',
                broken ? 'border-warn bg-warn-bg' : 'border-line-soft',
              )}
            >
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[10.5px] font-mono font-extrabold text-ink">{r.runId}</span>
                <span
                  className={cn(
                    'pill border',
                    broken
                      ? 'bg-warn text-white border-warn'
                      : resumed
                      ? 'bg-ok text-white border-ok'
                      : 'bg-surface-soft text-ink-mid border-line-soft',
                  )}
                >
                  {stateLabel}
                </span>
                <span className="ml-auto text-[9.5px] font-bold text-ink-mid tabular-nums">
                  경과 {r.elapsed}
                </span>
              </div>
              <p className="text-[10.5px] text-ink-dark font-semibold leading-snug">
                {resumed
                  ? `${r.lastCheckpoint} 에서 재개 · ${resumed} — 이후 단계부터 이어서 실행 중`
                  : r.waitingOn}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[9.5px] font-extrabold text-info">
                  ⚑ {r.lastCheckpoint}
                </span>
                {broken && (
                  <button
                    type="button"
                    onClick={() => resume(r.runId, r.lastCheckpoint)}
                    className="ml-auto text-[10px] font-extrabold text-ink-dark border border-line rounded px-2 py-[2px] bg-white hover:border-brand-dark hover:text-brand"
                  >
                    ↻ 체크포인트에서 재개
                  </button>
                )}
                {resumed && (
                  <span className="ml-auto text-[9.5px] font-extrabold text-ok">
                    ✓ {resumed} 재개
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[34px_1fr] gap-1.5 items-start">
      <span className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.3px] pt-[2px]">
        {k}
      </span>
      <span className={cn('text-[11px] leading-snug break-words', strong ? 'font-extrabold text-brand' : 'font-semibold text-ink-dark')}>
        {v}
      </span>
    </div>
  );
}
