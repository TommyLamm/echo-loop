import { LevelConfig, PressurePad, SecurityDoor, LaserHazard, Wall, Teleporter, EmpTerminal } from '../types';
import { GAME_CONFIG } from '../config/constants';
import { SoundEngine } from '../audio/SoundEngine';
import { ParticleSystem } from './ParticleSystem';

export class StageManager {
  public currentLevel: LevelConfig | null = null;
  public walls: Wall[] = [];
  public pads: PressurePad[] = [];
  public doors: SecurityDoor[] = [];
  public lasers: LaserHazard[] = [];
  public teleporters: Teleporter[] = [];
  public empTerminals: EmpTerminal[] = [];

  public isEmpActive: boolean = false;
  public empRemainingTimer: number = 0;

  public corePosition: { x: number; y: number } = { x: 0, y: 0 };
  public exitPosition: { x: number; y: number } = { x: 0, y: 0 };
  public isCoreExtracted: boolean = false;

  private sound = SoundEngine.get();

  public loadLevel(level: LevelConfig): void {
    this.currentLevel = level;
    // 深拷貝防污染
    this.walls = JSON.parse(JSON.stringify(level.walls));
    this.pads = JSON.parse(JSON.stringify(level.pads));
    this.doors = JSON.parse(JSON.stringify(level.doors));
    this.lasers = JSON.parse(JSON.stringify(level.lasers));
    this.teleporters = level.teleporters ? JSON.parse(JSON.stringify(level.teleporters)) : [];
    this.empTerminals = level.empTerminals ? JSON.parse(JSON.stringify(level.empTerminals)) : [];
    this.isEmpActive = false;
    this.empRemainingTimer = 0;

    // 記錄雷射巡邏基點
    for (const l of this.lasers) {
      if (l.patrol) {
        l.patrol.initialX1 = l.x1;
        l.patrol.initialX2 = l.x2;
        l.patrol.initialY1 = l.y1;
        l.patrol.initialY2 = l.y2;
      }
    }

    this.corePosition = { ...level.core };
    this.exitPosition = { ...level.exit };
    this.isCoreExtracted = false;
  }

  public resetMechanisms(): void {
    if (!this.currentLevel) return;
    this.pads = JSON.parse(JSON.stringify(this.currentLevel.pads));
    this.doors = JSON.parse(JSON.stringify(this.currentLevel.doors));
    this.lasers = JSON.parse(JSON.stringify(this.currentLevel.lasers));
    this.teleporters = this.currentLevel.teleporters ? JSON.parse(JSON.stringify(this.currentLevel.teleporters)) : [];
    this.empTerminals = this.currentLevel.empTerminals ? JSON.parse(JSON.stringify(this.currentLevel.empTerminals)) : [];
    this.isEmpActive = false;
    this.empRemainingTimer = 0;

    for (const l of this.lasers) {
      if (l.patrol) {
        l.patrol.initialX1 = l.x1;
        l.patrol.initialX2 = l.x2;
        l.patrol.initialY1 = l.y1;
        l.patrol.initialY2 = l.y2;
      }
    }

    this.isCoreExtracted = false;
  }

