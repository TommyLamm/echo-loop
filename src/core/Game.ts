import { GAME_CONFIG } from '../config/constants';
import { GameState, GhostTimeline, LevelConfig, StageSaveData } from '../types';
import { LEVELS } from '../config/levels';
import { SoundEngine } from '../audio/SoundEngine';
import { PlayroomAdapter } from '../platform/PlayroomAdapter';
import { InputManager } from './InputManager';
import { GhostRecorder } from './GhostRecorder';
import { GhostPlayer, ActiveGhostState } from './GhostPlayer';
import { StageManager } from './StageManager';
import { ParticleSystem } from './ParticleSystem';
import { Renderer } from '../render/Renderer';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: GameState = 'TITLE';
  private selectedLevelId: number = 1;

  // 關卡與機關
  private stageManager = new StageManager();
  private particles = new ParticleSystem();
  private recorder = new GhostRecorder();
  private ghosts: GhostTimeline[] = [];
  private glitchedGhostIds = new Set<string>();

  // 當前特工本體狀態
  private agentPos = { x: 0, y: 0 };
  private agentVelocity = { x: 0, y: 0 };
  private agentAngle = 0;
  private isDashing = false;
  private dashTimer = 0;
  private dashCooldownTimer = 0;

  // 時間迴圈計時
  private loopDuration = GAME_CONFIG.DEFAULT_LOOP_DURATION;
  private remainingSeconds = GAME_CONFIG.DEFAULT_LOOP_DURATION;
  private currentLoop = 1;
  private maxLoops = 3;

  // 倒流動畫
  private isRewinding = false;
  private rewindTimer = 0;
  private rewindProgress = 0;

  // 結算數據
  private victoryData?: { score: number; stars: number; timeBonus: number; loopBonus: number; penalty: number };
  private gameoverReason = '';

  // 存檔快取
  private allProgress: Record<number, StageSaveData> = {};

  // 系統組件
  private input = InputManager.get();
  private sound = SoundEngine.get();
  private renderer: Renderer;

  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx);

    this.input.init(canvas);
    this.refreshProgress();
    this.bindClickEvents();
  }

  public async start(): Promise<void> {
    await PlayroomAdapter.init();
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private refreshProgress(): void {
    this.allProgress = PlayroomAdapter.getAllProgress(LEVELS.length);
  }

  private bindClickEvents(): void {
    this.canvas.addEventListener('click', (e) => {
      this.sound.unlock();

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = rect.width / GAME_CONFIG.CANVAS_WIDTH;
      const scaleY = rect.height / GAME_CONFIG.CANVAS_HEIGHT;
      const mx = (e.clientX - rect.left) / scaleX;
      const my = (e.clientY - rect.top) / scaleY;

      if (this.state === 'TITLE') {
        const btnW = 240;
        const btnH = 50;
        const btnX = GAME_CONFIG.CANVAS_WIDTH / 2 - btnW / 2;
        const btnY = GAME_CONFIG.CANVAS_HEIGHT / 2 + 85;
        if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
          this.state = 'LEVEL_SELECT';
          this.refreshProgress();
        }
      } else if (this.state === 'LEVEL_SELECT') {
        // 返回按鈕
        if (mx >= 40 && mx <= 180 && my >= GAME_CONFIG.CANVAS_HEIGHT - 48 && my <= GAME_CONFIG.CANVAS_HEIGHT - 10) {
          this.state = 'TITLE';
          return;
        }

        // 關卡卡片
        const cardW = 260;
        const cardH = 170;
        const startX = (GAME_CONFIG.CANVAS_WIDTH - (3 * cardW + 2 * 30)) / 2;
        const startY = 85;

        LEVELS.forEach((level, idx) => {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const x = startX + col * (cardW + 30);
          const y = startY + row * (cardH + 25);
          const progress = this.allProgress[level.id];
          if (progress && progress.unlocked && mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
            this.startLevel(level.id);
          }
        });
      } else if (this.state === 'VICTORY') {
        const mw = 480;
        const mh = 360;
        const mx0 = (GAME_CONFIG.CANVAS_WIDTH - mw) / 2;
        const my0 = (GAME_CONFIG.CANVAS_HEIGHT - mh) / 2;
        const btnW = 160;
        const btnH = 42;
        const btnY = my0 + mh - 55;

        // Retry
        const rX = mx0 + 50;
        if (mx >= rX && mx <= rX + btnW && my >= btnY && my <= btnY + btnH) {
          this.startLevel(this.selectedLevelId);
          return;
        }

        // Next
        const nX = mx0 + mw - 50 - btnW;
        if (mx >= nX && mx <= nX + btnW && my >= btnY && my <= btnY + btnH) {
          if (this.selectedLevelId < LEVELS.length) {
            this.startLevel(this.selectedLevelId + 1);
          } else {
            this.state = 'LEVEL_SELECT';
            this.refreshProgress();
          }
        }
      } else if (this.state === 'GAMEOVER') {
        const btnW = 200;
        const btnH = 44;
        const btnX = (GAME_CONFIG.CANVAS_WIDTH - btnW) / 2;
        const btnY = (GAME_CONFIG.CANVAS_HEIGHT - 260) / 2 + 260 - 70;
        if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
          this.startLevel(this.selectedLevelId);
        }
      }
    });
  }

  private async startLevel(levelId: number): Promise<void> {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level) return;

    this.selectedLevelId = levelId;
    this.stageManager.loadLevel(level);

    this.maxLoops = level.maxLoops;
    this.loopDuration = level.loopDuration;
    this.currentLoop = 1;

    this.ghosts = [];
    this.glitchedGhostIds.clear();
    this.particles.clear();

    this.resetLoopAgent();
    this.state = 'PLAYING';

    await PlayroomAdapter.startRun(levelId);
  }

  private resetLoopAgent(): void {
    if (!this.stageManager.currentLevel) return;
    const spawn = this.stageManager.currentLevel.spawn;
    this.agentPos = { x: spawn.x, y: spawn.y };
    this.agentVelocity = { x: 0, y: 0 };
    this.agentAngle = spawn.angle;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.remainingSeconds = this.loopDuration;

    this.recorder.start();
    this.sound.resetClockTick();
  }

  // 觸發時空倒流 (按 R 或 12 秒耗盡)
  private triggerRewind(reason: 'timeout' | 'manual'): void {
    if (this.isRewinding || this.state !== 'PLAYING') return;

    // 將當前特工錄製成果封存為殘影
    const colorConfig = GAME_CONFIG.GHOST_COLORS[(this.currentLoop - 1) % GAME_CONFIG.GHOST_COLORS.length];
    const ghost = this.recorder.stopAndExport(
      `echo-${this.currentLoop}`,
      colorConfig.name,
      colorConfig.color
    );
    this.ghosts.push(ghost);

    this.isRewinding = true;
    this.rewindTimer = GAME_CONFIG.REWIND_DURATION;
    this.rewindProgress = 0;
    this.renderer.addTrauma(0.4);
    this.sound.playRewindSwoosh();
  }

  private onRewindFinished(): void {
    this.isRewinding = false;
    this.currentLoop++;

    if (this.currentLoop > this.maxLoops) {
      // 迴圈預算用盡，時空坍縮
      this.triggerGameOver('迴圈次數耗盡，時空連續體崩潰！');
      return;
    }

    // 重置機關與當前特工
    this.stageManager.resetMechanisms();
    this.resetLoopAgent();
  }

  private triggerGameOver(reason: string): void {
    this.state = 'GAMEOVER';
    this.gameoverReason = reason;
    this.renderer.addTrauma(0.8);
    this.sound.playVaporized();
    PlayroomAdapter.finishRun(0);
  }

  private triggerVictory(): void {
    this.state = 'VICTORY';
    this.sound.playVictory();

    // 計算分數與星級
    const remainingTimeBonus = Math.floor(Math.max(0, this.remainingSeconds) * GAME_CONFIG.TIME_BONUS_PER_SEC);
    const loopSavedBonus = (this.maxLoops - this.currentLoop) * GAME_CONFIG.LOOP_SAVED_BONUS;
    const penalty = this.glitchedGhostIds.size * GAME_CONFIG.PARADOX_PENALTY;
    const totalScore = Math.max(0, GAME_CONFIG.BASE_SCORE + remainingTimeBonus + loopSavedBonus - penalty);

    // 星級評判
    let stars = 1;
    if (this.currentLoop <= 2 && this.glitchedGhostIds.size === 0) {
      stars = 3;
    } else if (this.currentLoop < this.maxLoops) {
      stars = 2;
    }

    this.victoryData = {
      score: totalScore,
      stars,
      timeBonus: remainingTimeBonus,
      loopBonus: loopSavedBonus,
      penalty,
    };

    PlayroomAdapter.saveStageProgress(this.selectedLevelId, totalScore, stars);
    PlayroomAdapter.finishRun(totalScore);
    this.refreshProgress();
  }

  // 主更新邏輯
  private update(dt: number): void {
    this.renderer.update(dt);
    this.particles.update(dt);

    if (this.state !== 'PLAYING') return;

    if (this.isRewinding) {
      this.rewindTimer -= dt;
      this.rewindProgress = 1.0 - Math.max(0, this.rewindTimer / GAME_CONFIG.REWIND_DURATION);
      if (this.rewindTimer <= 0) {
        this.onRewindFinished();
      }
      return;
    }

    // 1. 推進 12 秒倒數
    this.remainingSeconds -= dt;
    this.sound.updateClockTick(this.remainingSeconds);

    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.triggerRewind('timeout');
      return;
    }

    // 檢查手動按 R 回溯
    if (this.input.consumeRewind()) {
      this.triggerRewind('manual');
      return;
    }

    // 2. 特工運動學更新
    const move = this.input.getMovement();
    const isMoving = move.x !== 0 || move.y !== 0;

    // 衝刺 Blink Dash 判定
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    if (this.input.consumeDash() && this.dashCooldownTimer <= 0) {
      this.isDashing = true;
      this.dashTimer = GAME_CONFIG.DASH_DURATION;
      this.dashCooldownTimer = GAME_CONFIG.DASH_COOLDOWN;
      this.sound.playDash();
      this.particles.emitDashTrail(this.agentPos.x, this.agentPos.y, this.agentAngle, GAME_CONFIG.AGENT_COLOR);
    }

    // 計算加速度與摩擦阻尼
    const currentSpeed = this.isDashing ? GAME_CONFIG.DASH_SPEED : GAME_CONFIG.MAX_SPEED;
    if (isMoving) {
      this.agentVelocity.x += move.x * GAME_CONFIG.ACCELERATION * dt;
      this.agentVelocity.y += move.y * GAME_CONFIG.ACCELERATION * dt;
      const vLen = Math.hypot(this.agentVelocity.x, this.agentVelocity.y);
      if (vLen > currentSpeed) {
        this.agentVelocity.x = (this.agentVelocity.x / vLen) * currentSpeed;
        this.agentVelocity.y = (this.agentVelocity.y / vLen) * currentSpeed;
      }
    } else {
      // 阻尼摩擦
      const vLen = Math.hypot(this.agentVelocity.x, this.agentVelocity.y);
      if (vLen > 5) {
        const drop = GAME_CONFIG.FRICTION * dt;
        const newLen = Math.max(0, vLen - drop);
        this.agentVelocity.x = (this.agentVelocity.x / vLen) * newLen;
        this.agentVelocity.y = (this.agentVelocity.y / vLen) * newLen;
      } else {
        this.agentVelocity.x = 0;
        this.agentVelocity.y = 0;
      }
    }

    // 歐拉積分位移
    this.agentPos.x += this.agentVelocity.x * dt;
    this.agentPos.y += this.agentVelocity.y * dt;

    // 牆體與關閉閘門的阻擋碰撞修正
    this.stageManager.resolveWallCollisions(this.agentPos, GAME_CONFIG.PLAYER_RADIUS);

    // 瞄準角度
    this.agentAngle = this.input.getAimAngle(this.agentPos.x, this.agentPos.y, move.x, move.y);

    // 3. 殘影狀態獲取與機關裁決
    const currentElapsedSeconds = this.loopDuration - this.remainingSeconds;
    const activeGhosts = GhostPlayer.getGhostsAtTime(this.ghosts, currentElapsedSeconds, this.glitchedGhostIds);
    const ghostPositions = activeGhosts.filter((g) => g.isAlive).map((g) => ({ x: g.x, y: g.y }));

    this.stageManager.update(dt, this.agentPos, ghostPositions, this.particles);

    // 4. 殘影雷射碰撞檢測 (若殘影觸碰雷射，標記時空干擾消散)
    for (const g of activeGhosts) {
      if (g.isAlive && this.stageManager.checkLaserCollision(g.x, g.y, GAME_CONFIG.PLAYER_HITBOX_RADIUS)) {
        this.glitchedGhostIds.add(g.id);
        this.particles.emitGlitchExplosion(g.x, g.y, g.color);
        this.sound.playVaporized();
      }
    }

    // 5. 特工本體雷射致命判定 (氣化失敗)
    if (this.stageManager.checkLaserCollision(this.agentPos.x, this.agentPos.y, GAME_CONFIG.PLAYER_HITBOX_RADIUS)) {
      this.particles.emitGlitchExplosion(this.agentPos.x, this.agentPos.y, GAME_CONFIG.AGENT_COLOR);
      this.triggerGameOver('特工觸碰高能雷射防禦網，肉身瞬間氣化！');
      return;
    }

    // 6. 核心拾取檢測
    if (!this.stageManager.isCoreExtracted) {
      const distToCore = Math.hypot(
        this.agentPos.x - this.stageManager.corePosition.x,
        this.agentPos.y - this.stageManager.corePosition.y
      );
      if (distToCore <= GAME_CONFIG.PLAYER_RADIUS + 16) {
        this.stageManager.isCoreExtracted = true;
        this.sound.playCoreAcquired();
        this.particles.emitRipple(this.stageManager.corePosition.x, this.stageManager.corePosition.y, '#ffe600', 60);
      }
    }

    // 7. 撤離點通關檢測 (必須攜帶核心)
    if (this.stageManager.isCoreExtracted) {
      const distToExit = Math.hypot(
        this.agentPos.x - this.stageManager.exitPosition.x,
        this.agentPos.y - this.stageManager.exitPosition.y
      );
      if (distToExit <= GAME_CONFIG.PLAYER_RADIUS + 20) {
        this.triggerVictory();
        return;
      }
    }

    // 8. 記錄特工 Tick (60Hz 定頻採樣)
    let actions = 0;
    if (isMoving) actions |= 0b0001;
    if (this.isDashing) actions |= 0b0010;
    this.recorder.recordTick(this.agentPos.x, this.agentPos.y, this.agentAngle, actions);
  }

  // 主遊戲循環
  private gameLoop(time: number): void {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;

    this.update(dt);

    const currentElapsedSeconds = this.loopDuration - this.remainingSeconds;
    const activeGhosts = GhostPlayer.getGhostsAtTime(this.ghosts, currentElapsedSeconds, this.glitchedGhostIds);

    this.renderer.render({
      state: this.state,
      stageManager: this.stageManager,
      particles: this.particles,
      input: this.input,
      agentPos: {
        x: this.agentPos.x,
        y: this.agentPos.y,
        angle: this.agentAngle,
        isDashing: this.isDashing,
      },
      ghosts: activeGhosts,
      remainingSeconds: this.remainingSeconds,
      currentLoop: this.currentLoop,
      maxLoops: this.maxLoops,
      isRewinding: this.isRewinding,
      rewindProgress: this.rewindProgress,
      selectedLevelId: this.selectedLevelId,
      allProgress: this.allProgress,
      victoryData: this.victoryData,
      gameoverReason: this.gameoverReason,
      isMuted: this.sound.getMuted(),
    });

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
