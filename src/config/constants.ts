export const GAME_CONFIG = {
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 540,
  TARGET_FPS: 60,
  TICK_INTERVAL: 1 / 60,

  // 運動物理
  MAX_SPEED: 230.0,
  ACCELERATION: 1600.0,
  FRICTION: 1200.0,
  PLAYER_RADIUS: 12.0,
  PLAYER_HITBOX_RADIUS: 8.5,

  // 衝刺 Blink Dash
  DASH_SPEED: 580.0,
  DASH_DURATION: 0.15,
  DASH_COOLDOWN: 0.9,

  // 踏板與機關
  PAD_RADIUS: 20.0,
  PAD_HOLD_DELAY: 0.22,
  DOOR_SPEED: 5.0, // 開門過渡速度

  // 時間迴圈
  DEFAULT_LOOP_DURATION: 12.0,
  REWIND_DURATION: 0.65,

  // 計分常數
  BASE_SCORE: 10000,
  TIME_BONUS_PER_SEC: 500,
  LOOP_SAVED_BONUS: 3000,
  PARADOX_PENALTY: 1500,

  // 殘影顏色定義
  GHOST_COLORS: [
    { name: 'Echo-1', color: '#00f0ff', stroke: 'rgba(0, 240, 255, 0.7)' },
    { name: 'Echo-2', color: '#c040ff', stroke: 'rgba(192, 64, 255, 0.7)' },
    { name: 'Echo-3', color: '#ffaa00', stroke: 'rgba(255, 170, 0, 0.7)' },
    { name: 'Echo-4', color: '#00ff88', stroke: 'rgba(0, 255, 136, 0.7)' },
  ],

  AGENT_COLOR: '#ffe600',
  STORAGE_PREFIX: 'echo-loop:save:v1',
};
