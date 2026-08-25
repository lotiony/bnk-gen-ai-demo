/**
 * GPU 인프라 모니터링 mock — 4개 위치(on-prem cluster1·cluster2 + CSP azure·aws).
 *
 * 단위:
 *  · on-prem — 물리 노드(서버) 단위. 노드 한 대에 GPU 8장 (NVIDIA HGX 보드 기준).
 *  · CSP    — VM 인스턴스 단위. 인스턴스 타입에 GPU 수가 고정 (예: p5.48xlarge=H100×8).
 *
 * 노출 메트릭:
 *  · 위치(클러스터/리전)별 노드/인스턴스 수와 GPU 종류 분포
 *  · 각 노드의 인스턴스 유형 / GPU 종류 × 수 / 평균 사용률 / 평균 온도 / 상태
 *  · 모델 × 위치 배포 매트릭스 (replica, GPU 수, TTFT, TPS, RPS)
 *  · 위치별 24시간 GPU 사용률 추이
 *  · 인프라 이벤트(장애·재시작·유지보수·스케일)
 */

export type LocationId = 'onprem-cluster1' | 'onprem-cluster2' | 'csp-azure' | 'csp-aws';
export type LocationKind = 'onprem' | 'csp';

export interface LocationMeta {
  id: LocationId;
  label: string;
  kind: LocationKind;
  region: string;
  hourlyRateAvgKrw: number;
}

export const LOCATIONS: LocationMeta[] = [
  {
    id: 'onprem-cluster1',
    label: 'on-prem · cluster1',
    kind: 'onprem',
    region: '여의도 IDC',
    hourlyRateAvgKrw: 6_800,
  },
  {
    id: 'onprem-cluster2',
    label: 'on-prem · cluster2',
    kind: 'onprem',
    region: '분당 IDC',
    hourlyRateAvgKrw: 5_200,
  },
  {
    id: 'csp-azure',
    label: 'CSP · Azure',
    kind: 'csp',
    region: 'koreacentral',
    hourlyRateAvgKrw: 12_400,
  },
  {
    id: 'csp-aws',
    label: 'CSP · AWS',
    kind: 'csp',
    region: 'ap-northeast-2',
    hourlyRateAvgKrw: 14_200,
  },
];

export type GpuStatus = 'active' | 'idle' | 'degraded' | 'maintenance' | 'fault';

/** 개별 GPU 카드 — nvidia-smi의 GPU 0~7 한 줄에 대응. */
export interface GpuCard {
  /** GPU 인덱스 (0~7). */
  index: number;
  /** PCI Bus ID — `nvidia-smi` Bus-Id 칸. */
  busId: string;
  status: 'active' | 'idle' | 'fault';
  utilizationPct: number;
  memUsedMiB: number;
  memTotalMiB: number;
  temperatureC: number;
  powerW: number;
  powerCapW: number;
  /** 활성일 때 떠있는 프로세스 PID. */
  pid?: number;
  processName?: string;
  /** 이 GPU에서 서빙 중인 LLM 모델. */
  hostedModel?: string;
  /** ECC 오류 누적 카운트. */
  eccErrors?: number;
}

/** 노드(on-prem) 또는 인스턴스(CSP) 단위. */
export interface GpuNode {
  id: string;
  location: LocationId;
  /** on-prem 서버 모델명 또는 CSP VM 인스턴스 타입. */
  instanceType: string;
  gpuModel: 'H100' | 'A100' | 'L40S';
  /** 한 노드/인스턴스의 GPU 수 (보통 8). */
  gpuCount: number;
  /** GPU 한 장당 메모리(GB). */
  memoryGbPerGpu: number;
  /** 노드 전체 평균 사용률(활성 GPU 기준, %). */
  utilizationPct: number;
  /** 평균 온도(℃) — CSP는 0(미공개). */
  temperatureC: number;
  status: GpuStatus;
  /** degraded일 때, 장애 GPU 수. */
  faultGpus?: number;
  /** 활성 GPU 수 (8 중 N). */
  activeCount: number;
  /** 이 노드에 떠있는 LLM 모델들. */
  hostedModels: string[];

