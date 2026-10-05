export interface RecordedFrame {
  x: number;
  y: number;
  angle: number;
  actions: number; // 0b0001: moving, 0b0010: dash, 0b0100: interact
}

export interface GhostTimeline {
  id: string;
  name: string;
  color: string;
  frames: RecordedFrame[];
  totalFrames: number;
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PressurePad {
  id: string;
  x: number;
  y: number;
  radius: number;
  targets: string[]; // 連動的閘門 ID
  isPressed: boolean;
  holdTimer: number;
  color: string;
  isGravityInverter?: boolean; // 踩下時反轉全場重力與極性
}

export interface SecurityDoor {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isOpen: boolean;
  openProgress: number; // 0 (closed) ~ 1 (fully open)
  orientation: 'horizontal' | 'vertical';
  inverted?: boolean; // 反極性門：常態開啟或依反轉狀態連動
}

export interface LaserHazard {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isActive: boolean;
  cycleTime?: number; // 週期切換 (若有)
  onDuration?: number;
  offDuration?: number;
  timer?: number;
  inverted?: boolean; // 當極性反轉時狀態顛倒
  // 巡邏移動雷射
  patrol?: {
    axis: 'x' | 'y';
    range: number;
    speed: number;
    initialX1?: number;
    initialX2?: number;
    initialY1?: number;
    initialY2?: number;
  };
}

export interface LaserPrism {
  id: string;
  x: number;
  y: number;
  radius: number;
  sourceLaserId?: string; // 來源雷射
  targetDoorId?: string; // 被偏折雷射熔斷開闢之防爆大門
  requiresPadId?: string; // 需殘影踩下的稜鏡調校踏板
  isAligned: boolean; // 是否成功對準偏折
  beamEndpoint?: { x: number; y: number }; // 偏折射線終點
  meltProgress?: number; // 熔斷防爆門進度 (0 ~ 1)
  color?: string;
}

export interface Teleporter {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  requiresPadId?: string; // 必須踩住指定踏板時激活
  isActive: boolean;
  color: string;
  cooldownTimer?: number;
}

export interface EmpTerminal {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  isCharged: boolean;
  chargeTimer: number; // 保持充能秒數
  maxChargeTime: number; // 預設 3.0s
}

export interface LevelConfig {
  id: number;
  name: string;
  subName: string;
  description: string;
  maxLoops: number;
  loopDuration: number; // 預設 12.0 秒
  spawn: { x: number; y: number; angle: number };
  core: { x: number; y: number };
  exit: { x: number; y: number };
  walls: Wall[];
  pads: PressurePad[];
  doors: SecurityDoor[];
  lasers: LaserHazard[];
  teleporters?: Teleporter[];
  empTerminals?: EmpTerminal[];
  prisms?: LaserPrism[];
  hasGravityInverter?: boolean;
  threeStarLoops?: number;
  threeStarMinTime?: number;
}

export type GameState =
  | 'TITLE'
  | 'LEVEL_SELECT'
  | 'BRIEFING'
  | 'PLAYING'
  | 'REWINDING'
  | 'VICTORY'
  | 'GAMEOVER';

export interface StageSaveData {
  unlocked: boolean;
  highScore: number;
  stars: number;
  clearedAt?: string;
}

export interface VictoryData {
  score: number;
  stars: number;
  timeBonus: number;
  loopBonus: number;
  penalty: number;
  isSpeedrunMode?: boolean;
  isSpeedrunFinal?: boolean;
  speedrunTotalTimeMs?: number;
  stageSplitMs?: number;
  isSpeedrunIntermission?: boolean;
}

