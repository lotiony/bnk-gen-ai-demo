/**
 * 그래프 레이아웃 엔진 — climax/frontend/src/components/OntologyGraph.jsx 이식.
 *
 * 그래프 설계 · 데이터 매핑 · Query 가 **같은 레이아웃**을 공유한다.
 * 원본과 동일하게 d3-force 를 쓰되 힘 구성도 그대로 옮겼다:
 *   · 계층 깊이(subClassOf) 를 x 축에 앵커 — 상위 클래스가 왼쪽 열
 *   · 속성은 위성 노드로 편입하고 **궤도력**으로 호스트 둘레에 균등 배치
 *   · charge(반발) · collide(충돌) · forceY(세로 수렴)
 *
 * 드래그하면 reheat 되어 연결 노드가 물리적으로 딸려온다.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import type { OntologyClass, OntologyRelation } from '@/data/ontology';

export const CLASS_R = 25;
/** 속성 위성 반지름 — 클래스의 절반(원본 PR). */
export const PROP_R = 12.5;
export const PROP_COLOR = '#A6ADB6';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  r: number;
  isProp: boolean;
  /** 속성이면 호스트 클래스 uri. */
  host?: string;
  /** 계층 깊이 앵커 x. */
  tx: number;
  d0: number;
  ghost?: boolean;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  kind?: 'prop' | 'rel';
}

/** 관계 연결 수. */
export function degreeMap(classes: OntologyClass[], rels: OntologyRelation[]) {
  const d: Record<string, number> = Object.fromEntries(classes.map((c) => [c.name, 0]));
  for (const r of rels) {
    if (r.domain in d) d[r.domain] += 1;
    if (r.range in d) d[r.range] += 1;
  }
  return d;
}

/**
 * 계층 앵커 깊이 — 상위 클래스를 0열, 직계 하위를 부모+1열에 두고
 * 계층 밖 클래스는 관계 BFS 홉 수로 오른쪽에 전개한다.
 */
export function hierarchyDepth(classes: OntologyClass[], rels: OntologyRelation[]): Record<string, number> {
  const present = new Set(classes.map((c) => c.name));
  const parentOf: Record<string, string> = {};
  for (const c of classes) if (c.parent && present.has(c.parent)) parentOf[c.name] = c.parent;

  const depth: Record<string, number> = {};
  const dOf = (u: string, guard = 0): number => {
    if (depth[u] != null) return depth[u];
    if (guard > 30) return (depth[u] = 0);
    if (parentOf[u]) return (depth[u] = dOf(parentOf[u], guard + 1) + 1);
    return (depth[u] = 0);
  };
  Object.keys(parentOf).forEach((u) => dOf(u));

  // 관계 BFS — 계층에 안 걸린 클래스를 홉 수로 오른쪽 전개
  const adj: Record<string, string[]> = {};
  classes.forEach((c) => (adj[c.name] = []));
  for (const r of rels) {
    if (adj[r.domain] && adj[r.range]) {
      adj[r.domain].push(r.range);
      adj[r.range].push(r.domain);
    }
  }
  const seeds = classes.filter((c) => depth[c.name] != null).map((c) => c.name);
  const queue = seeds.length ? [...seeds] : [classes[0]?.name].filter(Boolean);
  queue.forEach((s) => (depth[s] = depth[s] ?? 0));
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    for (const v of adj[u] ?? []) {
      if (depth[v] == null) {
        depth[v] = depth[u] + 1;
        queue.push(v);
      }
    }
  }
  classes.forEach((c) => (depth[c.name] = depth[c.name] ?? 0));
  return depth;
}

const LAYER = 400; // 깊이 1층 가로 간격

export interface BuiltSim {
  sim: Simulation<SimNode, undefined>;
  byId: Map<string, SimNode>;
}