  /* nvidia-smi 메타 */
  driverVersion: string;
  cudaVersion: string;
  smiTimestamp: string;
  /** 8장 GPU 상세. */
  gpus: GpuCard[];
}

/** 8장 GPU 카드 시드 생성. */
function makeGpus(opts: {
  gpuModel: GpuNode['gpuModel'];
  memTotalGB: number;
  powerCapW: number;
  utilBase: number;
  utilSpread: number;
  hostedModel?: string;
  activeMask: boolean[]; // 길이 8, true=active
  faultIndex?: number;
  seed: number;
  showTemp: boolean; // CSP는 false
}): GpuCard[] {
  const memTotalMiB = opts.memTotalGB * 1024;
  let s = opts.seed;
  return Array.from({ length: 8 }, (_, i) => {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    s = (s * 9301 + 49297) % 233280;
    const r2 = s / 233280;
    const busSlot = String(0x0f + i * 4).padStart(2, '0').toUpperCase();
    const busId = `00000000:${busSlot}:00.0`;
    if (opts.faultIndex === i) {
      return {
        index: i,
        busId,
        status: 'fault' as const,
        utilizationPct: 0,
        memUsedMiB: 0,
        memTotalMiB,
        temperatureC: 0,
        powerW: 0,
        powerCapW: opts.powerCapW,
        eccErrors: 14,
      };
    }
    if (!opts.activeMask[i]) {
      return {
        index: i,
        busId,
        status: 'idle' as const,
        utilizationPct: 0,
        memUsedMiB: 12,
        memTotalMiB,
        temperatureC: opts.showTemp ? 38 + Math.round(r * 6) : 0,
        powerW: 64,
        powerCapW: opts.powerCapW,
      };
    }
    const util = Math.max(20, Math.min(95, Math.round(opts.utilBase + (r - 0.5) * opts.utilSpread)));
    const memPct = 0.55 + r2 * 0.3;
    const memUsedMiB = Math.round(memTotalMiB * memPct);
    const temp = opts.showTemp ? Math.round(58 + util * 0.18 + (r2 - 0.5) * 6) : 0;
    const power = Math.round(opts.powerCapW * (0.45 + util / 100 * 0.42));
    return {
      index: i,
      busId,
      status: 'active' as const,
      utilizationPct: util,
      memUsedMiB,
      memTotalMiB,
      temperatureC: temp,
      powerW: power,
      powerCapW: opts.powerCapW,
      pid: 14000 + i * 12 + Math.round(r * 99),
      processName: '/opt/triton/bin/tritonserver',
      hostedModel: opts.hostedModel,
    };
  });
}

function buildNode(meta: Omit<GpuNode, 'utilizationPct' | 'temperatureC' | 'activeCount' | 'faultGpus' | 'gpus'> & {
  gpus: GpuCard[];
}): GpuNode {
  const active = meta.gpus.filter((g) => g.status === 'active');
  const fault = meta.gpus.filter((g) => g.status === 'fault').length;
  const avgUtil = active.length === 0 ? 0 : Math.round(active.reduce((a, g) => a + g.utilizationPct, 0) / active.length);
  const showTemp = active.some((g) => g.temperatureC > 0);
  const avgTemp = !showTemp || active.length === 0 ? 0 : Math.round(active.reduce((a, g) => a + g.temperatureC, 0) / active.length);
  const status: GpuStatus = fault > 0 ? 'degraded' : meta.status;
  return {
    ...meta,
    utilizationPct: avgUtil,
    temperatureC: avgTemp,
    status,
    faultGpus: fault > 0 ? fault : undefined,
    activeCount: active.length,
  };
}

const all8 = [true, true, true, true, true, true, true, true];
const half8 = [true, true, true, true, false, false, false, false];

