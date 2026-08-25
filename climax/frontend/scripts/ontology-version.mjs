// 온톨로지 엔진 버전 도출.
//
// 온톨로지는 climax(앱) 와 별개로 feature/ontology-v<N> 브랜치를 베이스로 관리한다
// (v2 → v2.1 → v2.1.1 → v3 → v3.1). 규칙은 브랜치 종류별로 나뉜다:
//
//   1) feature/ontology-vN 베이스 위     → 브랜치명이 곧 버전 (ontology-v3.1)
//   2) dev / main (배포 라인) 위          → origin 에 push 된 feature/ontology-vN 중
//                                          HEAD 에 머지된 최고 버전. 배포본(ACA)에 버전을
//                                          박기 위한 규칙 — prod 는 dev 이미지를 그대로
//                                          승격하므로(scripts/deploy-prod.sh) dev 값이 곧 prod 값.
//   3) 그 외 작업 브랜치                  → 미표출. 아직 어느 버전으로 확정된 상태가 아니다.
//
// 못 뽑으면 빈 문자열 — 화면은 배지를 그리지 않는다(거짓 표기 방지).
import { execFileSync } from "node:child_process";

// feature/ontology-v3.1 은 받고, 뒤에 다른 말이 붙은 작업 브랜치는 버린다.
const BRANCH_RE = /^feature\/ontology-v(\d+(?:\.\d+)*)$/;
// dev/main 폴백용 — origin/ 등 remote 접두가 붙은 형태만 인정한다.
// 로컬 전용 브랜치(push 안 된 v3.1 등)를 세면 로컬 빌드와 CI 빌드의 표기가 갈리기 때문.
const REMOTE_RE = /^[^/]+\/feature\/ontology-v(\d+(?:\.\d+)*)$/;

// "3.1" → [3,1] 로 쪼개 숫자 비교. 문자열 정렬이면 v3.10 이 v3.9 보다 작아진다.
function cmp(a, b) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

export function ontologyVersion(cwd = process.cwd()) {
  let branch;
  try {
    branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  } catch {
    // git 이 없거나 저장소가 아님(도커 빌드 스테이지는 .dockerignore 로 .git 이 빠진다).
    // 이때는 CI 가 미리 계산해 VITE_ONTOLOGY_VERSION 으로 넘긴 값을 vite.config 가 쓴다.
    return "";
  }
  // detached HEAD(CI 일부 체크아웃 형태)면 GITHUB_REF_NAME 으로 브랜치를 복원한다.
  if (branch === "HEAD" && process.env.GITHUB_REF_NAME) branch = process.env.GITHUB_REF_NAME;

  // 1) 온톨로지 베이스 브랜치 — 브랜치명이 곧 버전
  const m = branch.match(BRANCH_RE);
  if (m) return "ontology-v" + m[1];

  // 2) 배포 라인 — HEAD 에 머지된(=조상인) origin 의 온톨로지 베이스 중 최고 버전
  if (branch === "dev" || branch === "main") {
    let refs;
    try {
      refs = git(cwd, "for-each-ref", "--format=%(refname:short)", "--merged", "HEAD",
        "refs/remotes/*/feature/ontology-v*");
    } catch {
      return "";
    }
    const versions = refs.split("\n").map((r) => r.trim().match(REMOTE_RE)?.[1]).filter(Boolean);
    return versions.length ? "ontology-v" + versions.sort(cmp).at(-1) : "";
  }

  // 3) 작업 브랜치 — 미표출
  return "";
}

// CI 에서 `node frontend/scripts/ontology-version.mjs` 로 뽑아 --build-arg 로 넘긴다.
if (import.meta.url === `file://${process.argv[1]}`) console.log(ontologyVersion());