  public update(
    dt: number,
    agentPos: { x: number; y: number },
    ghostPositions: { x: number; y: number }[],
    particles: ParticleSystem
  ): void {
    // 1. 更新雷射週期與巡邏移動
    for (const laser of this.lasers) {
      if (laser.cycleTime && laser.onDuration && laser.offDuration) {
        laser.timer = (laser.timer || 0) + dt;
        if (laser.timer >= laser.cycleTime) {
          laser.timer -= laser.cycleTime;
        }
        laser.isActive = laser.timer < laser.onDuration;
      }

      // 巡邏雷射位移
      if (laser.patrol) {
        const p = laser.patrol;
        laser.timer = (laser.timer || 0) + dt;
        const offset = Math.sin(laser.timer * p.speed) * p.range;
        if (p.axis === 'y') {
          laser.y1 = (p.initialY1 ?? laser.y1) + offset;
          laser.y2 = (p.initialY2 ?? laser.y2) + offset;
        } else {
          laser.x1 = (p.initialX1 ?? laser.x1) + offset;
          laser.x2 = (p.initialX2 ?? laser.x2) + offset;
        }
      }
    }

    // 2. EMP 終端與癱瘓脈衝裁決
    if (this.empTerminals.length > 0) {
      for (const emp of this.empTerminals) {
        let isTouching = this.checkCircleOverlap(agentPos.x, agentPos.y, GAME_CONFIG.PLAYER_RADIUS, emp.x, emp.y, emp.radius);
        if (!isTouching) {
          for (const g of ghostPositions) {
            if (this.checkCircleOverlap(g.x, g.y, GAME_CONFIG.PLAYER_RADIUS, emp.x, emp.y, emp.radius)) {
              isTouching = true;
              break;
            }
          }
        }

        if (isTouching) {
          if (!emp.isCharged) {
            this.sound.playEmpCharge();
            particles.emitRipple(emp.x, emp.y, emp.color, 45);
          }
          emp.isCharged = true;
          emp.chargeTimer = emp.maxChargeTime || 3.0;
        } else {
          if (emp.chargeTimer > 0) {
            emp.chargeTimer -= dt;
            if (emp.chargeTimer <= 0) {
              emp.isCharged = false;
            }
          }
        }
      }

      // 檢查是否全體電極皆在時間窗口內激活
      const allCharged = this.empTerminals.every((t) => t.isCharged);
      if (allCharged && !this.isEmpActive) {
        this.isEmpActive = true;
        this.empRemainingTimer = 4.8;
        this.sound.playEmpBurst();
        particles.emitEmpShockwave(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2);
      }

      if (this.isEmpActive) {
        this.empRemainingTimer -= dt;
        if (this.empRemainingTimer <= 0) {
          this.isEmpActive = false;
        }
        // 全場雷射強制關閉
        for (const l of this.lasers) {
          l.isActive = false;
        }
      }
    }

    // 3. 傳送門 (Teleporters) 狀態更新與特工穿梭
    for (const t of this.teleporters) {
      if (t.cooldownTimer && t.cooldownTimer > 0) {
        t.cooldownTimer -= dt;
      }

      // 激活條件：若綁定踏板，需踏板處於按下狀態
      if (t.requiresPadId) {
        const controllingPad = this.pads.find((p) => p.id === t.requiresPadId);
        t.isActive = controllingPad ? controllingPad.isPressed : false;
      } else {
        t.isActive = true;
      }

      // 特工本體穿梭
      if (t.isActive && (!t.cooldownTimer || t.cooldownTimer <= 0)) {
        const dist = Math.hypot(agentPos.x - t.x, agentPos.y - t.y);
        if (dist <= t.radius + GAME_CONFIG.PLAYER_RADIUS * 0.7) {
          agentPos.x = t.targetX;
          agentPos.y = t.targetY;
          t.cooldownTimer = 0.55;
          particles.emitTeleportFlash(t.x, t.y, t.color);
          particles.emitTeleportFlash(t.targetX, t.targetY, t.color);
          this.sound.playTeleport();
        }
      }
    }

    // 4. 檢測踏板碰撞 (特工本體 + 所有活著的殘影)
    for (const pad of this.pads) {
      const wasPressed = pad.isPressed;
      let touching = this.checkCircleOverlap(agentPos.x, agentPos.y, GAME_CONFIG.PLAYER_RADIUS, pad.x, pad.y, pad.radius);

      if (!touching) {
        for (const g of ghostPositions) {
          if (this.checkCircleOverlap(g.x, g.y, GAME_CONFIG.PLAYER_RADIUS, pad.x, pad.y, pad.radius)) {
            touching = true;
            break;
          }
        }
      }

      if (touching) {
        pad.isPressed = true;
        pad.holdTimer = GAME_CONFIG.PAD_HOLD_DELAY;
        if (!wasPressed) {
          this.sound.playPedalClick(true);
          particles.emitRipple(pad.x, pad.y, pad.color, 45);
        }
      } else {
        pad.holdTimer -= dt;
        if (pad.holdTimer <= 0) {
          if (pad.isPressed) {
            this.sound.playPedalClick(false);
          }
          pad.isPressed = false;
        }
      }
    }

    // 3. 結算閘門狀態
    for (const door of this.doors) {
      const controllingPads = this.pads.filter((p) => p.targets.includes(door.id));
      const shouldOpen = controllingPads.length > 0 && controllingPads.some((p) => p.isPressed);

      if (shouldOpen) {
        door.openProgress = Math.min(1.0, door.openProgress + dt * GAME_CONFIG.DOOR_SPEED);
      } else {
        door.openProgress = Math.max(0.0, door.openProgress - dt * GAME_CONFIG.DOOR_SPEED);
      }
      door.isOpen = door.openProgress >= 0.85;
    }

    // 4. 核心粒子
    if (!this.isCoreExtracted) {
      particles.emitCoreSparkles(this.corePosition.x, this.corePosition.y);
    }
    // 5. 撤離點漩渦粒子
    particles.emitVortexParticle(this.exitPosition.x, this.exitPosition.y);
  }

  // 特工與牆體/關閉閘門的圓形-AABB 碰撞滑動修正
  public resolveWallCollisions(pos: { x: number; y: number }, radius: number): void {
    // 牆體碰撞
    for (const w of this.walls) {
      this.resolveCircleRect(pos, radius, w.x, w.y, w.w, w.h);
    }

    // 未全開的閘門碰撞
    for (const d of this.doors) {
      if (d.openProgress < 0.85) {
        // 依照 openProgress 縮放閘門碰撞寬度或高度 (門縮進牆體)
        let effectiveW = d.w;
        let effectiveH = d.h;
        let effectiveX = d.x;
        let effectiveY = d.y;

        if (d.orientation === 'vertical') {
          effectiveH = d.h * (1 - d.openProgress);
        } else {
          effectiveW = d.w * (1 - d.openProgress);
        }

        this.resolveCircleRect(pos, radius, effectiveX, effectiveY, effectiveW, effectiveH);
      }
    }
  }

  private resolveCircleRect(
    pos: { x: number; y: number },
    r: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): void {
    const closestX = Math.max(rx, Math.min(pos.x, rx + rw));
    const closestY = Math.max(ry, Math.min(pos.y, ry + rh));

    const dx = pos.x - closestX;
    const dy = pos.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < r * r && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = r - dist;
      pos.x += (dx / dist) * overlap;
      pos.y += (dy / dist) * overlap;
    } else if (distSq <= 0.0001) {
      // 玩家中心在矩形內
      pos.x += r;
    }
  }

  // 檢測點與雷射線段的碰撞
  public checkLaserCollision(px: number, py: number, radius: number): boolean {
    for (const l of this.lasers) {
      if (!l.isActive) continue;
      if (this.distToSegment(px, py, l.x1, l.y1, l.x2, l.y2) <= radius) {
        return true;
      }
    }
    return false;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(px - projX, py - projY);
  }

  private checkCircleOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  }
}