export const GPU_NODES: GpuNode[] = [
  // on-prem cluster1 — HGX 서버 3대 = 24 GPU
  buildNode({
    id: 'c1-node-h-01',
    location: 'onprem-cluster1',
    instanceType: 'NVIDIA HGX H100',
    gpuModel: 'H100',
    gpuCount: 8,
    memoryGbPerGpu: 80,
    status: 'active',
    hostedModels: ['openai/gpt-oss-120b'],
    driverVersion: '535.129.03',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'H100',
      memTotalGB: 80,
      powerCapW: 700,
      utilBase: 78,
      utilSpread: 14,
      hostedModel: 'openai/gpt-oss-120b',
      activeMask: all8,
      seed: 2001,
      showTemp: true,
    }),
  }),
  buildNode({
    id: 'c1-node-h-02',
    location: 'onprem-cluster1',
    instanceType: 'NVIDIA HGX H100',
    gpuModel: 'H100',
    gpuCount: 8,
    memoryGbPerGpu: 80,
    status: 'active',
    hostedModels: ['openai/gpt-oss-120b'],
    driverVersion: '535.129.03',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'H100',
      memTotalGB: 80,
      powerCapW: 700,
      utilBase: 72,
      utilSpread: 16,
      hostedModel: 'openai/gpt-oss-120b',
      activeMask: all8,
      seed: 2002,
      showTemp: true,
    }),
  }),
  buildNode({
    id: 'c1-node-a-01',
    location: 'onprem-cluster1',
    instanceType: 'NVIDIA HGX A100',
    gpuModel: 'A100',
    gpuCount: 8,
    memoryGbPerGpu: 80,
    status: 'active',
    hostedModels: ['onprem/sLLM-13b'],
    driverVersion: '535.129.03',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'A100',
      memTotalGB: 80,
      powerCapW: 400,
      utilBase: 54,
      utilSpread: 18,
      hostedModel: 'onprem/sLLM-13b',
      activeMask: all8,
      seed: 2003,
      showTemp: true,
    }),
  }),
  // on-prem cluster2 — HGX 서버 2대 = 16 GPU (A100 8 + L40S 8). 1장 fault.
  buildNode({
    id: 'c2-node-a-01',
    location: 'onprem-cluster2',
    instanceType: 'NVIDIA HGX A100',
    gpuModel: 'A100',
    gpuCount: 8,
    memoryGbPerGpu: 80,
    status: 'active',
    hostedModels: ['onprem/sLLM-13b'],
    driverVersion: '535.129.03',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'A100',
      memTotalGB: 80,
      powerCapW: 400,
      utilBase: 58,
      utilSpread: 16,
      hostedModel: 'onprem/sLLM-13b',
      activeMask: all8,
      faultIndex: 3,
      seed: 2004,
      showTemp: true,
    }),
  }),
  buildNode({
    id: 'c2-node-l-01',
    location: 'onprem-cluster2',
    instanceType: 'Supermicro 4U L40S',
    gpuModel: 'L40S',
    gpuCount: 8,
    memoryGbPerGpu: 48,
    status: 'active',
    hostedModels: ['onprem/sLLM-7b'],
    driverVersion: '535.129.03',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'L40S',
      memTotalGB: 48,
      powerCapW: 350,
      utilBase: 42,
      utilSpread: 14,
      hostedModel: 'onprem/sLLM-7b',
      activeMask: all8,
      seed: 2005,
      showTemp: true,
    }),
  }),
  // CSP Azure — 1 인스턴스 = 8 GPU (모두 활성, 온도 미공개)
  buildNode({
    id: 'az-vm-01',
    location: 'csp-azure',
    instanceType: 'Standard_ND96amsr_A100_v4',
    gpuModel: 'A100',
    gpuCount: 8,
    memoryGbPerGpu: 80,
    status: 'active',
    hostedModels: ['azure/gpt-5.5'],
    driverVersion: '535.104.05',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'A100',
      memTotalGB: 80,
      powerCapW: 400,
      utilBase: 67,
      utilSpread: 14,
      hostedModel: 'azure/gpt-5.5',
      activeMask: all8,
      seed: 2006,
      showTemp: false,
    }),
  }),
  // CSP AWS — 1 인스턴스 = 8 GPU (4장만 활성, 4장 idle 백업/실험용)
  buildNode({
    id: 'aws-ec2-01',
    location: 'csp-aws',
    instanceType: 'p5.48xlarge',
    gpuModel: 'H100',
    gpuCount: 8,
    memoryGbPerGpu: 80,
    status: 'active',
    hostedModels: ['openai/gpt-oss-120b'],
    driverVersion: '535.104.05',
    cudaVersion: '12.2',
    smiTimestamp: 'Mon May 24 14:08:32 2026',
    gpus: makeGpus({
      gpuModel: 'H100',
      memTotalGB: 80,
      powerCapW: 700,
      utilBase: 76,
      utilSpread: 12,
      hostedModel: 'openai/gpt-oss-120b',
      activeMask: half8,
      seed: 2007,
      showTemp: false,
    }),
  }),
];