export function buildSim(classes: OntologyClass[], rels: OntologyRelation[]): BuiltSim {
  const deg = degreeMap(classes, rels);
  const depth = hierarchyDepth(classes, rels);
  const maxD = Math.max(0, ...classes.map((c) => depth[c.name]));
  const spanY = Math.max(420, Math.sqrt(classes.length) * 110);
  const span = Math.max(spanY, (maxD + 1) * LAYER);

  const layerSeq: Record<number, number> = {};
  const nodes: SimNode[] = [];

  classes.forEach((c, i) => {
    const d0 = depth[c.name];
    const k = (layerSeq[d0] = (layerSeq[d0] ?? 0) + 1);
    const off = Math.min(Math.floor(k / 2) * 95, LAYER * 0.45);
    const tx = d0 * LAYER + (k % 2 ? 1 : -1) * off;
    nodes.push({
      id: c.name,
      label: c.name,
      r: CLASS_R,
      isProp: false,
      tx,
      d0,
      x: tx + ((i * 53) % 90) - 45,
      y: (i * 173) % spanY,
    });
    // 속성 위성
    c.attrs.forEach((a, j) => {
      nodes.push({
        id: `${c.name}#${a}`,
        label: a,
        r: PROP_R,
        isProp: true,
        host: c.name,
        tx,
        d0,
        x: tx + Math.cos(j) * 60,
        y: ((i * 173) % spanY) + Math.sin(j) * 60,
      });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: SimLink[] = [];
  for (const r of rels) {
    if (r.domain !== r.range && byId.has(r.domain) && byId.has(r.range)) {
      links.push({ source: r.domain, target: r.range, kind: 'rel' });
    }
  }
  for (const n of nodes) if (n.isProp && n.host) links.push({ source: n.host, target: n.id, kind: 'prop' });

  const lcnt: Record<string, number> = {};
  for (const l of links) {
    const s = l.source as string;
    const t = l.target as string;
    lcnt[s] = (lcnt[s] ?? 0) + 1;
    lcnt[t] = (lcnt[t] ?? 0) + 1;
  }

  /** 궤도력 — 속성을 호스트 둘레 균등 각도로 강하게 당긴다(원본 orbit). */
  const satsOf: Record<string, string[]> = {};
  for (const n of nodes) if (n.isProp && n.host) (satsOf[n.host] = satsOf[n.host] ?? []).push(n.id);
  const orbit = (alpha: number) => {
    for (const host of Object.keys(satsOf)) {
      const h = byId.get(host);
      const sats = satsOf[host];
      if (!h) continue;
      sats.forEach((sid, k) => {
        const s = byId.get(sid);
        if (!s) return;
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / sats.length;
        const R = h.r + s.r + 20;
        const K = 0.55 * alpha;
        s.vx = (s.vx ?? 0) + ((h.x ?? 0) + R * Math.cos(a) - (s.x ?? 0)) * K;
        s.vy = (s.vy ?? 0) + ((h.y ?? 0) + R * Math.sin(a) - (s.y ?? 0)) * K;
      });
    }
  };

  const sim = forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links as never)
        .id((d) => (d as SimNode).id)
        .distance((l) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          return s.r + t.r + ((l as SimLink).kind === 'prop' ? 20 : 130);
        })
        .strength((l) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          return (l as SimLink).kind === 'prop' ? 0.8 : 1 / Math.min(lcnt[s.id] ?? 1, lcnt[t.id] ?? 1);
        }),
    )
    .force(
      'charge',
      forceManyBody<SimNode>()
        .strength((d) => (d.isProp ? -60 : -220 * Math.sqrt((deg[d.id] ?? 0) + 1)))
        .distanceMax(span * 0.55),
    )
    .force('collide', forceCollide<SimNode>((d) => (d.ghost ? 0 : d.r + 14)).iterations(2))
    .force('orbit', orbit)
    .force('x', forceX<SimNode>((d) => d.tx).strength((d) => (d.isProp ? 0 : d.d0 === 0 ? 0.85 : 0.3)))
    .force('y', forceY<SimNode>(spanY / 2).strength((d) => (d.isProp ? 0 : 0.26)))
    .stop();

  sim.tick(300); // 첫 페인트부터 안정된 배치
  return { sim, byId };
}

/** 시뮬 좌표를 감싸는 viewBox. */
export function simViewBox(nodes: SimNode[], margin = 80) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of nodes) {
    minX = Math.min(minX, p.x ?? 0);
    minY = Math.min(minY, p.y ?? 0);
    maxX = Math.max(maxX, p.x ?? 0);
    maxY = Math.max(maxY, p.y ?? 0);
  }
  return { x: minX - margin, y: minY - margin, w: maxX - minX + margin * 2, h: maxY - minY + margin * 2 };
}

/** degree 정규화 t(0~1) 로 색 농도를 만든다(원본 shades). */
export function shade(color: string, t: number) {
  const a = Math.round(0x1c + Math.max(0, Math.min(1, t)) * 0x7e);
  return color + a.toString(16).padStart(2, '0');
}

export const dispLabel = (s: string) => (s.length > 12 ? s.slice(0, 11) + '…' : s);
