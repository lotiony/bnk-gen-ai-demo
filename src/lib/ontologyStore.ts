/**
 * 온톨로지 편집 스토어 — **메모리 전용**.
 *
 * 클래스·관계·속성 추가/수정/삭제, TTL 내보내기·가져오기를 지원한다.
 * localStorage 를 쓰지 않는다(CLAUDE.md) — 새로고침하면 초기 온톨로지로
 * 돌아가므로 리허설과 본 시연이 같은 상태에서 시작한다.
 *
 * 패턴은 deployApprovalStore.ts 와 동일 — useSyncExternalStore 구독형.
 */
import { useSyncExternalStore } from 'react';
import { CLASSES as SEED_CLASSES, RELATIONS as SEED_RELATIONS, type OntologyClass, type OntologyRelation } from '@/data/ontology';

interface Snapshot {
  classes: OntologyClass[];
  relations: OntologyRelation[];
}

let state: Snapshot = { classes: SEED_CLASSES, relations: SEED_RELATIONS };
const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => state;

export function useOntology(): Snapshot {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const getOntology = () => state;

/* ── 편집 ── */

export function addClass(c: OntologyClass) {
  if (state.classes.some((x) => x.uri === c.uri)) return false;
  state.classes = [...state.classes, c];
  emit();
  return true;
}

export function updateClass(uri: string, patch: Partial<OntologyClass>) {
  state.classes = state.classes.map((c) => (c.uri === uri ? { ...c, ...patch } : c));
  emit();
}

export function removeClass(uri: string) {
  const c = state.classes.find((x) => x.uri === uri);
  if (!c) return;
  state.classes = state.classes.filter((x) => x.uri !== uri);
  // 이 클래스를 쓰는 관계도 함께 정리 — 고아 엣지가 남으면 그래프가 깨진다
  state.relations = state.relations.filter((r) => r.domain !== c.name && r.range !== c.name);
  emit();
}

export function addAttr(uri: string, attr: string) {
  state.classes = state.classes.map((c) => (c.uri === uri && !c.attrs.includes(attr) ? { ...c, attrs: [...c.attrs, attr] } : c));
  emit();
}

export function removeAttr(uri: string, attr: string) {
  state.classes = state.classes.map((c) => (c.uri === uri ? { ...c, attrs: c.attrs.filter((a) => a !== attr) } : c));
  emit();
}

export function addRelation(r: OntologyRelation) {
  if (state.relations.some((x) => x.uri === r.uri)) return false;
  state.relations = [...state.relations, r];
  emit();
  return true;
}

export function removeRelation(uri: string) {
  state.relations = state.relations.filter((r) => r.uri !== uri);
  emit();
}

/**
 * 노드 병합 — src 를 dst 로 흡수한다.
 * 속성을 합치고, src 를 가리키던 관계의 끝점을 dst 로 옮긴 뒤 중복을 제거한다.
 * (원본의 "노드를 다른 노드에 겹쳐 놓으면 병합" 동작)
 */
export function mergeClasses(srcName: string, dstName: string) {
  if (srcName === dstName) return;
  const src = state.classes.find((c) => c.name === srcName);
  const dst = state.classes.find((c) => c.name === dstName);
  if (!src || !dst) return;

  state.classes = state.classes
    .map((c) => (c.name === dstName ? { ...c, attrs: [...new Set([...c.attrs, ...src.attrs])] } : c))
    .filter((c) => c.name !== srcName);

  const seen = new Set<string>();
  state.relations = state.relations
    .map((r) => ({
      ...r,
      domain: r.domain === srcName ? dstName : r.domain,
      range: r.range === srcName ? dstName : r.range,
    }))
    .filter((r) => {
      if (r.domain === r.range) return false; // 자기참조로 접힌 관계는 버린다
      const k = `${r.name}|${r.domain}|${r.range}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  emit();
}

export function resetOntology() {
  state = { classes: SEED_CLASSES, relations: SEED_RELATIONS };
  emit();
}

/* ── TTL 직렬화 ── */

const PREFIX = `@prefix bnk:  <https://ontology.bnk.example/schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
`;

/** 한글 라벨을 URI 로컬명으로 쓸 수 없으므로 속성은 슬러그로 옮긴다. */
function attrUri(clsUri: string, attr: string) {
  return `${clsUri}_${attr.replace(/[^\w가-힣]/g, '')}`;
}

export function toTurtle(snap: Snapshot = state): string {
  const L: string[] = [PREFIX, ''];
  L.push('### Ontology');
  L.push('<https://ontology.bnk.example/schema> a owl:Ontology ;');
  L.push('    rdfs:label "BNK 여신심사·전결권 온톨로지"@ko ;');
  L.push('    rdfs:comment "제안 시연용 가상 온톨로지 — 실제 내규·고객 데이터 아님"@ko .');
  L.push('');

  L.push('### Classes');
  for (const c of snap.classes) {
    L.push(`${c.uri} a owl:Class ;`);
    L.push(`    rdfs:label "${c.name}"@ko ;`);
    if (c.parent) {
      const p = snap.classes.find((x) => x.name === c.parent);
      if (p) L.push(`    rdfs:subClassOf ${p.uri} ;`);
    }
    L.push(`    rdfs:comment "축: ${c.axis}"@ko .`);
    L.push('');
  }

  L.push('### Object properties');
  for (const r of snap.relations) {
    const d = snap.classes.find((c) => c.name === r.domain);
    const g = snap.classes.find((c) => c.name === r.range);
    L.push(`${r.uri} a owl:ObjectProperty ;`);
    L.push(`    rdfs:label "${r.name}"@ko ;`);
    if (d) L.push(`    rdfs:domain ${d.uri} ;`);
    if (g) L.push(`    rdfs:range ${g.uri} ;`);
    L[L.length - 1] = L[L.length - 1].replace(/ ;$/, ' .');
    L.push('');
  }

  L.push('### Data properties');
  for (const c of snap.classes) {
    for (const a of c.attrs) {
      L.push(`${attrUri(c.uri, a)} a owl:DatatypeProperty ;`);
      L.push(`    rdfs:label "${a}"@ko ;`);
      L.push(`    rdfs:domain ${c.uri} ;`);
      L.push('    rdfs:range xsd:string .');
      L.push('');
    }
  }
  return L.join('\n');
}

/** 브라우저에서 .ttl 파일로 저장. */
export function downloadTurtle(filename = 'bnk-ontology.ttl') {
  const blob = new Blob([toTurtle()], { type: 'text/turtle;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── TTL 파싱 (가져오기) ── */

export interface ImportResult {
  ok: boolean;
  classes: number;
  relations: number;
  attrs: number;
  error?: string;
}

/**
 * 최소 Turtle 파서 — 이 앱이 내보낸 형식을 되읽는 수준.
 * 완전한 Turtle 문법을 지원하지 않는다(데모 범위).
 */
export function importTurtle(text: string): ImportResult {
  try {
    const classes: OntologyClass[] = [];
    const relations: OntologyRelation[] = [];
    const attrOf = new Map<string, string[]>();
    const labelOf = new Map<string, string>();
    const parentOf = new Map<string, string>();

    // 주어 블록 단위로 자른다 (마침표로 종료)
    const blocks = text.split(/\.\s*\n/).map((b) => b.trim()).filter(Boolean);
    // 1차: 라벨 수집
    for (const b of blocks) {
      const subj = b.match(/^(bnk:[\w가-힣_]+)/)?.[1];
      if (!subj) continue;
      const label = b.match(/rdfs:label\s+"([^"]+)"/)?.[1];
      if (label) labelOf.set(subj, label);
      const parent = b.match(/rdfs:subClassOf\s+(bnk:[\w가-힣_]+)/)?.[1];
      if (parent) parentOf.set(subj, parent);
    }
    // 2차: 타입별 구성
    let i = 0;
    for (const b of blocks) {
      const subj = b.match(/^(bnk:[\w가-힣_]+)/)?.[1];
      if (!subj) continue;
      const name = labelOf.get(subj) ?? subj.split(':')[1];
      if (/a\s+owl:Class/.test(b)) {
        const axis = (b.match(/축:\s*(\w+)/)?.[1] ?? 'credit') as OntologyClass['axis'];
        classes.push({
          name,
          uri: subj,
          axis,
          parent: parentOf.has(subj) ? (labelOf.get(parentOf.get(subj)!) ?? null) : null,
          attrs: [],
          col: i % 8,
          row: Math.floor(i / 8),
        });
        i += 1;
      } else if (/a\s+owl:ObjectProperty/.test(b)) {
        const d = b.match(/rdfs:domain\s+(bnk:[\w가-힣_]+)/)?.[1];
        const g = b.match(/rdfs:range\s+(bnk:[\w가-힣_]+)/)?.[1];
        if (d && g) relations.push({ name, uri: subj, domain: labelOf.get(d) ?? d, range: labelOf.get(g) ?? g });
      } else if (/a\s+owl:DatatypeProperty/.test(b)) {
        const d = b.match(/rdfs:domain\s+(bnk:[\w가-힣_]+)/)?.[1];
        if (d) attrOf.set(d, [...(attrOf.get(d) ?? []), name]);
      }
    }
    if (!classes.length) return { ok: false, classes: 0, relations: 0, attrs: 0, error: 'owl:Class 를 찾지 못했습니다.' };
    classes.forEach((c) => (c.attrs = attrOf.get(c.uri) ?? []));
    const attrs = classes.reduce((a, c) => a + c.attrs.length, 0);
    state = { classes, relations };
    emit();
    return { ok: true, classes: classes.length, relations: relations.length, attrs };
  } catch (e) {
    return { ok: false, classes: 0, relations: 0, attrs: 0, error: String(e) };
  }
}