/** 위치별 요약 — GPU 수는 노드의 gpuCount 합산. */
export interface LocationSummary extends LocationMeta {
  totalGpus: number;
  activeGpus: number;
  idleGpus: number;
  faultGpus: number;
  maintenanceGpus: number;
  avgUtilization: number;
  /** 노드/인스턴스 수. */
  nodeCount: number;
  gpuBreakdown: { gpuModel: string; count: number }[];
  modelsHosted: string[];
}

export function getLocationSummaries(): LocationSummary[] {
  return LOCATIONS.map((loc) => {
    const nodes = GPU_NODES.filter((n) => n.location === loc.id);
    const breakdownMap = new Map<string, number>();
    const modelsSet = new Set<string>();
    let totalGpus = 0;
    let active = 0;
    let idle = 0;
    let fault = 0;
    let maint = 0;
    let utilSum = 0;
    let utilDenom = 0;
    for (const n of nodes) {
      totalGpus += n.gpuCount;
      breakdownMap.set(n.gpuModel, (breakdownMap.get(n.gpuModel) ?? 0) + n.gpuCount);
      n.hostedModels.forEach((m) => modelsSet.add(m));
      if (n.status === 'maintenance') {
        maint += n.gpuCount;
      } else if (n.status === 'fault') {
        fault += n.gpuCount;
      } else if (n.status === 'idle') {
        idle += n.gpuCount;
      } else {
        // active / degraded
        active += n.gpuCount - (n.faultGpus ?? 0);
        fault += n.faultGpus ?? 0;
        utilSum += n.utilizationPct * n.gpuCount;
        utilDenom += n.gpuCount;
      }
    }
    return {
      ...loc,
      totalGpus,
      activeGpus: active,
      idleGpus: idle,
      faultGpus: fault,
      maintenanceGpus: maint,
      avgUtilization: utilDenom === 0 ? 0 : +(utilSum / utilDenom).toFixed(1),
      nodeCount: nodes.length,
      gpuBreakdown: Array.from(breakdownMap.entries()).map(([gpuModel, count]) => ({ gpuModel, count })),
      modelsHosted: Array.from(modelsSet),
    };
  });
}

/** 모델 × 위치 배포 매트릭스. */
export interface ModelDeployment {
  model: string;
  location: LocationId;
  replicas: number;
  gpuCount: number;
  gpuModel: string;
  ttftMs: number;
  tps: number;
  rps: number;
  health: 'healthy' | 'degraded' | 'down';
}

export const MODEL_DEPLOYMENTS: ModelDeployment[] = [
  {
    model: 'openai/gpt-oss-120b',
    location: 'onprem-cluster1',
    replicas: 8,
    gpuCount: 16,
    gpuModel: 'H100',
    ttftMs: 480,
    tps: 92.4,
    rps: 18.6,
    health: 'healthy',
  },
  {
    model: 'openai/gpt-oss-120b',
    location: 'csp-aws',
    replicas: 4,
    gpuCount: 8,
    gpuModel: 'H100',
    ttftMs: 620,
    tps: 78.1,
    rps: 2.4,
    health: 'healthy',
  },
  {
    model: 'azure/gpt-5.5',
    location: 'csp-azure',
    replicas: 4,
    gpuCount: 8,
    gpuModel: 'A100',
    ttftMs: 540,
    tps: 64.8,
    rps: 7.2,
    health: 'healthy',
  },
  {
    model: 'onprem/sLLM-13b',
    location: 'onprem-cluster1',
    replicas: 4,
    gpuCount: 8,
    gpuModel: 'A100',
    ttftMs: 220,
    tps: 142.6,
    rps: 4.8,
    health: 'healthy',
  },
  {
    model: 'onprem/sLLM-13b',
    location: 'onprem-cluster2',
    replicas: 4,
    gpuCount: 8,
    gpuModel: 'A100',
    ttftMs: 240,
    tps: 138.2,
    rps: 6.4,
    health: 'degraded',
  },
  {
    model: 'onprem/sLLM-7b',
    location: 'onprem-cluster2',
    replicas: 4,
    gpuCount: 8,
    gpuModel: 'L40S',
    ttftMs: 140,
    tps: 188.4,
    rps: 3.1,
    health: 'healthy',
  },
];

/** 위치별 GPU 사용률 24시간 시계열 (24 포인트). */
export function getLocationUtilSeries(): Record<LocationId, number[]> {
  const out = {} as Record<LocationId, number[]>;
  const config: Record<LocationId, { base: number; amp: number; seed: number }> = {
    'onprem-cluster1': { base: 72, amp: 14, seed: 71 },
    'onprem-cluster2': { base: 56, amp: 18, seed: 73 },
    'csp-azure': { base: 64, amp: 16, seed: 79 },
    'csp-aws': { base: 38, amp: 22, seed: 83 },
  };
  for (const k of Object.keys(config) as LocationId[]) {
    const { base, amp, seed } = config[k];
    let s = seed;
    const arr: number[] = [];
    for (let i = 0; i < 24; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      const v = base + Math.sin((i / 24) * Math.PI * 2 + seed) * amp * 0.5 + (r - 0.5) * amp;
      arr.push(Math.max(5, Math.min(98, +v.toFixed(1))));
    }
    out[k] = arr;
  }
  return out;
}

/** 인프라 이벤트 (장애·재시작·유지보수·스케일). */
export interface InfraEvent {
  id: string;
  at: string;
  kind: 'fault' | 'restart' | 'maintenance' | 'autoscale';
  location: LocationId;
  target: string;
  description: string;
  resolvedAt?: string;
}

export const INFRA_EVENTS: InfraEvent[] = [
  {
    id: 'EV-INFRA-1042',
    at: '2026-05-24 13:22',
    kind: 'fault',
    location: 'onprem-cluster2',
    target: 'c2-node-a-01 · GPU#3',
    description: 'GPU 메모리 ECC 오류 — 노드 degraded, 운영팀 점검 중',
  },
  {
    id: 'EV-INFRA-1041',
    at: '2026-05-24 09:08',
    kind: 'autoscale',
    location: 'onprem-cluster1',
    target: 'openai/gpt-oss-120b',
    description: 'replica 6 → 8 자동 확장 (P95 임계 도달)',
    resolvedAt: '2026-05-24 09:14',
  },
  {
    id: 'EV-INFRA-1040',
    at: '2026-05-23 18:42',
    kind: 'restart',
    location: 'csp-aws',
    target: 'aws-ec2-01',
    description: '드라이버 호환성 이슈로 인스턴스 재시작',
    resolvedAt: '2026-05-23 18:51',
  },
  {
    id: 'EV-INFRA-1039',
    at: '2026-05-23 02:00',
    kind: 'maintenance',
    location: 'onprem-cluster1',
    target: 'c1-node-h-02',
    description: '예정 점검 — 펌웨어 업데이트',
    resolvedAt: '2026-05-23 03:18',
  },
  {
    id: 'EV-INFRA-1038',
    at: '2026-05-22 11:08',
    kind: 'autoscale',
    location: 'csp-azure',
    target: 'azure/gpt-5.5',
    description: 'PTU 한도 도달 — 자동 throttle 적용 (12분간)',
    resolvedAt: '2026-05-22 11:20',
  },
];
